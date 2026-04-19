import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithCredential,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  updatePassword,
  deleteUser as firebaseDeleteUser,
  EmailAuthProvider,
  type AuthCredential,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { SocialLogin } from '@capgo/capacitor-social-login'
import { auth } from './firebase'

export { auth, EmailAuthProvider }

/* -------------------------------------------------------------------------- */
/*  Native plugin init (idempotent)                                            */
/* -------------------------------------------------------------------------- */

/** Initialized lazily on first native sign-in attempt; safe to call multiple times. */
let socialLoginInitPromise: Promise<void> | null = null

function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** Initialize @capgo/capacitor-social-login with config from `import.meta.env`. */
export function ensureSocialLoginInitialized(): Promise<void> {
  if (!isNative()) return Promise.resolve()
  if (socialLoginInitPromise) return socialLoginInitPromise

  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env
  const webClientId = env.VITE_GOOGLE_WEB_CLIENT_ID
  const iOSClientId = env.VITE_GOOGLE_IOS_CLIENT_ID
  const appleServiceId = env.VITE_APPLE_SERVICE_ID
  const appleRedirectUrl = env.VITE_APPLE_REDIRECT_URL

  socialLoginInitPromise = SocialLogin.initialize({
    google: {
      // iOSClientId is the iOS-type OAuth client; webClientId is the Web-type OAuth client Firebase Auth uses.
      // Both must come from the same Google Cloud project as the Firebase project.
      iOSClientId: iOSClientId || undefined,
      iOSServerClientId: webClientId || undefined,
      webClientId: webClientId || undefined,
    },
    apple: {
      // iOS uses the app bundle ID via Sign in with Apple capability — clientId is only needed for Android (Service ID).
      clientId: appleServiceId || undefined,
      // Empty string skips redirect on iOS; Android needs a real Service ID redirect URL OR Broadcast Channel mode.
      redirectUrl: appleRedirectUrl ?? '',
    },
  }).catch((err) => {
    socialLoginInitPromise = null
    throw err
  })

  return socialLoginInitPromise
}

/* -------------------------------------------------------------------------- */
/*  Email                                                                      */
/* -------------------------------------------------------------------------- */

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function reauthenticateWithPassword(email: string, password: string) {
  const credential = EmailAuthProvider.credential(email, password)
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return reauthenticateWithCredential(user, credential)
}

export async function updateUserPassword(newPassword: string) {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return updatePassword(user, newPassword)
}

/* -------------------------------------------------------------------------- */
/*  Google                                                                     */
/* -------------------------------------------------------------------------- */

/** Returns a Firebase AuthCredential from the native Google plugin (iOS/Android). */
async function getNativeGoogleCredential(): Promise<AuthCredential> {
  await ensureSocialLoginInitialized()
  const { result } = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  })
  if (result.responseType === 'offline' || !result.idToken) {
    throw new Error('Google sign-in did not return an idToken')
  }
  return GoogleAuthProvider.credential(result.idToken, result.accessToken?.token ?? null)
}

export async function signInWithGoogle() {
  if (isNative()) {
    const credential = await getNativeGoogleCredential()
    return signInWithCredential(auth, credential)
  }
  return signInWithPopup(auth, new GoogleAuthProvider())
}

/** Reauthenticate with Google (e.g. before delete account for Google sign-in users). */
export async function reauthenticateWithGoogle() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  if (isNative()) {
    const credential = await getNativeGoogleCredential()
    return reauthenticateWithCredential(user, credential)
  }
  return reauthenticateWithPopup(user, new GoogleAuthProvider())
}

/* -------------------------------------------------------------------------- */
/*  Apple                                                                      */
/* -------------------------------------------------------------------------- */

/** Cryptographically random raw nonce (URL-safe base64). */
function generateRawNonce(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** SHA-256(rawNonce) → lowercase hex (the value we send to Apple as `nonce`). */
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', buf)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
}

/** Returns a Firebase AuthCredential from the native Apple plugin (iOS/Android). */
async function getNativeAppleCredential(): Promise<AuthCredential> {
  await ensureSocialLoginInitialized()

  // Apple signs the SHA-256 hash of `nonce`; Firebase verifies by hashing the rawNonce we pass into the credential.
  const rawNonce = generateRawNonce()
  const hashedNonce = await sha256Hex(rawNonce)

  const { result } = await SocialLogin.login({
    provider: 'apple',
    options: { scopes: ['name', 'email'], nonce: hashedNonce },
  })

  if (!result.idToken) throw new Error('Apple sign-in did not return an identity token')

  const provider = new OAuthProvider('apple.com')
  return provider.credential({ idToken: result.idToken, rawNonce })
}

export async function signInWithApple() {
  if (isNative()) {
    const credential = await getNativeAppleCredential()
    return signInWithCredential(auth, credential)
  }
  // Web fallback: Firebase popup flow.
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  return signInWithPopup(auth, provider)
}

export async function reauthenticateWithApple() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  if (isNative()) {
    const credential = await getNativeAppleCredential()
    return reauthenticateWithCredential(user, credential)
  }
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  return reauthenticateWithPopup(user, provider)
}

/* -------------------------------------------------------------------------- */
/*  Session                                                                    */
/* -------------------------------------------------------------------------- */

export async function signOut() {
  // Best-effort: sign the user out of native providers too, so the next "Continue with X" shows the chooser.
  if (isNative()) {
    for (const provider of ['google', 'apple'] as const) {
      try { await SocialLogin.logout({ provider }) } catch { /* ignore */ }
    }
  }
  return firebaseSignOut(auth)
}

export function onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, callback)
}

export async function deleteAuthUser() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return firebaseDeleteUser(user)
}
