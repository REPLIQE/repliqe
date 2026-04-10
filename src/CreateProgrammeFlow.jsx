import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { PRIVACY_POLICY_URL } from './lib/legalUrls'
import { app } from './lib/firebase'
import { RepliqeLogoBuilding } from './RepliqeLogo'
import { DEFAULT_EXERCISES } from './exerciseLibrary'
import { invokeCoachGenerate } from './lib/invokeCoachGenerate'
import ActionButton from './ActionButton'
import { TYPE_EMPHASIS_SM, TYPE_OVERLINE_STRONG, TYPE_TAB } from './typographyTokens'
import { Z_OVERLAY } from './zLayers'
import { REST_PRESETS, REST_MAX_SEC, snapRestSecondsToPreset } from './restPresets'

const warningIcon = (className = 'w-4 h-4 text-amber-400 shrink-0 mt-0.5') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

function hasMedicalKeywords(text) {
  if (!text || typeof text !== 'string') return false
  const t = text.toLowerCase()
  const words = [
    'injury',
    'pain',
    'surgery',
    'operation',
    'heart',
    'diabetes',
    'epilepsy',
    'bad',
    'condition',
    'disease',
    'knæ',
    'ryg',
    'hjerte',
    'sygdom',
    'skade',
    'knee',
    'back',
  ]
  return words.some((w) => t.includes(w))
}

function formatDurationSeconds(seconds) {
  const n = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(n / 60)
  const s = Math.floor(n % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function parseCoachJson(text) {
  const clean = String(text || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(clean.slice(start, end + 1))
    throw new Error('Invalid JSON from Coach')
  }
}

/** Build app programme + routines from Claude JSON (Coach). */
export function buildProgrammeFromCoach(parsed, allExercises, quiz) {
  const programmeId = `coach_${Date.now()}`
  const allowedLib = Array.isArray(allExercises) && allExercises.length ? allExercises : DEFAULT_EXERCISES
  const byNameLower = new Map(allowedLib.map((e) => [e.name.toLowerCase(), e]))

  const routines = (parsed.routines || []).map((routine, i) => {
    const routineId = `${programmeId}_rtn_${i}`
    const exercises = (routine.exercises || []).map((ex) => {
      const rawName = (ex.exerciseName || '').trim()
      const libEntry = byNameLower.get(rawName.toLowerCase())
      const exType = libEntry?.type || 'weight_reps'
      const nSets = Math.max(1, Math.min(12, Number(ex.sets) || 3))

      const setConfigs = Array.from({ length: nSets }, () => {
        if (exType === 'time_only') {
          const sec = Number(ex.duration) > 0 ? Number(ex.duration) : 30
          return { targetKg: '', targetReps: formatDurationSeconds(sec) }
        }
        if (exType === 'reps_only' || exType === 'bw_reps') {
          return { targetKg: '', targetReps: String(ex.reps != null ? ex.reps : 10) }
        }
        if (exType === 'distance_time') {
          return { targetKg: '', targetReps: '' }
        }
        return { targetKg: '', targetReps: String(ex.reps != null ? ex.reps : 10) }
      })

      const name = libEntry?.name || rawName
      return {
        id: crypto.randomUUID(),
        exerciseId: name,
        setConfigs,
        restOverride:
          ex.restSeconds != null && ex.restSeconds !== ''
            ? snapRestSecondsToPreset(ex.restSeconds)
            : null,
        note: '',
        rirOverride: null,
        supersetGroupId: null,
        supersetRole: null,
      }
    })

    return {
      id: routineId,
      name: routine.name || `Day ${i + 1}`,
      exercises,
      programmeId,
    }
  })

  const routineIds = routines.map((r) => r.id)

  return {
    programme: {
      id: programmeId,
      name: parsed.programmeName || 'Coach programme',
      type: 'rotation',
      routineIds,
      isActive: false,
      currentIndex: 0,
      source: 'coach',
      isQoreGenerated: true,
      rationale: parsed.rationale || '',
      safetyNote: parsed.safetyNote || null,
      qoreGoal: quiz.goal,
      qoreLevel: quiz.level,
      qoreEquipment: quiz.equipment,
      qoreDaysPerWeek: quiz.daysPerWeek,
      qoreSessionLength: quiz.sessionLength ?? null,
      qoreFocusTags: Array.isArray(quiz.focusTags) && quiz.focusTags.length ? [...quiz.focusTags] : null,
      qoreFocusNotes: quiz.focusNotes && String(quiz.focusNotes).trim() ? String(quiz.focusNotes).trim() : null,
      qoreCreatedAt: new Date().toISOString(),
    },
    routines,
  }
}

function sanitizeParsedProgramme(parsed, validNamesLowerSet) {
  const routines = (parsed.routines || [])
    .map((r) => ({
      ...r,
      exercises: (r.exercises || [])
        .filter((e) => {
          const n = (e.exerciseName || '').trim().toLowerCase()
          return n && validNamesLowerSet.has(n)
        })
        .map((e) => {
          if (e.restSeconds == null || e.restSeconds === '') return e
          return { ...e, restSeconds: snapRestSecondsToPreset(e.restSeconds) }
        }),
    }))
    .filter((r) => (r.exercises || []).length > 0)
  return { ...parsed, routines }
}

/** Max exercises per routine from Coach — align with SESSION LENGTH rules in prompt. */
const COACH_SESSION_EXERCISE_CAP = { '30': 5, '45': 6, '60': 7, '75': 8, '90': 9 }

function validateCoachAgainstQuiz(parsed, { daysPerWeek, sessionLength, goal }) {
  const expectedDays = Number(daysPerWeek)
  const routines = parsed?.routines ?? []
  if (Number.isFinite(expectedDays) && expectedDays >= 1 && routines.length !== expectedDays) {
    throw new Error(
      `Coach returned ${routines.length} training day(s), but you selected ${expectedDays}. Tap Try again.`
    )
  }
  let cap = COACH_SESSION_EXERCISE_CAP[sessionLength] ?? 7
  if (goal === 'get_stronger') cap = Math.max(3, cap - 1)
  routines.forEach((r, idx) => {
    const n = (r.exercises ?? []).length
    if (n < 1) {
      throw new Error(`Day ${idx + 1} has no exercises. Tap Try again.`)
    }
    if (n > cap + 1) {
      throw new Error(
        `A session has ${n} exercises — too many for a ~${sessionLength} min workout (aim for at most about ${cap}). Tap Try again.`
      )
    }
  })
}

/** Matches OnboardingScreen step 1–3 shell (progress bar + typography). */
function OnboardingFlowShell({ onBack, onSkipOnboarding, title, subtitle, children }) {
  return (
    <div className={`fixed inset-0 ${Z_OVERLAY} flex justify-center bg-page`}>
      <div className="w-full max-w-md mx-auto flex flex-col min-h-[100dvh] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-text">
        <div className="flex items-center gap-2 min-h-[44px] mb-2">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-xl text-muted-strong hover:text-text" aria-label="Back">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="flex-1" />
        </div>
        <div className="flex gap-1.5 mb-6" role="progressbar" aria-valuenow={3} aria-valuemin={0} aria-valuemax={3}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < 3 ? 'bg-accent' : 'bg-white/10'}`} />
          ))}
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          <h1 className="text-xl font-bold text-text tracking-tight mb-2">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-strong leading-relaxed mb-6">{subtitle}</p> : null}
          {children}
        </div>
        {onSkipOnboarding ? (
          <div className="shrink-0 w-full max-w-sm mx-auto border-t border-border-strong/50 pt-5 mt-1 space-y-3 pb-1">
            <button
              type="button"
              onClick={onSkipOnboarding}
              className="w-full text-center text-sm font-semibold text-muted-strong hover:text-text py-2.5 rounded-xl transition-colors"
            >
              Skip onboarding
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SheetFrame({ label, title, subtitle, onBack, onClose, children, showFlowProgress, flowProgressCurrent }) {
  const hasProgress = showFlowProgress && typeof flowProgressCurrent === 'number'
  return (
    <div className={`fixed inset-0 ${Z_OVERLAY} flex justify-center bg-page`}>
      <div className="w-full max-w-md flex flex-col bg-page mx-auto">
        <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <button type="button" onClick={onBack} className="p-2 -ml-2 rounded-lg text-muted-strong hover:bg-card-alt transition-colors" aria-label="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-strong hover:bg-card-alt transition-colors" aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-8">
          {hasProgress && <CoachFlowProgressBar current={flowProgressCurrent} total={COACH_FLOW_STEP_COUNT} />}
          <div className="px-4">
            {label && (
              <p className={`${TYPE_OVERLINE_STRONG} mb-1 ${hasProgress ? 'mt-1' : 'mt-4'}`}>{label}</p>
            )}
            <h1 className={`text-xl font-bold text-text mb-1 ${hasProgress && !label ? 'mt-1' : ''}`}>{title}</h1>
            {subtitle && <p className="text-sm text-muted-strong mb-6">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CreateProgrammeChoiceScreen({ onCoach, onManual, onClose, inOnboarding = false, onSkipOnboarding }) {
  const cards = (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onCoach}
        className={`w-full rounded-2xl p-4 text-left flex items-start gap-4 transition-colors ${
          inOnboarding
            ? 'border border-border-strong bg-card-alt/50 hover:bg-card-alt/80 active:bg-card-alt'
            : 'border-2 border-accent/40 bg-accent/5 hover:border-accent/60 hover:bg-accent/[0.08]'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 ${
            inOnboarding ? 'bg-accent/10 text-accent' : 'bg-accent/15 text-accent'
          }`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 3a6 6 0 0 0 4.5 9.97A5 5 0 0 1 12 21a5 5 0 0 1-4.5-8.03A6 6 0 0 0 12 3z" />
            <path d="M15 9.5a2.5 2.5 0 0 0-5 0 2.5 2.5 0 0 0 5 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {inOnboarding ? null : (
            <span className={`inline-block ${TYPE_EMPHASIS_SM} px-2 py-0.5 rounded-full mb-2 bg-accent/15 text-accent`}>Coach</span>
          )}
          <div className="text-base font-bold text-text">{inOnboarding ? 'Build with Coach' : 'Create with Coach'}</div>
          <p className="text-xs text-muted-strong mt-0.5 leading-snug">
            {inOnboarding
              ? 'Answer a few questions and Coach will build a programme for you.'
              : 'Answer a few questions. Coach builds a programme tailored to your goals, level and equipment.'}
          </p>
          {inOnboarding ? (
            <p className="text-xs text-muted-mid mt-2 leading-snug">Your first programme is free.</p>
          ) : null}
        </div>
      </button>

      <button
        type="button"
        onClick={onManual}
        className={`w-full rounded-2xl p-4 text-left flex items-start gap-4 transition-colors ${
          inOnboarding
            ? 'border border-border-strong bg-card-alt/50 hover:bg-card-alt/80 active:bg-card-alt'
            : 'border-2 border-border bg-card hover:border-border-strong'
        }`}
      >
        <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 ${inOnboarding ? 'bg-card-alt text-muted-strong' : 'bg-card-alt'}`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-strong" aria-hidden>
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-text">Build manually</div>
          <p className="text-xs text-muted-strong mt-0.5 leading-snug">
            Create your own programme from scratch. Add routines and exercises yourself.
          </p>
          {inOnboarding ? (
            <p className="text-xs text-muted-mid mt-2 leading-snug">Manual programmes are always free, with no limits.</p>
          ) : null}
        </div>
      </button>
    </div>
  )

  if (inOnboarding) {
    return (
      <OnboardingFlowShell
        onBack={onClose}
        onSkipOnboarding={onSkipOnboarding}
        title="Your first programme"
        subtitle="Choose how you want to get started — same steps as under Plan when you add a programme."
      >
        {cards}
      </OnboardingFlowShell>
    )
  }

  return (
    <SheetFrame
      label="NEW PROGRAMME"
      title="How do you want to create it?"
      subtitle="Build it yourself or let Coach design it based on your goals."
      onBack={onClose}
      onClose={onClose}
    >
      {cards}
    </SheetFrame>
  )
}

const COACH_GOALS = [
  { id: 'lose_weight', label: 'Lose weight', sub: 'Burn fat and get leaner' },
  { id: 'build_muscle', label: 'Build muscle', sub: 'Add size and strength' },
  { id: 'get_stronger', label: 'Get stronger', sub: 'Focus on heavy lifts and PRs' },
  { id: 'stay_in_shape', label: 'Stay in shape', sub: 'Maintain fitness and energy' },
]
const COACH_EQUIPMENT = [
  { id: 'full_gym', label: 'Full gym', sub: 'Barbells, machines, cables' },
  { id: 'dumbbells', label: 'Dumbbells only', sub: 'Free weights at home or gym' },
  { id: 'home_none', label: 'Home — no equipment', sub: 'Bodyweight exercises only' },
  { id: 'bands', label: 'Resistance bands', sub: 'Bands and bodyweight' },
]
const COACH_LEVELS = [
  { id: 'beginner', label: 'Beginner', sub: 'Less than 1 year of training' },
  { id: 'intermediate', label: 'Intermediate', sub: '1–3 years of consistent training' },
  { id: 'advanced', label: 'Advanced', sub: '3+ years, knows the basics well' },
]
const COACH_SESSION_LENGTHS = [
  { id: '30', label: '30 min', sub: 'Short and focused' },
  { id: '45', label: '45 min', sub: 'Efficient full session' },
  { id: '60', label: '60 min', sub: 'Standard gym session' },
  { id: '90', label: '90+ min', sub: 'Extended training' },
]

const QORE_MUSCLE_TAGS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core']

const QORE_STRUCTURE_TAGS = ['Push / Pull split', 'Upper / Lower split', 'Full body', 'Supersets']

const QORE_PREFERENCE_TAGS = [
  'More cardio',
  'Heavy compounds',
  'Avoid overhead',
  'Prefer machines',
  'Free weights',
  'Include stretching',
  'Less rest time',
  'More rest time',
]

/** Quiz steps 0–5 + consent 6; current === total means all segments filled (e.g. result). Same pattern as PhotosModal capture progress. */
const COACH_FLOW_STEP_COUNT = 7

function CoachFlowProgressBar({ current, total = COACH_FLOW_STEP_COUNT }) {
  return (
    <div className="px-4 pt-4">
      <div className="flex gap-2 mb-2">
        {Array.from({ length: total }, (_, i) => {
          const done = current >= total || i < current
          const active = current < total && i === current
          return (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-colors ${done ? 'bg-success' : active ? 'bg-accent' : 'bg-card-alt'}`}
            />
          )
        })}
      </div>
      <p className="text-sm text-muted text-center mb-2">
        {current >= total ? 'Complete' : `Step ${current + 1} of ${total}`}
      </p>
    </div>
  )
}

export function CreateProgrammeCoachOnboarding({
  onComplete,
  onBack,
  onClose,
  allExercises = DEFAULT_EXERCISES,
  onCoachGenerationSuccess,
  onOpenPrivacyPolicy,
}) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(null)
  const [daysPerWeek, setDaysPerWeek] = useState(null)
  const [sessionLength, setSessionLength] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [level, setLevel] = useState(null)
  const [focusTags, setFocusTags] = useState([])
  const [focusNotes, setFocusNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('quiz')
  const [coachConsentAccepted, setCoachConsentAccepted] = useState(false)
  const [generatedProgramme, setGeneratedProgramme] = useState(null)
  const [saving, setSaving] = useState(false)
  const [coachErrorDetail, setCoachErrorDetail] = useState(null)

  const titles = [
    "What's your main goal?",
    'How many days per week?',
    'How long can you train?',
    'What equipment do you have?',
    "What's your training level?",
    "Anything you'd like to focus on?",
  ]
  const subtitles = [
    'Your programme will be built around this.',
    'Be realistic — consistency beats intensity.',
    'This helps Coach plan the right amount of exercises.',
    'Your programme will only use what you have access to.',
    'This determines exercise complexity and volume.',
    'Optional — select focus areas or add your own preferences.',
  ]

  function toggleTag(tag) {
    setFocusTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  async function startBuilding() {
    setLoading(true)
    setCoachErrorDetail(null)
    try {
      const equipmentMap = {
        full_gym: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Kettlebell', 'Smith Machine'],
        dumbbells: ['Dumbbell', 'Bodyweight', 'Kettlebell', 'Band'],
        home_none: ['Bodyweight'],
        bands: ['Band', 'Bodyweight'],
      }
      const allowedEquipment = equipmentMap[equipment] || []

      const relevantExercises = DEFAULT_EXERCISES.filter(
        (ex) =>
          allowedEquipment.includes(ex.equipment) && ex.muscle !== 'cardio' && ex.muscle !== 'mobility'
      ).map((ex) => ({ name: ex.name, muscle: ex.muscle, equipment: ex.equipment, type: ex.type }))

      const validNamesLower = new Set(relevantExercises.map((e) => e.name.toLowerCase()))

      const prompt = `You are Coach, an expert AI personal trainer.
You give training-programme suggestions only — not medical advice. Do not diagnose, treat, or claim exercises are safe for injuries or health conditions. If notes mention serious health concerns, keep safetyNote cautious and tell the user to confirm with their doctor or physiotherapist.

Build a complete weekly training programme based on these inputs:

Goal: ${goal}
Days per week: ${daysPerWeek}
Session length: ${sessionLength === '90' ? '90+' : sessionLength} minutes per session
Equipment: ${equipment}
Level: ${level}
Focus areas: ${focusTags.length > 0 ? focusTags.join(', ') : 'None selected'}
Additional notes: ${focusNotes || 'None'}

Available exercises (use ONLY names from this list):
${JSON.stringify(relevantExercises)}

Rules:
- Create exactly ${daysPerWeek} routines (one per training day)
- Name routines clearly: e.g. "Day 1 – Push", "Day 2 – Pull", 
  "Day 3 – Legs", or "Upper A", "Lower B" etc.
- WHOLE-BODY MUSCLE COVERAGE (mandatory): Over the **full week** (all ${daysPerWeek} routines together), every major region below must receive **real training volume** — not name-only. Map exercises using their muscle tag / movement pattern from the exercise list.
  **Checklist** (unless Additional notes or focus **explicitly** limit scope — e.g. injury, temporary "upper only", doctor restriction, user says "no legs this block"):
  • **Chest** — horizontal or incline press / fly pattern; not zero chest work.
  • **Back** — at least one vertical pull **and** one horizontal pull pattern across the week where equipment allows (or closest substitutes from the list).
  • **Shoulders** — overhead or high-incline press **and** at least one lateral or rear-delt angle across the week when possible.
  • **Arms** — across the week hit **both** biceps (elbow flexion) **and** triceps (elbow extension); isolation or clear compound emphasis.
  • **Legs** — knee-dominant (squat/lunge/leg press) **and** a hip hinge or hamstring/knee accessory when equipment allows; **never** omit legs unless user explicitly excludes.
  • **Glutes** — hip thrust, lunge, squat, RDL, or isolation; when **Glutes** tag is selected, add **≥2** glute-biased movements across the week on lower-body days.
  • **Core** — anti-extension, rotation, or flexion (plank, carry, crunch, leg raise, etc.) — **≥2** distinct core exposures across the week (can be shorter finishers).
  **Few days per week (2–3):** Use **efficient compounds** and **full-body or hybrid** days so the checklist still clears — e.g. leg + pull + core on one day, push + legs + core on another; never “all upper” on every day unless user asked.
  **Explicit opt-out only:** If the user clearly writes they want to **skip or postpone** a region (notes or focus), follow that and mention it briefly in rationale — never silently drop a checklist item otherwise.
- Use progressive structure (compound lifts first, isolation after)
- NEVER schedule the same primary muscle group on back-to-back days
- Beginner: simpler movements, 3 sets, higher reps (10-15)
- Intermediate: moderate complexity, 3-4 sets, 8-12 reps
- Advanced: compound-heavy, 4-5 sets, 5-10 reps

SESSION LENGTH — user target is **~${sessionLength} minutes per session** (not per week). Hard caps per routine:
- 30 min: max **5** exercises, ~3 sets each
- 45 min: max **6** exercises, ~3 sets each
- 60 min: max **7** exercises, ~3–4 sets each
- 75 min: max **8** exercises, ~4 sets each
- 90+ min: max **9** exercises, ~4–5 sets each
- **get_stronger**: subtract **1** from the exercise-count cap above (longer rests).

TIME TARGET — stay close to **${sessionLength} minutes** each day:
- Output **exactly ${daysPerWeek}** routine objects — one per training day, **no more, no fewer**.
- Before finalising each routine, estimate: (total working sets × ~2.5–4 min per set depending on rest) + **~8 min** warmup/changeover. If the total **clearly exceeds** ${sessionLength} min, **remove** an isolation or reduce sets — do **not** exceed the caps above.
- Short sessions (**30–45 min**): fewer exercises, quality sets — do not cram volume.

GOAL-SPECIFIC RULES:
- lose_weight: include 1-2 cardio exercises per routine if 
  equipment allows. Higher reps (12-15), shorter rest.
- build_muscle: no cardio unless user requested it. 
  Focus on hypertrophy rep ranges (8-12). Use **generous rest** between hard sets 
  (especially on compounds) — not short “metabolic” rest unless lose_weight; 
  recovery drives volume and quality for muscle gain.
- get_stronger: prioritise compound barbell/dumbbell movements. 
  Lower reps (5-8), longer rest.
- stay_in_shape: balanced mix of compound and isolation. 
  Moderate reps (10-12).

PROGRAMME STRUCTURE — if user selected structure in focus areas:
- "Push / Pull split": structure ALL routines strictly as 
  alternating Push/Pull days. Push = chest, shoulders, triceps. 
  Pull = back, biceps. Add leg day if daysPerWeek >= 3.
- "Upper / Lower split": strictly alternate Upper/Lower days.
- "Full body": EVERY routine must include at least one exercise 
  for legs, push, pull and core.
- "Supersets": pair complementary exercises as supersets 
  where appropriate.

FOCUS AREAS — muscle group tags (${QORE_MUSCLE_TAGS.join(', ')}):
- Muscle tags mean **extra emphasis** (more exercises, harder variations, priority earlier in session), **not** permission to drop untagged regions — still satisfy the WHOLE-BODY checklist above unless Additional notes explicitly narrow the programme.
- For **each selected** tag: include **≥2** exercises biased to that area **across the week** (not necessarily both on one day unless it fits the split). If **one** tag only: still programme the rest of the body for balance.
- If **no** muscle tags: spread work so **every** checklist region gets fair attention for the user’s goal and level.

REST SECONDS — User Goal=${goal}, Level=${level}. Each exercise "restSeconds" MUST be exactly 
one of: ${REST_PRESETS.join(', ')} (0 = none). Max ${REST_MAX_SEC}s. Never any other number.

Step 1 — Classify every exercise into ONE category (pick best fit):
- **A Compound heavy**: barbell squat, deadlift, bench, OHP, heavy rows, hip thrust, heavy leg press as main lift
- **B Compound moderate**: dumbbell presses, cable rows, lat pulldown, machine compounds, RDL moderate, goblet squat
- **C Isolation**: curls, extensions, flyes, raises, leg curl/extension, calves, single-joint work
- **D Cardio / conditioning / easy BW circuits**: burpees, jumping jacks, mountain climbers, jump rope, light BW rounds

Step 2 — Use the range for the user’s Goal + Level + category. Every number in ranges is already valid (15s steps).
Pick **one** value inside the range: harder work (heavier, more sets, lower reps) → **upper** end; 
easier or metabolic work → **lower** end. Main “money” lift of the day for that muscle → upper end.

lose_weight (density + some fatigue; still allow quality on heavy compounds):
- beginner: A 60–75 | B 45–60 | C 30–45 | D 30–45
- intermediate: A 75–90 | B 60–75 | C 45 | D 30–45
- advanced: A 75–90 | B 60–75 | C 45–60 | D 45

build_muscle (hypertrophy — enough rest to repeat sets with good form):
- beginner: A 90–105 | B 75–90 | C 60–75 | D 45
- intermediate: A 105–120 | B 90–105 | C 75 | D 45–60
- advanced: A 120–150 | B 90–120 | C 75–90 | D 45–60

get_stronger (strength — longest rests on heavy compounds; use full ranges):
- beginner: A 105–120 | B 90–105 | C 75 | D 45–60
- intermediate: A 120–135 | B 105–120 | C 75–90 | D 45–60
- advanced: A 135–180 | B 120–135 | C 90–105 | D 60

stay_in_shape (balanced maintenance; moderate density):
- beginner: A 75–90 | B 60–75 | C 45–60 | D 30–45
- intermediate: A 90–105 | B 75–90 | C 60–75 | D 45
- advanced: A 90–120 | B 75–90 | C 60–75 | D 45–60

Step 3 — Focus tag overrides (if selected in Focus areas):
- **Less rest time**: subtract **15s** from your chosen value (floor: **30s** for A/B/C work sets; D can stay 30s).
- **More rest time**: add **15s** (ceiling: **${REST_MAX_SEC}s**). Combine sensibly with session length—if time is tight, 
  drop an exercise rather than cutting big-compound rest below the range minimum.

Step 4 — Session length: if rest targets make the routine too long, reduce **number of exercises** (per SESSION LENGTH rules), 
not below the **minimum** of the range for the heaviest compounds that day.

PROGRAMME NAME:
- Must be motivational and specific, e.g. "4-Day Strength Builder",
  "3-Day Full Body Burn", "Push/Pull Power Programme"
- Never use generic names like "4 Day Programme"

RATIONALE:
- Write 3-4 sentences as Coach directly to the user
- Explain WHY this specific structure suits their goal and level
- Mention the split type and rep ranges and why they were chosen
- Be specific, encouraging and expert in tone

${focusTags.length > 0 || focusNotes
  ? 'IMPORTANT: Adapt programme based on user focus areas and notes. If health concerns mentioned, avoid relevant exercises and add a safety note.'
  : ''}

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "programmeName": "string (short, descriptive, motivational)",
  "rationale": "string (3-4 sentences written directly to the user as Coach)",
  "safetyNote": "string or null (only if health concerns mentioned)",
  "routines": [
    {
      "name": "string (e.g. 'Day 1 – Push')",
      "exercises": [
        {
          "exerciseName": "string (must match exactly from exercise list)",
          "sets": number,
          "reps": number or null,
          "duration": number or null (seconds, for time_only),
          "restSeconds": number (must be one of: ${REST_PRESETS.join(', ')})
        }
      ]
    }
  ]
}`

      const auth = getAuth(app)
      const user = auth.currentUser
      console.log('Current user before Coach call:', user?.uid, user?.email)

      const text = await invokeCoachGenerate(prompt)
      let parsed = parseCoachJson(text)
      parsed = sanitizeParsedProgramme(parsed, validNamesLower)
      if (!parsed.routines?.length) {
        throw new Error('No valid exercises returned — try again')
      }
      validateCoachAgainstQuiz(parsed, { daysPerWeek, sessionLength, goal })
      setGeneratedProgramme(parsed)
      try {
        await Promise.resolve(onCoachGenerationSuccess?.())
      } catch (e) {
        console.warn('onCoachGenerationSuccess:', e)
      }
      setPhase('result')
    } catch (err) {
      console.error('Coach generation error:', err)
      setCoachErrorDetail(err instanceof Error ? err.message : null)
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  function handleQuizNext() {
    if (step < 5) setStep((s) => s + 1)
    else setPhase('consent')
  }

  function handleConsentBack() {
    setCoachConsentAccepted(false)
    setPhase('quiz')
  }

  async function handleSaveAndActivate(makeActive) {
    if (!generatedProgramme) return
    setSaving(true)
    try {
      const payload = buildProgrammeFromCoach(generatedProgramme, allExercises, {
        goal,
        level,
        equipment,
        daysPerWeek,
        sessionLength,
        focusTags,
        focusNotes,
      })
      if (makeActive) payload.programme.isActive = true
      onComplete?.(payload, makeActive)
    } catch (e) {
      console.error(e)
      setPhase('error')
    } finally {
      setSaving(false)
    }
  }

  const canNext =
    step === 0 ? goal : step === 1 ? daysPerWeek : step === 2 ? sessionLength : step === 3 ? equipment : step === 4 ? level : true

  if (loading) {
    return (
      <SheetFrame
        title="Coach is building your programme"
        subtitle="Tailoring it to your goals, level and equipment."
        onBack={onClose}
        onClose={onClose}
        showFlowProgress
        flowProgressCurrent={6}
      >
        <div className="flex flex-col items-center justify-center py-12 px-2">
          <div className="mb-8 drop-shadow-[0_0_28px_rgba(123,123,255,0.25)]">
            <RepliqeLogoBuilding size={100} />
          </div>
          <p className="text-muted-strong text-sm text-center animate-pulse">
            Coach is building your programme<span className="inline-block w-6 text-left">...</span>
          </p>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'error') {
    return (
      <SheetFrame
        title="Something went wrong"
        subtitle="Coach couldn't build your programme right now."
        onBack={() => { setCoachErrorDetail(null); setPhase('consent') }}
        onClose={onClose}
        showFlowProgress
        flowProgressCurrent={6}
      >
        <div className="rounded-2xl p-6 border border-border bg-card text-center">
          {coachErrorDetail ? (
            <p className="text-muted-strong text-sm mb-3 text-left whitespace-pre-wrap break-words">
              {coachErrorDetail}
            </p>
          ) : null}
          <p className="text-muted-strong text-sm mb-4">
            This can happen if there&apos;s a connection issue or the programme didn&apos;t match your choices. Try again — your answers are saved.
          </p>
          <ActionButton type="button" onClick={() => { setCoachErrorDetail(null); setPhase('consent') }} variant="primary">
            Try again
          </ActionButton>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'result' && generatedProgramme) {
    return (
      <SheetFrame
        label="COACH"
        title={generatedProgramme.programmeName}
        subtitle="Here's what Coach built for you."
        onBack={() => setPhase('consent')}
        onClose={onClose}
        showFlowProgress
        flowProgressCurrent={COACH_FLOW_STEP_COUNT}
      >
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
                <path d="M12 3a6 6 0 0 0 4.5 9.97A5 5 0 0 1 12 21a5 5 0 0 1-4.5-8.03A6 6 0 0 0 12 3z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Coach</span>
          </div>
          <p className="text-sm text-text leading-relaxed">{generatedProgramme.rationale}</p>
        </div>

        {generatedProgramme.safetyNote && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-4">
            {warningIcon()}
            <p className="text-xs text-amber-300 leading-relaxed">{generatedProgramme.safetyNote}</p>
          </div>
        )}

        <div className="space-y-2 mb-6">
          {generatedProgramme.routines.map((routine, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="font-semibold text-white text-sm mb-1">{routine.name}</div>
              <div className="text-xs text-white/35">
                {routine.exercises.length} exercises · {routine.exercises.map((e) => e.exerciseName).join(', ')}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <ActionButton type="button" disabled={saving} onClick={() => handleSaveAndActivate(true)} variant="primary">
            {saving ? 'Saving…' : 'Save & make active'}
          </ActionButton>
          <ActionButton type="button" disabled={saving} onClick={() => handleSaveAndActivate(false)} variant="tertiary" className="!min-h-0 py-2.5 active:scale-100">
            Save without activating
          </ActionButton>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'consent') {
    return (
      <SheetFrame
        label="COACH"
        title="Your data & your programme"
        subtitle="One step before Coach builds your plan."
        onBack={handleConsentBack}
        onClose={onClose}
        showFlowProgress
        flowProgressCurrent={6}
      >
        <div className="rounded-2xl border border-border bg-card p-4 mb-5">
          <p className="text-sm text-text leading-relaxed">
            Coach uses AI to design a programme based on your answers. Your training preferences are sent securely to an AI model for processing.
          </p>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6 rounded-xl border border-border bg-card-alt/50 p-3.5">
          <input
            type="checkbox"
            checked={coachConsentAccepted}
            onChange={(e) => setCoachConsentAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border-strong bg-card text-accent accent-accent focus:ring-2 focus:ring-accent/30 focus:ring-offset-0"
          />
          <span className="text-sm text-muted-strong leading-snug">
            I understand my preferences will be processed by AI to generate my programme, and confirm I have read the{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                if (onOpenPrivacyPolicy) onOpenPrivacyPolicy()
                else window.open(PRIVACY_POLICY_URL, '_blank', 'noopener,noreferrer')
              }}
              className="font-semibold text-accent underline underline-offset-2 hover:opacity-90 inline p-0 align-baseline bg-transparent border-0 cursor-pointer"
            >
              privacy policy
            </button>
            .
          </span>
        </label>

        <div className="space-y-2">
          <ActionButton type="button" onClick={startBuilding} disabled={!coachConsentAccepted} variant="primary">
            + Create programme
          </ActionButton>
          <ActionButton type="button" onClick={handleConsentBack} variant="tertiary" className="!min-h-0 py-2.5 active:scale-100">
            Back to answers
          </ActionButton>
        </div>
      </SheetFrame>
    )
  }

  return (
    <SheetFrame
      title={titles[step]}
      subtitle={subtitles[step]}
      onBack={step === 0 ? onBack : () => setStep((s) => s - 1)}
      onClose={onClose}
      showFlowProgress
      flowProgressCurrent={step}
    >
      <div className="space-y-4">
        {step === 0 && (
          <div className="space-y-2">
            {COACH_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${goal === g.id ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{g.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{g.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysPerWeek(d)}
                className={`w-14 h-14 rounded-[10px] font-bold text-lg border-2 transition-colors ${daysPerWeek === d ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted-strong hover:border-border-strong'}`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            {COACH_SESSION_LENGTHS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSessionLength(opt.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${sessionLength === opt.id ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{opt.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{opt.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2">
            {COACH_EQUIPMENT.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEquipment(e.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${equipment === e.id ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{e.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{e.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <div className="space-y-2">
            {COACH_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${level === l.id ? 'border-accent bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{l.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{l.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-0">
            <div>
              <p className={`${TYPE_TAB} text-muted-strong uppercase tracking-wider mb-2`}>Muscle groups</p>
              <div className="flex flex-wrap gap-2">
                {QORE_MUSCLE_TAGS.map((tag) => {
                  const on = focusTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border-2 transition-colors ${
                        on ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted hover:border-border-strong'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-border my-4" />
            <div>
              <p className={`${TYPE_TAB} text-muted-strong uppercase tracking-wider mb-2`}>Programme structure</p>
              <div className="flex flex-wrap gap-2">
                {QORE_STRUCTURE_TAGS.map((tag) => {
                  const on = focusTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border-2 transition-colors ${
                        on ? 'border-success/60 bg-success/10 text-success' : 'border-border bg-card text-muted hover:border-border-strong'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-border my-4" />
            <div>
              <p className={`${TYPE_TAB} text-muted-strong uppercase tracking-wider mb-2`}>Preferences</p>
              <div className="flex flex-wrap gap-2">
                {QORE_PREFERENCE_TAGS.map((tag) => {
                  const on = focusTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold border-2 transition-colors ${
                        on ? 'border-accent bg-accent/10 text-accent' : 'border-border bg-card text-muted hover:border-border-strong'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
            <textarea
              value={focusNotes}
              onChange={(e) => setFocusNotes(e.target.value)}
              placeholder="Anything else? e.g. avoid pull-ups, want more isolation work..."
              rows={3}
              className="w-full mt-4 bg-card-alt border-[1.5px] border-border-strong rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted-deep outline-none focus:border-accent transition-colors resize-none"
            />
            {hasMedicalKeywords(focusNotes) && (
              <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                {warningIcon()}
                <p className="text-xs text-amber-300 leading-relaxed">
                  You've mentioned something that may be health-related. We recommend consulting your doctor or physiotherapist before starting a new training
                  programme.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-8">
        <ActionButton type="button" onClick={handleQuizNext} disabled={!canNext} variant="primary">
          Continue
        </ActionButton>
      </div>
    </SheetFrame>
  )
}

export default function CreateProgrammeFlow({
  step,
  onStepChange,
  onManual,
  onClose,
  userId,
  saveCoachGeneratedProgramme,
  allExercises,
  onCoachGenerationSuccess,
  onOpenPrivacyPolicy,
  inOnboarding = false,
  onSkipOnboarding,
}) {
  const [resolvingEntry, setResolvingEntry] = useState(false)

  useEffect(() => {
    if (step !== 'entry' || !userId) return
    let cancelled = false
    setResolvingEntry(true)
    queueMicrotask(() => {
      if (cancelled) return
      onStepChange('choice')
      setResolvingEntry(false)
    })
    return () => {
      cancelled = true
    }
  }, [step, userId, onStepChange])

  if (!step || step === null) return null

  function handleCoachSelected() {
    onStepChange('coach')
  }

  if (step === 'entry' && resolvingEntry) {
    return (
      <div className={`fixed inset-0 ${Z_OVERLAY} flex justify-center items-center bg-page`}>
        <div className="w-full max-w-md flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }
  if (step === 'entry') return null

  if (step === 'choice') {
    return (
      <CreateProgrammeChoiceScreen
        onCoach={handleCoachSelected}
        onManual={onManual}
        onClose={onClose}
        inOnboarding={inOnboarding}
        onSkipOnboarding={onSkipOnboarding}
      />
    )
  }
  if (step === 'coach') {
    return (
      <CreateProgrammeCoachOnboarding
        allExercises={allExercises}
        onComplete={(payload, makeActive) => saveCoachGeneratedProgramme?.(payload, makeActive)}
        onBack={() => onStepChange('choice')}
        onClose={onClose}
        onCoachGenerationSuccess={onCoachGenerationSuccess}
        onOpenPrivacyPolicy={onOpenPrivacyPolicy}
      />
    )
  }
  return null
}
