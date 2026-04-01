import { useState, useRef, useCallback } from 'react'
import BottomSheet from './BottomSheet'
import ActionButton from './ActionButton'
import { Z_OVERLAY_STACKED } from './zLayers'
import { DEFAULT_CROP } from './ProgressPhoto'
import { normalizeCrop } from './progressPhotoBake'
import { TYPE_BODY_SEMIBOLD, TYPE_HEADING_PAGE, TYPE_TITLE_ROW } from './typographyTokens'

const MIN_SCALE = 1
const MAX_SCALE = 4
const SCALE_STEP = 0.1

export default function ProgressPhotoEditor({ src, initialCrop, onSave, onClose, stackClass = Z_OVERLAY_STACKED }) {
  const [current, setCurrent] = useState(() =>
    initialCrop ? normalizeCrop(initialCrop) : { ...DEFAULT_CROP }
  )
  const [saving, setSaving] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 })
  const pointers = useRef({})
  const pinchStart = useRef(null)
  const containerRef = useRef(null)

  const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))
  const getDistance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP
    setCurrent((prev) => ({ ...prev, scale: clampScale(prev.scale + delta) }))
  }, [])

  const handlePointerDown = useCallback((e) => {
    e.target.setPointerCapture?.(e.pointerId)
    pointers.current[e.pointerId] = { clientX: e.clientX, clientY: e.clientY }
    const ids = Object.keys(pointers.current)
    if (ids.length === 2) {
      const [a, b] = ids.map((id) => pointers.current[id])
      pinchStart.current = { distance: getDistance(a, b), scale: current.scale }
      setIsDragging(false)
    } else if (ids.length === 1) {
      pinchStart.current = null
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, cropX: current.x, cropY: current.y }
    }
  }, [current.x, current.y, current.scale])

  const handlePointerMove = useCallback((e) => {
    pointers.current[e.pointerId] = { clientX: e.clientX, clientY: e.clientY }
    const ids = Object.keys(pointers.current)
    if (ids.length === 2 && pinchStart.current) {
      const [a, b] = ids.map((id) => pointers.current[id])
      const distance = getDistance(a, b)
      const newScale = pinchStart.current.scale * (distance / pinchStart.current.distance)
      setCurrent((prev) => ({ ...prev, scale: clampScale(newScale) }))
      return
    }
    if (ids.length === 1 && isDragging) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      const el = containerRef.current
      setCurrent((prev) => ({
        ...prev,
        x: dragStart.current.cropX + (el ? (dx / el.offsetWidth) * 100 : 0),
        y: dragStart.current.cropY + (el ? (dy / el.offsetHeight) * 100 : 0),
      }))
    }
  }, [isDragging])

  const handlePointerUp = useCallback((e) => {
    delete pointers.current[e.pointerId]
    if (Object.keys(pointers.current).length < 2) {
      pinchStart.current = null
      setIsDragging(false)
    }
  }, [])

  const handleReset = () => setCurrent({ ...DEFAULT_CROP })
  const SAVE_MAX_MS = 120000

  const handleSave = async () => {
    if (saving) return
    const payload = normalizeCrop({ x: current.x, y: current.y, scale: current.scale })
    setSaving(true)
    try {
      await Promise.race([
        Promise.resolve(onSave?.(payload)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Save took too long — try again')), SAVE_MAX_MS)
        ),
      ])
      onClose()
    } catch (e) {
      /* Timeout from race — parent may not always surface error UI */
      if (typeof alert !== 'undefined' && String(e?.message || '').includes('for lang tid')) {
        alert(e.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      onClose={saving ? undefined : onClose}
      closeOnBackdrop={!saving}
      zClass={stackClass}
      layout="flex"
      padding="none"
      showHandle={false}
      maxWidthClass="max-w-md"
      outerClassName="sm:items-center sm:p-4"
      panelClassName="max-h-[92vh] border border-border overflow-hidden min-h-0"
    >
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
        <ActionButton
          type="button"
          variant="tertiary"
          fullWidth={false}
          className={`!min-h-0 px-0 py-1 ${TYPE_TITLE_ROW} !text-muted hover:!text-text disabled:opacity-40`}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </ActionButton>
        <h2 className={TYPE_HEADING_PAGE}>Adjust crop</h2>
        <ActionButton
          type="button"
          variant="primary"
          fullWidth={false}
          className={`!min-h-0 !rounded-xl !py-2 !px-4 ${TYPE_BODY_SEMIBOLD} shadow-lg shadow-accent/25`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </ActionButton>
      </div>
      <div
        className="flex-1 flex items-center justify-center overflow-hidden p-4 touch-none min-h-0"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={containerRef}
          className="relative w-full max-h-full overflow-hidden rounded-[12px] bg-card-deep border border-border"
          style={{ aspectRatio: 'var(--progress-photo-ratio)' }}
        >
          {src && (
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-card-deep">
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  transform: `translate(${current.x}%, ${current.y}%) scale(${current.scale})`,
                  transformOrigin: 'center center',
                }}
              >
                <img
                  src={src}
                  alt=""
                  className="max-h-full max-w-full object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 px-5 pb-6 pt-2 flex flex-col gap-3">
        <button
          type="button"
          onClick={handleReset}
          className={`w-full py-3 rounded-xl ${TYPE_BODY_SEMIBOLD} border border-border-strong bg-card-alt text-text hover:border-accent/30 transition-colors`}
        >
          Reset crop
        </button>
      </div>
    </BottomSheet>
  )
}
