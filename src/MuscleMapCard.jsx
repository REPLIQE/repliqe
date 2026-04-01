import { useMemo } from 'react'
import { MUSCLE_GROUPS } from './exerciseLibrary'
import { formatMuscleLabel } from './utils'
import { TYPE_BODY_SM_SEMIBOLD, TYPE_CAPTION, TYPE_LABEL_UPPER } from './typographyTokens'

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
      <div className={`${TYPE_LABEL_UPPER} text-muted-strong tracking-wider mb-2`}>Muscles today</div>
      <div className="flex flex-col gap-0.5">
        {list.map(({ id, role }) => {
          const mg = MUSCLE_GROUPS[id]
          const color = mg?.color ?? 'rgba(255,255,255,0.5)'
          const bg = mg?.bg ?? 'rgba(255,255,255,0.05)'
          const borderColor = mg ? `${color}4D` : 'rgba(255,255,255,0.1)'
          return (
            <div key={id} className="flex items-center gap-2 py-1 border-b border-white/5 last:border-0">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className={`${TYPE_BODY_SM_SEMIBOLD} flex-1`} style={{ color }}>{mg?.label ?? formatMuscleLabel(id)}</span>
              <span className={`${TYPE_CAPTION} font-bold px-2 py-0.5 rounded-md border`} style={{ color, borderColor, backgroundColor: bg }}>
                {role === 'primary' ? 'Primary' : 'Secondary'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
