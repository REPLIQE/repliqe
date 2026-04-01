import { useState, useLayoutEffect, useRef, useEffect, useCallback } from 'react'
import { normalizeCrop } from './progressPhotoBake'

/**
 * Ét canvas i slot-størrelse: object-contain + crop bages i samme draw (samme som
 * translate(x%,y%) scale(s) om center på den gamle wrapper). Ingen CSS-transform →
 * intet mellemliggende “oprindeligt” foto. Placeholder indtil reveal-sekvens.
 */
const DEFAULT_CROP = { x: 0, y: 0, scale: 1 }

const POST_BLIT_FRAMES = 6
const HOLD_PLACEHOLDER_FRAMES = 2

function scheduleRevealSequence(revealGenRef, snapshot, setBitmapReady, setPlaceholderLifted) {
  const afterBlit = (left) => {
    if (left <= 0) {
      if (revealGenRef.current !== snapshot) return
      setBitmapReady(true)
      const hold = (h) => {
        if (h <= 0) {
          if (revealGenRef.current !== snapshot) return
          setPlaceholderLifted(true)
          return
        }
        requestAnimationFrame(() => {
          if (revealGenRef.current !== snapshot) return
          hold(h - 1)
        })
      }
      hold(HOLD_PLACEHOLDER_FRAMES)
      return
    }
    requestAnimationFrame(() => {
      if (revealGenRef.current !== snapshot) return
      afterBlit(left - 1)
    })
  }
  afterBlit(POST_BLIT_FRAMES)
}

export default function ProgressPhoto({ src, crop, className = '', onClick, children }) {
  const c = normalizeCrop(crop)
  const cropKey = `${c.x}|${c.y}|${c.scale}`

  const [bitmapReady, setBitmapReady] = useState(false)
  const [placeholderLifted, setPlaceholderLifted] = useState(false)
  const canvasRef = useRef(null)
  const measureSlotRef = useRef(null)
  const loadedImgRef = useRef(null)
  const prevSrcRef = useRef(null)
  const revealGenRef = useRef(0)
  const placeholderLiftedRef = useRef(false)

  placeholderLiftedRef.current = placeholderLifted

  const style = {
    aspectRatio: 'var(--progress-photo-ratio)',
  }

  useLayoutEffect(() => {
    if (!src) {
      prevSrcRef.current = null
      loadedImgRef.current = null
      revealGenRef.current += 1
      setBitmapReady(false)
      setPlaceholderLifted(false)
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return undefined
    }
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src
      revealGenRef.current += 1
      setBitmapReady(false)
      setPlaceholderLifted(false)
    }
    return undefined
  }, [src])

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = loadedImgRef.current
    const slot = measureSlotRef.current
    if (!canvas || !img?.naturalWidth || !slot) return false

    const slotW = slot.clientWidth
    const slotH = slot.clientHeight
    if (slotW < 2 || slotH < 2) return false

    const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
    const bufW = Math.max(1, Math.floor(slotW * dpr))
    const bufH = Math.max(1, Math.floor(slotH * dpr))

    canvas.width = bufW
    canvas.height = bufH
    canvas.style.width = '100%'
    canvas.style.height = '100%'

    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const bg = getComputedStyle(slot).backgroundColor
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const opaqueBg =
      bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : 'rgb(22, 22, 26)'
    ctx.fillStyle = opaqueBg
    ctx.fillRect(0, 0, bufW, bufH)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const iw = img.naturalWidth
    const ih = img.naturalHeight
    const s0 = Math.min(slotW / iw, slotH / ih)
    const Dw = iw * s0
    const Dh = ih * s0
    const Ox = (slotW - Dw) / 2
    const Oy = (slotH - Dh) / 2

    const cx = slotW / 2
    const cy = slotH / 2
    const tx = (Number(c.x) / 100) * slotW
    const ty = (Number(c.y) / 100) * slotH
    const sc = Math.min(Math.max(Number(c.scale) || 1, 0.05), 10)

    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    /** Afstemt med `transform: translate(…) scale(…); transform-origin: center` */
    ctx.translate(cx, cy)
    ctx.translate(tx, ty)
    ctx.scale(sc, sc)
    ctx.translate(-cx, -cy)
    ctx.drawImage(img, Ox, Oy, Dw, Dh)
    ctx.restore()

    return true
  }, [c.x, c.y, c.scale])

  const drawOnly = useCallback(() => {
    drawCanvas()
  }, [drawCanvas])

  const drawAndReveal = useCallback(() => {
    const tryOnce = () => {
      const ok = drawCanvas()
      const canvas = canvasRef.current
      if (!ok || !canvas?.width) return false
      const snapshot = revealGenRef.current
      scheduleRevealSequence(revealGenRef, snapshot, setBitmapReady, setPlaceholderLifted)
      return true
    }
    if (tryOnce()) return
    requestAnimationFrame(() => {
      tryOnce()
    })
  }, [drawCanvas])

  useLayoutEffect(() => {
    if (!src || !loadedImgRef.current?.naturalWidth) return undefined
    drawCanvas()
    return undefined
  }, [src, cropKey, drawCanvas])

  useEffect(() => {
    if (!src) return undefined

    let cancelled = false
    const img = new Image()

    img.onload = () => {
      if (cancelled) return
      loadedImgRef.current = img
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return
          drawAndReveal()
        })
      })
    }
    img.onerror = () => {
      if (cancelled) return
      loadedImgRef.current = null
      revealGenRef.current += 1
      setBitmapReady(true)
      setPlaceholderLifted(true)
    }
    img.src = src

    return () => {
      cancelled = true
      loadedImgRef.current = null
    }
  }, [src, drawAndReveal])

  useEffect(() => {
    if (!src) return undefined
    const slot = measureSlotRef.current
    if (!slot) return undefined
    const ro = new ResizeObserver(() => {
      drawOnly()
    })
    ro.observe(slot)
    return () => ro.disconnect()
  }, [src, drawOnly, drawAndReveal])

  const showPlaceholder = Boolean(src) && !placeholderLifted

  return (
    <div
      className={`overflow-hidden relative bg-card-deep ${className}`}
      style={style}
      onClick={onClick}
    >
      {src ? (
        <div
          ref={measureSlotRef}
          className="absolute inset-0 overflow-hidden bg-card-deep isolation-isolate"
        >
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 block h-full w-full ${bitmapReady ? '' : 'hidden'}`}
            aria-hidden={!bitmapReady}
          />
          {showPlaceholder && (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-card-deep pointer-events-none">
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
