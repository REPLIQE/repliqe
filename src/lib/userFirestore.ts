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
    onboardingComplete: false,
    onboardingStep: 0,
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

/** Paid subscription tier stored at users/{uid}.plan (top-level field). */
export type PaidPlan = 'pro' | 'elite'
export type UserPlan = 'free' | PaidPlan

export const USER_PLAN_STORAGE_KEY = 'repliqe_user_plan'

export function normalizeUserPlan(value: unknown): UserPlan {
  if (value === 'pro' || value === 'elite') return value
  return 'free'
}

/**
 * Persists plan on the user document (mock or real checkout).
 * Use `'free'` to downgrade; stored explicitly so Firestore wins over stale localStorage.
 */
export async function setUserPlanInFirestore(uid: string, plan: UserPlan): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, { plan })
}

/** Onboarding wizard progress on `users/{uid}` (not under settings). */
export async function updateOnboardingProgress(uid: string, onboardingStep: number): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, { onboardingStep })
}

export async function completeUserOnboarding(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, { onboardingComplete: true, onboardingStep: 5 })
}
