import { useState, useEffect, useRef } from 'react'
import PhotosModal, { PhotosViewContent } from './PhotosModal'
import { loadPhotoSrc } from './PhotosModal'
import { useAuth } from './lib/AuthContext'
import { defaultPlanUsage, photoAtLimit, countProgressPhotoSlots } from './lib/planUsage'

const PERIODS = ['4W', '3M', '6M', '1Y', 'All']
const MEASUREMENTS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'upperArm', label: 'Upper arm' },
  { key: 'thigh', label: 'Thigh' },
  { key: 'calf', label: 'Calf' },
]
const CM_PER_INCH = 2.54

export default function ProgressBody({
  weightLog,
  setWeightLog,
  bodyFatLog,
  setBodyFatLog,
  muscleMassLog,
  setMuscleMassLog,
  measurementsLog,
  setMeasurementsLog,
  photoSessions,
  setPhotoSessions,
  unitWeight,
  unitLength = 'cm',
  formatDecimal,
  parseDecimal,
  formatDateForDisplay,
  scrollToPhotosSection = false,
  onScrolledToPhotos,
  openAddPhoto = false,
  onConsumedOpenAddPhoto,
  returnToWorkoutAfterPhotoClose = false,
  onReturnToWorkoutAfterPhoto,
  photoLinkTargetSessionId = null,
  onClearPhotoLinkTarget,
  onPhotoSessionLinkedToWorkout,
  userPlan = 'free',
  planUsage: planUsageProp,
  onProgressPhotoAdded,
}) {
  const planUsage = planUsageProp ?? defaultPlanUsage()
  const fmt = formatDecimal ?? ((n, decimals) => (n != null ? (decimals != null ? Number(n).toFixed(decimals) : String(n)) : '—'))
  const parse = parseDecimal ?? ((s) => parseFloat(String(s).replace(',', '.')))
  const [period, setPeriod] = useState('3M')
  const [showAddWeight, setShowAddWeight] = useState(false)
  const [showAddBF, setShowAddBF] = useState(false)
  const [showAddMuscleMass, setShowAddMuscleMass] = useState(false)
  const [showAddMeasurements, setShowAddMeasurements] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [openPhotosToAdd, setOpenPhotosToAdd] = useState(false)
  const photosSectionRef = useRef(null)

  useEffect(() => {
    if (scrollToPhotosSection && photosSectionRef.current) {
      photosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onScrolledToPhotos?.()
    }
  }, [scrollToPhotosSection, onScrolledToPhotos])

  useEffect(() => {
    if (!openAddPhoto) return
    if (photosSectionRef.current) photosSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setShowPhotos(true)
    onConsumedOpenAddPhoto?.()
  }, [openAddPhoto])

  const [newWeight, setNewWeight] = useState('')
  const [newBF, setNewBF] = useState('')
  const [newMuscleMass, setNewMuscleMass] = useState('')
  const [newMeasurements, setNewMeasurements] = useState({})

  const today = new Date().toLocaleDateString('en-GB')

  const safeWeightLog = Array.isArray(weightLog) ? weightLog : []
  const safeBodyFatLog = Array.isArray(bodyFatLog) ? bodyFatLog : []
  const safeMuscleMassLog = Array.isArray(muscleMassLog) ? muscleMassLog : []
  const safeMeasurementsLog = Array.isArray(measurementsLog) ? measurementsLog : []
  const safePhotoSessions = Array.isArray(photoSessions) ? photoSessions : []

  const latestWeight = safeWeightLog.length > 0 ? safeWeightLog[safeWeightLog.length - 1] : null
  const firstWeight = safeWeightLog.length > 0 ? safeWeightLog[0] : null
  const latestBF = safeBodyFatLog.length > 0 ? safeBodyFatLog[safeBodyFatLog.length - 1] : null
  const latestMuscleMass = safeMuscleMassLog.length > 0 ? safeMuscleMassLog[safeMuscleMassLog.length - 1] : null

  const totalPhotos = countProgressPhotoSlots(safePhotoSessions)
  const atLimit = photoAtLimit(userPlan, totalPhotos, planUsage)
  const progressPhotoBarUsed =
    userPlan === 'pro' || userPlan === 'elite' ? planUsage.progressPhotosThisPeriod : totalPhotos
  const progressPhotoBarCap = userPlan === 'elite' ? null : userPlan === 'pro' ? 50 : 12

  function filterLog(log) {
    if (period === 'All') return log
    const now = Date.now()
    const MS = { '4W': 28, '3M': 90, '6M': 180, '1Y': 365 }[period] * 86400000
    return log.filter((entry) => {
      const parts = (entry.date || '').split('/')
      if (parts.length !== 3) return false
      const d = new Date(parts[2], parts[1] - 1, parts[0])
      return now - d.getTime() <= MS
    })
  }

  const weightPoints = filterLog(weightLog)
  const weightMax = weightPoints.length ? Math.max(...weightPoints.map((p) => p.value)) : 0
  const weightMin = weightPoints.length ? Math.min(...weightPoints.map((p) => p.value)) : 0
  const weightRange = weightMax - weightMin || 1

  const latestMeasurements = safeMeasurementsLog.length > 0 ? safeMeasurementsLog[safeMeasurementsLog.length - 1] : null
  function getFirstMeasurementForKey(key) {
    const entry = safeMeasurementsLog.find((e) => e[key] != null && e[key] !== '')
    return entry ? Number(entry[key]) : null
  }

  function addWeight() {
    const val = parse(newWeight)
    if (val === undefined || val === null || Number.isNaN(val)) return
    setWeightLog((prev) => [...prev, { date: today, value: val }])
    setNewWeight('')
    setShowAddWeight(false)
  }

  function addBF() {
    const val = parse(newBF)
    if (val === undefined || val === null || Number.isNaN(val)) return
    setBodyFatLog((prev) => [...prev, { date: today, value: val }])
    setNewBF('')
    setShowAddBF(false)
  }

  function addMuscleMass() {
    const val = parse(newMuscleMass)
    if (val === undefined || val === null || Number.isNaN(val)) return
    setMuscleMassLog((prev) => [...prev, { date: today, value: val }])
    setNewMuscleMass('')
    setShowAddMuscleMass(false)
  }

  function openMeasurementsModal() {
    const latest = safeMeasurementsLog.length > 0 ? safeMeasurementsLog[safeMeasurementsLog.length - 1] : null
    if (latest) {
      const initial = {}
      MEASUREMENTS.forEach(({ key }) => {
        if (latest[key] != null && latest[key] !== undefined) {
          const cm = Number(latest[key])
          if (unitLength === 'inch') initial[key] = fmt(cm / CM_PER_INCH, 1)
          else initial[key] = fmt(cm, 1)
        }
      })
      setNewMeasurements(initial)
    } else {
      setNewMeasurements({})
    }
    setShowAddMeasurements(true)
  }

  function addMeasurements() {
    const entry = { date: today }
    const toCm = unitLength === 'inch' ? (v) => v * CM_PER_INCH : (v) => v
    MEASUREMENTS.forEach(({ key }) => {
      const v = parse(newMeasurements[key])
      if (v !== undefined && !Number.isNaN(v)) entry[key] = Math.round(toCm(v) * 10) / 10
    })
    if (Object.keys(entry).length <= 1) return
    setMeasurementsLog((prev) => [...prev, entry])
    setNewMeasurements({})
    setShowAddMeasurements(false)
  }

  return (
    <div className="-mt-4">
      <div className="sec">Weight</div>
      <div className="bg-card border border-border rounded-[14px] p-4 mb-2">
        <div className="flex justify-between items-baseline mb-3">
          <div className="text-[13px] font-bold text-text">
            {latestWeight ? `${fmt(latestWeight.value)} ${unitWeight}` : '—'}
            <span className="text-[10px] text-muted font-normal ml-1">today</span>
          </div>
          {latestWeight && firstWeight && latestWeight !== firstWeight && (
            <div
              className={`text-[11px] font-bold ${
                latestWeight.value < firstWeight.value ? 'text-success' : 'text-[#ff6b6b]'
              }`}
            >
              {latestWeight.value < firstWeight.value ? '↓' : '↑'}&nbsp;
              {fmt(Math.abs(latestWeight.value - firstWeight.value), 1)} {unitWeight}
            </div>
          )}
        </div>

        {weightPoints.length > 1 ? (
          <>
            <div className="flex items-end gap-1 h-[70px]">
              {weightPoints.map((p, i) => {
                const heightPct = 20 + ((weightMax - p.value) / weightRange) * 75
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-[3px] min-w-0"
                    style={{
                      height: `${100 - heightPct}%`,
                      background:
                        i === weightPoints.length - 1
                          ? '#5BF5A0'
                          : `rgba(91,245,160,${0.15 + (i / weightPoints.length) * 0.7})`,
                    }}
                  />
                )
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-muted">{weightPoints[0]?.date}</span>
              <span className="text-[8px] text-muted">{weightPoints[weightPoints.length - 1]?.date}</span>
            </div>
          </>
        ) : (
          <div className="text-sm text-muted italic">Log weight to see trend</div>
        )}

        <button
          onClick={() => setShowAddWeight(true)}
          className="mt-3 w-full py-2 border border-dashed border-border-strong rounded-[10px] text-[12px] font-semibold text-accent"
        >
          + Log today&apos;s weight
        </button>
      </div>

      <div className="flex gap-[3px] bg-[rgba(255,255,255,0.03)] border border-border rounded-[10px] p-[3px] mb-4">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 py-[6px] rounded-[7px] text-[10px] font-bold ${
              period === p ? 'bg-[rgba(123,123,255,0.15)] text-accent' : 'text-muted'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
          <div className="text-[20px] font-extrabold text-text">
            {latestBF ? fmt(latestBF.value) : '—'}
            <span className="text-[10px] text-muted ml-0.5">%</span>
          </div>
          <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">Body fat</div>
          <button onClick={() => setShowAddBF(true)} className="mt-2 text-[10px] text-accent font-semibold">
            + Log
          </button>
        </div>
        <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
          <div className="text-[20px] font-extrabold text-text">
            {latestMuscleMass != null ? fmt(latestMuscleMass.value) : '—'}
            <span className="text-[10px] text-muted ml-0.5">%</span>
          </div>
          <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">Muscle mass</div>
          <button onClick={() => setShowAddMuscleMass(true)} className="mt-2 text-[10px] text-accent font-semibold">
            + Log
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[14px] p-4 mb-4 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-bold text-text">Apple Health</div>
          <div className="text-[10px] text-muted mt-0.5">Sync weight automatically</div>
        </div>
        <button
          disabled
          className="bg-card-alt border border-border-strong rounded-[8px] px-3 py-1.5 text-[11px] font-bold text-muted cursor-not-allowed"
        >
          Coming soon
        </button>
      </div>

      <div className="sec">Measurements</div>
      <div className="bg-card border border-border rounded-[14px] overflow-hidden mb-2">
        {MEASUREMENTS.map(({ key, label }, i) => {
          const latest = latestMeasurements?.[key] != null && latestMeasurements?.[key] !== '' ? Number(latestMeasurements[key]) : null
          const first = getFirstMeasurementForKey(key)
          const delta = latest != null && first != null && latest !== first ? latest - first : null
          const display = (cm) => (unitLength === 'inch' ? (cm / CM_PER_INCH).toFixed(1) : cm.toFixed(1))
          const unitLabel = unitLength === 'inch' ? 'inch' : 'cm'
          return (
            <div
              key={key}
              className={`flex items-center justify-between p-[11px_14px] ${
                i < MEASUREMENTS.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <span className="text-[13px] font-semibold text-text">{label}</span>
              <div className="flex items-center gap-[10px]">
                {delta != null && (
                  <span className={`text-[10px] font-bold ${delta > 0 ? 'text-success' : 'text-[#ff6b6b]'}`}>
                    {delta > 0 ? '↑' : '↓'} {display(Math.abs(delta))} {unitLabel}
                  </span>
                )}
                <span className="text-[13px] font-extrabold text-text">{latest ? `${display(latest)} ${unitLabel}` : '—'}</span>
              </div>
            </div>
          )
        })}
      </div>
      <button
        onClick={openMeasurementsModal}
        className="w-full py-3 mb-6 border border-dashed border-border-strong rounded-[12px] text-[12px] font-semibold text-accent"
      >
        + Log measurements
      </button>

      <div ref={photosSectionRef} className="scroll-mt-4">
        <div className="sec">Photos</div>
        <div className="relative flex flex-col min-h-[280px]">
        <PhotosViewContent
          photoSessions={safePhotoSessions}
          setPhotoSessions={setPhotoSessions}
          totalPhotos={totalPhotos}
          atLimit={atLimit}
          progressPhotoBarUsed={progressPhotoBarUsed}
          progressPhotoBarCap={progressPhotoBarCap}
          weightLog={safeWeightLog}
          muscleMassLog={safeMuscleMassLog}
          unitWeight={unitWeight ?? 'kg'}
          formatDateForDisplay={formatDateForDisplay}
          showExitCTA={false}
          inline={true}
          onOpenAddPhotos={() => {
            if (atLimit) {
              alert(
                "You've reached your progress photo limit for your current plan. You can delete older photos, upgrade under Profile → Account, or wait until next month if you're on Pro."
              )
              return
            }
            setOpenPhotosToAdd(true)
            setShowPhotos(true)
          }}
        />
        </div>
      </div>

      {showAddWeight && (
        <QuickInputModal
          title="Log weight"
          placeholder={`e.g. 84.2 ${unitWeight}`}
          value={newWeight}
          onChange={setNewWeight}
          onConfirm={addWeight}
          onCancel={() => setShowAddWeight(false)}
          keyboardType="decimal"
        />
      )}
      {showAddBF && (
        <QuickInputModal
          title="Log body fat %"
          placeholder="e.g. 14.2"
          value={newBF}
          onChange={setNewBF}
          onConfirm={addBF}
          onCancel={() => setShowAddBF(false)}
          keyboardType="decimal"
        />
      )}
      {showAddMuscleMass && (
        <QuickInputModal
          title="Log muscle mass %"
          placeholder="e.g. 42"
          value={newMuscleMass}
          onChange={setNewMuscleMass}
          onConfirm={addMuscleMass}
          onCancel={() => setShowAddMuscleMass(false)}
          keyboardType="decimal"
        />
      )}
      {showAddMeasurements && (
        <MeasurementsModal
          measurements={MEASUREMENTS}
          values={newMeasurements}
          onChange={setNewMeasurements}
          onConfirm={addMeasurements}
          onCancel={() => setShowAddMeasurements(false)}
          unitLength={unitLength}
        />
      )}

      {showPhotos && (
        <PhotosModal
          photoSessions={safePhotoSessions}
          setPhotoSessions={setPhotoSessions}
          totalPhotos={totalPhotos}
          atLimit={atLimit}
          progressPhotoBarUsed={progressPhotoBarUsed}
          progressPhotoBarCap={progressPhotoBarCap}
          onClose={() => {
            setShowPhotos(false)
            setOpenPhotosToAdd(false)
            onClearPhotoLinkTarget?.()
            if (returnToWorkoutAfterPhotoClose) onReturnToWorkoutAfterPhoto?.()
          }}
          weightLog={safeWeightLog}
          muscleMassLog={safeMuscleMassLog}
          unitWeight={unitWeight ?? 'kg'}
          formatDateForDisplay={formatDateForDisplay}
          openToAdd={openPhotosToAdd}
          onPhotoSessionCreated={
            photoLinkTargetSessionId && onPhotoSessionLinkedToWorkout
              ? (photoSessionId) => onPhotoSessionLinkedToWorkout(photoSessionId, photoLinkTargetSessionId)
              : undefined
          }
          onProgressPhotoAdded={onProgressPhotoAdded}
        />
      )}
    </div>
  )
}

function QuickInputModal({ title, placeholder, value, onChange, onConfirm, onCancel, keyboardType }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-10">
        <h2 className="text-base font-bold text-center mb-5">{title}</h2>
        <input
          type="text"
          inputMode={keyboardType === 'decimal' ? 'decimal' : 'numeric'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
          autoFocus
          className="w-full bg-card-alt border border-border-strong rounded-xl px-4 py-3 text-text placeholder-muted outline-none focus:border-accent text-center text-lg font-bold mb-4"
        />
        <button
          onClick={onConfirm}
          disabled={!value}
          className="w-full py-4 rounded-2xl font-bold text-sm mb-3 bg-gradient-to-r from-accent to-accent-end text-on-accent disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={onCancel} className="w-full py-3 text-sm font-semibold text-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}

function MeasurementsModal({ measurements, values, onChange, onConfirm, onCancel, unitLength = 'cm' }) {
  const unitLabel = unitLength === 'inch' ? 'inch' : 'cm'
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold text-center mb-5">Log measurements</h2>
        {measurements.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-text">{label}</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="—"
                value={values[key] ?? ''}
                onChange={(e) => onChange((prev) => ({ ...prev, [key]: e.target.value }))}
                onFocus={(e) => e.target.select()}
                className="w-20 bg-card-alt border border-border-strong rounded-xl px-3 py-2 text-center text-sm font-bold text-text outline-none focus:border-accent"
              />
              <span className="text-xs text-muted">{unitLabel}</span>
            </div>
          </div>
        ))}
        <button
          onClick={onConfirm}
          className="w-full py-4 rounded-2xl font-bold text-sm mt-4 mb-3 bg-gradient-to-r from-accent to-accent-end text-on-accent"
        >
          Save measurements
        </button>
        <button onClick={onCancel} className="w-full py-3 text-sm font-semibold text-muted">
          Cancel
        </button>
      </div>
    </div>
  )
}

function PhotoSessionThumb({ filename, label, onClick }) {
  const { user } = useAuth()
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!filename) return
    loadPhotoSrc(filename, user?.uid ?? null).then(setSrc).catch(() => {})
  }, [filename, user?.uid])

  return (
    <div
      onClick={onClick}
      className="aspect-[0.72] bg-card-deep rounded-[10px] flex items-center justify-center relative overflow-hidden cursor-pointer"
    >
      {src ? (
        <img src={src} alt={label} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[9px] font-bold text-muted uppercase tracking-[0.5px]">{label}</span>
      )}
      <span className="absolute bottom-1.5 left-0 right-0 text-center text-[8px] font-bold text-white/25 uppercase tracking-[0.4px]">
        {label}
      </span>
    </div>
  )
}
