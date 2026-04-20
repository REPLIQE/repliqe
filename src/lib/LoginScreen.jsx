import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './AuthContext'
import RepliqeLogo from '../RepliqeLogo'

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password)
      } else {
        await signInWithEmail(email, password)
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleGoogle() {
    setError(null)
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function handleApple() {
    setError(null)
    setBusy(true)
    try {
      await signInWithApple()
    } catch (err) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${Capacitor.getPlatform() === 'android' ? 'h-[100dvh] overflow-y-auto' : 'min-h-screen'} bg-page flex flex-col items-center justify-center px-6 py-8`}>
      <div className="w-full max-w-sm flex flex-col items-center">
        <RepliqeLogo size={40} className="mb-6" />
        <h1 className="text-2xl font-bold text-text mb-1">REPLIQE</h1>
        <p className="text-sm text-muted mb-8">Log in to continue</p>

        {error && (
          <div className="w-full mb-4 py-2.5 px-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="w-full space-y-3 mb-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full py-3 px-4 rounded-xl bg-card-alt border border-border-strong text-text placeholder-muted outline-none focus:border-accent"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={mode === 'signup' ? 6 : undefined}
            className="w-full py-3 px-4 rounded-xl bg-card-alt border border-border-strong text-text placeholder-muted outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-xl bg-accent text-on-accent font-bold text-sm disabled:opacity-50"
          >
            {busy ? '…' : mode === 'signin' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="w-full relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-page text-muted">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          className="w-full py-3 px-4 rounded-xl bg-card-alt border border-border-strong text-text font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={handleApple}
          disabled={busy}
          className="mt-3 w-full py-3 px-4 rounded-xl bg-black border border-black text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16.365 1.43c0 1.14-.42 2.18-1.27 3.08-.98 1.03-2.16 1.62-3.36 1.52-.13-1.04.36-2.13 1.18-3 .9-.96 2.21-1.6 3.45-1.6zM20.5 17.45c-.55 1.27-.81 1.84-1.52 2.96-.99 1.55-2.39 3.49-4.13 3.5-1.55.02-1.95-1.01-4.06-1-2.11.01-2.55 1.02-4.1 1.01-1.74-.02-3.06-1.78-4.05-3.33C-.41 16.43-.69 11.05 1.78 8.21c1.31-1.51 3.39-2.46 5.34-2.46 1.99 0 3.24 1.09 4.89 1.09 1.59 0 2.56-1.09 4.86-1.09 1.74 0 3.58.95 4.89 2.59-4.3 2.36-3.6 8.51-1.26 9.11z" />
          </svg>
          Continue with Apple
        </button>

        <button
          type="button"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
          className="mt-6 text-sm text-muted hover:text-accent"
        >
          {mode === 'signin' ? 'Create account' : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
