import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import type { User } from 'firebase/auth'

export const DEFAULT_SETTINGS = {
  weightUnit: 'kg',
  measurementUnit: 'cm',
  defaultRest: 90,
  bodyweight: 80,
  weekStart: 0,
  unitWeight: 'kg',
  unitDistance: 'km',
  unitLength: 'cm',
  decimalSeparator: 'comma',
  dateFormat: 'ddmmyyyy',
  rirEnabled: false,
  theme: 'dark',
}

/**
 * Creates the user document in Firestore if it doesn't exist.
 * Call after signup or on first login (e.g. Google).
 */
export async function ensureUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    displayName: user.displayName ?? user.email ?? '',
    email: user.email ?? '',
    createdAt: serverTimestamp(),
    settings: DEFAULT_SETTINGS,
  })
}

export type UserSettings = Partial<typeof DEFAULT_SETTINGS>

/**
 * Fetches the user document (profile + settings).
 */
export async function getUserDoc(uid: string) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data()
}

/**
 * Merges new settings into the user doc (read-merge-write).
 */
export async function mergeUserSettings(uid: string, settings: UserSettings): Promise<void> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  const existing = snap.exists() ? (snap.data().settings as Record<string, unknown>) || {} : {}
  await updateDoc(ref, {
    settings: { ...existing, ...settings },
  })
}

/**
 * Set that the user has seen the "How programmes work" explainer (first-time create flow).
 * Stored at users/{uid}.hasSeenProgrammeExplainer
 */
export async function setHasSeenProgrammeExplainer(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, { hasSeenProgrammeExplainer: true })
}
