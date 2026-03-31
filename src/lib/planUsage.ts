import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { UserPlan } from './userFirestore'

/** Monthly usage counters (calendar month UTC). Stored on users/{uid}.planUsage */
export type PlanUsage = {
  periodKey: string
  coachGenerations: number
  coachProgrammesSaved: number
  progressPhotosThisPeriod: number
}

export const PLAN_LIMITS: Record<
  UserPlan,
  { aiProgrammes: number | null; coachMessages: number | null; photos: number | null; photosMonthly: boolean }
> = {
  free: { aiProgrammes: 1, coachMessages: null, photos: 12, photosMonthly: false },
  pro: { aiProgrammes: 4, coachMessages: 20, photos: 50, photosMonthly: false },
  elite: { aiProgrammes: 12, coachMessages: 60, photos: null, photosMonthly: true },
}

export function currentUsagePeriodKey(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function defaultPlanUsage(): PlanUsage {
  return {
    periodKey: currentUsagePeriodKey(),
    coachGenerations: 0,
    coachProgrammesSaved: 0,
    progressPhotosThisPeriod: 0,
  }
}

export function mergePlanUsage(raw: unknown): PlanUsage {
  const key = currentUsagePeriodKey()
  const base = defaultPlanUsage()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.periodKey !== key) return base
  return {
    periodKey: key,
    coachGenerations: Math.max(0, Number(o.coachGenerations) || 0),
    coachProgrammesSaved: Math.max(0, Number(o.coachProgrammesSaved) || 0),
    progressPhotosThisPeriod: Math.max(0, Number(o.progressPhotosThisPeriod) || 0),
  }
}

/** Total progress photo slots (front/back/side) across sessions. */
export function countProgressPhotoSlots(sessions: unknown[] | null | undefined): number {
  if (!Array.isArray(sessions)) return 0
  return sessions.reduce((sum, s) => {
    if (!s || typeof s !== 'object') return sum
    const o = s as Record<string, unknown>
    return sum + [o.front, o.back, o.side].filter(Boolean).length
  }, 0)
}

/** Coach-generated programmes (lifetime count from data). */
export function countCoachProgrammes(programmes: unknown[] | null | undefined): number {
  if (!Array.isArray(programmes)) return 0
  return programmes.filter((p) => {
    if (!p || typeof p !== 'object') return false
    const o = p as Record<string, unknown>
    return o.source === 'coach' || o.isQoreGenerated === true
  }).length
}

export function photoAtLimit(userPlan: UserPlan, totalPhotos: number, _usage: PlanUsage): boolean {
  const lim = PLAN_LIMITS[userPlan]
  if (userPlan === 'elite') return false
  if (userPlan === 'free') return totalPhotos >= (lim.photos ?? 12)
  if (userPlan === 'pro') return totalPhotos >= (lim.photos ?? 50)
  return false
}

export function photoLimitLabel(userPlan: UserPlan): string {
  const lim = PLAN_LIMITS[userPlan]
  if (userPlan === 'elite') return 'Unlimited'
  return String(lim.photos ?? '—')
}

/**
 * Persist usage deltas; resets counters when billing period (month) changes.
 */
export async function incrementPlanUsage(
  uid: string,
  delta: { coachGenerations?: number; coachProgrammesSaved?: number; progressPhotos?: number }
): Promise<PlanUsage> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('User document missing')
  const data = snap.data()
  let u = mergePlanUsage(data.planUsage)
  u = {
    periodKey: u.periodKey,
    coachGenerations: u.coachGenerations + (delta.coachGenerations ?? 0),
    coachProgrammesSaved: u.coachProgrammesSaved + (delta.coachProgrammesSaved ?? 0),
    progressPhotosThisPeriod: Math.max(0, u.progressPhotosThisPeriod + (delta.progressPhotos ?? 0)),
  }
  await updateDoc(ref, { planUsage: u })
  return u
}

/** If stored period is not current month, write reset counters to Firestore. */
export async function syncPlanUsagePeriod(uid: string, raw: unknown): Promise<PlanUsage> {
  const merged = mergePlanUsage(raw)
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return merged
  const prev = snap.data().planUsage as Record<string, unknown> | undefined
  if (!prev || prev.periodKey !== merged.periodKey) {
    await updateDoc(ref, { planUsage: merged })
  }
  return merged
}
