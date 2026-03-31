import { useState, useEffect } from 'react'

/**
 * Progress-photo display: optional pan/zoom; letterboxing (object-contain) preserves aspect ratio.
 * Frame matches image intrinsic aspect once loaded (fallback 3:4 from CSS while loading).
 * The <img> is not mounted until dimensions (and decode) are ready so mobile never flashes an uncropped/wrong-frame frame.
 */
const DEFAULT_CROP = { x: 0, y: 0, scale: 1 }

export default function ProgressPhoto({ src, crop, className = '', onClick, children }) {
  const c = crop && typeof crop.scale === 'number' ? crop : DEFAULT_CROP
  const [aspectRatio, setAspectRatio] = useState(null)
  const [imageReady, setImageReady] = useState(false)

  useEffect(() => {
    if (!src) {
      setAspectRatio(null)
      setImageReady(false)
      return undefined
    }
    setAspectRatio(null)
    setImageReady(false)
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled || img.naturalWidth <= 0 || img.naturalHeight <= 0) return
      const ar = `${img.naturalWidth} / ${img.naturalHeight}`
      const apply = () => {
        if (!cancelled) {
          setAspectRatio(ar)
          setImageReady(true)
        }
      }
      if (typeof img.decode === 'function') {
        img.decode().then(apply).catch(apply)
      } else {
        apply()
      }
    }
    img.onerror = () => {
      if (!cancelled) {
        setAspectRatio(null)
        setImageReady(false)
      }
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
          {imageReady ? (
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
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin" aria-hidden />
            </div>
          )}
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
