import { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { MUSCLE_GROUPS, SLUG_TO_GROUP, getExerciseSlugs } from './exerciseLibrary'
import { CARD_SURFACE_LG } from './cardTokens'
import { TYPE_BODY_SM, TYPE_OVERLINE_STRONG, TYPE_STAT_NUMBER, TYPE_TAB } from './typographyTokens'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip)

const PERIODS = ['4W', '3M', '6M', 'All']
const PERIOD_MS = { '4W': 28 * 86400000, '3M': 90 * 86400000, '6M': 180 * 86400000, 'All': Infinity }
const PERIOD_LABELS = { '4W': 'last 4 weeks', '3M': 'last 3 months', '6M': 'last 6 months', 'All': 'all time' }

function parseHistoryDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const parts = dateStr.trim().split('/')
  if (parts.length !== 3) return null
  const [d, m, y] = parts.map((x) => parseInt(x, 10))
  const date = new Date(y, m - 1, d)
  return isNaN(date.getTime()) ? null : date
}

function sessionVolume(workout, allLibraryExercises) {
  let vol = 0
  for (const ex of workout.exercises || []) {
    for (const s of ex.sets || []) {
      if (!s.done) continue
      const kg = parseFloat(String(s.kg || 0).replace(',', '.')) || 0
      const reps = parseInt(s.reps, 10) || 0
      vol += kg * reps
    }
  }
  return vol
}

function getMuscleGroupForExercise(exerciseName, allLibraryExercises) {
  const lib = (allLibraryExercises || []).find((e) => e.name === exerciseName)
  if (!lib) return null
  const slugs = getExerciseSlugs(lib)
  if (slugs.length) return SLUG_TO_GROUP[slugs[0]] || lib.muscle || null
  return lib.muscle || null
}

function groupByPeriod(sessions, period) {
  const buckets = {}
  const now = Date.now()
  sessions.forEach((s) => {
    const date = s.date
    let key = ''
    if (period === '4W') {
      const weekNum = Math.floor((now - date.getTime()) / (7 * 24 * 60 * 60 * 1000))
      key = `W${Math.max(0, 4 - weekNum)}`
    } else if (period === '3M' || period === '6M') {
      key = date.toLocaleString('default', { month: 'short' })
    } else {
      key = `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
    }
    buckets[key] = (buckets[key] ?? 0) + (s.volumeKg ?? 0)
  })
  const labels = Object.keys(buckets).sort()
  const data = labels.map((l) => Math.round(buckets[l]))
  return { labels, data }
}

const BREAKDOWN_COLORS = {
  chest: '#7f77dd',
  back: '#4ade80',
  legs: '#60a5fa',
  shoulders: '#f9a8d4',
  arms: '#fbbf24',
  core: '#a78bfa',
  cardio: '#fb923c',
  mobility: '#34d399',
}

export default function StrengthVolumeSection({
  history = [],
  allLibraryExercises = [],
  unitWeight = 'kg',
  onGoToStrength,
  formatDecimal,
}) {
  const [period, setPeriod] = useState('4W')
  const [muscleGroup, setMuscleGroup] = useState('All')
  const isCompact = typeof onGoToStrength === 'function'

  const sessionsWithVolume = useMemo(() => {
    const list = Array.isArray(history) ? history : []
    const now = Date.now()
    const cutoff = now - (PERIOD_MS[period] || PERIOD_MS['6M'])
    return list
      .map((w) => {
        const date = parseHistoryDate(w.date)
        if (!date || date.getTime() < cutoff) return null
        const volumeKg = sessionVolume(w, allLibraryExercises)
        const exercisesWithMuscle = (w.exercises || []).map((ex) => ({
          ...ex,
          muscleGroup: getMuscleGroupForExercise(ex.name, allLibraryExercises),
          volume: (ex.sets || [])
            .filter((s) => s.done)
            .reduce((sum, s) => sum + (parseFloat(String(s.kg || 0).replace(',', '.')) || 0) * (parseInt(s.reps, 10) || 0), 0),
        }))
        return { date, volumeKg, exercises: exercisesWithMuscle }
      })
      .filter(Boolean)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [history, period, allLibraryExercises])

  const filteredByMuscle = useMemo(() => {
    if (muscleGroup === 'All') return sessionsWithVolume
    return sessionsWithVolume.filter((s) =>
      s.exercises?.some((e) => e.muscleGroup === muscleGroup)
    )
  }, [sessionsWithVolume, muscleGroup])

  const prevPeriodSessions = useMemo(() => {
    const now = Date.now()
    const currentStart = period === 'All' ? 0 : now - (PERIOD_MS[period] || PERIOD_MS['6M'])
    const prevStart = period === '4W' ? now - 56 * 86400000 : period === '3M' ? now - 180 * 86400000 : period === '6M' ? now - 365 * 86400000 : 0
    return sessionsWithVolume.filter((s) => {
      const t = s.date.getTime()
      return t >= prevStart && t < currentStart
    })
  }, [sessionsWithVolume, period])

  const totalVolume = filteredByMuscle.reduce((sum, s) => sum + (s.volumeKg ?? 0), 0)
  const prevVolume = prevPeriodSessions.reduce((sum, s) => sum + (s.volumeKg ?? 0), 0)
  const delta = prevVolume > 0 ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : 0

  const { labels, data: chartData } = useMemo(
    () => groupByPeriod(filteredByMuscle, period),
    [filteredByMuscle, period]
  )

  const breakdown = useMemo(() => {
    const groupVolumes = {}
    filteredByMuscle.forEach((s) => {
      s.exercises?.forEach((e) => {
        const g = e.muscleGroup
        if (!g) return
        groupVolumes[g] = (groupVolumes[g] ?? 0) + (e.volume ?? 0)
      })
    })
    const total = Object.values(groupVolumes).reduce((a, b) => a + b, 0) || 1
    return Object.entries(groupVolumes)
      .map(([g, vol]) => ({
        group: g,
        label: MUSCLE_GROUPS[g]?.label ?? g,
        percent: Math.round((vol / total) * 100),
        color: BREAKDOWN_COLORS[g] ?? '#6b7280',
      }))
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5)
  }, [filteredByMuscle])

  const totalFormatted =
    totalVolume >= 1000
      ? `${formatDecimal ? formatDecimal(totalVolume / 1000, 1) : (totalVolume / 1000).toFixed(1)}k`
      : String(Math.round(totalVolume))

  const lineChartData = {
    labels,
    datasets: [{
      data: chartData,
      borderColor: '#4ade80',
      backgroundColor: 'rgba(74,222,128,0.08)',
      borderWidth: 2,
      pointRadius: 4,
      pointBackgroundColor: '#4ade80',
      tension: 0.4,
      fill: true,
    }],
  }

  const lineChartOptions = useMemo(() => {
    const maxV = chartData.length ? Math.max(...chartData) : 0
    const stepSize =
      maxV <= 0 ? 1000 : Math.max(1000, Math.ceil(maxV / 4 / 1000) * 1000)
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 9 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            color: 'rgba(255,255,255,0.35)',
            font: { size: 9 },
            stepSize,
            callback: (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v),
          },
        },
      },
    }
  }, [chartData])

  const donutData = {
    labels: breakdown.map((b) => b.label),
    datasets: [{
      data: breakdown.map((b) => b.percent),
      backgroundColor: breakdown.map((b) => b.color),
      borderWidth: 0,
    }],
  }

  const muscleKeys = ['All', ...Object.keys(MUSCLE_GROUPS)]

  const content = (
    <>
      <p className={`${TYPE_OVERLINE_STRONG} mb-2`}>Volume over time</p>

      {!isCompact && (
        <>
          {/* Muscle group pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 scrollbar-none">
            {muscleKeys.map((g) => {
              const isActive = muscleGroup === g
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setMuscleGroup(g)}
                  className={`shrink-0 min-h-[36px] px-3 py-2 rounded-lg border ${TYPE_TAB} flex items-center justify-center transition-colors ${
                    isActive
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border-strong bg-card-alt text-muted-strong hover:border-accent/50'
                  }`}
                >
                  {g === 'All' ? 'All' : MUSCLE_GROUPS[g]?.label ?? g}
                </button>
              )
            })}
          </div>

          {/* Period */}
          <div className="flex gap-1.5 mb-3">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={
                  `flex-1 min-h-[36px] py-2 px-3 rounded-lg border ${TYPE_TAB} flex items-center justify-center transition-colors ` +
                  (period === p
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border-strong bg-card-alt text-muted-strong hover:border-accent/50')
                }
              >
                {p}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Hero card */}
      <div className={`${CARD_SURFACE_LG} p-4 mb-4`}>
          <p className={TYPE_STAT_NUMBER}>{totalFormatted} {unitWeight}</p>
        <p className="text-xs text-muted mt-0.5">Total volume · {PERIOD_LABELS[period]}</p>
        <p className={`text-xs font-semibold mt-1 ${delta >= 0 ? 'text-success' : 'text-red-400'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% vs previous period
        </p>
        {labels.length > 0 ? (
          <div className="h-[140px] mt-3">
            <Line data={lineChartData} options={lineChartOptions} />
          </div>
        ) : (
          <p className="text-sm text-muted mt-3">Log workouts to see volume over time.</p>
        )}
      </div>

      {/* Breakdown */}
      {breakdown.length > 0 && (
        <div className={`${CARD_SURFACE_LG} p-4 mb-4`}>
          <p className={`${TYPE_OVERLINE_STRONG} mb-3`}>Volume by muscle group</p>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 shrink-0">
              <Doughnut
                data={donutData}
                options={{ cutout: '68%', plugins: { legend: { display: false } } }}
              />
            </div>
            <div className="flex-1 min-w-0">
              {breakdown.map((b) => (
                <div key={b.group} className="flex items-center justify-between gap-2 py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                    <span className="text-sm font-medium text-text truncate">{b.label}</span>
                  </div>
                  <span className="text-sm font-bold text-muted-strong shrink-0">{b.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )

  if (isCompact) {
    return (
      <button
        type="button"
        onClick={onGoToStrength}
        className="mt-0 mb-0 w-full text-left cursor-pointer hover:opacity-95 active:opacity-90 transition-opacity rounded-2xl focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--a11y-focus-ring)]"
      >
        {content}
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-xs text-muted">Tap to filter by period and muscle group</p>
          <span className={`shrink-0 text-accent ${TYPE_BODY_SM} leading-none`} aria-hidden>
            →
          </span>
        </div>
      </button>
    )
  }

  return <div className="mt-6">{content}</div>
}
