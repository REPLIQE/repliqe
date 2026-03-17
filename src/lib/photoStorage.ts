import { ref, uploadString, getDownloadURL } from 'firebase/storage'
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
