import { useState, useEffect } from 'react'
import { loadPhotoSrc } from './PhotosModal'
import { groupPhotoSessionsByMonth } from './progressUtils'
import ProgressPhoto from './ProgressPhoto'
import { useAuth } from './lib/AuthContext'
import { CARD_SURFACE } from './cardTokens'
import {
  TYPE_BODY,
  TYPE_BODY_SM,
  TYPE_CAPTION,
  TYPE_EMPHASIS_SM,
  TYPE_LABEL_MICRO,
  TYPE_META,
  TYPE_OVERLINE,
  TYPE_TAB,
} from './typographyTokens'

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
    if (!filename) {
      setSrc(null)
      return undefined
    }
    let cancelled = false
    setSrc(null)
    loadPhotoSrc(filename, user?.uid ?? null)
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [filename, user?.uid])

  return (
    <div className="relative flex items-center justify-center">
      <ProgressPhoto
        key={filename || 'none'}
        src={src}
        crop={crop}
        className="w-full rounded-none"
      >
        {PLACEHOLDER_SVG}
      </ProgressPhoto>
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 pt-2 pb-2 px-2 text-center pointer-events-none min-h-[44px] flex flex-col justify-end">
        {label && (
          <span className={`block ${TYPE_LABEL_MICRO} text-white`}>
            {label}
          </span>
        )}
        <span className={`block ${TYPE_CAPTION} font-semibold text-white/95 mt-0.5 min-h-[14px]`}>
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
        className={`${CARD_SURFACE} overflow-hidden mb-2 relative ${fixedCompare ? 'transform-card-overview' : ''} ${onGoToBody || onOpen ? 'cursor-pointer' : ''}`}
      >
        <div className="grid grid-cols-2 gap-[2px]">
          {['Before', 'After'].map((label) => (
            <div key={label} className="flex items-center justify-center relative" style={{ aspectRatio: 'var(--progress-photo-ratio)' }}>
              <div className="w-full h-full bg-card-deep flex items-center justify-center overflow-hidden">
                {PLACEHOLDER_SVG}
              </div>
              <span className={`absolute bottom-2 ${TYPE_LABEL_MICRO}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-[12px_14px] border-t border-border">
          <div>
            <div className={`${TYPE_BODY} font-bold`}>Start tracking</div>
            <div className={`${TYPE_META} mt-0.5`}>Add your first photos</div>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); handleArrowClick() }} className={`shrink-0 text-accent ${TYPE_BODY_SM} leading-none px-1 py-0.5 rounded-lg flex items-center justify-center active:opacity-70`}>
            →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${CARD_SURFACE} overflow-hidden mb-2 relative ${fixedCompare ? 'transform-card-overview' : ''}`}>
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
            <div className={`${TYPE_BODY} font-bold`}>Your transformation</div>
            <div className={`${TYPE_META} mt-0.5`}>
              {fmtDate(sessionA?.date) || '—'} → {fmtDate(sessionB?.date ?? sessionA?.date) || '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleArrowClick}
            className={`shrink-0 text-accent ${TYPE_BODY_SM} leading-none px-1 py-0.5 rounded-lg flex items-center justify-center active:opacity-70`}
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
                className={`flex-1 py-2 rounded-lg border ${TYPE_TAB} ${
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
                className={`flex-1 py-2 rounded-lg border border-border-strong bg-card-alt ${TYPE_TAB} text-text`}
              >
                Before: {fmtDate(sessionA?.date) || '—'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowComparePicker?.(showComparePicker === 'B' ? null : 'B') }}
                className={`flex-1 py-2 rounded-lg border border-border-strong bg-card-alt ${TYPE_TAB} text-text`}
              >
                After: {fmtDate(sessionB?.date) || '—'}
              </button>
            </div>
            {showComparePicker && (
              <div className="space-y-3 pt-1 max-h-[200px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                {groupPhotoSessionsByMonth(sortedSessions).map(({ monthLabel, sessions }) => (
                  <div key={monthLabel}>
                    <div className={`${TYPE_OVERLINE} mb-1.5 sticky top-0 bg-page py-0.5`}>
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
                          className={`px-2.5 py-1.5 rounded-lg ${TYPE_EMPHASIS_SM} border ${
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
