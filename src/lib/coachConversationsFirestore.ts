import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

export type CoachMessageStored = {
  role: 'user' | 'coach'
  text: string
  timestamp: number
}

export type CoachConversationDoc = {
  id: string
  title: string
  messages: CoachMessageStored[]
  createdAt?: unknown
  updatedAt?: unknown
}

const col = (uid: string) => collection(db, 'users', uid, 'coachConversations')

export async function listCoachConversations(uid: string, max = 10): Promise<CoachConversationDoc[]> {
  const q = query(col(uid), orderBy('updatedAt', 'desc'), limit(max))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    return {
      id: d.id,
      title: String(data.title ?? 'Conversation'),
      messages: Array.isArray(data.messages) ? (data.messages as CoachMessageStored[]) : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  })
}

export async function getCoachConversation(uid: string, conversationId: string): Promise<CoachConversationDoc | null> {
  const ref = doc(db, 'users', uid, 'coachConversations', conversationId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data() as Record<string, unknown>
  return {
    id: snap.id,
    title: String(data.title ?? 'Conversation'),
    messages: Array.isArray(data.messages) ? (data.messages as CoachMessageStored[]) : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

export async function createCoachConversation(uid: string): Promise<string> {
  const ref = await addDoc(col(uid), {
    title: 'New conversation',
    messages: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function saveCoachConversation(
  uid: string,
  conversationId: string,
  payload: { title?: string; messages: CoachMessageStored[] }
): Promise<void> {
  const ref = doc(db, 'users', uid, 'coachConversations', conversationId)
  await updateDoc(ref, {
    ...('title' in payload && payload.title != null ? { title: payload.title } : {}),
    messages: payload.messages,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCoachConversation(uid: string, conversationId: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'coachConversations', conversationId)
  await deleteDoc(ref)
}
