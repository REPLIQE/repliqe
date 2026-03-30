import { useState, useEffect } from 'react'
import { DeleteTrashBadge, DeleteTrashGlyph } from './DeleteConfirmTrashIcon'
import MuscleIcon from './MuscleIcon'
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, TYPE_LABELS } from './exerciseLibrary'

const MUSCLE_KEYS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'mobility']
const TYPE_KEYS = ['weight_reps', 'bw_reps', 'reps_only', 'time_only', 'distance_time']
const MOVEMENT_OPTIONS = [
  { id: 'push', label: 'Push' },
  { id: 'pull', label: 'Pull' },
]

export default function CreateExerciseModal({ onSave, onCancel, onDelete, editExercise = null }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('chest')
  const [equipment, setEquipment] = useState('Barbell')
  const [type, setType] = useState('weight_reps')
  const [movement, setMovement] = useState('push')
  const [showDelete, setShowDelete] = useState(false)

  const isEditing = !!editExercise

  useEffect(() => {
    if (editExercise) {
      setName(editExercise.name)
      setMuscle(editExercise.muscle)
      setEquipment(editExercise.equipment)
      setType(editExercise.type)
      setMovement(editExercise.movement || 'push')
    }
  }, [editExercise])

  // Auto-set movement from muscle group (except arms)
  useEffect(() => {
    if (muscle === 'arms') return
    const mg = MUSCLE_GROUPS[muscle]
    if (mg && mg.movement) setMovement(mg.movement)
  }, [muscle])

  const needsManualMovement = muscle === 'arms' || muscle === 'legs' || muscle === 'core'
  const canSave = name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    onSave({
      name: name.trim(),
      muscle,
      equipment,
      type,
      movement: muscle === 'core' ? null : movement,
      isCustom: true,
    })
  }

  const chipOff = 'bg-card-alt text-muted border-border-strong'
  const chipOn = 'bg-accent text-on-accent border-transparent'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-card rounded-t-3xl p-5 pb-10" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 className="text-lg font-bold text-center mb-1">{isEditing ? 'Edit Exercise' : 'Create Exercise'}</h2>
        <p className="text-sm text-muted-mid text-center mb-5">Define your custom exercise</p>

        {/* Name */}
        <div className="mb-4">
          <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Name</div>
          <input type="text" placeholder="e.g. Svend Press" value={name} onChange={e => setName(e.target.value)} autoFocus
            className="w-full bg-card-alt border-[1.5px] border-border-strong rounded-xl px-4 py-3 text-sm text-text placeholder-muted-deep outline-none focus:border-accent transition-colors" />
        </div>

        {/* Muscle group */}
        <div className="mb-4">
          <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Muscle Group</div>
          <div className="grid grid-cols-3 gap-1.5">
            {MUSCLE_KEYS.map(m => {
              const mg = MUSCLE_GROUPS[m]
              const active = muscle === m
              return (
                <button key={m} onClick={() => setMuscle(m)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border-[1.5px] transition-all ${active ? 'border-transparent' : 'border-border-strong bg-card-alt'}`}
                  style={active ? { background: mg.bg, borderColor: mg.color + '66', color: mg.color } : { color: '#888' }}>
                  <MuscleIcon muscle={m} size={12} />
                  {mg.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Equipment */}
        <div className="mb-4">
          <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Equipment</div>
          <div className="flex gap-1.5 flex-wrap">
            {EQUIPMENT_TYPES.map(e => (
              <button key={e} onClick={() => setEquipment(e)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border-[1.5px] transition-all ${equipment === e ? chipOn : chipOff}`}>{e}</button>
            ))}
          </div>
        </div>

        {/* Movement (only for arms, legs, core) */}
        {needsManualMovement && muscle !== 'core' && (
          <div className="mb-4">
            <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Movement</div>
            <div className="flex gap-1.5">
              {MOVEMENT_OPTIONS.map(m => (
                <button key={m.id} onClick={() => setMovement(m.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border-[1.5px] transition-all ${movement === m.id ? chipOn : chipOff}`}>{m.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Exercise type */}
        <div className="mb-5">
          <div className="text-xs font-bold text-muted-strong uppercase tracking-wider mb-1.5">Exercise Type</div>
          <div className="flex flex-col gap-1.5">
            {TYPE_KEYS.map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left border-[1.5px] transition-all ${type === t ? 'border-accent bg-accent/10 text-text' : 'border-border-strong bg-card-alt text-muted'}`}>
                <span className="text-sm font-semibold">{TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave}
          className={`w-full py-4 rounded-2xl font-bold text-sm mb-3 transition-all ${canSave ? 'bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25' : 'bg-card-alt text-muted-strong'}`}
          disabled={!canSave}>
          {isEditing ? 'Save changes' : 'Create exercise'}
        </button>

        {/* Delete (edit mode) */}
        {isEditing && onDelete && (
          <>
            {!showDelete ? (
              <button
                type="button"
                onClick={() => setShowDelete(true)}
                className="w-full py-3 text-sm font-semibold text-red-400 mb-1 inline-flex items-center justify-center gap-2"
              >
                <DeleteTrashGlyph className="w-4 h-4" />
                Delete exercise
              </button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-3">
                <DeleteTrashBadge className="!mb-3" />
                <p className="text-sm text-muted text-center mb-3">Delete "{editExercise.name}"? This cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onDelete(editExercise)}
                    className="flex-1 py-2.5 bg-red-500 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2"
                  >
                    <DeleteTrashGlyph className="w-4 h-4 text-white" />
                    Delete
                  </button>
                  <button type="button" onClick={() => setShowDelete(false)} className="flex-1 py-2.5 border border-border-strong rounded-xl text-sm font-semibold text-muted">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <button onClick={onCancel} className="w-full py-3 text-sm font-semibold text-muted-mid">Cancel</button>
      </div>
    </div>
  )
}
