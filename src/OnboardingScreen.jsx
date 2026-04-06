import RepliqeLogo from './RepliqeLogo'
import ActionButton from './ActionButton'
import { DATE_FORMAT_DDMY, DATE_FORMAT_MMDY } from './dateFormatUtils'
import { LegalDocumentIcon, LegalRowChevronRight } from './lib/legalRowIcons'

function ProgressBar({ currentStep }) {
  if (currentStep < 1) return null
  const total = 3
  const filled = Math.min(currentStep, total)
  return (
    <div className="flex gap-1.5 mb-6" role="progressbar" aria-valuenow={filled} aria-valuemin={0} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${i < filled ? 'bg-accent' : 'bg-white/10'}`}
        />
      ))}
    </div>
  )
}

function OnboardingJourneyPreview() {
  const steps = [
    { n: 1, title: 'Terms & privacy', sub: 'Review and accept' },
    { n: 2, title: 'Preferences', sub: 'Units, dates, bodyweight' },
    {
      n: 3,
      title: 'Your first programme',
      sub: 'Coach builds a plan from your answers, or create everything yourself from scratch.',
    },
  ]
  return (
    <div
      className="w-full max-w-sm mx-auto mt-7 rounded-2xl border border-border-strong bg-card-alt/45 px-4 py-4 text-left shadow-sm shadow-black/10"
      aria-label="Onboarding overview"
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-border-strong/80" aria-hidden />
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-mid shrink-0">Your setup</p>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-border-strong/80" aria-hidden />
      </div>
      <ol className="space-y-0">
        {steps.map((s, i) => (
          <li key={s.n} className="flex gap-3.5">
            <div className="flex flex-col items-center shrink-0 w-9">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/40 bg-accent/[0.12] text-xs font-bold text-accent tabular-nums shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]">
                {s.n}
              </span>
              {i < steps.length - 1 ? (
                <span className="w-px flex-1 min-h-[14px] bg-gradient-to-b from-border-strong to-border-strong/40 my-1" aria-hidden />
              ) : null}
            </div>
            <div className={`min-w-0 ${i < steps.length - 1 ? 'pb-5' : ''} pt-1`}>
              <p className="text-sm font-semibold text-text leading-snug">{s.title}</p>
              <p className="text-xs text-muted-mid mt-1 leading-snug">{s.sub}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ToggleRow({ label, options, value, onChange, optionLabels }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-semibold text-text mb-2">{label}</div>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${
              value === opt ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'
            }`}
          >
            {optionLabels ? optionLabels[i] : opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function OnboardingScreen({
  step,
  onWelcomeContinue,
  onWelcomeSkip,
  legalChecked,
  onLegalCheckedChange,
  onLegalContinue,
  onSkipOnboarding,
  termsOnlyPath,
  onOpenTerms,
  onOpenPrivacy,
  prefs,
  onPrefsChange,
  onPreferencesContinue,
  onResumeProgrammeFlow,
  programmeFlowOpen,
  onBack,
  canGoBack,
}) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-page text-text px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] max-w-md mx-auto w-full">
      {step !== 0 ? (
        <div className="flex items-center gap-2 min-h-[44px] mb-2">
          {canGoBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-muted-strong hover:text-text"
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          ) : (
            <span className="w-[38px]" aria-hidden />
          )}
          <div className="flex-1" />
        </div>
      ) : null}

      {step >= 1 && step <= 3 ? <ProgressBar currentStep={step} /> : step !== 0 ? <div className="mb-6" /> : null}

      {step === 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 flex justify-center px-1 pt-1 pb-2">
            <div className="w-full max-w-sm rounded-2xl border border-border-strong/80 bg-card-alt/35 px-4 py-4 shadow-sm shadow-black/5">
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1 rounded-2xl bg-accent/5 blur-md" aria-hidden />
                  <RepliqeLogo size={56} className="relative shrink-0" />
                </div>
                <div className="text-left min-w-0">
                  <h1 className="text-2xl font-bold text-text tracking-tight leading-tight mb-1">REPLIQE</h1>
                  <p className="text-sm text-muted-strong leading-snug">Simple tracking. Real progress.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-0 overflow-y-auto px-1 py-4">
            <div className="text-center w-full max-w-sm mx-auto">
              <div className="mb-2 flex justify-center">
                <span className="h-1 w-10 rounded-full bg-accent/50" aria-hidden />
              </div>
              <h2 className="text-[1.35rem] font-bold text-text tracking-tight mb-2">Welcome</h2>
              <p className="text-sm text-muted-strong max-w-[280px] mx-auto leading-relaxed">
                With a few short questions we&apos;ll get you training in no time.
              </p>
              <OnboardingJourneyPreview />
            </div>
          </div>
          <div className="shrink-0 w-full max-w-sm mx-auto border-t border-border-strong/50 pt-5 mt-1 space-y-3 pb-1">
            <ActionButton type="button" variant="primary" className="w-full" onClick={onWelcomeContinue}>
              Get started
            </ActionButton>
            <button
              type="button"
              onClick={onWelcomeSkip}
              className="w-full text-center text-sm font-semibold text-muted-strong hover:text-text py-2.5 rounded-xl transition-colors"
            >
              Skip onboarding
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-text tracking-tight mb-2">Terms &amp; privacy</h1>
            <p className="text-sm text-muted-strong leading-relaxed">
              {termsOnlyPath
                ? 'Accept the terms below to continue to the app without a programme. You can set preferences and add a programme later from Profile and Plan.'
                : 'Review the documents below, then confirm to continue.'}
            </p>
          </div>

          <div className="rounded-2xl border border-border-strong bg-card-alt/50 overflow-hidden mb-5">
            <button
              type="button"
              onClick={onOpenTerms}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left border-b border-border-strong/70 hover:bg-card-alt/80 active:bg-card-alt transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-card-alt flex items-center justify-center shrink-0 text-muted-strong">
                  <LegalDocumentIcon />
                </span>
                <span className="text-sm font-semibold text-text">Terms of Use</span>
              </span>
              <LegalRowChevronRight />
            </button>
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-card-alt/80 active:bg-card-alt transition-colors"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-card-alt flex items-center justify-center shrink-0 text-muted-strong">
                  <LegalDocumentIcon />
                </span>
                <span className="text-sm font-semibold text-text">Privacy Policy</span>
              </span>
              <LegalRowChevronRight />
            </button>
          </div>

          <div className="rounded-2xl border border-border-strong/90 bg-card-alt/30 p-4 mb-6">
            <label className="flex items-start gap-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={legalChecked}
                onChange={(e) => onLegalCheckedChange(e.target.checked)}
                className="mt-0.5 w-[18px] h-[18px] rounded border-border-strong accent-accent shrink-0"
              />
              <span className="text-sm text-text leading-snug">
                I have read and agree to the Terms of Use and Privacy Policy
              </span>
            </label>
          </div>

          <div className="mt-auto space-y-3 pt-2">
            <ActionButton type="button" variant="primary" className="w-full" disabled={!legalChecked} onClick={onLegalContinue}>
              Continue
            </ActionButton>
            {legalChecked && !termsOnlyPath ? (
              <button
                type="button"
                onClick={onSkipOnboarding}
                className="w-full text-center text-sm font-semibold text-muted-strong hover:text-text py-2.5 rounded-xl transition-colors"
              >
                Skip onboarding
              </button>
            ) : null}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col min-h-0">
          <h1 className="text-xl font-bold text-text mb-1">Set your preferences</h1>
          <p className="text-sm text-muted-strong mb-6">You can change these any time in Profile → Settings.</p>
          <div className="overflow-y-auto flex-1 min-h-0 pb-4">
            <ToggleRow label="Weight" options={['kg', 'lbs']} value={prefs.unitWeight} onChange={(v) => onPrefsChange({ ...prefs, unitWeight: v })} />
            <ToggleRow label="Distance" options={['km', 'miles']} value={prefs.unitDistance} onChange={(v) => onPrefsChange({ ...prefs, unitDistance: v })} />
            <ToggleRow label="Length" options={['cm', 'inch']} value={prefs.unitLength} onChange={(v) => onPrefsChange({ ...prefs, unitLength: v })} />
            <ToggleRow
              label="Decimal"
              options={['comma', 'period']}
              optionLabels={['1,5', '1.5']}
              value={prefs.decimalSeparator}
              onChange={(v) => onPrefsChange({ ...prefs, decimalSeparator: v })}
            />
            <ToggleRow
              label="Date format"
              options={[DATE_FORMAT_DDMY, DATE_FORMAT_MMDY]}
              optionLabels={['DD/MM/YY', 'MM/DD/YY']}
              value={prefs.dateFormat}
              onChange={(v) => onPrefsChange({ ...prefs, dateFormat: v })}
            />
            <div className="mb-5">
              <div className="text-sm font-semibold text-text mb-1">Bodyweight</div>
              <p className="text-xs text-muted-mid mb-2">Used for volume on bodyweight exercises</p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  value={prefs.bodyweightInput}
                  onChange={(e) => onPrefsChange({ ...prefs, bodyweightInput: e.target.value })}
                  placeholder="—"
                  className="w-28 bg-card-alt border border-border-strong rounded-xl px-3 py-2 text-center text-sm font-bold text-text outline-none focus:border-accent transition-colors"
                />
                <span className="text-sm text-muted-mid">{prefs.unitWeight}</span>
              </div>
            </div>
          </div>
          <ActionButton type="button" variant="primary" className="w-full shrink-0" onClick={onPreferencesContinue}>
            Continue
          </ActionButton>
        </div>
      )}

      {step === 3 && programmeFlowOpen ? <div className="flex-1 min-h-0" aria-hidden /> : null}
      {step === 3 && !programmeFlowOpen ? (
        <div className="flex-1 flex flex-col justify-center text-center px-2">
          <h1 className="text-xl font-bold text-text mb-2">Create your programme</h1>
          <p className="text-sm text-muted-strong mb-8 max-w-sm mx-auto leading-relaxed">
            You closed the setup. Continue here to choose Coach or manual — same as creating a programme from Plan.
          </p>
          <div className="w-full max-w-sm mx-auto space-y-3">
            <ActionButton type="button" variant="primary" className="w-full" onClick={onResumeProgrammeFlow}>
              Continue
            </ActionButton>
            <button
              type="button"
              onClick={onSkipOnboarding}
              className="w-full text-center text-sm font-semibold text-muted-strong hover:text-text py-2.5 rounded-xl transition-colors"
            >
              Skip onboarding
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
