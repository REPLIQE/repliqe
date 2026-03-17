import {
  collection,
  doc,
  getDocs,
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

export async function fetchWorkoutPlans(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'workoutPlans'))
  const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return plansToProgrammesAndRoutines(plans)
}

export async function saveWorkoutPlans(uid, programmes, routines) {
  const plans = programmesAndRoutinesToPlans(programmes, routines)
  const col = collection(db, 'users', uid, 'workoutPlans')
  const existing = await getDocs(col)
  const existingIds = new Set(existing.docs.map((d) => d.id))
  const batch = writeBatch(db)
  for (const plan of plans) {
    const ref = doc(col, plan.id)
    const { days, ...rest } = plan
    const isNew = !existingIds.has(plan.id)
    batch.set(ref, { ...rest, days, ...(isNew ? { createdAt: serverTimestamp() } : {}) }, { merge: true })
  }
  await batch.commit()
}

export async function deleteWorkoutPlan(uid, planId) {
  await deleteDoc(doc(db, 'users', uid, 'workoutPlans', planId))
}
