import { useState, useEffect, useRef } from 'react'
import { formatMuscleLabel, getRecoveryPct } from './utils'
import RecoveryModal from './RecoveryModal'
import { TYPE_CAPTION, TYPE_MICRO } from './typographyTokens'

const RING_R = 44
const RING_CIRC = 2 * Math.PI * RING_R
const RING_STROKE = 6
export default function RecoverySection({ muscles, muscleLastWorked, dayName }) {
  const [modalOpen, setModal] = useState(false)
  const [display, setDisplay] = useState(0)
  const arcRef = useRef(null)

  useEffect(() => {
    const target = getRecoveryPct(muscles, muscleLastWorked)
    const duration = 1400
    const start = performance.now()

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const cur = Math.round(ease * target)
      setDisplay(cur)
      if (arcRef.current) {
        arcRef.current.style.strokeDashoffset = RING_CIRC * (1 - cur / 100)
      }
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [muscles, muscleLastWorked])

  const primary = muscles?.primary ?? []

  return (
    <>
      <div className="h-px bg-white/[0.06] my-3.5" />

      <div
        className="grid gap-x-3 gap-y-2 cursor-pointer active:[&_svg]:scale-95 transition-transform mb-5"
        style={{ gridTemplateColumns: '1fr auto' }}
        role="button"
        tabIndex={0}
        onClick={() => setModal(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setModal(true) } }}
      >
        <div
          className="min-w-0 grid grid-cols-2 gap-y-1.5 gap-x-1.5 content-center"
          style={{ gridRow: '1 / 2', minHeight: '7.5rem' }}
        >
          {primary.map((slug) => (
            <span
              key={slug}
              className={`flex items-center justify-center rounded-full py-[7px] px-2.5 ${TYPE_CAPTION} font-semibold truncate text-plan-text bg-white/[0.08]`}
            >
              {formatMuscleLabel(slug)}
            </span>
          ))}
        </div>

        <svg
          width="104"
          height="104"
          viewBox="0 0 104 104"
          style={{ overflow: 'visible', gridRow: '1 / 2' }}
          className="flex-shrink-0"
        >
          <circle cx="52" cy="52" r={RING_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={RING_STROKE} />
          <circle
            ref={arcRef}
            cx="52"
            cy="52"
            r={RING_R}
            fill="none"
            stroke="var(--plan-text)"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={RING_CIRC}
            transform="rotate(-90 52 52)"
            style={{ transition: 'none' }}
          />
          <g transform="translate(52, 52)" textAnchor="middle">
            <text y="-5.75" dominantBaseline="middle" fill="var(--plan-text)" fontSize="17" fontWeight="800" fontFamily="-apple-system, system-ui, sans-serif">
              {display}%
            </text>
            <text y="10.5" dominantBaseline="middle" fill="rgba(255,255,255,0.28)" fontSize="7.5" fontWeight="700" fontFamily="-apple-system, system-ui, sans-serif" letterSpacing="0.8">
              RECOVERY
            </text>
          </g>
        </svg>

        <div style={{ gridColumn: '2 / 3' }} className="flex justify-center">
          <span className={`${TYPE_CAPTION} font-medium text-white/50 tracking-[0.3px]`}>
            Tap for details
          </span>
        </div>
      </div>

      {modalOpen && (
        <RecoveryModal
          muscles={muscles}
          muscleLastWorked={muscleLastWorked}
          dayName={dayName}
          onClose={() => setModal(false)}
        />
      )}
    </>
  )
}
