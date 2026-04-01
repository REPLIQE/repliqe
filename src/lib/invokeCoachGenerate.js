import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

const generateCoachCallable = httpsCallable(functions, 'generateCoachProgrammeCallable')

/**
 * Coach → Anthropic via Firebase Callable (works on mobile/PWA where raw fetch() to cloudfunctions.net often fails).
 */
export async function invokeCoachGenerate(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Missing prompt')
  }
  const result = await generateCoachCallable({ prompt })
  const text = result.data?.text
  if (!text || typeof text !== 'string') {
    throw new Error('Empty response from coach')
  }
  return text
}

/** Map FirebaseError / network errors to short UI copy. */
export function coachInvokeErrorMessage(error) {
  const code = error?.code
  const msg = error?.message != null ? String(error.message) : ''

  if (code === 'functions/unauthenticated') {
    return 'Sign in to use Coach.'
  }
  if (code === 'functions/invalid-argument') {
    return msg || 'Invalid request.'
  }
  if (code === 'functions/failed-precondition') {
    return 'Coach is temporarily unavailable. Please try again later.'
  }

  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
    return 'Could not reach Coach. Check your connection or try again.'
  }

  if (msg && msg.length < 220) return msg
  return 'Something went wrong. Please try again.'
}
