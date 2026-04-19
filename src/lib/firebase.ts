import { initializeApp } from 'firebase/app'
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'
import { getFunctions } from 'firebase/functions'
import { Capacitor } from '@capacitor/core'

const firebaseConfig = {
  apiKey: 'AIzaSyAEfBbBNArqTnPDk_rG35xcHyohh94SKwc',
  authDomain: 'repliqe-710d2.firebaseapp.com',
  projectId: 'repliqe-710d2',
  storageBucket: 'repliqe-710d2.firebasestorage.app',
  messagingSenderId: '120692948250',
  appId: '1:120692948250:web:afbc3c17b8dab3ba91c0a3',
  measurementId: 'G-QZSHWLHK4H',
}

/** Same app instance for Auth, Firestore, Storage, Analytics, and Functions callables. */
export const app = initializeApp(firebaseConfig)

/**
 * On native (Capacitor), use `initializeAuth` WITHOUT a popupRedirectResolver so the SDK
 * never pre-loads Google's gapi iframe. Loading it from `capacitor://localhost` /
 * `https://localhost` throws and blocks the whole app boot. Google + Apple sign-in on
 * native go through `signInWithCredential` (see `src/lib/auth.ts`), so the popup
 * resolver is unused there anyway.
 *
 * On web, keep the default `getAuth` behaviour (with `browserPopupRedirectResolver`)
 * so `signInWithPopup` still works for Google/Apple in the browser/PWA.
 */
export const auth: Auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    })
  : getAuth(app)

// Web export kept as a hint for any code that needs the resolver explicitly (currently nothing does).
export { browserPopupRedirectResolver }

export const db = getFirestore(app)
export const storage = getStorage(app)
export const analytics = getAnalytics(app)
/** Must match Cloud Functions region for `generateCoachProgrammeCallable`. */
export const functions = getFunctions(app, 'europe-west1')
