import { useState, useEffect, useRef } from 'react'
import { setUserPlanInFirestore, USER_PLAN_STORAGE_KEY } from './lib/userFirestore'

/**
 * Bottom sheet pricing UI (mock checkout). Matches app modal pattern: backdrop + rounded-t sheet.
 */
export default function PricingSheet({ open, onClose, userId, userPlan, onPlanChange }) {
  const [billing, setBilling] = useState('yearly') // 'monthly' | 'yearly' — visual only; default yearly
  const [phase, setPhase] = useState('idle') // 'idle' | 'loading' | 'success'
  const [successLabel, setSuccessLabel] = useState(null) // 'Pro' | 'Elite'
  const timersRef = useRef([])

  const clearTimers = () => {
    timersRef.current.forEach((id) => clearTimeout(id))
    timersRef.current = []
  }

  useEffect(() => () => clearTimers(), [])

  if (!open) return null

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms)
    timersRef.current.push(id)
    return id
  }

  const handleSelectFree = () => {
    if (!userId || phase !== 'idle' || userPlan === 'free') return
    setPhase('loading')
    schedule(() => {
      try {
        localStorage.setItem(USER_PLAN_STORAGE_KEY, 'free')
      } catch {
        /* ignore */
      }
      setUserPlanInFirestore(userId, 'free')
        .then(() => {
          onPlanChange?.('free')
          setSuccessLabel('Free')
          setPhase('success')
          schedule(() => {
            onClose?.()
          }, 1800)
        })
        .catch((err) => {
          console.error('setUserPlanInFirestore (free):', err?.code || err?.message || err)
          setPhase('idle')
        })
    }, 400)
  }

  const handleMockPurchase = (planKey) => {
    if (!userId || phase !== 'idle') return
    const label = planKey === 'pro' ? 'Pro' : 'Elite'
    setPhase('loading')
    schedule(() => {
      try {
        localStorage.setItem(USER_PLAN_STORAGE_KEY, planKey)
      } catch {
        /* ignore */
      }
      setUserPlanInFirestore(userId, planKey)
        .then(() => {
          onPlanChange?.(planKey)
          setSuccessLabel(label)
          setPhase('success')
          schedule(() => {
            onClose?.()
          }, 2000)
        })
        .catch((err) => {
          console.error('setUserPlanInFirestore:', err?.code || err?.message || err)
          setPhase('idle')
        })
    }, 1500)
  }

  const handleBackdropClose = () => {
    if (phase === 'loading') return
    clearTimers()
    onClose?.()
  }

  const handleCloseClick = () => {
    clearTimers()
    onClose?.()
  }

  const freeFeatures = [
    'Unlimited workout tracking',
    'Unlimited manual programmes',
    '300+ exercises + custom exercises',
    'PR tracking, RIR, rest timer, supersets',
    'Strength progress + muscle recovery',
    '1 AI programme to get started',
    '12 progress photos',
  ]

  const proExtra = [
    '4 AI programmes / month',
    '20 REPLIQE Coach messages / month',
    '50 progress photos (total)',
  ]

  const eliteExtra = [
    '12 AI programmes / month',
    '60 REPLIQE Coach messages / month',
    'Unlimited progress photos',
  ]

  const proPrice =
    billing === 'yearly' ? (
      <>
        <span className="text-text font-bold">29 kr/md</span>
        <span className="text-muted-mid text-sm font-normal block mt-0.5">249 kr/år</span>
      </>
    ) : (
      <span className="text-text font-bold">39 kr/md</span>
    )

  const elitePrice =
    billing === 'yearly' ? (
      <>
        <span className="text-text font-bold">59 kr/md</span>
        <span className="text-muted-mid text-sm font-normal block mt-0.5">499 kr/år</span>
      </>
    ) : (
      <span className="text-text font-bold">79 kr/md</span>
    )

  return (
    <div
      className="fixed inset-0 z-[45] flex items-end justify-center bg-black/60 backdrop-blur-[4px]"
      onClick={handleBackdropClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md bg-page rounded-t-[20px] border-t border-border shadow-xl max-h-[92vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pricing-sheet-title"
      >
        <div className="w-9 h-1 bg-handle rounded mx-auto mt-2 shrink-0" aria-hidden />

        {/* Header — same rhythm as CreateProgrammeFlow SheetFrame */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-2 border-b border-border">
          <div className="w-10" aria-hidden />
          <p className="text-[10px] font-bold text-muted-strong uppercase tracking-wider">Plans</p>
          <button
            type="button"
            onClick={handleCloseClick}
            className="p-2 rounded-lg text-muted-strong hover:bg-card-alt transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-6 px-4 pt-2 relative">
          {(phase === 'loading' || phase === 'success') && (
            <div className="absolute inset-0 z-10 bg-page/95 backdrop-blur-[2px] flex flex-col items-center justify-center px-6 text-center">
              {phase === 'loading' && (
                <>
                  <div className="w-11 h-11 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm font-semibold text-text">Activating your plan…</p>
                </>
              )}
              {phase === 'success' && successLabel && (
                <p className="text-base font-bold text-text leading-snug">
                  {successLabel === 'Free' ? (
                    <>You&apos;re on Free again. Pro/Elite extras are paused until you upgrade.</>
                  ) : (
                    <>
                      Welcome to {successLabel}! 🎉 Your plan has been activated.
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          <h1 id="pricing-sheet-title" className="text-xl font-bold text-text mb-1">
            Choose your plan
          </h1>
          <p className="text-sm text-muted-mid mb-4">Unlock more AI programmes, Coach messages and photos.</p>

          {/* Monthly / Yearly toggle (visual) */}
          <div className="flex rounded-[10px] p-[3px] border border-border-strong bg-card-alt mb-5">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                billing === 'monthly' ? 'bg-accent text-on-accent shadow-lg shadow-accent/25' : 'text-muted-mid'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                billing === 'yearly' ? 'bg-accent text-on-accent shadow-lg shadow-accent/25' : 'text-muted-mid'
              }`}
            >
              Yearly
            </button>
          </div>

          <div className="space-y-4">
            {/* Free */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 className="text-lg font-bold text-text">Free</h2>
                <span className="text-sm font-semibold text-muted-mid">0 kr</span>
              </div>
              <ul className="space-y-2.5 mb-4">
                {freeFeatures.map((line) => (
                  <li key={line} className="text-sm text-success/90 leading-snug flex gap-2.5">
                    <span className="text-success shrink-0 mt-0.5 font-bold">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={userPlan === 'free' || phase !== 'idle'}
                onClick={handleSelectFree}
                className="w-full py-3 rounded-xl text-sm font-bold border border-border-strong text-muted-strong disabled:opacity-50 disabled:pointer-events-none"
              >
                {userPlan === 'free' ? 'Current plan' : 'Switch to Free'}
              </button>
            </div>

            {/* Pro — featured */}
            <div className="bg-card border-2 border-accent rounded-2xl p-4 shadow-lg shadow-accent/10 relative">
              <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase tracking-wide bg-accent text-on-accent px-2 py-0.5 rounded-md">
                Popular
              </span>
              <div className="flex items-baseline justify-between gap-2 mb-1 mt-1">
                <h2 className="text-lg font-bold text-text">Pro</h2>
                <div className="text-right text-sm">{proPrice}</div>
              </div>
              <p className="text-sm text-muted-mid mb-3">Everything in Free, plus</p>
              <ul className="space-y-2.5 mb-4">
                {proExtra.map((line) => (
                  <li key={line} className="text-sm text-success/90 leading-snug flex gap-2.5">
                    <span className="text-success shrink-0 mt-0.5 font-bold">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={userPlan === 'pro' || userPlan === 'elite' || phase !== 'idle'}
                onClick={() => handleMockPurchase('pro')}
                className="w-full py-3.5 rounded-2xl text-sm font-bold bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50 disabled:pointer-events-none"
              >
                Get Pro
              </button>
            </div>

            {/* Elite */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h2 className="text-lg font-bold text-text">Elite</h2>
                <div className="text-right text-sm">{elitePrice}</div>
              </div>
              <p className="text-sm text-muted-mid mb-3">Everything in Free, plus</p>
              <ul className="space-y-2.5 mb-4">
                {eliteExtra.map((line) => (
                  <li key={line} className="text-sm text-success/90 leading-snug flex gap-2.5">
                    <span className="text-success shrink-0 mt-0.5 font-bold">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={userPlan === 'elite' || phase !== 'idle'}
                onClick={() => handleMockPurchase('elite')}
                className="w-full py-3.5 rounded-2xl text-sm font-bold bg-success text-on-success shadow-lg disabled:opacity-50 disabled:pointer-events-none"
              >
                Get Elite
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-mid mt-6 px-2">Cancel anytime · No hidden fees</p>
        </div>
      </div>
    </div>
  )
}
