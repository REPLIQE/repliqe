import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  reauthenticateWithCredential,
  updatePassword,
  deleteUser as firebaseDeleteUser,
  EmailAuthProvider,
  type User,
  type Unsubscribe,
} from 'firebase/auth'
import { auth } from './firebase'

export { auth, EmailAuthProvider }

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password)
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider()
  return signInWithPopup(auth, provider)
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export function onAuthStateChanged(callback: (user: User | null) => void): Unsubscribe {
  return firebaseOnAuthStateChanged(auth, callback)
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

export async function deleteAuthUser() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  return firebaseDeleteUser(user)
}

/** Reauthenticate with Google (e.g. before delete account for Google sign-in users). */
export async function reauthenticateWithGoogle() {
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  const provider = new GoogleAuthProvider()
  return reauthenticateWithPopup(user, provider)
}
