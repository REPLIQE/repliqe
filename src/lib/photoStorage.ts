import { ref, uploadString, getDownloadURL, getBlob, deleteObject } from 'firebase/storage'
import { storage } from './firebase'

const PROGRESS_PHOTOS_PATH = 'progressPhotos'

/**
 * Upload a progress photo (base64 JPEG) to Firebase Storage.
 * Path: users/{uid}/progressPhotos/{filename}
 */
export async function uploadProgressPhoto(
  uid: string,
  filename: string,
  base64Data: string
): Promise<void> {
  const path = `users/${uid}/${PROGRESS_PHOTOS_PATH}/${filename}`
  const storageRef = ref(storage, path)
  await uploadString(storageRef, base64Data, 'base64', {
    contentType: 'image/jpeg',
  })
}

/**
 * Get a public download URL for a progress photo.
 * Returns null if not found or on error.
 */
export async function getProgressPhotoUrl(
  uid: string,
  filename: string
): Promise<string | null> {
  try {
    const path = `users/${uid}/${PROGRESS_PHOTOS_PATH}/${filename}`
    const storageRef = ref(storage, path)
    return await getDownloadURL(storageRef)
  } catch {
    return null
  }
}

/**
 * Henter billedet som Blob via Firebase SDK (samme auth som upload).
 * Undgår CORS/canvas “tainted”-problemer ved at bruge download-URL i fetch.
 */
export async function getProgressPhotoBlob(uid: string, filename: string): Promise<Blob> {
  const path = `users/${uid}/${PROGRESS_PHOTOS_PATH}/${filename}`
  const storageRef = ref(storage, path)
  return getBlob(storageRef)
}

/** Sletter ét progress-foto i Storage (web/sync). Ignorerer fejl hvis filen ikke findes. */
export async function deleteProgressPhoto(uid: string, filename: string): Promise<void> {
  const path = `users/${uid}/${PROGRESS_PHOTOS_PATH}/${filename}`
  const storageRef = ref(storage, path)
  try {
    await deleteObject(storageRef)
  } catch {
    /* not found / allerede slettet */
  }
}
