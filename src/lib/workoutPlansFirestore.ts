import {
  collection,
  doc,
  getDocs,
  getDocsFromServer,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * Shape we store in Firestore: one doc per programme.
 * programme: { id, name, type, routineIds, isActive, currentIndex }
 * routine: { id, name, programmeId, exercises: [{ exerciseId, setConfigs, restOverride, rirOverride, note, supersetGroupId, supersetRole }] }
 */
function programmesAndRoutinesToPlans(programmes, routines) {
  const plans = []
  for (const prog of programmes || []) {
    const orderedRoutineIds = prog.routineIds || []
    const days = orderedRoutineIds
      .map((rtnId) => routines.find((r) => r.id === rtnId))
      .filter(Boolean)
      .map((r) => ({
        id: r.id,
        name: r.name,
        exercises: (r.exercises || []).map((ex) => ({
          exerciseId: ex.exerciseId,
          setConfigs: (ex.setConfigs || []).map((s) => ({
            targetKg: s.targetKg ?? '',
            targetReps: s.targetReps ?? '8-10',
          })),
          restOverride: ex.restOverride ?? null,
          rirOverride: ex.rirOverride ?? null,
          note: ex.note ?? '',
          supersetGroupId: ex.supersetGroupId ?? null,
          supersetRole: ex.supersetRole ?? null,
        })),
      }))
    plans.push({
      id: prog.id,
      name: prog.name,
      type: prog.type || 'rotation',
      routineIds: orderedRoutineIds,
      isActive: prog.isActive ?? false,
      currentIndex: prog.currentIndex ?? 0,
      days,
      updatedAt: serverTimestamp(),
      ...(prog.isQoreGenerated
        ? {
            isQoreGenerated: true,
            qoreRationale: prog.rationale ?? '',
            qoreSafetyNote: prog.safetyNote ?? null,
            qoreGoal: prog.qoreGoal ?? null,
            qoreLevel: prog.qoreLevel ?? null,
            qoreEquipment: prog.qoreEquipment ?? null,
            qoreDaysPerWeek: prog.qoreDaysPerWeek ?? null,
            qoreSessionLength: prog.qoreSessionLength ?? null,
            qoreFocusTags: Array.isArray(prog.qoreFocusTags) ? prog.qoreFocusTags : null,
            qoreFocusNotes: prog.qoreFocusNotes ?? null,
            qoreCreatedAt: prog.qoreCreatedAt ?? null,
          }
        : {}),
    })
  }
  return plans
}

function plansToProgrammesAndRoutines(plans) {
  const programmes = []
  const routines = []
  for (const p of plans || []) {
    programmes.push({
      id: p.id,
      name: p.name,
      type: p.type || 'rotation',
      routineIds: p.routineIds || [],
      isActive: p.isActive ?? false,
      currentIndex: p.currentIndex ?? 0,
      isQoreGenerated: !!p.isQoreGenerated,
      ...(p.isQoreGenerated
        ? {
            rationale: p.qoreRationale ?? '',
            safetyNote: p.qoreSafetyNote ?? null,
            qoreGoal: p.qoreGoal ?? null,
            qoreLevel: p.qoreLevel ?? null,
            qoreEquipment: p.qoreEquipment ?? null,
            qoreDaysPerWeek: p.qoreDaysPerWeek ?? null,
            qoreSessionLength: p.qoreSessionLength ?? null,
            qoreFocusTags: Array.isArray(p.qoreFocusTags) ? p.qoreFocusTags : null,
            qoreFocusNotes: p.qoreFocusNotes ?? null,
            qoreCreatedAt: p.qoreCreatedAt ?? null,
          }
        : {}),
    })
    for (const day of p.days || []) {
      routines.push({
        id: day.id,
        name: day.name,
        programmeId: p.id,
        exercises: (day.exercises || []).map((ex) => ({
          exerciseId: ex.exerciseId,
          setConfigs: (ex.setConfigs || []).map((s) => ({
            targetKg: s.targetKg ?? '',
            targetReps: s.targetReps ?? '8-10',
          })),
          restOverride: ex.restOverride ?? null,
          rirOverride: ex.rirOverride ?? null,
          note: ex.note ?? '',
          supersetGroupId: ex.supersetGroupId ?? null,
          supersetRole: ex.supersetRole ?? null,
        })),
      })
    }
  }
  return { programmes, routines }
}

/** Prefer server to avoid showing deleted/reset data from Firestore persistence cache */
async function snapshotWorkoutPlansCol(uid: string) {
  const col = collection(db, 'users', uid, 'workoutPlans')
  try {
    return await getDocsFromServer(col)
  } catch {
    return await getDocs(col)
  }
}

export async function fetchWorkoutPlans(uid: string) {
  const snap = await snapshotWorkoutPlansCol(uid)
  const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return plansToProgrammesAndRoutines(plans)
}

export async function saveWorkoutPlans(uid, programmes, routines) {
  const plans = programmesAndRoutinesToPlans(programmes, routines)
  const col = collection(db, 'users', uid, 'workoutPlans')
  const existing = await snapshotWorkoutPlansCol(uid)
  const existingIds = new Set(existing.docs.map((d) => d.id))
  const currentIds = new Set(plans.map((p) => p.id))
  const batch = writeBatch(db)
  for (const plan of plans) {
    const ref = doc(col, plan.id)
    const { days, ...rest } = plan
    const isNew = !existingIds.has(plan.id)
    batch.set(ref, { ...rest, days, ...(isNew ? { createdAt: serverTimestamp() } : {}) }, { merge: true })
  }
  // Remove Firestore docs for programmes no longer in state (manual + REPLIQE Coach deletes must persist)
  for (const d of existing.docs) {
    if (!currentIds.has(d.id)) {
      batch.delete(d.ref)
    }
  }
  await batch.commit()
}

export async function deleteWorkoutPlan(uid, planId) {
  await deleteDoc(doc(db, 'users', uid, 'workoutPlans', planId))
}
