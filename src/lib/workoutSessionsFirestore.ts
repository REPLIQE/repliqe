import {
  collection,
  doc,
  getDoc,
  addDoc,
  getDocs,
  getDocsFromServer,
  updateDoc,
  serverTimestamp,
  query,
  limit,
} from 'firebase/firestore'
import { db } from './firebase'

/**
 * App workout shape: { date, name, templateName, duration, exercises, routineId, rating?, sessionId? }
 * We store in Firestore: { completedAt, workout } so we can sort and roundtrip.
 * Firestore tillader ikke undefined – vi renser objektet med JSON roundtrip.
 */
function cleanForFirestore(obj) {
  const cleaned = JSON.parse(JSON.stringify(obj))
  delete cleaned.sessionId
  return cleaned
}

export async function addWorkoutSession(uid, workout) {
  const col = collection(db, 'users', uid, 'workoutSessions')
  const ref = await addDoc(col, {
    completedAt: serverTimestamp(),
    workout: cleanForFirestore(workout),
  })
  return ref.id
}

function docsToSessions(docs) {
  return docs
    .map((d) => {
      const data = d.data()
      const w = data.workout || {}
      const completedAt = data.completedAt?.toMillis?.() ?? data.completedAt ?? 0
      return { ...w, sessionId: d.id, _completedAt: completedAt }
    })
    .sort((a, b) => (b._completedAt || 0) - (a._completedAt || 0))
    .map(({ _completedAt, ...w }) => w)
}

export async function fetchWorkoutSessions(uid, max = 500) {
  const col = collection(db, 'users', uid, 'workoutSessions')
  const q = query(col, limit(max))
  const snap = await getDocs(q)
  return docsToSessions(snap.docs.slice(0, max))
}

/** Hent sessions direkte fra server (undgår cache – brug ved synk på tværs af devices). Ingen orderBy = ingen index krav. */
export async function fetchWorkoutSessionsFromServer(uid, max = 500) {
  const col = collection(db, 'users', uid, 'workoutSessions')
  const q = query(col, limit(max))
  const snap = await getDocsFromServer(q)
  return docsToSessions(snap.docs.slice(0, max))
}

export async function updateWorkoutSessionRating(uid, sessionId, rating) {
  const ref = doc(db, 'users', uid, 'workoutSessions', sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const workout = data.workout || {}
  await updateDoc(ref, { workout: { ...workout, rating } })
}

/** Link one photo session to a workout. At most one photo session per workout — no merge if one is already set. */
export async function updateWorkoutSessionPhotoSessions(uid, sessionId, photoSessionIds) {
  const ref = doc(db, 'users', uid, 'workoutSessions', sessionId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return
  const data = snap.data()
  const workout = data.workout || {}
  const existing = Array.isArray(workout.photoSessionIds) ? workout.photoSessionIds : []
  if (existing.length >= 1) return
  const incoming = Array.isArray(photoSessionIds) ? photoSessionIds : []
  const first = incoming.find((id) => id != null && id !== '')
  if (first == null) return
  await updateDoc(ref, { workout: { ...workout, photoSessionIds: [first] } })
}
