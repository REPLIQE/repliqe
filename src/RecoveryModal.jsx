import { useEffect, useRef } from 'react'
import BottomSheet from './BottomSheet'
import {
  formatMuscleLabel,
  MUSCLE_COLOURS_HEX,
  MUSCLE_RECOVERY_HOURS,
  getMuscleRecoveryPct,
  getRecoveryPct,
  formatHoursAgo,
} from './utils'
import {
  TYPE_BODY,
  TYPE_BODY_SEMIBOLD,
  TYPE_DISPLAY_LG,
  TYPE_EMPHASIS_SM,
  TYPE_LABEL_UPPER,
  TYPE_META,
  TYPE_MICRO,
  TYPE_SHEET_TITLE,
} from './typographyTokens'

export default function RecoveryModal({ muscles, muscleLastWorked, dayName, onClose }) {
  const barRefs = useRef({})
  const primaryPct = getRecoveryPct(muscles, muscleLastWorked)

  useEffect(() => {
    const timer = setTimeout(() => {
      Object.entries(barRefs.current).forEach(([key, el]) => {
        if (el?.dataset?.target != null) el.style.width = el.dataset.target + '%'
      })
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  function MuscleRow({ slug, type }) {
    const pct = getMuscleRecoveryPct(slug, muscleLastWorked?.[slug] ?? null)
    const colour = MUSCLE_COLOURS_HEX[slug] ?? '#888'
    const ago = formatHoursAgo(muscleLastWorked?.[slug] ?? null)
    const windowH = MUSCLE_RECOVERY_HOURS[slug] ?? 48
    const label = formatMuscleLabel(slug)
    const dim = type === 'secondary'

    return (
      <div className={`flex flex-col gap-1.5 ${dim ? 'opacity-45' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colour }} />
            <span className={`${TYPE_BODY_SEMIBOLD} text-white`}>{label}</span>
            <span
              className={`${TYPE_LABEL_UPPER} uppercase tracking-wide px-1.5 py-0.5 rounded ${
                dim ? 'bg-white/5 text-white/30' : 'bg-[rgba(0,229,160,0.1)] text-[rgba(0,229,160,0.6)]'
              }`}
            >
              {type}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className={`${TYPE_MICRO} text-white/30`}>{ago}</span>
            <span className={`${TYPE_MICRO} text-white/30`}>{windowH}h window</span>
            <span className={`${TYPE_BODY} font-bold text-white w-9 text-right`}>{pct}%</span>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            ref={(el) => {
              barRefs.current[slug + type] = el
            }}
            data-target={pct}
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: '0%', background: colour }}
          />
        </div>
      </div>
    )
  }

  const primary = muscles?.primary ?? []
  const secondary = muscles?.secondary ?? []

  return (
    <BottomSheet
      onClose={onClose}
      zClass="z-50"
      layout="scrollable"
      padding="none"
      showHandle={false}
      closeOnBackdrop
      backdropClassName="bg-black/65 backdrop-blur-sm"
      maxWidthClass="max-w-[430px]"
      surfaceClass="bg-[#111925]"
      panelClassName="animate-slide-up max-h-[85vh] overflow-y-auto"
    >
        <div className="w-9 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1 shrink-0" aria-hidden />
        <div className="flex items-start justify-between px-5 pt-4 pb-4">
          <div>
            <h2 className={`${TYPE_SHEET_TITLE} !font-semibold text-white`}>Recovery</h2>
            <p className={`${TYPE_MICRO} text-white/35 mt-0.5`}>{dayName} · primary muscles only affect score</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/[0.07] flex items-center justify-center text-white/40 text-sm leading-none"
          >
            ✕
          </button>
        </div>
        <div className="h-px bg-white/[0.06] mx-5 mb-4" />
        <p className={`px-5 ${TYPE_EMPHASIS_SM} !font-semibold uppercase tracking-[0.8px] text-white/25 mb-3`}>Primary</p>
        <div className="px-5 flex flex-col gap-3.5">
          {primary.map((slug) => (
            <MuscleRow key={slug} slug={slug} type="primary" />
          ))}
        </div>
        {secondary.length > 0 && (
          <>
            <div className="h-px bg-white/[0.06] mx-5 my-4" />
            <p className={`px-5 ${TYPE_EMPHASIS_SM} uppercase tracking-[0.8px] text-white/25 mb-3`}>Secondary</p>
            <div className="px-5 flex flex-col gap-3.5">
              {secondary.map((slug) => (
                <MuscleRow key={slug} slug={slug} type="secondary" />
              ))}
            </div>
          </>
        )}
        <div className="mx-5 mt-5 mb-6 bg-[rgba(0,229,160,0.06)] border border-[rgba(0,229,160,0.18)] rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className={`${TYPE_MICRO} font-semibold uppercase tracking-wide text-white/35`}>Overall score</p>
            <p className={`${TYPE_META} text-white/20 mt-0.5`}>Avg of primary muscles, per-muscle window</p>
          </div>
          <span className={`${TYPE_DISPLAY_LG} text-[#00e5a0]`}>{primaryPct}%</span>
        </div>
    </BottomSheet>
  )
}
