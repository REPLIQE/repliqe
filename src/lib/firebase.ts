import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = {
  apiKey: 'AIzaSyAEfBbBNArqTnPDk_rG35xcHyohh94SKwc',
  authDomain: 'repliqe-710d2.firebaseapp.com',
  projectId: 'repliqe-710d2',
  storageBucket: 'repliqe-710d2.firebasestorage.app',
  messagingSenderId: '120692948250',
  appId: '1:120692948250:web:afbc3c17b8dab3ba91c0a3',
  measurementId: 'G-QZSHWLHK4H',
}

/** Same app instance for Auth, Firestore, Storage, Analytics, and Functions callables. */
export const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const analytics = getAnalytics(app)
