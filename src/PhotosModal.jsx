import { useState, useEffect, useRef } from 'react'

const TOTAL_FREE_PHOTOS = 24
const WEB_PHOTO_STORAGE_KEY = 'repliqe_photoData'
const ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

const MAX_PHOTO_PX = 800
const PHOTO_QUALITY = 0.88

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
}) {
  const [view, setView] = useState('timeline')
  const [capturing, setCapturing] = useState(false)
  const [captureStep, setCaptureStep] = useState(0)
  const [capturedImages, setCapturedImages] = useState({})
  const [poseGuideEnabled, setPoseGuideEnabled] = useState(true)
  const [compareA, setCompareA] = useState(photoSessions[0]?.id ?? null)
  const [compareB, setCompareB] = useState(
    photoSessions.length > 1 ? photoSessions[photoSessions.length - 1].id : null
  )
  const [compareAngle, setCompareAngle] = useState('front')
  const [thumbs, setThumbs] = useState({})
  const inputCameraRef = useRef(null)
  const inputLibraryRef = useRef(null)

  const canAddPhotos = typeof setPhotoSessions === 'function'
  const isNative = isNativePlatform()

  useEffect(() => {
    photoSessions.forEach((session) => {
      ANGLES.forEach(({ key }) => {
        const filename = session[key]
        if (!filename || thumbs[filename]) return
        loadPhotoSrc(filename)
          .then((src) => src && setThumbs((prev) => ({ ...prev, [filename]: src })))
          .catch(() => {})
      })
    })
  }, [photoSessions])

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
      return photo.base64String ?? null
    } catch {
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
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file?.type?.startsWith('image/')) return
    setCapturing(true)
    try {
      const base64 = await normalizeImage(file)
      await saveAndAdvanceWithBase64(base64)
    } catch {
      // ignore
    }
    setCapturing(false)
  }

  function skipAngle() {
    setCaptureStep((prev) => prev + 1)
  }

  function finishCapture() {
    const { _sessionId, ...angles } = capturedImages
    const today = new Date().toLocaleDateString('en-GB')
    const newSession = {
      id: _sessionId ?? `ps_${Date.now()}`,
      date: today,
      front: angles.front ?? null,
      back: angles.back ?? null,
      side: angles.side ?? null,
    }
    setPhotoSessions((prev) => [...prev, newSession])
    setCapturing(false)
    setCaptureStep(0)
    setCapturedImages({})
  }

  function deleteSession(sessionId) {
    if (setPhotoSessions) setPhotoSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }

  const sessionA = photoSessions.find((s) => s.id === compareA)
  const sessionB = photoSessions.find((s) => s.id === compareB)

  if (capturing) {
    const currentAngle = ANGLES[captureStep]
    const isDone = captureStep >= ANGLES.length

    if (isDone) {
      return (
        <div className="fixed inset-0 bg-page z-50 flex flex-col items-center justify-center px-6">
          <div className="w-16 h-16 rounded-full bg-success/12 flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-8 h-8 stroke-success">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Photos saved</h2>
          <p className="text-sm text-muted text-center mb-8">
            {Object.values(capturedImages).filter((v) => v && v !== capturedImages._sessionId).length} photos taken
          </p>
          <button
            onClick={finishCapture}
            className="w-full max-w-sm py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent"
          >
            Done
          </button>
        </div>
      )
    }

    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex gap-2 px-6 pt-12 pb-4">
          {ANGLES.map((a, i) => (
            <div
              key={a.key}
              className={`flex-1 h-1 rounded-full ${
                i < captureStep ? 'bg-success' : i === captureStep ? 'bg-white' : 'bg-white/20'
              }`}
            />
          ))}
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-white text-2xl font-extrabold mb-1">{currentAngle.label}</div>
          <div className="text-white/50 text-sm mb-8">
            Step {captureStep + 1} of {ANGLES.length}
          </div>
          {poseGuideEnabled && (
            <div className="relative w-48 h-80 mb-8">
              <div className="absolute inset-0 border-2 border-white/20 rounded-3xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="80" height="160" viewBox="0 0 50 90" fill="none">
                  <ellipse cx="25" cy="14" rx="10" ry="11" fill="rgba(255,255,255,0.15)" />
                  <path
                    d={
                      currentAngle.key === 'side'
                        ? 'M20 35 Q18 24 28 24 Q40 24 40 35 L43 70 Q43 74 39 74 L35 74 L33 90 L20 90 L18 74 L14 74 Q12 74 13 70 Z'
                        : 'M10 35 Q10 24 25 24 Q40 24 40 35 L43 70 Q43 74 39 74 L34 74 L32 90 L18 90 L16 74 L11 74 Q7 74 7 70 Z'
                    }
                    fill="rgba(255,255,255,0.15)"
                  />
                </svg>
              </div>
              <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/40 font-semibold">
                Align yourself with the guide
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-12 flex flex-col gap-3">
          {/* Web: use label+input so click opens file picker reliably (no programmatic click) */}
          <input
            id="photos-camera-input"
            ref={inputCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-hidden
            onChange={handleFileSelected}
          />
          <input
            id="photos-library-input"
            ref={inputLibraryRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden
            onChange={handleFileSelected}
          />
          {isNative ? (
            <>
              <button
                type="button"
                onClick={() => handleCaptureAngle('camera')}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-white text-black"
              >
                Take {currentAngle.label} photo
              </button>
              <button
                type="button"
                onClick={() => handleCaptureAngle('library')}
                className="w-full py-4 rounded-2xl font-bold text-sm bg-white/90 text-black border border-white/50"
              >
                Choose from library
              </button>
            </>
          ) : (
            <>
              <label
                htmlFor="photos-camera-input"
                className="w-full py-4 rounded-2xl font-bold text-sm bg-white text-black text-center cursor-pointer block"
              >
                Take {currentAngle.label} photo
              </label>
              <label
                htmlFor="photos-library-input"
                className="w-full py-4 rounded-2xl font-bold text-sm bg-white/90 text-black border border-white/50 text-center cursor-pointer block"
              >
                Choose from library
              </label>
            </>
          )}
          <button onClick={skipAngle} className="w-full py-3 text-sm font-semibold text-white/50">
            Skip {currentAngle.label}
          </button>
          <button
            onClick={() => {
              setCapturing(false)
              setCaptureStep(0)
              setCapturedImages({})
            }}
            className="w-full py-3 text-sm font-semibold text-white/30"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-end justify-center">
      <div className="w-full max-w-md bg-page rounded-t-[20px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className="text-[18px] font-extrabold text-text">Photos</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPoseGuideEnabled((prev) => !prev)}
              className={`text-[10px] font-bold uppercase tracking-[0.5px] px-2 py-1 rounded-md ${
                poseGuideEnabled
                  ? 'bg-accent/10 text-accent border border-accent/25'
                  : 'bg-card-alt text-muted border border-border'
              }`}
            >
              Guide {poseGuideEnabled ? 'on' : 'off'}
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-card-alt flex items-center justify-center text-muted text-sm"
            >
              ✕
            </button>
          </div>
        </div>

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

        <div className="flex-1 overflow-y-auto px-5 pb-6 min-h-0">
          {view === 'timeline' && (
            <>
              {canAddPhotos && (
                <div className="flex items-center gap-3 mb-4 bg-card border border-border rounded-[12px] p-[11px_14px]">
                  <span className="text-[10px] text-muted font-semibold whitespace-nowrap">
                    {(totalPhotos || photoSessions.reduce((s, sess) => s + [sess.front, sess.back, sess.side].filter(Boolean).length, 0))} / {TOTAL_FREE_PHOTOS}
                  </span>
                  <div className="flex-1 h-[3px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          ((totalPhotos || photoSessions.reduce((s, sess) => s + [sess.front, sess.back, sess.side].filter(Boolean).length, 0)) /
                            TOTAL_FREE_PHOTOS) *
                            100
                        )}%`,
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
              )}

              {[...photoSessions].reverse().map((session) => (
                <div key={session.id} className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-[0.8px]">
                      {session.date}
                    </span>
                    {canAddPhotos && (
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="text-[10px] text-[#ff6b6b] font-semibold"
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
                        <span className="absolute bottom-1.5 left-0 right-0 text-center text-[8px] font-bold text-white/25 uppercase">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {canAddPhotos && (
                <button
                  onClick={() => {
                    if (atLimit) {
                      alert(`You've reached the ${TOTAL_FREE_PHOTOS} photo limit. Delete a session to add more, or unlock unlimited storage.`)
                      return
                    }
                    setCapturing(true)
                    setCaptureStep(0)
                    setCapturedImages({})
                  }}
                  className="w-full py-3 border border-dashed border-border-strong rounded-[12px] text-[12px] font-semibold text-text"
                >
                  + Add photos
                </button>
              )}
            </>
          )}

          {view === 'compare' && (
            <>
              {photoSessions.length < 2 ? (
                <div className="text-center py-12">
                  <div className="text-sm text-muted">Add at least 2 sessions to compare</div>
                </div>
              ) : (
                <>
                  {['A', 'B'].map((label, idx) => {
                    const currentId = idx === 0 ? compareA : compareB
                    const setCurrent = idx === 0 ? setCompareA : setCompareB
                    return (
                      <div key={label} className="mb-3">
                        <div className="text-[10px] font-bold text-muted uppercase tracking-[0.8px] mb-2">
                          {label === 'A' ? 'Before' : 'After'}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {photoSessions.map((session) => (
                            <button
                              key={session.id}
                              onClick={() => setCurrent(session.id)}
                              className={`shrink-0 flex flex-col items-center gap-1 p-2 rounded-[10px] border transition-all ${
                                currentId === session.id ? 'border-accent bg-accent/8' : 'border-border bg-card'
                              }`}
                            >
                              <div className="w-14 h-20 rounded-[6px] overflow-hidden bg-card-deep flex items-center justify-center">
                                {thumbs[session.front] ? (
                                  <img
                                    src={thumbs[session.front]}
                                    alt=""
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[9px] text-muted">—</span>
                                )}
                              </div>
                              <span
                                className={`text-[9px] font-bold ${
                                  currentId === session.id ? 'text-accent' : 'text-muted'
                                }`}
                              >
                                {session.date}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex gap-2 mb-4">
                    {ANGLES.map(({ key, label }) => (
                      <button
                        key={key}
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
                    {[sessionA, sessionB].map((session, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <div className="aspect-[0.72] bg-card rounded-[12px] overflow-hidden flex items-center justify-center">
                          {session?.[compareAngle] && thumbs[session[compareAngle]] ? (
                            <img
                              src={thumbs[session[compareAngle]]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <svg width="40" height="72" viewBox="0 0 50 90" fill="none">
                              <ellipse cx="25" cy="14" rx="10" ry="11" fill="rgba(255,255,255,0.07)" />
                              <path
                                d="M10 35 Q10 24 25 24 Q40 24 40 35 L43 70 Q43 74 39 74 L34 74 L32 90 L18 90 L16 74 L11 74 Q7 74 7 70 Z"
                                fill="rgba(255,255,255,0.07)"
                              />
                            </svg>
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-muted text-center">
                          {session?.date ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
