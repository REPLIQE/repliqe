import { useState, useEffect, useRef } from 'react'
import { groupPhotoSessionsByMonth, getOldestMiddleNewestSessions } from './progressUtils'

const TOTAL_FREE_PHOTOS = 12
const WEB_PHOTO_STORAGE_KEY = 'repliqe_photoData'
const ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

const MAX_PHOTO_PX = 800
const PHOTO_QUALITY = 0.88

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

/** Sort sessions by session date (newest first). Uses date string dd/mm/yyyy. */
function sortSessionsByDate(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []
  return [...sessions].sort((a, b) => {
    const da = enGBToDateInput(a?.date || '')
    const db = enGBToDateInput(b?.date || '')
    return db.localeCompare(da)
  })
}

function isNativePlatform() {
  if (typeof window === 'undefined') return false
  const p = window.Capacitor?.getPlatform?.()
  return p === 'ios' || p === 'android'
}

/** Normalize image: resize to max 800px, JPEG, preserve aspect ratio. Returns base64 (no data URL prefix). */
function normalizeImage(input) {
  return new Promise((resolve, reject) => {
    const dataUrl = input instanceof File
      ? null
      : (input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`)
    const finish = (url) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const w = img.naturalWidth
        const h = img.naturalHeight
        const scale = Math.min(1, MAX_PHOTO_PX / Math.max(w, h))
        const cw = Math.round(w * scale)
        const ch = Math.round(h * scale)
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas not available'))
        ctx.drawImage(img, 0, 0, cw, ch)
        const out = canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
        const base64 = out.replace(/^data:image\/jpeg;base64,/, '')
        resolve(base64)
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = url
    }
    if (input instanceof File) {
      const reader = new FileReader()
      reader.onload = () => finish(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(input)
    } else {
      finish(dataUrl)
    }
  })
}

/** Load a stored photo as a data URL. Tries Capacitor Data, then Cache, then localStorage. */
export async function loadPhotoSrc(filename) {
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
    try {
      const raw = localStorage.getItem(WEB_PHOTO_STORAGE_KEY)
      if (!raw) return null
      const data = JSON.parse(raw)
      const base64 = data[filename]
      return base64 ? `data:image/jpeg;base64,${base64}` : null
    } catch {
      return null
    }
  }
}

async function savePhoto(base64Data, filename) {
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
      return filename
    } catch (dataErr) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        await Filesystem.writeFile({
          path: filename,
          data: clean,
          directory: Directory.Cache,
        })
        return filename
      } catch (cacheErr) {
        try {
          const raw = localStorage.getItem(WEB_PHOTO_STORAGE_KEY) || '{}'
          const data = JSON.parse(raw)
          data[filename] = clean
          localStorage.setItem(WEB_PHOTO_STORAGE_KEY, JSON.stringify(data))
          return filename
        } catch {
          console.error('Save photo (native) Data/Cache/localStorage failed:', dataErr, cacheErr)
          throw new Error('Could not save photo')
        }
      }
    }
  }
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: filename,
      data: clean,
      directory: Directory.Data,
    })
    return filename
  } catch {
    try {
      const raw = localStorage.getItem(WEB_PHOTO_STORAGE_KEY) || '{}'
      const data = JSON.parse(raw)
      data[filename] = clean
      localStorage.setItem(WEB_PHOTO_STORAGE_KEY, JSON.stringify(data))
      return filename
    } catch {
      throw new Error('Could not save photo')
    }
  }
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
  openToAdd = false,
}) {
  const [capturing, setCapturing] = useState(false)
  const [captureStep, setCaptureStep] = useState(0)
  const [capturedImages, setCapturedImages] = useState({})
  const [captureSessionDate, setCaptureSessionDate] = useState(() => getTodayEnGB())
  const inputCameraRef = useRef(null)
  const inputLibraryRef = useRef(null)
  const dateInputRef = useRef(null)
  const initialPhotoSessionsRef = useRef(null)

  const canAddPhotos = typeof setPhotoSessions === 'function'
  const isNative = isNativePlatform()

  useEffect(() => {
    initialPhotoSessionsRef.current = JSON.stringify(photoSessions)
  }, [])

  useEffect(() => {
    if (openToAdd && canAddPhotos && !atLimit) {
      setCapturing(true)
      setCaptureStep(0)
      setCapturedImages({})
      setCaptureSessionDate(getTodayEnGB())
    }
  }, [openToAdd, canAddPhotos, atLimit])

  const hasChanges =
    initialPhotoSessionsRef.current !== null &&
    JSON.stringify(photoSessions) !== initialPhotoSessionsRef.current


  /** On native: opens camera or gallery. On web returns null (use file input instead). */
  async function takePhoto(source) {
    if (!isNative) return null
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
      const photo = await Camera.getPhoto({
        quality: 85,
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
    // On native (iOS/Android) skip canvas normalization to avoid WebView issues; Camera already returns JPEG
    if (!isNative) {
      try {
        normalized = await normalizeImage(base64)
      } catch {
        normalized = base64.replace(/^data:image\/\w+;base64,/, '') || base64
      }
    }
    const sessionId = capturedImages._sessionId ?? `ps_${Date.now()}`
    const filename = `${sessionId}_${angle.key}.jpg`
    try {
      await savePhoto(normalized, filename)
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
      const today = new Date().toLocaleDateString('en-GB')
      const partial = {
        id: sessionId,
        date: today,
        front: updated.front ?? null,
        back: updated.back ?? null,
        side: updated.side ?? null,
      }
      setPhotoSessions((prev) => {
        const without = (prev || []).filter((s) => s.id !== sessionId)
        return [...without, partial]
      })
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

  function finishCapture() {
    const { _sessionId, ...angles } = capturedImages
    const newSession = {
      id: _sessionId ?? `ps_${Date.now()}`,
      date: captureSessionDate,
      front: angles.front ?? null,
      back: angles.back ?? null,
      side: angles.side ?? null,
    }
    setPhotoSessions((prev) => {
      const without = (prev || []).filter((s) => s.id !== newSession.id)
      return [...without, newSession]
    })
    setCapturing(false)
    setCaptureStep(0)
    setCapturedImages({})
  }

  if (capturing) {
    const currentAngle = ANGLES[captureStep]
    const isDone = captureStep >= ANGLES.length

    if (isDone) {
      return (
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
      )
    }

    return (
      <div className="fixed inset-0 z-50 flex justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" aria-hidden />
        <div className="relative w-full max-w-md h-full flex flex-col bg-page">
        <div className="flex gap-2 px-6 pt-12 pb-2">
          {ANGLES.map((a, i) => (
            <div
              key={a.key}
              className={`flex-1 h-1 rounded-full ${
                i < captureStep ? 'bg-success' : i === captureStep ? 'bg-accent' : 'bg-card-alt'
              }`}
            />
          ))}
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
              setCapturing(false)
              setCaptureStep(0)
              setCapturedImages({})
            }}
            className="w-full py-3 text-sm font-semibold text-muted border border-border rounded-lg"
          >
            Cancel
          </button>
        </div>
        </div>
      </div>
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
          weightLog={weightLog}
          muscleMassLog={muscleMassLog}
          unitWeight={unitWeight}
          showExitCTA={true}
          onClose={onClose}
          hasChanges={hasChanges}
          onOpenAddPhotos={() => {
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
  weightLog = [],
  muscleMassLog = [],
  unitWeight = 'kg',
  showExitCTA = false,
  onClose,
  hasChanges = false,
  onOpenAddPhotos,
}) {
  const [view, setView] = useState('timeline')
  const [compareA, setCompareA] = useState(photoSessions[0]?.id ?? null)
  const [compareB, setCompareB] = useState(
    photoSessions.length > 1 ? photoSessions[photoSessions.length - 1].id : null
  )
  const [compareAngle, setCompareAngle] = useState('front')
  const [showAllSessions, setShowAllSessions] = useState(false)
  const [editingDateSessionId, setEditingDateSessionId] = useState(null)
  const [sessionToDelete, setSessionToDelete] = useState(null)
  const [thumbs, setThumbs] = useState({})
  const dateEditInputRef = useRef(null)

  const canAddPhotos = typeof setPhotoSessions === 'function'
  const totalPhotos =
    totalPhotosProp ||
    (Array.isArray(photoSessions) ? photoSessions.reduce((s, sess) => s + [sess?.front, sess?.back, sess?.side].filter(Boolean).length, 0) : 0)

  useEffect(() => {
    if (!Array.isArray(photoSessions)) return
    photoSessions.forEach((session) => {
      ANGLES.forEach(({ key }) => {
        const filename = session?.[key]
        if (!filename || thumbs[filename]) return
        loadPhotoSrc(filename)
          .then((src) => src && setThumbs((prev) => ({ ...prev, [filename]: src })))
          .catch(() => {})
      })
    })
  }, [photoSessions])

  useEffect(() => {
    if (editingDateSessionId && dateEditInputRef.current) dateEditInputRef.current.focus()
  }, [editingDateSessionId])

  function deleteSession(sessionId) {
    if (setPhotoSessions) setPhotoSessions((prev) => (prev || []).filter((s) => s.id !== sessionId))
  }

  function updateSessionDate(sessionId, newDate) {
    if (!setPhotoSessions || !newDate) return
    setPhotoSessions((prev) =>
      (prev || []).map((s) => (s.id === sessionId ? { ...s, date: newDate } : s))
    )
    setEditingDateSessionId(null)
  }

  const sessionA = (photoSessions || []).find((s) => s.id === compareA)
  const sessionB = (photoSessions || []).find((s) => s.id === compareB)

  return (
    <>
      <div className="flex px-5 pt-3 pb-2 gap-2 shrink-0">
        {['timeline', 'compare'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-[8px] text-[11px] font-bold capitalize ${
              view === v ? 'bg-card-alt border border-border-strong text-text' : 'text-muted'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {showExitCTA && (
        <div className="shrink-0 px-5 pb-3">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent"
          >
            {hasChanges ? 'Save to progress' : 'Exit'}
          </button>
        </div>
      )}

      {view === 'timeline' && canAddPhotos && (
        <div className="shrink-0 px-5 pb-3 space-y-2">
          <button
            onClick={() => {
              if (atLimit) {
                if (typeof alert !== 'undefined') alert(`You've reached the ${TOTAL_FREE_PHOTOS} photo limit. Delete a session to add more, or unlock unlimited storage.`)
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
              {totalPhotos} / {TOTAL_FREE_PHOTOS}
            </span>
            <div className="flex-1 h-[3px] bg-card-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full"
                style={{
                  width: `${Math.min(100, (totalPhotos / TOTAL_FREE_PHOTOS) * 100)}%`,
                }}
              />
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

      <div className="flex-1 overflow-y-auto px-5 pb-6 min-h-0">
          {view === 'timeline' && (
            <>
              {((Array.isArray(photoSessions) ? photoSessions : []).length <= 3 || showAllSessions
                ? sortSessionsByDate(photoSessions || [])
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
                        {session.date}
                      </button>
                    )}
                    {canAddPhotos && (
                      <button
                        onClick={() => setSessionToDelete(session.id)}
                        className="text-[10px] text-red-400 font-semibold"
                      >
                        Delete session
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {ANGLES.map(({ key, label }) => (
                      <div
                        key={key}
                        className="aspect-[0.72] bg-card rounded-[10px] overflow-hidden flex items-center justify-center relative"
                      >
                        {thumbs[session[key]] ? (
                          <img
                            src={thumbs[session[key]]}
                            alt={label}
                            className="w-full h-full object-cover"
                          />
                        ) : session[key] ? (
                          <div className="w-5 h-5 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-[9px] text-muted font-semibold">—</span>
                        )}
                        <span className="absolute bottom-1.5 left-0 right-0 text-center text-[8px] font-bold text-muted uppercase">
                          {label}
                        </span>
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
                  <div className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                    Choose before and after date
                  </div>
                  <div className="flex gap-2 mb-3">
                    {['A', 'B'].map((label, idx) => {
                      const currentId = idx === 0 ? compareA : compareB
                      const setCurrent = idx === 0 ? setCompareA : setCompareB
                      const currentSession = idx === 0 ? sessionA : sessionB
                      return (
                        <div key={label} className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mb-1.5">
                            {label === 'A' ? 'Before' : 'After'}
                          </div>
                          <div className="space-y-2.5 max-h-[160px] overflow-y-auto">
                            {groupPhotoSessionsByMonth(photoSessions || []).map(({ monthLabel, sessions }) => (
                              <div key={monthLabel} className="rounded-lg border border-border bg-card-alt/50 py-1.5 px-2">
                                <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mb-1.5 sticky top-0 bg-card-alt/80 py-0.5 -mx-0.5 px-0.5">
                                  {monthLabel}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {sessions.map((session) => (
                                    <button
                                      key={session.id}
                                      type="button"
                                      onClick={() => setCurrent(session.id)}
                                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                                        currentId === session.id ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card-alt text-muted'
                                      }`}
                                    >
                                      {session.date}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          {currentSession && (
                            <div className="mt-1.5 text-[10px] font-semibold text-text truncate">
                              {currentSession.date}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

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
                        return (
                          <div key={i} className="flex flex-col gap-1">
                            <div className="aspect-[0.72] bg-card rounded-[12px] overflow-hidden flex items-center justify-center">
                              {session?.[compareAngle] && thumbs[session[compareAngle]] ? (
                                <img
                                  src={thumbs[session[compareAngle]]}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <svg width="40" height="72" viewBox="0 0 50 90" fill="none" className="text-muted">
                                  <ellipse cx="25" cy="14" rx="10" ry="11" fill="currentColor" />
                                  <path
                                    d="M10 35 Q10 24 25 24 Q40 24 40 35 L43 70 Q43 74 39 74 L34 74 L32 90 L18 90 L16 74 L11 74 Q7 74 7 70 Z"
                                    fill="currentColor"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="text-[9px] font-bold text-muted text-center">
                              {session?.date ?? '—'}
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

      {sessionToDelete && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/50 z-10">
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="text-[15px] font-bold text-text mb-1">Delete session?</div>
            <div className="text-[13px] text-muted mb-5">
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
                className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-red-500/90 text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
