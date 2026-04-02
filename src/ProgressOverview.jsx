import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { getTopMovers, comparePhotoSessionsByDateDesc, sortPhotoSessionsByDate } from './progressUtils'
import { MUSCLE_COLOURS_HEX, getMuscleRecoveryPct, formatMuscleLabel } from './utils'
import { getExerciseSlugs } from './exerciseLibrary'
import StrengthVolumeSection from './StrengthVolumeSection'
import PhotosModal from './PhotosModal'
import { loadPhotoSrc } from './PhotosModal'
import ProgressPhoto from './ProgressPhoto'
import { TransformCard } from './TransformCard'
import { useAuth } from './lib/AuthContext'
import { defaultPlanUsage, photoAtLimit, countProgressPhotoSlots } from './lib/planUsage'
import BottomSheet from './BottomSheet'
import {
  CARD_SURFACE,
  CARD_SURFACE_INTERACTIVE,
  CARD_SURFACE_SM,
  CARD_ROW_PAD,
  CARD_ROW_PAD_TIGHT,
} from './cardTokens'
import {
  TYPE_CAPTION,
  TYPE_LABEL_UPPER,
  TYPE_LABEL_MICRO,
  TYPE_META,
  TYPE_MICRO,
  TYPE_MICRO_TIGHT,
  TYPE_BODY,
  TYPE_BODY_SM,
  TYPE_BODY_SM_SEMIBOLD,
  TYPE_TITLE_ROW,
  TYPE_NUMBER_COMPACT,
  TYPE_SHEET_TITLE,
  TYPE_DISPLAY,
  TYPE_STAT_NUMBER,
  TYPE_UNIT_SUFFIX,
  TYPE_SUBTITLE,
  TYPE_EMPHASIS_SM,
  TYPE_OVERLINE,
  TYPE_RING_PCT,
} from './typographyTokens'

const PHOTO_ANGLES = [{ key: 'front', label: 'Front' }, { key: 'back', label: 'Back' }, { key: 'side', label: 'Side' }]

const RATING_LABELS = ['Terrible', 'Low', 'OK', 'Good', 'Great']
function getRatingLabel(rating) {
  if (rating == null || rating < 1 || rating > 5) return null
  return RATING_LABELS[rating - 1]
}
/** Only show rating UI when a rating was actually given (1–5). */
function hasValidRating(workout) {
  const r = workout?.rating
  return r != null && r >= 1 && r <= 5
}

/** Parse dd/mm/yyyy to Date or null */
function parseHistoryDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const parts = dateStr.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return isNaN(date.getTime()) ? null : date
}

/** Get log entry at or most recent before date (dd/mm/yyyy). Log entries have { date, value }. */
function getLogValueAtOrBefore(log, dateStr) {
  const workoutDate = parseHistoryDate(dateStr)
  if (!workoutDate || !Array.isArray(log) || log.length === 0) return null
  const onOrBefore = log
    .map((e) => ({ ...e, parsed: parseHistoryDate(e.date) }))
    .filter((e) => e.parsed && e.parsed.getTime() <= workoutDate.getTime())
  if (onOrBefore.length === 0) return null
  onOrBefore.sort((a, b) => b.parsed.getTime() - a.parsed.getTime())
  return { value: onOrBefore[0].value, date: onOrBefore[0].date }
}

/** Weight trend: last N entries on or before dateStr, oldest first (for chart). */
function getWeightTrendBefore(weightLog, dateStr, maxPoints = 14) {
  const workoutDate = parseHistoryDate(dateStr)
  if (!workoutDate || !Array.isArray(weightLog)) return []
  const onOrBefore = weightLog
    .map((e) => ({ date: e.date, value: e.value, parsed: parseHistoryDate(e.date) }))
    .filter((e) => e.parsed && e.parsed.getTime() <= workoutDate.getTime())
  onOrBefore.sort((a, b) => a.parsed.getTime() - b.parsed.getTime())
  return onOrBefore.slice(-maxPoints)
}

/** Photo sessions on or within a few days of dateStr. */
function getPhotoSessionsAround(photoSessions, dateStr, max = 3) {
  const workoutDate = parseHistoryDate(dateStr)
  if (!workoutDate || !Array.isArray(photoSessions)) return []
  const withParsed = photoSessions
    .filter((s) => s && s.date)
    .map((s) => ({ ...s, parsed: parseHistoryDate(s.date) }))
    .filter((s) => s.parsed)
  const nearby = withParsed.filter((s) => {
    const diff = Math.abs(s.parsed.getTime() - workoutDate.getTime())
    return diff <= 4 * 24 * 60 * 60 * 1000
  })
  nearby.sort(comparePhotoSessionsByDateDesc)
  return nearby.slice(0, max)
}

/** Live grid: kompakt 5×7 (se styring i index.css `.activity-*`). Mockups: `/progress-grid-previews.html`. */

/** Build exactly 35 cells (5 weeks × 7 days); weekStart 0=Mon..6=Sun. Window chosen so it includes today. */
function getLast30DaysGrid(workoutHistory, weekStart = 0) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells = []
  const targetDay = weekStart === 6 ? 0 : weekStart + 1
  const start = new Date(today)
  start.setDate(start.getDate() - 34)
  while (start.getDay() !== targetDay) start.setDate(start.getDate() + 1)
  if (start > today) start.setDate(start.getDate() - 7)
  start.setHours(0, 0, 0, 0)

  const trainedDates = new Set(
    (workoutHistory || [])
      .map((w) => parseHistoryDate(w.date))
      .filter(Boolean)
      .map((d) => d.toDateString())
  )

  for (let i = 0; i < 35; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    cells.push({
      trained: trainedDates.has(d.toDateString()),
      istoday: d.toDateString() === today.toDateString(),
      isFuture: d > today,
    })
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

/** Parse kg (accepts comma or period as decimal). */
function parseKg(v) {
  if (v === '' || v == null) return 0
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isNaN(n) ? 0 : n
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
            .reduce((sSum, s) => sSum + parseKg(s.kg) * Number(s.reps || 0), 0)
        )
      }, 0)
    )
  }, 0)
  if (total >= 1000) {
    return `${Math.round(total / 1000)}k`
  }
  return String(Math.round(total))
}

export default function ProgressOverview({
  history,
  muscleLastWorked,
  weekStreak,
  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  weekStart = 0,
  weightLog,
  bodyFatLog,
  muscleMassLog,
  photoSessions,
  setPhotoSessions,
  unitWeight,
  formatDecimal,
  parseDecimal,
  formatDateForDisplay,
  onGoToTab,
  onGoToBody,
  allLibraryExercises = [],
  userPlan = 'free',
  planUsage: planUsageProp,
  onProgressPhotoAdded,
  onProgressPhotoRemoved,
}) {
  const planUsage = planUsageProp ?? defaultPlanUsage()
  const fmtDate = formatDateForDisplay ?? ((d) => d ?? '')
  const fmt = formatDecimal ?? ((n) => (n != null ? String(n) : '—'))
  const toNum = (v) => { const n = parseDecimal ? parseDecimal(v) : parseFloat(String(v).replace(',', '.')); return Number.isNaN(n) ? 0 : n }
  const [showPhotos, setShowPhotos] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [showAllHistory, setShowAllHistory] = useState(false)

  const safeHistory = Array.isArray(history) ? history : []
  const safeWeightLog = Array.isArray(weightLog) ? weightLog : []
  const safeBodyFatLog = Array.isArray(bodyFatLog) ? bodyFatLog : []
  const safeMuscleMassLog = Array.isArray(muscleMassLog) ? muscleMassLog : []
  const safePhotoSessions = Array.isArray(photoSessions) ? photoSessions : []
  const overviewPhotoTotal = countProgressPhotoSlots(safePhotoSessions)
  const overviewPhotoAtLimit = photoAtLimit(userPlan, overviewPhotoTotal, planUsage)
  const overviewPhotoBarUsed = overviewPhotoTotal
  const overviewPhotoBarCap = userPlan === 'elite' ? null : userPlan === 'pro' ? 50 : 12
  const sortedPhotoSessions = sortPhotoSessionsByDate(safePhotoSessions)
  const safeMuscleLastWorked = muscleLastWorked && typeof muscleLastWorked === 'object' ? muscleLastWorked : {}

  const last30Days = getLast30DaysGrid(safeHistory, weekStart)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const totalWorkouts = (safeHistory || []).filter((w) => {
    const d = parseHistoryDate(w.date)
    return d && d.getTime() >= thirtyDaysAgo
  }).length
  const totalTimeFormatted = getTotalTime(safeHistory)
  const volumeFormatted = getTotalVolume(safeHistory)

  const movers = getTopMovers(safeHistory, 2)

  /** Workouts with rating, newest first; take last 14 for chart (then reverse so oldest is left). */
  const ratingSeries = (safeHistory || [])
    .filter((w) => w.rating != null && w.rating >= 1 && w.rating <= 5)
    .slice(0, 14)
    .map((w) => ({ date: w.date, rating: w.rating, name: w.name }))
  const ratingChartData = [...ratingSeries].reverse()
  const avgRating = ratingSeries.length > 0
    ? ratingSeries.reduce((s, w) => s + w.rating, 0) / ratingSeries.length
    : null
  const lastRating = ratingSeries.length > 0 ? ratingSeries[0].rating : null

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
    <div className="overview-sections flex flex-col -mt-4">
      <div className="overview-section">
        <button
          type="button"
          onClick={() => onGoToTab?.('Strength', { strengthSection: 'volume' })}
          className="progress-section-label text-left w-full cursor-pointer hover:opacity-80 transition-opacity"
        >
          Last 5 weeks
        </button>
        <button
          type="button"
          onClick={() => onGoToTab?.('Strength', { strengthSection: 'volume' })}
          className={`${CARD_SURFACE} w-full text-left cursor-pointer hover:opacity-95 transition-opacity p-3`}
        >
        <div className="activity-body">
          <div className="activity-grid-side">
            <div className="activity-grid-days">
              {(weekDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((d) => (
                <div key={d} className="activity-grid-day-label">
                  {d.charAt(0)}
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
      </div>

      {ratingChartData.length > 0 && (
        <div className="overview-section">
          <div className="sec text-left w-full">
            Motivation
          </div>
          <div className={`w-full ${CARD_SURFACE} p-4 text-left`}>
            <div className="flex items-end justify-between gap-1 mb-2">
              {lastRating != null && (
                <span className={TYPE_MICRO}>Latest: <span className="font-bold text-accent">{getRatingLabel(lastRating)}</span></span>
              )}
              {avgRating != null && (
                <span className={TYPE_MICRO}>Avg: <span className="font-bold text-text">{avgRating.toFixed(1)}</span></span>
              )}
            </div>
            <div className="flex items-end gap-[3px] h-10" style={{ minHeight: '40px' }}>
              {ratingChartData.map((w, i) => (
                <div
                  key={(w.date || '') + (w.name || '') + i}
                  className="flex-1 min-w-0 rounded-t-[3px] bg-accent/40 hover:bg-accent/60 transition-colors"
                  style={{ height: `${(w.rating / 5) * 100}%`, minHeight: '4px' }}
                  title={`${fmtDate(w.date)} · ${getRatingLabel(w.rating)}`}
                />
              ))}
            </div>
            <p className={`${TYPE_CAPTION} mt-1.5 uppercase tracking-wider`}>Change over time (last {ratingChartData.length} workouts)</p>
          </div>
        </div>
      )}

      <div className="overview-section">
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
        formatDateForDisplay={formatDateForDisplay}
      />
      </div>

      {(latestWeight || latestMuscleMass) && (
        <div className="overview-section">
          <button
            type="button"
            onClick={() => onGoToTab?.('Body', { bodySection: 'weight' })}
            className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
          >
            Body
          </button>
          <button
            type="button"
            onClick={() => onGoToTab?.('Body', { bodySection: 'weight' })}
            className="grid grid-cols-2 gap-2 w-full text-left cursor-pointer hover:opacity-95 transition-opacity border-0 p-0 bg-transparent"
          >
            {latestWeight && (
              <StatTile
                val={fmt(latestWeight.value)}
                unit={unitWeight}
                label="Weight"
                delta={firstWeight && firstWeight !== latestWeight ? latestWeight.value - firstWeight.value : null}
                deltaLabel="since start"
                invertDelta
                formatDecimal={formatDecimal}
              />
            )}
            {latestMuscleMass && (
              <StatTile
                val={fmt(latestMuscleMass.value)}
                unit="%"
                label="Muscle mass"
                delta={firstMuscleMass ? latestMuscleMass.value - firstMuscleMass.value : null}
                deltaLabel="since start"
                formatDecimal={formatDecimal}
              />
            )}
          </button>
        </div>
      )}

      <div className="overview-section">
        <StrengthVolumeSection history={safeHistory} allLibraryExercises={allLibraryExercises} unitWeight={unitWeight} onGoToStrength={() => onGoToTab?.('Strength', { strengthSection: 'volume' })} />
      </div>

      {movers.length > 0 && (
        <div className="overview-section">
          <button
            type="button"
            onClick={() => onGoToTab?.('Strength', { strengthSection: 'topMovers' })}
            className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
          >
            Strength · top movers
          </button>
          {movers.map((m) => (
            <button
              key={m.name}
              type="button"
              onClick={() => onGoToTab?.('Strength', { strengthSection: 'topMovers' })}
              className={`w-full ${CARD_SURFACE_INTERACTIVE} ${CARD_ROW_PAD} mb-[6px] flex items-center justify-between text-left cursor-pointer last:mb-0`}
            >
              <div>
                <div className={TYPE_TITLE_ROW}>{m.name}</div>
                <div className={`${TYPE_META} mt-0.5`}>
                  {m.currentE1RM} {unitWeight} · est. max
                </div>
              </div>
              <div className={`rounded-[6px] px-[10px] py-[4px] ${TYPE_BODY_SM} font-extrabold ${
                m.pct > 0 ? 'bg-[rgba(91,245,160,0.09)] border border-[rgba(91,245,160,0.2)] text-success' : 'bg-card-alt border border-border text-muted'
              }`}>
                {m.pct > 0 ? `↑ +${m.pct}%` : m.pct < 0 ? `↓ ${m.pct}%` : '—'}
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="overview-section">
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
          className="grid grid-cols-4 gap-[5px] w-full text-left cursor-pointer hover:opacity-95 transition-opacity border-0 p-0 bg-transparent"
        >
        {OVERVIEW_MUSCLES.map((slug) => {
          const pct = getMuscleRecoveryPct(slug, safeMuscleLastWorked[slug] ?? null)
          const colour = MUSCLE_COLOURS_HEX[slug] ?? '#888'
          const offset = CIRC * (1 - pct / 100)
          return (
            <div
              key={slug}
              className={`${CARD_SURFACE_SM} py-[10px] px-[5px] flex flex-col items-center gap-[5px]`}
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
                <span className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${TYPE_RING_PCT}`}>
                  {pct}%
                </span>
              </div>
              <span className={TYPE_LABEL_MICRO}>
                {formatMuscleLabel(slug)}
              </span>
            </div>
          )
        })}
      </button>
      </div>

      <div className="overview-section">
        <button
          type="button"
          onClick={() => onGoToTab?.('Strength', { strengthSection: 'volume' })}
          className="sec text-left w-full cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
        >
          Workout history
        </button>
        {safeHistory.length === 0 ? (
          <div className="text-sm text-muted italic">No workouts yet</div>
        ) : (
        <>
          {safeHistory.slice(0, 5).map((w, i) => (
            <WorkoutHistoryRow
              key={w.date + (w.name || '') + i}
              workout={w}
              unitWeight={unitWeight}
              formatDecimal={formatDecimal}
              toNum={toNum}
              formatDateForDisplay={formatDateForDisplay}
              onClick={() => setSelectedWorkout(w)}
            />
          ))}
          {safeHistory.length > 5 && (
            <button
              onClick={() => setShowAllHistory(true)}
              className={`w-full py-2.5 ${TYPE_BODY_SM_SEMIBOLD} text-accent text-center mb-2`}
            >
              See full workout history ({safeHistory.length})
            </button>
          )}
        </>
        )}
      </div>

      {selectedWorkout && (
        <WorkoutDetailSheet
          workout={selectedWorkout}
          unitWeight={unitWeight}
          formatDecimal={formatDecimal}
          toNum={toNum}
          formatDateForDisplay={formatDateForDisplay}
          weightLog={safeWeightLog}
          muscleMassLog={safeMuscleMassLog}
          bodyFatLog={safeBodyFatLog}
          photoSessions={safePhotoSessions}
          allLibraryExercises={allLibraryExercises}
          onClose={() => setSelectedWorkout(null)}
        />
      )}

      {showAllHistory && (
        <AllHistorySheet
          history={safeHistory}
          unitWeight={unitWeight}
          formatDecimal={formatDecimal}
          toNum={toNum}
          formatDateForDisplay={formatDateForDisplay}
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
          totalPhotos={overviewPhotoTotal}
          atLimit={overviewPhotoAtLimit}
          progressPhotoBarUsed={overviewPhotoBarUsed}
          progressPhotoBarCap={overviewPhotoBarCap}
          onClose={() => setShowPhotos(false)}
          weightLog={safeWeightLog}
          muscleMassLog={safeMuscleMassLog}
          unitWeight={unitWeight ?? 'kg'}
          onProgressPhotoAdded={onProgressPhotoAdded}
          onProgressPhotoRemoved={onProgressPhotoRemoved}
        />
      )}
    </div>
  )
}

function StatTile({ val, unit, label, delta, deltaLabel, invertDelta, formatDecimal }) {
  const isPositive = delta > 0
  const isGood = invertDelta ? !isPositive : isPositive
  const fmtDelta = formatDecimal ? (n) => formatDecimal(n, 1) : (n) => Number(n).toFixed(1)
  return (
    <div className={`${CARD_SURFACE} ${CARD_ROW_PAD_TIGHT}`}>
      <div className={TYPE_DISPLAY}>
        {val}
        <span className={`${TYPE_UNIT_SUFFIX} ml-0.5`}>{unit}</span>
      </div>
      <div className={`${TYPE_LABEL_UPPER} mt-1`}>{label}</div>
      {delta != null && delta !== 0 && (
        <div className={`${TYPE_EMPHASIS_SM} mt-1 ${isGood ? 'text-success' : 'text-[#ff6b6b]'}`}>
          {delta > 0 ? '↑' : '↓'} {fmtDelta(Math.abs(delta))} {unit} {deltaLabel}
        </div>
      )}
    </div>
  )
}

function WorkoutHistoryRow({ workout, unitWeight, formatDecimal, toNum, formatDateForDisplay, onClick }) {
  if (!workout || typeof workout !== 'object') return null
  const fmt = formatDecimal ?? ((n) => (n != null ? String(n) : '—'))
  const num = toNum ?? ((v) => Number(v) || 0)
  const displayDate = formatDateForDisplay ? formatDateForDisplay(workout.date) : workout.date
  const doneSets = (workout.exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).filter((s) => s.done).length,
    0
  )
  const volume = (workout.exercises || []).reduce(
    (sum, ex) =>
      sum +
      (ex.sets || [])
        .filter((s) => s.done)
        .reduce((v, s) => v + num(s.kg) * Number(s.reps || 0), 0),
    0
  )
  const mins = workout.duration ? Math.floor(workout.duration / 60) : null
  const volStr = volume >= 1000
    ? `${(formatDecimal && formatDecimal(volume / 1000, 2)) ?? Number(volume / 1000).toFixed(2)}k`
    : (formatDecimal && formatDecimal(volume, 2)) ?? (volume != null ? Number(volume).toFixed(2) : '—')
  const totalRestSec = (workout.exercises || []).reduce(
    (sum, ex) => sum + (ex.sets || []).reduce((s, set) => s + (Number(set.restTime ?? set.rest_time) || 0), 0),
    0
  )
  const restMins = totalRestSec > 0 ? Math.round(totalRestSec / 60) : 0
  const ratingLabel = hasValidRating(workout) ? getRatingLabel(workout.rating) : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full ${CARD_SURFACE_INTERACTIVE} ${CARD_ROW_PAD} mb-[6px] text-left`}
    >
      <div className="flex gap-3 items-baseline pb-1.5 border-b border-border">
        <span className={`${TYPE_MICRO} shrink-0 w-[72px] tabular-nums`} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {displayDate}
        </span>
        <span className={`${TYPE_TITLE_ROW} !font-semibold truncate min-w-0 flex-1`}>
          {workout.name || displayDate}
        </span>
      </div>
      <div className={`grid grid-cols-[3rem_2.5rem_4rem_5rem_1fr] gap-x-3 gap-y-0 mt-1.5 ${TYPE_MICRO} items-center`}>
        {mins != null && <span className="tabular-nums text-right">{mins} min</span>}
        <span className="tabular-nums text-right">{doneSets} sets</span>
        {volume > 0 ? <span className="tabular-nums text-right">{volStr} {unitWeight}</span> : <span />}
        {restMins > 0 ? <span className="tabular-nums text-right">{restMins} min rest</span> : <span />}
        {ratingLabel ? <span className={`${TYPE_SUBTITLE} truncate`}>Motivation: {ratingLabel}</span> : <span />}
      </div>
    </button>
  )
}

function PhotoThumbSmall({ filename, date }) {
  const { user } = useAuth()
  const [src, setSrc] = useState(null)
  useEffect(() => {
    if (!filename) return
    loadPhotoSrc(filename, user?.uid ?? null).then(setSrc).catch(() => {})
  }, [filename, user?.uid])
  return (
    <div className="aspect-[3/4] rounded-lg bg-card-deep overflow-hidden shrink-0 border border-border flex items-center justify-center">
      {src ? (
        <img src={src} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className={TYPE_CAPTION}>{date || '—'}</span>
        </div>
      )}
    </div>
  )
}

/** Shows the 3 angles (front, back, side) for a session with cropped display. */
function SessionPhotosCropped({ session, dateLabel }) {
  const { user } = useAuth()
  const [srcs, setSrcs] = useState({ front: null, back: null, side: null })
  useEffect(() => {
    if (!session) return
    setSrcs({ front: null, back: null, side: null })
    const uid = user?.uid ?? null
    PHOTO_ANGLES.forEach(({ key }) => {
      const file = session[key]
      if (!file) return
      loadPhotoSrc(file, uid).then((src) => setSrcs((prev) => ({ ...prev, [key]: src }))).catch(() => {})
    })
  }, [user?.uid, session?.id, session?.front, session?.back, session?.side])
  return (
    <div className="shrink-0">
      <div className={`${TYPE_MICRO_TIGHT} font-bold uppercase tracking-[0.5px] mb-1 text-center`}>{dateLabel}</div>
      <div className="flex gap-1.5">
        {PHOTO_ANGLES.map(({ key, label }) => {
          const file = session?.[key]
          const src = srcs[key]
          const crop = session?.crops?.[key]
          return (
            <div key={key} className="flex-1 min-w-0 flex flex-col items-center gap-0.5">
              <div className="w-full rounded-lg overflow-hidden border border-border bg-card-deep">
                {file && src ? (
                  <ProgressPhoto key={`${session?.id}-${key}-${file}`} src={src} crop={crop} className="w-full rounded-lg" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className={TYPE_MICRO_TIGHT}>—</span>
                  </div>
                )}
              </div>
              <span className={TYPE_MICRO_TIGHT}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WorkoutDetailSheet({ workout, unitWeight, formatDecimal, toNum, formatDateForDisplay, weightLog = [], muscleMassLog = [], bodyFatLog = [], photoSessions = [], allLibraryExercises = [], onClose }) {
  const fmt = formatDecimal ?? ((n) => (n != null ? String(n) : '—'))
  const num = toNum ?? ((v) => Number(v) || 0)
  const displayDate = formatDateForDisplay ? formatDateForDisplay(workout.date) : workout.date
  const exercises = workout.exercises || []
  const exerciseCount = exercises.length
  const doneSets = exercises.reduce(
    (sum, ex) => sum + (ex.sets || []).filter((s) => s.done).length,
    0
  )
  const volume = exercises.reduce(
    (sum, ex) =>
      sum +
      (ex.sets || [])
        .filter((s) => s.done)
        .reduce((v, s) => v + num(s.kg) * Number(s.reps || 0), 0),
    0
  )
  const mins = workout.duration ? Math.floor(workout.duration / 60) : null
  const volStr = volume >= 1000
    ? `${(formatDecimal && formatDecimal(volume / 1000, 2)) ?? Number(volume / 1000).toFixed(2)}k`
    : (formatDecimal && formatDecimal(volume, 2)) ?? (volume != null ? Number(volume).toFixed(2) : '—')

  const muscleSlugs = [...new Set(
    exercises.flatMap((ex) => {
      const lib = (allLibraryExercises || []).find((e) => e.name === ex.name)
      return getExerciseSlugs(lib)
    })
  )].filter(Boolean)

  const weightThen = getLogValueAtOrBefore(weightLog, workout.date)
  const muscleThen = getLogValueAtOrBefore(muscleMassLog, workout.date)
  const bodyFatThen = getLogValueAtOrBefore(bodyFatLog, workout.date)
  const weightTrend = getWeightTrendBefore(weightLog, workout.date, 14)
  // Max 1 fotosession pr. WO: kun eksplicit link (ingen same-day fallback — flere WO samme dag må ikke dele/vise samme pool).
  const photosThen = (() => {
    const ids = Array.isArray(workout.photoSessionIds) ? workout.photoSessionIds.slice(0, 1) : []
    if (ids.length === 0) return []
    const sessions = ids.map((id) => (photoSessions || []).find((s) => s.id === id)).filter(Boolean)
    return sessions
  })()
  const weightMax = weightTrend.length ? Math.max(...weightTrend.map((p) => p.value)) : 0
  const weightMin = weightTrend.length ? Math.min(...weightTrend.map((p) => p.value)) : 0
  const weightRange = weightMax - weightMin || 1

  const hasContext = weightThen || muscleThen || bodyFatThen || weightTrend.length > 1 || photosThen.length > 0

  return (
    <BottomSheet onClose={onClose} zClass="z-50" variant="page" layout="flex" padding="none" closeOnBackdrop={false} showHandle={false} panelClassName="max-h-[90vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className={`${TYPE_SHEET_TITLE} !font-semibold`}>
              {workout.name || displayDate}
            </h2>
            <p className={`${TYPE_MICRO} mt-0.5`}>{displayDate}</p>
            {hasValidRating(workout) && (
              <p className={`${TYPE_SUBTITLE} mt-1`}>Motivation: {getRatingLabel(workout.rating)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-card-alt flex items-center justify-center text-muted text-sm"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 flex flex-col">
          <div className="grid grid-cols-4 gap-2 px-5 py-4 shrink-0">
            <div className={`${CARD_SURFACE_SM} p-3 text-center`}>
              <div className={TYPE_STAT_NUMBER}>{exerciseCount}</div>
              <div className={`${TYPE_LABEL_UPPER} mt-0.5`}>Exercises</div>
            </div>
            <div className={`${CARD_SURFACE_SM} p-3 text-center`}>
              <div className={TYPE_STAT_NUMBER}>{doneSets}</div>
              <div className={`${TYPE_LABEL_UPPER} mt-0.5`}>Sets</div>
            </div>
            <div className={`${CARD_SURFACE_SM} p-3 text-center`}>
              <div className={TYPE_STAT_NUMBER}>{mins != null ? mins : '—'}</div>
              <div className={`${TYPE_LABEL_UPPER} mt-0.5`}>Min</div>
            </div>
            <div className={`${CARD_SURFACE_SM} p-3 text-center`}>
              <div className={TYPE_STAT_NUMBER}>{volume > 0 ? volStr : '—'}</div>
              <div className={`${TYPE_LABEL_UPPER} mt-0.5`}>{unitWeight} vol</div>
            </div>
          </div>

          {muscleSlugs.length > 0 && (
          <div className="px-5 pb-4 shrink-0">
            <div className={`${TYPE_OVERLINE} mb-2`}>Muscles trained</div>
            <div className="flex flex-wrap gap-1.5">
              {muscleSlugs.map((slug) => {
                const colour = MUSCLE_COLOURS_HEX[slug] ?? '#888'
                const hex = colour.replace('#', '')
                const r = parseInt(hex.slice(0, 2), 16)
                const g = parseInt(hex.slice(2, 4), 16)
                const b = parseInt(hex.slice(4, 6), 16)
                const bg = `rgba(${r},${g},${b},0.1)`
                const border = `rgba(${r},${g},${b},0.3)`
                return (
                  <span
                    key={slug}
                    className={`flex items-center justify-center rounded-full py-[7px] px-2.5 ${TYPE_MICRO} font-bold border truncate`}
                    style={{ backgroundColor: bg, borderColor: border, color: colour }}
                  >
                    {formatMuscleLabel(slug)}
                  </span>
                )
              })}
            </div>
          </div>
          )}

          {hasContext && (
          <div className="px-5 pb-4 shrink-0 border-b border-border">
            <div className={`${TYPE_OVERLINE} mb-2`}>At that time</div>
            <div className="flex gap-2 flex-wrap items-start">
              {weightThen && (
                <div className={`${CARD_SURFACE_SM} px-3 py-2 min-w-[72px]`}>
                  <div className={TYPE_NUMBER_COMPACT}>{fmt(weightThen.value)}</div>
                  <div className={TYPE_LABEL_UPPER}>{unitWeight}</div>
                </div>
              )}
              {muscleThen && (
                <div className={`${CARD_SURFACE_SM} px-3 py-2 min-w-[72px]`}>
                  <div className={TYPE_NUMBER_COMPACT}>{fmt(muscleThen.value)}%</div>
                  <div className={TYPE_LABEL_UPPER}>Muscle</div>
                </div>
              )}
              {bodyFatThen && (
                <div className={`${CARD_SURFACE_SM} px-3 py-2 min-w-[72px]`}>
                  <div className={TYPE_NUMBER_COMPACT}>{fmt(bodyFatThen.value)}%</div>
                  <div className={TYPE_LABEL_UPPER}>Body fat</div>
                </div>
              )}
            </div>
            {weightTrend.length > 1 && (
              <div className="mt-3">
                <div className={`${TYPE_LABEL_UPPER} mb-1`}>Weight trend</div>
                <div className="flex items-end gap-0.5 h-[44px]">
                  {weightTrend.map((p, i) => {
                    const heightPct = 15 + ((weightMax - p.value) / weightRange) * 70
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-[2px] min-w-0"
                        style={{
                          height: `${100 - heightPct}%`,
                          background: i === weightTrend.length - 1 ? 'rgba(91,245,160,0.9)' : `rgba(91,245,160,${0.2 + (i / weightTrend.length) * 0.6})`,
                        }}
                        title={`${formatDateForDisplay ? formatDateForDisplay(p.date) : p.date} ${p.value}`}
                      />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className={TYPE_MICRO_TIGHT}>{weightTrend[0]?.date != null && formatDateForDisplay ? formatDateForDisplay(weightTrend[0].date) : weightTrend[0]?.date}</span>
                  <span className={TYPE_MICRO_TIGHT}>{weightTrend[weightTrend.length - 1]?.date != null && formatDateForDisplay ? formatDateForDisplay(weightTrend[weightTrend.length - 1].date) : weightTrend[weightTrend.length - 1]?.date}</span>
                </div>
              </div>
            )}
            {photosThen.length > 0 && (
              <div className="mt-3">
                <div className={`${TYPE_LABEL_UPPER} mb-2`}>Photos</div>
                <div className="flex flex-col gap-3">
                  {photosThen.map((s) => (
                    <SessionPhotosCropped
                      key={s.id}
                      session={s}
                      dateLabel={formatDateForDisplay ? formatDateForDisplay(s.date) : s.date}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          )}

          <div className="px-5 pb-8 pt-3 shrink-0">
          <div className={`${TYPE_OVERLINE} mb-2`}>Exercises</div>
          {(workout.exercises || []).map((ex, i) => {
            const done = (ex.sets || []).filter((s) => s.done)
            if (!done.length) return null
            return (
              <div key={i} className="mb-4">
                <div className={`${TYPE_BODY} font-semibold mb-1.5`}>{ex.name}</div>
                {done.map((s, j) => {
                  const restSec = Number(s.restTime ?? s.rest_time ?? 0) || 0
                  const restTimeStr = restSec > 0
                    ? `${String(Math.floor(restSec / 60)).padStart(2, '0')}:${String(restSec % 60).padStart(2, '0')}`
                    : null
                  const hasRir = s.rir !== undefined && s.rir !== null
                  return (
                    <div
                      key={j}
                      className="grid grid-cols-[1.5rem_1fr_3.5rem_2.5rem] gap-x-3 items-center py-1 border-b border-border last:border-0"
                    >
                      <span className={TYPE_MICRO}>{j + 1}</span>
                      <span className={`${TYPE_BODY_SM_SEMIBOLD} min-w-0 truncate`}>
                        {s.kg != null && s.kg !== '' ? `${(formatDecimal && formatDecimal(num(s.kg), 2)) ?? fmt(num(s.kg))} ${unitWeight}` : ''}
                        {s.kg != null && s.kg !== '' && s.reps ? ' × ' : ''}
                        {s.reps ? `${s.reps} reps` : ''}
                        {s.time ? s.time : ''}
                        {s.distance ? `${s.distance} km` : ''}
                      </span>
                      <span className={`flex items-center gap-1 ${TYPE_META} min-w-0`}>
                        {restTimeStr ? (
                          <>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-70 shrink-0">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span className="tabular-nums">{restTimeStr}</span>
                          </>
                        ) : (
                          <span className="text-muted/60">—</span>
                        )}
                      </span>
                      <span className={TYPE_META}>
                        {hasRir ? `RIR ${s.rir}` : <span className="text-muted/60">—</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          </div>
        </div>
    </BottomSheet>
  )
}

const ROW_HEIGHT_ESTIMATE = 76

function AllHistorySheet({ history = [], unitWeight, formatDecimal, toNum, formatDateForDisplay, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const [scrollReady, setScrollReady] = useState(false)
  const parentRef = useRef(null)
  const safeHistory = Array.isArray(history) ? history : []
  const filtered = search
    ? safeHistory.filter(
        (w) =>
          (w && ((w.name || '').toLowerCase().includes(search.toLowerCase()) || (w.date || '').includes(search)))
      )
    : safeHistory

  useLayoutEffect(() => {
    setScrollReady(true)
  }, [])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 8,
  })
  const virtualItems = scrollReady ? virtualizer.getVirtualItems() : []

  return (
    <BottomSheet onClose={onClose} zClass="z-50" variant="page" layout="flex" padding="none" closeOnBackdrop={false} showHandle={false} panelClassName="max-h-[92vh]">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
          <h2 className={`${TYPE_SHEET_TITLE} !font-semibold`}>Workout history</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-card-alt flex items-center justify-center text-muted text-sm"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-3 shrink-0">
          <div className={`${CARD_SURFACE_SM} p-[10px_14px] flex items-center gap-2`}>
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
              className={`bg-transparent ${TYPE_BODY} placeholder-muted outline-none flex-1`}
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
          ) : scrollReady && virtualItems.length > 0 ? (
            <div
              className="relative w-full"
              style={{ height: `${virtualizer.getTotalSize()}px` }}
            >
              {virtualItems.map((virtualRow) => {
                const w = filtered[virtualRow.index]
                if (!w) return null
                return (
                  <div
                    key={(w.date || '') + (w.name || '') + virtualRow.index}
                    className="absolute left-0 top-0 w-full pr-0"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <WorkoutHistoryRow
                      workout={w}
                      unitWeight={unitWeight}
                      formatDecimal={formatDecimal}
                      toNum={toNum}
                      formatDateForDisplay={formatDateForDisplay}
                      onClick={() => onSelect(w)}
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            filtered.map((w, i) => {
              if (!w) return null
              return (
                <div key={(w.date || '') + (w.name || '') + i} className="mb-[6px]">
                  <WorkoutHistoryRow
                    workout={w}
                    unitWeight={unitWeight}
                    formatDecimal={formatDecimal}
                    toNum={toNum}
                    formatDateForDisplay={formatDateForDisplay}
                    onClick={() => onSelect(w)}
                  />
                </div>
              )
            })
          )}
        </div>
    </BottomSheet>
  )
}
