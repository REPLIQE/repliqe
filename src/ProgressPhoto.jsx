import { useState, useEffect } from 'react'

/**
 * Progress-photo display: optional crop; frame matches image intrinsic aspect once loaded
 * (fallback 3:4 from CSS while loading) so originals are not cropped to a fixed ratio.
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
      className={`overflow-hidden relative bg-card ${className}`}
      style={style}
      onClick={onClick}
    >
      {src ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${c.x}%, ${c.y}%) scale(${c.scale})`,
            transformOrigin: 'center',
          }}
        >
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover min-w-full min-h-full"
          />
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
