/**
 * Eksporterer progress-foto med samme geometri som ProgressPhoto (object-contain + pan/zoom om center).
 * Ved save “bagges” zoomet udsnit til fuld target-opløsning → langt mindre gryn når brugeren har zoomet ind.
 */

/** Afstemt med --progress-photo-ratio i index.css (width / height). */
export const PROGRESS_PHOTO_ASPECT = 3 / 4

export function isDefaultCrop(crop) {
  if (!crop || typeof crop.scale !== 'number') return true
  const x = Number(crop.x) || 0
  const y = Number(crop.y) || 0
  const s = Number(crop.scale) || 1
  return Math.abs(x) < 0.01 && Math.abs(y) < 0.01 && Math.abs(s - 1) < 0.01
}

/**
 * @param {HTMLImageElement | ImageBitmap} img
 * @param {{ x?: number, y?: number, scale?: number }} crop
 * @param {number} maxLongSide længste side af output (højde for portræt 3:4)
 * @param {number} quality JPEG 0–1
 * @returns {string} base64 uden data:-præfiks
 */
export function bakeProgressPhotoCropToJpegBase64(img, crop, maxLongSide, quality) {
  const c = crop && typeof crop.scale === 'number' ? crop : { x: 0, y: 0, scale: 1 }
  const slotH = maxLongSide
  const slotW = Math.max(1, Math.round(maxLongSide * PROGRESS_PHOTO_ASPECT))

  const iw = 'naturalWidth' in img && img.naturalWidth ? img.naturalWidth : img.width
  const ih = 'naturalHeight' in img && img.naturalHeight ? img.naturalHeight : img.height
  if (!iw || !ih) throw new Error('Image has no dimensions')

  const canvas = document.createElement('canvas')
  canvas.width = slotW
  canvas.height = slotH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D not available')

  ctx.fillStyle = '#16161a'
  ctx.fillRect(0, 0, slotW, slotH)

  const slotWf = slotW
  const slotHf = slotH
  const s0 = Math.min(slotWf / iw, slotHf / ih)
  const Dw = iw * s0
  const Dh = ih * s0
  const Ox = (slotWf - Dw) / 2
  const Oy = (slotHf - Dh) / 2
  const cx = slotWf / 2
  const cy = slotHf / 2
  const tx = (Number(c.x) / 100) * slotWf
  const ty = (Number(c.y) / 100) * slotHf
  const sc = Math.min(Math.max(Number(c.scale) || 1, 0.05), 10)

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.save()
  ctx.translate(cx, cy)
  ctx.translate(tx, ty)
  ctx.scale(sc, sc)
  ctx.translate(-cx, -cy)
  ctx.drawImage(img, Ox, Oy, Dw, Dh)
  ctx.restore()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.replace(/^data:image\/jpeg;base64,/, '')
}
