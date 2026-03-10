import { useState, useRef } from 'react'
import MuscleIcon from './MuscleIcon'
import { MUSCLE_GROUPS } from './exerciseLibrary'

const REST_PRESETS = [0, 30, 60, 90, 120, 180]

function ExerciseCard({ exercise, exIndex, isEditing, exerciseCount, onMoveUp, onMoveDown, onRemoveExercise, onAddSet, onUpdateSet, onDoneSet, onUndoneSet, onDeleteSet, onUpdateExerciseRest, onUpdateExerciseNote, bestSet, previousSets, activeRest, restTime, restDuration, defaultRest, bodyweight, unitWeight, unitDistance, libraryEntry }) {
  const [showRestPicker, setShowRestPicker] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showExerciseMenu, setShowExerciseMenu] = useState(false)
  const [swipedSet, setSwipedSet] = useState(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const touchDeltaRef = useRef(0)
  const isSwipingRef = useRef(false)
  const rowRefs = useRef({})

  const type = exercise.type || 'weight_reps'

  function formatTime(seconds) { const m = Math.floor(seconds/60); const s = String(seconds%60).padStart(2,'0'); return `${m}:${s}` }

  function formatPrev(prevSet) {
    if (!prevSet) return '—'
    switch (type) {
      case 'weight_reps': return `${prevSet.kg}×${prevSet.reps}`
      case 'bw_reps': { const sign = (prevSet.bwSign || '+') === '+' ? '+' : '−'; return prevSet.kg ? `${sign}${prevSet.kg}×${prevSet.reps}` : `${prevSet.reps}r` }
      case 'reps_only': return `${prevSet.reps}r`
      case 'time_only': return prevSet.time || '—'
      case 'distance_time': return `${prevSet.distance || '?'}/${prevSet.time || '?'}`
      default: return '—'
    }
  }

  function isPrevDifferent(set, prevSet) {
    if (!prevSet) return false
    switch (type) {
      case 'weight_reps': return String(set.kg) !== String(prevSet.kg) || String(set.reps) !== String(prevSet.reps)
      case 'bw_reps': return String(set.kg) !== String(prevSet.kg) || String(set.reps) !== String(prevSet.reps) || (set.bwSign || '+') !== (prevSet.bwSign || '+')
      case 'reps_only': return String(set.reps) !== String(prevSet.reps)
      case 'time_only': return String(set.time) !== String(prevSet.time)
      case 'distance_time': return String(set.distance) !== String(prevSet.distance) || String(set.time) !== String(prevSet.time)
      default: return false
    }
  }

  function handleTouchStart(e, si) {
    if (e.target.tagName === 'INPUT') return
    if (e.target.tagName === 'BUTTON' || e.target.closest?.('button')) return
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; touchDeltaRef.current = 0; isSwipingRef.current = false
  }
  function handleTouchMove(e, si) {
    if (!touchStartRef.current.x && !touchStartRef.current.y) return
    const dx = touchStartRef.current.x - e.touches[0].clientX
    const dy = Math.abs(touchStartRef.current.y - e.touches[0].clientY)
    if (!isSwipingRef.current && dx > 10 && dx > dy) isSwipingRef.current = true
    if (!isSwipingRef.current) return
    touchDeltaRef.current = dx
    const el = rowRefs.current[si]
    if (el && dx > 0) { el.style.transform = `translateX(${Math.max(-80, -dx)}px)`; el.style.transition = 'none' }
  }
  function handleTouchEnd(e, si) {
    const el = rowRefs.current[si]; if (!el) return
    el.style.transition = 'transform 0.2s ease'
    if (touchDeltaRef.current > 60) {
      el.style.transform = 'translateX(-80px)'
      if (swipedSet !== null && swipedSet !== si) { const p = rowRefs.current[swipedSet]; if (p) { p.style.transition = 'transform 0.2s ease'; p.style.transform = 'translateX(0)' } }
      setSwipedSet(si)
    } else { el.style.transform = 'translateX(0)'; if (swipedSet === si) setSwipedSet(null) }
    touchStartRef.current = { x: 0, y: 0 }; touchDeltaRef.current = 0; isSwipingRef.current = false
  }
  function confirmDelete(si) { const el = rowRefs.current[si]; if (el) { el.style.transition = 'transform 0.2s ease'; el.style.transform = 'translateX(0)' }; setSwipedSet(null); onDeleteSet(exIndex, si) }
  function tapOutside(si) { if (swipedSet !== null && swipedSet !== si) { const el = rowRefs.current[swipedSet]; if (el) { el.style.transition = 'transform 0.2s ease'; el.style.transform = 'translateX(0)' }; setSwipedSet(null) } }

  const currentRest = exercise.restOverride !== null && exercise.restOverride !== undefined ? exercise.restOverride : defaultRest
  const hasPrevious = previousSets && previousSets.length > 0

  function getGridCols() {
    const prev = hasPrevious ? '44px ' : ''
    switch (type) {
      case 'weight_reps': return `28px ${prev}1fr 1fr 30px`
      case 'bw_reps': return `28px ${prev}1.2fr 1fr 30px`
      case 'reps_only': return `28px ${prev}1fr 30px`
      case 'time_only': return `28px ${prev}1fr 30px`
      case 'distance_time': return `28px ${prev}1fr 1fr 30px`
      default: return `28px ${prev}1fr 1fr 30px`
    }
  }

  const wLabel = unitWeight.toUpperCase()
  function getHeaders() {
    switch (type) {
      case 'weight_reps': return [wLabel, 'Reps']
      case 'bw_reps': return [`± ${wLabel}`, 'Reps']
      case 'reps_only': return ['Reps']
      case 'time_only': return ['Time']
      case 'distance_time': return [unitDistance === 'km' ? 'KM' : 'MI', 'Time']
      default: return [wLabel, 'Reps']
    }
  }

  const gridStyle = { gridTemplateColumns: getGridCols() }
  const headers = getHeaders()
  const doneStyle = 'border-[#7B7BFF]/25 bg-[#7B7BFF]/5 text-[#B8B8FF]'
  const editStyle = 'border-[#2A2A4A] text-white placeholder-[#3a3a55] focus:border-[#7B7BFF] focus:shadow-[0_0_0_3px_rgba(123,123,255,0.15)]'
  const base = 'w-full min-w-0 bg-[#1C1C38] border rounded-lg px-1.5 py-1.5 text-center text-sm font-bold outline-none transition-all'

  function renderInputs(set, j) {
    switch (type) {
      case 'weight_reps': return (<>
        <input type="number" inputMode="decimal" placeholder={unitWeight} data-ex={exIndex} data-set={j} data-field="kg" value={set.kg} onChange={(e) => onUpdateSet(exIndex, j, 'kg', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      case 'bw_reps': return (<>
        <div className="flex items-center gap-1.5">
          <button onClick={() => !set.done && onUpdateSet(exIndex, j, 'bwSign', (set.bwSign || '+') === '+' ? '-' : '+')} disabled={set.done}
            className={`shrink-0 w-8 h-[34px] rounded-xl border-[1.5px] flex items-center justify-center text-sm font-extrabold transition-all ${set.done ? 'border-[#7B7BFF]/25 bg-[#7B7BFF]/5' : 'border-[#2A2A4A] bg-[#1C1C38] hover:border-[#7B7BFF] active:scale-90'} ${(set.bwSign || '+') === '+' ? 'text-[#5BF5A0]' : 'text-[#ff6b6b]'}`}>
            {(set.bwSign || '+') === '+' ? '+' : '−'}
          </button>
          <input type="number" inputMode="decimal" placeholder={unitWeight} data-ex={exIndex} data-set={j} data-field="kg" value={set.kg} onChange={(e) => onUpdateSet(exIndex, j, 'kg', e.target.value)} disabled={set.done} className={`${base} flex-1 ${set.done ? doneStyle : editStyle}`} />
        </div>
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      case 'reps_only': return (
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      )
      case 'time_only': return (
        <input type="text" inputMode="numeric" placeholder="m:ss" data-ex={exIndex} data-set={j} data-field="time" value={set.time} onChange={(e) => onUpdateSet(exIndex, j, 'time', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      )
      case 'distance_time': return (<>
        <input type="number" inputMode="decimal" placeholder={unitDistance} data-ex={exIndex} data-set={j} data-field="distance" value={set.distance} onChange={(e) => onUpdateSet(exIndex, j, 'distance', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
        <input type="text" inputMode="numeric" placeholder="m:ss" data-ex={exIndex} data-set={j} data-field="time" value={set.time} onChange={(e) => onUpdateSet(exIndex, j, 'time', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      default: return null
    }
  }

  return (
    <div className="bg-[#13132A] border border-[#232340] rounded-2xl p-3.5 mb-2">
      {isEditing && (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1a1a30]">
          <div className="flex items-center gap-1">
            <button onClick={() => onMoveUp(exIndex)} className={`p-1.5 rounded-lg ${exIndex === 0 ? 'opacity-20' : 'hover:bg-[#1C1C38]'}`} disabled={exIndex === 0}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-[#7B7BFF]"><polyline points="18 15 12 9 6 15"/></svg></button>
            <button onClick={() => onMoveDown(exIndex)} className={`p-1.5 rounded-lg ${exIndex >= exerciseCount - 1 ? 'opacity-20' : 'hover:bg-[#1C1C38]'}`} disabled={exIndex >= exerciseCount - 1}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-[#7B7BFF]"><polyline points="6 9 12 15 18 9"/></svg></button>
          </div>
          <button onClick={() => onRemoveExercise(exIndex)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-semibold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-current"><path d="M18 6L6 18M6 6l12 12"/></svg>Remove
          </button>
        </div>
      )}

      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <button onClick={() => !isEditing && setShowExerciseMenu(!showExerciseMenu)} className="flex items-start gap-2 text-left">
            {libraryEntry ? <div className="mt-0.5"><MuscleIcon muscle={libraryEntry.muscle} size={14} /></div> : null}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight">{exercise.name}</span>
                {!isEditing && <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-[#555] shrink-0"><polyline points="6 9 12 15 18 9"/></svg>}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {libraryEntry && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5 text-[#888]">{libraryEntry.equipment}</span>}
                {type === 'bw_reps' && <span className="text-xs text-[#777]">BW: {bodyweight} {unitWeight}</span>}
                {bestSet && type === 'weight_reps' && <span className="text-xs text-[#777]">PR: {bestSet.kg}×{bestSet.reps}</span>}
              </div>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNoteInput(!showNoteInput)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold transition-colors ${exercise.note ? 'bg-[#7B7BFF]/10 text-[#7B7BFF] border border-[#7B7BFF]/20' : 'bg-[#1C1C38] text-[#777] border border-[#2A2A4A]'}`}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5 stroke-current"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button onClick={() => setShowRestPicker(!showRestPicker)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold transition-colors ${exercise.restOverride !== null && exercise.restOverride !== undefined ? 'bg-[#5BF5A0]/10 text-[#5BF5A0] border border-[#5BF5A0]/20' : 'bg-[#1C1C38] text-[#777] border border-[#2A2A4A]'}`}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {currentRest === 0 ? 'None' : formatTime(currentRest)}
          </button>
        </div>
      </div>

      {showExerciseMenu && (
        <div className="mt-2 bg-[#1C1C38] border border-[#2A2A4A] rounded-xl overflow-hidden">
          <button onClick={() => { setShowExerciseMenu(false); onRemoveExercise(exIndex) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Remove exercise
          </button>
          <button onClick={() => setShowExerciseMenu(false)} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-[#777] hover:bg-white/5 transition-colors border-t border-[#2A2A4A]">
            Cancel
          </button>
        </div>
      )}

      {exercise.note && !showNoteInput && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-[#1C1C38] rounded-lg border border-[#2A2A4A]">
          <span className="text-sm text-[#888] italic flex-1">{exercise.note}</span>
          <button onClick={() => onUpdateExerciseNote(exIndex, '')} className="text-[#777] hover:text-red-400 transition-colors shrink-0"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      )}

      {showNoteInput && (
        <div className="mt-2 flex gap-2">
          <input type="text" placeholder="Add a note..." value={exercise.note || ''} onChange={(e) => onUpdateExerciseNote(exIndex, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setShowNoteInput(false)} autoFocus className="flex-1 bg-[#1C1C38] border border-[#2A2A4A] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a55] outline-none focus:border-[#7B7BFF] transition-colors" />
          <button onClick={() => setShowNoteInput(false)} className="px-3 py-2 bg-[#7B7BFF] rounded-lg text-sm font-bold hover:bg-[#6060DD] transition-colors">Done</button>
        </div>
      )}

      {showRestPicker && (
        <div className="mt-3 mb-2 p-3 bg-[#1C1C38] rounded-xl border border-[#2A2A4A]">
          <div className="text-sm text-[#777] font-semibold uppercase tracking-wide mb-2">Rest timer for this exercise</div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => { onUpdateExerciseRest(exIndex, ''); setShowRestPicker(false) }} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${exercise.restOverride === null || exercise.restOverride === undefined ? 'bg-[#7B7BFF] text-white' : 'bg-[#13132A] border border-[#2A2A4A] text-[#888]'}`}>Default</button>
            {REST_PRESETS.map(seconds => (
              <button key={seconds} onClick={() => { onUpdateExerciseRest(exIndex, seconds); setShowRestPicker(false) }} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${exercise.restOverride === seconds ? 'bg-[#5BF5A0] text-[#0D0D1A]' : 'bg-[#13132A] border border-[#2A2A4A] text-[#888]'}`}>{seconds === 0 ? 'None' : formatTime(seconds)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="gap-1.5 mt-3 mb-1" style={{ display: 'grid', ...gridStyle }}>
        <span className="text-xs font-bold text-[#666] uppercase text-center">Set</span>
        {hasPrevious && <span className="text-xs font-bold text-[#666] uppercase text-center">Prev</span>}
        {headers.map(h => <span key={h} className="text-xs font-bold text-[#666] uppercase text-center">{h}</span>)}
        <span></span>
      </div>

      {exercise.sets.map((set, j) => {
        const isActiveRest = activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === j
        const hasCompletedRest = set.done && set.restTime && !isActiveRest
        const prevSet = previousSets && previousSets[j]
        const prevChanged = prevSet && isPrevDifferent(set, prevSet)

        return (
          <div key={j}>
            <div className="relative overflow-hidden rounded-lg mb-1">
              <button onClick={() => confirmDelete(j)} className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-lg z-0">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-white mr-1"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span className="text-white text-sm font-bold">Delete</span>
              </button>
              <div ref={(el) => { rowRefs.current[j] = el }} className="gap-1.5 items-center bg-[#13132A] relative z-10" style={{ display: 'grid', ...gridStyle }}
                onTouchStart={(e) => { tapOutside(j); handleTouchStart(e, j) }} onTouchMove={(e) => handleTouchMove(e, j)} onTouchEnd={(e) => handleTouchEnd(e, j)}>
                <span className="text-sm font-bold text-[#888] text-center">{j + 1}</span>
                {hasPrevious && (
                  <span className={`text-sm text-center font-medium italic ${prevChanged ? 'text-[#7B7BFF] font-bold not-italic' : 'text-[#7a7a9a]'}`}>{formatPrev(prevSet)}</span>
                )}
                {renderInputs(set, j)}
                {set.done ? (
                  <button onClick={() => onUndoneSet(exIndex, j)} className="w-7 h-7 bg-[#5BF5A0] rounded-md flex items-center justify-center mx-auto hover:bg-[#5BF5A0]/80 transition-colors active:scale-90"><svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5 stroke-[#0D0D1A]"><polyline points="20 6 9 17 4 12" /></svg></button>
                ) : (
                  <button onClick={() => onDoneSet(exIndex, j)} className="w-7 h-7 border-2 border-[#2A2A4A] rounded-md flex items-center justify-center mx-auto hover:border-[#5BF5A0] transition-colors active:scale-90">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5 stroke-[#555]"><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {isActiveRest && (
              <div className="flex items-center justify-center gap-2 py-1 my-0.5 rounded-lg relative overflow-hidden min-h-0 pointer-events-none" style={{ height: '1.65rem' }}>
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#5BF5A0]/10 to-[#4ECDC4]/5 rounded-lg transition-all duration-500" style={{ width: `${Math.max(0, (restTime / restDuration) * 100)}%` }} />
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-[#5BF5A0] relative z-10 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-[#5BF5A0] font-bold text-sm tabular-nums relative z-10 min-w-[36px] text-center">{formatTime(restTime)}</span>
              </div>
            )}

            {hasCompletedRest && (
              <div className="flex items-center justify-center gap-1.5 py-1 my-0.5">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-[#555]"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-[#777] text-sm font-semibold">{formatTime(set.restTime)}</span>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={() => onAddSet(exIndex)} className="w-full py-2 mt-2 border border-dashed border-[#2A2A4A] rounded-lg text-[#777] text-sm font-semibold hover:border-[#7B7BFF] hover:text-[#7B7BFF] transition-colors">+ Add set</button>
    </div>
  )
}

export default ExerciseCard
