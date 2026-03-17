import { doc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { ref, listAll, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'

/**
 * Deletes all Firestore and Storage data for the given user.
 * Call before deleteAuthUser() when deleting account.
 */
export async function deleteUserData(uid: string): Promise<void> {
  // Subcollections must be deleted before the parent document
  const plansRef = collection(db, 'users', uid, 'workoutPlans')
  const plansSnap = await getDocs(plansRef)
  await Promise.all(plansSnap.docs.map((d) => deleteDoc(d.ref)))

  const sessionsRef = collection(db, 'users', uid, 'workoutSessions')
  const sessionsSnap = await getDocs(sessionsRef)
  await Promise.all(sessionsSnap.docs.map((d) => deleteDoc(d.ref)))

  const appDataRef = doc(db, 'users', uid, 'appData', 'main')
  await deleteDoc(appDataRef)

  const userRef = doc(db, 'users', uid)
  await deleteDoc(userRef)

  // Storage: progress photos
  const photosRef = ref(storage, `users/${uid}/progressPhotos`)
  try {
    const list = await listAll(photosRef)
    await Promise.all(list.items.map((itemRef) => deleteObject(itemRef)))
  } catch {
    // No folder or empty – ignore
  }
}
