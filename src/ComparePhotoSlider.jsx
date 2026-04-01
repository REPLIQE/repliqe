import { useState, useRef, useCallback, useEffect } from 'react'
import ProgressPhoto from './ProgressPhoto'

const DRAG_THRESHOLD_PX = 6

/**
 * Stort side‑om‑side compare: “Before” til venstre for deleren, “After” til højre.
 * Træk vertikal deler (eller tryk‑og‑træk på billedet) — mobilt touch via pointer events.
 */
export default function ComparePhotoSlider({
  beforeSrc,
  beforeCrop,
  afterSrc,
  afterCrop,
  beforeDateLabel = 'Before',
  afterDateLabel = 'After',
  statsLine = null,
  className = '',
  canEdit = false,
  onEditBefore,
  onEditAfter,
}) {
  const [split, setSplit] = useState(50)
  const splitRef = useRef(50)
  const wrapRef = useRef(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const startXRef = useRef(0)

  useEffect(() => {
    splitRef.current = split
  }, [split])

  useEffect(() => {
    setSplit(50)
  }, [beforeSrc, afterSrc])

  const updateSplitFromClientX = useCallback((clientX) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (r.width < 1) return
    const x = clientX - r.left
    const p = Math.round((x / r.width) * 100)
    setSplit(Math.min(100, Math.max(0, p)))
  }, [])

  const onOverlayPointerDown = useCallback(
    (e) => {
      if (e.button != null && e.button !== 0) return
      draggingRef.current = true
      movedRef.current = false
      startXRef.current = e.clientX
      wrapRef.current?.setPointerCapture?.(e.pointerId)
      updateSplitFromClientX(e.clientX)
    },
    [updateSplitFromClientX]
  )

  const onOverlayPointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return
      if (Math.abs(e.clientX - startXRef.current) > DRAG_THRESHOLD_PX) {
        movedRef.current = true
      }
      updateSplitFromClientX(e.clientX)
    },
    [updateSplitFromClientX]
  )

  const onOverlayPointerUp = useCallback(
    (e) => {
      if (!draggingRef.current) return
      draggingRef.current = false
      try {
        wrapRef.current?.releasePointerCapture?.(e.pointerId)
      } catch {
        /* ignore */
      }
      if (!movedRef.current && canEdit) {
        const el = wrapRef.current
        if (el) {
          const r = el.getBoundingClientRect()
          const clickPct = ((e.clientX - r.left) / r.width) * 100
          const s = splitRef.current
          if (clickPct < s && onEditBefore) onEditBefore()
          else if (clickPct >= s && onEditAfter) onEditAfter()
        }
      }
    },
    [canEdit, onEditBefore, onEditAfter]
  )

  const hasBefore = Boolean(beforeSrc)
  const hasAfter = Boolean(afterSrc)

  if (!hasBefore && !hasAfter) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border bg-card-deep px-4 text-center ${className}`}
        style={{ aspectRatio: 'var(--progress-photo-ratio)' }}
      >
        <span className="text-sm text-muted">Add photos for this angle in both sessions to compare.</span>
      </div>
    )
  }

  if (!hasBefore || !hasAfter) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-border bg-card-deep px-4 text-center ${className}`}
        style={{ aspectRatio: 'var(--progress-photo-ratio)' }}
      >
        <span className="text-sm text-muted">Both sessions need a photo for this angle.</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        ref={wrapRef}
        role="slider"
        aria-valuenow={split}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Compare before and after"
        className="relative w-full touch-none select-none rounded-xl overflow-hidden border border-border bg-card-deep"
        style={{ aspectRatio: 'var(--progress-photo-ratio)' }}
        onPointerDown={onOverlayPointerDown}
        onPointerMove={onOverlayPointerMove}
        onPointerUp={onOverlayPointerUp}
        onPointerCancel={onOverlayPointerUp}
      >
        <div className="pointer-events-none absolute inset-0 z-0">
          <ProgressPhoto src={afterSrc} crop={afterCrop} className="h-full w-full rounded-none">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            </div>
          </ProgressPhoto>
        </div>
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          <ProgressPhoto src={beforeSrc} crop={beforeCrop} className="h-full w-full rounded-none">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-muted border-t-transparent rounded-full animate-spin" />
            </div>
          </ProgressPhoto>
        </div>
        {/* Vertikal deler + greb */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 z-[2] w-[min(44px,8%)] -translate-x-1/2"
          style={{ left: `${split}%` }}
          data-divider-handle
          aria-hidden
        >
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)]" />
          <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/55 shadow-lg backdrop-blur-[2px]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" className="opacity-95" aria-hidden>
              <path d="M15 6 L9 12 L15 18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 6 L15 12 L9 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-2 z-[3] max-w-[46%] truncate rounded-md bg-black/55 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {beforeDateLabel}
        </div>
        <div className="pointer-events-none absolute bottom-2 right-2 z-[3] max-w-[46%] truncate rounded-md bg-black/55 px-2 py-1 text-right text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
          {afterDateLabel}
        </div>
      </div>
      {statsLine ? <div className="text-[10px] text-muted text-center leading-snug">{statsLine}</div> : null}
    </div>
  )
}
