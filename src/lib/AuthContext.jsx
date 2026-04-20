import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signUpWithEmail, signInWithEmail, signInWithGoogle, signInWithApple, signOut } from './auth'
import { ensureUserDoc } from './userFirestore'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged((u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        ensureUserDoc(u).catch((err) => console.error('ensureUserDoc:', err))
      }
      // Auth has resolved (logged in or confirmed logged out) -> the app can paint its real
      // first screen now, so dismiss the brand splash. We wait two animation frames before
      // signaling readiness:
      //   - rAF #1 fires AFTER React has committed the state update from setUser/setLoading
      //     above (the commit is queued by React in response to the setState calls).
      //   - rAF #2 fires AFTER the browser has actually painted that committed frame.
      // Without this double-rAF the dismiss helper starts its fade-out (250ms) on the same
      // frame the post-splash screen is being mounted, so on slower Android devices the user
      // briefly sees a half-painted login screen behind the fading splash. The dismiss helper
      // in src/main.jsx also enforces a minimum-visible-time floor (1500ms from when the
      // splash actually became visible) so a near-instant resolve still gets a comfortable
      // brand moment. No-op in the brief window before main.jsx assigns the global, or after
      // a previous call has already dismissed the splash.
      if (typeof window !== 'undefined' && typeof window.__dismissBrandSplash === 'function') {
        const fire = () => window.__dismissBrandSplash()
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => window.requestAnimationFrame(fire))
        } else {
          fire()
        }
      }
    })
    return () => unsubscribe()
  }, [])

  const value = {
    user,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithApple,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx == null) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
