import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthContext'
import BottomSheet from '../BottomSheet'
import ActionButton from '../ActionButton'
import {
  auth,
  reauthenticateWithPassword,
  reauthenticateWithGoogle,
  updateUserPassword,
  deleteAuthUser,
} from './auth'
import { deleteUserData, clearAllUserContent } from './deleteUserData'
import { DeleteTrashBadge, DeleteTrashGlyph } from '../DeleteConfirmTrashIcon'
import {
  PLAN_LIMITS,
  defaultPlanUsage,
  countCoachProgrammes,
  countProgressPhotoSlots,
} from './planUsage'
import { CARD_SURFACE_LG } from '../cardTokens'
import { LegalDocumentIcon, LegalRowChevronRight } from './legalRowIcons'
import { TYPE_EMPHASIS_SM, TYPE_META, TYPE_OVERLINE_STRONG } from '../typographyTokens'

function UsageMeter({ label, used, cap, unlimited, extraText, hint }) {
  const capNum = unlimited ? null : cap
  const pct = capNum != null && capNum > 0 ? Math.min(100, (used / capNum) * 100) : null
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-xs text-text/85 font-medium leading-snug">{label}</span>
        <span className="text-xs font-bold text-text tabular-nums shrink-0 text-right">
          {unlimited ? (
            <>
              {used}
              {extraText ? ` ${extraText}` : ''} · Unlimited
            </>
          ) : capNum != null ? (
            <>
              {used} / {capNum}
            </>
          ) : (
            <>{used} this month</>
          )}
        </span>
      </div>
      {pct != null && (
        <div className="h-1.5 rounded-full bg-card-alt overflow-hidden">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
      )}
      {hint ? <p className={`${TYPE_META} text-muted-mid leading-snug`}>{hint}</p> : null}
    </div>
  )
}

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

/** Scroll expanded account section into view (fixed Profile header ~6rem + tabs). */
function useScrollIntoViewWhen(open, ref) {
  useEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [open, ref])
}

// TODO: Replace with numeric App Store ID when the iOS app is published
const APP_STORE_APP_ID = 'YOUR_APP_ID'

export function AboutTab({ setShowPrivacy, setShowTerms }) {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')

  const openRateRepliqe = () => {
    if (!APP_STORE_APP_ID || APP_STORE_APP_ID === 'YOUR_APP_ID') {
      console.warn('[REPLIQE] Set APP_STORE_APP_ID in AccountTab.jsx when the App Store listing is live.')
      window.open('https://apps.apple.com/', '_blank', 'noopener,noreferrer')
      return
    }
    const httpsUrl = `https://apps.apple.com/app/id${APP_STORE_APP_ID}`
    window.open(`itms-apps://itunes.apple.com/app/id${APP_STORE_APP_ID}`, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => {
      window.open(httpsUrl, '_blank', 'noopener,noreferrer')
    }, 400)
  }

  const shareRepliqe = async () => {
    const payload = {
      title: 'REPLIQE',
      text: 'Check out REPLIQE — simple fitness tracking with AI coaching.',
      url: 'https://repliqe.com',
    }
    try {
      if (navigator.share) {
        await navigator.share(payload)
      } else {
        window.open(
          `mailto:?subject=${encodeURIComponent('Check out REPLIQE')}&body=${encodeURIComponent('https://repliqe.com')}`,
          '_blank',
          'noopener,noreferrer'
        )
      }
    } catch {
      /* user cancelled share sheet */
    }
  }

  return (
    <div className="mt-1 space-y-4">
      {/* App info */}
      <div className={`${CARD_SURFACE_LG} p-5`}>
        <div className="text-sm text-muted-mid">
          <div className="mb-1 font-semibold text-text">REPLIQE v1.7</div>
          <div>Simple tracking. Real progress.</div>
        </div>
      </div>

      {/* Support & feedback */}
      <div>
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Support & feedback</div>
        <div className={`${CARD_SURFACE_LG} overflow-hidden`}>
          <button
            type="button"
            onClick={() =>
              window.open('mailto:hello@repliqe.com', '_blank', 'noopener,noreferrer')
            }
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 text-blue-400">
                <EnvelopeIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Contact us</div>
                <div className="text-muted-mid text-xs mt-0.5 truncate">hello@repliqe.com</div>
              </div>
            </div>
            <AboutChevronRight />
          </button>
          <button
            type="button"
            onClick={openRateRepliqe}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0 text-amber-400">
                <StarIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Rate REPLIQE</div>
                <div className="text-muted-mid text-xs mt-0.5">Enjoying the app? Let us know</div>
              </div>
            </div>
            <AboutChevronRight />
          </button>
          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 text-accent">
                <ChatBubbleIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Send feedback</div>
                <div className="text-muted-mid text-xs mt-0.5">Help us improve REPLIQE</div>
              </div>
            </div>
            <AboutChevronRight />
          </button>
        </div>
      </div>

      {/* Community */}
      <div>
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Community</div>
        <div className={`${CARD_SURFACE_LG} overflow-hidden`}>
          <button
            type="button"
            onClick={() =>
              window.open('https://instagram.com/repliqeapp', '_blank', 'noopener,noreferrer')
            }
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center shrink-0 text-pink-400">
                <InstagramIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Follow on Instagram</div>
                <div className="text-muted-mid text-xs mt-0.5">@repliqeapp</div>
              </div>
            </div>
            <AboutChevronRight />
          </button>
          <button
            type="button"
            onClick={() => void shareRepliqe()}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center shrink-0 text-success">
                <ShareIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Share REPLIQE</div>
                <div className="text-muted-mid text-xs mt-0.5">Tell a friend about the app</div>
              </div>
            </div>
            <AboutChevronRight />
          </button>
        </div>
      </div>

      {/* Legal */}
      <div>
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Legal</div>
        <div className={`${CARD_SURFACE_LG} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setShowPrivacy?.(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 border-b border-border text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-card-alt flex items-center justify-center shrink-0 text-muted-strong">
                <LegalDocumentIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Privacy Policy</div>
              </div>
            </div>
            <LegalRowChevronRight />
          </button>
          <button
            type="button"
            onClick={() => setShowTerms?.(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-card-alt flex items-center justify-center shrink-0 text-muted-strong">
                <LegalDocumentIcon />
              </span>
              <div className="min-w-0">
                <div className="text-text font-semibold text-sm">Terms of Service</div>
              </div>
            </div>
            <LegalRowChevronRight />
          </button>
        </div>
      </div>

      {showFeedback && (
        <BottomSheet
          onClose={() => setShowFeedback(false)}
          variant="card"
          zClass="z-50"
          layout="scrollable"
          padding="none"
          showHandle
          backdropClassName="bg-black/60 backdrop-blur-sm"
          panelClassName="p-5 pb-8 border-t border-border shadow-xl"
          role="dialog"
          ariaModal={true}
          ariaLabelledBy="feedback-sheet-title"
        >
            <div className="flex items-center justify-between mb-4">
              <h2 id="feedback-sheet-title" className="text-base font-bold text-text">
                Send feedback
              </h2>
              <button
                type="button"
                onClick={() => setShowFeedback(false)}
                className="text-muted-mid text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
            <p className="text-sm text-muted-strong mb-3">
              What&apos;s on your mind? We read every message.
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Your feedback..."
              rows={4}
              className="w-full bg-card-alt border-[1.5px] border-border-strong rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted-deep outline-none focus:border-accent transition-colors resize-none mb-4"
            />
            <ActionButton
              type="button"
              disabled={!feedbackText.trim()}
              onClick={() => {
                window.open(
                  `mailto:hello@repliqe.com?subject=${encodeURIComponent('REPLIQE Feedback')}&body=${encodeURIComponent(feedbackText)}`,
                  '_blank',
                  'noopener,noreferrer'
                )
                setFeedbackText('')
                setShowFeedback(false)
              }}
              variant="primary"
            >
              Send feedback
            </ActionButton>
        </BottomSheet>
      )}
    </div>
  )
}

export default function AccountTab({
  userPlan = 'free',
  setShowPricing,
  planUsage: planUsageProp,
  programmes = [],
  photoSessions = [],
}) {
  const planUsage = planUsageProp ?? defaultPlanUsage()
  const limits = PLAN_LIMITS[userPlan]
  const coachProgrammeTotal = countCoachProgrammes(programmes)
  const progressPhotosStored = countProgressPhotoSlots(photoSessions)
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

  const changePasswordAnchorRef = useRef(null)
  const resetConfirmAnchorRef = useRef(null)
  const deleteConfirmAnchorRef = useRef(null)

  useScrollIntoViewWhen(showChangePassword, changePasswordAnchorRef)
  useScrollIntoViewWhen(showResetConfirm, resetConfirmAnchorRef)
  useScrollIntoViewWhen(showDeleteConfirm, deleteConfirmAnchorRef)

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
      <div className={`${CARD_SURFACE_LG} p-4 flex items-center gap-3`}>
        <div className="w-12 h-12 rounded-full bg-card-alt border border-border flex items-center justify-center text-accent font-bold text-lg shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-text font-semibold truncate">{displayName || 'No name set'}</div>
          <div className="text-muted-mid text-sm truncate">{email}</div>
        </div>
      </div>

      {/* Subscription / upgrade */}
      <div>
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Subscription</div>
        <div className={`${CARD_SURFACE_LG} p-4 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={`${TYPE_OVERLINE_STRONG} mb-1`}>Current plan</p>
              <p className="text-lg font-bold text-text tracking-tight">
                {userPlan === 'free' && 'Free'}
                {userPlan === 'pro' && 'Pro'}
                {userPlan === 'elite' && 'Elite'}
              </p>
              <p className="text-xs text-muted-mid mt-0.5">
                {userPlan === 'free' &&
                  'Full tracking, one AI-generated programme, and up to 12 progress photos.'}
                {userPlan === 'pro' &&
                  'Higher monthly limits for AI programmes and Coach; up to 50 progress photos in total.'}
                {userPlan === 'elite' &&
                  'Top-tier limits for AI programmes and Coach; unlimited progress photo storage.'}
              </p>
            </div>
            <span
              className={`shrink-0 ${TYPE_EMPHASIS_SM} uppercase tracking-wide px-2.5 py-1 rounded-lg border ${
                userPlan === 'free'
                  ? 'border-border-strong text-muted-strong bg-card-alt'
                  : userPlan === 'pro'
                    ? 'border-accent text-accent bg-accent/10'
                    : 'border-success/50 text-success bg-success/10'
              }`}
            >
              {userPlan === 'free' ? 'Free' : userPlan === 'pro' ? 'Pro' : 'Elite'}
            </span>
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <p className={TYPE_OVERLINE_STRONG}>Plan usage</p>
            <p className={`${TYPE_META} text-muted-mid -mt-2 mb-1`}>
              Monthly counters reset on the 1st of each month (UTC). Progress photos on Free and Pro count toward a total storage cap, not per month.
            </p>

            {userPlan === 'free' && (
              <UsageMeter
                label="AI programmes (Coach)"
                used={coachProgrammeTotal}
                cap={limits.aiProgrammes ?? 1}
                hint="Lifetime limit on Free — upgrade for more AI programmes."
              />
            )}
            {(userPlan === 'pro' || userPlan === 'elite') && (
              <UsageMeter
                label="AI programmes saved (this month)"
                used={planUsage.coachProgrammesSaved}
                cap={limits.aiProgrammes ?? 0}
                hint="Each time you save a programme built with Coach."
              />
            )}

            {limits.coachMessages != null ? (
              <UsageMeter
                label="Coach generations (this month)"
                used={planUsage.coachGenerations}
                cap={limits.coachMessages}
                hint="Each successful Coach build counts as one generation."
              />
            ) : (
              <UsageMeter
                label="Coach generations (this month)"
                used={planUsage.coachGenerations}
                cap={null}
                unlimited={false}
                hint="No separate message cap on Free; AI programmes are limited as above."
              />
            )}

            {(userPlan === 'free' || userPlan === 'pro') && (
              <UsageMeter
                label="Progress photos (total stored)"
                used={progressPhotosStored}
                cap={limits.photos ?? (userPlan === 'pro' ? 50 : 12)}
                hint="Total photo slots (front, back, side) across all sessions."
              />
            )}
            {userPlan === 'elite' && (
              <UsageMeter
                label="Progress photos stored"
                used={progressPhotosStored}
                unlimited
                hint="No storage cap on Elite."
              />
            )}
          </div>

          {userPlan === 'free' && (
            <ActionButton type="button" variant="primary" className="shadow-lg shadow-accent/25" onClick={() => setShowPricing?.(true)}>
              Upgrade to Pro
            </ActionButton>
          )}
          {userPlan === 'pro' && (
            <ActionButton type="button" variant="success" className="shadow-lg" onClick={() => setShowPricing?.(true)}>
              Upgrade to Elite
            </ActionButton>
          )}
          {userPlan === 'elite' && (
            <button
              type="button"
              disabled
              className="w-full py-3.5 rounded-2xl font-bold text-sm bg-success/20 text-success border border-success/40 opacity-90 cursor-not-allowed"
            >
              Elite plan active
            </button>
          )}
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
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Security</div>
        <div className={`${CARD_SURFACE_LG} overflow-hidden`}>
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
                <div
                  ref={changePasswordAnchorRef}
                  className="p-4 border-t border-border flex flex-col gap-3 scroll-mt-36"
                >
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
                  <ActionButton
                    type="button"
                    className="sm:!py-4 shadow-lg shadow-accent/25"
                    onClick={handleChangePassword}
                    disabled={loading}
                    variant="primary"
                  >
                    {loading ? 'Saving…' : 'Save new password'}
                  </ActionButton>
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
        <div className={`${TYPE_OVERLINE_STRONG} px-1 mb-2`}>Account actions</div>
        <div className={`${CARD_SURFACE_LG} overflow-hidden`}>
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
            <div
              ref={resetConfirmAnchorRef}
              className="p-4 border-t border-border flex flex-col gap-3 scroll-mt-36"
            >
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
              <span className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 text-red-400">
                <DeleteTrashGlyph className="w-4 h-4" />
              </span>
              <span className="text-red-400 font-semibold text-sm">Delete account</span>
            </div>
            <ChevronRight />
          </button>

          {showDeleteConfirm && (
            <div
              ref={deleteConfirmAnchorRef}
              className="p-4 border-t border-border flex flex-col gap-3 scroll-mt-36"
            >
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
                className="w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm bg-red-600 text-white shadow-lg shadow-red-900/25 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Deleting…'
                ) : (
                  <>
                    <DeleteTrashGlyph className="w-4 h-4 text-white shrink-0" />
                    Yes, delete my account
                  </>
                )}
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

function AboutChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-muted-strong shrink-0">
      <polyline points="5,3 9,7 5,11" />
    </svg>
  )
}

function EnvelopeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

