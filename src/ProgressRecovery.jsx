import { MUSCLE_COLOURS_HEX, getMuscleRecoveryPct, formatMuscleLabel } from './utils'

const ALL_SLUGS = [
  'chest',
  'front-delts',
  'triceps',
  'back',
  'lats',
  'traps',
  'lower-back',
  'biceps',
  'forearms',
  'side-delts',
  'rear-delts',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'obliques',
]

const CIRC = 2 * Math.PI * 18

function getMuscleFrequency(history, allLibraryExercises) {
  const now = Date.now()
  const MS_4W = 28 * 86400000
  const counts = {}
  const safeHistory = Array.isArray(history) ? history : []
  const safeLib = Array.isArray(allLibraryExercises) ? allLibraryExercises : []

  for (const w of safeHistory) {
    const parts = (w.date || '').split('/')
    if (parts.length !== 3) continue
    const d = new Date(parts[2], parts[1] - 1, parts[0])
    if (now - d.getTime() > MS_4W) continue

    for (const ex of w.exercises || []) {
      const doneSets = (ex.sets || []).filter((s) => s.done === true)
      if (!doneSets.length) continue
      const lib = safeLib.find((e) => e.name === ex.name)
      const primary = lib?.muscles?.primary ?? []
      primary.forEach((slug) => {
        counts[slug] = (counts[slug] ?? 0) + 1
      })
    }
  }

  return counts
}

export default function ProgressRecovery({ muscleLastWorked, history, allLibraryExercises }) {
  const safeMuscleLastWorked = muscleLastWorked && typeof muscleLastWorked === 'object' ? muscleLastWorked : {}
  const freq = getMuscleFrequency(history, allLibraryExercises || [])
  const maxFreq = Math.max(...Object.values(freq), 1)

  const freqEntries = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div>
      <div className="sec">All muscle groups · now</div>
      <div className="grid grid-cols-4 gap-[5px] mb-4">
        {ALL_SLUGS.map((slug) => {
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
              <span className="text-[7.5px] font-bold text-muted uppercase tracking-[0.3px] text-center leading-tight">
                {formatMuscleLabel(slug)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="sec">Frequency · last 4 weeks</div>
      {freqEntries.length === 0 ? (
        <div className="text-sm text-muted italic mb-4">No data yet — complete some workouts first</div>
      ) : (
        <div className="bg-card border border-border rounded-[14px] overflow-hidden mb-8">
          {freqEntries.map(([slug, count], i) => {
            const colour = MUSCLE_COLOURS_HEX[slug] ?? '#888'
            const fillPct = Math.round((count / maxFreq) * 100)
            const isLow = count <= 2
            return (
              <div
                key={slug}
                className={`flex items-center justify-between p-[10px_14px] ${
                  i < freqEntries.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ background: colour }}
                  />
                  <span className="text-[12px] font-semibold text-text capitalize">
                    {formatMuscleLabel(slug)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-[64px] h-[4px] bg-[rgba(255,255,255,0.06)] rounded-[2px] overflow-hidden">
                    <div
                      className="h-full rounded-[2px]"
                      style={{ width: `${fillPct}%`, background: colour }}
                    />
                  </div>
                  <span
                    className="text-[11px] font-extrabold min-w-[22px] text-right"
                    style={{ color: isLow ? '#ff6b6b' : '#fff' }}
                  >
                    {count}×
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
