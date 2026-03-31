import { useState, useEffect } from 'react'

/**
 * Progress-photo display: optional pan/zoom; letterboxing (object-contain) preserves aspect ratio.
 * Frame matches image intrinsic aspect once loaded (fallback 3:4 from CSS while loading).
 */
const DEFAULT_CROP = { x: 0, y: 0, scale: 1 }

export default function ProgressPhoto({ src, crop, className = '', onClick, children }) {
  const c = crop && typeof crop.scale === 'number' ? crop : DEFAULT_CROP
  const [aspectRatio, setAspectRatio] = useState(null)

  useEffect(() => {
    setAspectRatio(null)
    if (!src) return undefined
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (!cancelled && img.naturalWidth > 0 && img.naturalHeight > 0) {
        setAspectRatio(`${img.naturalWidth} / ${img.naturalHeight}`)
      }
    }
    img.onerror = () => {
      if (!cancelled) setAspectRatio(null)
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [src])

  const style = {
    aspectRatio: aspectRatio ?? 'var(--progress-photo-ratio)',
  }

  return (
    <div
      className={`overflow-hidden relative bg-card-deep ${className}`}
      style={style}
      onClick={onClick}
    >
      {src ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-card-deep">
          <div
            className="flex h-full w-full items-center justify-center"
            style={{
              transform: `translate(${c.x}%, ${c.y}%) scale(${c.scale})`,
              transformOrigin: 'center center',
            }}
          >
            <img
              src={src}
              alt=""
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_CROP }
