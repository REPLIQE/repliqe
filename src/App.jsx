import { useState, useEffect, useLayoutEffect, useMemo, useRef, Component, lazy, Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ExerciseCard from './ExerciseCard'
import ExerciseLibrary from './ExerciseLibraryUI'
import CreateExerciseModal from './CreateExerciseModal'
import { DeleteTrashBadge, DeleteTrashGlyph } from './DeleteConfirmTrashIcon'
import { useSuperset } from './useSuperset'
import SupersetWrapper from './SupersetWrapper'
import LinkModeBanner from './LinkModeBanner'
import RirSheet from './RirSheet'
import MuscleMapCard from './MuscleMapCard'
import { getDayMuscles, getDayMusclesSlugs, getRecoveryPct, formatMuscleLabel, formatDecimal as formatDecimalUtil, parseDecimal as parseDecimalUtil } from './utils'
import { formatStoredDateForDisplay, DATE_FORMAT_DDMY, DATE_FORMAT_MMDY } from './dateFormatUtils'
import OnboardingScreen from './OnboardingScreen'

/** Welcome “Skip” → terms screen only; after accept, exit to app without prefs/programme. */
const ONBOARDING_TERMS_ONLY_KEY = 'repliqe_onboarding_terms_only_path'
import { useAuth } from './lib/AuthContext'
import LoginScreen from './lib/LoginScreen'
import AccountTab, { AboutTab } from './lib/AccountTab'
import { PrivacyPolicy, TermsOfService } from './lib/LegalPages'
import { fetchWorkoutPlans, saveWorkoutPlans, deleteWorkoutPlan } from './lib/workoutPlansFirestore'
import { addWorkoutSession, fetchWorkoutSessions, fetchWorkoutSessionsFromServer, updateWorkoutSessionRating, updateWorkoutSessionPhotoSessions } from './lib/workoutSessionsFirestore'
import {
  getUserDoc,
  mergeUserSettings,
  DEFAULT_SETTINGS,
  normalizeUserPlan,
  USER_PLAN_STORAGE_KEY,
  ensureUserDoc,
  updateOnboardingProgress,
  completeUserOnboarding,
} from './lib/userFirestore'
import { fetchAppData, updateAppData } from './lib/appDataFirestore'
import { DEFAULT_EXERCISES, MUSCLE_GROUPS, SLUG_TO_GROUP } from './exerciseLibrary'
import RecoveryModal from './RecoveryModal'
import BottomSheet from './BottomSheet'
import ActionButton from './ActionButton'
import { Z_NAV, Z_OVERLAY, Z_OVERLAY_STACKED } from './zLayers'
import RepliqeLogo from './RepliqeLogo'
import ProgressPhoto from './ProgressPhoto'
import { loadPhotoSrc } from './PhotosModal'
import { CARD_SURFACE_LG, CARD_SURFACE_MD } from './cardTokens'
import {
  TYPE_BODY,
  TYPE_BODY_SM,
  TYPE_BODY_SM_SEMIBOLD,
  TYPE_BODY_SEMIBOLD,
  TYPE_CAPTION,
  TYPE_EMPHASIS_SM,
  TYPE_LABEL_FORM,
  TYPE_LABEL_MICRO,
  TYPE_LABEL_UPPER,
  TYPE_META,
  TYPE_MICRO,
  TYPE_MICRO_TIGHT,
  TYPE_OVERLINE_MID,
  TYPE_STAT_NUMBER,
  TYPE_STATUS_BADGE,
  TYPE_TAB,
  TYPE_HERO_PLUS,
  TYPE_TITLE_BLOCK,
  TYPE_TITLE_MODAL,
} from './typographyTokens'
const ProgressScreen = lazy(() => import('./ProgressScreen'))
const CoachScreen = lazy(() => import('./CoachScreen'))
const CreateProgrammeFlow = lazy(() => import('./CreateProgrammeFlow'))

function LazyFallback({ label = 'Loading…' }) {
  return (
    <div className="py-16 px-4 text-center text-sm text-muted-strong" aria-busy="true">
      {label}
    </div>
  )
}

/** Plan programme tiles: exercise/set counts + unique muscle group labels from library */
function routinePlanTileMeta(routine, library) {
  const exs = routine?.exercises || []
  const exCount = exs.length
  const setCount = exs.reduce((n, ex) => n + (ex.setConfigs?.length || 0), 0)
  const { primary } = getDayMusclesSlugs(exs, library)
  const labels = []
  const seen = new Set()
  for (const slug of primary) {
    const gk = SLUG_TO_GROUP[slug]
    const label = gk && MUSCLE_GROUPS[gk] ? MUSCLE_GROUPS[gk].label : formatMuscleLabel(slug)
    if (!seen.has(label)) {
      seen.add(label)
      labels.push(label)
    }
  }
  return { exCount, setCount, focusLabels: labels }
}
import PricingSheet from './PricingSheet'
import {
  defaultPlanUsage,
  incrementPlanUsage,
  mergePlanUsage,
  syncPlanUsagePeriod,
} from './lib/planUsage'
import { invokeCoachGenerate } from './lib/invokeCoachGenerate'

class ProgressErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('Progress screen error:', error, info.componentStack)
  }
  render() {
    if (this.state.error) {
      const err = this.state.error
      const message = err?.message || String(err)
      return (
        <div className="py-8 px-4 text-center">
          <p className="text-sm font-semibold text-text mb-2">Something went wrong on Progress</p>
          <p className="text-xs text-muted mb-2 break-all font-mono max-w-full">{message}</p>
          <p className="text-xs text-muted mb-4">Check the browser console (F12) for full details.</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="text-sm font-bold text-accent"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const REST_PRESETS = [0, 30, 60, 90, 120, 180]
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Index ranges in routine editor flat list: one block = ét trin (én øvelse eller superset A+B ved siden af hinanden). */
function getRoutineEditorOrderBlocks(flat) {
  if (!flat || flat.length === 0) return []
  const blocks = []
  const n = flat.length
  let i = 0
  while (i < n) {
    const ex = flat[i]
    if (ex.supersetGroupId) {
      const next = flat[i + 1]
      if (next && next.supersetGroupId === ex.supersetGroupId) {
        blocks.push([i, i + 1])
        i += 2
        continue
      }
    }
    blocks.push([i])
    i += 1
  }
  return blocks
}

function swapRoutineEditorBlocks(flat, blockIndex, direction) {
  if (!flat || flat.length === 0) return flat
  const blocks = getRoutineEditorOrderBlocks(flat)
  const j = blockIndex + direction
  if (j < 0 || j >= blocks.length) return flat
  const nextBlocks = [...blocks]
  ;[nextBlocks[blockIndex], nextBlocks[j]] = [nextBlocks[j], nextBlocks[blockIndex]]
  const order = nextBlocks.flat()
  return order.map((idx) => flat[idx])
}

// Default programme for testing: 2 Split Push/Pull (Day 1 Push 8×4, Day 2 Pull 8×4). Each exercise has fixed kg/reps (same for all sets).
function getDefault2SplitProgramme() {
  const progId = 'prog_default_2split'
  const rtnPushId = 'rtn_default_push'
  const rtnPullId = 'rtn_default_pull'
  const setConfig = (kg, reps) => Array.from({ length: 4 }, () => ({ targetKg: String(kg), targetReps: String(reps) }))
  const pushData = [
    ['Barbell Bench Press', '60', '10'],
    ['Incline Dumbbell Press', '22', '10'],
    ['Dumbbell Flyes', '12', '12'],
    ['Machine Chest Press', '40', '10'],
    ['Barbell Overhead Press', '40', '8'],
    ['Dumbbell Shoulder Press', '14', '10'],
    ['Lateral Raise', '8', '15'],
    ['Tricep Pushdown', '25', '10']
  ]
  const pullData = [
    ['Barbell Row', '70', '8'],
    ['Lat Pulldown', '45', '10'],
    ['Seated Cable Row', '35', '10'],
    ['Face Pull', '20', '15'],
    ['Dumbbell Row', '28', '10'],
    ['Pull-ups', '0', '10'],
    ['Inverted Row', '0', '10'],
    ['Barbell Curl', '20', '10']
  ]
  const routines = [
    { id: rtnPushId, name: 'Day 1 Push', programmeId: progId, exercises: pushData.map(([exerciseId, kg, reps]) => ({ exerciseId, setConfigs: setConfig(kg, reps), restOverride: null, rirOverride: null, note: '', supersetGroupId: null, supersetRole: null })) },
    { id: rtnPullId, name: 'Day 2 Pull', programmeId: progId, exercises: pullData.map(([exerciseId, kg, reps]) => ({ exerciseId, setConfigs: setConfig(kg, reps), restOverride: null, rirOverride: null, note: '', supersetGroupId: null, supersetRole: null })) }
  ]
  const programme = { id: progId, name: '2 Split Push/Pull', type: 'rotation', routineIds: [rtnPushId, rtnPullId], isActive: true, currentIndex: 0 }
  return { programme, routines }
}

function PlayIcon({ className = 'w-3.5 h-3.5' }) {
  return <svg viewBox="0 0 24 24" className={`${className} fill-current`}><polygon points="5 3 19 12 5 21 5 3"/></svg>
}

function HomeMuscleTag({ muscleId }) {
  const mg = MUSCLE_GROUPS[muscleId]
  const label = mg?.label ?? muscleId
  const style = mg ? { background: mg.bg, borderColor: `${mg.color}4D`, color: mg.color } : { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border" style={style}>
      {label}
    </span>
  )
}

function MusclePills({ exercises, getExerciseFromLibrary }) {
  const counts = {}
  for (const ex of exercises) {
    const lib = getExerciseFromLibrary(ex.name)
    const muscle = lib ? lib.muscle : 'other'
    counts[muscle] = (counts[muscle] || 0) + 1
  }
  const order = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio', 'mobility']
  const sorted = Object.entries(counts).sort((a, b) => {
    const ia = order.indexOf(a[0]), ib = order.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return (
    <div className="flex flex-wrap gap-1.5">
      {sorted.map(([muscle, count]) => {
        const mg = MUSCLE_GROUPS[muscle]
        if (!mg) return <span key={muscle} className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/5 text-muted">Other × {count}</span>
        return (
          <span key={muscle} className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: mg.bg, color: mg.color }}>
            {mg.label} × {count}
          </span>
        )
      })}
    </div>
  )
}

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length !== 3) return dateStr
  const d = new Date(parts[2], parts[1] - 1, parts[0])
  const now = new Date(); now.setHours(0,0,0,0); d.setHours(0,0,0,0)
  const diff = Math.floor((now - d) / (1000*60*60*24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff} days ago`
  if (diff < 14) return '1 week ago'
  if (diff < 30) return `${Math.floor(diff/7)} weeks ago`
  return dateStr
}

/** Resolve plan from Firestore user doc or localStorage fallback (mock / offline). */
function planFromUserData(userData) {
  const raw =
    userData?.plan !== undefined && userData?.plan !== null
      ? userData.plan
      : (typeof localStorage !== 'undefined' ? localStorage.getItem(USER_PLAN_STORAGE_KEY) : null)
  return normalizeUserPlan(raw)
}

function parseHistorySessionDateForCoachTip(w) {
  const parts = (w?.date || '').split('/')
  if (parts.length !== 3) return 0
  return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime()
}

function buildProgrammeSummaryForCoachTip(activeProgramme, routines) {
  if (!activeProgramme?.routineIds?.length) return null
  const rList = Array.isArray(routines) ? routines : []
  return {
    programmeName: activeProgramme.name,
    programmeType: activeProgramme.type,
    days: activeProgramme.routineIds.map((rid) => {
      const r = rList.find((x) => x.id === rid)
      return {
        dayName: r?.name || String(rid),
        exerciseNames: (r?.exercises || []).slice(0, 14).map((ex) => ex.name || ex.exerciseId).filter(Boolean),
      }
    }),
  }
}

/** Completed workouts saved to Firestore (excludes demo seed history). Used for Free rest-timer Coach tip. */
function historySessionsForCoachTip(history) {
  return (history || []).filter((w) => w.sessionId && !w._demoSeed)
}

/**
 * First workouts + active programme layout + today’s session for Free rest-timer tip (programme-first).
 */
function buildRestCoachTipContext(history, activeProgramme, routines, workoutName, todaysExercises) {
  const sessions = historySessionsForCoachTip(history)
  if (!Array.isArray(sessions) || sessions.length === 0) return null
  const sortedAsc = [...sessions].sort((a, b) => parseHistorySessionDateForCoachTip(a) - parseHistorySessionDateForCoachTip(b))
  const firstWorkouts = sortedAsc.slice(0, 6).map((s) => ({
    date: s.date,
    name: s.name,
    templateName: s.templateName,
    routineId: s.routineId,
    exerciseNames: (s.exercises || []).slice(0, 12).map((e) => e.name || e.exerciseId).filter(Boolean),
    exerciseSummaries: (s.exercises || []).slice(0, 8).map((e) => ({
      name: e.name || e.exerciseId,
      setCount: Array.isArray(e.sets) ? e.sets.length : 0,
      lastLoad:
        Array.isArray(e.sets) && e.sets.length
          ? e.sets[e.sets.length - 1]?.kg ?? e.sets[e.sets.length - 1]?.reps
          : undefined,
    })),
  }))
  const programme = buildProgrammeSummaryForCoachTip(activeProgramme, routines)
  const todaysSession = {
    workoutName: workoutName || null,
    exerciseNames: (todaysExercises || []).map((e) => e.name || e.exerciseId).filter(Boolean),
  }
  return {
    programme,
    firstWorkouts,
    todaysSession,
  }
}

function parseTimeToSeconds(t) {
  if (!t) return 0
  const str = String(t).trim()
  if (str.includes(':')) { const [m, s] = str.split(':'); return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0) }
  const n = parseInt(str, 10) || 0
  return n * 60
}

/** Only fields that belong on a saved template — never copy workout/rest-timer UI keys onto routines. */
function sanitizeTemplateSetForType(s, type) {
  const t = type || 'weight_reps'
  let base
  switch (t) {
    case 'bw_reps':
      base = { kg: s.kg ?? '', reps: s.reps ?? '', bwSign: s.bwSign ?? '+' }
      break
    case 'reps_only':
      base = { reps: s.reps ?? '' }
      break
    case 'time_only':
      base = { time: s.time ?? '' }
      break
    case 'distance_time':
      base = { distance: s.distance ?? '', time: s.time ?? '' }
      break
    default:
      base = { kg: s.kg ?? '', reps: s.reps ?? '' }
  }
  if (s.rir != null && s.rir !== '') base.rir = s.rir
  return base
}

/** Whitelist in-progress workout exercises for Firestore currentWorkout (no stray coach/UI fields). */
function sanitizeExerciseForCurrentWorkoutPersist(ex) {
  if (!ex || typeof ex !== 'object') return ex
  const sets = Array.isArray(ex.sets)
    ? ex.sets.map((s) => {
        if (!s || typeof s !== 'object') return s
        const o = {}
        for (const k of [
          'kg', 'reps', 'time', 'distance', 'bwSign', 'done', 'restTime', 'rir',
          'initialKg', 'initialReps', 'initialTime', 'initialDistance', 'initialBwSign',
        ]) {
          if (k in s) o[k] = s[k]
        }
        return o
      })
    : []
  const out = {
    name: ex.name,
    type: ex.type || 'weight_reps',
    sets,
    restOverride: ex.restOverride !== undefined ? ex.restOverride : null,
    rirOverride: ex.rirOverride ?? null,
    note: ex.note ?? '',
    muscle: ex.muscle,
    equipment: ex.equipment,
    movement: ex.movement,
    supersetGroupId: ex.supersetGroupId ?? null,
    supersetRole: ex.supersetRole ?? null,
  }
  if (ex.id) out.id = ex.id
  return out
}

/** Samme fuldskærms-spinner som under workout bootstrap — undgår hop mellem auth og app */
function FullScreenBootSpinner({ ariaBusy, ariaLive } = {}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-page"
      aria-busy={ariaBusy}
      aria-live={ariaLive}
    >
      <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullScreenBootSpinner />
  }
  if (!user) {
    return <LoginScreen />
  }

  return <AppContent />
}

function AppContent() {
  const [page, setPage] = useState('workout')
  const [workoutActive, setWorkoutActive] = useState(false)
  const [workoutName, setWorkoutName] = useState('')
  const [workoutStartTime, setWorkoutStartTime] = useState(null)
  const [workoutElapsed, setWorkoutElapsed] = useState(0)
  const [exercises, setExercises] = useState([])
  const [history, setHistory] = useState([])

  const [folders, setFolders] = useState([{ name: 'My Templates', open: true, templates: [] }])
  const [defaultRest, setDefaultRest] = useState(DEFAULT_SETTINGS.defaultRest)
  const [bodyweight, setBodyweight] = useState(DEFAULT_SETTINGS.bodyweight)
  const [weekStart, setWeekStart] = useState(DEFAULT_SETTINGS.weekStart) // 0=Monday
  const [unitWeight, setUnitWeight] = useState(DEFAULT_SETTINGS.unitWeight)
  const [unitDistance, setUnitDistance] = useState(DEFAULT_SETTINGS.unitDistance)
  const [unitLength, setUnitLength] = useState(DEFAULT_SETTINGS.unitLength)
  const [decimalSeparator, setDecimalSeparator] = useState(DEFAULT_SETTINGS.decimalSeparator)
  const [dateFormat, setDateFormat] = useState(DEFAULT_SETTINGS.dateFormat)
  const [showAddExercise, setShowAddExercise] = useState(false)
  /** Når sat: ExerciseLibrary er i replace-mode for aktiv workout / skabelon. */
  const [exerciseLibraryReplaceIndex, setExerciseLibraryReplaceIndex] = useState(null)
  /** Når sat: routine editor — vælg øvelse fra bibliotek for at erstatte denne rækkes exerciseId. */
  const [routineReplaceExerciseId, setRoutineReplaceExerciseId] = useState(null)
  const [showCreateExercise, setShowCreateExercise] = useState(false)
  const [editingCustomExercise, setEditingCustomExercise] = useState(null)
  const [customExercises, setCustomExercises] = useState([])
  const [activeRest, setActiveRest] = useState(null)
  const [restTime, setRestTime] = useState(0)
  const [restDuration, setRestDuration] = useState(90)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [showCompleteScreen, setShowCompleteScreen] = useState(false)
  const [completedWorkoutData, setCompletedWorkoutData] = useState(null)
  const [completeScreenRating, setCompleteScreenRating] = useState(null)
  const [postCompleteOpenPhoto, setPostCompleteOpenPhoto] = useState(false)
  /** Firestore workoutSessions doc id to attach photos to when opening Progress from complete screen (stable while modal is open). */
  const [photoLinkTargetSessionId, setPhotoLinkTargetSessionId] = useState(null)
  const [returnToWorkoutAfterPhotoClose, setReturnToWorkoutAfterPhotoClose] = useState(false)
  const [editingFolder, setEditingFolder] = useState(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showSaveAsRoutineModal, setShowSaveAsRoutineModal] = useState(false)
  const [deletingFolder, setDeletingFolder] = useState(null)
  const [deletingTemplate, setDeletingTemplate] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [showEmptyNameModal, setShowEmptyNameModal] = useState(false)
  const [emptyWorkoutName, setEmptyWorkoutName] = useState('')
  const [pendingStart, setPendingStart] = useState(null)
  const [incompleteSetsWarning, setIncompleteSetsWarning] = useState(null)
  const [showCancelWorkoutConfirm, setShowCancelWorkoutConfirm] = useState(false)
  const [showStickyRestBar, setShowStickyRestBar] = useState(false)
  /** Scroll-container i aktiv workout-sheet (til synlighed af primær resttimer vs. sticky top). */
  const workoutScrollAreaRef = useRef(null)
  const [workoutTab, setWorkoutTab] = useState('start') // 'start' | 'plan'
  const [profileSection, setProfileSection] = useState(null) // null | 'account' | 'settings' | 'about'
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [onboardingGateLoaded, setOnboardingGateLoaded] = useState(false)
  const [onboardingRequired, setOnboardingRequired] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [onboardingProgrammeFlowLaunched, setOnboardingProgrammeFlowLaunched] = useState(false)
  const [onboardingPrefsDraft, setOnboardingPrefsDraft] = useState({
    unitWeight: 'kg',
    unitDistance: 'km',
    unitLength: 'cm',
    decimalSeparator: 'comma',
    dateFormat: DATE_FORMAT_DDMY,
    bodyweightInput: '',
  })
  const [onboardingLegalChecked, setOnboardingLegalChecked] = useState(false)
  /** True after Welcome → Skip: user must accept terms, then lands on Workout with no programme. */
  const [onboardingTermsOnlyPath, setOnboardingTermsOnlyPath] = useState(false)
  const isOnboardingRouteRef = useRef(false)
  const workoutPlansLoadedRef = useRef(false)
  const workoutSessionsLoadedRef = useRef(false)
  const appDataLoadedRef = useRef(false)
  const [workoutSessionsLoaded, setWorkoutSessionsLoaded] = useState(false)
  const [appDataLoaded, setAppDataLoaded] = useState(false)
  const [workoutPlansLoaded, setWorkoutPlansLoaded] = useState(false)
  const [programmes, setProgrammes] = useState([])
  const [muscleLastWorked, setMuscleLastWorked] = useState({})
  const [routines, setRoutines] = useState([])
  const [showCreateProgramme, setShowCreateProgramme] = useState(false)
  const [createProgrammeFlowStep, setCreateProgrammeFlowStep] = useState(null) // 'entry' | 'choice' | 'coach'
  const [editingProgrammeId, setEditingProgrammeId] = useState(null)
  const [showCreateRoutine, setShowCreateRoutine] = useState(false)
  const [editingRoutineId, setEditingRoutineId] = useState(null)
  const [editingRoutineProgrammeId, setEditingRoutineProgrammeId] = useState(null)
  const [showExercisePickerForRoutine, setShowExercisePickerForRoutine] = useState(false)
  const [showDeleteProgrammeConfirm, setShowDeleteProgrammeConfirm] = useState(null)
  /** { progId, rtnId, name } når bruger vil slette en rutine fra Edit Programme. */
  const [editProgrammeRoutinePendingDelete, setEditProgrammeRoutinePendingDelete] = useState(null)
  const [showSetActiveAfterCreate, setShowSetActiveAfterCreate] = useState(null)
  const [showSetActiveAfterEditProgramme, setShowSetActiveAfterEditProgramme] = useState(null)
  const [dragRoutine, setDragRoutine] = useState(null) // { rtnId, progId }
  const [dragOverTarget, setDragOverTarget] = useState(null) // { type: 'index', progId, index } | { type: 'programme', progId } | null
  /** True når rutine-editoren åbnes ved tryk på rutine på Plan (ikke fra Edit programme-modal). */
  const routineEditorOpenedFromPlanRef = useRef(false)
  /** Snapshot ved åbning af Edit programme (navn, routineIds, fuld routine-data) til revert ved Cancel. */
  const editProgrammeSnapshotRef = useRef(null)
  /** Set each render while routine editor is mounted; used by styled discard confirm. */
  const routineEditorCloseRef = useRef(() => {})
  /** Baseline for create/edit routine — dirty check ved Cancel / backdrop. */
  const routineEditorBaselineRef = useRef(null)
  const routineEditorBaselineSessionRef = useRef(null)
  const [selectedStartRoutineId, setSelectedStartRoutineId] = useState(null) // which routine is selected on Start (null = Up Next)
  const [showStartRecoveryInfo, setShowStartRecoveryInfo] = useState(false)
  const [showActiveWorkoutSheet, setShowActiveWorkoutSheet] = useState(false)
  /** True kun når bruger trykker Continue fra minimeret WO — trigger scroll til aktiv øvelse når sheet åbnes. */
  const [activeWorkoutSheetContinueIntent, setActiveWorkoutSheetContinueIntent] = useState(false)
  const [createProgrammeName, setCreateProgrammeName] = useState('')
  const [createProgrammeRoutines, setCreateProgrammeRoutines] = useState([])
  /** Show create-programme validation / empty-routines hint only after Save is pressed (not by default). */
  const [createProgrammeTriedSave, setCreateProgrammeTriedSave] = useState(false)
  const [createProgrammeConfirmEmptyRoutines, setCreateProgrammeConfirmEmptyRoutines] = useState(false)
  const [showDiscardCreateProgrammeConfirm, setShowDiscardCreateProgrammeConfirm] = useState(false)
  const [showDiscardEditProgrammeConfirm, setShowDiscardEditProgrammeConfirm] = useState(false)
  const [showDiscardRoutineEditorConfirm, setShowDiscardRoutineEditorConfirm] = useState(false)
  const [editProgrammeName, setEditProgrammeName] = useState('')
  const [editRoutineName, setEditRoutineName] = useState('')
  const [editRoutineExercises, setEditRoutineExercises] = useState([])
  const [routineEditorRestForIndex, setRoutineEditorRestForIndex] = useState(null)
  const [routineEditorNoteForIndex, setRoutineEditorNoteForIndex] = useState(null)
  const [routineEditorRemoveNoteConfirmForExerciseId, setRoutineEditorRemoveNoteConfirmForExerciseId] = useState(null)
  const [routineEditorSupersetMenuForId, setRoutineEditorSupersetMenuForId] = useState(null)
  /** Routine editor: validation / empty-routine hint only after Save (not by default). */
  const [routineEditorTriedSave, setRoutineEditorTriedSave] = useState(false)
  const [routineEditorConfirmEmptyExercises, setRoutineEditorConfirmEmptyExercises] = useState(false)
  const [focusNewExerciseAt, setFocusNewExerciseAt] = useState(null)
  const [focusWorkoutFirstFieldAt, setFocusWorkoutFirstFieldAt] = useState(null) // exIndex to focus first set first field after adding
  const [rirEnabled, setRirEnabled] = useState(DEFAULT_SETTINGS.rirEnabled)
  const [pendingRir, setPendingRir] = useState(null)
  const [theme, setTheme] = useState(DEFAULT_SETTINGS.theme)
  const [weightLog, setWeightLog] = useState([])
  const [bodyFatLog, setBodyFatLog] = useState([])
  const [measurementsLog, setMeasurementsLog] = useState([])
  const [muscleMassLog, setMuscleMassLog] = useState([])
  const [photoSessions, setPhotoSessions] = useState([])
  const [userPlan, setUserPlan] = useState('free')
  const [planUsage, setPlanUsage] = useState(() => defaultPlanUsage())
  const [showPricing, setShowPricing] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [coachTipDismissed, setCoachTipDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem('coachTipDismissed') === 'true'
  )
  const [coachTipShown, setCoachTipShown] = useState(false)
  const [coachTipExIndex, setCoachTipExIndex] = useState(null)
  const [coachTipSetIndex, setCoachTipSetIndex] = useState(null)
  const [currentCoachTip, setCurrentCoachTip] = useState(null)
  const coachTipRequestIdRef = useRef(0)
  const setThemeAndApply = (t) => {
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
    if (user?.uid) mergeUserSettings(user.uid, { theme: t }).catch((err) => console.error('mergeUserSettings theme:', err))
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', t === 'bone' ? '#FAF7F2' : '#0D0D1A')
  }
  const restStartRef = useRef(null)
  /** Seneste completeRest — bruges af interval synk så vi ikke fanger forældet closure. */
  const completeRestRef = useRef(() => {})
  const restAudioCtxRef = useRef(null)
  const routineEditorFirstInputRef = useRef(null)
  const currentRoutineIdRef = useRef(null)
  const startedFromEmptyRef = useRef(false)

  const { linkMode, startLinkMode, confirmSuperset, cancelLinkMode, breakSuperset, getGrouped } = useSuperset(exercises, setExercises)
  const {
    linkMode: routineLinkMode,
    startLinkMode: routineStartLinkMode,
    confirmSuperset: routineConfirmSuperset,
    cancelLinkMode: routineCancelLinkMode,
    breakSuperset: routineBreakSuperset,
    getGrouped: getRoutineGrouped
  } = useSuperset(editRoutineExercises, setEditRoutineExercises)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (user?.uid && appDataLoadedRef.current) mergeUserSettings(user.uid, { theme }).catch((err) => console.error('mergeUserSettings theme:', err))
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'bone' ? '#FAF7F2' : '#0D0D1A')
  }, [theme, user?.uid])
  useEffect(() => { if (page === 'library') setPage('workout') }, [page])
  useEffect(() => { if (page !== 'profile') setProfileSection(null) }, [page])
  useEffect(() => {
    if (workoutTab !== 'start') setShowStartRecoveryInfo(false)
  }, [workoutTab])

  useEffect(() => {
    isOnboardingRouteRef.current = onboardingRequired && location.pathname === '/onboarding'
  }, [onboardingRequired, location.pathname])

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    ;(async () => {
      await ensureUserDoc(user)
      if (cancelled) return
      const d = await getUserDoc(user.uid)
      if (cancelled) return
      const need = d?.onboardingComplete === false
      setOnboardingRequired(need)
      if (need) {
        const st = typeof d?.onboardingStep === 'number' ? d.onboardingStep : 0
        setOnboardingStep(Math.min(3, Math.max(0, st)))
      }
      setOnboardingGateLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.uid])

  useEffect(() => {
    if (!onboardingGateLoaded || onboardingStep !== 1) return
    try {
      if (sessionStorage.getItem(ONBOARDING_TERMS_ONLY_KEY) === '1') setOnboardingTermsOnlyPath(true)
    } catch (_) {}
  }, [onboardingGateLoaded, onboardingStep])

  useEffect(() => {
    if (!onboardingGateLoaded) return
    if (location.pathname === '/') {
      navigate(onboardingRequired ? '/onboarding' : '/workout', { replace: true })
    }
  }, [onboardingGateLoaded, onboardingRequired, location.pathname, navigate])

  useEffect(() => {
    if (!onboardingGateLoaded) return
    if (onboardingRequired && location.pathname === '/workout') {
      navigate('/onboarding', { replace: true })
    }
  }, [onboardingGateLoaded, onboardingRequired, location.pathname, navigate])

  useEffect(() => {
    if (!onboardingGateLoaded) return
    if (!onboardingRequired && location.pathname === '/onboarding') {
      navigate('/workout', { replace: true })
    }
  }, [onboardingGateLoaded, onboardingRequired, location.pathname, navigate])

  useEffect(() => {
    function syncLegalHash() {
      const raw = (window.location.hash || '').replace(/\/$/, '')
      setShowPrivacy(raw === '#/privacy')
      setShowTerms(raw === '#/terms')
    }
    syncLegalHash()
    window.addEventListener('hashchange', syncLegalHash)
    return () => window.removeEventListener('hashchange', syncLegalHash)
  }, [])

  useEffect(() => {
    if (programmes.length === 1 && !programmes[0].isActive) {
      setProgrammes(prev => prev.map(p => ({ ...p, isActive: true })))
    }
  }, [programmes.length])

  // Load workout plans from Firestore when user is set
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    fetchWorkoutPlans(user.uid)
      .then(({ programmes: p, routines: r }) => {
        if (cancelled) return
        // Always sync from fetch (incl. empty after reset) — don’t leave stale state
        setProgrammes(Array.isArray(p) ? p : [])
        setRoutines(Array.isArray(r) ? r : [])
        // Only after successful load: enables save. (If we set ref on fetch error, save could run with [] and wipe Firestore.)
        workoutPlansLoadedRef.current = true
        setWorkoutPlansLoaded(true)
      })
      .catch((err) => {
        console.error('fetchWorkoutPlans:', err)
        if (!cancelled) setWorkoutPlansLoaded(true)
      })
    return () => { cancelled = true }
  }, [user?.uid])

  // Persist workout plans to Firestore when they change (after initial load)
  useEffect(() => {
    if (!user?.uid || !workoutPlansLoadedRef.current) return
    saveWorkoutPlans(user.uid, programmes, routines).catch((err) =>
      console.error('saveWorkoutPlans:', err)
    )
  }, [user?.uid, programmes, routines])

  // Load workout sessions (history) from Firestore when user is set (altid fra server)
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    fetchWorkoutSessionsFromServer(user.uid)
      .then((sessions) => {
        if (cancelled) return
        setHistory(sessions)
        workoutSessionsLoadedRef.current = true
        setWorkoutSessionsLoaded(true)
      })
      .catch((err) => {
        console.error('fetchWorkoutSessions (initial):', err?.code || err?.message || err)
        if (err?.code === 'permission-denied') console.error('Tjek Firestore Security Rules – læs skal tillades for users/{userId}/workoutSessions')
      })
    return () => { cancelled = true }
  }, [user?.uid])

  // Refetch ved skift af faner + når appen kommer i fokus (synk på tværs af devices)
  const pageRef = useRef(page)
  const userRef = useRef(user)
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { userRef.current = user }, [user])

  // Ved skift til Progress: hent sessions fra server (frisk synk)
  useEffect(() => {
    if (page !== 'progress' || !user?.uid) return
    let cancelled = false
    fetchWorkoutSessionsFromServer(user.uid)
      .then((sessions) => { if (cancelled) return; setHistory(sessions) })
      .catch((err) => console.error('fetchWorkoutSessions (progress):', err?.code || err?.message || err))
    return () => { cancelled = true }
  }, [page, user?.uid])

  // Mens brugeren er på Progress: opdater sessions fra server hvert 30. sekund (synk fra anden device)
  useEffect(() => {
    if (page !== 'progress' || !user?.uid) return
    const interval = setInterval(() => {
      fetchWorkoutSessionsFromServer(user.uid)
        .then((sessions) => setHistory(sessions))
        .catch((err) => console.error('fetchWorkoutSessions (interval):', err?.code || err?.message || err))
    }, 30000)
    return () => clearInterval(interval)
  }, [page, user?.uid])

  // NOTE: No refetch on every visit to Workout tab — it overwrote local state with a stale
  // Firestore read right after delete. Initial load uses [user.uid] above; refresh uses
  // visibility/focus refetchForCurrentPage.

  useEffect(() => {
    if (page !== 'profile' || !user?.uid) return
    let cancelled = false
    Promise.all([getUserDoc(user.uid), fetchAppData(user.uid)])
      .then(([userData, appData]) => {
        if (cancelled) return
        const settings = { ...DEFAULT_SETTINGS, ...(userData?.settings || {}) }
        setDefaultRest(settings.defaultRest ?? DEFAULT_SETTINGS.defaultRest)
        setBodyweight(settings.bodyweight ?? DEFAULT_SETTINGS.bodyweight)
        setWeekStart(settings.weekStart ?? DEFAULT_SETTINGS.weekStart)
        setUnitWeight(settings.unitWeight ?? DEFAULT_SETTINGS.unitWeight)
        setUnitDistance(settings.unitDistance ?? DEFAULT_SETTINGS.unitDistance)
        setUnitLength(settings.unitLength ?? DEFAULT_SETTINGS.unitLength)
        setDecimalSeparator(settings.decimalSeparator ?? DEFAULT_SETTINGS.decimalSeparator)
        setDateFormat(settings.dateFormat ?? DEFAULT_SETTINGS.dateFormat)
        setRirEnabled(settings.rirEnabled ?? DEFAULT_SETTINGS.rirEnabled)
        const themeVal = settings.theme ?? DEFAULT_SETTINGS.theme
        setTheme(themeVal === 'light-bone' ? 'bone' : themeVal)
        if (appData.folders?.length) setFolders(appData.folders)
        if (appData.customExercises?.length !== undefined) setCustomExercises(appData.customExercises || [])
        if (appData.weightLog?.length !== undefined) setWeightLog(appData.weightLog || [])
        if (appData.bodyFatLog?.length !== undefined) setBodyFatLog(appData.bodyFatLog || [])
        if (appData.measurementsLog?.length !== undefined) setMeasurementsLog(appData.measurementsLog || [])
        if (appData.muscleMassLog?.length !== undefined) setMuscleMassLog(appData.muscleMassLog || [])
        if (appData.photoSessions?.length !== undefined) setPhotoSessions(appData.photoSessions || [])
        if (appData.muscleLastWorked && Object.keys(appData.muscleLastWorked).length >= 0) setMuscleLastWorked(appData.muscleLastWorked || {})
        setUserPlan(planFromUserData(userData))
        syncPlanUsagePeriod(user.uid, userData?.planUsage)
          .then((u) => {
            if (!cancelled) setPlanUsage(u)
          })
          .catch(() => {
            if (!cancelled) setPlanUsage(mergePlanUsage(userData?.planUsage))
          })
      })
      .catch((err) => console.error('load user/appData (profile):', err?.code || err?.message || err))
    return () => { cancelled = true }
  }, [page, user?.uid])

  // Fælles refetch-logik ved synk (visibility/focus) – bruger server så cache ikke viser gammel data
  const refetchForCurrentPage = () => {
    const uid = userRef.current?.uid
    const currentPage = pageRef.current
    if (!uid) return
    if (currentPage === 'progress') {
      fetchWorkoutSessionsFromServer(uid).then((sessions) => setHistory(sessions)).catch((err) => console.error('fetchWorkoutSessions (visibility/focus):', err?.code || err?.message || err))
    } else if (currentPage === 'workout' || currentPage === 'coach') {
      fetchWorkoutPlans(uid).then(({ programmes: p, routines: r }) => {
        setProgrammes(Array.isArray(p) ? p : [])
        setRoutines(Array.isArray(r) ? r : [])
      }).catch(() => {})
    } else if (currentPage === 'profile') {
      Promise.all([getUserDoc(uid), fetchAppData(uid)]).then(([userData, appData]) => {
        const settings = { ...DEFAULT_SETTINGS, ...(userData?.settings || {}) }
        setDefaultRest(settings.defaultRest ?? DEFAULT_SETTINGS.defaultRest)
        setBodyweight(settings.bodyweight ?? DEFAULT_SETTINGS.bodyweight)
        setWeekStart(settings.weekStart ?? DEFAULT_SETTINGS.weekStart)
        setUnitWeight(settings.unitWeight ?? DEFAULT_SETTINGS.unitWeight)
        setUnitDistance(settings.unitDistance ?? DEFAULT_SETTINGS.unitDistance)
        setUnitLength(settings.unitLength ?? DEFAULT_SETTINGS.unitLength)
        setDecimalSeparator(settings.decimalSeparator ?? DEFAULT_SETTINGS.decimalSeparator)
        setDateFormat(settings.dateFormat ?? DEFAULT_SETTINGS.dateFormat)
        setRirEnabled(settings.rirEnabled ?? DEFAULT_SETTINGS.rirEnabled)
        const themeVal = settings.theme ?? DEFAULT_SETTINGS.theme
        setTheme(themeVal === 'light-bone' ? 'bone' : themeVal)
        if (appData.folders?.length) setFolders(appData.folders)
        if (appData.customExercises?.length !== undefined) setCustomExercises(appData.customExercises || [])
        if (appData.weightLog?.length !== undefined) setWeightLog(appData.weightLog || [])
        if (appData.bodyFatLog?.length !== undefined) setBodyFatLog(appData.bodyFatLog || [])
        if (appData.measurementsLog?.length !== undefined) setMeasurementsLog(appData.measurementsLog || [])
        if (appData.muscleMassLog?.length !== undefined) setMuscleMassLog(appData.muscleMassLog || [])
        if (appData.photoSessions?.length !== undefined) setPhotoSessions(appData.photoSessions || [])
        if (appData.muscleLastWorked && Object.keys(appData.muscleLastWorked).length >= 0) setMuscleLastWorked(appData.muscleLastWorked || {})
        setUserPlan(planFromUserData(userData))
        syncPlanUsagePeriod(uid, userData?.planUsage)
          .then(setPlanUsage)
          .catch(() => setPlanUsage(mergePlanUsage(userData?.planUsage)))
      }).catch(() => {})
    }
  }

  // Når app-tab/browser kommer i fokus eller synlig: refetch fra server (synk fra anden device).
  // Vi henter altid workout history når appen bliver synlig, så telefon får data fra Mac selv om bruger ikke lige er på Progress.
  const refetchHistoryWhenVisible = () => {
    const uid = userRef.current?.uid
    if (!uid) return
    fetchWorkoutSessionsFromServer(uid)
      .then((sessions) => setHistory(sessions))
      .catch((err) => console.error('fetchWorkoutSessions (visible/focus):', err?.code || err?.message || err))
  }

  useEffect(() => {
    if (!user?.uid) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      refetchHistoryWhenVisible()
      refetchForCurrentPage()
    }
    const onFocus = () => {
      refetchHistoryWhenVisible()
      refetchForCurrentPage()
    }
    const onPageShow = (e) => {
      if (e.persisted) refetchHistoryWhenVisible()
      refetchForCurrentPage()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [user?.uid])

  // Load user settings + app data (folders, logs, etc.) when user is set
  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    Promise.all([getUserDoc(user.uid), fetchAppData(user.uid)])
      .then(([userData, appData]) => {
        if (cancelled) return
        const settings = { ...DEFAULT_SETTINGS, ...(userData?.settings || {}) }
        setDefaultRest(settings.defaultRest ?? DEFAULT_SETTINGS.defaultRest)
        setBodyweight(settings.bodyweight ?? DEFAULT_SETTINGS.bodyweight)
        setWeekStart(settings.weekStart ?? DEFAULT_SETTINGS.weekStart)
        setUnitWeight(settings.unitWeight ?? DEFAULT_SETTINGS.unitWeight)
        setUnitDistance(settings.unitDistance ?? DEFAULT_SETTINGS.unitDistance)
        setUnitLength(settings.unitLength ?? DEFAULT_SETTINGS.unitLength)
        setDecimalSeparator(settings.decimalSeparator ?? DEFAULT_SETTINGS.decimalSeparator)
        setDateFormat(settings.dateFormat ?? DEFAULT_SETTINGS.dateFormat)
        setRirEnabled(settings.rirEnabled ?? DEFAULT_SETTINGS.rirEnabled)
        const themeVal = settings.theme ?? DEFAULT_SETTINGS.theme
        setTheme(themeVal === 'light-bone' ? 'bone' : themeVal)
        if (appData.folders?.length) setFolders(appData.folders)
        if (appData.customExercises?.length !== undefined) setCustomExercises(appData.customExercises || [])
        if (appData.weightLog?.length !== undefined) setWeightLog(appData.weightLog || [])
        if (appData.bodyFatLog?.length !== undefined) setBodyFatLog(appData.bodyFatLog || [])
        if (appData.measurementsLog?.length !== undefined) setMeasurementsLog(appData.measurementsLog || [])
        if (appData.muscleMassLog?.length !== undefined) setMuscleMassLog(appData.muscleMassLog || [])
        if (appData.photoSessions?.length !== undefined) setPhotoSessions(appData.photoSessions || [])
        if (appData.muscleLastWorked && Object.keys(appData.muscleLastWorked).length >= 0) setMuscleLastWorked(appData.muscleLastWorked || {})
        setUserPlan(planFromUserData(userData))
        syncPlanUsagePeriod(user.uid, userData?.planUsage)
          .then((u) => {
            if (!cancelled) setPlanUsage(u)
          })
          .catch(() => {
            if (!cancelled) setPlanUsage(mergePlanUsage(userData?.planUsage))
          })
        const cw = appData.currentWorkout
        if (cw?.exercises?.length) {
          const list = (cw.exercises || []).map((ex) =>
            sanitizeExerciseForCurrentWorkoutPersist({ ...ex, id: ex.id ?? crypto.randomUUID() })
          )
          setExercises(list)
          setWorkoutName(cw.workoutName || '')
          setWorkoutStartTime(cw.workoutStartTime ?? null)
          setWorkoutActive(true)
          setShowActiveWorkoutSheet(true)
        }
      })
      .catch((err) => {
        console.error('load user/appData:', err?.code || err?.message || err)
        if (err?.code === 'permission-denied') console.error('Tjek Firestore Rules – læs for users/{userId} og users/{userId}/appData')
      })
      .finally(() => {
        if (!cancelled) {
          appDataLoadedRef.current = true
          setAppDataLoaded(true)
        }
      })
    return () => { cancelled = true }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid || !appDataLoadedRef.current) return
    const payload =
      workoutActive && (exercises.length > 0 || workoutName)
        ? {
            workoutName,
            workoutStartTime,
            exercises: exercises.map(sanitizeExerciseForCurrentWorkoutPersist),
          }
        : null
    updateAppData(user.uid, { currentWorkout: payload }).catch((err) =>
      console.error('updateAppData currentWorkout:', err)
    )
  }, [user?.uid, workoutActive, workoutName, workoutStartTime, exercises])

  useEffect(() => {
    if (!user?.uid || !appDataLoadedRef.current) return
    updateAppData(user.uid, { folders }).catch((err) => console.error('updateAppData folders:', err))
  }, [user?.uid, folders])
  useEffect(() => {
    if (!user?.uid || !appDataLoadedRef.current) return
    mergeUserSettings(user.uid, { defaultRest, bodyweight, weekStart, unitWeight, unitDistance, unitLength, decimalSeparator, dateFormat, rirEnabled }).catch((err) => console.error('mergeUserSettings:', err))
  }, [user?.uid, defaultRest, bodyweight, weekStart, unitWeight, unitDistance, unitLength, decimalSeparator, dateFormat, rirEnabled])
  useEffect(() => {
    if (!user?.uid || !appDataLoadedRef.current) return
    updateAppData(user.uid, { customExercises, weightLog, bodyFatLog, measurementsLog, muscleMassLog, photoSessions, muscleLastWorked }).catch((err) => console.error('updateAppData:', err))
  }, [user?.uid, customExercises, weightLog, bodyFatLog, measurementsLog, muscleMassLog, photoSessions, muscleLastWorked])

  useEffect(() => {
    if (editingProgrammeId) {
      const prog = programmes.find(p => p.id === editingProgrammeId)
      setEditProgrammeName(prog?.name ?? '')
    }
  }, [editingProgrammeId])

  useEffect(() => {
    if (showCreateProgramme) {
      setCreateProgrammeTriedSave(false)
      setCreateProgrammeConfirmEmptyRoutines(false)
      setShowDiscardCreateProgrammeConfirm(false)
    }
  }, [showCreateProgramme])

  useEffect(() => {
    if (createProgrammeRoutines.length > 0) setCreateProgrammeConfirmEmptyRoutines(false)
  }, [createProgrammeRoutines.length])

  useEffect(() => {
    if (showCreateRoutine || editingRoutineId) {
      setRoutineEditorTriedSave(false)
      setRoutineEditorConfirmEmptyExercises(false)
    }
  }, [showCreateRoutine, editingRoutineId])

  useEffect(() => {
    if (editRoutineExercises.length > 0) setRoutineEditorConfirmEmptyExercises(false)
  }, [editRoutineExercises.length])

  // Workout restore from Firestore currentWorkout is done in the user+appData load effect above.

  useEffect(() => {
    if (focusNewExerciseAt === null) return
    const t = setTimeout(() => {
      routineEditorFirstInputRef.current?.focus()
      setFocusNewExerciseAt(null)
    }, 150)
    return () => clearTimeout(t)
  }, [focusNewExerciseAt])

  useEffect(() => {
    if (focusWorkoutFirstFieldAt === null || focusWorkoutFirstFieldAt >= exercises.length) return
    const ex = exercises[focusWorkoutFirstFieldAt]
    const type = ex?.type || 'weight_reps'
    let field = 'kg'
    if (type === 'reps_only') field = 'reps'
    else if (type === 'time_only') field = 'time'
    else if (type === 'distance_time') field = 'distance'
    const t = setTimeout(() => {
      const input = document.querySelector(`[data-ex="${focusWorkoutFirstFieldAt}"][data-set="0"][data-field="${field}"]`)
      if (input) input.focus()
      setFocusWorkoutFirstFieldAt(null)
    }, 100)
    return () => clearTimeout(t)
  }, [focusWorkoutFirstFieldAt, exercises])

  useEffect(() => {
    if (programmes.length > 0) return
    const firstFolder = folders[0]
    const hasTemplates = firstFolder?.templates?.length > 0
    const ts = Date.now()
    const progId = 'prog_' + ts
    if (hasTemplates) {
      const routineIds = firstFolder.templates.map((_, i) => 'rtn_' + ts + '_' + i)
      const newRoutines = firstFolder.templates.map((t, i) => ({
        id: routineIds[i],
        name: t.name,
        programmeId: progId,
        exercises: t.exercises.map(ex => ({
          exerciseId: ex.name,
          sets: ex.sets?.length ?? 4,
          targetReps: (ex.sets?.[0]?.reps != null) ? String(ex.sets[0].reps) : '8-10'
        }))
      }))
      setRoutines(newRoutines)
      setProgrammes([{
        id: progId,
        name: firstFolder.name || 'Imported programme',
        type: 'rotation',
        routineIds,
        isActive: true,
        currentIndex: 0
      }])
    }
  }, [programmes.length, folders])

  // Migrate away legacy auto names like "My New Program 1"
  useEffect(() => {
    if (programmes.length === 0) return
    const hasLegacy = programmes.some(p => typeof p.name === 'string' && p.name.startsWith('My New Program'))
    if (!hasLegacy) return
    setProgrammes(prev => prev.map(p => (typeof p.name === 'string' && p.name.startsWith('My New Program')) ? { ...p, name: 'Programme' } : p))
  }, [programmes.length])


  useEffect(() => {
    if (!workoutActive || !workoutStartTime) return
    const tick = () => setWorkoutElapsed(Math.floor((Date.now() - workoutStartTime) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [workoutActive, workoutStartTime])

  /** Sticky top resttimer kun når primær timer ikke overlapper scroll-området (så den er synlig). */
  function updateStickyRestVisibility(scrollEl) {
    if (!scrollEl) return
    const restEl = scrollEl.querySelector('[data-rest-active="1"]')
    if (!restEl) {
      setShowStickyRestBar(prev => (prev ? false : prev))
      return
    }
    const parentRect = scrollEl.getBoundingClientRect()
    const rect = restEl.getBoundingClientRect()
    const intersects = rect.bottom > parentRect.top && rect.top < parentRect.bottom
    const shouldShow = !intersects
    setShowStickyRestBar(prev => (prev === shouldShow ? prev : shouldShow))
  }

  function handleWorkoutScroll(e) {
    updateStickyRestVisibility(e.currentTarget)
  }

  useLayoutEffect(() => {
    if (!workoutActive || !showActiveWorkoutSheet || showCompleteScreen) return
    const el = workoutScrollAreaRef.current
    if (!el) return
    const run = () => updateStickyRestVisibility(el)
    run()
    let raf2
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(run)
    })
    return () => {
      cancelAnimationFrame(raf1)
      if (raf2 != null) cancelAnimationFrame(raf2)
    }
  }, [
    activeRest,
    restTime,
    exercises,
    workoutActive,
    showActiveWorkoutSheet,
    showCompleteScreen,
    page,
  ])

  function playRestSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      let ctx = restAudioCtxRef.current
      if (!ctx) {
        ctx = new AudioCtx()
        restAudioCtxRef.current = ctx
      }
      const now = ctx.currentTime
      /** Dobbelt bip (660 Hz → 880 Hz), samme karakter som rest-sound-preview-2. */
      const tone = (freq, start, duration) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + duration + 0.02)
      }
      tone(660, now + 0.05, 0.12)
      tone(880, now + 0.22, 0.14)
    } catch (_) {
      // ignore audio errors (e.g. autoplay restrictions)
    }
  }

  function completeRest() {
    if (!activeRest) return
    const start = restStartRef.current
    if (start == null) return
    const { exIndex, setIndex } = activeRest
    restStartRef.current = null
    const elapsed = Math.max(1, Math.floor((Date.now() - start) / 1000))
    const n = [...exercises]; n[exIndex].sets[setIndex].restTime = elapsed
    setExercises(n); setActiveRest(null); setRestTime(0)
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    playRestSound()
  }
  completeRestRef.current = completeRest

  // Nedtælling fra vægur (Date.now − start): virker når fanen er i baggrunden, hvor setTimeout throttles.
  useEffect(() => {
    if (!activeRest || restStartRef.current == null) return

    const sync = () => {
      const start = restStartRef.current
      if (start == null) return
      const elapsed = Math.floor((Date.now() - start) / 1000)
      const remaining = Math.max(0, restDuration - elapsed)
      setRestTime(remaining)
      if (remaining <= 0) completeRestRef.current()
    }

    sync()
    const intervalId = window.setInterval(sync, 1000)
    const onResume = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onResume)
    window.addEventListener('focus', onResume)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onResume)
      window.removeEventListener('focus', onResume)
    }
  }, [activeRest, restDuration])
  function tryStart(type, data) {
    if (workoutActive && exercises.length > 0) { setPendingStart({ type, data }); return }
    executeStart(type, data)
  }

  function executeStart(type, data) {
    const now = Date.now()
    currentRoutineIdRef.current = null
    startedFromEmptyRef.current = type === 'empty'
    if (type === 'template') {
      if (!data || !Array.isArray(data.exercises)) return
      setWorkoutName(data.name || '')
      setExercises(data.exercises.map(ex => ({
        name: ex.name,
        type: ex.type || 'weight_reps',
        sets: (ex.sets || []).map(s => ({
          ...s,
          done: false,
          initialKg: s.kg,
          initialReps: s.reps,
          initialTime: s.time,
          initialDistance: s.distance,
          initialBwSign: s.bwSign ?? '+'
        })),
        restOverride: ex.restOverride !== undefined ? ex.restOverride : null,
        note: ex.note || '',
        muscle: ex.muscle,
        equipment: ex.equipment,
        movement: ex.movement
      })))
    } else if (type === 'routine') {
      if (!data || data.id == null) return
      currentRoutineIdRef.current = data.id
      setWorkoutName(data.name || '')
      setExercises(routineToWorkoutExercises(data))
    } else if (type === 'last') {
      if (!data || !Array.isArray(data.exercises)) return
      setWorkoutName(data.name || data.date)
      setExercises(data.exercises.map(ex => ({
        name: ex.name,
        type: ex.type || 'weight_reps',
        sets: (ex.sets || []).map(s => ({
          ...s,
          done: false,
          initialKg: s.kg,
          initialReps: s.reps,
          initialTime: s.time,
          initialDistance: s.distance,
          initialBwSign: s.bwSign ?? '+'
        })),
        restOverride: ex.restOverride !== undefined ? ex.restOverride : null,
        note: ex.note || '',
        muscle: ex.muscle,
        equipment: ex.equipment,
        movement: ex.movement
      })))
    } else if (type === 'empty') {
      const nm = typeof data?.name === 'string' ? data.name.trim() : ''
      if (!nm) return
      setWorkoutName(nm)
      setExercises([])
    }
    setWorkoutActive(true); setWorkoutStartTime(now); setWorkoutElapsed(0)
    setActiveRest(null); setRestTime(0); setPendingStart(null); setPendingRir(null)
    setShowActiveWorkoutSheet(true)
  }

  function confirmDiscardAndStart() { if (!pendingStart) return; setExercises([]); setActiveRest(null); setRestTime(0); executeStart(pendingStart.type, pendingStart.data) }
  function startEmpty() { setEmptyWorkoutName(''); setShowEmptyNameModal(true) }
  function confirmEmptyStart() { if (!emptyWorkoutName) return; setShowEmptyNameModal(false); tryStart('empty', { name: emptyWorkoutName }) }

  function getSuggestedNext() {
    if (history.length === 0) return null
    const last = history[0]; const ltn = last.templateName
    if (!ltn) return null
    for (let fi = 0; fi < folders.length; fi++) {
      const folder = folders[fi]
      for (let ti = 0; ti < folder.templates.length; ti++) {
        if (folder.templates[ti].name === ltn) {
          const next = (ti + 1) % folder.templates.length
          return { template: folder.templates[next], folderName: folder.name }
        }
      }
    }
    return null
  }

  const activeProgramme = programmes.find(p => p.isActive) || null

  function getDaysSinceRoutine(rtnId) {
    const withRoutine = history.filter(w => w.routineId === rtnId)
    if (withRoutine.length === 0) return null
    const parseDate = (w) => {
      const parts = (w.date || '').split('/')
      if (parts.length !== 3) return 0
      return new Date(parts[2], parts[1] - 1, parts[0]).getTime()
    }
    const latest = withRoutine.sort((a, b) => parseDate(b) - parseDate(a))[0]
    const parts = (latest.date || '').split('/')
    if (parts.length !== 3) return null
    const d = new Date(parts[2], parts[1] - 1, parts[0])
    const now = new Date(); now.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0)
    return Math.floor((now - d) / (1000 * 60 * 60 * 24))
  }

  function getNextRoutine(programme, workoutHistory) {
    const routineIds = programme?.routineIds || []
    if (!routineIds.length) return null
    let idx = programme.currentIndex
    if (idx === undefined || idx === null) {
      const parseDate = (w) => {
        const parts = (w.date || '').split('/')
        if (parts.length !== 3) return 0
        return new Date(parts[2], parts[1] - 1, parts[0]).getTime()
      }
      const lastCompleted = (workoutHistory || [])
        .filter(w => w.routineId && routineIds.includes(w.routineId))
        .sort((a, b) => parseDate(b) - parseDate(a))[0]
      idx = lastCompleted ? (routineIds.indexOf(lastCompleted.routineId) + 1) % routineIds.length : 0
    }
    idx = ((idx % routineIds.length) + routineIds.length) % routineIds.length
    return routineIds[idx]
  }

  function advanceProgrammeRotation(routineId) {
    const prog = programmes.find(p => p.routineIds?.includes(routineId))
    if (!prog?.routineIds?.length) return
    const idx = prog.routineIds.indexOf(routineId)
    if (idx < 0) return
    const nextIndex = (idx + 1) % prog.routineIds.length
    setProgrammes(prev => prev.map(p => p.id !== prog.id ? p : { ...p, currentIndex: nextIndex }))
  }

  function getSetConfigs(ex) {
    if (Array.isArray(ex.setConfigs)) {
      if (ex.setConfigs.length === 0) return []
      return ex.setConfigs.map((s) => ({ targetReps: s.targetReps ?? '8-10', targetKg: s.targetKg ?? '' }))
    }
    const n = typeof ex.sets === 'number' ? Math.max(1, ex.sets) : 4
    return Array.from({ length: n }, () => ({ targetReps: ex.targetReps || '8-10', targetKg: '' }))
  }

  function serializeRoutineExercisesForCompare(list) {
    return JSON.stringify(
      (list || []).map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        setConfigs: getSetConfigs(ex).map((s) => ({
          targetReps: String(s.targetReps ?? ''),
          targetKg: String(s.targetKg ?? ''),
        })),
        restOverride: ex.restOverride ?? null,
        note: String(ex.note ?? '').trim(),
        supersetGroupId: ex.supersetGroupId ?? null,
        supersetRole: ex.supersetRole ?? null,
      }))
    )
  }

  useLayoutEffect(() => {
    if (!showCreateRoutine && !editingRoutineId) {
      routineEditorBaselineSessionRef.current = null
      routineEditorBaselineRef.current = null
      return
    }
    const key = editingRoutineId ? `e:${editingRoutineId}` : `c:${editingRoutineProgrammeId ?? 'none'}`
    if (routineEditorBaselineSessionRef.current === key) return
    routineEditorBaselineSessionRef.current = key
    routineEditorBaselineRef.current = {
      name: editRoutineName,
      programmeName: editProgrammeName,
      exercisesJson: serializeRoutineExercisesForCompare(editRoutineExercises),
    }
  }, [showCreateRoutine, editingRoutineId, editingRoutineProgrammeId])

  function routineToWorkoutExercises(routine) {
    if (!routine?.exercises?.length) return []
    return routine.exercises.map(ex => {
      const lib = getExerciseFromLibrary(ex.exerciseId)
      const type = lib?.type || 'weight_reps'
      const setConfigs = getSetConfigs(ex)
      const sets = setConfigs.map((cfg) => {
        const empty = emptySetForType(type)
        const kg = cfg.targetKg ?? ''
        const reps = cfg.targetReps ?? ''
        if (type === 'time_only') {
          const timeStr = String(reps ?? '').trim()
          return { ...empty, time: timeStr, initialTime: timeStr }
        }
        if (type === 'reps_only') {
          const r = String(reps ?? '').trim()
          return { ...empty, reps: r, initialReps: r }
        }
        if (type === 'distance_time') {
          const dist = String(kg ?? '').trim()
          const tim = String(reps ?? '').trim()
          return {
            ...empty,
            distance: dist,
            time: tim,
            initialDistance: dist,
            initialTime: tim,
          }
        }
        return {
          ...empty,
          kg,
          reps,
          initialKg: kg,
          initialReps: reps,
          initialTime: empty.time,
          initialDistance: empty.distance,
          initialBwSign: empty.bwSign || '+',
        }
      })
      return {
        id: crypto.randomUUID(),
        name: ex.exerciseId,
        type,
        sets,
        restOverride: ex.restOverride !== undefined ? ex.restOverride : null,
        rirOverride: ex.rirOverride ?? null,
        note: ex.note ?? '',
        muscle: lib?.muscle,
        equipment: lib?.equipment,
        movement: lib?.movement,
        supersetGroupId: ex.supersetGroupId ?? null,
        supersetRole: ex.supersetRole ?? null
      }
    })
  }

  function setProgrammeActive(progId) {
    setProgrammes(prev => prev.map(p => ({ ...p, isActive: p.id === progId })))
  }

  function createProgramme() {
    setCreateProgrammeName('')
    setCreateProgrammeFlowStep('entry')
    setEditingProgrammeId(null)
  }
  function openManualCreateProgramme() {
    setCreateProgrammeFlowStep(null)
    setCreateProgrammeName('')
    setShowCreateProgramme(true)
    setEditingProgrammeId(null)
  }

  /** Complete onboarding and leave — after first programme save, or Skip from legal. Lands on Workout → Start (empty programme state when none exist). */
  function finishOnboardingAfterProgramme() {
    const uid = user?.uid
    if (!uid || !isOnboardingRouteRef.current) return
    setOnboardingProgrammeFlowLaunched(false)
    setCreateProgrammeFlowStep(null)
    void completeUserOnboarding(uid)
      .then(() => {
        setOnboardingRequired(false)
        setPage('workout')
        setWorkoutTab('start')
        setSelectedStartRoutineId(null)
        navigate('/workout', { replace: true })
      })
      .catch((err) => console.error('completeUserOnboarding:', err))
  }

  function saveNewProgramme(name, type, routineIdsToSave, newRoutinesData) {
    const ts = Date.now()
    const progId = 'prog_' + ts
    const newRoutines = (newRoutinesData || []).map((r, i) => ({
      id: 'rtn_' + ts + '_' + i,
      name: r.name || 'New Routine',
      programmeId: progId,
      exercises: r.exercises || []
    }))
    const routineIds = newRoutines.map(r => r.id)
    const isFirstProgramme = programmes.length === 0
    setRoutines(prev => [...prev, ...newRoutines])
    setProgrammes(prev => [
      ...prev,
      {
        id: progId,
        name: (name && name.trim()) ? name.trim() : '2 Split - Push/Pull',
        type: type || 'rotation',
        routineIds,
        isActive: isFirstProgramme,
        currentIndex: 0
      }
    ])
    setShowDiscardCreateProgrammeConfirm(false)
    setShowCreateProgramme(false)
    if (!isFirstProgramme) setShowSetActiveAfterCreate(progId)
    if (isOnboardingRouteRef.current && user?.uid) {
      finishOnboardingAfterProgramme()
    }
  }

  /**
   * Gem Coach-program + routines (samme state/Firestore-sti som manuelle programmer via saveWorkoutPlans-useEffect).
   * @param {{ programme: object, routines: object[] }} payload — fra buildProgrammeFromCoach
   * @param {boolean} makeActive — true = "Save & make active"
   */
  function handleCoachGenerationSuccess() {
    const uid = user?.uid
    if (!uid) return Promise.resolve()
    return incrementPlanUsage(uid, { coachGenerations: 1 })
      .then(setPlanUsage)
      .catch((err) => console.error('planUsage coach generation:', err?.code || err?.message || err))
  }

  /** Progress photo limits are total slots in appData (Free/Pro), not planUsage. */
  function handleProgressPhotoAdded() {}

  function handleProgressPhotoRemoved(_count) {}

  function saveCoachGeneratedProgramme(payload, makeActive) {
    if (!user?.uid || !payload?.programme || !Array.isArray(payload.routines)) return
    const { programme: progIn, routines: newRoutines } = payload
    const isFirstProgramme = programmes.length === 0
    const wantsActive = makeActive === true || progIn.isActive === true
    const finalActive = wantsActive || isFirstProgramme

    const progEntry = {
      ...progIn,
      routineIds: [...(progIn.routineIds || [])],
      isActive: finalActive,
      currentIndex: progIn.currentIndex ?? 0,
    }

    setRoutines((prev) => [...prev, ...newRoutines])
    setProgrammes((prev) => {
      const base = finalActive ? prev.map((p) => ({ ...p, isActive: false })) : prev
      return [...base, progEntry]
    })
    setCreateProgrammeFlowStep(null)
    if (!finalActive && !isFirstProgramme) setShowSetActiveAfterCreate(progIn.id)
    incrementPlanUsage(user.uid, { coachProgrammesSaved: 1 })
      .then(setPlanUsage)
      .catch((err) => console.error('planUsage coach programme saved:', err?.code || err?.message || err))
    if (isOnboardingRouteRef.current && user?.uid) {
      finishOnboardingAfterProgramme()
    }
  }

  function openEditProgramme(progId) {
    const prog = programmes.find(p => p.id === progId)
    if (prog) {
      setEditProgrammeName(prog.name)
      const ids = [...(prog.routineIds || [])]
      const snapRoutines = ids
        .map((id) => routines.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => JSON.parse(JSON.stringify(r)))
      editProgrammeSnapshotRef.current = {
        progId,
        name: prog.name,
        routineIds: ids,
        routines: snapRoutines,
      }
    } else {
      editProgrammeSnapshotRef.current = null
    }
    setEditingProgrammeId(progId)
  }

  function isEditProgrammeDirty() {
    const snap = editProgrammeSnapshotRef.current
    if (!snap || !editingProgrammeId || snap.progId !== editingProgrammeId) return false
    const prog = programmes.find((p) => p.id === editingProgrammeId)
    if (!prog) return false
    if ((editProgrammeName ?? '').trim() !== (snap.name ?? '').trim()) return true
    if (JSON.stringify(prog.routineIds || []) !== JSON.stringify(snap.routineIds)) return true
    return false
  }

  function revertEditProgrammeSnapshot() {
    const snap = editProgrammeSnapshotRef.current
    if (!snap) return
    const { progId, name, routineIds, routines: snapRoutines } = snap
    const snapIds = new Set(routineIds)
    setProgrammes((prev) =>
      prev.map((p) => (p.id === progId ? { ...p, name, routineIds: [...routineIds] } : p))
    )
    setRoutines((prev) => {
      const next = prev.filter((r) => !(r.programmeId === progId && !snapIds.has(r.id)))
      const byId = Object.fromEntries(next.map((r) => [r.id, r]))
      for (const sr of snapRoutines) {
        byId[sr.id] = JSON.parse(JSON.stringify(sr))
      }
      return Object.values(byId)
    })
    setEditProgrammeName(name)
  }

  function requestCloseEditProgramme() {
    const finish = () => {
      setEditingProgrammeId(null)
      setDragRoutine(null)
      setDragOverTarget(null)
      setEditProgrammeRoutinePendingDelete(null)
      editProgrammeSnapshotRef.current = null
    }
    if (!isEditProgrammeDirty()) {
      finish()
      return
    }
    setShowDiscardEditProgrammeConfirm(true)
  }

  function confirmDiscardEditProgramme() {
    revertEditProgrammeSnapshot()
    setEditingProgrammeId(null)
    setDragRoutine(null)
    setDragOverTarget(null)
    setEditProgrammeRoutinePendingDelete(null)
    editProgrammeSnapshotRef.current = null
    setShowDiscardEditProgrammeConfirm(false)
  }

  function resetCreateProgrammeModalState() {
    setShowDiscardCreateProgrammeConfirm(false)
    setShowCreateProgramme(false)
    setCreateProgrammeName('')
    setCreateProgrammeRoutines([])
    setCreateProgrammeTriedSave(false)
    setCreateProgrammeConfirmEmptyRoutines(false)
    if (isOnboardingRouteRef.current) setOnboardingProgrammeFlowLaunched(false)
  }

  function requestCloseCreateProgramme() {
    const dirty = createProgrammeName.trim() !== '' || createProgrammeRoutines.length > 0
    if (dirty) {
      setShowDiscardCreateProgrammeConfirm(true)
      return
    }
    resetCreateProgrammeModalState()
  }

  function confirmDiscardCreateProgrammeDraft() {
    resetCreateProgrammeModalState()
  }

  function confirmDiscardRoutineEditor() {
    setShowDiscardRoutineEditorConfirm(false)
    routineEditorCloseRef.current?.()
  }

  function saveEditedProgramme(progId, name, type, routineIdsOrder) {
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, name, type, routineIds: routineIdsOrder } : p))
    setEditingProgrammeId(null)
    editProgrammeSnapshotRef.current = null
  }

  async function confirmDeleteProgrammeAction(progId) {
    const prog = programmes.find(p => p.id === progId)
    if (!prog) return
    let programmesToSet = programmes.filter((p) => p.id !== progId)
    const routinesToSet = routines.filter((r) => r.programmeId !== progId)
    if (prog.isActive && programmesToSet.length > 0) {
      const next = programmesToSet[0]
      programmesToSet = programmesToSet.map((p) => ({ ...p, isActive: p.id === next.id }))
    }
    setProgrammes(programmesToSet)
    setRoutines(routinesToSet)
    setShowDeleteProgrammeConfirm(null)
    const uid = user?.uid
    if (uid) {
      try {
        await deleteWorkoutPlan(uid, progId)
        await saveWorkoutPlans(uid, programmesToSet, routinesToSet)
      } catch (err) {
        console.error('confirmDeleteProgramme persistence:', err)
      }
    }
  }

  function addRoutineToProgramme(progId, routineData) {
    const ts = Date.now()
    const rtnId = 'rtn_' + ts
    const newRoutine = { id: rtnId, name: routineData.name || 'New Routine', programmeId: progId, exercises: routineData.exercises || [] }
    setRoutines(prev => [...prev, newRoutine])
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, routineIds: [...(p.routineIds || []), rtnId] } : p))
    return rtnId
  }

  function saveRoutineEdits(rtnId, name, exercises) {
    const normalized = (exercises || []).map((ex) => {
      const libT = getExerciseFromLibrary(ex.exerciseId)?.type || 'weight_reps'
      return {
      id: ex.id ?? crypto.randomUUID(),
      exerciseId: ex.exerciseId,
      setConfigs: getSetConfigs(ex).map((s) => ({
        targetReps: String(s.targetReps ?? '') || '8-10',
        targetKg: libT === 'reps_only' ? '' : (String(s.targetKg ?? '') ?? ''),
      })),
      restOverride: ex.restOverride !== undefined && ex.restOverride !== null ? ex.restOverride : null,
      rirOverride: ex.rirOverride ?? null,
      note: ex.note ?? '',
      supersetGroupId: ex.supersetGroupId ?? null,
      supersetRole: ex.supersetRole ?? null
    }
    })
    setRoutines(prev => prev.map(r => r.id === rtnId ? { ...r, name, exercises: normalized } : r))
    setEditingRoutineId(null)
    setEditingRoutineProgrammeId(null)
  }

  function removeRoutineFromProgramme(progId, rtnId) {
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, routineIds: (p.routineIds || []).filter(id => id !== rtnId) } : p))
    setRoutines(prev => prev.filter(r => r.id !== rtnId))
  }

  function reorderRoutineInProgramme(progId, rtnId, direction) {
    const prog = programmes.find(p => p.id === progId)
    if (!prog?.routineIds?.length) return
    const idx = prog.routineIds.indexOf(rtnId)
    if (idx < 0) return
    const next = direction === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= prog.routineIds.length) return
    const ids = [...prog.routineIds]
    ;[ids[idx], ids[next]] = [ids[next], ids[idx]]
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, routineIds: ids } : p))
  }

  function moveRoutineToIndex(progId, rtnId, toIndex) {
    const prog = programmes.find(p => p.id === progId)
    if (!prog?.routineIds?.length) return
    const ids = [...(prog.routineIds || [])]
    const fromIdx = ids.indexOf(rtnId)
    if (fromIdx < 0 || toIndex < 0 || toIndex >= ids.length) return
    ids.splice(fromIdx, 1)
    ids.splice(toIndex, 0, rtnId)
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, routineIds: ids } : p))
  }

  function moveRoutineToProgramme(rtnId, fromProgId, toProgId) {
    if (fromProgId === toProgId) return
    setProgrammes(prev => prev.map(p => {
      if (p.id === fromProgId) return { ...p, routineIds: (p.routineIds || []).filter(id => id !== rtnId) }
      if (p.id === toProgId) return { ...p, routineIds: [...(p.routineIds || []), rtnId] }
      return p
    }))
    setRoutines(prev => prev.map(r => r.id === rtnId ? { ...r, programmeId: toProgId } : r))
  }

  function copyProgramme(progId) {
    const prog = programmes.find(p => p.id === progId)
    if (!prog) return
    const ts = Date.now()
    const newProgId = 'prog_' + ts
    const newRoutines = []
    const newRoutineIds = []
    for (const rtnId of prog.routineIds || []) {
      const r = routines.find(x => x.id === rtnId)
      if (!r) continue
      const newRtnId = 'rtn_' + ts + '_' + newRoutines.length
      newRoutineIds.push(newRtnId)
      newRoutines.push({ ...r, id: newRtnId, name: r.name || 'Routine', programmeId: newProgId, exercises: JSON.parse(JSON.stringify(r.exercises || [])) })
    }
    setRoutines(prev => [...prev, ...newRoutines])
    setProgrammes(prev => [...prev.map(p => ({ ...p, isActive: false })), { id: newProgId, name: (prog.name || 'Programme') + ' (copy)', type: prog.type || 'rotation', routineIds: newRoutineIds, isActive: false, currentIndex: 0 }])
  }

  function copyRoutine(rtnId, progId) {
    const r = routines.find(x => x.id === rtnId)
    if (!r) return
    const ts = Date.now()
    const newRtnId = 'rtn_' + ts
    setRoutines(prev => [...prev, { ...r, id: newRtnId, name: (r.name || 'Routine') + ' (copy)', programmeId: progId, exercises: JSON.parse(JSON.stringify(r.exercises || [])) }])
    setProgrammes(prev => prev.map(p => p.id === progId ? { ...p, routineIds: [...(p.routineIds || []), newRtnId] } : p))
  }

  // --- PR logic ---
  function getPRForExercise(eName, eType) {
    let best = null
    for (const w of history) for (const ex of w.exercises) if (ex.name === eName) for (const s of ex.sets) {
      const val = getPRValue(s, eType || 'weight_reps')
      if (val !== null && (best === null || val > best)) best = val
    }
    return best
  }

  function getPRValue(set, type) {
    switch (type) {
      case 'weight_reps': { const kg = toNum(set.kg); const r = Number(set.reps||0); return kg > 0 && r > 0 ? kg * r : null }
      case 'bw_reps': {
        const r = Number(set.reps||0)
        const sign = (set.bwSign || '+') === '+' ? 1 : -1
        return r > 0 ? (bodyweight + sign * toNum(set.kg)) * r : null
      }
      case 'reps_only': { const r = Number(set.reps||0); return r > 0 ? r : null }
      case 'time_only': { const t = parseTimeToSeconds(set.time); return t > 0 ? t : null }
      case 'distance_time': { const d = Number(set.distance||0); return d > 0 ? d : null }
      default: return null
    }
  }

  function getPRDisplay(set, type) {
    switch (type) {
      case 'weight_reps': { const k = typeof set.kg === 'number' ? set.kg : parseDecimal(set.kg); return `${Number.isNaN(k) ? set.kg : formatDecimal(k)} ${unitWeight} × ${set.reps}` }
      case 'bw_reps': { const sign = (set.bwSign || '+') === '+' ? '+' : '−'; const k = typeof set.kg === 'number' ? set.kg : parseDecimal(set.kg); return `${sign}${Number.isNaN(k) ? (set.kg ?? 0) : formatDecimal(k)} ${unitWeight} × ${set.reps}` }
      case 'reps_only': return `${set.reps} reps`
      case 'time_only': return set.time
      case 'distance_time': { const d = typeof set.distance === 'number' ? set.distance : parseDecimal(set.distance); return `${Number.isNaN(d) ? set.distance : formatDecimal(d)} ${unitDistance}` }
      default: return ''
    }
  }

  function findNewPRs(completedExercises) {
    const prs = []
    for (const ex of completedExercises) {
      const type = ex.type || 'weight_reps'
      const oldBest = getPRForExercise(ex.name, type)
      let sessionBest = null; let sessionBestSet = null
      for (const s of ex.sets) {
        if (!s.done) continue
        const val = getPRValue(s, type)
        if (val !== null && (sessionBest === null || val > sessionBest)) { sessionBest = val; sessionBestSet = s }
      }
      if (sessionBest !== null && (oldBest === null || sessionBest > oldBest)) {
        prs.push({ name: ex.name, type, display: getPRDisplay(sessionBestSet, type) })
      }
    }
    return prs
  }

  // --- Progression vs last same template or routine ---
  function getProgression(progressionSource, currentExercises, currentDuration, routineId) {
    const prev = routineId
      ? history.find(w => w.routineId === routineId)
      : progressionSource ? history.find(w => w.templateName === progressionSource) : null
    if (!prev) return null

    const curDoneSets = currentExercises.flatMap(ex => ex.sets.filter(s => s.done))
    const prevDoneSets = prev.exercises.flatMap(ex => ex.sets.filter(s => s.done))
    const curVolume = curDoneSets.reduce((sum, s) => sum + (toNum(s.kg) * Number(s.reps||0)), 0)
    const prevVolume = prevDoneSets.reduce((sum, s) => sum + (toNum(s.kg) * Number(s.reps||0)), 0)
    const curSetCount = curDoneSets.length
    const prevSetCount = prevDoneSets.length
    const prevDuration = prev.duration || 0

    return { curVolume, prevVolume, curSetCount, prevSetCount, curDuration: currentDuration, prevDuration }
  }

  function countTemplateUses(templateName) {
    return history.filter(w => w.templateName === templateName).length
  }

  // --- Week streak ---
  function getWeekDays() {
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    const shifted = [...days.slice(weekStart), ...days.slice(0, weekStart)]
    return shifted
  }

  function getWeekStreak() {
    const now = new Date(); now.setHours(0,0,0,0)
    const jsDay = now.getDay() // 0=Sun
    const dayMap = [6,0,1,2,3,4,5] // convert JS day to Mon=0
    const todayIdx = dayMap[jsDay]
    const offset = (todayIdx - weekStart + 7) % 7
    const weekStartDate = new Date(now); weekStartDate.setDate(weekStartDate.getDate() - offset)

    const result = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate); d.setDate(d.getDate() + i)
      const dateStr = d.toLocaleDateString('en-GB')
      const worked = (history && Array.isArray(history) ? history : []).some(w => w.date === dateStr)
      const isToday = i === offset
      result.push({ worked, isToday })
    }
    return result
  }

  // --- Exercise Library ---
  const allLibraryExercises = [...DEFAULT_EXERCISES, ...customExercises.map(e => ({ ...e, isCustom: true }))]

  function getExerciseFromLibrary(eName) {
    return allLibraryExercises.find(e => e.name === eName) || null
  }

  /** Apply Coach [SUGGESTION] to the active programme (best-effort); persists via saveWorkoutPlans useEffect. */
  async function handleApplyProgrammeChange(suggestion) {
    console.log('Programme change applied:', suggestion)
    if (!suggestion || typeof suggestion !== 'object') return
    const ap = programmes.find((p) => p.isActive)
    if (!ap) return
    const action = suggestion.action || 'general'
    const details = suggestion.details && typeof suggestion.details === 'object' ? suggestion.details : {}
    const needle = String(suggestion.exerciseName || details.exerciseName || '').trim().toLowerCase()

    function matchExercise(ex) {
      if (!needle) return false
      const exId = String(ex.exerciseId || '').trim().toLowerCase()
      if (exId === needle || exId.includes(needle)) return true
      const lib = getExerciseFromLibrary(ex.exerciseId)
      const libName = (lib?.name || '').trim().toLowerCase()
      return libName === needle || libName.includes(needle)
    }

    setRoutines((prev) => {
      const ids = ap.routineIds || []
      let changed = false
      const next = prev.map((r) => {
        if (!ids.includes(r.id)) return r
        const exercises = (r.exercises || []).map((ex) => {
          if (!matchExercise(ex)) return ex
          if (action === 'swap_exercise') {
            const newId = details.replaceExerciseId || details.newExerciseId || details.exerciseId
            if (newId && typeof newId === 'string') {
              changed = true
              return { ...ex, exerciseId: newId }
            }
            return ex
          }
          if (Array.isArray(details.setConfigs)) {
            changed = true
            return {
              ...ex,
              setConfigs: details.setConfigs.map((s) => ({
                targetKg: s.targetKg ?? '',
                targetReps: s.targetReps ?? '8-10',
              })),
            }
          }
          if (details.sets != null || details.targetReps != null || details.targetKg != null) {
            changed = true
            const prevCfgs = ex.setConfigs?.length ? [...ex.setConfigs] : []
            const nSets =
              typeof details.sets === 'number' && details.sets > 0
                ? details.sets
                : Math.max(1, prevCfgs.length || (typeof ex.sets === 'number' ? ex.sets : 4))
            const setConfigs = Array.from({ length: nSets }, (_, i) => ({
              targetKg: details.targetKg != null ? String(details.targetKg) : (prevCfgs[i]?.targetKg ?? ''),
              targetReps:
                details.targetReps != null ? String(details.targetReps) : (prevCfgs[i]?.targetReps ?? '8-10'),
            }))
            return { ...ex, sets: nSets, setConfigs }
          }
          if (details.restOverride != null && details.restOverride !== '') {
            changed = true
            const n = Number(details.restOverride)
            return { ...ex, restOverride: Number.isFinite(n) ? n : ex.restOverride }
          }
          return ex
        })
        return { ...r, exercises }
      })
      return changed ? next : prev
    })
  }

  function addExercisesFromLibrary(exList) {
    if (exerciseLibraryReplaceIndex != null) {
      const idx = exerciseLibraryReplaceIndex
      setExerciseLibraryReplaceIndex(null)
      setShowAddExercise(false)
      if (!exList?.length) return
      const libEx = exList[0]
      setExercises((prev) => {
        const old = prev[idx]
        if (!old) return prev
        const type = libEx.type || 'weight_reps'
        const n = Math.max(1, (old.sets || []).length)
        const sets = Array.from({ length: n }, () => emptySetForType(type))
        return prev.map((e, i) =>
          i !== idx
            ? e
            : {
                ...e,
                name: libEx.name,
                type,
                muscle: libEx.muscle,
                equipment: libEx.equipment,
                movement: libEx.movement,
                sets,
              }
        )
      })
      setFocusWorkoutFirstFieldAt(idx)
      return
    }
    const firstNewIndex = exercises.length
    const newExs = exList.map(ex => {
      const type = ex.type || 'weight_reps'
      return {
        id: crypto.randomUUID(),
        name: ex.name, type, sets: [emptySetForType(type)], restOverride: null, note: '',
        muscle: ex.muscle, equipment: ex.equipment, movement: ex.movement,
        supersetGroupId: null, supersetRole: null
      }
    })
    setExercises([...exercises, ...newExs])
    setFocusWorkoutFirstFieldAt(firstNewIndex)
    setShowAddExercise(false)
  }

  function openReplaceExerciseFromWorkout(exIndex) {
    cancelLinkMode()
    if (activeRest?.exIndex === exIndex) {
      setActiveRest(null)
      setRestTime(0)
      restStartRef.current = null
    }
    setExerciseLibraryReplaceIndex(exIndex)
    setShowAddExercise(true)
  }

  function saveCustomExercise(ex) {
    if (editingCustomExercise) {
      setCustomExercises(prev => prev.map(e => e.name === editingCustomExercise.name ? ex : e))
      // Update any active exercises with the old name
      if (editingCustomExercise.name !== ex.name) {
        setExercises(prev => prev.map(e => e.name === editingCustomExercise.name ? { ...e, name: ex.name, type: ex.type, muscle: ex.muscle, equipment: ex.equipment, movement: ex.movement } : e))
      }
    } else {
      setCustomExercises(prev => [...prev, ex])
    }
    setEditingCustomExercise(null)
    setShowCreateExercise(false)
  }

  function deleteCustomExercise(ex) {
    setCustomExercises(prev => prev.filter(e => e.name !== ex.name))
    setEditingCustomExercise(null)
    setShowCreateExercise(false)
  }

  // --- Exercise management ---
  function updateExerciseRest(exIndex, value) { const n = [...exercises]; n[exIndex].restOverride = value === '' ? null : Number(value); setExercises(n) }
  function updateExerciseNote(exIndex, value) { const n = [...exercises]; n[exIndex].note = value; setExercises(n) }

  function emptySetForType(type) {
    switch (type) {
      case 'weight_reps': return { kg: '', reps: '', done: false }
      case 'bw_reps': return { kg: '', reps: '', bwSign: '+', done: false }
      case 'reps_only': return { reps: '', done: false }
      case 'time_only': return { time: '', done: false }
      case 'distance_time': return { distance: '', time: '', done: false }
      default: return { kg: '', reps: '', done: false }
    }
  }

  function copySet(set, type) {
    switch (type) {
      case 'weight_reps': return { kg: set.kg, reps: set.reps, done: false }
      case 'bw_reps': return { kg: set.kg, reps: set.reps, bwSign: set.bwSign || '+', done: false }
      case 'reps_only': return { reps: set.reps, done: false }
      case 'time_only': return { time: set.time, done: false }
      case 'distance_time': return { distance: set.distance, time: set.time, done: false }
      default: return { kg: set.kg, reps: set.reps, done: false }
    }
  }

  function isSetComplete(set, type) {
    switch (type) {
      case 'weight_reps': return (set.kg !== undefined && set.kg !== '' && set.kg !== null && !Number.isNaN(toNum(set.kg))) || (set.reps !== undefined && set.reps !== '' && set.reps !== null)
      case 'bw_reps': return set.reps !== '' && set.reps !== undefined && set.reps !== null
      case 'reps_only': return set.reps !== '' && set.reps !== undefined && set.reps !== null
      case 'time_only': return set.time !== '' && set.time !== undefined && set.time !== null
      case 'distance_time': return (set.distance !== '' && set.distance !== undefined) || (set.time !== '' && set.time !== undefined)
      default: return (set.kg !== '' && set.reps !== '') || (set.reps !== '' && set.reps !== undefined)
    }
  }

  function addSet(index) {
    const n = [...exercises]
    const ex = n[index]
    if (!ex.sets) ex.sets = []
    const sets = ex.sets
    const lastSet = sets[sets.length - 1]
    const type = ex.type || 'weight_reps'
    const newSet = lastSet ? copySet(lastSet, type) : emptySetForType(type)
    const withInitial = {
      ...newSet,
      initialKg: newSet.kg,
      initialReps: newSet.reps,
      initialTime: newSet.time,
      initialDistance: newSet.distance,
      initialBwSign: newSet.bwSign ?? '+'
    }
    sets.push(withInitial)
    setExercises(n)
    setTimeout(() => {
      const type = ex.type || 'weight_reps'
      let field = 'kg'
      if (type === 'reps_only') field = 'reps'
      else if (type === 'time_only') field = 'time'
      else if (type === 'distance_time') field = 'distance'
      const input = document.querySelector(`[data-ex="${index}"][data-set="${sets.length - 1}"][data-field="${field}"]`)
      if (input) input.focus()
    }, 50)
  }

  function deleteSet(exIndex, setIndex) {
    const n = [...exercises]
    const sets = n[exIndex]?.sets || []
    sets.splice(setIndex, 1)
    n[exIndex] = { ...n[exIndex], sets: [...sets] }
    if (sets.length === 0) n.splice(exIndex, 1)
    setExercises(n)
  }
  function updateSet(exIndex, setIndex, field, value) {
    let stored = value
    if (field === 'kg' || field === 'distance') {
      if (value === '' || value === null || value === undefined) stored = ''
      else stored = String(value).trim()
    }
    setExercises(prev => prev.map((e, ei) => {
      if (ei !== exIndex) return e
      const sList = e.sets || []
      return { ...e, sets: sList.map((s, si) => si === setIndex ? { ...s, [field]: stored } : s) }
    }))
  }

  function isRirActive(exercise, globalRirEnabled) {
    if (exercise.rirOverride === true) return true
    if (exercise.rirOverride === false) return false
    return globalRirEnabled
  }

  function parseHistorySessionDate(w) {
    const parts = (w?.date || '').split('/')
    if (parts.length !== 3) return 0
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime()
  }

  /** Free-plan: AI tip once per session when rest starts — only after 2 completed & saved workouts (3rd WO onwards). */
  function generateCoachTip(exercise, exIndex, setIndex) {
    if (userPlan !== 'free') return
    if (coachTipDismissed) return
    if (coachTipShown) return
    const completedSaved = historySessionsForCoachTip(history).length
    if (completedSaved < 2) return
    const exerciseKey = exercise?.exerciseId || exercise?.name
    if (!exerciseKey) return

    setCoachTipShown(true)
    coachTipRequestIdRef.current += 1
    const requestId = coachTipRequestIdRef.current
    setCoachTipExIndex(exIndex)
    setCoachTipSetIndex(setIndex)
    setCurrentCoachTip({ loading: true })

    const ctx = buildRestCoachTipContext(history, activeProgramme, routines, workoutName, exercises)
    if (!ctx) {
      setCurrentCoachTip({
        text: `Coach can analyse your programme and training log to suggest structure, volume, and progression. Upgrade to Pro or Elite for full Coach chat.`,
      })
      return
    }

    const prompt = `You are Coach, an expert personal trainer. The user is on the FREE plan and reads this during a rest timer between sets.

Use ONLY the JSON below (CONTEXT). Write one coaching tip in 2–4 short sentences (British English).

Do not address injury, pain, illness, or any medical topic — this is training education only; if such issues appear in the data, keep the tip generic and programme-focused.

PRIORITY: programme-level advice — how their split/frequency, day balance, volume, or progression across early sessions could improve. At least half of the tip must be about programme structure, recovery between sessions, or week-to-week progression — not a single exercise.

You may add one short clause about today’s session or the lift they are on only if it supports the programme point. In the JSON, \`firstWorkouts\` are the only past logged sessions you may reference; \`programme\` and \`todaysSession\` are plan/current session labels — do not claim they completed workouts that are not in \`firstWorkouts\`. Never invent sessions, exercises, PRs, or loads not present in the data.

End with one short sentence that full Coach on Pro/Elite gives ongoing chat-based guidance.

No markdown, no bullet points, no title line. Plain text only.

DATA (JSON):
${JSON.stringify(ctx)}`

    invokeCoachGenerate(prompt)
      .then((raw) => {
        if (coachTipRequestIdRef.current !== requestId) return
        const text = String(raw || '')
          .trim()
          .replace(/^["'\s]+|["'\s]+$/g, '')
        if (!text) throw new Error('empty tip')
        setCurrentCoachTip({ text })
      })
      .catch((e) => {
        console.error('Coach rest tip', e)
        if (coachTipRequestIdRef.current !== requestId) return
        setCurrentCoachTip({
          text: `Coach can analyse your programme and recent training for structure, volume, and progression. Upgrade to Pro or Elite for full Coach chat.`,
        })
      })
  }

  function handleCoachTipYes() {
    setCurrentCoachTip(null)
    setCoachTipExIndex(null)
    setCoachTipSetIndex(null)
    setShowPricing(true)
  }

  function handleCoachTipNo() {
    setCurrentCoachTip(null)
    setCoachTipExIndex(null)
    setCoachTipSetIndex(null)
    setCoachTipDismissed(true)
    try {
      localStorage.setItem('coachTipDismissed', 'true')
    } catch {
      /* ignore */
    }
  }

  function startRestAfterSet(exIndex, setIndex, ex) {
    const dur = ex.restOverride !== null && ex.restOverride !== undefined ? ex.restOverride : defaultRest
    if (dur === 0) return
    if (ex.supersetRole === 'A') return
    restStartRef.current = Date.now()
    setActiveRest({ exIndex, setIndex })
    setRestTime(dur)
    setRestDuration(dur)
    generateCoachTip(ex, exIndex, setIndex)
  }

  function doneSet(exIndex, setIndex) {
    const ex = exercises[exIndex]
    const set = ex?.sets?.[setIndex]
    if (!set || !isSetComplete(set, ex.type || 'weight_reps')) return
    if (navigator.vibrate) navigator.vibrate(30)
    const prevRest = activeRest
    let updatedExercises
    if (prevRest) {
      restStartRef.current = restStartRef.current || Date.now()
      const elapsed = Math.max(1, Math.floor((Date.now() - restStartRef.current) / 1000))
      setActiveRest(null)
      setRestTime(0)
      restStartRef.current = null
      updatedExercises = exercises.map((e, ei) => {
        let next = e
        const restSets = e.sets || []
        if (ei === prevRest.exIndex) {
          next = { ...e, sets: restSets.map((s, si) => si !== prevRest.setIndex ? s : { ...s, restTime: elapsed }) }
        }
        if (ei === exIndex) {
          const sList = next.sets || []
          next = { ...next, sets: sList.map((s, si) => si === setIndex ? { ...s, done: true } : s) }
        }
        return next
      })
    } else {
      updatedExercises = exercises.map((e, ei) => {
        if (ei !== exIndex) return e
        const sList = e.sets || []
        return { ...e, sets: sList.map((s, si) => si === setIndex ? { ...s, done: true } : s) }
      })
    }
    setExercises(updatedExercises)
    const updatedEx = updatedExercises[exIndex]
    const updatedSet = updatedEx.sets[setIndex]
    const exType = updatedEx.type || 'weight_reps'
    const rirSupported = exType !== 'time_only' && exType !== 'distance_time'
    if (rirSupported && isRirActive(updatedEx, rirEnabled)) {
      setPendingRir({
        exIndex,
        setIndex,
        kg: updatedSet.kg,
        reps: updatedSet.reps,
        setNumber: setIndex + 1,
        exerciseName: updatedEx.name,
        restOverride: updatedEx.restOverride,
        supersetRole: updatedEx.supersetRole
      })
      return
    }
    startRestAfterSet(exIndex, setIndex, updatedEx)
  }

  function handleRirSelect(rir) {
    const { exIndex, setIndex } = pendingRir
    setExercises(prev => prev.map((e, ei) =>
      ei === exIndex ? { ...e, sets: (e.sets || []).map((s, si) => si === setIndex ? { ...s, rir } : s) } : e
    ))
    const ex = exercises[exIndex]
    setPendingRir(null)
    startRestAfterSet(exIndex, setIndex, { ...ex, restOverride: pendingRir.restOverride, supersetRole: pendingRir.supersetRole })
  }

  function handleRirSkip() {
    const { exIndex, setIndex } = pendingRir
    const ex = exercises[exIndex]
    setPendingRir(null)
    startRestAfterSet(exIndex, setIndex, { ...ex, restOverride: pendingRir.restOverride, supersetRole: pendingRir.supersetRole })
  }

  function undoneSet(exIndex, setIndex) {
    const n = exercises.map((e, ei) => {
      if (ei !== exIndex) return e
      const sList = e.sets || []
      return { ...e, sets: sList.map((s, si) => {
        if (si !== setIndex) return s
        const { restTime: _, rir: __, ...rest } = s
        return { ...rest, done: false }
      }) }
    })
    setExercises(n)
    if (activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === setIndex) {
      setActiveRest(null); setRestTime(0); restStartRef.current = null
    }
  }

  function moveExerciseUp(i) { if (i === 0) return; const n = [...exercises]; [n[i-1], n[i]] = [n[i], n[i-1]]; setExercises(n) }
  function moveExerciseDown(i) { if (i >= exercises.length-1) return; const n = [...exercises]; [n[i+1], n[i]] = [n[i], n[i+1]]; setExercises(n) }
  function removeExercise(i) {
    const ex = exercises[i]
    if (ex?.supersetGroupId) breakSuperset(ex.supersetGroupId)
    const n = [...exercises]
    n.splice(i, 1)
    setExercises(n)
  }

  function getSupersetNextSet(a, b) {
    const setsA = a?.sets || []
    const setsB = b?.sets || []
    const maxLen = Math.max(setsA.length, setsB.length)
    for (let i = 0; i < maxLen; i++) {
      const doneA = setsA[i]?.done === true
      const doneB = setsB[i]?.done === true
      if (!doneA) return { nextSetIndex: i, nextIsA: true }
      if (!doneB) return { nextSetIndex: i, nextIsA: false }
    }
    return null
  }

  function isGroupComplete(group) {
    if (group.type === 'exercise') {
      const ex = group.exercise
      const sets = ex.sets || []
      const allDone = sets.every(s => s.done)
      if (!allDone) return false
      const exIndex = exercises.indexOf(ex)
      const lastSetIndex = sets.length - 1
      const restActive = activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === lastSetIndex
      return !restActive
    }
    const { a, b } = group
    const allDone = (a.sets || []).every(s => s.done) && (b.sets || []).every(s => s.done)
    if (!allDone) return false
    const iB = exercises.indexOf(b)
    const lastSetIndex = (b.sets || []).length - 1
    const restActive = activeRest && activeRest.exIndex === iB && activeRest.setIndex === lastSetIndex
    return !restActive
  }

  function getGlobalNextSet() {
    const groups = getGrouped()
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g]
      const prevGroupsComplete = g === 0 || groups.slice(0, g).every(gr => isGroupComplete(gr))
      if (!prevGroupsComplete) continue
      if (group.type === 'exercise') {
        const ex = group.exercise
        const exIndex = exercises.indexOf(ex)
        const setIdx = (ex.sets || []).findIndex(s => !s.done)
        if (setIdx < 0) continue
        const prevEx = exIndex > 0 ? exercises[exIndex - 1] : null
        const prevLen = (prevEx?.sets || []).length
        const prevLastSetIdx = prevLen > 0 ? prevLen - 1 : -1
        const restOk = setIdx === 0
          ? (exIndex === 0 || !(activeRest && activeRest.exIndex === exIndex - 1 && activeRest.setIndex === prevLastSetIdx))
          : !(activeRest && activeRest.exIndex === exIndex && activeRest.setIndex === setIdx - 1)
        if (restOk) return { exIndex, setIndex: setIdx }
      } else {
        const nextInfo = getSupersetNextSet(group.a, group.b)
        if (!nextInfo) continue
        const iA = exercises.indexOf(group.a)
        const iB = exercises.indexOf(group.b)
        const exIndex = nextInfo.nextIsA ? iA : iB
        const setIdx = nextInfo.nextSetIndex
        const prevInOrder = setIdx === 0 && exIndex === iB ? { exIndex: iA, setIndex: 0 }
          : setIdx === 0 ? null
          : exIndex === iA ? { exIndex: iB, setIndex: setIdx - 1 }
          : { exIndex: iA, setIndex: setIdx }
        const restOk = !prevInOrder || !(activeRest && activeRest.exIndex === prevInOrder.exIndex && activeRest.setIndex === prevInOrder.setIndex)
        if (restOk) return { exIndex, setIndex: setIdx }
      }
    }
    return null
  }

  useLayoutEffect(() => {
    if (!showActiveWorkoutSheet || !workoutActive || !activeWorkoutSheetContinueIntent) return
    setActiveWorkoutSheetContinueIntent(false)
    const next = getGlobalNextSet()
    let exIndex = next?.exIndex
    if (exIndex == null || exIndex < 0) {
      if (activeRest != null && activeRest.exIndex != null && activeRest.exIndex >= 0) {
        exIndex = activeRest.exIndex
      } else {
        exIndex = exercises.findIndex((ex) => (ex.sets || []).some((s) => !s.done))
      }
    }
    if (exIndex < 0) return
    const el = document.getElementById(`workout-exercise-${exIndex}`)
    if (!el) return
    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    })
  }, [
    showActiveWorkoutSheet,
    workoutActive,
    activeWorkoutSheetContinueIntent,
    exercises,
    activeRest,
    restTime,
    restDuration,
  ])

  function getPreviousSets(exerciseName) {
    for (const w of history) for (const ex of w.exercises) if (ex.name === exerciseName) return ex.sets
    return null
  }

  function getBestSet(eName) {
    let best = null
    for (const w of history) for (const ex of w.exercises) if (ex.name === eName) for (const s of ex.sets) {
      const vol = toNum(s.kg) * Number(s.reps || 0)
      if (!best || vol > best.volume) best = { kg: s.kg, reps: s.reps, volume: vol }
    }
    return best
  }

  function finishWorkout() {
    if (exercises.length === 0) {
      setShowFinishModal(true)
      return
    }
    const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
    const doneSets = exercises.reduce((sum, ex) => sum + ex.sets.filter(s => s.done).length, 0)
    if (doneSets === 0) {
      setIncompleteSetsWarning({ total: totalSets, done: doneSets, noneDone: true })
      return
    }
    if (doneSets < totalSets) {
      setIncompleteSetsWarning({ total: totalSets, done: doneSets, noneDone: false })
      return
    }
    setShowFinishModal(true)
  }

  function isRoutineBased() {
    return !!currentRoutineIdRef.current
  }

  function isTemplateBased() {
    for (const f of folders) for (const t of f.templates) if (t.name === workoutName) return true
    return false
  }

  function confirmFinish(updateRoutineOrTemplate, options = {}) {
    const overrideRoutineId = options.routineIdOverride
    const routineId = overrideRoutineId || currentRoutineIdRef.current || undefined
    let templateName = null
    if (!routineId) {
      for (const f of folders) for (const t of f.templates) if (t.name === workoutName) { templateName = workoutName; break }
    }

    const duration = Math.floor((Date.now() - workoutStartTime) / 1000)
    const doneSets = exercises.flatMap(ex => ex.sets.filter(s => s.done))
    const totalVolume = doneSets.reduce((sum, s) => sum + (toNum(s.kg) * Number(s.reps||0)), 0)
    const newPRs = findNewPRs(exercises)
    const progressionSource = routineId ? routineId : templateName
    const progression = getProgression(progressionSource, exercises, duration, routineId)
    const routineUseCount = routineId ? history.filter(w => w.routineId === routineId).length + 1 : 0
    const templateUseCount = templateName ? countTemplateUses(templateName) : routineUseCount

    const workout = { date: new Date().toLocaleDateString('en-GB'), name: workoutName, templateName: templateName || undefined, duration, exercises: JSON.parse(JSON.stringify(exercises)), routineId }

    if (routineId && updateRoutineOrTemplate) {
      const newExercises = exercises.map(ex => {
        const libT = getExerciseFromLibrary(ex.name)?.type || 'weight_reps'
        return {
        id: ex.id ?? crypto.randomUUID(),
        exerciseId: ex.name,
        setConfigs: (ex.sets || []).map(s => ({
          targetReps: String(s.reps ?? '') || '8-10',
          targetKg: libT === 'reps_only' ? '' : (String(s.kg ?? '') ?? ''),
        })),
        restOverride: ex.restOverride !== undefined && ex.restOverride !== null ? ex.restOverride : null,
        rirOverride: ex.rirOverride ?? null,
        note: ex.note ?? '',
        supersetGroupId: ex.supersetGroupId ?? null,
        supersetRole: ex.supersetRole ?? null
      }
      })
      setRoutines(prev => prev.map(r => r.id !== routineId ? r : { ...r, exercises: newExercises }))
    }
    if (!routineId && updateRoutineOrTemplate) {
      const nf = [...folders]
      for (const ex of exercises) for (const f of nf) for (const t of f.templates) {
        for (let i = 0; i < t.exercises.length; i++) {
          if (t.exercises[i].name === ex.name) {
            const typ = ex.type || t.exercises[i].type || 'weight_reps'
            t.exercises[i].sets = (ex.sets || []).map((s) => sanitizeTemplateSetForType(s, typ))
            t.exercises[i].note = ex.note || ''
          }
        }
      }
      setFolders(nf)
    }

    const historyWithThis = [workout, ...history]
    let nextSuggested = null
    if (routineId) {
      const prog =
        options.programmeForRoutine ||
        programmes.find(p => (p.routineIds || []).includes(routineId)) ||
        activeProgramme
      const routineIds = prog?.routineIds || []
      if (routineIds.length > 0) {
        const idx = routineIds.indexOf(routineId)
        const nextIdx = idx >= 0 ? (idx + 1) % routineIds.length : 0
        const nextRtnId = routineIds[nextIdx]
        const nextRtn =
          (options.routinesForProgramme || routines).find(r => r.id === nextRtnId) || null
        if (nextRtn) {
          nextSuggested = {
            template: {
              name: nextRtn.name,
              exercises: (nextRtn.exercises || []).map(e => ({ name: e.exerciseId }))
            }
          }
        }
      }
    } else if (templateName) nextSuggested = getSuggestedNextFromTemplate(templateName)

    setCompletedWorkoutData({
      name: workoutName, templateName: templateName || (routineId ? workoutName : null), duration, setCount: doneSets.length, volume: totalVolume,
      exerciseCount: exercises.length,
      newPRs, progression, templateUseCount,
      suggestedNext: nextSuggested
    })
    setCompleteScreenRating(null)

    // Update muscleLastWorked only for exercises that had at least one set marked done (recovery counts completed work only)
    const now = new Date().toISOString()
    const nextMuscleLastWorked = { ...muscleLastWorked }
    for (const ex of exercises) {
      const hasDoneSet = (ex.sets || []).some((s) => s.done)
      if (!hasDoneSet) continue
      const lib = allLibraryExercises.find((e) => e.name === ex.name)
      const m = lib?.muscles
      if (m) {
        ;(m.primary || []).forEach((slug) => { nextMuscleLastWorked[slug] = now })
        ;(m.secondary || []).forEach((slug) => {
          if (nextMuscleLastWorked[slug] == null) nextMuscleLastWorked[slug] = now
        })
      } else if (lib?.muscle) {
        nextMuscleLastWorked[lib.muscle] = now
      }
    }
    setMuscleLastWorked(nextMuscleLastWorked)

    // Save session to Firestore then update local history and UI
    addWorkoutSession(user.uid, workout)
      .then((sessionId) => {
        setHistory((prev) => [{ ...workout, sessionId }, ...prev])
        if (navigator.vibrate) navigator.vibrate([40, 40, 80])
        if (routineId) {
          advanceProgrammeRotation(routineId)
          setSelectedStartRoutineId(null) // so Start tab shows next "Up Next" with green frame, not the one just completed
        }
        setShowFinishModal(false)
        setShowCompleteScreen(true)
        setExercises([]); setActiveRest(null); setRestTime(0); setPendingRir(null)
        setWorkoutActive(false); setWorkoutName(''); setWorkoutStartTime(null); setWorkoutElapsed(0)
        currentRoutineIdRef.current = null
        startedFromEmptyRef.current = false
        updateAppData(user.uid, { currentWorkout: null }).catch(() => {})
      })
      .catch((err) => {
        console.error('addWorkoutSession:', err?.code || err?.message || err)
        if (err?.code === 'permission-denied') console.error('Tjek Firestore Security Rules – skriv skal tillades for users/{userId}/workoutSessions')
        // Still add to local state so user doesn't lose the workout
        setHistory((prev) => [workout, ...prev])
        setShowFinishModal(false)
        setShowCompleteScreen(true)
        setExercises([]); setActiveRest(null); setRestTime(0); setPendingRir(null)
        setWorkoutActive(false); setWorkoutName(''); setWorkoutStartTime(null); setWorkoutElapsed(0)
        currentRoutineIdRef.current = null
        startedFromEmptyRef.current = false
        updateAppData(user.uid, { currentWorkout: null }).catch(() => {})
      })
  }

  function confirmSaveAsRoutine(option, routineName) {
    const converted = exercises.map(ex => {
      const sets = ex.sets && ex.sets.length ? ex.sets : [{ reps: '8-10', kg: '' }]
      const libT = getExerciseFromLibrary(ex.name)?.type || 'weight_reps'
      return {
        id: ex.id ?? crypto.randomUUID(),
        exerciseId: ex.name,
        setConfigs: sets.map(s => ({
          targetReps: String(s.reps ?? '') || '8-10',
          targetKg: libT === 'reps_only' ? '' : (String(s.kg ?? '') ?? ''),
        })),
        restOverride: ex.restOverride !== undefined ? ex.restOverride : null,
        rirOverride: ex.rirOverride ?? null,
        note: ex.note ?? '',
        supersetGroupId: ex.supersetGroupId ?? null,
        supersetRole: ex.supersetRole ?? null
      }
    })
    const routineData = { name: routineName || workoutName || 'New Routine', exercises: converted }
    let progId
    if (option.type === 'existing') {
      progId = option.progId
      const rtnId = addRoutineToProgramme(progId, routineData)
      currentRoutineIdRef.current = rtnId
    } else {
      const ts = Date.now()
      progId = 'prog_' + ts
      const rtnId = 'rtn_' + ts
      const newRoutine = { id: rtnId, name: routineData.name, programmeId: progId, exercises: routineData.exercises }
      const isFirstProgramme = programmes.length === 0
      setRoutines(prev => [...prev, newRoutine])
      setProgrammes(prev => [
        ...prev,
        {
          id: progId,
          name: (option.programmeName && option.programmeName.trim()) ? option.programmeName.trim() : '2 Split - Push/Pull',
          type: 'rotation',
          routineIds: [rtnId],
          isActive: isFirstProgramme,
          currentIndex: 0
        }
      ])
      currentRoutineIdRef.current = rtnId
      if (!isFirstProgramme) setShowSetActiveAfterCreate(progId)
    }
    setShowSaveAsRoutineModal(false)
    confirmFinish(false)
  }

  function getSuggestedNextFromTemplate(templateName) {
    if (!templateName) return getSuggestedNext()
    for (let fi = 0; fi < folders.length; fi++) {
      const folder = folders[fi]
      for (let ti = 0; ti < folder.templates.length; ti++) {
        if (folder.templates[ti].name === templateName) {
          const next = (ti + 1) % folder.templates.length
          return { template: folder.templates[next], folderName: folder.name }
        }
      }
    }
    return null
  }

  function dismissCompleteScreen(rating) {
    const hasRating = rating != null && rating >= 1 && rating <= 5
    if (hasRating && history.length > 0) {
      const first = history[0]
      if (first.sessionId && user?.uid) {
        updateWorkoutSessionRating(user.uid, first.sessionId, rating).catch((err) =>
          console.error('updateWorkoutSessionRating:', err)
        )
      }
      setHistory(prev => [{ ...prev[0], rating }, ...prev.slice(1)])
    }
    setShowCompleteScreen(false)
    setCompletedWorkoutData(null)
    setCompleteScreenRating(null)
  }

  function cancelWorkout() {
    setExercises([]); setActiveRest(null); setRestTime(0); setPendingRir(null)
    setWorkoutActive(false); setWorkoutName(''); setWorkoutStartTime(null); setWorkoutElapsed(0)
    currentRoutineIdRef.current = null
    startedFromEmptyRef.current = false
    if (user?.uid) updateAppData(user.uid, { currentWorkout: null }).catch(() => {})
  }

  function saveTemplate() { if (exercises.length === 0) return; setShowSaveModal(true) }
  function confirmSaveTemplate(folderIndex, templateName) {
    const template = {
      name: templateName,
      exercises: exercises.map((ex) => ({
        id: ex.id ?? crypto.randomUUID(),
        name: ex.name,
        type: ex.type || 'weight_reps',
        sets: (ex.sets || []).map((s) => sanitizeTemplateSetForType(s, ex.type || 'weight_reps')),
        restOverride: ex.restOverride,
        note: ex.note || '',
        muscle: ex.muscle,
        equipment: ex.equipment,
        movement: ex.movement,
        supersetGroupId: ex.supersetGroupId ?? null,
        supersetRole: ex.supersetRole ?? null,
      })),
    }
    const nf = [...folders]; nf[folderIndex].templates.push(template); setFolders(nf); setShowSaveModal(false)
    confirmFinish(false)
  }

  function editTemplate(fi, ti) {
    const t = folders[fi].templates[ti]
    setExercises(t.exercises.map(ex => ({ id: ex.id ?? crypto.randomUUID(), name: ex.name, type: ex.type || 'weight_reps', sets: (ex.sets || []).map(s => ({ ...s, done: false })), restOverride: ex.restOverride !== undefined ? ex.restOverride : null, note: ex.note || '', muscle: ex.muscle, equipment: ex.equipment, movement: ex.movement, supersetGroupId: ex.supersetGroupId ?? null, supersetRole: ex.supersetRole ?? null })))
    setEditingTemplate({ folderIndex: fi, templateIndex: ti }); setWorkoutActive(true); setWorkoutName(t.name)
  }

  function saveEditedTemplate() {
    if (!editingTemplate) return
    const { folderIndex, templateIndex } = editingTemplate
    const nf = [...folders]
    nf[folderIndex].templates[templateIndex] = {
      name: workoutName,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        type: ex.type || 'weight_reps',
        sets: (ex.sets || []).map((s) => sanitizeTemplateSetForType(s, ex.type || 'weight_reps')),
        restOverride: ex.restOverride,
        note: ex.note || '',
        muscle: ex.muscle,
        equipment: ex.equipment,
        movement: ex.movement,
      })),
    }
    setFolders(nf); setExercises([]); setEditingTemplate(null); setWorkoutActive(false); setWorkoutName('')
  }
  function cancelEditTemplate() { setExercises([]); setEditingTemplate(null); setWorkoutActive(false); setWorkoutName('') }

  function requestDeleteTemplate(fi, ti) { setDeletingTemplate({ fi, ti }) }
  function confirmDeleteTemplate() { if (!deletingTemplate) return; const nf = [...folders]; nf[deletingTemplate.fi].templates.splice(deletingTemplate.ti, 1); setFolders(nf); setDeletingTemplate(null) }

  function duplicateTemplate(fi, ti) {
    const nf = [...folders]
    const orig = nf[fi].templates[ti]
    const copy = JSON.parse(JSON.stringify(orig))
    copy.name = orig.name + ' (copy)'
    nf[fi].templates.splice(ti + 1, 0, copy)
    setFolders(nf)
  }

  function newBlankTemplate(fi) {
    const nf = [...folders]
    nf[fi].templates.push({ name: 'New Template', exercises: [] })
    nf[fi].open = true
    setFolders(nf)
    const ti = nf[fi].templates.length - 1
    editTemplate(fi, ti)
  }

  function addFolder() { const nf = [...folders, { name: 'New Folder', open: true, templates: [] }]; setFolders(nf); setEditingFolder(nf.length - 1); setEditingFolderName('New Folder') }
  function toggleFolder(i) { const nf = [...folders]; nf[i].open = !nf[i].open; setFolders(nf) }
  function startEditFolder(i) { setEditingFolder(i); setEditingFolderName(folders[i].name) }
  function confirmEditFolder() { if (editingFolder === null) return; const nf = [...folders]; nf[editingFolder].name = editingFolderName || 'Untitled'; nf[editingFolder].open = true; setFolders(nf); setEditingFolder(null) }
  function requestDeleteFolder(i) { setDeletingFolder(i) }
  function confirmDeleteFolder() { if (deletingFolder === null) return; const nf = [...folders]; const r = nf.filter((_, i) => i !== deletingFolder); r[0].templates.push(...nf[deletingFolder].templates); setFolders(r); setDeletingFolder(null) }
  function moveFolderUp(i) { if (i === 0) return; const f = [...folders]; [f[i-1], f[i]] = [f[i], f[i-1]]; setFolders(f) }
  function moveFolderDown(i) { if (i >= folders.length-1) return; const f = [...folders]; [f[i+1], f[i]] = [f[i], f[i+1]]; setFolders(f) }
  function moveTemplateUp(fi, ti) {
    const f = [...folders]
    if (ti > 0) {
      [f[fi].templates[ti-1], f[fi].templates[ti]] = [f[fi].templates[ti], f[fi].templates[ti-1]]
    } else if (fi > 0) {
      const t = f[fi].templates.splice(0, 1)[0]
      f[fi-1].templates.push(t)
    }
    setFolders(f)
  }
  function moveTemplateDown(fi, ti) {
    const f = [...folders]
    if (ti < f[fi].templates.length - 1) {
      [f[fi].templates[ti+1], f[fi].templates[ti]] = [f[fi].templates[ti], f[fi].templates[ti+1]]
    } else if (fi < f.length - 1) {
      const t = f[fi].templates.splice(ti, 1)[0]
      f[fi+1].templates.unshift(t)
    }
    setFolders(f)
  }

  function formatTime(sec) { return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}` }
  function formatDuration(sec) { const m = Math.floor(sec/60); if (m < 60) return `${m} min`; const h = Math.floor(m/60); return `${h}h ${m%60}m` }
  function formatDecimal(n, decimals) { return formatDecimalUtil(n, decimalSeparator, decimals) }
  function parseDecimal(str) { return parseDecimalUtil(str) }
  function toNum(v) { const n = parseDecimal(v); return Number.isNaN(n) ? 0 : n }

  // WO estimate: 40 sec per set + rest between sets. Used in workout remaining and on home card.
  const SET_SECONDS_DEFAULT = 40

  function getEstimatedSecondsForRoutine(routine, defaultRestSec) {
    if (!routine?.exercises?.length) return 0
    let total = 0
    let setIndex = 0
    const totalSets = routine.exercises.reduce((s, e) => s + getSetConfigs(e).length, 0)
    for (const ex of routine.exercises) {
      const numSets = getSetConfigs(ex).length
      const rest = ex.restOverride !== undefined && ex.restOverride !== null ? ex.restOverride : defaultRestSec
      for (let i = 0; i < numSets; i++) {
        total += SET_SECONDS_DEFAULT
        setIndex++
        if (setIndex < totalSets) total += rest
      }
    }
    return total
  }

  function getEstimatedSecondsRemaining() {
    const remaining = []
    exercises.forEach((ex) => {
      const type = ex.type || 'weight_reps'
      const sets = ex.sets || []
      sets.forEach((set) => {
        if (!set.done) remaining.push({ ex, set, type })
      })
    })
    let total = 0
    if (activeRest) total += Math.max(0, restTime || 0)
    remaining.forEach((item, i) => {
      const isTimeSet = item.type === 'time_only' || item.type === 'distance_time'
      const setSec = isTimeSet && (item.set.time !== '' && item.set.time != null) ? parseTimeToSeconds(item.set.time) : SET_SECONDS_DEFAULT
      total += setSec
      if (i < remaining.length - 1) {
        const rest = item.ex.restOverride !== undefined && item.ex.restOverride !== null ? item.ex.restOverride : defaultRest
        total += rest
      }
    })
    return total
  }

  const showOnboardingUi = onboardingRequired && location.pathname === '/onboarding'
  const onboardingProgrammeFlowOpen =
    onboardingStep === 3 && !!(createProgrammeFlowStep || showCreateProgramme)

  function handleOnboardingWelcomeContinue() {
    if (!user?.uid) return
    setOnboardingTermsOnlyPath(false)
    try {
      sessionStorage.removeItem(ONBOARDING_TERMS_ONLY_KEY)
    } catch (_) {}
    setOnboardingStep(1)
    void updateOnboardingProgress(user.uid, 1)
  }

  function handleOnboardingWelcomeSkip() {
    if (!user?.uid) return
    setOnboardingTermsOnlyPath(true)
    try {
      sessionStorage.setItem(ONBOARDING_TERMS_ONLY_KEY, '1')
    } catch (_) {}
    setOnboardingStep(1)
    void updateOnboardingProgress(user.uid, 1)
  }

  function handleOnboardingLegalContinue() {
    if (!user?.uid) return
    const termsOnly =
      onboardingTermsOnlyPath ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ONBOARDING_TERMS_ONLY_KEY) === '1')
    if (termsOnly) {
      try {
        sessionStorage.removeItem(ONBOARDING_TERMS_ONLY_KEY)
      } catch (_) {}
      setOnboardingTermsOnlyPath(false)
      finishOnboardingAfterProgramme()
      return
    }
    setOnboardingStep(2)
    void updateOnboardingProgress(user.uid, 2)
  }

  function handleOnboardingPreferencesContinue() {
    if (!user?.uid) return
    const bw = parseDecimal(String(onboardingPrefsDraft.bodyweightInput ?? '').trim())
    const bodyweightOk = !Number.isNaN(bw) && bw > 0
    setUnitWeight(onboardingPrefsDraft.unitWeight)
    setUnitDistance(onboardingPrefsDraft.unitDistance)
    setUnitLength(onboardingPrefsDraft.unitLength)
    setDecimalSeparator(onboardingPrefsDraft.decimalSeparator)
    setDateFormat(onboardingPrefsDraft.dateFormat)
    if (bodyweightOk) setBodyweight(bw)
    mergeUserSettings(user.uid, {
      unitWeight: onboardingPrefsDraft.unitWeight,
      unitDistance: onboardingPrefsDraft.unitDistance,
      unitLength: onboardingPrefsDraft.unitLength,
      decimalSeparator: onboardingPrefsDraft.decimalSeparator,
      dateFormat: onboardingPrefsDraft.dateFormat,
      ...(bodyweightOk ? { bodyweight: bw } : {}),
    }).catch((err) => console.error('mergeUserSettings onboarding:', err))
    setOnboardingStep(3)
    void updateOnboardingProgress(user.uid, 3)
    setOnboardingProgrammeFlowLaunched(true)
    createProgramme()
  }

  function handleOnboardingResumeProgrammeFlow() {
    setOnboardingProgrammeFlowLaunched(true)
    createProgramme()
  }

  function handleOnboardingSkipAfterLegal() {
    finishOnboardingAfterProgramme()
  }

  function handleOnboardingBack() {
    if (!user?.uid) return
    if (onboardingStep === 1) {
      setOnboardingTermsOnlyPath(false)
      try {
        sessionStorage.removeItem(ONBOARDING_TERMS_ONLY_KEY)
      } catch (_) {}
      setOnboardingStep(0)
      void updateOnboardingProgress(user.uid, 0)
    } else if (onboardingStep === 2) {
      setOnboardingStep(1)
      void updateOnboardingProgress(user.uid, 1)
    } else if (onboardingStep === 3 && !onboardingProgrammeFlowLaunched) {
      setOnboardingStep(2)
      void updateOnboardingProgress(user.uid, 2)
    }
  }

  const lastWorkout = history.length > 0 ? history[0] : null
  const suggestedNext = getSuggestedNext()
  const isNew = history.length === 0

  function handlePhotoSessionLinkedToWorkout(photoSessionId, targetWorkoutSessionId) {
    const sid = targetWorkoutSessionId
    if (!sid || !user?.uid || !photoSessionId) return
    const target = history.find((h) => h.sessionId === sid)
    if (!target) return
    if ((target.photoSessionIds || []).length > 0) {
      setPhotoLinkTargetSessionId(null)
      return
    }
    const nextIds = [photoSessionId]
    updateWorkoutSessionPhotoSessions(user.uid, sid, nextIds)
      .then(() => setPhotoLinkTargetSessionId(null))
      .catch((err) => console.error('updateWorkoutSessionPhotoSessions:', err))
    setHistory((prev) => {
      const h = [...prev]
      const i = h.findIndex((x) => x.sessionId === sid)
      if (i >= 0) h[i] = { ...h[i], photoSessionIds: nextIds }
      return h
    })
  }

  function closePrivacyLegal() {
    setShowPrivacy(false)
    const h = (window.location.hash || '').replace(/\/$/, '')
    if (h === '#/privacy') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }

  function closeTermsLegal() {
    setShowTerms(false)
    const h = (window.location.hash || '').replace(/\/$/, '')
    if (h === '#/terms') {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    }
  }

  /** Undgå glimt før både appData (fx currentWorkout) og workout-plans er klar — ellers forsvinder overlay når kun den ene gren er færdig (typisk ved genlogin / cache). */
  const workoutBootstrapLoading =
    page === 'workout' &&
    !showCompleteScreen &&
    (!appDataLoaded || !workoutPlansLoaded) &&
    !showOnboardingUi

  if (!onboardingGateLoaded) {
    return <FullScreenBootSpinner ariaBusy={true} ariaLive="polite" />
  }

  return (
    <>
      {showPrivacy && <PrivacyPolicy onClose={closePrivacyLegal} />}
      {showTerms && <TermsOfService onClose={closeTermsLegal} />}
      {showOnboardingUi ? (
        <div className="fixed inset-0 z-[40] bg-page overflow-y-auto">
          <OnboardingScreen
            step={onboardingStep}
            onWelcomeContinue={handleOnboardingWelcomeContinue}
            onWelcomeSkip={handleOnboardingWelcomeSkip}
            legalChecked={onboardingLegalChecked}
            onLegalCheckedChange={setOnboardingLegalChecked}
            onLegalContinue={handleOnboardingLegalContinue}
            onSkipOnboarding={handleOnboardingSkipAfterLegal}
            termsOnlyPath={onboardingTermsOnlyPath}
            onOpenTerms={() => setShowTerms(true)}
            onOpenPrivacy={() => setShowPrivacy(true)}
            prefs={onboardingPrefsDraft}
            onPrefsChange={setOnboardingPrefsDraft}
            onPreferencesContinue={handleOnboardingPreferencesContinue}
            onResumeProgrammeFlow={handleOnboardingResumeProgrammeFlow}
            programmeFlowOpen={onboardingProgrammeFlowOpen}
            onBack={handleOnboardingBack}
            canGoBack={
              onboardingStep === 1 ||
              onboardingStep === 2 ||
              (onboardingStep === 3 && !onboardingProgrammeFlowLaunched)
            }
          />
        </div>
      ) : null}
      {workoutBootstrapLoading ? (
        <FullScreenBootSpinner ariaBusy={true} ariaLive="polite" />
      ) : null}
      <div className="min-h-screen bg-page text-text pb-16 overflow-x-hidden w-full max-w-[100%]">
        <div className="px-4 py-6 max-w-md mx-auto w-full min-w-0">

          {/* PROGRESS */}
          {page === 'progress' && (
            <ProgressErrorBoundary>
              <Suspense fallback={<LazyFallback />}>
              <ProgressScreen
                history={history ?? []}
                muscleLastWorked={muscleLastWorked ?? {}}
                routines={routines ?? []}
                programmes={programmes ?? []}
                weightLog={weightLog ?? []}
                setWeightLog={setWeightLog}
                bodyFatLog={bodyFatLog ?? []}
                setBodyFatLog={setBodyFatLog}
                measurementsLog={measurementsLog ?? []}
                setMeasurementsLog={setMeasurementsLog}
                muscleMassLog={muscleMassLog ?? []}
                setMuscleMassLog={setMuscleMassLog}
                photoSessions={photoSessions ?? []}
                setPhotoSessions={setPhotoSessions}
                bodyweight={bodyweight}
                weekStreak={getWeekStreak()}
                weekDays={getWeekDays()}
                weekStart={weekStart}
                unitWeight={unitWeight ?? 'kg'}
                unitLength={unitLength ?? 'cm'}
                formatDecimal={formatDecimal}
                parseDecimal={parseDecimal}
                formatDateForDisplay={(stored) => formatStoredDateForDisplay(stored, dateFormat)}
                allLibraryExercises={allLibraryExercises ?? []}
                postCompleteOpenPhoto={postCompleteOpenPhoto}
                onConsumedOpenAddPhoto={() => setPostCompleteOpenPhoto(false)}
                returnToWorkoutAfterPhotoClose={returnToWorkoutAfterPhotoClose}
                onReturnToWorkoutAfterPhoto={() => { setPage('workout'); setReturnToWorkoutAfterPhotoClose(false) }}
                photoLinkTargetSessionId={photoLinkTargetSessionId}
                onClearPhotoLinkTarget={() => setPhotoLinkTargetSessionId(null)}
                onPhotoSessionLinkedToWorkout={handlePhotoSessionLinkedToWorkout}
                userPlan={userPlan}
                planUsage={planUsage}
                onProgressPhotoAdded={handleProgressPhotoAdded}
                onProgressPhotoRemoved={handleProgressPhotoRemoved}
              />
              </Suspense>
            </ProgressErrorBoundary>
          )}

          {/* WORKOUT COMPLETE SCREEN */}
          {page === 'workout' && showCompleteScreen && completedWorkoutData && (
            <WorkoutCompleteScreen
              data={completedWorkoutData}
              rating={completeScreenRating}
              onRatingChange={setCompleteScreenRating}
              onDone={dismissCompleteScreen}
              recentWorkout={history[0] ?? null}
              photoSessions={photoSessions ?? []}
                onProgressPhoto={() => {
                  const targetSid = history.find(
                    (h) => h?.sessionId && !(Array.isArray(h.photoSessionIds) && h.photoSessionIds.length > 0)
                  )?.sessionId ?? null
                  setPhotoLinkTargetSessionId(targetSid)
                  setPostCompleteOpenPhoto(true)
                  setReturnToWorkoutAfterPhotoClose(true)
                  setPage('progress')
                }}
              formatDuration={formatDuration}
              unitWeight={unitWeight}
              formatDecimal={formatDecimal}
            />
          )}

          {/* WORKOUT START SCREEN (also when workout active but sheet closed) */}
          {page === 'workout' && (!workoutActive || !showActiveWorkoutSheet) && !showCompleteScreen && !workoutBootstrapLoading && (
            <div>
              <div className="flex items-center gap-3 mb-4"><RepliqeLogo size={28} /><h1 className="text-3xl font-bold tracking-tight">Workout</h1></div>

              {/* Continue workout bar when minimized */}
              {workoutActive && !showActiveWorkoutSheet && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveWorkoutSheetContinueIntent(true)
                    setShowActiveWorkoutSheet(true)
                  }}
                  className="w-full mb-4 py-3.5 px-4 rounded-xl border-2 border-success bg-success/10 flex items-center justify-between gap-3"
                  aria-label={`Continue workout: ${workoutName || 'Workout'}`}
                >
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-success overflow-visible" aria-hidden>
                      <circle cx="12" cy="12" r="8.5" className="fill-success animate-wo-clock-fill" />
                      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                      <polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-success text-xs font-semibold">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-success text-sm font-bold">Continue</span>
                </button>
              )}

              {/* Tab bar: Start | Plan */}
              <div className="flex rounded-[10px] p-[3px] mt-3 mb-5 border border-border-subtle bg-card-deep">
                <button onClick={() => setWorkoutTab('start')} className={`flex-1 py-2 text-center rounded-lg ${TYPE_TAB} transition-colors border ${workoutTab === 'start' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-muted-strong'}`}>Start</button>
                <button onClick={() => setWorkoutTab('plan')} className={`flex-1 py-2 text-center rounded-lg ${TYPE_TAB} transition-colors border ${workoutTab === 'plan' ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-muted-strong'}`}>Plan</button>
              </div>

              {workoutTab === 'start' && (
              <>
              {(() => {
                if (workoutPlansLoaded && programmes.length === 0) {
                  const emptyInProgress = workoutActive && startedFromEmptyRef.current
                  return (
                    <>
                      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">New programme</h2>
                      <div className="rounded-2xl border border-border bg-card p-6 text-center mb-5">
                        <div className="w-12 h-12 rounded-full bg-card-alt flex items-center justify-center mx-auto mb-3 text-muted-strong">
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" className="w-6 h-6 stroke-current"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div className="text-text font-bold text-base mb-1">No programme yet</div>
                        <p className="text-muted-strong text-sm mb-4">Create a programme to get structured workouts and track your progress.</p>
                        <button type="button" onClick={createProgramme} className="w-full py-2.5 border-2 border-accent/40 rounded-[10px] bg-accent/5 text-accent text-sm font-bold">+ Create programme</button>
                      </div>
                      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Empty workout</h2>
                      <button
                        type="button"
                        onClick={() => { if (emptyInProgress) { setShowActiveWorkoutSheet(true); return }; startEmpty() }}
                        className={`w-full py-4 px-4 border-2 rounded-[14px] flex items-center gap-3 transition-colors ${emptyInProgress ? 'border-[var(--in-progress-border-45)] bg-[var(--in-progress-surface-10)]' : 'border-accent/40 bg-accent/5'}`}
                      >
                        <span className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-lg font-bold shrink-0 ${emptyInProgress ? 'bg-[var(--in-progress-bg-strong)] text-in-progress' : 'bg-accent/10 text-accent'}`}>+</span>
                        <div className="text-left min-w-0">
                          {emptyInProgress ? (
                            <div className="inline-flex items-center rounded-full px-2.5 py-0.5 mb-1.5 border border-[var(--in-progress-border-30)] bg-[var(--in-progress-surface-10)] animate-pulse-badge">
                              <span className={`${TYPE_STATUS_BADGE} text-in-progress`}>IN PROGRESS</span>
                            </div>
                          ) : null}
                          <div className="text-text text-sm font-bold">{emptyInProgress ? 'Tap to open workout' : 'Start fresh and add exercises as you go'}</div>
                        </div>
                      </button>
                    </>
                  )
                }
                const activeProgramme = programmes.find(p => p.isActive) || null
                const showAsNoProgramme = !activeProgramme

                if (showAsNoProgramme) {
                  const emptyInProgress = workoutActive && startedFromEmptyRef.current
                  return (
                    <>
                      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">New programme</h2>
                      <div className="rounded-2xl border border-border bg-card p-6 text-center mb-5">
                        <div className="w-12 h-12 rounded-full bg-card-alt flex items-center justify-center mx-auto mb-3 text-muted-strong">
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" className="w-6 h-6 stroke-current"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div className="text-text font-bold text-base mb-1">No active programme</div>
                        <div className="text-muted-deep text-xs mb-4">Suggestions for your next routine will only be shown after you've created your first programme.</div>
                        <button type="button" onClick={() => setWorkoutTab('plan')} className="w-full py-2.5 border-2 border-accent/40 rounded-[10px] bg-accent/5 text-accent text-sm font-bold">Go to Plan</button>
                      </div>
                      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Empty workout</h2>
                      <button
                        type="button"
                        onClick={() => { if (emptyInProgress) { setShowActiveWorkoutSheet(true); return }; startEmpty() }}
                        className={`w-full py-4 px-4 border-2 rounded-[14px] flex items-center gap-3 transition-colors ${emptyInProgress ? 'border-[var(--in-progress-border-45)] bg-[var(--in-progress-surface-10)]' : 'border-accent/40 bg-accent/5'}`}
                      >
                        <span className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center text-lg font-bold shrink-0 ${emptyInProgress ? 'bg-[var(--in-progress-bg-strong)] text-in-progress' : 'bg-accent/10 text-accent'}`}>+</span>
                        <div className="text-left min-w-0">
                          {emptyInProgress ? (
                            <div className="inline-flex items-center rounded-full px-2.5 py-0.5 mb-1.5 border border-[var(--in-progress-border-30)] bg-[var(--in-progress-surface-10)] animate-pulse-badge">
                              <span className={`${TYPE_STATUS_BADGE} text-in-progress`}>IN PROGRESS</span>
                            </div>
                          ) : null}
                          <div className="text-text text-sm font-bold">{emptyInProgress ? 'Tap to open workout' : 'Start fresh and add exercises as you go'}</div>
                        </div>
                      </button>
                    </>
                  )
                }

                const nextRtnId = getNextRoutine(activeProgramme, history)
                const routineIds = activeProgramme.routineIds || []
                const routineChipGridStyle =
                  routineIds.length > 0
                    ? { gridTemplateColumns: `repeat(${routineIds.length}, minmax(0, 1fr))` }
                    : undefined
                const displayRtnId = (selectedStartRoutineId && routineIds.includes(selectedStartRoutineId)) ? selectedStartRoutineId : nextRtnId
                const displayRtnIdx = displayRtnId ? routineIds.indexOf(displayRtnId) : -1
                const displayRtn = displayRtnId ? routines.find(r => r.id === displayRtnId) : null
                const exCount = displayRtn?.exercises?.length ?? 0
                const setCountR = displayRtn?.exercises?.reduce((s, e) => s + getSetConfigs(e).length, 0) ?? 0
                const estMin = displayRtn ? Math.round(getEstimatedSecondsForRoutine(displayRtn, defaultRest) / 60) : 0

                const dayMuscles = displayRtn ? getDayMusclesSlugs(displayRtn.exercises || [], allLibraryExercises) : { primary: [], secondary: [] }
                const emptyInProgress = workoutActive && startedFromEmptyRef.current
                const startReadinessHint = null

                return (
                  <>
                    <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Active programme</h2>
                    {/* Programme card — Design C */}
                    <div className="rounded-[18px] border border-white/[0.07] overflow-hidden mb-5">

                      {/* TOP ZONE: programme name + day selector */}
                      <div className="px-4 pt-4 pb-3 bg-white/[0.02]">
                        <div className="mb-3 w-full min-w-0 text-left text-sm font-semibold text-white [overflow-wrap:anywhere]">
                          {activeProgramme.name}
                        </div>
                        {startReadinessHint ? (
                          <p className={`${TYPE_MICRO} text-amber-400/90 leading-snug mb-3`}>{startReadinessHint}</p>
                        ) : null}
                        {routineIds.length === 0 ? (
                          <div className="rounded-xl border border-border-strong bg-card-alt/80 p-4 text-sm text-muted-strong">
                            <p className="mb-3">This programme has no routines yet. Add one under Plan.</p>
                            <button type="button" onClick={() => setWorkoutTab('plan')} className="w-full py-2.5 rounded-xl border border-accent/40 bg-accent/10 text-accent text-sm font-bold">
                              Open Plan
                            </button>
                          </div>
                        ) : (
                          <div className="grid gap-x-1.5 items-end" style={routineChipGridStyle}>
                            {routineIds.map((rtnId) => {
                              const rtn = routines.find(r => r.id === rtnId)
                              const isSelected = rtnId === displayRtnId
                              return (
                                <div key={rtnId} className="min-w-0 flex flex-col items-stretch">
                                  <button
                                    type="button"
                                    onClick={() => rtn && setSelectedStartRoutineId(rtnId)}
                                    className={`w-full flex-1 min-w-0 rounded-[10px] py-2.5 px-1.5 text-center border relative transition-[transform,colors,background-color,border-color] duration-200 ease-out ${
                                      isSelected
                                        ? 'border-[var(--plan-border-35)] bg-[var(--plan-surface-08)] translate-y-[10px] z-10'
                                        : 'z-0 translate-y-0 bg-card-alt border-border-strong hover:bg-card-alt/80 hover:border-[#3A3A5A]'
                                    }`}
                                  >
                                    <div className={`${TYPE_MICRO} font-semibold truncate ${isSelected ? 'text-plan-text' : 'text-[var(--plan-text-muted)]'}`}>
                                      {isSelected ? (
                                        <span className="inline-flex justify-center min-h-[1em] animate-up-next-fade-in-after-title">
                                          <span className="inline-block text-[10px] tracking-[0.14em] uppercase animate-up-next-pulse-soft">Up next</span>
                                        </span>
                                      ) : (
                                        rtn?.name || '—'
                                      )}
                                    </div>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* BOTTOM ZONE: samme kolonne-grid som chips — titel spænder fra valgt boks til højre kant */}
                      {displayRtn && (
                        <div className="border-t border-white/[0.05]">
                          <div className="px-4 pt-3 pb-4">
                          <div className="grid gap-x-1.5 items-start mb-3" style={routineChipGridStyle}>
                            {(() => {
                              const narrowEndChip = displayRtnIdx >= 3
                              const oneLineNarrow = displayRtnIdx >= 1
                              const gridCol = oneLineNarrow
                                ? `${displayRtnIdx + 1} / ${displayRtnIdx + 2}`
                                : `${displayRtnIdx + 1} / -1`
                              const titleRow =
                                displayRtnIdx === 0
                                  ? 'flex flex-wrap gap-x-2 gap-y-1 justify-start items-center'
                                  : 'flex flex-nowrap gap-x-2 justify-start items-center'
                              const badgeSelf = 'self-center'
                              const h3Cls = oneLineNarrow
                                ? 'text-sm font-semibold text-white whitespace-nowrap shrink-0 leading-snug animate-start-routine-title-move'
                                : 'text-sm font-semibold text-white min-w-0 max-w-full leading-snug animate-start-routine-title-move [overflow-wrap:anywhere]'
                              const titleAbbrevInnerCls = oneLineNarrow
                                ? 'routine-title-abbrev-inner routine-title-abbrev-inner--oneline'
                                : 'routine-title-abbrev-inner routine-title-abbrev-inner--wrap'
                              const metaCls = oneLineNarrow
                                ? `${TYPE_META} text-white/30 mt-[2px] whitespace-nowrap text-left`
                                : `${TYPE_META} text-white/30 mt-[2px] min-w-0 text-left leading-snug [overflow-wrap:anywhere]`
                              const trained = (() => {
                                const days = getDaysSinceRoutine(displayRtnId)
                                if (days === null) return 'Never trained'
                                if (days === 0) return 'Trained today'
                                if (days === 1) return 'Last trained yesterday'
                                return `Last trained ${days} days ago`
                              })()
                              const gridItemStyle = oneLineNarrow
                                ? {
                                    gridColumn: gridCol,
                                    justifySelf: narrowEndChip ? 'end' : 'center',
                                    width: 'max-content',
                                  }
                                : { gridColumn: gridCol }
                              return (
                                <div
                                  key={displayRtnId}
                                  className={oneLineNarrow ? 'min-w-0 z-[1]' : 'min-w-0'}
                                  style={gridItemStyle}
                                >
                                  <div className="flex flex-col items-start text-left">
                                    <div className={titleRow}>
                                      <h3 className={h3Cls}>
                                        <span className={titleAbbrevInnerCls}>{displayRtn.name}</span>
                                      </h3>
                                      {workoutActive && !emptyInProgress ? (
                                        <div className={`inline-flex items-center rounded-full px-3 py-1 border border-[var(--in-progress-border-30)] bg-[var(--in-progress-surface-10)] animate-pulse-badge shrink-0 ${badgeSelf}`}>
                                          <span className={`${TYPE_MICRO} font-extrabold tracking-[0.8px] text-in-progress`}>IN PROGRESS</span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className={metaCls}>{trained}</div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>

                          <div className="flex gap-2 mb-3">
                            {[
                              { val: exCount, lbl: 'Exercises' },
                              { val: setCountR, lbl: 'Sets' },
                              { val: estMin, lbl: 'Est. min' },
                            ].map(({ val, lbl }) => (
                              <div key={lbl} className="flex-1 bg-white/[0.03] rounded-[10px] py-[9px] px-2 text-center">
                                <span className={`${TYPE_STAT_NUMBER} block leading-none`}>{val}</span>
                                <span className={`${TYPE_MICRO_TIGHT} font-semibold tracking-[0.06em] uppercase text-white/30 block mt-[3px]`}>{lbl}</span>
                              </div>
                            ))}
                          </div>

                          {/* Compact recovery bar + muscle pills inline */}
                          {!workoutActive && (() => {
                            const allSlugs = [...new Set([...(dayMuscles.primary || []), ...(dayMuscles.secondary || [])])]
                            if (allSlugs.length === 0) return null
                            const recoveryPct = getRecoveryPct(dayMuscles, muscleLastWorked)
                            const recoveryAccent = 'var(--plan-text)'
                            return (
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setShowStartRecoveryInfo(true)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setShowStartRecoveryInfo(true)
                                  }
                                }}
                                className="mb-3 w-full rounded-lg -mx-1 px-1 py-1 text-left cursor-pointer hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors outline-none focus-visible:ring-1 focus-visible:ring-[var(--a11y-focus-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-page"
                                aria-label="Recovery details for this day"
                              >
                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                  <span className="flex items-center gap-2 min-w-0">
                                    <span className={`${TYPE_LABEL_UPPER} tracking-[0.06em] text-[var(--plan-text-muted)]`}>Recovery</span>
                                    <span
                                      className={`shrink-0 text-accent ${TYPE_BODY_SM} leading-none pointer-events-none`}
                                      aria-hidden
                                    >
                                      →
                                    </span>
                                  </span>
                                  <span className={`${TYPE_MICRO} font-bold tabular-nums`} style={{ color: recoveryAccent }}>{recoveryPct}%</span>
                                </div>
                                <div className="h-[3px] rounded-full bg-white/[0.07] overflow-hidden mb-2">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${recoveryPct}%`, background: recoveryAccent }}
                                  />
                                </div>
                                <div
                                  className="flex flex-nowrap gap-1 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 touch-pan-x [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
                                >
                                  {allSlugs.map((slug) => {
                                    const SLUG_COLORS = {
                                      chest: '#7B7BFF',
                                      'front-delts': '#4ECDC4',
                                      'side-delts': '#4ECDC4',
                                      'rear-delts': '#4ECDC4',
                                      triceps: '#ff6b6b',
                                      biceps: '#ff6b6b',
                                      forearms: '#ff6b6b',
                                      back: '#5BF5A0',
                                      lats: '#5BF5A0',
                                      traps: '#5BF5A0',
                                      'lower-back': '#5BF5A0',
                                      abs: '#C8A0FF',
                                      obliques: '#C8A0FF',
                                      quads: '#FFAA50',
                                      hamstrings: '#FFAA50',
                                      glutes: '#FFAA50',
                                      calves: '#FFAA50',
                                    }
                                    const color = SLUG_COLORS[slug] || 'rgba(255,255,255,0.4)'
                                    const label = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
                                    return (
                                      <span
                                        key={slug}
                                        title={label}
                                        className={`shrink-0 ${TYPE_CAPTION} font-semibold px-[7px] py-[3px] rounded-full whitespace-nowrap`}
                                        style={{ color, background: `${color}14` }}
                                      >
                                        {label}
                                      </span>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}

                          {!workoutActive && (
                            <button
                              type="button"
                              onClick={() => tryStart('routine', displayRtn)}
                              className={`w-full py-4 rounded-2xl ${TYPE_TITLE_BLOCK} !font-semibold text-white flex items-center justify-center gap-2.5 active:opacity-95`}
                              style={{ background: 'var(--plan-gradient)', boxShadow: 'var(--plan-shadow-card)' }}
                              aria-label={`Start ${displayRtn?.name || 'workout'}`}
                            >
                              <span
                                className="inline-block w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white shrink-0 animate-start-play-triangle"
                                style={{ marginLeft: 2 }}
                                aria-hidden
                              />
                              Start
                            </button>
                          )}
                          </div>
                        </div>
                      )}
                    </div>
                    <h2 className="mb-2 mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">Empty workout</h2>
                    <button
                      type="button"
                      onClick={() => { if (emptyInProgress) { setShowActiveWorkoutSheet(true); return }; startEmpty() }}
                      className={`w-full rounded-2xl p-4 flex items-center gap-3.5 transition-colors ${
                        emptyInProgress
                          ? 'border-[1.5px] border-[var(--in-progress-border-40)] bg-[var(--in-progress-surface-08)]'
                          : 'border border-[var(--plan-border-35)] bg-[var(--plan-surface-07)]'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${TYPE_HERO_PLUS} shrink-0 ${emptyInProgress ? 'bg-[var(--in-progress-bg-soft)] text-in-progress' : 'bg-[var(--plan-surface-18)] text-plan-text'}`}>+</div>
                      <div className="text-left min-w-0">
                        {emptyInProgress ? (
                          <div className="inline-flex items-center rounded-full px-2.5 py-0.5 mb-1.5 border border-[var(--in-progress-border-30)] bg-[var(--in-progress-surface-10)] animate-pulse-badge">
                            <span className={`${TYPE_STATUS_BADGE} text-in-progress`}>IN PROGRESS</span>
                          </div>
                        ) : null}
                        <div className="text-sm font-bold text-text">{emptyInProgress ? 'Tap to open workout' : 'Start fresh and add exercises as you go'}</div>
                      </div>
                    </button>
                    {showStartRecoveryInfo && displayRtn ? (
                      <RecoveryModal
                        muscles={dayMuscles}
                        muscleLastWorked={muscleLastWorked}
                        dayName={displayRtn.name}
                        onClose={() => setShowStartRecoveryInfo(false)}
                      />
                    ) : null}
                  </>
                )
              })()}
              </>
              )}

              {workoutTab === 'plan' && (
                <div className="plan-tab">
                  {(() => {
                    const sortedProgrammes = [...programmes].sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
                    if (sortedProgrammes.length === 0) {
                      return (
                        <>
                          <div className="rounded-2xl border border-border bg-card p-6 text-center mb-4">
                            <div className="w-12 h-12 rounded-full bg-[var(--plan-surface-12)] flex items-center justify-center mx-auto mb-3 text-plan-text">
                              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" className="w-6 h-6 stroke-current"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                            </div>
                            <div className="text-text font-bold text-base mb-1">No programme yet</div>
                            <p className="text-muted-strong text-sm mb-4">Create a programme to get structured workouts and track your progress.</p>
                            <button type="button" onClick={createProgramme} className="w-full py-2.5 border-2 border-accent/40 rounded-[10px] bg-accent/5 text-accent text-sm font-bold">+ Create programme</button>
                          </div>
                        </>
                      )
                    }
                    const manualProgrammes = sortedProgrammes.filter((p) => !p.isQoreGenerated)
                    const coachProgrammes = sortedProgrammes.filter((p) => p.isQoreGenerated)
                    const renderProgrammeCard = (prog) => {
                      const progRoutines = (prog.routineIds || []).map(id => routines.find(r => r.id === id)).filter(Boolean)
                      const isActive = prog.isActive
                      return (
                        <div
                          key={prog.id}
                          className={`rounded-[14px] p-4 mb-4 border ${isActive ? 'border border-white/[0.07] bg-white/[0.02]' : 'border border-border bg-card'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-semibold tracking-tight text-white flex-1 min-w-0 truncate">{prog.name}</span>
                                <div className="flex items-center shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => openEditProgramme(prog.id)}
                                    className="p-2 rounded-lg text-plan-text hover:text-plan-hover hover:bg-white/5 active:opacity-80"
                                    title="Edit programme"
                                    aria-label="Edit programme"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current">
                                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => copyProgramme(prog.id)}
                                    className="p-2 rounded-lg text-plan-text hover:text-plan-hover hover:bg-white/5 active:opacity-80"
                                    title="Copy programme"
                                    aria-label="Copy programme"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteProgrammeConfirm(prog.id)}
                                    className="p-2 rounded-lg text-[var(--semantic-negative-soft)] hover:text-red-400 hover:bg-white/5 active:opacity-80"
                                    title="Delete programme"
                                    aria-label={`Delete programme ${prog.name}`}
                                  >
                                    <DeleteTrashGlyph className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              <div className={`${TYPE_MICRO} text-white/35 mt-0.5`}>{progRoutines.length} routines</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 self-center">
                              {isActive ? (
                                <span
                                  className={`inline-flex items-center justify-center w-24 shrink-0 py-1.5 rounded-md border border-[var(--plan-border-35)] bg-[var(--plan-surface-10)] text-plan-text ${TYPE_LABEL_UPPER} tracking-wide leading-none animate-up-next-pulse min-h-[32px]`}
                                  aria-label="Active programme"
                                >
                                  Active
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setProgrammeActive(prog.id)}
                                  className={`inline-flex items-center justify-center w-24 shrink-0 py-1.5 rounded-md border border-[var(--plan-border-35)] bg-[var(--plan-surface-08)] text-plan-text ${TYPE_LABEL_UPPER} tracking-wide leading-none hover:bg-[var(--plan-surface-12)] active:opacity-90 transition-colors whitespace-nowrap min-h-[32px]`}
                                >
                                  Set active
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            {progRoutines.map((r) => {
                              const meta = routinePlanTileMeta(r, allLibraryExercises)
                              const focusStr =
                                meta.focusLabels.length === 0
                                  ? null
                                  : meta.focusLabels.length <= 3
                                    ? meta.focusLabels.join(' · ')
                                    : `${meta.focusLabels.slice(0, 3).join(' · ')} · +${meta.focusLabels.length - 3}`
                              return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  routineEditorOpenedFromPlanRef.current = true
                                  setEditProgrammeName(prog.name ?? '')
                                  setEditRoutineName(r.name)
                                  setEditRoutineExercises((r.exercises || []).map(ex => ({ ...ex, id: ex.id ?? crypto.randomUUID(), supersetGroupId: ex.supersetGroupId ?? null, supersetRole: ex.supersetRole ?? null })))
                                  setEditingRoutineId(r.id)
                                  setEditingRoutineProgrammeId(prog.id)
                                }}
                                className={`flex-1 min-w-0 rounded-[10px] py-2.5 px-2 sm:py-2 sm:px-1.5 text-center border transition-colors ${
                                  isActive
                                    ? 'border-[var(--plan-border-45)] bg-[var(--plan-surface-10)]'
                                    : 'bg-card-alt border-border-strong hover:bg-card-alt/80 hover:border-[#3A3A5A]'
                                }`}
                              >
                                <div className={`${TYPE_BODY_SM_SEMIBOLD} sm:text-[13px] truncate leading-tight ${isActive ? 'text-plan-hover' : 'text-[var(--plan-text-row)]'}`}>{r.name}</div>
                                <div className={`${TYPE_MICRO} sm:text-[11px] mt-1 tabular-nums leading-snug font-medium ${isActive ? 'text-white/65' : 'text-white/50'}`}>
                                  {meta.exCount} ex · {meta.setCount} sets
                                </div>
                                {focusStr ? (
                                  <div
                                    className={`${TYPE_META} sm:text-[10px] mt-1 leading-snug line-clamp-2 font-medium ${isActive ? 'text-[var(--plan-text-focus-secondary)]' : 'text-white/42'}`}
                                    title={meta.focusLabels.join(', ')}
                                  >
                                    {focusStr}
                                  </div>
                                ) : null}
                              </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    return (
                      <>
                        {manualProgrammes.length > 0 && (
                          <>
                            <div role="heading" aria-level={2} className="plan-section-title">
                              My Programmes
                            </div>
                            {manualProgrammes.map(renderProgrammeCard)}
                          </>
                        )}
                        {coachProgrammes.length > 0 && (
                          <>
                            <div
                              role="heading"
                              aria-level={2}
                              className={
                                manualProgrammes.length > 0
                                  ? 'plan-section-title plan-section-title--after-block'
                                  : 'plan-section-title'
                              }
                            >
                              Coach programmes
                            </div>
                            {coachProgrammes.map(renderProgrammeCard)}
                          </>
                        )}
                        <button type="button" onClick={createProgramme} className={`w-full py-3 border border-dashed border-accent/30 rounded-xl bg-transparent text-accent ${TYPE_BODY_SEMIBOLD} mb-4`}>
                          + Create programme
                        </button>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ACTIVE WORKOUT - full bottom sheet */}
          {page === 'workout' && workoutActive && showActiveWorkoutSheet && !showCompleteScreen && !workoutBootstrapLoading && (
            <BottomSheet onClose={() => setShowActiveWorkoutSheet(false)} variant="page" layout="flex" showHandle={false} padding="none">
                <div className="sticky top-0 z-10 pt-2 pb-2 px-4 bg-page">
                  <div className="w-9 h-1 bg-handle rounded mx-auto mb-3 shrink-0" />
                  <div className="flex items-center justify-between mb-1 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="sr-only">{workoutName || 'Workout'}</span>
                      <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 text-success overflow-visible" aria-hidden>
                        <circle cx="12" cy="12" r="8.5" className="fill-success animate-wo-clock-fill" />
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
                        <polyline points="12 6 12 12 16 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="flex items-center gap-2 text-sm font-bold tabular-nums shrink-0">
                        <span className="text-success">{formatTime(workoutElapsed)}</span>
                        {exercises.some(ex => (ex.sets || []).some(s => !s.done)) && (
                          <span className="text-muted">−{formatTime(getEstimatedSecondsRemaining())}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" onClick={() => setShowActiveWorkoutSheet(false)} className="text-muted-mid p-1.5 rounded-lg hover:bg-white/5" aria-label="Minimize">▼</button>
                      <button type="button" onClick={finishWorkout} className="text-sm font-bold text-on-accent bg-accent px-3 py-1.5 rounded-lg shadow-accent/25">Finish</button>
                    </div>
                  </div>
                  {activeRest && showStickyRestBar && (() => {
                    const progress = restDuration > 0 ? Math.max(0, Math.min(1, restTime / restDuration)) : 0
                    const barWidthPct = progress * 100
                    const sidePct = (1 - progress) * 50
                    return (
                      <div className="mb-1 w-full rest-timer-fade-in">
                        <div
                          data-sticky-rest="1"
                          className="flex w-full items-center justify-center gap-1.5 py-0.5 rounded-lg relative min-h-0 pointer-events-none overflow-hidden isolate bg-card-alt/35"
                          style={{ height: '1.2rem' }}
                        >
                          <div
                            className="absolute top-0 bottom-0 left-1/2 z-0 -translate-x-1/2 rounded-sm transition-[width] duration-500 ease-out bg-gradient-to-r from-accent/75 to-accent-end/75"
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
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-2.5 h-2.5 stroke-white/90 relative z-10 shrink-0" aria-hidden>
                            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span className="text-white/95 font-bold text-xs tabular-nums relative z-10 min-w-[28px] text-center">{formatTime(restTime)}</span>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {editingTemplate && (
                  <div className="bg-accent/10 border border-accent/30 rounded-xl p-3 mb-3 shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-xs font-bold text-accent uppercase tracking-wider mb-1">Editing template</div>
                        <input type="text" value={workoutName} onChange={(e) => setWorkoutName(e.target.value)} onFocus={e => e.target.select()}
                          className="w-full bg-transparent border-b border-accent/30 text-sm font-bold text-text outline-none focus:border-accent transition-colors pb-1" />
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={saveEditedTemplate} className="px-3 py-1.5 bg-accent text-on-accent rounded-lg text-sm font-bold">Save</button>
                        <button onClick={cancelEditTemplate} className="px-3 py-1.5 border border-border-strong rounded-lg text-sm font-semibold text-muted">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={workoutScrollAreaRef} className="overflow-y-auto overflow-x-hidden flex-1 min-h-0 -mx-4 px-4 pt-1 min-w-0" onScroll={handleWorkoutScroll}>
                  {linkMode.active && (
                    <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-page">
                      <LinkModeBanner
                        sourceName={exercises.find(e => e.id === linkMode.sourceId)?.name ?? ''}
                        onCancel={cancelLinkMode}
                      />
                    </div>
                  )}
                  {(() => {
                    const globalNext = getGlobalNextSet()
                    return getGrouped().map(group => {
                      if (group.type === 'superset') {
                        const nextSetInfo = getSupersetNextSet(group.a, group.b)
                        const iA = exercises.indexOf(group.a)
                        const iB = exercises.indexOf(group.b)
                        const focusA = globalNext && globalNext.exIndex === iA && globalNext.setIndex === nextSetInfo?.nextSetIndex && nextSetInfo?.nextIsA
                        const focusB = globalNext && globalNext.exIndex === iB && globalNext.setIndex === nextSetInfo?.nextSetIndex && !nextSetInfo?.nextIsA
                        return (
                          <SupersetWrapper
                            key={group.groupId}
                            groupId={group.groupId}
                            exerciseA={group.a}
                            exerciseB={group.b}
                            nextSetInfo={nextSetInfo}
                            onBreak={() => breakSuperset(group.groupId)}
                            renderCard={(exercise, role, { supersetIsNext: _supersetIsNext, supersetNextSetIndex: _supersetNextSetIndex }) => {
                              const exIndex = exercises.indexOf(exercise)
                              const isA = role === 'A'
                              const supersetIsNext = isA ? focusA : focusB
                              const supersetNextSetIndex = supersetIsNext && nextSetInfo ? nextSetInfo.nextSetIndex : null
                              return (
                            <div key={exercise.id} id={`workout-exercise-${exIndex}`} className="scroll-mt-[7rem]">
                            <ExerciseCard
                              exercise={exercise}
                              exIndex={exIndex}
                              isEditing={!!editingTemplate}
                              exerciseCount={exercises.length}
                              supersetRole={role}
                              supersetIsNext={supersetIsNext}
                              supersetNextSetIndex={supersetNextSetIndex}
                              isLinkModeActive={false}
                              isLinkSource={false}
                              isLinkTarget={false}
                              onStartLinkMode={() => startLinkMode(exercise.id)}
                              onBreakSuperset={() => breakSuperset(exercise.supersetGroupId)}
                              onMoveUp={moveExerciseUp}
                              onMoveDown={moveExerciseDown}
                              onRemoveExercise={removeExercise}
                              onReplaceExercise={openReplaceExerciseFromWorkout}
                              onAddSet={addSet}
                              onUpdateSet={updateSet}
                              onDoneSet={doneSet}
                              onUndoneSet={undoneSet}
                              onDeleteSet={deleteSet}
                              onUpdateExerciseRest={updateExerciseRest}
                              onUpdateExerciseNote={updateExerciseNote}
                              bestSet={getBestSet(exercise.name)}
                              previousSets={getPreviousSets(exercise.name)}
                              activeRest={activeRest}
                              restTime={restTime}
                              restDuration={restDuration}
                              defaultRest={defaultRest}
                              bodyweight={bodyweight}
                              unitWeight={unitWeight}
                              unitDistance={unitDistance}
                              formatDecimal={formatDecimal}
                              parseDecimal={parseDecimal}
                              libraryEntry={getExerciseFromLibrary(exercise.name)}
                              rirEnabled={isRirActive(exercise, rirEnabled)}
                              globalRirEnabled={rirEnabled}
                              onRirOverride={(exIdx, value) => setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, rirOverride: value } : e))}
                              coachTipData={
                                userPlan === 'free' && !coachTipDismissed && coachTipExIndex === exIndex && currentCoachTip != null
                                  ? currentCoachTip
                                  : null
                              }
                              coachTipSetIndex={coachTipExIndex === exIndex ? coachTipSetIndex : null}
                              onCoachTipYes={handleCoachTipYes}
                              onCoachTipNo={handleCoachTipNo}
                            />
                            </div>
                          ); }}
                        />
                      )
                    }
                    const ex = group.exercise
                    const exIndex = exercises.indexOf(ex)
                    const isSource = linkMode.sourceId === ex.id
                    const isTarget = linkMode.active && !isSource && !ex.supersetGroupId
                    const nextSetIndexStandalone = (ex.sets || []).findIndex(s => !s.done)
                    const showNextFocusStandalone = globalNext && globalNext.exIndex === exIndex && globalNext.setIndex === nextSetIndexStandalone
                    return (
                      <div key={ex.id} id={`workout-exercise-${exIndex}`} className="scroll-mt-[7rem]">
                      <ExerciseCard
                        exercise={ex}
                        exIndex={exIndex}
                        isEditing={!!editingTemplate}
                        exerciseCount={exercises.length}
                        supersetRole={null}
                        supersetIsNext={!!showNextFocusStandalone}
                        supersetNextSetIndex={showNextFocusStandalone ? nextSetIndexStandalone : null}
                        isLinkModeActive={linkMode.active}
                        isLinkSource={isSource}
                        isLinkTarget={isTarget}
                        onTapAsTarget={isTarget ? () => confirmSuperset(ex.id, (groupId) => { setTimeout(() => document.getElementById('superset-' + groupId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }) : undefined}
                        onStartLinkMode={() => startLinkMode(ex.id)}
                        onBreakSuperset={() => breakSuperset(ex.supersetGroupId)}
                        onMoveUp={moveExerciseUp}
                        onMoveDown={moveExerciseDown}
                        onRemoveExercise={removeExercise}
                        onReplaceExercise={openReplaceExerciseFromWorkout}
                        onAddSet={addSet}
                        onUpdateSet={updateSet}
                        onDoneSet={doneSet}
                        onUndoneSet={undoneSet}
                        onDeleteSet={deleteSet}
                        onUpdateExerciseRest={updateExerciseRest}
                        onUpdateExerciseNote={updateExerciseNote}
                        bestSet={getBestSet(ex.name)}
                        previousSets={getPreviousSets(ex.name)}
                        activeRest={activeRest}
                        restTime={restTime}
                        restDuration={restDuration}
                        defaultRest={defaultRest}
                        bodyweight={bodyweight}
                        unitWeight={unitWeight}
                        unitDistance={unitDistance}
                        formatDecimal={formatDecimal}
                        parseDecimal={parseDecimal}
                        libraryEntry={getExerciseFromLibrary(ex.name)}
                        rirEnabled={isRirActive(ex, rirEnabled)}
                        globalRirEnabled={rirEnabled}
                        onRirOverride={(exIdx, value) => setExercises(prev => prev.map((e, i) => i === exIdx ? { ...e, rirOverride: value } : e))}
                        coachTipData={
                          userPlan === 'free' && !coachTipDismissed && coachTipExIndex === exIndex && currentCoachTip != null
                            ? currentCoachTip
                            : null
                        }
                        coachTipSetIndex={coachTipExIndex === exIndex ? coachTipSetIndex : null}
                        onCoachTipYes={handleCoachTipYes}
                        onCoachTipNo={handleCoachTipNo}
                      />
                      </div>
                    )
                  });
                  })()}

                  <button type="button" onClick={() => { setExerciseLibraryReplaceIndex(null); setShowAddExercise(true) }} className="w-full py-3 mb-4 border border-dashed border-success/30 rounded-xl text-success text-sm font-semibold hover:bg-success/8 hover:border-success transition-colors">+ Add exercise</button>

                  {!editingTemplate && (
                    <div className="flex flex-col gap-3 mt-2 mb-8">
                      <ActionButton type="button" variant="secondary" className="!border-2 hover:border-red-500/50 hover:text-red-400" onClick={() => setShowCancelWorkoutConfirm(true)}>
                        Cancel workout
                      </ActionButton>
                    </div>
                  )}
                </div>
            </BottomSheet>
          )}

          {/* COACH */}
          {page === 'coach' && (
            <Suspense fallback={<LazyFallback />}>
              <CoachScreen
                userId={user?.uid}
                userPlan={userPlan}
                activeProgramme={activeProgramme}
                allRoutines={routines}
                workoutSessions={history}
                onApplyProgrammeChange={handleApplyProgrammeChange}
                onShowPricing={() => setShowPricing(true)}
              />
            </Suspense>
          )}

          {/* PROFILE */}
          {page === 'profile' && (
            <div>
              {/* Fixed header – same pattern as Progress */}
              <div className="fixed top-0 left-0 right-0 z-20 bg-page border-b border-border/50 max-w-md mx-auto">
                <div className="px-4 pt-3 pb-1.5">
                  <div className="flex items-center gap-3 mb-2">
                    <RepliqeLogo size={28} />
                    <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
                  </div>
                  <div className="flex rounded-[10px] p-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
                    {['Account', 'Settings', 'About'].map((t) => {
                      const key = t.toLowerCase()
                      const active = (profileSection || 'account') === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setProfileSection(key)}
                          className={`flex-1 py-2 text-center rounded-lg ${TYPE_TAB} transition-colors border ${active ? 'border-accent bg-accent/10 text-accent' : 'border-transparent text-muted-strong'}`}
                        >
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="h-[6rem]" aria-hidden="true" />

              {(profileSection || 'account') === 'account' && (
                <AccountTab
                  userPlan={userPlan}
                  setShowPricing={setShowPricing}
                  planUsage={planUsage}
                  programmes={programmes}
                  photoSessions={photoSessions}
                />
              )}

              {(profileSection || 'account') === 'settings' && (
                <div className="mt-1">

                  <div className={`${CARD_SURFACE_LG} p-5 mb-4`}>
                    <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">Appearance</h3>
                    <div className="theme-selector">
                      <div className="theme-options flex gap-2">
                        <button type="button" className={`theme-option flex-1 ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setThemeAndApply('dark')}>
                          <div className="theme-preview theme-preview-dark">
                            <div className="tp-bar" />
                            <div className="tp-block" />
                            <div className="tp-block short" />
                          </div>
                          <span className="theme-option-name text-xs font-bold mt-1 block">Dark</span>
                        </button>
                        <button type="button" className={`theme-option flex-1 ${theme === 'bone' ? 'selected' : ''}`} onClick={() => setThemeAndApply('bone')}>
                          <div className="theme-preview theme-preview-bone">
                            <div className="tp-bar" />
                            <div className="tp-block" />
                            <div className="tp-block short" />
                          </div>
                          <span className="theme-option-name text-xs font-bold mt-1 block">Bone</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={`${CARD_SURFACE_LG} p-5 mb-4`}>
                    <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">Units</h3>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Weight</div>
                      <div className="flex gap-2">
                        {['kg', 'lbs'].map(u => <button key={u} onClick={() => setUnitWeight(u)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors border ${unitWeight === u ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{u}</button>)}
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Distance</div>
                      <div className="flex gap-2">
                        {['km', 'miles'].map(u => <button key={u} onClick={() => setUnitDistance(u)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors border ${unitDistance === u ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{u}</button>)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1">Length</div>
                      <div className="flex gap-2">
                        {['cm', 'inch'].map(u => <button key={u} onClick={() => setUnitLength(u)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors border ${unitLength === u ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{u}</button>)}
                      </div>
                    </div>
                  </div>

                  <div className={`${CARD_SURFACE_LG} p-5 mb-4`}>
                    <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">Format</h3>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Decimal separator</div>
                      <div className="flex gap-2">
                        {[{ id: 'comma', label: '1,5 (comma)' }, { id: 'period', label: '1.5 (period)' }].map(({ id, label }) => (
                          <button key={id} onClick={() => setDecimalSeparator(id)} className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors border ${decimalSeparator === id ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold mb-1">Date format</div>
                      <div className="flex gap-2 flex-wrap">
                        {[{ id: DATE_FORMAT_DDMY, label: 'Day/Month/Year' }, { id: DATE_FORMAT_MMDY, label: 'Month/Day/Year' }].map(({ id, label }) => (
                          <button key={id} onClick={() => setDateFormat(id)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${dateFormat === id ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`${CARD_SURFACE_LG} p-5 mb-4`}>
                    <h3 className="text-xs font-semibold text-accent uppercase tracking-wide mb-3">Workout</h3>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Bodyweight</div>
                      <div className="text-xs text-muted-mid mb-2">Used for volume on bodyweight exercises</div>
                      <div className="flex items-center gap-3">
                        <input type="text" inputMode="decimal" value={formatDecimal(bodyweight)} onChange={(e) => { const v = e.target.value; if (v === '') setBodyweight(0); else { const n = parseDecimal(v); if (!Number.isNaN(n)) setBodyweight(n) } }} onBlur={() => { if (bodyweight === '' || bodyweight == null) setBodyweight(0) }} className="w-24 bg-card-alt border border-border-strong rounded-xl px-3 py-2 text-center text-sm font-bold text-text outline-none focus:border-accent transition-colors" />
                        <span className="text-sm text-muted-mid">{unitWeight}</span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Rest timer</div>
                      <div className="text-xs text-muted-mid mb-2">Default rest between sets</div>
                      <div className="flex gap-2 flex-wrap">
                        {REST_PRESETS.map(s => <button key={s} onClick={() => setDefaultRest(s)} className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${defaultRest === s ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{s === 0 ? 'None' : formatTime(s)}</button>)}
                      </div>
                      <div className="text-xs text-muted-deep mt-2">Current: {defaultRest === 0 ? 'None' : formatTime(defaultRest)}</div>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm font-semibold mb-1">Week starts on</div>
                      <div className="flex gap-2 flex-wrap">
                        {WEEK_DAYS.map((d, i) => <button key={i} onClick={() => setWeekStart(i)} className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors border ${weekStart === i ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted hover:border-accent'}`}>{d.slice(0, 3)}</button>)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-card-alt rounded-xl border border-border">
                      <div>
                        <div className="text-sm font-bold text-text">RIR Tracking</div>
                        <div className="text-xs text-muted-strong mt-0.5">Log reps in reserve per set</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rirEnabled}
                        aria-label="RIR tracking"
                        onClick={() => setRirEnabled((prev) => !prev)}
                        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${rirEnabled ? 'bg-accent' : 'bg-border-strong'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${rirEnabled ? 'left-5' : 'left-0.5'}`}
                          aria-hidden
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {(profileSection || 'account') === 'about' && (
                <AboutTab setShowPrivacy={setShowPrivacy} setShowTerms={setShowTerms} />
              )}
            </div>
          )}
        </div>

        {/* MODALS */}
        {/* Delete Programme confirmation (centered) */}
        {showDeleteProgrammeConfirm && (
          <BottomSheet align="center" variant="card" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/60 backdrop-blur-sm">
            <div className="text-center">
              <DeleteTrashBadge />
              <h2 className="text-text text-lg font-bold mb-2">Delete Programme?</h2>
              <p className="text-muted text-sm mb-5">{programmes.find(p => p.id === showDeleteProgrammeConfirm)?.name} and all its routines will be permanently deleted.</p>
              <div className="flex gap-3">
                <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setShowDeleteProgrammeConfirm(null)}>
                  Cancel
                </ActionButton>
                <ActionButton type="button" variant="danger" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => { void confirmDeleteProgrammeAction(showDeleteProgrammeConfirm) }}>
                  <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                  Delete
                </ActionButton>
              </div>
            </div>
          </BottomSheet>
        )}

        {editProgrammeRoutinePendingDelete && (
          <BottomSheet align="center" variant="card" zClass="z-[100]" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} ariaModal={true} backdropClassName="bg-black/60 backdrop-blur-sm" panelClassName="text-center">
              <DeleteTrashBadge />
              <h2 className="text-text text-lg font-bold mb-2">Delete routine?</h2>
              <p className="text-muted text-sm mb-5">
                <span className="font-semibold text-text">{editProgrammeRoutinePendingDelete.name}</span> will be removed from this programme and deleted. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setEditProgrammeRoutinePendingDelete(null)}>
                  Cancel
                </ActionButton>
                <ActionButton
                  type="button"
                  variant="danger"
                  fullWidth={false}
                  className="flex-1 !rounded-xl"
                  onClick={() => {
                    const { progId, rtnId } = editProgrammeRoutinePendingDelete
                    setEditProgrammeRoutinePendingDelete(null)
                    removeRoutineFromProgramme(progId, rtnId)
                  }}
                >
                  <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                  Delete
                </ActionButton>
              </div>
          </BottomSheet>
        )}

        {/* Set as active after creating programme — only when there are at least 2 programmes */}
        {showSetActiveAfterCreate && programmes.length >= 2 && (() => {
          const prog = programmes.find(p => p.id === showSetActiveAfterCreate)
          if (!prog) return null
          return (
            <BottomSheet align="center" variant="card" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/60 backdrop-blur-sm" panelClassName="text-center">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 stroke-success"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 className="text-text text-lg font-bold mb-2">Set as active programme?</h2>
                <p className="text-muted text-sm mb-5">Use &quot;{prog.name}&quot; on the Start tab as your active programme?</p>
                <div className="flex gap-3">
                  <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => { setShowSetActiveAfterCreate(null) }}>
                    Not now
                  </ActionButton>
                  <ActionButton type="button" variant="success" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => { setProgrammeActive(showSetActiveAfterCreate); setShowSetActiveAfterCreate(null) }}>
                    Set as active
                  </ActionButton>
                </div>
            </BottomSheet>
          )
        })()}

        {/* Set as active after editing programme (when it wasn't already active) */}
        {showSetActiveAfterEditProgramme && (() => {
          const prog = programmes.find(p => p.id === showSetActiveAfterEditProgramme)
          if (!prog) return null
          return (
            <BottomSheet align="center" variant="card" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/60 backdrop-blur-sm" panelClassName="text-center">
                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 stroke-success"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h2 className="text-text text-lg font-bold mb-2">Set as active programme?</h2>
                <p className="text-muted text-sm mb-5">Use &quot;{prog.name}&quot; on the Start tab as your active programme?</p>
                <div className="flex gap-3">
                  <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setShowSetActiveAfterEditProgramme(null)}>
                    Not now
                  </ActionButton>
                  <ActionButton type="button" variant="success" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => { setProgrammeActive(showSetActiveAfterEditProgramme); setShowSetActiveAfterEditProgramme(null) }}>
                    Set as active
                  </ActionButton>
                </div>
            </BottomSheet>
          )
        })()}

        {/* Create Programme flow (Choice → Explainer → Coach or Manual) */}
        {createProgrammeFlowStep && user?.uid && (
          <Suspense
            fallback={
              <div className={`fixed inset-0 ${Z_OVERLAY} flex items-center justify-center bg-page/90 text-sm text-muted-strong`}>
                Loading…
              </div>
            }
          >
            <CreateProgrammeFlow
              step={createProgrammeFlowStep}
              onStepChange={setCreateProgrammeFlowStep}
              onManual={openManualCreateProgramme}
              onClose={() => {
                setCreateProgrammeFlowStep(null)
                if (isOnboardingRouteRef.current) setOnboardingProgrammeFlowLaunched(false)
              }}
              userId={user.uid}
              allExercises={allLibraryExercises}
              saveCoachGeneratedProgramme={saveCoachGeneratedProgramme}
              onCoachGenerationSuccess={handleCoachGenerationSuccess}
              onOpenPrivacyPolicy={() => setShowPrivacy(true)}
              inOnboarding={onboardingRequired && location.pathname === '/onboarding'}
              onSkipOnboarding={onboardingRequired && location.pathname === '/onboarding' ? handleOnboardingSkipAfterLegal : undefined}
            />
          </Suspense>
        )}

        {showPricing && user?.uid && (
          <PricingSheet
            open={showPricing}
            onClose={() => setShowPricing(false)}
            userId={user.uid}
            userPlan={userPlan}
            onPlanChange={setUserPlan}
          />
        )}

        {/* Create Programme modal (manual flow) */}
        {showCreateProgramme && (
          <BottomSheet onClose={requestCloseCreateProgramme} variant="card" layout="scrollable">
              <h2 className="text-text text-base font-bold mb-3">Create programme</h2>
              <label className={`block ${TYPE_LABEL_FORM} mt-3 mb-1.5`}>Name</label>
              <input type="text" value={createProgrammeName} onChange={e => setCreateProgrammeName(e.target.value)} placeholder="e.g. 2 Split - Push/Pull" onFocus={e => e.target.select()} autoFocus={!createProgrammeName.trim()} className="w-full py-3 px-3 bg-card-alt border border-border-strong rounded-[10px] text-text text-sm font-semibold placeholder-muted-deep outline-none focus:border-accent" />
              <label className={`block ${TYPE_LABEL_FORM} mt-3 mb-1.5`}>Routines</label>
              {createProgrammeRoutines.map((r, i) => (
                <div key={i} className="flex justify-between items-center py-3 px-3 rounded-[10px] border border-white/[0.07] bg-white/[0.02] mb-1.5">
                  <span className="text-white text-sm font-semibold">{r.name}</span>
                  <span className="text-white/35 text-xs">{r.exercises?.length ?? 0} exercises</span>
                  <button
                    type="button"
                    onClick={() => setCreateProgrammeRoutines(prev => prev.filter((_, j) => j !== i))}
                    className="text-[var(--semantic-negative-faint)] p-1"
                    aria-label={`Remove routine ${r.name} from draft`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => { setEditingRoutineProgrammeId(null); setEditingRoutineId(null); setEditRoutineName(''); setEditRoutineExercises([]); setShowCreateRoutine(true); setShowCreateProgramme(false) }} className="w-full py-3 border border-dashed border-border-strong rounded-xl text-accent text-sm font-semibold mb-4">+ Add Routine</button>
              {createProgrammeTriedSave && !createProgrammeName.trim() && (
                <p className="text-accent text-sm font-medium mb-2">Enter a programme name to save.</p>
              )}
              {createProgrammeTriedSave && createProgrammeName.trim() && createProgrammeRoutines.length === 0 && (
                <p className={`${TYPE_MICRO} text-amber-400/90 mb-2 leading-snug`}>
                  {createProgrammeConfirmEmptyRoutines
                    ? 'Tap Save programme again to confirm. You can add routines and exercises later under Plan.'
                    : 'This programme has no routines yet. Tap Save again for the next step — or add routines above.'}
                </p>
              )}
              <ActionButton
                type="button"
                variant="successOutline"
                onClick={() => {
                  if (!createProgrammeName.trim()) {
                    setCreateProgrammeTriedSave(true)
                    return
                  }
                  if (createProgrammeRoutines.length === 0 && !createProgrammeConfirmEmptyRoutines) {
                    setCreateProgrammeTriedSave(true)
                    setCreateProgrammeConfirmEmptyRoutines(true)
                    return
                  }
                  saveNewProgramme(createProgrammeName, 'rotation', null, createProgrammeRoutines)
                  setCreateProgrammeRoutines([])
                  setCreateProgrammeTriedSave(false)
                  setCreateProgrammeConfirmEmptyRoutines(false)
                }}
              >
                Save Programme
              </ActionButton>
              <ActionButton type="button" variant="secondary" className="mt-2" onClick={requestCloseCreateProgramme}>
                Cancel
              </ActionButton>
          </BottomSheet>
        )}

        {showDiscardCreateProgrammeConfirm && showCreateProgramme && (
          <BottomSheet
            align="center"
            variant="card"
            maxWidthClass="max-w-sm"
            showHandle={false}
            closeOnBackdrop
            onClose={() => setShowDiscardCreateProgrammeConfirm(false)}
            zClass={Z_OVERLAY_STACKED}
            backdropClassName="bg-black/60 backdrop-blur-sm"
            layout="flex"
            role="alertdialog"
            ariaModal={true}
            ariaLabelledBy="discard-create-programme-title"
          >
            <h2 id="discard-create-programme-title" className={`${TYPE_TITLE_MODAL} text-center mb-1`}>
              Discard this draft?
            </h2>
            <p className={`${TYPE_BODY} text-muted text-center mb-5`}>
              You will lose the programme name and any routines you added.
            </p>
            <div className="flex gap-3">
              <ActionButton
                type="button"
                variant="secondary"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={() => setShowDiscardCreateProgrammeConfirm(false)}
              >
                Keep editing
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={confirmDiscardCreateProgrammeDraft}
              >
                Discard
              </ActionButton>
            </div>
          </BottomSheet>
        )}

        {/* Edit Programme modal */}
        {editingProgrammeId && (() => {
          const prog = programmes.find(p => p.id === editingProgrammeId)
          const progRoutines = (prog?.routineIds || []).map(id => routines.find(r => r.id === id)).filter(Boolean)
          return (
            <BottomSheet onClose={requestCloseEditProgramme} variant="card" layout="scrollable">
                <h2 className="text-text text-base font-bold mb-3">Edit Programme</h2>
                <label className={`block ${TYPE_LABEL_FORM} mt-3 mb-1.5`}>Name</label>
                <input type="text" value={editProgrammeName} onChange={e => setEditProgrammeName(e.target.value)} onFocus={e => e.target.select()} className="w-full py-3 px-3 bg-card-alt border border-border-strong rounded-[10px] text-text text-sm font-semibold outline-none focus:border-accent" />
                <label className={`block ${TYPE_LABEL_FORM} mt-3 mb-1.5`}>Routines — drag to reorder or move to another programme</label>
                {progRoutines.map((r, i) => {
                  const isDragging = dragRoutine?.rtnId === r.id
                  const isDropTarget = dragOverTarget?.type === 'index' && dragOverTarget.progId === editingProgrammeId && dragOverTarget.index === i
                  return (
                    <div
                      key={r.id}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragRoutine && dragRoutine.rtnId !== r.id) setDragOverTarget({ type: 'index', progId: editingProgrammeId, index: i }) }}
                      onDragLeave={() => setDragOverTarget(prev => (prev?.type === 'index' && prev.progId === editingProgrammeId && prev.index === i ? null : prev))}
                      onDrop={(e) => {
                        e.preventDefault()
                        try {
                          const data = JSON.parse(e.dataTransfer.getData('application/json'))
                          if (data.progId === editingProgrammeId) moveRoutineToIndex(editingProgrammeId, data.rtnId, i)
                          setDragRoutine(null); setDragOverTarget(null)
                        } catch (_) {}
                      }}
                      className={`flex justify-between items-center py-3 px-3 rounded-[10px] border mb-1.5 transition-colors ${isDragging ? 'opacity-50 bg-white/[0.02] border-white/[0.07]' : isDropTarget ? 'bg-[var(--plan-surface-08)] border-[var(--plan-border-35)]' : 'bg-white/[0.02] border-white/[0.07]'}`}
                    >
                      <span
                        draggable
                        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/json', JSON.stringify({ rtnId: r.id, progId: editingProgrammeId })); setDragRoutine({ rtnId: r.id, progId: editingProgrammeId }) }}
                        onDragEnd={() => { setDragRoutine(null); setDragOverTarget(null) }}
                        className="text-white/35 mr-2 cursor-grab active:cursor-grabbing touch-none"
                      >⋮⋮</span>
                      <span className="text-white text-sm font-semibold flex-1 min-w-0 truncate">{r.name}</span>
                      <span className="text-white/30 text-xs shrink-0">{r.exercises?.length ?? 0} ex</span>
                      <div className="flex items-center gap-0.5 shrink-0 ml-2">
                        <button type="button" onClick={() => reorderRoutineInProgramme(editingProgrammeId, r.id, 'up')} className={`p-1 rounded-md text-plan-text ${i === 0 ? 'opacity-20' : 'hover:bg-white/5 hover:text-plan-hover'}`} disabled={i === 0} aria-label="Move routine up">
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><polyline points="18 15 12 9 6 15" /></svg>
                        </button>
                        <button type="button" onClick={() => reorderRoutineInProgramme(editingProgrammeId, r.id, 'down')} className={`p-1 rounded-md text-plan-text ${i === progRoutines.length - 1 ? 'opacity-20' : 'hover:bg-white/5 hover:text-plan-hover'}`} disabled={i === progRoutines.length - 1} aria-label="Move routine down">
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><polyline points="6 9 12 15 18 9" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            routineEditorOpenedFromPlanRef.current = false
                            setEditProgrammeName(prog?.name ?? '')
                            setEditRoutineName(r.name)
                            setEditRoutineExercises((r.exercises || []).map(ex => ({ ...ex, id: ex.id ?? crypto.randomUUID(), supersetGroupId: ex.supersetGroupId ?? null, supersetRole: ex.supersetRole ?? null })))
                            setEditingRoutineId(r.id)
                            setEditingRoutineProgrammeId(editingProgrammeId)
                            setEditingProgrammeId(null)
                          }}
                          className="p-2 rounded-lg text-plan-text hover:text-plan-hover hover:bg-white/5 active:opacity-80"
                          title="Edit routine"
                          aria-label={`Edit routine ${r.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current">
                            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => copyRoutine(r.id, editingProgrammeId)}
                          className="p-2 rounded-lg text-plan-text hover:text-plan-hover hover:bg-white/5 active:opacity-80"
                          title="Copy routine"
                          aria-label={`Copy routine ${r.name}`}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditProgrammeRoutinePendingDelete({ progId: editingProgrammeId, rtnId: r.id, name: r.name })}
                          className="p-2 rounded-lg text-[var(--semantic-negative-soft)] hover:text-red-400 hover:bg-white/5 active:opacity-80"
                          title="Delete routine"
                          aria-label={`Delete routine ${r.name}`}
                        >
                          <DeleteTrashGlyph className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
                {dragRoutine && programmes.filter(p => p.id !== dragRoutine.progId).length > 0 && (
                  <div className="mt-2 mb-2 p-2 rounded-lg bg-card-alt border border-border-strong">
                    <div className={`${TYPE_LABEL_FORM} mb-2`}>Move to programme</div>
                    <div className="flex flex-wrap gap-1.5">
                      {programmes.filter(p => p.id !== dragRoutine.progId).map((p) => {
                        const isTarget = dragOverTarget?.type === 'programme' && dragOverTarget.progId === p.id
                        return (
                          <div
                            key={p.id}
                            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTarget({ type: 'programme', progId: p.id }) }}
                            onDragLeave={() => setDragOverTarget(prev => (prev?.type === 'programme' && prev.progId === p.id ? null : prev))}
                            onDrop={(e) => {
                              e.preventDefault()
                              try {
                                const data = JSON.parse(e.dataTransfer.getData('application/json'))
                                moveRoutineToProgramme(data.rtnId, data.progId, p.id)
                                setDragRoutine(null); setDragOverTarget(null)
                              } catch (_) {}
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${isTarget ? 'bg-accent/20 text-accent border border-accent/40' : 'bg-page text-muted border border-border-strong hover:border-accent/40'}`}
                          >
                            {p.name}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => { routineEditorOpenedFromPlanRef.current = false; setEditRoutineName(''); setEditRoutineExercises([]); setEditingRoutineId(null); setEditingRoutineProgrammeId(editingProgrammeId); setEditProgrammeName(programmes.find(p => p.id === editingProgrammeId)?.name || ''); setShowCreateRoutine(true); setEditingProgrammeId(null) }} className="w-full py-3 border border-dashed border-border-strong rounded-xl text-accent text-sm font-semibold mb-4">+ Add Routine</button>
                <ActionButton
                  type="button"
                  variant="successOutline"
                  onClick={() => {
                    const progId = editingProgrammeId
                    const programme = programmes.find(p => p.id === progId)
                    saveEditedProgramme(progId, editProgrammeName, 'rotation', prog?.routineIds || [])
                    setEditingProgrammeId(null); setDragRoutine(null); setDragOverTarget(null)
                    if (programme && !programme.isActive) setShowSetActiveAfterEditProgramme(progId)
                  }}
                >
                  Save Changes
                </ActionButton>
                <ActionButton type="button" variant="secondary" className="mt-2" onClick={requestCloseEditProgramme}>
                  Cancel
                </ActionButton>
            </BottomSheet>
          )
        })()}

        {showDiscardEditProgrammeConfirm && editingProgrammeId && (
          <BottomSheet
            align="center"
            variant="card"
            maxWidthClass="max-w-sm"
            showHandle={false}
            closeOnBackdrop
            onClose={() => setShowDiscardEditProgrammeConfirm(false)}
            zClass={Z_OVERLAY_STACKED}
            backdropClassName="bg-black/60 backdrop-blur-sm"
            layout="flex"
            role="alertdialog"
            ariaModal={true}
            ariaLabelledBy="discard-edit-programme-title"
          >
            <h2 id="discard-edit-programme-title" className={`${TYPE_TITLE_MODAL} text-center mb-1`}>
              Discard changes?
            </h2>
            <p className={`${TYPE_BODY} text-muted text-center mb-5`}>
              Unsaved edits to this programme will be lost.
            </p>
            <div className="flex gap-3">
              <ActionButton
                type="button"
                variant="secondary"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={() => setShowDiscardEditProgrammeConfirm(false)}
              >
                Keep editing
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={confirmDiscardEditProgramme}
              >
                Discard
              </ActionButton>
            </div>
          </BottomSheet>
        )}

        {/* Create / Edit Routine - full bottom sheet, same UI as workout (no timer) */}
        {(showCreateRoutine || editingRoutineId) && (() => {
          const isEdit = !!editingRoutineId
          const name = isEdit ? editRoutineName : (showCreateRoutine ? editRoutineName : '')
          const exs = isEdit ? editRoutineExercises : (showCreateRoutine ? editRoutineExercises : [])
          const programmeId = editingRoutineProgrammeId
          const routineBlockCount = getRoutineEditorOrderBlocks(editRoutineExercises).length
          const reorderRoutineBlock = (blockIndex, direction) => {
            setEditRoutineExercises((prev) => swapRoutineEditorBlocks(prev, blockIndex, direction))
            setRoutineEditorSupersetMenuForId(null)
            setRoutineEditorRestForIndex(null)
            setRoutineEditorNoteForIndex(null)
            setRoutineEditorRemoveNoteConfirmForExerciseId(null)
          }
          const RoutineReorderButtons = ({ blockIndex }) => {
            const reorderLocked = routineLinkMode.active
            return (
              <div className="flex flex-col gap-0.5 shrink-0 self-start pt-1">
                <button
                  type="button"
                  disabled={reorderLocked || blockIndex <= 0}
                  onClick={() => reorderRoutineBlock(blockIndex, -1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-strong bg-card-alt text-muted-strong hover:text-text hover:border-accent/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                  aria-label="Move block up"
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 stroke-current">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  disabled={reorderLocked || blockIndex >= routineBlockCount - 1}
                  onClick={() => reorderRoutineBlock(blockIndex, 1)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-strong bg-card-alt text-muted-strong hover:text-text hover:border-accent/40 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                  aria-label="Move block down"
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 stroke-current">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
            )
          }
          const closeRoutineEditor = () => {
            const progId = editingRoutineProgrammeId
            const returnToPlanOnly = routineEditorOpenedFromPlanRef.current
            routineEditorOpenedFromPlanRef.current = false
            routineEditorBaselineRef.current = null
            routineEditorBaselineSessionRef.current = null
            setShowCreateRoutine(false)
            setEditingRoutineId(null)
            setEditingRoutineProgrammeId(null)
            setRoutineEditorRestForIndex(null)
            setRoutineEditorNoteForIndex(null)
            setRoutineEditorRemoveNoteConfirmForExerciseId(null)
            setRoutineEditorTriedSave(false)
            setRoutineEditorConfirmEmptyExercises(false)
            setFocusNewExerciseAt(null)
            setRoutineReplaceExerciseId(null)
            if (progId && !returnToPlanOnly) {
              setEditingProgrammeId(progId)
              setEditProgrammeName(programmes.find(p => p.id === progId)?.name || '')
            }
            if (returnToPlanOnly) {
              setWorkoutTab('plan')
            }
          }
          routineEditorCloseRef.current = closeRoutineEditor
          const requestCloseRoutineEditor = () => {
            if (routineLinkMode.active) {
              routineCancelLinkMode()
              return
            }
            const b = routineEditorBaselineRef.current
            const curJson = serializeRoutineExercisesForCompare(editRoutineExercises)
            const nameMismatch = (editRoutineName ?? '').trim() !== (b?.name ?? '').trim()
            const progNameMismatch = Boolean(programmeId) && (editProgrammeName ?? '').trim() !== (b?.programmeName ?? '').trim()
            const exMismatch = Boolean(b && curJson !== b.exercisesJson)
            const dirty = Boolean(b && (nameMismatch || progNameMismatch || exMismatch))
            if (dirty) {
              setShowDiscardRoutineEditorConfirm(true)
              return
            }
            closeRoutineEditor()
          }
          return (
            <>
            <BottomSheet onClose={requestCloseRoutineEditor} variant="page" layout="flex">
                <h2 className="text-text text-base font-bold mb-3 shrink-0">{isEdit ? 'Edit Routine' : 'Create Routine'}</h2>
                {programmeId && (
                  <>
                    <label className={`block ${TYPE_LABEL_FORM} mb-1.5`}>Program</label>
                    <input type="text" value={editProgrammeName} onChange={e => setEditProgrammeName(e.target.value)} placeholder="Program name" onFocus={e => e.target.select()} autoFocus={!isEdit && !editProgrammeName.trim()} className="w-full py-3 px-3 bg-card-alt border border-border-strong rounded-[10px] text-text text-sm font-semibold placeholder-muted-deep outline-none focus:border-accent mb-3 shrink-0" />
                  </>
                )}
                <label className={`block ${TYPE_LABEL_FORM} mb-1.5`}>Name</label>
                <input type="text" value={name} onChange={e => setEditRoutineName(e.target.value)} placeholder="e.g. Day 1 - Pull" onFocus={e => e.target.select()} autoFocus={!isEdit && !editRoutineName.trim() && (!programmeId || editProgrammeName.trim())} className="w-full py-3 px-3 bg-card-alt border border-border-strong rounded-[10px] text-text text-sm font-semibold placeholder-muted-deep outline-none focus:border-accent mb-4 shrink-0" />
                <label className={`block ${TYPE_LABEL_FORM} mb-2`}>Exercises</label>
                <div className="overflow-y-auto flex-1 min-h-0 -mx-4 px-4 space-y-2">
                  {routineLinkMode.active && (
                    <div className="sticky top-0 z-10 -mx-4 px-4 pt-0 pb-2 bg-page">
                      <LinkModeBanner sourceName={editRoutineExercises.find(e => e.id === routineLinkMode.sourceId)?.exerciseId ?? ''} onCancel={routineCancelLinkMode} />
                    </div>
                  )}
                  {getRoutineGrouped().map((group, groupIndex) => {
                    const renderRoutineRow = (ex, supersetRole, isLinkSource, isLinkTarget, onTapAsTarget, onStartLinkMode, onBreakSuperset) => {
                      const i = editRoutineExercises.indexOf(ex)
                      const setConfigs = getSetConfigs(ex)
                      const lib = getExerciseFromLibrary(ex.exerciseId)
                      const exType = lib?.type || 'weight_reps'
                      const routineRepsOnly = exType === 'reps_only'
                      const restOverride = ex.restOverride !== undefined && ex.restOverride !== null ? ex.restOverride : null
                      const currentRestSec = restOverride !== null ? restOverride : defaultRest
                      const note = ex.note ?? ''
                      const updateSetConfigs = (newConfigs) => {
                        setEditRoutineExercises((prev) =>
                          prev.map((e, j) => (j !== i ? e : { ...e, setConfigs: Array.isArray(newConfigs) ? newConfigs : [] }))
                        )
                      }
                      const updateSetAt = (setIdx, field, value) => {
                        let stored = value
                        if (field === 'targetKg') {
                          if (value === '' || value == null) stored = ''
                          else { const n = parseDecimal(value); stored = Number.isNaN(n) ? value : n }
                        }
                        setEditRoutineExercises(prev => prev.map((e, j) => j !== i ? e : { ...e, setConfigs: setConfigs.map((s, si) => si === setIdx ? { ...s, [field]: stored } : s) }))
                      }
                      const addSet = () => {
                        const last = setConfigs[setConfigs.length - 1]
                        updateSetConfigs([...setConfigs, {
                          targetReps: last?.targetReps ?? '8-10',
                          targetKg: routineRepsOnly ? '' : (last?.targetKg ?? ''),
                        }])
                      }
                      const removeSetAt = (setIdx) => updateSetConfigs(setConfigs.filter((_, si) => si !== setIdx))
                      const setRest = (val) => { setEditRoutineExercises(prev => prev.map((e, j) => j !== i ? e : { ...e, restOverride: val })); setRoutineEditorRestForIndex(null) }
                      const updateNote = (val) => setEditRoutineExercises(prev => prev.map((e, j) => j !== i ? e : { ...e, note: val }))
                      const removeEx = () => { if (ex.supersetGroupId) routineBreakSuperset(ex.supersetGroupId); setEditRoutineExercises(prev => prev.filter(e => e.id !== ex.id)); setRoutineEditorSupersetMenuForId(null) }
                      const rowBorderClass = isLinkSource ? 'border-accent/50 bg-card-alt' : isLinkTarget ? 'border-success/40 cursor-pointer' : 'border-border'
                      const rowClass = `${CARD_SURFACE_LG} p-3.5 transition-all duration-200 ${rowBorderClass} ${routineLinkMode.active && !isLinkSource && !isLinkTarget ? 'opacity-40 pointer-events-none' : ''} ${isLinkTarget ? 'animate-pulse-border' : ''}`
                      return (
                        <div key={ex.id} className={rowClass} onClick={isLinkTarget ? onTapAsTarget : undefined}>
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <div className="min-w-0">
                                <span className="text-lg font-bold tracking-tight text-text block truncate">{ex.exerciseId}</span>
                                {lib && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5 text-muted">{lib.equipment}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {supersetRole && <span className="text-xs font-extrabold mr-0.5" style={{ color: supersetRole === 'A' ? 'var(--accent-primary)' : 'var(--success)' }}>{supersetRole}</span>}
                              <div className="relative">
                                <button type="button" onClick={(e) => { e.stopPropagation(); setRoutineEditorSupersetMenuForId(routineEditorSupersetMenuForId === ex.id ? null : ex.id) }} className="p-2 rounded-lg hover:bg-card-alt border border-transparent hover:border-border-strong transition-colors" aria-label="Exercise options">
                                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-5 h-5 stroke-muted-strong"><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                                </button>
                                {routineEditorSupersetMenuForId === ex.id && (
                                  <div className="mt-2 absolute right-0 top-full bg-card-alt border border-border-strong rounded-xl overflow-hidden shadow-xl z-10 min-w-[200px]">
                                    {exs.length > 1 && (ex.supersetGroupId ? (
                                      <button type="button" onClick={() => { onBreakSuperset?.(); setRoutineEditorSupersetMenuForId(null) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                                        Break superset
                                      </button>
                                    ) : (
                                      <button type="button" onClick={() => { onStartLinkMode?.(); setRoutineEditorSupersetMenuForId(null) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                                        Create superset
                                      </button>
                                    ))}
                                    {exs.length > 1 && <div className="border-t border-border-strong" />}
                                    <button type="button" onClick={() => { setRoutineEditorRestForIndex(i); setRoutineEditorSupersetMenuForId(null) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors">
                                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                      Rest timer {restOverride !== null && restOverride !== undefined ? `· ${restOverride === 0 ? 'None' : formatTime(restOverride)}` : `· Default (${formatTime(defaultRest)})`}
                                    </button>
                                    <button type="button" onClick={() => { setRoutineEditorNoteForIndex(i); setRoutineEditorSupersetMenuForId(null) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong">
                                      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                      {note ? 'Edit note' : 'Add note'}
                                    </button>
                                    {!routineLinkMode.active && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRoutineReplaceExerciseId(ex.id)
                                          setRoutineEditorSupersetMenuForId(null)
                                          setShowExercisePickerForRoutine(true)
                                        }}
                                        className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-text hover:bg-white/5 transition-colors border-t border-border-strong"
                                      >
                                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-current">
                                          <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                                        </svg>
                                        Replace exercise
                                      </button>
                                    )}
                                    <button type="button" onClick={() => { removeEx(); setRoutineEditorSupersetMenuForId(null) }} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors border-t border-border-strong">
                                      <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                                      Remove exercise
                                    </button>
                                    <button type="button" onClick={() => setRoutineEditorSupersetMenuForId(null)} className="flex items-center gap-2.5 w-full px-4 py-3 text-left text-sm font-semibold text-muted-mid hover:bg-white/5 transition-colors border-t border-border-strong">
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-mid">
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-3.5 h-3.5 stroke-current"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            {currentRestSec === 0 ? 'None' : formatTime(currentRestSec)}
                          </div>
                        {routineEditorNoteForIndex === i && (
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start mb-2">
                            <textarea placeholder="Add a note..." value={note} onChange={(e) => updateNote(e.target.value)} rows={4} autoFocus className="flex-1 min-w-0 min-h-[5.5rem] max-h-[40vh] resize-y bg-card-alt border border-border-strong rounded-lg px-3 py-2 text-sm text-text placeholder-muted-deep outline-none focus:border-accent" />
                            <button type="button" onClick={() => setRoutineEditorNoteForIndex(null)} className="px-3 py-2 bg-accent text-on-accent rounded-lg text-sm font-bold shrink-0 self-end sm:self-stretch sm:min-w-[4.5rem]">Done</button>
                          </div>
                        )}
                        {note && routineEditorNoteForIndex !== i && (
                          <div className="flex items-start gap-2 mb-2 px-3 py-2 bg-card-alt rounded-lg border border-border-strong">
                            <span className="text-sm text-muted italic flex-1 min-w-0 break-words whitespace-pre-wrap">{note}</span>
                            <button
                              type="button"
                              onClick={() => setRoutineEditorRemoveNoteConfirmForExerciseId(ex.id)}
                              className="text-muted-mid hover:text-red-400 transition-colors shrink-0"
                              aria-label="Remove note"
                            >
                              <DeleteTrashGlyph className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        {routineEditorRestForIndex === i && (
                          <div className="mt-2 mb-2 p-3 bg-card-alt rounded-xl border border-border-strong">
                            <div className={`${TYPE_LABEL_FORM} mb-2`}>Rest timer for this exercise</div>
                            <div className="flex gap-1.5 flex-wrap">
                              <button type="button" onClick={() => setRest(null)} className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${restOverride === null ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card text-muted'}`}>Default</button>
                              {REST_PRESETS.map(s => <button key={s} type="button" onClick={() => setRest(s)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${restOverride === s ? 'bg-success text-[#0D0D1A]' : 'bg-card border border-border-strong text-muted'}`}>{s === 0 ? 'None' : formatTime(s)}</button>)}
                            </div>
                          </div>
                        )}
                        {routineRepsOnly ? (
                          <>
                            <div className="gap-1.5 mt-2 mb-1 grid items-center" style={{ gridTemplateColumns: '28px 1fr 30px' }}>
                              <span className="text-xs font-bold text-muted-strong uppercase text-center">Set</span>
                              <span className="text-xs font-bold text-muted-strong uppercase text-center">Reps</span>
                              <span />
                            </div>
                            {setConfigs.map((setCfg, setIdx) => (
                              <div key={setIdx} className="gap-1.5 grid items-center mb-1" style={{ gridTemplateColumns: '28px 1fr 30px' }}>
                                <span className="text-sm font-bold text-muted text-center">{setIdx + 1}</span>
                                <input ref={i === focusNewExerciseAt && setIdx === 0 ? routineEditorFirstInputRef : undefined} type="number" inputMode="numeric" value={setCfg.targetReps ?? ''} onChange={e => updateSetAt(setIdx, 'targetReps', e.target.value)} placeholder="reps" onFocus={e => e.target.select()} className="w-full min-w-0 h-8 rounded-lg bg-card-alt border border-border-strong px-1.5 py-1.5 text-center text-text text-sm font-bold outline-none focus:border-accent" />
                                {setConfigs.length > 0 ? (
                                  <button type="button" onClick={() => removeSetAt(setIdx)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-strong hover:text-red-400 hover:bg-red-500/10 shrink-0" aria-label="Delete set">
                                    ✕
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </>
                        ) : (
                          <>
                            <div className="gap-1.5 mt-2 mb-1 grid items-center" style={{ gridTemplateColumns: '28px 1fr 1fr 30px' }}>
                              <span className="text-xs font-bold text-muted-strong uppercase text-center">Set</span>
                              <span className="text-xs font-bold text-muted-strong uppercase text-center">{unitWeight}</span>
                              <span className="text-xs font-bold text-muted-strong uppercase text-center">Reps</span>
                              <span />
                            </div>
                            {setConfigs.map((setCfg, setIdx) => (
                              <div key={setIdx} className="gap-1.5 grid items-center mb-1" style={{ gridTemplateColumns: '28px 1fr 1fr 30px' }}>
                                <span className="text-sm font-bold text-muted text-center">{setIdx + 1}</span>
                                <input ref={i === focusNewExerciseAt && setIdx === 0 ? routineEditorFirstInputRef : undefined} type="text" inputMode="decimal" value={setCfg.targetKg !== '' && setCfg.targetKg != null ? formatDecimal(setCfg.targetKg) : ''} onChange={e => updateSetAt(setIdx, 'targetKg', e.target.value)} placeholder={unitWeight} onFocus={e => e.target.select()} className="w-full min-w-0 h-8 rounded-lg bg-card-alt border border-border-strong px-1.5 py-1.5 text-center text-text text-sm font-bold outline-none focus:border-accent" />
                                <input type="number" inputMode="numeric" value={setCfg.targetReps ?? ''} onChange={e => updateSetAt(setIdx, 'targetReps', e.target.value)} placeholder="reps" onFocus={e => e.target.select()} className="w-full min-w-0 h-8 rounded-lg bg-card-alt border border-border-strong px-1.5 py-1.5 text-center text-text text-sm font-bold outline-none focus:border-accent" />
                                {setConfigs.length > 0 ? (
                                  <button type="button" onClick={() => removeSetAt(setIdx)} className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-strong hover:text-red-400 hover:bg-red-500/10 shrink-0" aria-label="Delete set">
                                    ✕
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </>
                        )}
                        <button type="button" onClick={addSet} className="w-full py-2 mt-2 border border-dashed border-border-strong rounded-lg text-muted-mid text-sm font-semibold hover:border-accent hover:text-accent">+ Add set</button>
                      </div>
                    )
                    }
                    if (group.type === 'superset') {
                      return (
                        <div key={group.groupId} className="flex gap-1.5 items-start min-w-0">
                          <RoutineReorderButtons blockIndex={groupIndex} />
                          <div className="flex-1 min-w-0">
                            <SupersetWrapper
                              groupId={group.groupId}
                              exerciseA={group.a}
                              exerciseB={group.b}
                              onBreak={() => routineBreakSuperset(group.groupId)}
                              renderCard={(exercise, role) => renderRoutineRow(exercise, role, false, false, undefined, () => routineStartLinkMode(exercise.id), () => routineBreakSuperset(exercise.supersetGroupId))}
                            />
                          </div>
                        </div>
                      )
                    }
                    const ex = group.exercise
                    const isSource = routineLinkMode.sourceId === ex.id
                    const isTarget = routineLinkMode.active && !isSource && !ex.supersetGroupId
                    return (
                      <div key={ex.id} className="flex gap-1.5 items-start min-w-0">
                        <RoutineReorderButtons blockIndex={groupIndex} />
                        <div className="flex-1 min-w-0">
                          {renderRoutineRow(ex, null, isSource, isTarget, isTarget ? () => routineConfirmSuperset(ex.id, (groupId) => { setTimeout(() => document.getElementById('superset-' + groupId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150) }) : undefined, () => routineStartLinkMode(ex.id), () => routineBreakSuperset(ex.supersetGroupId))}
                        </div>
                      </div>
                    )
                  })}
                  <button type="button" onClick={() => { setRoutineReplaceExerciseId(null); setShowExercisePickerForRoutine(true) }} className="w-full py-3 border border-dashed border-success/30 rounded-xl text-success text-sm font-semibold hover:bg-success/8 hover:border-success mb-2">+ Add exercise</button>
                </div>
                <div className="shrink-0 pt-3 space-y-2">
                  {routineEditorTriedSave && !editRoutineName.trim() && (
                    <p className="text-accent text-sm font-medium">Enter a routine name to save.</p>
                  )}
                  {routineEditorTriedSave && editRoutineName.trim() && exs.length === 0 && (
                    <p className={`${TYPE_MICRO} text-amber-400/90 leading-snug`}>
                      {routineEditorConfirmEmptyExercises
                        ? 'Tap Save again to confirm. You can add exercises later under Plan.'
                        : 'This routine has no exercises yet. Tap Save again for the next step — or add exercises above.'}
                    </p>
                  )}
                  <ActionButton
                    type="button"
                    variant="successOutline"
                    onClick={() => {
                      if (!editRoutineName.trim()) {
                        setRoutineEditorTriedSave(true)
                        return
                      }
                      if (exs.length === 0 && !routineEditorConfirmEmptyExercises) {
                        setRoutineEditorTriedSave(true)
                        setRoutineEditorConfirmEmptyExercises(true)
                        return
                      }
                      if (isEdit) { saveRoutineEdits(editingRoutineId, editRoutineName, editRoutineExercises); closeRoutineEditor() }
                      else if (programmeId) { addRoutineToProgramme(programmeId, { name: editRoutineName, exercises: editRoutineExercises }); setProgrammes(prev => prev.map(p => p.id === programmeId ? { ...p, name: (editProgrammeName.trim() || p.name) } : p)); setShowCreateRoutine(false); setEditRoutineName(''); setEditRoutineExercises([]); setEditingRoutineProgrammeId(null); setEditingProgrammeId(programmeId); setEditProgrammeName(programmes.find(p => p.id === programmeId)?.name || ''); setRoutineEditorRestForIndex(null); setRoutineEditorNoteForIndex(null); setRoutineEditorRemoveNoteConfirmForExerciseId(null) }
                      else { setCreateProgrammeRoutines(prev => [...prev, { name: editRoutineName, exercises: editRoutineExercises }]); setShowCreateRoutine(false); setShowCreateProgramme(true); setEditRoutineName(''); setEditRoutineExercises([]); setRoutineEditorRestForIndex(null); setRoutineEditorNoteForIndex(null); setRoutineEditorRemoveNoteConfirmForExerciseId(null) }
                      setRoutineEditorTriedSave(false)
                      setRoutineEditorConfirmEmptyExercises(false)
                    }}
                  >
                    Save
                  </ActionButton>
                <ActionButton type="button" variant="secondary" onClick={requestCloseRoutineEditor}>
                  Cancel
                </ActionButton>
                </div>
            </BottomSheet>
            {routineEditorRemoveNoteConfirmForExerciseId && (
              <BottomSheet
                align="center"
                variant="card"
                zClass="z-[50]"
                maxWidthClass="max-w-sm"
                showHandle={false}
                onClose={() => setRoutineEditorRemoveNoteConfirmForExerciseId(null)}
                backdropClassName="bg-black/70 backdrop-blur-sm"
                ariaModal={true}
                ariaLabelledBy="routine-remove-note-title"
                panelClassName="text-center"
              >
                  <DeleteTrashBadge />
                  <h2 id="routine-remove-note-title" className="text-text text-lg font-bold mb-2">
                    Remove note?
                  </h2>
                  <p className="text-muted text-sm mb-5">This exercise note will be permanently cleared.</p>
                  <div className="flex gap-3">
                    <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setRoutineEditorRemoveNoteConfirmForExerciseId(null)}>
                      Cancel
                    </ActionButton>
                    <ActionButton
                      type="button"
                      variant="danger"
                      fullWidth={false}
                      className="flex-1 !rounded-xl"
                      onClick={() => {
                        const id = routineEditorRemoveNoteConfirmForExerciseId
                        setRoutineEditorRemoveNoteConfirmForExerciseId(null)
                        if (id) setEditRoutineExercises((prev) => prev.map((e) => (e.id === id ? { ...e, note: '' } : e)))
                      }}
                    >
                      <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                      Delete
                    </ActionButton>
                  </div>
              </BottomSheet>
            )}
          </>
          )
        })()}

        {showDiscardRoutineEditorConfirm && (
          <BottomSheet
            align="center"
            variant="card"
            maxWidthClass="max-w-sm"
            showHandle={false}
            closeOnBackdrop
            onClose={() => setShowDiscardRoutineEditorConfirm(false)}
            zClass={Z_OVERLAY_STACKED}
            backdropClassName="bg-black/60 backdrop-blur-sm"
            layout="flex"
            role="alertdialog"
            ariaModal={true}
            ariaLabelledBy="discard-routine-editor-title"
          >
            <h2 id="discard-routine-editor-title" className={`${TYPE_TITLE_MODAL} text-center mb-1`}>
              Discard changes?
            </h2>
            <p className={`${TYPE_BODY} text-muted text-center mb-5`}>
              Your changes to this routine will be lost.
            </p>
            <div className="flex gap-3">
              <ActionButton
                type="button"
                variant="secondary"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={() => setShowDiscardRoutineEditorConfirm(false)}
              >
                Keep editing
              </ActionButton>
              <ActionButton
                type="button"
                variant="danger"
                fullWidth={false}
                className="flex-1 !rounded-xl"
                onClick={confirmDiscardRoutineEditor}
              >
                Discard
              </ActionButton>
            </div>
          </BottomSheet>
        )}

        {/* Exercise Picker for Routine - reuse ExerciseLibrary in modal, onAdd adds to editing routine or create draft */}
        {showExercisePickerForRoutine && (
          <div className={`fixed inset-0 ${Z_OVERLAY}`}>
            <ExerciseLibrary
              allExercises={allLibraryExercises}
              mode="modal"
              replaceMode={!!routineReplaceExerciseId}
              onAdd={(exList) => {
                if (routineReplaceExerciseId) {
                  if (!exList?.length) return
                  const first = exList[0]
                  const rid = routineReplaceExerciseId
                  setRoutineReplaceExerciseId(null)
                  setShowExercisePickerForRoutine(false)
                  setEditRoutineExercises((prev) =>
                    prev.map((e) =>
                      e.id === rid
                        ? {
                            ...e,
                            exerciseId: first.name,
                            setConfigs: Array.from({ length: Math.max(1, (e.setConfigs || []).length) }, () => ({
                              targetKg: '',
                              targetReps: '',
                            })),
                          }
                        : e
                    )
                  )
                  return
                }
                const newExs = exList.map(e => ({ id: crypto.randomUUID(), exerciseId: e.name, setConfigs: [{ targetReps: '', targetKg: '' }], restOverride: null, rirOverride: null, note: '', supersetGroupId: null, supersetRole: null }))
                const startIndex = editRoutineExercises.length
                setEditRoutineExercises(prev => [...(prev || []), ...newExs])
                setFocusNewExerciseAt(startIndex)
                setShowExercisePickerForRoutine(false)
              }}
              onClose={() => {
                setShowExercisePickerForRoutine(false)
                setRoutineReplaceExerciseId(null)
              }}
              onCreateCustom={() => { setEditingCustomExercise(null); setShowCreateExercise(true) }}
            />
          </div>
        )}

        {/* ADD EXERCISE MODAL */}
        {showAddExercise && (
          <ExerciseLibrary
            allExercises={allLibraryExercises}
            mode="modal"
            replaceMode={exerciseLibraryReplaceIndex != null}
            onAdd={addExercisesFromLibrary}
            onClose={() => {
              setShowAddExercise(false)
              setExerciseLibraryReplaceIndex(null)
            }}
            onCreateCustom={() => { setEditingCustomExercise(null); setShowCreateExercise(true) }}
          />
        )}

        {/* CREATE / EDIT CUSTOM EXERCISE */}
        {showCreateExercise && (
          <CreateExerciseModal
            editExercise={editingCustomExercise}
            onSave={saveCustomExercise}
            onCancel={() => { setShowCreateExercise(false); setEditingCustomExercise(null) }}
            onDelete={editingCustomExercise ? deleteCustomExercise : null}
          />
        )}

        {showEmptyNameModal && (
          <BottomSheet variant="card" zClass="z-50" layout="scrollable" padding="none" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="px-6 pt-6 pb-10">
              <h2 className="text-lg font-bold text-center mb-5">Name your workout</h2>
              <input type="text" placeholder="e.g. Push Day, Upper Body..." value={emptyWorkoutName} onChange={(e) => setEmptyWorkoutName(e.target.value)} onFocus={e => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && confirmEmptyStart()} autoFocus className="w-full bg-card-alt border border-border-strong rounded-xl px-4 py-3 text-text placeholder-muted-deep outline-none focus:border-accent transition-colors mb-4" />
              <ActionButton className="mb-3" onClick={confirmEmptyStart} disabled={!emptyWorkoutName} variant="primary">
                Start workout
              </ActionButton>
              <ActionButton variant="tertiary" onClick={() => setShowEmptyNameModal(false)}>
                Cancel
              </ActionButton>
          </BottomSheet>
        )}

        {pendingRir && (
          <RirSheet
            setInfo={pendingRir}
            onSelect={handleRirSelect}
            onSkip={handleRirSkip}
          />
        )}
        {showFinishModal && (
          <BottomSheet variant="card" zClass="z-50" layout="scrollable" padding="none" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="px-6 pt-6 pb-10">
              <h2 className="text-lg font-bold text-center mb-2">Finish workout</h2>
              {(exercises.length === 0 || startedFromEmptyRef.current) ? (
                <>
                  <p className="text-sm text-muted-mid text-center mb-6">Save this workout as a routine in a programme?</p>
                  <ActionButton className="mb-3" onClick={() => { setShowFinishModal(false); setShowSaveAsRoutineModal(true) }} variant="primary">
                    Save as routine
                  </ActionButton>
                  <ActionButton className="mb-3" variant="secondary" onClick={() => confirmFinish(false)}>
                    Save without adding to programme
                  </ActionButton>
                </>
              ) : isRoutineBased() ? (<>
                <p className="text-sm text-muted-mid text-center mb-6">Update this routine in your programme with today's sets and reps?</p>
                <ActionButton className="mb-3" onClick={() => confirmFinish(true)} variant="primary">
                  Save & update routine
                </ActionButton>
                <ActionButton className="mb-3" variant="secondary" onClick={() => confirmFinish(false)}>
                  Save without updating routine
                </ActionButton>
              </>) : isTemplateBased() ? (<>
                <p className="text-sm text-muted-mid text-center mb-6">Update templates with today's values?</p>
                <ActionButton className="mb-3" onClick={() => confirmFinish(true)} variant="primary">
                  Save & update all templates
                </ActionButton>
                <ActionButton className="mb-3" variant="secondary" onClick={() => confirmFinish(false)}>
                  Save without updating templates
                </ActionButton>
              </>) : (<>
                <p className="text-sm text-muted-mid text-center mb-6">Save workout without adding to a programme?</p>
                <ActionButton className="mb-3" onClick={() => confirmFinish(false)} variant="primary">
                  Save and finish
                </ActionButton>
              </>)}
              <ActionButton variant="tertiary" onClick={() => setShowFinishModal(false)}>
                Cancel
              </ActionButton>
          </BottomSheet>
        )}

        {showCancelWorkoutConfirm && (
          <BottomSheet align="center" variant="card" zClass="z-50" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="text-center">
              <h2 className="text-base font-bold text-center mb-2">Cancel workout?</h2>
              <p className="text-sm text-muted text-center mb-5">This will discard your current workout and all sets.</p>
              <div className="flex gap-3">
                <ActionButton type="button" variant="secondary" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => setShowCancelWorkoutConfirm(false)}>
                  Keep workout
                </ActionButton>
                <ActionButton type="button" variant="danger" fullWidth={false} className="flex-1 !rounded-xl" onClick={() => { setShowCancelWorkoutConfirm(false); cancelWorkout(); }}>
                  Discard workout
                </ActionButton>
              </div>
          </BottomSheet>
        )}

        {pendingStart && (
          <BottomSheet align="center" variant="card" zClass="z-50" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="text-center">
              <div className="flex justify-center mb-4"><div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 stroke-accent"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div></div>
              <h2 className="text-base font-bold text-center mb-2">Active workout</h2>
              <p className="text-sm text-muted text-center mb-5">You have an active workout with <span className="font-bold text-text">{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>. Starting a new one will discard it.</p>
              <ActionButton variant="danger" className="!rounded-xl mb-2" onClick={confirmDiscardAndStart}>
                Discard & start new
              </ActionButton>
              <ActionButton variant="tertiary" onClick={() => setPendingStart(null)}>
                Keep current workout
              </ActionButton>
          </BottomSheet>
        )}

        {deletingFolder !== null && (
          <BottomSheet align="center" variant="card" zClass="z-50" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="text-center">
              <DeleteTrashBadge />
              <h2 className="text-base font-bold text-center mb-2">Delete "{folders[deletingFolder]?.name}"?</h2>
              <p className="text-sm text-muted text-center mb-1">This folder contains <span className="font-bold text-text">{folders[deletingFolder]?.templates.length} template{folders[deletingFolder]?.templates.length !== 1 ? 's' : ''}</span>.</p>
              <p className="text-sm text-muted-mid text-center mb-5">Templates will be moved to "{folders.find((_, i) => i !== deletingFolder)?.name}".</p>
              <ActionButton type="button" variant="danger" className="!rounded-xl mb-2" onClick={confirmDeleteFolder}>
                <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                Delete folder
              </ActionButton>
              <ActionButton variant="tertiary" onClick={() => setDeletingFolder(null)}>
                Cancel
              </ActionButton>
          </BottomSheet>
        )}

        {deletingTemplate && (
          <BottomSheet align="center" variant="card" zClass="z-50" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="text-center">
              <DeleteTrashBadge />
              <h2 className="text-base font-bold text-center mb-2">Delete template?</h2>
              <p className="text-sm text-muted text-center mb-5">"{folders[deletingTemplate.fi]?.templates[deletingTemplate.ti]?.name}" will be permanently deleted.</p>
              <ActionButton type="button" variant="danger" className="!rounded-xl mb-2" onClick={confirmDeleteTemplate}>
                <DeleteTrashGlyph className="w-4 h-4 shrink-0" />
                Delete template
              </ActionButton>
              <ActionButton variant="tertiary" onClick={() => setDeletingTemplate(null)}>
                Cancel
              </ActionButton>
          </BottomSheet>
        )}

        {showSaveModal && <SaveTemplateModal folders={folders} onSave={confirmSaveTemplate} onCancel={() => setShowSaveModal(false)} />}
        {showSaveAsRoutineModal && (
          <SaveAsRoutineModal
            programmes={programmes}
            newProgrammePlaceholder="e.g. 2 Split - Push/Pull"
            defaultRoutineName={workoutName}
            onSave={confirmSaveAsRoutine}
            onCancel={() => { setShowSaveAsRoutineModal(false); setShowFinishModal(true) }}
          />
        )}

        {/* INCOMPLETE SETS WARNING */}
        {incompleteSetsWarning && (
          <BottomSheet align="center" variant="card" zClass="z-50" maxWidthClass="max-w-sm" showHandle={false} closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="text-center">
              <div className="flex justify-center mb-4"><div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-6 h-6 stroke-accent"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div></div>
              <h2 className="text-base font-bold text-center mb-2">
                {incompleteSetsWarning.noneDone ? 'No sets marked as done' : 'Incomplete sets'}
              </h2>
              <p className="text-sm text-muted text-center mb-5">
                {incompleteSetsWarning.noneDone
                  ? 'You have not marked any sets as done. This workout will be saved without completed sets.'
                  : <>You completed <span className="font-bold text-text">{incompleteSetsWarning.done} of {incompleteSetsWarning.total}</span> sets. Incomplete sets won&apos;t be saved.</>}
              </p>
              <ActionButton className="!rounded-xl mb-2 shadow-lg shadow-accent/25" onClick={() => { setIncompleteSetsWarning(null); setShowFinishModal(true) }} variant="primary">
                Finish anyway
              </ActionButton>
              <ActionButton variant="tertiary" onClick={() => setIncompleteSetsWarning(null)}>
                Continue workout
              </ActionButton>
          </BottomSheet>
        )}

        {/* BOTTOM NAV — skjules under workout bootstrap så spinner ikke hopper når menuen mountes */}
        {!workoutBootstrapLoading && !showOnboardingUi ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-page/95 backdrop-blur-xl border-t border-[#1a1a30] px-4 py-2.5 pb-4 flex justify-around max-w-md mx-auto" role="navigation" aria-label="Main">
          <button type="button" onClick={() => setPage('progress')} aria-current={page === 'progress' ? 'page' : undefined} className={`flex flex-col items-center gap-1 ${page === 'progress' ? 'opacity-100' : 'opacity-40'}`}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className={`w-5 h-5 ${page === 'progress' ? 'stroke-accent' : 'stroke-text'}`} aria-hidden><path d="M18 20V10M12 20V4M6 20v-6"/></svg><span className={`text-xs font-semibold ${page === 'progress' ? 'text-accent' : 'text-text'}`}>Progress</span></button>
          <button type="button" onClick={() => { setPage('workout'); if (showCompleteScreen) {} }} aria-current={page === 'workout' ? 'page' : undefined} className={`flex flex-col items-center gap-1 ${page === 'workout' ? 'opacity-100' : 'opacity-40'}`}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className={`w-5 h-5 ${page === 'workout' ? 'stroke-accent' : 'stroke-text'}`} aria-hidden><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span className={`text-xs font-semibold ${page === 'workout' ? 'text-accent' : 'text-text'}`}>Workout</span></button>
          <button type="button" onClick={() => setPage('coach')} aria-current={page === 'coach' ? 'page' : undefined} className={`flex flex-col items-center gap-1 ${page === 'coach' ? 'opacity-100' : 'opacity-40'}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`w-5 h-5 ${page === 'coach' ? 'text-accent' : 'text-text'}`} aria-hidden><path d="M12 3a6 6 0 0 0 4.5 9.97A5 5 0 0 1 12 21a5 5 0 0 1-4.5-8.03A6 6 0 0 0 12 3z" /></svg><span className={`text-xs font-semibold ${page === 'coach' ? 'text-accent' : 'text-text'}`}>Coach</span></button>
          <button type="button" onClick={() => setPage('profile')} aria-current={page === 'profile' ? 'page' : undefined} className={`flex flex-col items-center gap-1 ${page === 'profile' ? 'opacity-100' : 'opacity-40'}`}><svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className={`w-5 h-5 ${page === 'profile' ? 'stroke-accent' : 'stroke-text'}`} aria-hidden><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg><span className={`text-xs font-semibold ${page === 'profile' ? 'text-accent' : 'text-text'}`}>Profile</span></button>
        </div>
        ) : null}
      </div>
    </>
  )
}

const WORKOUT_COMPLETE_PHOTO_ANGLES = [
  { key: 'front', label: 'Front' },
  { key: 'back', label: 'Back' },
  { key: 'side', label: 'Side' },
]

function WorkoutCompleteScreen({
  data,
  rating,
  onRatingChange,
  onDone,
  onProgressPhoto,
  formatDuration,
  unitWeight,
  formatDecimal,
  recentWorkout = null,
  photoSessions = [],
}) {
  const { user } = useAuth()
  const uid = user?.uid ?? null
  const { name, templateName, duration, setCount, volume, exerciseCount = 0, newPRs, progression } = data
  const minutes = Math.floor(duration / 60)
  const lastVolume = progression?.prevVolume ?? 0
  const lastMinutes = progression?.prevDuration != null ? Math.floor(progression.prevDuration / 60) : 0
  const volStr = formatDecimal ? formatDecimal(Math.round(volume ?? 0), 0) : (volume != null ? String(Math.round(volume)) : '—')
  const labels = ['Terrible', 'Low', 'OK', 'Good', 'Great']
  const hasPRs = newPRs && newPRs.length > 0

  const volumeDiff = progression ? (volume ?? 0) - lastVolume : 0
  const durationDiff = progression ? minutes - lastMinutes : 0

  const linkedPhotoSession = useMemo(() => {
    const ids = recentWorkout?.photoSessionIds
    if (!Array.isArray(ids) || ids.length === 0) return null
    return (photoSessions || []).find((s) => s.id === ids[0]) ?? null
  }, [recentWorkout, photoSessions])

  const [previewSrcs, setPreviewSrcs] = useState({ front: null, back: null, side: null })
  useEffect(() => {
    if (!linkedPhotoSession || !uid) {
      setPreviewSrcs({ front: null, back: null, side: null })
      return
    }
    let cancelled = false
    Promise.all(
      WORKOUT_COMPLETE_PHOTO_ANGLES.map(async ({ key }) => {
        const fn = linkedPhotoSession[key]
        if (!fn) return { key, src: null }
        try {
          const src = await loadPhotoSrc(fn, uid)
          return { key, src: src || null }
        } catch {
          return { key, src: null }
        }
      }),
    ).then((results) => {
      if (cancelled) return
      const next = { front: null, back: null, side: null }
      results.forEach(({ key, src }) => {
        next[key] = src
      })
      setPreviewSrcs(next)
    })
    return () => {
      cancelled = true
    }
  }, [linkedPhotoSession, uid])

  const hasLinkedProgressPhotos = Boolean(linkedPhotoSession)
  const hasAnyProgressPhotoFile = Boolean(
    linkedPhotoSession &&
      (linkedPhotoSession.front || linkedPhotoSession.back || linkedPhotoSession.side),
  )

  return (
    <div>
      {/* Header: workout name (same scale/colour as programme title on start card) + checkmark */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-sm font-bold tracking-tight text-accent">{name}</h1>
        <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center shrink-0 animate-bounce">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 stroke-white"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>

      {/* 4 stat boxes – one row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className={`${CARD_SURFACE_MD} p-3 text-center`}>
          <div className="text-xl font-extrabold text-text">{exerciseCount}</div>
          <div className={`${TYPE_OVERLINE_MID} mt-1`}>Exercises</div>
        </div>
        <div className={`${CARD_SURFACE_MD} p-3 text-center`}>
          <div className="text-xl font-extrabold text-text">{setCount}</div>
          <div className={`${TYPE_OVERLINE_MID} mt-1`}>Sets</div>
        </div>
        <div className={`${CARD_SURFACE_MD} p-3 text-center`}>
          <div className="text-xl font-extrabold text-text">{minutes}</div>
          <div className={`${TYPE_OVERLINE_MID} mt-1`}>Minutes</div>
        </div>
        <div className={`${CARD_SURFACE_MD} p-3 text-center`}>
          <div className="text-xl font-extrabold text-text">{volStr}</div>
          <div className={`${TYPE_OVERLINE_MID} mt-1`}>Kg vol</div>
        </div>
      </div>

      {/* Personal Records – only when there are PRs */}
      {hasPRs && (
        <div className={`${CARD_SURFACE_LG} p-4 mb-3`}>
          <div className="flex items-center gap-1.5 mb-3">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-amber-400"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Personal Records</span>
          </div>
          {newPRs.map((pr, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 stroke-amber-400 shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                {pr.name}
              </span>
              <span className="text-sm font-extrabold text-amber-400">{pr.display}</span>
            </div>
          ))}
        </div>
      )}

      {/* Vs. last session – two side-by-side boxes */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 stroke-muted-mid"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
          <span className="text-xs font-bold text-muted-mid uppercase tracking-wider">Vs. last session</span>
        </div>
        {progression ? (
          <div className="grid grid-cols-2 gap-2">
            <div className={`${CARD_SURFACE_MD} p-3`}>
              <div className={`${TYPE_OVERLINE_MID} mb-1`}>Volume</div>
              <div className="flex items-center gap-1 flex-wrap">
                {volumeDiff > 0 && <span className="flex items-center gap-0.5 text-sm font-bold text-success"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-success"><polyline points="18 15 12 9 6 15"/></svg>+{formatDecimal ? formatDecimal(Math.round(volumeDiff), 0) : Math.round(volumeDiff)} {unitWeight}</span>}
                {volumeDiff < 0 && <span className="flex items-center gap-0.5 text-sm font-bold text-negative"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-negative"><polyline points="6 9 12 15 18 9"/></svg>{formatDecimal ? formatDecimal(Math.round(volumeDiff), 0) : Math.round(volumeDiff)} {unitWeight}</span>}
                {volumeDiff === 0 && <span className="text-sm font-bold text-muted-strong">Same</span>}
              </div>
              <div className="text-xs text-muted-mid mt-0.5">{volStr} vs {formatDecimal ? formatDecimal(Math.round(lastVolume), 0) : Math.round(lastVolume)} {unitWeight}</div>
            </div>
            <div className={`${CARD_SURFACE_MD} p-3`}>
              <div className={`${TYPE_OVERLINE_MID} mb-1`}>Duration</div>
              <div className="flex items-center gap-1 flex-wrap">
                {durationDiff > 0 && <span className="flex items-center gap-0.5 text-sm font-bold text-success"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-success"><polyline points="18 15 12 9 6 15"/></svg>+{durationDiff} min</span>}
                {durationDiff < 0 && <span className="flex items-center gap-0.5 text-sm font-bold text-success"><svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 stroke-success"><polyline points="18 15 12 9 6 15"/></svg>{Math.abs(durationDiff)} min faster</span>}
                {durationDiff === 0 && <span className="text-sm font-bold text-muted-strong">Same</span>}
              </div>
              <div className="text-xs text-muted-mid mt-0.5">{minutes} vs {lastMinutes} min</div>
            </div>
          </div>
        ) : (
          <div className={`${CARD_SURFACE_MD} p-3`}>
            <div className="text-sm text-muted-strong italic">{templateName ? `Shown after ${templateName} has been used twice` : 'Will show when you have a previous session to compare'}</div>
          </div>
        )}
      </div>

      {/* Progress photo */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-muted-mid shrink-0" aria-hidden><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          <span className="text-xs font-bold text-muted-mid uppercase tracking-wider">Progress photo</span>
        </div>
        <button
          type="button"
          onClick={onProgressPhoto}
          aria-label={
            hasLinkedProgressPhotos
              ? 'Progress photos for this workout. Tap to add or change.'
              : 'Take progress photos or upload from library'
          }
          className={`w-full flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl border bg-card hover:border-accent/50 hover:bg-accent/5 transition-colors ${
            hasLinkedProgressPhotos ? 'border-accent/25 border-solid' : 'border-dashed border-border-strong'
          }`}
        >
          <div className="w-full grid grid-cols-3 gap-1.5">
            {WORKOUT_COMPLETE_PHOTO_ANGLES.map(({ key, label }) => {
              const filename = linkedPhotoSession?.[key] ?? null
              const src = previewSrcs[key]
              const loading = Boolean(filename && !src)
              return (
                <div key={key} className="flex flex-col items-center gap-1 min-w-0">
                  <ProgressPhoto
                    src={src}
                    crop={linkedPhotoSession?.crops?.[key]}
                    className="rounded-lg border border-border-strong w-full"
                  >
                    {loading ? (
                      <div
                        className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin opacity-70"
                        aria-hidden
                      />
                    ) : (
                      <span className="text-muted-deep/80 text-lg leading-none font-light" aria-hidden>
                        —
                      </span>
                    )}
                  </ProgressPhoto>
                  <span className={`${TYPE_LABEL_MICRO} tracking-wide truncate max-w-full`}>
                    {label}
                  </span>
                </div>
              )
            })}
          </div>
          <span
            className={`${TYPE_MICRO} font-semibold text-center leading-snug max-w-[280px] ${
              hasAnyProgressPhotoFile ? 'text-accent' : 'text-muted-strong'
            }`}
          >
            {hasLinkedProgressPhotos
              ? 'Progress photos saved · tap to add or change'
              : 'Take a new photo or upload one from your library'}
          </span>
        </button>
      </div>

      {/* How was your motivation? – number + label per option */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2.5">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 stroke-muted-mid shrink-0" aria-hidden>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span className="text-xs font-bold text-muted-mid uppercase tracking-wider">How was your motivation?</span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onRatingChange?.(n)}
              className={`flex-1 flex flex-col items-center py-2.5 rounded-xl text-center transition-colors border ${rating === n ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card text-text'}`}
            >
              <span className={`text-base font-extrabold ${rating === n ? 'text-accent' : 'text-text'}`}>{n}</span>
              <span className={`${TYPE_EMPHASIS_SM} font-semibold mt-0.5 ${rating === n ? 'text-accent' : 'text-muted-mid'}`}>{labels[n - 1]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Done */}
      <ActionButton size="lg" className="mb-8 transition-transform hover:-translate-y-px active:translate-y-px" onClick={() => onDone(rating)} variant="primary">
        Done
      </ActionButton>
    </div>
  )
}

function SaveTemplateModal({ folders, onSave, onCancel }) {
  const [templateName, setTemplateName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(0)
  function handleSave() { if (!templateName) return; onSave(selectedFolder, templateName) }
  return (
    <BottomSheet variant="card" zClass="z-50" layout="scrollable" padding="none" showHandle closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="px-6 pb-10">
        <h2 className="text-lg font-bold text-center mb-5">Save as template</h2>
        <div className="mb-4">
          <div className={`${TYPE_LABEL_FORM} mb-2`}>Template name</div>
          <input type="text" placeholder="e.g. Push Day A" value={templateName} onChange={(e) => setTemplateName(e.target.value)} onFocus={e => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && handleSave()} autoFocus className="w-full bg-card-alt border border-border-strong rounded-xl px-4 py-3 text-text placeholder-muted-deep outline-none focus:border-accent transition-colors" />
        </div>
        <div className="mb-5">
          <div className={`${TYPE_LABEL_FORM} mb-2`}>Save to folder</div>
          <div className="flex flex-col gap-1.5">
            {folders.map((f, i) => (
              <button key={i} onClick={() => setSelectedFolder(i)} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-left transition-colors border ${selectedFolder === i ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted'}`}>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 shrink-0 ${selectedFolder === i ? 'stroke-accent fill-accent/10' : 'stroke-muted-strong'}`}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {f.name}<span className="text-sm text-muted-mid ml-auto">{f.templates.length}</span>
              </button>
            ))}
          </div>
        </div>
        <ActionButton className="mb-3" onClick={handleSave} disabled={!templateName} variant="primary">
          Save template
        </ActionButton>
        <ActionButton variant="tertiary" onClick={onCancel}>
          Cancel
        </ActionButton>
    </BottomSheet>
  )
}

function SaveAsRoutineModal({ programmes, newProgrammePlaceholder, defaultRoutineName, onSave, onCancel }) {
  const [mode, setMode] = useState(programmes.length > 0 ? 'existing' : 'new') // 'existing' | 'new'
  const [selectedProgId, setSelectedProgId] = useState(programmes[0]?.id || null)
  const [newProgrammeName, setNewProgrammeName] = useState('')
  const [routineName, setRoutineName] = useState(defaultRoutineName || '')
  const [saveAttempted, setSaveAttempted] = useState(false)
  const newProgrammeInputRef = useRef(null)
  const canSave = routineName.trim() && (mode === 'existing' ? selectedProgId : newProgrammeName.trim())

  useEffect(() => {
    if (mode !== 'new') return
    const el = newProgrammeInputRef.current
    if (!el) return
    el.focus()
    el.select()
  }, [mode])

  useEffect(() => {
    if (canSave) setSaveAttempted(false)
  }, [canSave])

  function handleSave() {
    if (!canSave) {
      setSaveAttempted(true)
      return
    }
    if (mode === 'existing') onSave({ type: 'existing', progId: selectedProgId }, routineName.trim())
    else onSave({ type: 'new', programmeName: newProgrammeName.trim() }, routineName.trim())
  }
  return (
    <BottomSheet variant="card" zClass="z-50" layout="scrollable" padding="none" showHandle closeOnBackdrop={false} backdropClassName="bg-black/70 backdrop-blur-sm" panelClassName="px-6 pb-10 max-h-[95vh]">
        <h2 className="text-lg font-bold text-center mb-5">Save as routine</h2>
        <div className="mb-4">
          <div className={`${TYPE_LABEL_FORM} mb-2`}>Programme</div>
          {programmes.length > 0 && (
            <div className="flex flex-col gap-1.5 mb-3">
              {programmes.map((p) => (
                <button key={p.id} type="button" onClick={() => { setMode('existing'); setSelectedProgId(p.id) }} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-left transition-colors border ${mode === 'existing' && selectedProgId === p.id ? 'border-accent bg-accent/10 text-accent' : 'border-border-strong bg-card-alt text-muted'}`}>
                  <span className="truncate">{p.name}</span>
                  <span className="text-sm text-muted-mid ml-auto">{(p.routineIds || []).length}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 mt-1 rounded-xl text-sm font-semibold border border-dashed transition-all ${
              mode === 'new'
                ? 'border-accent text-accent bg-accent/5'
                : 'border-border-strong text-accent bg-transparent hover:border-accent'
            }`}
          >
            <span className="text-base leading-none">+</span>
            <span>Create new programme</span>
          </button>
          {mode === 'new' && (
            <input
              ref={newProgrammeInputRef}
              type="text"
              placeholder={newProgrammePlaceholder || 'e.g. 2 Split - Push/Pull'}
              value={newProgrammeName}
              onChange={(e) => setNewProgrammeName(e.target.value)}
              onFocus={e => e.target.select()}
              className="mt-2 w-full bg-card-alt border border-border-strong rounded-xl px-4 py-3 text-text placeholder-muted-deep outline-none focus:border-accent transition-colors"
            />
          )}
        </div>
        <div className="mb-5">
          <div className={`${TYPE_LABEL_FORM} mb-2`}>Routine name</div>
          <input type="text" placeholder="e.g. Day 1 - Pull" value={routineName} onChange={(e) => setRoutineName(e.target.value)} onFocus={e => e.target.select()} onKeyDown={(e) => e.key === 'Enter' && handleSave()} className="w-full bg-card-alt border border-border-strong rounded-xl px-4 py-3 text-text placeholder-muted-deep outline-none focus:border-accent transition-colors" />
        </div>
        {saveAttempted && !canSave && (
          <p className="text-accent text-sm font-medium mb-3">
            {mode === 'existing' ? 'Enter a routine name to save.' : 'Enter programme name and routine name to save.'}
          </p>
        )}
        <ActionButton className="mb-3" variant={canSave ? 'primary' : 'muted'} onClick={handleSave}>
          Save routine
        </ActionButton>
        <ActionButton type="button" variant="tertiary" onClick={onCancel}>
          Cancel
        </ActionButton>
    </BottomSheet>
  )
}

export default App
