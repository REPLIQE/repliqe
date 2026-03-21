import { useState } from 'react'
import { useAuth } from './AuthContext'
import {
  auth,
  reauthenticateWithPassword,
  reauthenticateWithGoogle,
  updateUserPassword,
  deleteAuthUser,
} from './auth'
import { deleteUserData, clearAllUserContent } from './deleteUserData'

function getInitials(displayName) {
  if (!displayName || typeof displayName !== 'string') return '?'
  return displayName
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
}

function isEmailProvider(user) {
  return user?.providerData?.some((p) => p?.providerId === 'password') ?? false
}

export default function AccountTab() {
  const { user, signOut } = useAuth()
  const displayName = user?.displayName ?? ''
  const email = user?.email ?? ''
  const initials = getInitials(displayName)
  const canChangePassword = isEmailProvider(user)

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogOut = async () => {
    setError('')
    try {
      await signOut()
    } catch (err) {
      setError('Failed to log out. Please try again.')
    }
  }

  const handleChangePassword = async () => {
    setError('')
    setSuccess('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await reauthenticateWithPassword(email, currentPassword)
      await updateUserPassword(newPassword)
      setSuccess('Password updated successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowChangePassword(false)
    } catch (err) {
      const code = err?.code ?? ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.')
      } else {
        setError('Failed to update password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleResetAllData = async () => {
    setError('')
    setLoading(true)
    try {
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error('Not signed in')
      await clearAllUserContent(uid)
      window.location.reload()
    } catch (err) {
      setError('Failed to reset data. Please try again.')
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setError('')
    if (canChangePassword && !deletePassword) {
      setError('Please enter your password to confirm.')
      return
    }
    setLoading(true)
    try {
      if (canChangePassword) {
        await reauthenticateWithPassword(email, deletePassword)
      } else {
        await reauthenticateWithGoogle()
      }
      const uid = auth.currentUser?.uid
      if (uid) await deleteUserData(uid)
      await deleteAuthUser()
      // User is now signed out; Auth state will update
    } catch (err) {
      const code = err?.code ?? ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Incorrect password.')
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled.')
      } else {
        setError('Failed to delete account. Please try again.')
      }
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="mt-1 space-y-4">
      {/* Avatar / profile row */}
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-card-alt border border-border flex items-center justify-center text-accent font-bold text-lg shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-text font-semibold truncate">{displayName || 'No name set'}</div>
          <div className="text-muted-mid text-sm truncate">{email}</div>
        </div>
      </div>

      {success && (
        <div className="bg-success/15 border border-success/30 text-success text-sm rounded-xl px-4 py-3">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* Security */}
      <div>
        <div className="text-[10px] font-bold text-muted-strong uppercase tracking-wider px-1 mb-2">Security</div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          {canChangePassword && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassword((v) => !v)
                  setError('')
                  setSuccess('')
                }}
                className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-lg bg-card-alt flex items-center justify-center shrink-0">
                    <LockIcon />
                  </span>
                  <div>
                    <div className="text-text font-semibold text-sm">Change password</div>
                    <div className="text-muted-mid text-xs mt-0.5">Update your password</div>
                  </div>
                </div>
                <span className="text-muted-strong text-lg">{showChangePassword ? '−' : '+'}</span>
              </button>
              {showChangePassword && (
                <div className="p-4 border-t border-border flex flex-col gap-3">
                  <input
                    type="password"
                    placeholder="Current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-card-alt border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted-mid outline-none focus:border-accent"
                  />
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-card-alt border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted-mid outline-none focus:border-accent"
                  />
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-card-alt border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted-mid outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={loading}
                    className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? 'Saving…' : 'Save new password'}
                  </button>
                </div>
              )}
            </>
          )}
          {!canChangePassword && (
            <div className="px-4 py-3.5 text-muted-mid text-sm">
              Signed in with Google. Password change is not available.
            </div>
          )}
        </div>
      </div>

      {/* Account actions */}
      <div>
        <div className="text-[10px] font-bold text-muted-strong uppercase tracking-wider px-1 mb-2">Account actions</div>
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={handleLogOut}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-card-alt flex items-center justify-center shrink-0">
                <LogOutIcon />
              </span>
              <span className="text-text font-semibold text-sm">Log out</span>
            </div>
            <ChevronRight />
          </button>

          <button
            type="button"
            onClick={() => {
              setShowResetConfirm((v) => !v)
              setError('')
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <RefreshIcon />
              </span>
              <span className="text-amber-400 font-semibold text-sm">Reset all data</span>
            </div>
            <ChevronRight />
          </button>

          {showResetConfirm && (
            <div className="p-4 border-t border-border flex flex-col gap-3">
              <div className="text-muted-strong text-xs bg-card-alt rounded-xl p-3">
                This will delete all your programmes, workout history, photos, weight and body logs. You stay logged in and can start fresh as a new user. This cannot be undone.
              </div>
              <button
                type="button"
                onClick={handleResetAllData}
                disabled={loading}
                className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm bg-amber-600 text-white shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? 'Resetting…' : 'Yes, reset all my data'}
              </button>
              <button
                type="button"
                onClick={() => { setShowResetConfirm(false); setError('') }}
                className="w-full py-2.5 text-muted-strong text-sm font-semibold hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm((v) => !v)
              setError('')
              setDeletePassword('')
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                <TrashIcon />
              </span>
              <span className="text-red-400 font-semibold text-sm">Delete account</span>
            </div>
            <ChevronRight />
          </button>

          {showDeleteConfirm && (
            <div className="p-4 border-t border-border flex flex-col gap-3">
              <div className="text-red-400/90 text-xs bg-red-500/10 rounded-xl p-3">
                This will permanently delete your account and all your data. This cannot be undone.
              </div>
              {canChangePassword ? (
                <input
                  type="password"
                  placeholder="Enter your password to confirm"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-card-alt border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted-mid outline-none focus:border-accent"
                />
              ) : (
                <p className="text-muted-mid text-xs">You will be asked to sign in with Google again to confirm.</p>
              )}
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={loading || (canChangePassword && !deletePassword)}
                className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm bg-red-600 text-white shadow-lg shadow-red-900/25 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? 'Deleting…' : 'Yes, delete my account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDeleteConfirm(false); setError('') }}
                className="w-full py-2.5 text-muted-strong text-sm font-semibold hover:text-text transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-strong">
      <polyline points="5,3 9,7 5,11" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent">
      <rect x="3" y="7" width="10" height="8" rx="2" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-strong">
      <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
      <polyline points="11,11 14,8 11,5" />
      <line x1="14" y1="8" x2="6" y2="8" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
      <path d="M14 8a6 6 0 0 0-10.5-4.2" />
      <path d="M2 8a6 6 0 0 0 10.5 4.2" />
      <path d="M2 2v4h4" />
      <path d="M14 14v-4h-4" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
      <polyline points="2,4 4,4 14,4" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M13 4l-.867 9.143A1 1 0 0 1 11.138 14H4.862a1 1 0 0 1-.995-.857L3 4" />
      <line x1="6" y1="7" x2="6" y2="11" />
      <line x1="10" y1="7" x2="10" y2="11" />
    </svg>
  )
}
