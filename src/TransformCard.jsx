import { useState, useEffect } from 'react'
import { loadPhotoSrc } from './PhotosModal'
import { groupPhotoSessionsByMonth } from './progressUtils'

const ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

export function PhotoThumb({ session, label, angle = 'front' }) {
  const [src, setSrc] = useState(null)
  const filename = session?.[angle]

  useEffect(() => {
    if (!filename) return
    loadPhotoSrc(filename).then(setSrc).catch(() => {})
  }, [filename])

  return (
    <div className="aspect-[0.85] bg-card-deep flex items-center justify-center relative overflow-hidden">
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        <svg width="44" height="80" viewBox="0 0 50 90" fill="none">
          <ellipse cx="25" cy="14" rx="10" ry="11" fill="rgba(255,255,255,0.07)" />
          <path
            d="M10 35 Q10 24 25 24 Q40 24 40 35 L43 70 Q43 74 39 74 L34 74 L32 90 L18 90 L16 74 L11 74 Q7 74 7 70 Z"
            fill="rgba(255,255,255,0.07)"
          />
        </svg>
      )}
      {label && (
        <span className="absolute bottom-2 text-[8px] font-bold text-white/30 uppercase tracking-[0.5px]">
          {label}
        </span>
      )}
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
}) {
  const [angle, setAngle] = useState('front')
  const handleArrowClick = (e) => {
    e?.stopPropagation?.()
    if (onGoToBody) onGoToBody()
    else if (onOpen) onOpen()
  }
  if (photoSessions.length === 0) {
    return (
      <div
        onClick={onGoToBody || onOpen ? () => { if (onGoToBody) onGoToBody(); else onOpen?.() } : undefined}
        className={`bg-card border border-border rounded-[14px] overflow-hidden mb-2 relative ${onGoToBody || onOpen ? 'cursor-pointer' : ''}`}
      >
        <div className="grid grid-cols-2 gap-[2px]">
          {['Before', 'After'].map((label) => (
            <div key={label} className="aspect-[0.85] bg-card-deep flex items-center justify-center relative">
              <svg width="48" height="86" viewBox="0 0 50 90" fill="none">
                <ellipse cx="25" cy="14" rx="10" ry="11" fill="rgba(255,255,255,0.05)" />
                <path
                  d="M10 35 Q10 24 25 24 Q40 24 40 35 L43 70 Q43 74 39 74 L34 74 L32 90 L18 90 L16 74 L11 74 Q7 74 7 70 Z"
                  fill="rgba(255,255,255,0.05)"
                />
              </svg>
              <span className="absolute bottom-2 text-[8px] font-bold text-muted uppercase tracking-[0.5px]">
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-page border border-border rounded-[20px] px-2 py-1 text-[9px] font-extrabold text-muted z-10">
          VS
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
    <div className="bg-card border border-border rounded-[14px] overflow-hidden mb-2 relative">
      <div
        onClick={fixedCompare ? undefined : onOpen}
        className={`grid grid-cols-2 gap-[2px] ${!fixedCompare ? 'cursor-pointer' : ''}`}
      >
        <PhotoThumb session={sessionA} label={sessionA?.date} angle={angle} />
        <PhotoThumb session={sessionB ?? sessionA} label={sessionB?.date ?? sessionA?.date} angle={angle} />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-page border border-border rounded-[20px] px-2 py-1 text-[9px] font-extrabold text-muted z-10">
        VS
      </div>
      <div className="p-[12px_14px] border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold text-text">Your transformation</div>
            <div className="text-[10px] text-muted mt-0.5">
              {sessionA?.date ?? '—'} → {sessionB?.date ?? sessionA?.date ?? '—'} · {photoSessions.length * 3} photos
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
                Before: {sessionA?.date ?? '—'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onShowComparePicker?.(showComparePicker === 'B' ? null : 'B') }}
                className="flex-1 py-2 rounded-lg border border-border-strong bg-card-alt text-[11px] font-bold text-text"
              >
                After: {sessionB?.date ?? '—'}
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
                          {s.date}
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
