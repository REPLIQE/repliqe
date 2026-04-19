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
