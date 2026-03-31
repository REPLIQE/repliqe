import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { getOldestMiddleNewestSessions, sortPhotoSessionsByDate } from './progressUtils'
import { DeleteTrashBadge, DeleteTrashGlyph } from './DeleteConfirmTrashIcon'
import ProgressPhoto from './ProgressPhoto'
import ProgressPhotoEditor from './ProgressPhotoEditor'
import { useAuth } from './lib/AuthContext'
import { uploadProgressPhoto, getProgressPhotoUrl } from './lib/photoStorage'

const ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

/** Max longest side in px – good for mobile, keeps file size down. */
const MAX_PHOTO_PX = 720
/** JPEG quality 0–1 – balanced for viewing on phone without excess size. */
const PHOTO_QUALITY = 0.82

function getTodayEnGB() {
  return new Date().toLocaleDateString('en-GB')
}

/** "dd/mm/yyyy" → "yyyy-mm-dd" for <input type="date"> */
function enGBToDateInput(enGB) {
  const parts = (enGB || '').split('/')
  if (parts.length !== 3) return ''
  const [d, m, y] = parts
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/** "yyyy-mm-dd" → "dd/mm/yyyy" */
function dateInputToEnGB(value) {
  if (!value) return getTodayEnGB()
  const parts = value.split('-')
  if (parts.length !== 3) return getTodayEnGB()
  const [y, m, d] = parts
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false
  const p = window.Capacitor?.getPlatform?.()
  return p === 'ios' || p === 'android'
}

function bitmapToJpegBase64(bitmap) {
  const w = bitmap.width
  const h = bitmap.height
  const scale = Math.min(1, MAX_PHOTO_PX / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available')
  ctx.drawImage(bitmap, 0, 0, cw, ch)
  const out = canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
  return out.replace(/^data:image\/jpeg;base64,/, '')
}

/**
 * Resize longest side to MAX_PHOTO_PX, JPEG, preserve aspect ratio.
 * Uses EXIF orientation when decoding (so proportions match what the user sees).
 * Returns base64 without data URL prefix.
 */
async function normalizeImage(input) {
  const blob =
    input instanceof File
      ? input
      : await fetch(
          typeof input === 'string' && input.startsWith('data:')
            ? input
            : `data:image/jpeg;base64,${input}`
        ).then((r) => r.blob())

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      try {
        return bitmapToJpegBase64(bitmap)
      } finally {
        bitmap.close()
      }
    } catch {
      try {
        const bitmap = await createImageBitmap(blob)
        try {
          return bitmapToJpegBase64(bitmap)
        } finally {
          bitmap.close()
        }
      } catch {
        // fall through to Image()
      }
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        resolve(bitmapToJpegBase64(img))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    img.src = url
  })
}

/**
 * Load a stored photo as a data URL or HTTPS URL.
 * Tries Capacitor Data, then Cache, then Firebase Storage (if uid).
 * @param {string} filename - e.g. ps_123_front.jpg
 * @param {string|null} [uid] - Firebase user id for Storage (required for web when not using Capacitor)
 */
export async function loadPhotoSrc(filename, uid = null) {
  if (!filename) return null
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    try {
      const result = await Filesystem.readFile({
        path: filename,
        directory: Directory.Data,
      })
      return `data:image/jpeg;base64,${result.data}`
    } catch {
      const result = await Filesystem.readFile({
        path: filename,
        directory: Directory.Cache,
      })
      return `data:image/jpeg;base64,${result.data}`
    }
  } catch {
    if (uid) {
      const url = await getProgressPhotoUrl(uid, filename)
      return url
    }
    return null
  }
}

async function savePhoto(base64Data, filename, uid) {
  const clean = base64Data.replace(/^data:image\/\w+;base64,/, '')
  const isNative = isNativePlatform()
  if (isNative) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      await Filesystem.writeFile({
        path: filename,
        data: clean,
        directory: Directory.Data,
      })
      if (uid) uploadProgressPhoto(uid, filename, clean).catch(() => {})
      return filename
    } catch (dataErr) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.writeFile({
          path: filename,
          data: clean,
          directory: Directory.Cache,
        })
        if (uid) uploadProgressPhoto(uid, filename, clean).catch(() => {})
        return filename
      } catch (cacheErr) {
        if (uid) {
          await uploadProgressPhoto(uid, filename, clean)
          return filename
        }
        console.error('Save photo (native) Data/Cache failed:', dataErr, cacheErr)
        throw new Error('Could not save photo')
      }
    }
  }
  if (uid) {
    await uploadProgressPhoto(uid, filename, clean)
    return filename
  }
  throw new Error('Could not save photo (sign in to sync photos)')
}

export default function PhotosModal({
  photoSessions,
  setPhotoSessions,
  totalPhotos = 0,
  atLimit = false,
  onClose,
  weightLog = [],
  muscleMassLog = [],
  unitWeight = 'kg',
  formatDateForDisplay,
  openToAdd = false,
  onPhotoSessionCreated,
  /** Called when a new progress photo slot is filled (counts toward plan quota). */
  onProgressPhotoAdded,
  /** Called when saved photo slots are removed (syncs plan usage counter for Pro/Elite). */
  onProgressPhotoRemoved,
  /** Progress bar: used count (total stored slots; Elite has no cap). */
  progressPhotoBarUsed,
  /** Max for bar; null = unlimited (Elite). */
  progressPhotoBarCap,
}) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const [capturing, setCapturing] = useState(false)
  const [captureStep, setCaptureStep] = useState(0)
  const [capturedImages, setCapturedImages] = useState({})
  const [captureSessionDate, setCaptureSessionDate] = useState(() => getTodayEnGB())
  const [captureThumbSrcs, setCaptureThumbSrcs] = useState({ front: null, back: null, side: null })
  const inputCameraRef = useRef(null)
  const inputLibraryRef = useRef(null)
  const dateInputRef = useRef(null)
  const initialPhotoSessionsRef = useRef(null)
  /** Angles that already triggered onProgressPhotoAdded this capture (retake does not re-add). */
  const progressQuotaAnglesRef = useRef(new Set())
  const [captureCropEditorAngle, setCaptureCropEditorAngle] = useState(null)
  const [captureAnglePendingDelete, setCaptureAnglePendingDelete] = useState(null)
  /** Which angle's photo the user tapped to show crop/delete options (capture flow only). */
  const [captureAngleActionSheet, setCaptureAngleActionSheet] = useState(null)

  const canAddPhotos = typeof setPhotoSessions === 'function'
  const isNative = isNativePlatform()
  const barUsed = progressPhotoBarUsed ?? totalPhotos
  const barCap = progressPhotoBarCap !== undefined ? progressPhotoBarCap : 12

  useEffect(() => {
    initialPhotoSessionsRef.current = JSON.stringify(photoSessions)
  }, [])

  useEffect(() => {
    const load = async () => {
      const next = { front: null, back: null, side: null }
      for (const { key } of ANGLES) {
        const filename = capturedImages[key]
        if (filename) {
          try {
            const src = await loadPhotoSrc(filename, uid)
            next[key] = src
          } catch {
            next[key] = null
          }
        }
      }
      setCaptureThumbSrcs(next)
    }
    load()
  }, [uid, capturedImages.front, capturedImages.back, capturedImages.side])

  useLayoutEffect(() => {
    if (openToAdd && canAddPhotos && !atLimit) {
      progressQuotaAnglesRef.current = new Set()
      setCapturing(true)
      setCaptureStep(0)
      setCapturedImages({})
      setCaptureSessionDate(getTodayEnGB())
      setCaptureCropEditorAngle(null)
      setCaptureAnglePendingDelete(null)
      setCaptureAngleActionSheet(null)
    }
  }, [openToAdd, canAddPhotos, atLimit])

  const hasChanges =
    initialPhotoSessionsRef.current !== null &&
    JSON.stringify(photoSessions) !== initialPhotoSessionsRef.current

  const showCaptureUI =
    capturing || (openToAdd && canAddPhotos && !atLimit)

  /** On native: opens camera or gallery. On web returns null (use file input instead). */
  async function takePhoto(source) {
    if (!isNative) return null
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: source === 'library' ? CameraSource.Photos : CameraSource.Camera,
      })
      const base64 = photo?.base64String ?? photo?.base64 ?? null
      if (!base64) {
        console.warn('Camera returned no base64:', Object.keys(photo || {}))
        if (typeof alert !== 'undefined') alert('Photo had no image data. Try again.')
      }
      return base64
    } catch (err) {
      console.error('Camera error:', err)
      if (typeof alert !== 'undefined') alert('Could not take photo. Try again.')
      return null
    }
  }

  async function saveAndAdvanceWithBase64(base64) {
    if (!base64) return
    const angle = ANGLES[captureStep]
    let normalized = base64.replace(/^data:image\/\w+;base64,/, '') || base64
    try {
      normalized = await normalizeImage(base64)
    } catch {
      normalized = base64.replace(/^data:image\/\w+;base64,/, '') || base64
    }
    const sessionId = capturedImages._sessionId ?? `ps_${Date.now()}`
    const filename = `${sessionId}_${angle.key}.jpg`
    try {
      await savePhoto(normalized, filename, uid)
    } catch (err) {
      console.error('Save photo failed:', err)
      if (typeof alert !== 'undefined') alert('Could not save photo. Try again.')
      return
    }
    const updated = { ...capturedImages, _sessionId: sessionId, [angle.key]: filename }
    setCapturedImages(updated)
    setCaptureStep((prev) => prev + 1)
    // Persist session immediately so photo shows even if user leaves before clicking Done
    if (typeof setPhotoSessions === 'function') {
      setPhotoSessions((prev) => {
        const existing = (prev || []).find((s) => s.id === sessionId)
        const partial = {
          id: sessionId,
          date: existing?.date ?? captureSessionDate,
          front: updated.front ?? null,
          back: updated.back ?? null,
          side: updated.side ?? null,
          createdAt: existing?.createdAt ?? Date.now(),
          crops: existing?.crops ? { ...existing.crops } : {},
        }
        const without = (prev || []).filter((s) => s.id !== sessionId)
        return [...without, partial]
      })
    }
    if (!progressQuotaAnglesRef.current.has(angle.key)) {
      progressQuotaAnglesRef.current.add(angle.key)
      onProgressPhotoAdded?.()
    }
  }

  async function handleCaptureAngle(source) {
    setCapturing(true)
    if (isNative) {
      const base64 = await takePhoto(source)
      if (base64) await saveAndAdvanceWithBase64(base64)
      setCapturing(false)
      return
    }
    // Web: keep capturing view open and open file picker (camera or library)
    if (source === 'camera') inputCameraRef.current?.click()
    else inputLibraryRef.current?.click()
  }

  async function handleFileSelected(e) {
    const file = e.target?.files?.[0]
    if (!file || !file.type?.startsWith('image/')) return
    try {
      const base64 = await normalizeImage(file)
      if (base64) await saveAndAdvanceWithBase64(base64)
    } catch (err) {
      console.error('Photo handleFileSelected failed:', err)
      if (typeof alert !== 'undefined') alert('Could not add photo. Try again.')
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  function skipAngle() {
    setCaptureStep((prev) => prev + 1)
  }

  /** Clear one angle and jump to its step so the user can shoot again — does not free plan quota (same slot). */
  function prepareRetakeCapturedAngle(angleKey) {
    const sessionId = capturedImages._sessionId
    if (!sessionId) return
    setCaptureCropEditorAngle((prev) => (prev === angleKey ? null : prev))
    setCaptureAngleActionSheet((prev) => (prev === angleKey ? null : prev))
    const nextCaptured = { ...capturedImages }
    delete nextCaptured[angleKey]
    setCapturedImages(nextCaptured)
    if (typeof setPhotoSessions === 'function') {
      setPhotoSessions((prev) =>
        (prev || []).map((s) => {
          if (s.id !== sessionId) return s
          const nextCrops = { ...(s.crops || {}) }
          delete nextCrops[angleKey]
          return { ...s, [angleKey]: null, crops: nextCrops }
        })
      )
    }
    setCaptureStep(ANGLES.findIndex((a) => a.key === angleKey))
  }

  function removeCapturedAngle(angleKey) {
    const sessionId = capturedImages._sessionId
    if (!sessionId) return
    if (progressQuotaAnglesRef.current.has(angleKey)) {
      onProgressPhotoRemoved?.(1)
    }
    progressQuotaAnglesRef.current.delete(angleKey)
    setCaptureCropEditorAngle((prev) => (prev === angleKey ? null : prev))
    setCaptureAngleActionSheet((prev) => (prev === angleKey ? null : prev))
    const nextCaptured = { ...capturedImages }
    delete nextCaptured[angleKey]
    setCapturedImages(nextCaptured)
    if (typeof setPhotoSessions === 'function') {
      setPhotoSessions((prev) =>
        (prev || []).map((s) => {
          if (s.id !== sessionId) return s
          const nextCrops = { ...(s.crops || {}) }
          delete nextCrops[angleKey]
          return { ...s, [angleKey]: null, crops: nextCrops }
        })
      )
    }
    const allFilled = ANGLES.every(({ key }) => nextCaptured[key])
    if (!allFilled) {
      const firstEmpty = ANGLES.findIndex(({ key }) => !nextCaptured[key])
      setCaptureStep(firstEmpty >= 0 ? firstEmpty : 0)
    }
  }

  function finishCapture() {
    const { _sessionId, ...angles } = capturedImages
    const sessionId = _sessionId ?? `ps_${Date.now()}`
    setPhotoSessions((prev) => {
      const existing = (prev || []).find((s) => s.id === sessionId)
      const cleanedCrops = { ...(existing?.crops || {}) }
      ANGLES.forEach(({ key }) => {
        if (!angles[key]) delete cleanedCrops[key]
      })
      const newSession = {
        id: sessionId,
        date: captureSessionDate,
        front: angles.front ?? null,
        back: angles.back ?? null,
        side: angles.side ?? null,
        createdAt: existing?.createdAt ?? Date.now(),
        ...(Object.keys(cleanedCrops).length ? { crops: cleanedCrops } : {}),
      }
      const without = (prev || []).filter((s) => s.id !== sessionId)
      return [...without, newSession]
    })
    if (typeof onPhotoSessionCreated === 'function') onPhotoSessionCreated(sessionId)
    setCapturing(false)
    setCaptureStep(0)
    setCapturedImages({})
    if (openToAdd) onClose()
  }

  if (showCaptureUI) {
    const currentAngle = ANGLES[captureStep]
    const isDone = captureStep >= ANGLES.length
    const captureSessionPartial = (photoSessions || []).find((s) => s.id === capturedImages._sessionId)

    const captureAngleSlot = (key, label) => {
      const has = !!capturedImages[key]
      const thumbReady = !!(has && captureThumbSrcs[key])
      const idx = ANGLES.findIndex((a) => a.key === key)
      const isActiveStep = !isDone && idx === captureStep
      return (
        <div key={key} className="flex flex-col items-center gap-1.5">
          <ProgressPhoto
            src={has ? captureThumbSrcs[key] : null}
            crop={captureSessionPartial?.crops?.[key]}
            className={`w-[64px] rounded-xl border-2 shrink-0 ring-offset-2 ring-offset-page ${
              isActiveStep ? 'border-accent ring-2 ring-accent/40' : 'border-border'
            } ${
              thumbReady || !has
                ? 'cursor-pointer active:opacity-90'
                : has && !thumbReady
                  ? 'opacity-80'
                  : ''
            } ${captureAngleActionSheet === key ? 'ring-2 ring-accent' : ''}`}
            onClick={() => {
              if (thumbReady) setCaptureAngleActionSheet(key)
              else setCaptureStep(idx)
            }}
          >
            <span className="text-[11px] font-semibold text-muted">{label}</span>
          </ProgressPhoto>
          <span
            className={`text-[11px] font-bold ${isActiveStep ? 'text-accent' : 'text-muted'}`}
          >
            {label}
          </span>
        </div>
      )
    }

    const captureCropEditor =
      captureCropEditorAngle &&
      capturedImages._sessionId &&
      captureThumbSrcs[captureCropEditorAngle] && (
        <ProgressPhotoEditor
          src={captureThumbSrcs[captureCropEditorAngle]}
          initialCrop={captureSessionPartial?.crops?.[captureCropEditorAngle]}
          onSave={(crop) => {
            const sid = capturedImages._sessionId
            if (!sid || typeof setPhotoSessions !== 'function') return
            setPhotoSessions((prev) =>
              (prev || []).map((s) =>
                s.id === sid ? { ...s, crops: { ...(s.crops || {}), [captureCropEditorAngle]: crop } } : s
              )
            )
          }}
          onClose={() => setCaptureCropEditorAngle(null)}
        />
      )

    const sheetAngleMeta = captureAngleActionSheet
      ? ANGLES.find((a) => a.key === captureAngleActionSheet)
      : null
    const capturePhotoActionSheet = captureAngleActionSheet && sheetAngleMeta && (
      <div
        className="fixed inset-0 z-[108] flex items-end justify-center sm:items-center sm:p-4"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          aria-label="Close"
          onClick={() => setCaptureAngleActionSheet(null)}
        />
        <div className="relative w-full max-w-md rounded-t-[20px] sm:rounded-[20px] bg-page border border-border border-b-0 sm:border-b shadow-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="text-[17px] font-extrabold text-text text-center mb-5">{sheetAngleMeta.label} photo</div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/20"
              onClick={() => {
                const k = captureAngleActionSheet
                setCaptureAngleActionSheet(null)
                setCaptureCropEditorAngle(k)
              }}
            >
              Adjust crop
            </button>
            <button
              type="button"
              className="w-full py-3.5 rounded-xl text-[15px] font-bold border border-border-strong bg-card-alt text-text"
              onClick={() => {
                const k = captureAngleActionSheet
                setCaptureAngleActionSheet(null)
                prepareRetakeCapturedAngle(k)
              }}
            >
              Take new photo
            </button>
            <button
              type="button"
              className="w-full py-3.5 rounded-xl text-[15px] font-bold border-2 border-red-500/40 text-red-500 bg-red-500/[0.06]"
              onClick={() => {
                const k = captureAngleActionSheet
                setCaptureAngleActionSheet(null)
                setCaptureAnglePendingDelete(k)
              }}
            >
              Delete photo
            </button>
            <button
              type="button"
              className="w-full py-3 rounded-xl text-[15px] font-semibold text-muted border border-border-strong bg-card-alt"
              onClick={() => setCaptureAngleActionSheet(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )

    const captureAngleDeleteModal = captureAnglePendingDelete && (
      <div
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-[110]"
        aria-modal="true"
      >
        <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-xl relative z-[111]">
          <DeleteTrashBadge />
          <div className="text-[15px] font-bold text-text mb-1 text-center">Remove photo?</div>
          <div className="text-[13px] text-muted mb-5 text-center">
            {ANGLES.find((a) => a.key === captureAnglePendingDelete)?.label ?? 'This'} shot will be cleared. You can add
            it again later.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCaptureAnglePendingDelete(null)}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold border border-border-strong bg-card-alt text-text"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                removeCapturedAngle(captureAnglePendingDelete)
                setCaptureAnglePendingDelete(null)
              }}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-red-500/90 text-white hover:bg-red-500 inline-flex items-center justify-center gap-2"
            >
              <DeleteTrashGlyph className="w-4 h-4 text-white" />
              Remove
            </button>
          </div>
        </div>
      </div>
    )

    if (isDone) {
      return (
        <>
        <div className="fixed inset-0 z-50 flex justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" aria-hidden />
          <div className="relative w-full max-w-md h-full flex flex-col items-center justify-center px-6 bg-page">
          <div className="w-16 h-16 rounded-full bg-success/12 flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-8 h-8 stroke-success">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Photos saved</h2>
          <p className="text-sm text-muted text-center mb-4">
            {Object.values(capturedImages).filter((v) => v && v !== capturedImages._sessionId).length} photos taken
          </p>
          <div className="flex gap-3 w-full max-w-sm mb-6 justify-center">
            {ANGLES.map(({ key, label }) => captureAngleSlot(key, label))}
          </div>
          <div className="w-full max-w-sm mb-6">
            <input
              ref={dateInputRef}
              type="date"
              value={enGBToDateInput(captureSessionDate)}
              onChange={(e) => {
                const newDate = dateInputToEnGB(e.target.value)
                setCaptureSessionDate(newDate)
                const sid = capturedImages._sessionId
                if (sid && typeof setPhotoSessions === 'function') {
                  setPhotoSessions((prev) =>
                    (prev || []).map((s) => (s.id === sid ? { ...s, date: newDate } : s))
                  )
                }
              }}
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              aria-hidden
            />
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border-strong bg-card-alt hover:border-accent/50 hover:bg-card transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-muted uppercase tracking-[0.5px] mb-0.5">Session date</div>
                <div className="text-base font-bold text-text">{captureSessionDate}</div>
                <div className="text-[11px] text-accent font-semibold mt-0.5">Tap to change date</div>
              </div>
            </button>
          </div>
          <button
            onClick={finishCapture}
            className="w-full max-w-sm py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent"
          >
            Done
          </button>
          </div>
        </div>
        {capturePhotoActionSheet}
        {captureCropEditor}
        {captureAngleDeleteModal}
        </>
      )
    }

    return (
      <>
      <div className="fixed inset-0 z-50 flex justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" aria-hidden />
        <div className="relative w-full max-w-md h-full flex flex-col bg-page">
        <div className="flex gap-2 px-6 pt-12 pb-2">
          {ANGLES.map((a, i) => {
            const done = i < captureStep
            const current = i === captureStep
            const canGoBack = done
            return (
              <button
                key={a.key}
                type="button"
                disabled={!canGoBack}
                title={canGoBack ? `Back to ${a.label}` : current ? `${a.label} (current)` : a.label}
                onClick={() => canGoBack && setCaptureStep(i)}
                className={`flex-1 min-h-[44px] min-w-0 py-3 -my-2 flex items-center justify-center rounded-lg transition-opacity ${
                  canGoBack ? 'cursor-pointer opacity-100 hover:opacity-90' : 'cursor-default opacity-100'
                } ${current && !isDone ? 'ring-1 ring-accent/30 rounded-2xl' : ''}`}
              >
                <span
                  className={`block w-full h-1.5 rounded-full ${
                    done ? 'bg-success' : current ? 'bg-accent' : 'bg-card-alt'
                  }`}
                />
              </button>
            )
          })}
        </div>
        <div className="px-6 pb-3">
          <input
            ref={dateInputRef}
            type="date"
            value={enGBToDateInput(captureSessionDate)}
            onChange={(e) => {
              const newDate = dateInputToEnGB(e.target.value)
              setCaptureSessionDate(newDate)
              const sid = capturedImages._sessionId
              if (sid && typeof setPhotoSessions === 'function') {
                setPhotoSessions((prev) =>
                  (prev || []).map((s) => (s.id === sid ? { ...s, date: newDate } : s))
                )
              }
            }}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            aria-hidden
          />
          <button
            type="button"
            onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-border-strong bg-card-alt hover:border-accent/50 hover:bg-card transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-muted uppercase tracking-[0.5px] mb-0.5">Session date</div>
              <div className="text-sm font-bold text-text">{captureSessionDate}</div>
              <div className="text-[11px] text-accent font-semibold mt-0.5">Tap to change date</div>
            </div>
          </button>
        </div>
        <div className="px-6 pb-3">
          <div className="flex gap-2 justify-center">
            {ANGLES.map(({ key, label }) => captureAngleSlot(key, label))}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-text text-2xl font-extrabold mb-1">{currentAngle.label}</div>
          <div className="text-muted text-sm mb-8">
            Step {captureStep + 1} of {ANGLES.length}
          </div>
        </div>
        <div className="px-6 pb-12 flex flex-col gap-3">
          {isNative ? (
            <>
              <button
                type="button"
                onClick={() => handleCaptureAngle('camera')}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent"
              >
                Take {currentAngle.label} photo
              </button>
              <button
                type="button"
                onClick={() => handleCaptureAngle('library')}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-card border border-border-strong text-text"
              >
                Choose from library
              </button>
            </>
          ) : (
            <>
              <label className="relative w-full block cursor-pointer">
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelected}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ fontSize: 0 }}
                />
                <span className="block w-full py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent text-center pointer-events-none">
                  Take {currentAngle.label} photo
                </span>
              </label>
              <label className="relative w-full block cursor-pointer">
                <input
                  ref={inputLibraryRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelected}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  style={{ fontSize: 0 }}
                />
                <span className="block w-full py-4 rounded-2xl font-bold text-sm bg-card border border-border-strong text-text text-center pointer-events-none">
                  Choose from library
                </span>
              </label>
            </>
          )}
          <button onClick={skipAngle} className="w-full py-3 text-sm font-semibold text-muted">
            Skip {currentAngle.label}
          </button>
          <button
            onClick={() => {
              setCaptureCropEditorAngle(null)
              setCaptureAnglePendingDelete(null)
              setCaptureAngleActionSheet(null)
              if (openToAdd) {
                onClose()
              } else {
                setCapturing(false)
                setCaptureStep(0)
                setCapturedImages({})
              }
            }}
            className="w-full py-3 text-sm font-semibold text-muted border border-border rounded-lg"
          >
            Cancel
          </button>
        </div>
        </div>
      </div>
        {capturePhotoActionSheet}
        {captureCropEditor}
        {captureAngleDeleteModal}
      </>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-end justify-center">
      <div className="w-full max-w-md bg-page rounded-t-[20px] max-h-[92vh] flex flex-col">
        <div className="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className="text-[18px] font-extrabold text-text">Photos</h2>
        </div>
        <PhotosViewContent
          photoSessions={photoSessions}
          setPhotoSessions={setPhotoSessions}
          totalPhotos={totalPhotos}
          atLimit={atLimit}
          progressPhotoBarUsed={barUsed}
          progressPhotoBarCap={barCap}
          weightLog={weightLog}
          muscleMassLog={muscleMassLog}
          unitWeight={unitWeight}
          formatDateForDisplay={formatDateForDisplay}
          showExitCTA={true}
          onClose={onClose}
          hasChanges={hasChanges}
          onProgressPhotoRemoved={onProgressPhotoRemoved}
          onOpenAddPhotos={() => {
            progressQuotaAnglesRef.current = new Set()
            setCaptureCropEditorAngle(null)
            setCaptureAnglePendingDelete(null)
            setCaptureAngleActionSheet(null)
            setCapturing(true)
            setCaptureStep(0)
            setCapturedImages({})
            setCaptureSessionDate(getTodayEnGB())
          }}
        />
      </div>
    </div>
  )
}

/** Delbar fotovisning: tabs (Timeline/Compare) + indhold. Bruges i modal (med Exit) og inline på Body (uden Exit). */
export function PhotosViewContent({
  photoSessions,
  setPhotoSessions,
  totalPhotos: totalPhotosProp = 0,
  atLimit = false,
  progressPhotoBarUsed: progressPhotoBarUsedProp,
  progressPhotoBarCap: progressPhotoBarCapProp,
  weightLog = [],
  muscleMassLog = [],
  unitWeight = 'kg',
  formatDateForDisplay,
  showExitCTA = false,
  onClose,
  hasChanges = false,
  onOpenAddPhotos,
  onProgressPhotoRemoved,
  inline = false,
}) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const padX = inline ? 'px-0' : 'px-5'
  const fmtDate = formatDateForDisplay ?? ((d) => d ?? '')
  const [view, setView] = useState('timeline')
  const sortedSessionsForCompare = sortPhotoSessionsByDate(photoSessions || [])
  const defaultOldest = sortedSessionsForCompare.length > 0 ? sortedSessionsForCompare[sortedSessionsForCompare.length - 1] : null
  const defaultNewest = sortedSessionsForCompare.length > 0 ? sortedSessionsForCompare[0] : null
  const [compareA, setCompareA] = useState(() => defaultOldest?.id ?? null)
  const [compareB, setCompareB] = useState(() => (sortedSessionsForCompare.length > 1 ? defaultNewest?.id : null))
  const [compareAngle, setCompareAngle] = useState('front')

  const compareARef = useRef(compareA)
  const compareBRef = useRef(compareB)
  compareARef.current = compareA
  compareBRef.current = compareB

  const photoSessionIdsKey = useMemo(
    () =>
      (photoSessions || [])
        .map((s) => s?.id)
        .filter(Boolean)
        .sort()
        .join('|'),
    [photoSessions],
  )

  useEffect(() => {
    const sorted = sortPhotoSessionsByDate(photoSessions || [])
    if (sorted.length < 2) {
      setCompareA(sorted.length === 1 ? sorted[0].id : null)
      setCompareB(null)
      return
    }
    const oldest = sorted[sorted.length - 1]
    const newest = sorted[0]
    const ids = new Set(sorted.map((s) => s.id))
    const prevA = compareARef.current
    const prevB = compareBRef.current
    const invalid =
      prevA == null ||
      prevB == null ||
      !ids.has(prevA) ||
      !ids.has(prevB) ||
      prevA === prevB
    if (invalid) {
      setCompareA(oldest.id)
      setCompareB(newest.id)
    }
  }, [photoSessionIdsKey])
  const [comparePickerOpen, setComparePickerOpen] = useState(null)
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [editingDateSessionId, setEditingDateSessionId] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [editingCrop, setEditingCrop] = useState(null)
  const [thumbs, setThumbs] = useState({})
  const dateEditInputRef = useRef(null)

  const canAddPhotos = typeof setPhotoSessions === 'function'
  const totalPhotos =
    totalPhotosProp ||
    (Array.isArray(photoSessions) ? photoSessions.reduce((s, sess) => s + [sess?.front, sess?.back, sess?.side].filter(Boolean).length, 0) : 0)
  const barUsed = progressPhotoBarUsedProp ?? totalPhotos
  const barCap = progressPhotoBarCapProp !== undefined ? progressPhotoBarCapProp : 12
  const barPct = barCap != null && barCap > 0 ? Math.min(100, (barUsed / barCap) * 100) : 100

  useEffect(() => {
    if (!Array.isArray(photoSessions) || !uid) return
    photoSessions.forEach((session) => {
      ANGLES.forEach(({ key }) => {
        const filename = session?.[key]
        if (!filename || thumbs[filename]) return
        loadPhotoSrc(filename, uid)
          .then((src) => src && setThumbs((prev) => ({ ...prev, [filename]: src })))
          .catch(() => {})
      })
    })
  }, [uid, photoSessions])

  useEffect(() => {
    if (!editingCrop || !uid) return
    const session = (photoSessions || []).find((s) => s.id === editingCrop.sessionId)
    const filename = session?.[editingCrop.angle]
    if (!filename || thumbs[filename]) return
    loadPhotoSrc(filename, uid)
      .then((src) => src && setThumbs((prev) => ({ ...prev, [filename]: src })))
      .catch(() => {})
  }, [uid, editingCrop, photoSessions, thumbs])

  useEffect(() => {
    if (editingDateSessionId && dateEditInputRef.current) dateEditInputRef.current.focus()
  }, [editingDateSessionId])

  function deleteSession(sessionId) {
    if (!setPhotoSessions) return
    const session = (photoSessions || []).find((s) => s.id === sessionId)
    const removed = session ? [session.front, session.back, session.side].filter(Boolean).length : 0
    if (removed > 0) onProgressPhotoRemoved?.(removed)
    setPhotoSessions((prev) => (prev || []).filter((s) => s.id !== sessionId))
  }

  function updateSessionDate(sessionId, newDate) {
    if (!setPhotoSessions || !newDate) return
    setPhotoSessions((prev) =>
      (prev || []).map((s) => (s.id === sessionId ? { ...s, date: newDate } : s))
    )
    setEditingDateSessionId(null)
  }

  function updateSessionCrop(sessionId, angle, crop) {
    if (!setPhotoSessions) return
    setPhotoSessions((prev) =>
      (prev || []).map((s) =>
        s.id === sessionId
          ? { ...s, crops: { ...(s.crops || {}), [angle]: crop } }
          : s
      )
    )
  }

  const sessionA = (photoSessions || []).find((s) => s.id === compareA)
  const sessionB = (photoSessions || []).find((s) => s.id === compareB)

  return (
    <>
      <div className={`flex ${padX} pt-3 pb-2 gap-2 shrink-0`}>
        {['timeline', 'compare'].map((v) => (
          <button
            key={v}
            onClick={() => {
              if (v === 'compare') {
                const sorted = sortPhotoSessionsByDate(photoSessions || [])
                if (sorted.length >= 2) {
                  setCompareA(sorted[sorted.length - 1].id)
                  setCompareB(sorted[0].id)
                }
              }
              setView(v)
            }}
            className={`flex-1 py-2 rounded-[8px] text-[11px] font-bold capitalize ${
              view === v ? 'bg-card-alt border border-border-strong text-text' : 'text-muted'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {showExitCTA && (
        <div className={`shrink-0 ${padX} pb-3`}>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent"
          >
            {hasChanges ? 'Save to progress' : 'Exit'}
          </button>
        </div>
      )}

      {view === 'timeline' && canAddPhotos && (
        <div className={`shrink-0 ${padX} pb-3 space-y-2`}>
          <button
            onClick={() => {
              if (atLimit) {
                if (typeof alert !== 'undefined')
                  alert(
                    "You've reached your progress photo limit for your current plan. Delete older photos or upgrade under Profile → Account."
                  )
                return
              }
              onOpenAddPhotos?.()
            }}
            className="w-full py-3 border border-dashed border-border-strong rounded-[12px] text-[12px] font-semibold text-text"
          >
            + Add photos
          </button>
          <div className="flex items-center gap-3 bg-card border border-border rounded-[12px] p-[11px_14px]">
            <span className="text-[10px] text-muted font-semibold whitespace-nowrap">
              {barUsed} / {barCap == null ? '∞' : barCap}
            </span>
            <div className="flex-1 h-[3px] bg-card-alt rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full" style={{ width: `${barPct}%` }} />
            </div>
            {atLimit && (
              <button
                disabled
                className="text-[10px] font-bold text-accent border border-accent/25 rounded-[6px] px-2 py-1 cursor-not-allowed"
              >
                Unlock ∞
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${padX} pb-6 min-h-0`}>
          {view === 'timeline' && (
            <>
              {((Array.isArray(photoSessions) ? photoSessions : []).length <= 3 || showAllSessions
                ? sortPhotoSessionsByDate(photoSessions || [])
                : [...getOldestMiddleNewestSessions(photoSessions || [])].reverse()
              ).map((session) => (
                <div key={session.id} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    {canAddPhotos && editingDateSessionId === session.id ? (
                      <input
                        ref={dateEditInputRef}
                        type="date"
                        value={enGBToDateInput(session.date)}
                        onChange={(e) => updateSessionDate(session.id, dateInputToEnGB(e.target.value))}
                        onBlur={() => setEditingDateSessionId(null)}
                        className="text-[10px] font-bold text-text uppercase tracking-[0.8px] bg-card-alt border border-border-strong rounded-lg px-2 py-1 outline-none focus:border-accent"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => canAddPhotos && setEditingDateSessionId(session.id)}
                        className={`text-[10px] font-bold uppercase tracking-[0.8px] text-left ${canAddPhotos ? 'text-muted hover:text-accent active:opacity-80' : 'text-muted'}`}
                      >
                        {fmtDate(session.date)}
                      </button>
                    )}
                    {canAddPhotos && (
                      <button
                        type="button"
                        onClick={() => setSessionToDelete(session.id)}
                        className="text-[10px] text-red-400 font-semibold inline-flex items-center gap-1"
                      >
                        <DeleteTrashGlyph className="w-3 h-3 shrink-0" />
                        Delete session
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {ANGLES.map(({ key, label }) => (
                      <div key={key} className="relative rounded-[10px] overflow-hidden">
                        <ProgressPhoto
                          src={thumbs[session[key]] || null}
                          crop={session.crops?.[key]}
                          className={`rounded-[10px] ${session[key] && canAddPhotos ? 'cursor-pointer' : ''}`}
                          onClick={session[key] && canAddPhotos ? () => setEditingCrop({ sessionId: session.id, angle: key }) : undefined}
                        >
                          {session[key] ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : (
                            <span className="text-[9px] text-muted font-semibold">—</span>
                          )}
                        </ProgressPhoto>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-1.5 px-1 text-center pointer-events-none rounded-b-[10px]">
                          <span className="text-[8px] font-bold text-white uppercase tracking-[0.5px]">
                            {label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {view === 'timeline' && (photoSessions || []).length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllSessions((v) => !v)}
                  className="w-full py-3 border border-dashed border-border-strong rounded-[12px] text-[12px] font-semibold text-accent"
                >
                  {showAllSessions ? 'Show only 3 (newest, middle, oldest)' : `See all ${(photoSessions || []).length} sessions`}
                </button>
              )}
            </>
          )}

          {view === 'compare' && (
            <>
              {(photoSessions || []).length < 2 ? (
                <div className="text-center py-12">
                  <div className="text-sm text-muted">Add at least 2 sessions to compare</div>
                </div>
              ) : (
                <>
                  {(() => {
                    const sorted = sortPhotoSessionsByDate(photoSessions || [])
                    const oldest = sorted.length > 0 ? sorted[sorted.length - 1] : null
                    const newest = sorted.length > 0 ? sorted[0] : null
                    const isOldestNewestSelected = oldest && newest && compareA === oldest.id && compareB === newest.id
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            if (oldest && newest) {
                              setCompareA(oldest.id)
                              setCompareB(newest.id)
                              setComparePickerOpen(null)
                            }
                          }}
                          className={`w-full py-3 rounded-xl border text-[13px] font-bold mb-3 transition-colors ${
                            isOldestNewestSelected
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-border bg-card-alt text-text hover:border-accent/50 hover:bg-card'
                          }`}
                        >
                          Compare oldest → newest
                        </button>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                          Or choose dates
                        </div>
                        <div className="flex gap-2 mb-3">
                          {[
                            { key: 'A', label: 'Before', currentId: compareA, setCurrent: setCompareA, session: sessionA },
                            { key: 'B', label: 'After', currentId: compareB, setCurrent: setCompareB, session: sessionB },
                          ].map(({ key, label, currentId, setCurrent, session }) => (
                            <div key={key} className="flex-1 min-w-0 relative">
                              <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mb-1">
                                {label}
                              </div>
                              <button
                                type="button"
                                onClick={() => setComparePickerOpen((v) => (v === key ? null : key))}
                                className={`w-full py-2.5 px-3 rounded-lg border text-[12px] font-semibold text-left flex items-center justify-between transition-colors ${
                                  !isOldestNewestSelected
                                    ? 'border-accent bg-accent/10 text-accent'
                                    : 'border-border bg-card text-text'
                                }`}
                              >
                                <span className="truncate">{session ? fmtDate(session.date) : 'Select'}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`shrink-0 ml-1 transition-transform ${comparePickerOpen === key ? 'rotate-180' : ''}`}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                              {comparePickerOpen === key && (
                                <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-border bg-page shadow-lg max-h-[220px] overflow-y-auto">
                                  {sorted.map((s) => (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => {
                                        setCurrent(s.id)
                                        setComparePickerOpen(null)
                                      }}
                                      className={`w-full px-3 py-2.5 text-left text-[12px] font-medium border-b border-border last:border-0 transition-colors ${
                                        currentId === s.id ? 'bg-accent/15 text-accent' : 'text-text hover:bg-card-alt'
                                      }`}
                                    >
                                      {fmtDate(s.date)}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )
                  })()}

                  <div className="border-t border-border pt-3 mt-3">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                      View angle (when dates chosen)
                    </div>
                    <div className="flex gap-2 mb-3">
                      {ANGLES.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setCompareAngle(key)}
                          className={`flex-1 py-2 rounded-[8px] text-[11px] font-bold ${
                            compareAngle === key ? 'bg-card-alt border border-border-strong text-text' : 'text-muted'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {[sessionA, sessionB].map((session, i) => {
                        const weightEntry = Array.isArray(weightLog) && session?.date
                          ? weightLog.find((e) => e.date === session.date)
                          : null
                        const muscleEntry = Array.isArray(muscleMassLog) && session?.date
                          ? muscleMassLog.find((e) => e.date === session.date)
                          : null
                        const statsLine = [weightEntry?.value != null && `Weight ${weightEntry.value} ${unitWeight}`, muscleEntry?.value != null && `Muscle ${muscleEntry.value}%`].filter(Boolean).join(' · ')
                        const placeholderSvg = (
                          <svg width="40" height="72" viewBox="0 0 50 90" fill="none" className="text-muted">
                            <ellipse cx="25" cy="14" rx="10" ry="11" fill="currentColor" />
                            <path d="M14 26 L36 26 L34 54 L34 90 L26 90 L26 54 L24 54 L24 90 L16 90 L16 54 Z" fill="currentColor" />
                          </svg>
                        )
                        return (
                          <div key={i} className="flex flex-col gap-1">
                            <ProgressPhoto
                              src={session?.[compareAngle] && thumbs[session[compareAngle]] ? thumbs[session[compareAngle]] : null}
                              crop={session?.crops?.[compareAngle]}
                              className={`rounded-[12px] ${session?.[compareAngle] && canAddPhotos ? 'cursor-pointer' : ''}`}
                              onClick={session?.[compareAngle] && canAddPhotos ? () => setEditingCrop({ sessionId: session.id, angle: compareAngle }) : undefined}
                            >
                              {placeholderSvg}
                            </ProgressPhoto>
                            <span className="text-[9px] font-bold text-muted text-center">
                              {session ? fmtDate(session.date) : '—'}
                            </span>
                            {statsLine ? (
                              <span className="text-[9px] text-muted text-center">
                                {statsLine}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

      {editingCrop && (() => {
        const session = (photoSessions || []).find((s) => s.id === editingCrop.sessionId)
        const filename = session?.[editingCrop.angle]
        if (!session || !filename) return null
        const editorSrc = thumbs[filename]
        return (
          <ProgressPhotoEditor
            src={editorSrc || null}
            initialCrop={session.crops?.[editingCrop.angle]}
            onSave={(crop) => updateSessionCrop(editingCrop.sessionId, editingCrop.angle, crop)}
            onClose={() => setEditingCrop(null)}
          />
        )
      })()}

      {sessionToDelete && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 z-[100]" aria-modal="true">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-xl relative z-[101]">
            <DeleteTrashBadge />
            <div className="text-[15px] font-bold text-text mb-1 text-center">Delete session?</div>
            <div className="text-[13px] text-muted mb-5 text-center">
              All photos from this date will be removed. This cannot be undone.
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold border border-border-strong bg-card-alt text-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSession(sessionToDelete)
                  setSessionToDelete(null)
                }}
                className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-red-500/90 text-white hover:bg-red-500 inline-flex items-center justify-center gap-2"
              >
                <DeleteTrashGlyph className="w-4 h-4 text-white" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
