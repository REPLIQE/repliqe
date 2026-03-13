import { useMemo } from 'react'
import { MUSCLE_GROUPS } from './exerciseLibrary'

// Web version: anatomisk-inspireret muscle map. Bruger jeres MUSCLE_GROUPS (chest, back, legs, shoulders, arms, core, cardio, mobility).
const COLOR_PRIMARY = '#5BF5A0'   // success – primary
const COLOR_SECONDARY = '#7B7BFF' // accent – secondary

const MUSCLE_LABELS = Object.fromEntries(
  Object.entries(MUSCLE_GROUPS).map(([id, g]) => [id, g.label])
)

export default function MuscleMapCard({ primary = [], secondary = [] }) {
  const list = useMemo(() => {
    const out = []
    secondary.forEach((muscleId) => { out.push({ id: muscleId, role: 'secondary' }) })
    primary.forEach((muscleId) => { out.push({ id: muscleId, role: 'primary' }) })
    return out
  }, [primary, secondary])

  if (list.length === 0) return null

  return (
    <div className="px-1 pt-3 pb-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-strong mb-2">Muscles today</div>
        <div className="flex flex-col gap-0.5">
          {list.map(({ id, role }) => (
            <div key={id} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: role === 'primary' ? COLOR_PRIMARY : COLOR_SECONDARY }}
              />
              <span
                className="text-[11px] font-semibold flex-1"
                style={{ color: role === 'primary' ? COLOR_PRIMARY : COLOR_SECONDARY }}
              >
                {MUSCLE_LABELS[id] ?? id}
              </span>
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded-md border"
                style={{
                  color: role === 'primary' ? COLOR_PRIMARY : COLOR_SECONDARY,
                  borderColor: role === 'primary' ? 'rgba(91,245,160,0.3)' : 'rgba(123,123,255,0.3)',
                  backgroundColor: role === 'primary' ? 'rgba(91,245,160,0.12)' : 'rgba(123,123,255,0.14)'
                }}
              >
                {role === 'primary' ? 'Primary' : 'Secondary'}
              </span>
            </div>
          ))}
        </div>
    </div>
  )
}
