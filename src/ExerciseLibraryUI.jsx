import { useState } from 'react'
import MuscleIcon from './MuscleIcon'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, TYPE_LABELS, filterExercises, groupByMuscle } from './exerciseLibrary'

const MUSCLE_KEYS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'mobility']

export default function ExerciseLibrary({ allExercises, mode = 'page', onAdd, onClose, onCreateCustom, onEditExercise }) {
  const [search, setSearch] = useState('')
  const [myOnly, setMyOnly] = useState(false)
  const [muscles, setMuscles] = useState([])
  const [equipment, setEquipment] = useState('all')
  const [selected, setSelected] = useState([]) // for modal multiselect

  const hasCustom = allExercises.some(e => e.isCustom)

  function toggleMuscle(m) {
    setMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  function toggleSelected(exName) {
    setSelected(prev => prev.includes(exName) ? prev.filter(x => x !== exName) : [...prev, exName])
  }

  function confirmAdd() {
    if (selected.length === 0) return
    const exs = selected.map(name => allExercises.find(e => e.name === name)).filter(Boolean)
    onAdd(exs)
    setSelected([])
  }

  const filtered = filterExercises(allExercises, { search, muscles, equipment, myOnly })
  const grouped = groupByMuscle(filtered)
  const totalCount = allExercises.length
  const customCount = allExercises.filter(e => e.isCustom).length

  const chipOff = 'bg-card-alt text-muted border-border-strong'
  const chipOn = 'bg-accent text-on-accent border-transparent'

  function muscleChipStyle(m, isActive) {
    const mg = MUSCLE_GROUPS[m]
    if (isActive) return { background: mg.color, color: '#fff', borderColor: 'transparent' }
    return { background: mg.bg, color: mg.color, borderColor: `${mg.color}33` }
  }

  const content = (
    <>
      {/* Search */}
      <div className="mb-3">
        <input type="text" placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card-alt border-[1.5px] border-border-strong rounded-xl px-4 py-2.5 text-sm text-text placeholder-muted-strong outline-none focus:border-accent transition-colors" />
      </div>

      {/* My exercises toggle */}
      <div className="flex bg-card-alt border-[1.5px] border-border-strong rounded-xl overflow-hidden mb-3">
        <button onClick={() => setMyOnly(false)} className={`flex-1 py-2.5 text-sm font-bold transition-all ${!myOnly ? 'bg-accent text-on-accent' : 'text-muted'}`}>All exercises</button>
        <button onClick={() => setMyOnly(true)} className={`flex-1 py-2.5 text-sm font-bold transition-all ${myOnly ? 'bg-success/15 text-success' : 'text-muted'}`}>My exercises{customCount > 0 ? ` (${customCount})` : ''}</button>
      </div>

      {/* Create custom */}
      <button onClick={onCreateCustom} className="flex items-center justify-center gap-1.5 w-full py-3 border-[1.5px] border-dashed border-success/40 rounded-xl text-success text-sm font-semibold mb-3 hover:bg-success/5 transition-colors">+ Create custom exercise</button>

      {/* Muscle group filter */}
      <div className="mb-2">
        <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Muscle Group</div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setMuscles([])}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold border-[1.5px] transition-all ${muscles.length === 0 ? chipOn : chipOff}`}>All</button>
          {MUSCLE_KEYS.map(m => (
            <button key={m} onClick={() => toggleMuscle(m)}
              className="px-2.5 py-1.5 rounded-lg text-sm font-semibold border-[1.5px] transition-all"
              style={muscleChipStyle(m, muscles.includes(m))}>
              {MUSCLE_GROUPS[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment filter */}
      <div className="mb-3">
        <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Equipment</div>
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => setEquipment('all')}
            className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold border-[1.5px] transition-all ${equipment === 'all' ? chipOn : chipOff}`}>All</button>
          {EQUIPMENT_TYPES.map(e => (
            <button key={e} onClick={() => setEquipment(equipment === e ? 'all' : e)}
              className={`px-2.5 py-1.5 rounded-lg text-sm font-semibold border-[1.5px] transition-all ${equipment === e ? chipOn : chipOff}`}>{e}</button>
          ))}
        </div>
      </div>

      <div className="border-t border-border my-2" />

      {/* Exercise list grouped by muscle */}
      {grouped.length === 0 && (
        <div className="text-center py-8">
          <div className="text-base text-muted-mid">No exercises found</div>
          <div className="text-sm text-muted-strong mt-1">Try adjusting your filters</div>
        </div>
      )}

      {grouped.map(([muscle, exs]) => {
        const mg = MUSCLE_GROUPS[muscle]
        return (
          <div key={muscle}>
            {/* Section header */}
            <div className="flex items-center gap-2 mt-3 mb-2">
              <MuscleIcon muscle={muscle} size={14} />
              <span className="text-sm font-bold uppercase tracking-wider" style={{ color: mg.color }}>{mg.label}</span>
              <span className="text-sm font-semibold text-muted-strong">{exs.length}</span>
            </div>

            {/* Exercise items */}
            {exs.map(ex => {
              const isSelected = selected.includes(ex.name)
              const typeLabel = TYPE_LABELS[ex.type] || 'Weight + Reps'

              return (
                <div key={ex.name}
                  onClick={() => mode === 'modal' ? toggleSelected(ex.name) : (onEditExercise && ex.isCustom ? onEditExercise(ex) : null)}
                  className={`flex items-center gap-3 bg-card border rounded-xl px-3 py-2.5 mb-1 cursor-pointer transition-all ${isSelected ? 'border-accent bg-accent/5' : 'border-border hover:border-accent'}`}>
                  <MuscleIcon muscle={ex.muscle} size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-text truncate">{ex.name}</span>
                      {ex.isCustom && <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-success/10 text-success uppercase tracking-wide shrink-0">Custom</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5 text-muted">{ex.equipment}</span>
                      <span className="text-xs font-semibold text-muted-strong">{typeLabel}</span>
                    </div>
                  </div>
                  {mode === 'modal' && (
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-[#7B7BFF] border-[#7B7BFF]' : 'bg-[#1C1C38] border-[1.5px] border-[#2A2A4A]'}`}>
                      {isSelected ? (
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5 stroke-white"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <span className="text-[#7B7BFF] text-base font-bold">+</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {mode === 'page' && <div style={{ height: 60 }} />}
    </>
  )

  // MODAL mode
  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
        <div className="w-full max-w-md bg-page rounded-t-3xl flex flex-col" style={{ maxHeight: '88vh' }}>
          {/* Header */}
          <div className="flex justify-between items-center px-5 pt-5 pb-2 shrink-0">
            <h2 className="text-lg font-bold">Add Exercise</h2>
            <button onClick={onClose} className="text-sm font-semibold text-muted-mid">Cancel</button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ scrollbarWidth: 'none' }}>
            {content}
          </div>

          {/* Floating add bar */}
          {selected.length > 0 && (
            <div className="px-5 pb-8 pt-3 shrink-0 border-t border-border">
              <button onClick={confirmAdd} className="w-full py-4 bg-gradient-to-r from-accent to-accent-end rounded-2xl font-bold text-sm shadow-lg shadow-accent/25 flex items-center justify-center gap-2">
                Add {selected.length} exercise{selected.length !== 1 ? 's' : ''}
                <span className="bg-white/20 text-text text-sm font-extrabold px-2 py-0.5 rounded-md">{selected.length}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // PAGE mode
  const logoSvg = <svg width="28" height="28" viewBox="0 0 100 100" className="shrink-0"><rect x="8" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9"/><rect x="54" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9"/><rect x="8" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7"/><rect x="54" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7"/><rect x="8" y="69" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.5"/><rect x="54" y="69" width="38" height="26" rx="8" fill="#5BF5A0" opacity="0.9"/></svg>

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">{logoSvg}<h1 className="text-3xl font-bold tracking-tight">Exercises</h1></div>
      <div className="text-sm text-[#7B7BFF] mb-4">{totalCount} exercises{customCount > 0 ? ` · ${customCount} custom` : ''}</div>
      {content}
    </div>
  )
}
