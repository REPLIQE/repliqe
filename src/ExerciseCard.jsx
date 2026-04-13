import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import BottomSheet from './BottomSheet'
import ActionButton from './ActionButton'
import { CARD_SURFACE_LG } from './cardTokens'
import { TYPE_EMPHASIS_SM, TYPE_LABEL_UPPER } from './typographyTokens'
import { DeleteTrashBadge, DeleteTrashGlyph } from './DeleteConfirmTrashIcon'
import { MUSCLE_GROUPS } from './exerciseLibrary'
import { REST_PRESETS } from './restPresets'

const RIR_BADGE_STYLE = { color: '#2DD4BF', background: 'rgba(45,212,191,.14)', border: '1px solid rgba(45,212,191,.3)' }

/** Select all on focus so new typing replaces prefilled kg/reps/time without clearing first (mobile-friendly). */
function selectWorkoutFieldOnFocus(e) {
  const el = e.target
  if (!el || el.disabled) return
  const run = () => {
    try {
      if (typeof el.select === 'function') el.select()
      else if (el.setSelectionRange && el.value != null) el.setSelectionRange(0, String(el.value).length)
    } catch {
      /* Safari / some number inputs */
    }
  }
  requestAnimationFrame(run)
}

/**
 * Rest timer row: gentle height tuck + slow opacity fade so the bar doesn’t pop in loudly.
 */
function SmoothRestReveal({ show, children }) {
  return (
    <div
      className={[
        'grid',
        'motion-reduce:transition-none motion-reduce:duration-0',
        'transition-[grid-template-rows] duration-[900ms] ease-out',
      ].join(' ')}
      style={{ gridTemplateRows: show ? '1fr' : '0fr' }}
    >
      <div
        className={[
          'min-h-0 overflow-hidden',
          'motion-reduce:opacity-100 motion-reduce:transition-none',
          'transition-[opacity] duration-[1100ms] ease-out',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}

function RirBadge({ rir }) {
  if (rir === null || rir === undefined) return null
  return (
    <span
      className="inline-flex items-center justify-center min-w-[2.5rem] w-[2.5rem] px-1 py-0.5 rounded text-xs font-extrabold box-border"
      style={RIR_BADGE_STYLE}
    >
      {rir === 3 ? '3+' : rir}
    </span>
  )
}

function ExerciseCard({
  exercise, exIndex, isEditing, exerciseCount, onMoveUp, onMoveDown, onRemoveExercise, onReplaceExercise, onAddSet, onUpdateSet, onDoneSet, onUndoneSet, onDeleteSet, onUpdateExerciseRest, onUpdateExerciseNote,
  bestSet, previousSets, activeRest, restTime, restDuration, defaultRest, bodyweight, unitWeight, unitDistance, formatDecimal, parseDecimal, libraryEntry,
  supersetRole = null, supersetIsNext = false, supersetNextSetIndex = null, isLinkModeActive = false, isLinkSource = false, isLinkTarget = false, onTapAsTarget, onStartLinkMode, onBreakSuperset,
  rirEnabled = false, globalRirEnabled = false, onRirOverride = () => {},
  coachTipData = null,
  coachTipSetIndex = null,
  onCoachTipYes = () => {},
  onCoachTipNo = () => {},
}) {
  const fmtNum = formatDecimal ?? ((n) => (n !== '' && n != null ? String(n) : ''))
  const parseNum = parseDecimal ?? ((s) => parseFloat(String(s).replace(',', '.')))
  const displayKg = (v) => {
    if (v === '' || v == null) return ''
    const s = String(v)
    if (s.endsWith(',') || s.endsWith('.')) return s
    const n = typeof v === 'number' ? v : parseNum(v)
    return Number.isNaN(n) ? s : fmtNum(n)
  }
  const displayDist = (v) => {
    if (v === '' || v == null) return ''
    const s = String(v)
    if (s.endsWith(',') || s.endsWith('.')) return s
    const n = typeof v === 'number' ? v : parseNum(v)
    return Number.isNaN(n) ? s : fmtNum(n)
  }
  const [showRestPicker, setShowRestPicker] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [showRemoveNoteConfirm, setShowRemoveNoteConfirm] = useState(false)
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
      case 'weight_reps': return `${displayKg(prevSet.kg)}×${prevSet.reps}`
      case 'bw_reps': { const sign = (prevSet.bwSign || '+') === '+' ? '+' : '−'; return prevSet.kg != null && prevSet.kg !== '' ? `${sign}${displayKg(prevSet.kg)}×${prevSet.reps}` : `${prevSet.reps}r` }
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

  const currentRest =
    exercise.restOverride !== null && exercise.restOverride !== undefined
      ? exercise.restOverride
      : supersetRole === 'A'
        ? 0
        : defaultRest
  const restMenuDetail =
    supersetRole === 'A' && (exercise.restOverride === null || exercise.restOverride === undefined)
      ? 'None'
      : currentRest === 0
        ? 'None'
        : exercise.restOverride === null || exercise.restOverride === undefined
          ? `Default (${formatTime(defaultRest)})`
          : formatTime(currentRest)
  const hasPrevious = previousSets && previousSets.length > 0
  const showRirColumn = rirEnabled && type !== 'time_only' && type !== 'distance_time'

  function getGridCols() {
    const prev = hasPrevious ? (showRirColumn ? 'minmax(72px, 1.15fr) ' : 'minmax(44px, 0.6fr) ') : ''
    const rir = showRirColumn ? ' minmax(52px,0.55fr)' : ''
    const repsCol = hasPrevious ? 'minmax(0,0.75fr)' : 'minmax(0,1fr)'
    const timeCol = hasPrevious ? 'minmax(0,0.75fr)' : 'minmax(0,1fr)'
    switch (type) {
      case 'weight_reps': return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr)${rir} 30px`
      case 'bw_reps': return `28px ${prev}minmax(0,0.9fr) minmax(0,0.75fr)${rir} 30px`
      case 'reps_only': return `28px ${prev}${repsCol}${rir} 30px`
      case 'time_only': return `28px ${prev}${timeCol} 30px`
      case 'distance_time': return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr) 30px`
      default: return `28px ${prev}minmax(0,0.75fr) minmax(0,0.75fr)${rir} 30px`
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
  const doneFieldShell =
    'border-transparent bg-transparent shadow-none rounded-none text-[var(--set-done-row-input-text)] placeholder:text-[color:var(--set-done-row-placeholder)] focus:border-transparent focus:shadow-none focus:ring-2 focus:ring-[var(--set-done-focus-ring)] focus:ring-inset'
  const doneStyle = doneFieldShell
  const editStyle = 'border-border-strong text-text placeholder-muted-deep focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-primary)] focus:shadow-accent/20'
  /* text-base på små skærme: iOS zoomer ikke ind ved fokus (<16px giver layout-shift og vandret scroll) */
  const base = 'w-full min-w-0 bg-card-alt border rounded-lg px-1.5 py-1.5 text-center text-base sm:text-sm font-bold outline-none transition-all'
  const doneBtnTransition =
    'transition-all duration-[560ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:duration-0'

  function renderInputs(set, j) {
    switch (type) {
      case 'weight_reps': return (<>
        <input type="text" inputMode="decimal" placeholder={unitWeight} data-ex={exIndex} data-set={j} data-field="kg" value={displayKg(set.kg)} onChange={(e) => onUpdateSet(exIndex, j, 'kg', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      case 'bw_reps': return (<>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateSet(exIndex, j, 'bwSign', (set.bwSign || '+') === '+' ? '-' : '+')}
            aria-label={(set.bwSign || '+') === '+' ? 'Switch to subtracted bodyweight' : 'Switch to added bodyweight'}
            className={`shrink-0 w-8 h-[34px] rounded-xl border-[1.5px] flex items-center justify-center text-sm font-extrabold transition-all ${set.done ? 'border-transparent bg-white/10 shadow-none' : 'border-border-strong bg-card-alt hover:border-accent active:scale-90'} ${!set.done && (set.bwSign || '+') === '+' ? 'text-success' : ''} ${!set.done && (set.bwSign || '+') !== '+' ? 'text-[#ff6b6b]' : ''} ${set.done && (set.bwSign || '+') === '+' ? 'text-[var(--set-done-row-prev)]' : ''} ${set.done && (set.bwSign || '+') !== '+' ? 'text-[#ffb4b4]' : ''}`}
          >
            {(set.bwSign || '+') === '+' ? '+' : '−'}
          </button>
          <input type="text" inputMode="decimal" placeholder={unitWeight} data-ex={exIndex} data-set={j} data-field="kg" value={displayKg(set.kg)} onChange={(e) => onUpdateSet(exIndex, j, 'kg', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} flex-1 ${set.done ? doneStyle : editStyle}`} />
        </div>
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      case 'reps_only': return (
        <input type="number" inputMode="numeric" placeholder="reps" data-ex={exIndex} data-set={j} data-field="reps" value={set.reps} onChange={(e) => onUpdateSet(exIndex, j, 'reps', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      )
      case 'time_only': return (
        <input type="text" inputMode="numeric" placeholder="m:ss" data-ex={exIndex} data-set={j} data-field="time" value={set.time} onChange={(e) => onUpdateSet(exIndex, j, 'time', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      )
      case 'distance_time': return (<>
        <input type="text" inputMode="decimal" placeholder={unitDistance} data-ex={exIndex} data-set={j} data-field="distance" value={displayDist(set.distance)} onChange={(e) => onUpdateSet(exIndex, j, 'distance', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
        <input type="text" inputMode="numeric" placeholder="m:ss" data-ex={exIndex} data-set={j} data-field="time" value={set.time} onChange={(e) => onUpdateSet(exIndex, j, 'time', e.target.value)} onFocus={selectWorkoutFieldOnFocus} className={`${base} ${set.done ? doneStyle : editStyle}`} />
      </>)
      default: return null
    }
  }

  const displayName = exercise.name ?? exercise.exerciseId ?? ''
  const borderClass = isLinkSource ? 'border-accent/50 bg-card-alt' : isLinkTarget ? 'border-success/40 cursor-pointer' : 'border-border'
  const outerClass = [
    `${CARD_SURFACE_LG} py-2.5 px-3.5 mb-2 transition-all duration-200 w-full min-w-0`,
    borderClass,
    isLinkModeActive && !isLinkSource && !isLinkTarget ? 'opacity-40 pointer-events-none' : '',
    isLinkTarget ? 'animate-pulse-border' : ''
  ].filter(Boolean).join(' ')

  return (
    <>
    <div className={outerClass} onClick={isLinkTarget ? onTapAsTarget : undefined}>
      <div className="flex justify-between items-start gap-2">
        {isEditing && (
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => onMoveUp(exIndex)} className={`p-1.5 rounded-lg ${exIndex === 0 ? 'opacity-20' : 'hover:bg-card-alt'}`} disabled={exIndex === 0} aria-label="Move up"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-accent"><polyline points="18 15 12 9 6 15"/></svg></button>
            <button onClick={() => onMoveDown(exIndex)} className={`p-1.5 rounded-lg ${exIndex >= exerciseCount - 1 ? 'opacity-20' : 'hover:bg-card-alt'}`} disabled={exIndex >= exerciseCount - 1} aria-label="Move down"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4 stroke-accent"><polyline points="6 9 12 15 18 9"/></svg></button>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-lg font-bold tracking-tight truncate block">{displayName}</span>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {libraryEntry?.equipment ? (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-white/5 text-muted border border-white/[0.06] shrink-0">
                {libraryEntry.equipment}
              </span>
            ) : null}
            {!isEditing ? (
              <span className="flex items-center gap-1 text-xs text-muted-mid tabular-nums whitespace-nowrap shrink-0">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current shrink-0" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {currentRest === 0 ? 'None' : formatTime(currentRest)}
              </span>
            ) : null}
            {type === 'bw_reps' ? (
              <span className="text-xs text-muted-mid">BW: {bodyweight} {unitWeight}</span>
            ) : null}
            {bestSet && type === 'weight_reps' ? (
              <span className="text-xs text-muted-mid">PR: {displayKg(bestSet.kg)}×{bestSet.reps}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-start pt-0.5">
          {supersetRole ? (
            <span className="text-xs font-extrabold" style={{ color: supersetRole === 'A' ? 'var(--accent-primary)' : 'var(--success)' }}>
              {supersetRole}
            </span>
          ) : null}
          {supersetIsNext ? (
            <span className={`${TYPE_LABEL_UPPER} px-1.5 py-0.5 rounded-md tracking-wide bg-success/15 text-success border border-success/40 animate-up-next-pulse`}>Next</span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowExerciseMenu(!showExerciseMenu)}
            className="p-2 rounded-lg hover:bg-card-alt border border-transparent hover:border-border-strong transition-colors"
            aria-label="Exercise options"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 stroke-muted-strong"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>

      {showExerciseMenu && (
        <div className="mt-2 bg-card-alt border border-border-strong rounded-xl overflow-hidden">
          <button onClick={() => { setShowExerciseMenu(false); setShowNoteInput(true) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            {exercise.note ? 'Edit note' : 'Add note'}
          </button>
          {onReplaceExercise && !isLinkModeActive && (
            <button
              type="button"
              onClick={() => {
                setShowExerciseMenu(false)
                onReplaceExercise(exIndex)
              }}
              className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong"
            >
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current">
                <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              Replace exercise
            </button>
          )}
          {!isLinkSource && !isLinkModeActive && (exerciseCount > 1
            ? (exercise.supersetGroupId
              ? (
                <button onClick={() => { setShowExerciseMenu(false); onBreakSuperset?.() }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Break superset
                </button>
              )
              : (
                <button onClick={() => { setShowExerciseMenu(false); onStartLinkMode?.() }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                  Create superset
                </button>
              ))
            : null)}
          <button onClick={() => { setShowExerciseMenu(false); setShowRestPicker(true) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Rest timer · {restMenuDetail}
          </button>
          {type !== 'time_only' && type !== 'distance_time' && (
          <button
            type="button"
            onClick={() => {
              setShowExerciseMenu(false)
              const next = exercise.rirOverride === null ? true : exercise.rirOverride === true ? false : null
              onRirOverride(exIndex, next)
            }}
            className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong"
          >
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className={`w-4 h-4 ${rirEnabled ? 'stroke-accent' : 'stroke-current'}`}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              <div>
                <div className={rirEnabled ? 'text-accent' : ''}>RIR tracking</div>
                <div className="text-xs text-muted-strong mt-0.5">
                  {exercise.rirOverride === null ? `Following global (${globalRirEnabled ? 'on' : 'off'})` : exercise.rirOverride ? 'Enabled for this exercise' : 'Disabled for this exercise'}
                </div>
              </div>
            </div>
            <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${rirEnabled ? 'bg-accent' : 'bg-border-strong'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${rirEnabled ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>
          )}
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
        <div className="flex items-start gap-2 mt-2 px-3 py-2 bg-card-alt rounded-lg border border-border-strong min-w-0">
          <span className="text-sm text-muted-mid leading-relaxed flex-1 min-w-0 break-words whitespace-pre-wrap">{exercise.note}</span>
          <button
            type="button"
            onClick={() => setShowRemoveNoteConfirm(true)}
            className="text-muted-mid hover:text-red-400 transition-colors shrink-0"
            aria-label="Remove note"
          >
            <DeleteTrashGlyph className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showNoteInput && (
        <div className="mt-2 w-full min-w-0 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
          <textarea
            placeholder="Add a note..."
            value={exercise.note || ''}
            onChange={(e) => onUpdateExerciseNote(exIndex, e.target.value)}
            rows={4}
            autoFocus
            enterKeyHint="enter"
            className="w-full min-w-0 sm:flex-1 box-border bg-card-alt border border-border-strong rounded-lg px-3 py-2 text-base sm:text-sm text-text placeholder-muted-deep outline-none focus:border-accent transition-colors resize-y min-h-[5.5rem] max-h-[40vh]"
          />
          <button
            type="button"
            onClick={() => setShowNoteInput(false)}
            className="w-full shrink-0 px-3 py-2 bg-accent text-on-accent rounded-lg text-sm font-bold hover:opacity-90 transition-colors sm:w-auto self-end sm:self-stretch sm:min-w-[4.5rem]"
          >
            Done
          </button>
        </div>
      )}

      {showRestPicker && (
        <div className="mt-3 mb-2 p-3 bg-card-alt rounded-xl border border-border-strong">
          <div className="text-sm text-muted-mid font-semibold uppercase tracking-wide mb-2">Rest timer for this exercise</div>
          <div className="flex gap-1.5 flex-wrap">
            {supersetRole !== 'A' ? (
              <button
                type="button"
                onClick={() => { onUpdateExerciseRest(exIndex, ''); setShowRestPicker(false) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${exercise.restOverride === null || exercise.restOverride === undefined ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card text-muted'}`}
              >
                Default
              </button>
            ) : null}
            {REST_PRESETS.map((seconds) => {
              const noneSelectedForA =
                supersetRole === 'A' &&
                seconds === 0 &&
                (exercise.restOverride === null || exercise.restOverride === undefined || exercise.restOverride === 0)
              const presetSelected = noneSelectedForA || exercise.restOverride === seconds
              return (
                <button
                  type="button"
                  key={seconds}
                  onClick={() => {
                    if (supersetRole === 'A' && seconds === 0) onUpdateExerciseRest(exIndex, '')
                    else onUpdateExerciseRest(exIndex, seconds)
                    setShowRestPicker(false)
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${presetSelected ? 'border-success bg-success/10 text-success' : 'border-border-strong bg-card text-muted'}`}
                >
                  {seconds === 0 ? 'None' : formatTime(seconds)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="gap-1.5 mt-2 mb-1" style={{ display: 'grid', ...gridStyle }}>
        <span className="text-xs font-bold text-muted-strong uppercase text-center">Set</span>
        {hasPrevious && <span className="text-xs font-bold text-muted-strong uppercase text-center">Prev</span>}
        {headers.map(h => <span key={h} className="text-xs font-bold text-muted-strong uppercase text-center">{h}</span>)}
        {showRirColumn && <span className="text-xs font-bold text-muted-strong uppercase text-center">RIR</span>}
        <span></span>
      </div>

      {(exercise.sets ?? []).map((set, j) => {
        const isActiveRest = activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === j
        const hasCompletedRest = set.done && set.restTime && !isActiveRest
        const prevSet = previousSets && previousSets[j]
        const prevChanged = prevSet && isPrevDifferent(set, prevSet)
        const isNextSet = supersetIsNext && supersetNextSetIndex === j

        return (
          <div key={j} className="mb-1">
            <div className="relative overflow-hidden rounded-lg" style={{ isolation: 'isolate' }}>
              <button type="button" onClick={() => confirmDelete(j)} aria-label={`Delete set ${j + 1}`} className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500 rounded-r-lg z-0" style={{ backfaceVisibility: 'hidden' }}>
                <DeleteTrashGlyph className="w-4 h-4 text-white mr-1 shrink-0" />
                <span className="text-white text-sm font-bold">Delete</span>
              </button>
              <div
                ref={(el) => { rowRefs.current[j] = el }}
                className={[
                  'gap-1.5 items-center relative z-10 rounded-lg px-0.5 py-1 transition-[background-color,box-shadow] duration-300',
                  set.done ? 'shadow-none' : `bg-card ${isNextSet && !set.done ? 'ring-2 ring-success/60' : ''}`,
                ].join(' ')}
                style={{
                  display: 'grid',
                  ...gridStyle,
                  touchAction: 'pan-y',
                  /* Done: solid row fill only — no edge shadow (avoids a slightly different stripe vs #0a4830). */
                  ...(set.done
                    ? { background: 'var(--set-done-row-bg)' }
                    : { boxShadow: '2px 0 0 0 var(--bg-card)' }),
                }}
                onTouchStart={(e) => { tapOutside(j); handleTouchStart(e, j) }} onTouchMove={(e) => handleTouchMove(e, j)} onTouchEnd={(e) => handleTouchEnd(e, j)}
              >
                <span className={`text-sm font-bold text-center ${set.done ? 'text-[var(--set-done-row-input-text)]' : 'text-muted'}`}>{j + 1}</span>
                {hasPrevious && (
                  <div className="flex flex-row items-center justify-center gap-1.5 flex-wrap-nowrap">
                    <span
                      className={`text-sm text-center font-medium italic shrink-0 ${
                        prevChanged ? 'text-accent font-bold not-italic' : set.done ? 'text-[var(--set-done-row-prev)]' : 'text-muted'
                      }`}
                    >
                      {formatPrev(prevSet)}
                    </span>
                    {prevSet?.rir !== null && prevSet?.rir !== undefined && <RirBadge rir={prevSet.rir} />}
                  </div>
                )}
                {renderInputs(set, j)}
                {showRirColumn && (
                  <div className="flex items-center justify-center min-h-[34px] shrink-0 whitespace-nowrap">
                    {set.done && set.rir !== null && set.rir !== undefined ? (
                      <RirBadge rir={set.rir} />
                    ) : (
                      <span className={`text-sm ${set.done ? 'text-[var(--set-done-row-prev)]' : 'text-muted'}`}>—</span>
                    )}
                  </div>
                )}
                {set.done ? (
                  <button
                    type="button"
                    onClick={() => onUndoneSet(exIndex, j)}
                    aria-label={`Mark set ${j + 1} as not done`}
                    className={`w-7 h-7 rounded-md flex items-center justify-center mx-auto active:scale-90 ${doneBtnTransition} bg-[var(--set-done-check-bg)] hover:brightness-110 motion-reduce:hover:brightness-100`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className="w-3.5 h-3.5 stroke-[var(--check-done-icon)] transition-opacity duration-300" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onDoneSet(exIndex, j)}
                    aria-label={`Mark set ${j + 1} done`}
                    className={`w-7 h-7 border-2 rounded-md flex items-center justify-center mx-auto active:scale-90 ${doneBtnTransition} ${isNextSet ? 'border-success bg-success/10 ring-2 ring-success/50 animate-up-next-pulse' : 'border-border-strong hover:border-success'}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" className={`w-3.5 h-3.5 transition-colors duration-300 ${isNextSet ? 'stroke-success' : 'stroke-muted-strong'}`} aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                )}
              </div>
            </div>

            <SmoothRestReveal show={isActiveRest || hasCompletedRest}>
              {isActiveRest ? (() => {
                const progress = restDuration > 0 ? Math.max(0, Math.min(1, restTime / restDuration)) : 0
                const barWidthPct = progress * 100
                const sidePct = (1 - progress) * 50
                return (
                  <div data-rest-active="1" className="flex items-center justify-center gap-1.5 py-0.5 my-0.5 rounded-lg relative min-h-0 pointer-events-none overflow-hidden isolate" style={{ height: '1.2rem' }}>
                    <div
                      className="absolute top-0 bottom-0 left-1/2 z-0 -translate-x-1/2 rounded-sm transition-[width] duration-300 ease-out bg-gradient-to-r from-accent to-accent-end"
                      style={{ width: `${barWidthPct}%`, minWidth: 0 }}
                    />
                    <div
                      className="absolute top-0 bottom-0 right-1/2 z-[1] transition-[width] duration-500 ease-out"
                      style={{
                        width: `${sidePct}%`,
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.85) 0.75px, transparent 0.75px)',
                        backgroundSize: '4px 1.2rem',
                        backgroundPosition: '100% center',
                        opacity: 0.45
                      }}
                    />
                    <div
                      className="absolute top-0 bottom-0 left-1/2 z-[1] transition-[width] duration-500 ease-out"
                      style={{
                        width: `${sidePct}%`,
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.85) 0.75px, transparent 0.75px)',
                        backgroundSize: '4px 1.2rem',
                        backgroundPosition: '0 center',
                        opacity: 0.45
                      }}
                    />
                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5 stroke-white/90 relative z-10 shrink-0 transition-opacity duration-700" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="text-white/95 font-bold text-xs tabular-nums relative z-10 min-w-[28px] text-center transition-opacity duration-700">{formatTime(restTime)}</span>
                  </div>
                )
              })() : hasCompletedRest ? (
                <div className="flex items-center justify-center gap-1 py-0.5 my-0.5 relative min-h-[1.2rem] overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 right-1/2 w-1/2"
                    style={{
                      backgroundImage: 'radial-gradient(circle, var(--color-muted-mid) 0.75px, transparent 0.75px)',
                      backgroundSize: '4px 1.2rem',
                      backgroundPosition: '0 center',
                      opacity: 0.6
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 left-1/2 w-1/2"
                    style={{
                      backgroundImage: 'radial-gradient(circle, var(--color-muted-mid) 0.75px, transparent 0.75px)',
                      backgroundSize: '4px 1.2rem',
                      backgroundPosition: '0 center',
                      opacity: 0.6
                    }}
                  />
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5 stroke-muted-strong relative z-10 shrink-0" aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="text-muted-mid text-xs font-semibold relative z-10">{formatTime(set.restTime)}</span>
                </div>
              ) : null}
            </SmoothRestReveal>

            {coachTipData && coachTipSetIndex === j && (
              <div
                className={`mt-2 p-3 rounded-xl border transition-colors duration-200 ${
                  coachTipData.loading
                    ? 'bg-accent/[0.08] border-accent/35 ring-2 ring-accent/20 animate-pulse'
                    : 'bg-accent/[0.06] border-accent/20'
                }`}
                aria-busy={coachTipData.loading ? 'true' : undefined}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="relative flex h-2 w-2 shrink-0">
                    {coachTipData.loading ? (
                      <>
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                      </>
                    ) : (
                      <span className="inline-flex h-2 w-2 rounded-full bg-accent" />
                    )}
                  </div>
                  <span className={`${TYPE_EMPHASIS_SM} text-accent uppercase tracking-wider`}>
                    Coach
                  </span>
                </div>
                {coachTipData.loading ? (
                  <p className="text-xs text-muted-strong leading-relaxed">
                    Writing a programme tip from your early sessions…
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-strong leading-relaxed mb-2">{coachTipData.text}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={onCoachTipYes}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-accent/15 text-accent border border-accent/30"
                      >
                        Yes, more tips
                      </button>
                      <button
                        type="button"
                        onClick={onCoachTipNo}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-card border border-border text-muted"
                      >
                        No thanks
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onAddSet(exIndex)}
        className="w-full mt-1.5 py-0.5 min-h-[1.2rem] box-border flex items-center justify-center rounded-lg border-2 border-dashed border-muted-strong/55 bg-card-alt/60 text-xs font-semibold text-muted-strong leading-none hover:bg-card-alt/85 hover:border-accent/60 hover:text-accent transition-colors"
      >
        + Add set
      </button>
    </div>
    {showRemoveNoteConfirm &&
      typeof document !== 'undefined' &&
      createPortal(
        <BottomSheet
          onClose={() => setShowRemoveNoteConfirm(false)}
          align="center"
          variant="card"
          zClass="z-[100]"
          showHandle={false}
          maxWidthClass="max-w-sm"
          role="dialog"
          ariaModal={true}
          ariaLabelledBy="remove-note-title"
        >
          <div className="text-center">
            <DeleteTrashBadge />
            <h2 id="remove-note-title" className="text-text text-lg font-bold mb-2">
              Remove note?
            </h2>
            <p className="text-muted text-sm mb-5">This exercise note will be permanently cleared.</p>
            <div className="flex gap-3">
              <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setShowRemoveNoteConfirm(false)}>
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={() => {
                  setShowRemoveNoteConfirm(false)
                  onUpdateExerciseNote(exIndex, '')
                }}
              >
                <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                Delete
              </ActionButton>
            </div>
          </div>
        </BottomSheet>,
        document.body
      )}
    </>
  )
}

export default ExerciseCard
