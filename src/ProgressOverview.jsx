import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getTopMovers, sortPhotoSessionsByDate } from './progressUtils'
import { MUSCLE_COLOURS_HEX, getMuscleRecoveryPct, formatMuscleLabel } from './utils'
import PhotosModal from './PhotosModal'
import { TransformCard } from './TransformCard'

const TOTAL_FREE_PHOTOS = 12

/** Parse dd/mm/yyyy to Date or null */
function parseHistoryDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const parts = dateStr.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return isNaN(date.getTime()) ? null : date
}

/** Build 35 cells (5×7) for last ~5 weeks from Monday; history items have { date: 'dd/mm/yyyy' } */
function getLast30DaysGrid(workoutHistory) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells = []
  const start = new Date(today)
  start.setDate(start.getDate() - 34)
  while (start.getDay() !== 1) start.setDate(start.getDate() - 1)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 34)
  end.setHours(23, 59, 59, 999)

  const trainedDates = new Set(
    (workoutHistory || [])
      .map((w) => parseHistoryDate(w.date))
      .filter(Boolean)
      .map((d) => d.toDateString())
  )

  const current = new Date(start)
  while (current <= end) {
    const d = new Date(current)
    d.setHours(0, 0, 0, 0)
    cells.push({
      trained: trainedDates.has(d.toDateString()),
      istoday: d.toDateString() === today.toDateString(),
      isFuture: d > today,
    })
    current.setDate(current.getDate() + 1)
  }
  return cells
}

/** Total time in last 30 days; history has duration in seconds */
function getTotalTime(workoutHistory) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = (workoutHistory || []).filter((w) => {
    const d = parseHistoryDate(w.date)
    return d && d.getTime() >= thirtyDaysAgo
  })
  const totalSeconds = recent.reduce((sum, w) => sum + (Number(w.duration) || 0), 0)
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  return hours > 0 ? `${hours}h` : `${mins}m`
}

/** Volume (kg × reps) for done sets in last 30 days */
function getTotalVolume(workoutHistory) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = (workoutHistory || []).filter((w) => {
    const d = parseHistoryDate(w.date)
    return d && d.getTime() >= thirtyDaysAgo
  })
  const total = recent.reduce((sum, w) => {
    return (
      sum +
      (w.exercises || []).reduce((eSum, ex) => {
        return (
          eSum +
          (ex.sets || [])
            .filter((s) => s.done)
            .reduce((sSum, s) => sSum + Number(s.kg || 0) * Number(s.reps || 0), 0)
        )
      }, 0)
    )
  }, 0)
  return total >= 1000 ? `${Math.round(total / 1000)}k` : `${total}`
}

export default function ProgressOverview({
  history,
  muscleLastWorked,
  weekStreak,
  weightLog,
  bodyFatLog,
  muscleMassLog,
  photoSessions,
  setPhotoSessions,
  unitWeight,
  onGoToTab,
  onGoToBody,
}) {
  const [showPhotos, setShowPhotos] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [showAllHistory, setShowAllHistory] = useState(false)

  const safeHistory = Array.isArray(history) ? history : []
  const safeWeightLog = Array.isArray(weightLog) ? weightLog : []
  const safeBodyFatLog = Array.isArray(bodyFatLog) ? bodyFatLog : []
  const safeMuscleMassLog = Array.isArray(muscleMassLog) ? muscleMassLog : []
  const safePhotoSessions = Array.isArray(photoSessions) ? photoSessions : []
  const sortedPhotoSessions = sortPhotoSessionsByDate(safePhotoSessions)
  const safeMuscleLastWorked = muscleLastWorked && typeof muscleLastWorked === 'object' ? muscleLastWorked : {}

  const last30Days = getLast30DaysGrid(safeHistory)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const totalWorkouts = (safeHistory || []).filter((w) => {
    const d = parseHistoryDate(w.date)
    return d && d.getTime() >= thirtyDaysAgo
  }).length
  const totalTimeFormatted = getTotalTime(safeHistory)
  const volumeFormatted = getTotalVolume(safeHistory)

  const movers = getTopMovers(safeHistory, 2)

  const latestWeight = safeWeightLog.length > 0 ? safeWeightLog[safeWeightLog.length - 1] : null
  const firstWeight = safeWeightLog.length > 0 ? safeWeightLog[0] : null
  const latestBF = safeBodyFatLog.length > 0 ? safeBodyFatLog[safeBodyFatLog.length - 1] : null
  const latestMuscleMass = safeMuscleMassLog.length > 0 ? safeMuscleMassLog[safeMuscleMassLog.length - 1] : null
  const firstMuscleMass = safeMuscleMassLog.length > 0 ? safeMuscleMassLog[0] : null

  const OVERVIEW_MUSCLES = ['chest', 'back', 'quads', 'side-delts', 'biceps', 'triceps', 'glutes', 'abs']
  const CIRC = 2 * Math.PI * 18

  const oldestSession = sortedPhotoSessions.length > 0 ? sortedPhotoSessions[sortedPhotoSessions.length - 1] : null
  const newestSession = sortedPhotoSessions.length > 0 ? sortedPhotoSessions[0] : null
  const sessionA = oldestSession
  const sessionB = newestSession

  return (
    <div className="flex flex-col gap-0">
      <button
        type="button"
        onClick={() => onGoToTab?.('Strength')}
        className="progress-section-label text-left w-full cursor-pointer hover:opacity-80 transition-opacity"
      >
        Last 30 Days
      </button>
      <button
        type="button"
        onClick={() => onGoToTab?.('Strength')}
        className="activity-card w-full text-left cursor-pointer hover:opacity-95 transition-opacity border-0 rounded-[14px]"
      >
        <div className="activity-body">
          <div className="activity-grid-side">
            <div className="activity-grid-days">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => (
                <div key={d} className="activity-grid-day-label">
                  {d}
                </div>
              ))}
            </div>
            <div className="activity-grid">
              {last30Days.map((day, i) => (
                <div
                  key={i}
                  className={`activity-cell ${day.trained ? 'active' : ''} ${day.istoday ? 'today' : ''}`}
                />
              ))}
            </div>
          </div>
          <div className="activity-stats-side">
            <div className="activity-stat-box">
              <div className="activity-stat-v">{totalWorkouts}</div>
              <div className="activity-stat-l">Workouts</div>
            </div>
            <div className="activity-stat-box">
              <div className="activity-stat-v">{totalTimeFormatted}</div>
              <div className="activity-stat-l">Total Time</div>
            </div>
            <div className="activity-stat-box green">
              <div className="activity-stat-v">{volumeFormatted}</div>
              <div className="activity-stat-l">Volume (kg)</div>
            </div>
          </div>
        </div>
      </button>

      {movers.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => onGoToTab?.('Strength')}
            className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
          >
            Strength · top movers
          </button>
          {movers.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => onGoToTab?.('Strength')}
              className="w-full bg-card border border-border rounded-[14px] p-[13px_14px] mb-[6px] flex items-center justify-between text-left cursor-pointer hover:border-accent/30 transition-colors"
            >
              <div>
                <div className="text-[14px] font-bold text-text">{m.name}</div>
                <div className="text-[10px] text-muted mt-0.5">
                  {m.currentE1RM} {unitWeight} · est. max
                </div>
              </div>
              <div className={`rounded-[6px] px-[10px] py-[4px] text-[12px] font-extrabold ${
                m.pct > 0 ? 'bg-[rgba(91,245,160,0.09)] border border-[rgba(91,245,160,0.2)] text-success' : 'bg-card-alt border border-border text-muted'
              }`}>
                {m.pct > 0 ? `↑ +${m.pct}%` : m.pct < 0 ? `↓ ${m.pct}%` : '—'}
              </div>
            </button>
          ))}
        </>
      )}

      {(latestWeight || latestMuscleMass) && (
        <>
          <button
            type="button"
            onClick={() => onGoToTab?.('Body')}
            className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
          >
            Body
          </button>
          <button
            type="button"
            onClick={() => onGoToTab?.('Body')}
            className="grid grid-cols-2 gap-2 mb-2 w-full text-left cursor-pointer hover:opacity-95 transition-opacity border-0 p-0 bg-transparent"
          >
            {latestWeight && (
              <StatTile
                val={latestWeight.value}
                unit={unitWeight}
                label="Weight"
                delta={firstWeight && firstWeight !== latestWeight ? latestWeight.value - firstWeight.value : null}
                deltaLabel="since start"
                invertDelta
              />
            )}
            {latestMuscleMass && (
              <StatTile
                val={latestMuscleMass.value}
                unit="%"
                label="Muscle mass"
                delta={firstMuscleMass ? latestMuscleMass.value - firstMuscleMass.value : null}
                deltaLabel="since start"
              />
            )}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={() => onGoToBody?.()}
        className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
      >
        Photos
      </button>
      <TransformCard
        sessionA={sessionA}
        sessionB={sessionB}
        sortedSessions={sortedPhotoSessions}
        compareAId={oldestSession?.id}
        compareBId={newestSession?.id}
        onSelectA={() => {}}
        onSelectB={() => {}}
        showComparePicker={null}
        onShowComparePicker={() => {}}
        onOpen={() => setShowPhotos(true)}
        onGoToBody={onGoToBody}
        photoSessions={safePhotoSessions}
        fixedCompare={true}
        weightLog={safeWeightLog}
        muscleMassLog={safeMuscleMassLog}
        unitWeight={unitWeight ?? 'kg'}
      />

      <button
        type="button"
        onClick={() => onGoToTab?.('Recovery')}
        className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
      >
        Recovery · now
      </button>
      <button
        type="button"
        onClick={() => onGoToTab?.('Recovery')}
        className="grid grid-cols-4 gap-[5px] mb-2 w-full text-left cursor-pointer hover:opacity-95 transition-opacity border-0 p-0 bg-transparent"
      >
        {OVERVIEW_MUSCLES.map((slug) => {
          const pct = getMuscleRecoveryPct(slug, safeMuscleLastWorked[slug] ?? null)
          const colour = MUSCLE_COLOURS_HEX[slug] ?? '#888'
          const offset = CIRC * (1 - pct / 100)
          return (
            <div
              key={slug}
              className="bg-card border border-border rounded-[12px] py-[10px] px-[5px] flex flex-col items-center gap-[5px]"
            >
              <div className="relative w-[40px] h-[40px]">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4" />
                  <circle
                    cx="20"
                    cy="20"
                    r="18"
                    fill="none"
                    stroke={colour}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={offset}
                    transform="rotate(-90 20 20)"
                  />
                </svg>
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] font-extrabold text-white">
                  {pct}%
                </span>
              </div>
              <span className="text-[8px] font-bold text-muted uppercase tracking-[0.4px] text-center">
                {formatMuscleLabel(slug)}
              </span>
            </div>
          )
        })}
      </button>

      <button
        type="button"
        onClick={() => onGoToTab?.('Strength')}
        className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
      >
        Workout history
      </button>
      {safeHistory.length === 0 ? (
        <div className="text-sm text-muted italic mb-4">No workouts yet</div>
      ) : (
        <>
          {safeHistory.slice(0, 5).map((w, i) => (
            <WorkoutHistoryRow
              key={w.date + (w.name || '') + i}
              workout={w}
              unitWeight={unitWeight}
              onClick={() => setSelectedWorkout(w)}
            />
          ))}
          {safeHistory.length > 5 && (
            <button
              onClick={() => setShowAllHistory(true)}
              className="w-full py-2.5 text-[12px] font-semibold text-accent text-center mb-2"
            >
              See full workout history ({safeHistory.length})
            </button>
          )}
        </>
      )}

      {selectedWorkout && (
        <WorkoutDetailSheet
          workout={selectedWorkout}
          unitWeight={unitWeight}
          onClose={() => setSelectedWorkout(null)}
        />
      )}

      {showAllHistory && (
        <AllHistorySheet
          history={safeHistory}
          unitWeight={unitWeight}
          onSelect={(w) => {
            setSelectedWorkout(w)
            setShowAllHistory(false)
          }}
          onClose={() => setShowAllHistory(false)}
        />
      )}

      {showPhotos && (
        <PhotosModal
          photoSessions={safePhotoSessions}
          setPhotoSessions={setPhotoSessions}
          totalPhotos={safePhotoSessions.reduce((sum, s) => sum + [s.front, s.back, s.side].filter(Boolean).length, 0)}
          atLimit={safePhotoSessions.reduce((sum, s) => sum + [s.front, s.back, s.side].filter(Boolean).length, 0) >= TOTAL_FREE_PHOTOS}
          onClose={() => setShowPhotos(false)}
          weightLog={safeWeightLog}
          muscleMassLog={safeMuscleMassLog}
          unitWeight={unitWeight ?? 'kg'}
        />
      )}
    </div>
  )
}

function StatTile({ val, unit, label, delta, deltaLabel, invertDelta }) {
  const isPositive = delta > 0
  const isGood = invertDelta ? !isPositive : isPositive
  return (
    <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
      <div className="text-[20px] font-extrabold text-text leading-none">
        {val}
        <span className="text-[10px] text-muted font-semibold ml-0.5">{unit}</span>
      </div>
      <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">{label}</div>
      {delta != null && delta !== 0 && (
        <div className={`text-[10px] font-bold mt-1 ${isGood ? 'text-success' : 'text-[#ff6b6b]'}`}>
          {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)} {unit} {deltaLabel}
        </div>
      )}
    </div>
  )
}

function relDate(dateStr) {
  if (!dateStr) return ''
  const parts = (dateStr || '').split('/')
  if (parts.length !== 3) return dateStr
  const d = new Date(parts[2], parts[1] - 1, parts[0])
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 14) return '1 week ago'
  if (diff < 30) return `${Math.floor(diff / 7)} weeks ago`
  return dateStr
}

function WorkoutHistoryRow({ workout, unitWeight, onClick }) {
  const doneSets = (workout.exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).filter((s) => s.done).length,
    0
  )
  const volume = (workout.exercises || []).reduce(
    (sum, ex) =>
      sum +
      (ex.sets || [])
        .filter((s) => s.done)
        .reduce((v, s) => v + Number(s.kg || 0) * Number(s.reps || 0), 0),
    0
  )
  const mins = workout.duration ? Math.floor(workout.duration / 60) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-card border border-border rounded-[14px] p-[13px_14px] mb-[6px] text-left"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[14px] font-bold text-text truncate mr-2">
          {workout.name || workout.date}
        </span>
        <span className="text-[11px] text-muted shrink-0">{relDate(workout.date)}</span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-muted">
        {mins != null && <span>{mins} min</span>}
        <span>{doneSets} sets</span>
        {volume > 0 && (
          <span>{volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume} {unitWeight}</span>
        )}
      </div>
    </button>
  )
}

function WorkoutDetailSheet({ workout, unitWeight, onClose }) {
  const doneSets = (workout.exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).filter((s) => s.done).length,
    0
  )
  const volume = (workout.exercises || []).reduce(
    (sum, ex) =>
      sum +
      (ex.sets || [])
        .filter((s) => s.done)
        .reduce((v, s) => v + Number(s.kg || 0) * Number(s.reps || 0), 0),
    0
  )
  const mins = workout.duration ? Math.floor(workout.duration / 60) : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-end justify-center">
      <div className="w-full max-w-md bg-page rounded-t-[20px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-[17px] font-extrabold text-text">
              {workout.name || workout.date}
            </h2>
            <p className="text-[11px] text-muted mt-0.5">{workout.date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-card-alt flex items-center justify-center text-muted text-sm"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 py-4 shrink-0">
          {mins != null && (
            <div className="bg-card border border-border rounded-[12px] p-3 text-center">
              <div className="text-[18px] font-extrabold text-text">{mins}</div>
              <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-0.5">Min</div>
            </div>
          )}
          <div className="bg-card border border-border rounded-[12px] p-3 text-center">
            <div className="text-[18px] font-extrabold text-text">{doneSets}</div>
            <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-0.5">Sets</div>
          </div>
          {volume > 0 && (
            <div className="bg-card border border-border rounded-[12px] p-3 text-center">
              <div className="text-[18px] font-extrabold text-text">
                {volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume}
              </div>
              <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-0.5">
                {unitWeight} vol
              </div>
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 px-5 pb-8">
          {(workout.exercises || []).map((ex, i) => {
            const done = (ex.sets || []).filter((s) => s.done)
            if (!done.length) return null
            return (
              <div key={i} className="mb-4">
                <div className="text-[13px] font-bold text-text mb-1.5">{ex.name}</div>
                {done.map((s, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 py-1 border-b border-border last:border-0"
                  >
                    <span className="text-[11px] text-muted w-6">{j + 1}</span>
                    <span className="text-[12px] font-semibold text-text">
                      {s.kg ? `${s.kg} ${unitWeight}` : ''}
                      {s.kg && s.reps ? ' × ' : ''}
                      {s.reps ? `${s.reps} reps` : ''}
                      {s.time ? s.time : ''}
                      {s.distance ? `${s.distance} km` : ''}
                    </span>
                    {s.rir !== undefined && s.rir !== null && (
                      <span className="ml-auto text-[10px] text-muted">RIR {s.rir}</span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ROW_HEIGHT_ESTIMATE = 76

function AllHistorySheet({ history, unitWeight, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const parentRef = useRef(null)

  const filtered = search
    ? history.filter(
        (w) =>
          (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
          (w.date || '').includes(search)
      )
    : history

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 8,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[4px] z-50 flex items-end justify-center">
      <div className="w-full max-w-md bg-page rounded-t-[20px] max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className="text-[17px] font-extrabold text-text">Workout history</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-card-alt flex items-center justify-center text-muted text-sm"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 shrink-0">
          <div className="bg-card border border-border rounded-[12px] p-[10px_14px] flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-muted shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workouts..."
              className="bg-transparent text-[13px] text-text placeholder-muted outline-none flex-1"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="text-muted text-sm">
                ✕
              </button>
            )}
          </div>
        </div>

        <div ref={parentRef} className="overflow-y-auto flex-1 min-h-0 px-5 pb-8">
          {filtered.length === 0 ? (
            <div className="text-sm text-muted italic text-center py-8">No workouts found</div>
          ) : (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualRow) => {
                const w = filtered[virtualRow.index]
                return (
                  <div
                    key={w.date + (w.name || '') + virtualRow.index}
                    className="absolute left-0 top-0 w-full pr-0"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <WorkoutHistoryRow
                      workout={w}
                      unitWeight={unitWeight}
                      onClick={() => onSelect(w)}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
