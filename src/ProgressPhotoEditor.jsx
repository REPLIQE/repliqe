import { useState, useRef, useCallback, useEffect } from 'react'
import { DEFAULT_CROP } from './ProgressPhoto'

const MIN_SCALE = 1
const MAX_SCALE = 4
const SCALE_STEP = 0.1

export default function ProgressPhotoEditor({ src, initialCrop, onSave, onClose }) {
  const crop = initialCrop && typeof initialCrop.scale === 'number'
    ? { ...initialCrop }
    : { ...DEFAULT_CROP }
  const [current, setCurrent] = useState(crop)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 })
  const pointers = useRef({})
  const pinchStart = useRef(null)
  const containerRef = useRef(null)
  const [frameAspect, setFrameAspect] = useState('3 / 4')

  useEffect(() => {
    if (!src) {
      setFrameAspect('3 / 4')
      return undefined
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setFrameAspect(`${img.naturalWidth} / ${img.naturalHeight}`)
      }
    }
    img.onerror = () => {
      if (!cancelled) setFrameAspect('3 / 4')
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

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
  const handleSave = () => {
    onSave({ x: current.x, y: current.y, scale: current.scale })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" aria-hidden onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[92vh] flex flex-col bg-page rounded-t-[20px] sm:rounded-[20px] border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <button type="button" onClick={onClose} className="text-[14px] font-bold text-muted hover:text-text transition-colors">
            Cancel
          </button>
          <h2 className="text-[18px] font-extrabold text-text">Adjust crop</h2>
          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-4 rounded-xl text-[13px] font-bold bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25"
          >
            Save
          </button>
        </div>
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden p-4 touch-none min-h-0"
          style={{ aspectRatio: frameAspect }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="relative w-full max-h-full overflow-hidden rounded-[12px] bg-card-deep border border-border"
            style={{ aspectRatio: frameAspect }}
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
            className="w-full py-3 rounded-xl text-[13px] font-bold border border-border-strong bg-card-alt text-text hover:border-accent/30 transition-colors"
          >
            Reset crop
          </button>
        </div>
      </div>
    </div>
  )
}
