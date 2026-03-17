import {
  collection,
  doc,
  getDoc,
  addDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * App workout shape: { date, name, templateName, duration, exercises, routineId, rating?, sessionId? }
 * We store in Firestore: { completedAt, workout } so we can sort and roundtrip.
 */
export async function addWorkoutSession(uid, workout) {
  const col = collection(db, 'users', uid, 'workoutSessions')
  const ref = await addDoc(col, {
    completedAt: serverTimestamp(),
    workout: { ...workout, sessionId: null },
  })
  return ref.id
}

export async function fetchWorkoutSessions(uid, max = 500) {
  const col = collection(db, 'users', uid, 'workoutSessions')
  const q = query(
    col,
    orderBy('completedAt', 'desc'),
    limit(max)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    const w = data.workout || {}
    return { ...w, sessionId: d.id }
  })
}

export async function updateWorkoutSessionRating(uid, sessionId, rating) {
  const ref = doc(db, 'users', uid, 'workoutSessions', sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const workout = data.workout || {}
  await updateDoc(ref, { workout: { ...workout, rating } })
}
