import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const DEFAULT_FOLDERS = [{ name: 'My Templates', open: true, templates: [] }]

export type AppData = {
  folders?: Array<{ name: string; open?: boolean; templates: unknown[] }>
  customExercises?: unknown[]
  weightLog?: unknown[]
  bodyFatLog?: unknown[]
  measurementsLog?: unknown[]
  muscleMassLog?: unknown[]
  photoSessions?: unknown[]
  muscleLastWorked?: Record<string, string>
  currentWorkout?: {
    workoutName: string
    workoutStartTime: number | null
    exercises: unknown[]
  } | null
}

const DEFAULT_APP_DATA: AppData = {
  folders: DEFAULT_FOLDERS,
  customExercises: [],
  weightLog: [],
  bodyFatLog: [],
  measurementsLog: [],
  muscleMassLog: [],
  photoSessions: [],
  muscleLastWorked: {},
  currentWorkout: null,
}

function appDataRef(uid: string) {
  return doc(db, 'users', uid, 'appData', 'main')
}

/**
 * Fetches all app data for the user. Returns defaults for missing fields.
 */
export async function fetchAppData(uid: string): Promise<AppData> {
  const ref = appDataRef(uid)
  let snap
  try {
    snap = await getDocFromServer(ref)
  } catch {
    snap = await getDoc(ref)
  }
  if (!snap.exists()) return { ...DEFAULT_APP_DATA }
  const data = snap.data() as AppData
  return {
    folders: data.folders ?? DEFAULT_FOLDERS,
    customExercises: data.customExercises ?? [],
    weightLog: data.weightLog ?? [],
    bodyFatLog: data.bodyFatLog ?? [],
    measurementsLog: data.measurementsLog ?? [],
    muscleMassLog: data.muscleMassLog ?? [],
    photoSessions: data.photoSessions ?? [],
    muscleLastWorked: data.muscleLastWorked ?? {},
    currentWorkout: data.currentWorkout ?? null,
  }
}

/**
 * Merges partial app data into the user's appData doc (merge: true, no read needed).
 */
export async function updateAppData(uid: string, partial: Partial<AppData>): Promise<void> {
  const ref = appDataRef(uid)
  await setDoc(ref, partial, { merge: true })
}
