import { useState, useEffect } from 'react'
import { loadPhotoSrc } from './PhotosModal'
import { groupPhotoSessionsByMonth } from './progressUtils'
import ProgressPhoto from './ProgressPhoto'
import { useAuth } from './lib/AuthContext'

const ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

const PLACEHOLDER_SVG = (
  <svg width="44" height="80" viewBox="0 0 50 90" fill="none">
    <ellipse cx="25" cy="14" rx="10" ry="11" fill="rgba(255,255,255,0.07)" />
    <path
      d="M14 26 L36 26 L34 54 L34 90 L26 90 L26 54 L24 54 L24 90 L16 90 L16 54 Z"
      fill="rgba(255,255,255,0.07)"
    />
  </svg>
)

export function PhotoThumb({ session, label, angle = 'front', weightLog, muscleMassLog, unitWeight }) {
  const { user } = useAuth()
  const [src, setSrc] = useState(null)
  const filename = session?.[angle]
  const crop = session?.crops?.[angle]

  const weightEntry = Array.isArray(weightLog) && session?.date
    ? weightLog.find((e) => e.date === session.date)
    : null
  const muscleEntry = Array.isArray(muscleMassLog) && session?.date
    ? muscleMassLog.find((e) => e.date === session.date)
    : null
  const statsLine = [weightEntry?.value != null && `${weightEntry.value} ${unitWeight || 'kg'}`, muscleEntry?.value != null && `${muscleEntry.value}%`].filter(Boolean).join(' · ')

  useEffect(() => {
    if (!filename) return
    loadPhotoSrc(filename, user?.uid ?? null).then(setSrc).catch(() => {})
  }, [filename, user?.uid])

  return (
    <div className="relative flex items-center justify-center">
      <ProgressPhoto
        src={src}
        crop={crop}
        className="w-full rounded-none"
      >
        {PLACEHOLDER_SVG}
      </ProgressPhoto>
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 pt-2 pb-2 px-2 text-center pointer-events-none min-h-[44px] flex flex-col justify-end">
        {label && (
          <span className="block text-[8px] font-bold text-white uppercase tracking-[0.5px]">
            {label}
          </span>
        )}
        <span className="block text-[9px] font-semibold text-white/95 mt-0.5 min-h-[14px]">
          {statsLine || '\u00A0'}
        </span>
      </div>
    </div>
  )
}

export function TransformCard({
  sessionA,
  sessionB,
  sortedSessions,
  compareAId,
  compareBId,
  onSelectA,
  onSelectB,
  showComparePicker,
  onShowComparePicker,
  onOpen,
  onGoToBody,
  photoSessions,
  fixedCompare = false,
  weightLog,
  muscleMassLog,
  unitWeight = 'kg',
  formatDateForDisplay,
}) {
  const [angle, setAngle] = useState('front')
  const fmtDate = formatDateForDisplay ?? ((d) => d ?? '')
  const handleArrowClick = (e) => {
    e?.stopPropagation?.()
    if (onGoToBody) onGoToBody()
    else if (onOpen) onOpen()
  }
  if (photoSessions.length === 0) {
    return (
      <div
        onClick={onGoToBody || onOpen ? () => { if (onGoToBody) onGoToBody(); else onOpen?.() } : undefined}
        className={`bg-card border border-border rounded-[14px] overflow-hidden mb-2 relative ${fixedCompare ? 'transform-card-overview' : ''} ${onGoToBody || onOpen ? 'cursor-pointer' : ''}`}
      >
        <div className="grid grid-cols-2 gap-[2px]">
          {['Before', 'After'].map((label) => (
            <div key={label} className="flex items-center justify-center relative" style={{ aspectRatio: 'var(--progress-photo-ratio)' }}>
              <div className="w-full h-full bg-card-deep flex items-center justify-center overflow-hidden">
                {PLACEHOLDER_SVG}
              </div>
              <span className="absolute bottom-2 text-[8px] font-bold text-muted uppercase tracking-[0.5px]">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-[12px_14px] border-t border-border">
          <div>
            <div className="text-[13px] font-bold text-text">Start tracking</div>
            <div className="text-[10px] text-muted mt-0.5">Add your first photos</div>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleArrowClick() }} className="w-[26px] h-[26px] bg-[rgba(123,123,255,0.08)] border border-[rgba(123,123,255,0.2)] rounded-full flex items-center justify-center text-accent text-[12px]">
            →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-card border border-border rounded-[14px] overflow-hidden mb-2 relative ${fixedCompare ? 'transform-card-overview' : ''}`}>
      <div
        onClick={fixedCompare ? undefined : onOpen}
        className={`grid grid-cols-2 gap-[2px] ${!fixedCompare ? 'cursor-pointer' : ''}`}
      >
        <PhotoThumb session={sessionA} label={fmtDate(sessionA?.date)} angle={angle} weightLog={weightLog} muscleMassLog={muscleMassLog} unitWeight={unitWeight} />
        <PhotoThumb session={sessionB ?? sessionA} label={sessionB ? fmtDate(sessionB.date) : fmtDate(sessionA?.date)} angle={angle} weightLog={weightLog} muscleMassLog={muscleMassLog} unitWeight={unitWeight} />
      </div>
      <div className="p-[12px_14px] border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-text">Your transformation</div>
            <div className="text-[10px] text-muted mt-0.5">
              {fmtDate(sessionA?.date) || '—'} → {fmtDate(sessionB?.date ?? sessionA?.date) || '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleArrowClick}
            className="w-[26px] h-[26px] bg-[rgba(123,123,255,0.08)] border border-[rgba(123,123,255,0.2)] rounded-full flex items-center justify-center text-accent text-[12px] shrink-0"
          >
            →
          </button>
        </div>
        {/* Angle switcher kun på Overview (fixedCompare); Body har kun front + date picker */}
        {fixedCompare && (
          <div className="flex gap-2">
            {ANGLES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setAngle(key) }}
                className={`flex-1 py-2 rounded-lg border text-[11px] font-bold ${
                  angle === key ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!fixedCompare && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowComparePicker?.(showComparePicker === 'A' ? null : 'A') }}
                className="flex-1 py-2 rounded-lg border border-border-strong bg-card-alt text-[11px] font-bold text-text"
              >
                Before: {fmtDate(sessionA?.date) || '—'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowComparePicker?.(showComparePicker === 'B' ? null : 'B') }}
                className="flex-1 py-2 rounded-lg border border-border-strong bg-card-alt text-[11px] font-bold text-text"
              >
                After: {fmtDate(sessionB?.date) || '—'}
              </button>
            </div>
            {showComparePicker && (
              <div className="space-y-3 pt-1 max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {groupPhotoSessionsByMonth(sortedSessions).map(({ monthLabel, sessions }) => (
                  <div key={monthLabel}>
                    <div className="text-[10px] font-bold text-muted uppercase tracking-[0.5px] mb-1.5 sticky top-0 bg-page py-0.5">
                      {monthLabel}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sessions.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            if (showComparePicker === 'A') onSelectA(s.id)
                            else onSelectB(s.id)
                            onShowComparePicker(null)
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                            (showComparePicker === 'A' && s.id === compareAId) || (showComparePicker === 'B' && s.id === compareBId)
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border bg-card-alt text-muted'
                          }`}
                        >
                          {fmtDate(s.date)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
