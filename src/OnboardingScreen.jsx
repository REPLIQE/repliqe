import RepliqeLogo from './RepliqeLogo'
import ActionButton from './ActionButton'
import { DATE_FORMAT_DDMY, DATE_FORMAT_MMDY } from './dateFormatUtils'
import { parseDecimal } from './utils'

function ProgressBar({ currentStep }) {
  if (currentStep < 1) return null
  const total = 4
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
  legalChecked,
  onLegalCheckedChange,
  onLegalContinue,
  onOpenTerms,
  onOpenPrivacy,
  prefs,
  onPrefsChange,
  onPreferencesContinue,
  onCoach,
  onManual,
  programmeFlowLaunched,
  createdProgrammeName,
  onFinishTraining,
  onBack,
  canGoBack,
}) {
  const bwNum = parseDecimal(prefs.bodyweightInput)
  const bodyweightValid = prefs.bodyweightInput.trim() !== '' && !Number.isNaN(bwNum) && bwNum > 0

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

      {step >= 1 && step <= 4 ? <ProgressBar currentStep={step} /> : step !== 0 ? <div className="mb-6" /> : null}

      {step === 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex flex-col items-center justify-center text-center px-2">
            <RepliqeLogo size={56} className="mb-6" />
            <p className="text-lg text-muted-strong max-w-xs">Simple tracking. Real progress.</p>
          </div>
          <div className="w-full max-w-sm mx-auto pt-4 shrink-0">
            <ActionButton type="button" variant="primary" className="w-full" onClick={onWelcomeContinue}>
              Get started
            </ActionButton>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col">
          <p className="text-sm text-muted-strong mb-6">Before you continue, please review our terms.</p>
          <div className="flex flex-col gap-3 mb-6">
            <button type="button" onClick={onOpenTerms} className="text-left text-accent text-sm font-semibold underline underline-offset-2">
              Terms of Use
            </button>
            <button type="button" onClick={onOpenPrivacy} className="text-left text-accent text-sm font-semibold underline underline-offset-2">
              Privacy Policy
            </button>
          </div>
          <label className="flex items-start gap-3 mb-8 cursor-pointer">
            <input
              type="checkbox"
              checked={legalChecked}
              onChange={(e) => onLegalCheckedChange(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border-strong accent-accent"
            />
            <span className="text-sm text-text leading-snug">I have read and agree to the Terms of Use and Privacy Policy</span>
          </label>
          <div className="mt-auto">
            <ActionButton type="button" variant="primary" className="w-full" disabled={!legalChecked} onClick={onLegalContinue}>
              Continue
            </ActionButton>
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
          <ActionButton type="button" variant="primary" className="w-full shrink-0" disabled={!bodyweightValid} onClick={onPreferencesContinue}>
            Continue
          </ActionButton>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 flex flex-col">
          <h1 className="text-xl font-bold text-text mb-1">Create your first programme</h1>
          <p className="text-sm text-muted-strong mb-6">Choose how you want to get started.</p>
          <div className="flex flex-col gap-4 flex-1">
            <button
              type="button"
              onClick={onCoach}
              disabled={programmeFlowLaunched}
              className="flex-1 min-h-[120px] rounded-2xl border border-border-strong bg-card-alt p-5 text-left transition-colors hover:border-accent/50 disabled:opacity-50"
            >
              <div className="text-base font-bold text-text mb-2">Build with Coach</div>
              <p className="text-sm text-muted-strong">Answer a few questions and Coach will build a programme for you.</p>
            </button>
            <button
              type="button"
              onClick={onManual}
              disabled={programmeFlowLaunched}
              className="flex-1 min-h-[120px] rounded-2xl border border-border-strong bg-card-alt p-5 text-left transition-colors hover:border-accent/50 disabled:opacity-50"
            >
              <div className="text-base font-bold text-text mb-2">Build manually</div>
              <p className="text-sm text-muted-strong">Create your own programme from scratch.</p>
            </button>
          </div>
          <p className="text-center text-xs text-white/35 mt-6 mb-2">Your first programme is free.</p>
        </div>
      )}

      {step === 4 && (
        <div className="flex-1 flex flex-col justify-center text-center px-1">
          <h1 className="text-xl font-bold text-text mb-4">You&apos;re ready to train</h1>
          <p className="text-sm text-muted-strong mb-10 leading-relaxed">
            <span className="font-semibold text-text">{createdProgrammeName || 'Your programme'}</span> is set as your active programme and ready to go on the Workout screen.
          </p>
          <ActionButton type="button" variant="primary" className="w-full" onClick={onFinishTraining}>
            Start training
          </ActionButton>
        </div>
      )}
    </div>
  )
}
