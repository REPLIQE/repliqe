import { useState, useRef } from 'react'
import MuscleIcon from './MuscleIcon'
import { MUSCLE_GROUPS } from './exerciseLibrary'

const REST_PRESETS = [0, 30, 60, 90, 120, 180]

function ExerciseCard({
  exercise, exIndex, isEditing, exerciseCount, onMoveUp, onMoveDown, onRemoveExercise, onAddSet, onUpdateSet, onDoneSet, onUndoneSet, onDeleteSet, onUpdateExerciseRest, onUpdateExerciseNote,
  bestSet, previousSets, activeRest, restTime, restDuration, defaultRest, bodyweight, unitWeight, unitDistance, libraryEntry,
  supersetRole = null, supersetIsNext = false, supersetNextSetIndex = null, isLinkModeActive = false, isLinkSource = false, isLinkTarget = false, onTapAsTarget, onStartLinkMode, onBreakSuperset
}) {
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

  function getBaseline(set) {
    return {
      kg: set.initialKg !== undefined ? set.initialKg : set.kg,
      reps: set.initialReps !== undefined ? set.initialReps : set.reps,
      time: set.initialTime !== undefined ? set.initialTime : set.time,
      distance: set.initialDistance !== undefined ? set.initialDistance : set.distance,
      bwSign: set.initialBwSign !== undefined ? set.initialBwSign : (set.bwSign || '+')
    }
  }

  function isPrevDifferent(set, prevSet) {
    if (!prevSet) return false
    const b = getBaseline(set)
    switch (type) {
      case 'weight_reps': return String(b.kg) !== String(prevSet.kg) || String(b.reps) !== String(prevSet.reps)
      case 'bw_reps': return String(b.kg) !== String(prevSet.kg) || String(b.reps) !== String(prevSet.reps) || (b.bwSign || '+') !== (prevSet.bwSign || '+')
      case 'reps_only': return String(b.reps) !== String(prevSet.reps)
      case 'time_only': return String(b.time) !== String(prevSet.time)
      case 'distance_time': return String(b.distance) !== String(prevSet.distance) || String(b.time) !== String(prevSet.time)
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
    // Prevent the scroll container from stealing horizontal swipes.
    e.preventDefault()
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
    const prev = hasPrevious ? 'minmax(55px, 1fr) ' : ''
    switch (type) {
      case 'weight_reps': return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr) 30px`
      case 'bw_reps': return `28px ${prev}minmax(0,0.9fr) minmax(0,0.75fr) 30px`
      case 'reps_only': return `28px ${prev}minmax(0,0.75fr) 30px`
      case 'time_only': return `28px ${prev}minmax(0,0.75fr) 30px`
      case 'distance_time': return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr) 30px`
      default: return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr) 30px`
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
  const doneStyle = 'border-accent/25 bg-accent/5 text-accent'
  const editStyle = 'border-border-strong text-text placeholder-muted-deep focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-primary)] focus:shadow-accent/20'
  const base = 'w-full min-w-0 bg-card-alt border rounded-lg px-1.5 py-1.5 text-center text-sm font-bold outline-none transition-all'

  function renderInputs(set, j) {
    switch (type) {
      case 'weight_reps': return (<>
        <input type="number" inputMode="decimal" placeholder={unitWeight} data-ex={exIndex} data-set={j} data-field="kg" value={set.kg} onChange={(e) => onUpdateSet(exIndex, j, 'kg', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} disabled={set.done} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      case 'bw_reps': return (<>
        <div className="flex items-center gap-1.5">
          <button onClick={() => !set.done && onUpdateSet(exIndex, j, 'bwSign', (set.bwSign || '+') === '+' ? '-' : '+')} disabled={set.done}
            className={`shrink-0 w-8 h-[34px] rounded-xl border-[1.5px] flex items-center justify-center text-sm font-extrabold transition-all ${set.done ? 'border-accent/25 bg-accent/5' : 'border-border-strong bg-card-alt hover:border-accent active:scale-90'} ${(set.bwSign || '+') === '+' ? 'text-success' : 'text-[#ff6b6b]'}`}>
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

  const displayName = exercise.name ?? exercise.exerciseId ?? ''
  const borderClass = isLinkSource ? 'border-accent/50 bg-card-alt' : isLinkTarget ? 'border-success/40 cursor-pointer' : 'border-border'
  const outerClass = [
    'bg-card border rounded-2xl p-3.5 mb-2 transition-all duration-200',
    borderClass,
    isLinkModeActive && !isLinkSource && !isLinkTarget ? 'opacity-40 pointer-events-none' : '',
    isLinkTarget ? 'animate-pulse-border' : ''
  ].filter(Boolean).join(' ')

  return (
    <div className={outerClass} onClick={isLinkTarget ? onTapAsTarget : undefined}>
      <div className="flex justify-between items-start gap-2">
        {isEditing && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onMoveUp(exIndex)} className={`p-1.5 rounded-lg ${exIndex === 0 ? 'opacity-20' : 'hover:bg-card-alt'}`} disabled={exIndex === 0} aria-label="Move up"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-accent"><polyline points="18 15 12 9 6 15"/></svg></button>
            <button onClick={() => onMoveDown(exIndex)} className={`p-1.5 rounded-lg ${exIndex >= exerciseCount - 1 ? 'opacity-20' : 'hover:bg-card-alt'}`} disabled={exIndex >= exerciseCount - 1} aria-label="Move down"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-accent"><polyline points="6 9 12 15 18 9"/></svg></button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {libraryEntry ? <div className="mt-0.5 shrink-0"><MuscleIcon muscle={libraryEntry.muscle} size={14} /></div> : null}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight">{displayName}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {type === 'bw_reps' && <span className="text-xs text-muted-mid">BW: {bodyweight} {unitWeight}</span>}
                {bestSet && type === 'weight_reps' && <span className="text-xs text-muted-mid">PR: {bestSet.kg}×{bestSet.reps}</span>}
                {!isEditing && supersetRole !== 'A' && (
                  <span className="flex items-center gap-1 text-xs text-muted-mid">
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {currentRest === 0 ? 'None' : formatTime(currentRest)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center shrink-0">
          {supersetRole && (
            <span className="text-xs font-extrabold mr-1" style={{ color: supersetRole === 'A' ? 'var(--accent-primary)' : 'var(--success)' }}>
              {supersetRole}
            </span>
          )}
          {supersetIsNext && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide bg-success/15 text-success border border-success/40 mr-1.5 animate-up-next-pulse">Next</span>
          )}
          <button onClick={() => setShowExerciseMenu(!showExerciseMenu)} className="p-2 rounded-lg hover:bg-card-alt border border-transparent hover:border-border-strong transition-colors" aria-label="Exercise options">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 stroke-muted-strong"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>

      {showExerciseMenu && (
        <div className="mt-2 bg-card-alt border border-border-strong rounded-xl overflow-hidden">
          {!isLinkSource && !isLinkModeActive && (exerciseCount > 1
            ? (exercise.supersetGroupId
              ? (
                <button onClick={() => { setShowExerciseMenu(false); onBreakSuperset?.() }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Break superset
                </button>
              )
              : (
                <button onClick={() => { setShowExerciseMenu(false); onStartLinkMode?.() }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Create superset
                </button>
              ))
            : null)}
          <div className="border-t border-border-strong" />
          {supersetRole !== 'A' && (
          <button onClick={() => { setShowExerciseMenu(false); setShowRestPicker(true) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Rest timer {exercise.restOverride !== null && exercise.restOverride !== undefined ? `· ${currentRest === 0 ? 'None' : formatTime(currentRest)}` : `· Default (${formatTime(defaultRest)})`}
          </button>
          )}
          <button onClick={() => { setShowExerciseMenu(false); setShowNoteInput(true) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            {exercise.note ? 'Edit note' : 'Add note'}
          </button>
          <button onClick={() => { setShowExerciseMenu(false); onRemoveExercise(exIndex) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors border-t border-border-strong">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Remove exercise
          </button>
          <button onClick={() => setShowExerciseMenu(false)} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-muted-mid hover:bg-white/5 transition-colors border-t border-border-strong">
            Cancel
          </button>
        </div>
      )}

      {exercise.note && !showNoteInput && (
        <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-card-alt rounded-lg border border-border-strong">
          <span className="text-sm text-muted italic flex-1">{exercise.note}</span>
          <button onClick={() => onUpdateExerciseNote(exIndex, '')} className="text-muted-mid hover:text-red-400 transition-colors shrink-0"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
        </div>
      )}

      {showNoteInput && (
        <div className="mt-2 flex gap-2">
          <input type="text" placeholder="Add a note..." value={exercise.note || ''} onChange={(e) => onUpdateExerciseNote(exIndex, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setShowNoteInput(false)} autoFocus className="flex-1 bg-card-alt border border-border-strong rounded-lg px-3 py-2 text-sm text-text placeholder-muted-deep outline-none focus:border-accent transition-colors" />
          <button onClick={() => setShowNoteInput(false)} className="px-3 py-2 bg-accent text-on-accent rounded-lg text-sm font-bold hover:opacity-90 transition-colors">Done</button>
        </div>
      )}

      {showRestPicker && (
        <div className="mt-3 mb-2 p-3 bg-card-alt rounded-xl border border-border-strong">
          <div className="text-sm text-muted-mid font-semibold uppercase tracking-wide mb-2">Rest timer for this exercise</div>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => { onUpdateExerciseRest(exIndex, ''); setShowRestPicker(false) }} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${exercise.restOverride === null || exercise.restOverride === undefined ? 'bg-accent text-on-accent' : 'bg-card border border-border-strong text-muted'}`}>Default</button>
            {REST_PRESETS.map(seconds => (
              <button key={seconds} onClick={() => { onUpdateExerciseRest(exIndex, seconds); setShowRestPicker(false) }} className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${exercise.restOverride === seconds ? 'bg-success text-on-success' : 'bg-card border border-border-strong text-muted'}`}>{seconds === 0 ? 'None' : formatTime(seconds)}</button>
            ))}
          </div>
        </div>
      )}

      <div className="gap-1.5 mt-3 mb-1" style={{ display: 'grid', ...gridStyle }}>
        <span className="text-xs font-bold text-muted-strong uppercase text-center">Set</span>
        {hasPrevious && <span className="text-xs font-bold text-muted-strong uppercase text-center">Prev</span>}
        {headers.map(h => <span key={h} className="text-xs font-bold text-muted-strong uppercase text-center">{h}</span>)}
        <span></span>
      </div>

      {exercise.sets.map((set, j) => {
        const isActiveRest = activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === j
        const hasCompletedRest = set.done && set.restTime && !isActiveRest
        const prevSet = previousSets && previousSets[j]
        const prevChanged = prevSet && isPrevDifferent(set, prevSet)
        const isNextSet = supersetIsNext && supersetNextSetIndex === j

        return (
          <div key={j}>
            <div className="relative overflow-hidden rounded-lg mb-1" style={{ isolation: 'isolate' }}>
              <button onClick={() => confirmDelete(j)} className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-lg z-0" style={{ backfaceVisibility: 'hidden' }}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-white mr-1"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span className="text-white text-sm font-bold">Delete</span>
              </button>
              <div ref={(el) => { rowRefs.current[j] = el }} className={`gap-1.5 items-center bg-card relative z-10 ${isNextSet ? 'ring-2 ring-success/60 rounded-lg' : ''}`} style={{ display: 'grid', ...gridStyle, touchAction: 'pan-y', boxShadow: '2px 0 0 0 var(--bg-card)' }}
                onTouchStart={(e) => { tapOutside(j); handleTouchStart(e, j) }} onTouchMove={(e) => handleTouchMove(e, j)} onTouchEnd={(e) => handleTouchEnd(e, j)}>
                <span className="text-sm font-bold text-muted text-center">{j + 1}</span>
                {hasPrevious && (
                  <span className={`text-sm text-center font-medium italic ${prevChanged ? 'text-accent font-bold not-italic' : 'text-muted'}`}>{formatPrev(prevSet)}</span>
                )}
                {renderInputs(set, j)}
                {set.done ? (
                  <button onClick={() => onUndoneSet(exIndex, j)} className="w-7 h-7 bg-success rounded-md flex items-center justify-center mx-auto hover:bg-success/80 transition-colors active:scale-90"><svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5 stroke-page"><polyline points="20 6 9 17 4 12" /></svg></button>
                ) : (
                  <button onClick={() => onDoneSet(exIndex, j)} className={`w-7 h-7 border-2 rounded-md flex items-center justify-center mx-auto transition-colors active:scale-90 ${isNextSet ? 'border-success bg-success/10 ring-2 ring-success/50 animate-up-next-pulse' : 'border-border-strong hover:border-success'}`}>
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className={`w-3.5 h-3.5 ${isNextSet ? 'stroke-success' : 'stroke-muted-strong'}`}><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            {supersetRole !== 'A' && isActiveRest && (
              <div data-rest-active="1" className="flex items-center justify-center gap-2 py-1 my-0.5 rounded-lg relative overflow-hidden min-h-0 pointer-events-none" style={{ height: '1.65rem' }}>
                <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-success/10 to-success/5 rounded-lg transition-all duration-500" style={{ width: `${Math.max(0, (restTime / restDuration) * 100)}%` }} />
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-success relative z-10 shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-success font-bold text-sm tabular-nums relative z-10 min-w-[36px] text-center">{formatTime(restTime)}</span>
              </div>
            )}

            {supersetRole !== 'A' && hasCompletedRest && (
              <div className="flex items-center justify-center gap-1.5 py-1 my-0.5">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3 h-3 stroke-muted-strong"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span className="text-muted-mid text-sm font-semibold">{formatTime(set.restTime)}</span>
              </div>
            )}
          </div>
        )
      })}

      <button onClick={() => onAddSet(exIndex)} className="w-full py-2 mt-2 border border-dashed border-border-strong rounded-lg text-muted-mid text-sm font-semibold hover:border-accent hover:text-accent transition-colors">+ Add set</button>
    </div>
  )
}

export default ExerciseCard
