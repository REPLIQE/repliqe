import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { getUserDoc, setHasSeenProgrammeExplainer } from './lib/userFirestore'
import { PRIVACY_POLICY_URL } from './lib/legalUrls'
import { app } from './lib/firebase'
import { RepliqeLogoBuilding } from './RepliqeLogo'
import { DEFAULT_EXERCISES } from './exerciseLibrary'

const primaryCta =
  'w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25 disabled:opacity-50 disabled:pointer-events-none transition-[opacity,transform] active:scale-[0.99]'

const secondaryGhost = 'w-full py-2.5 text-sm font-semibold text-muted-strong hover:text-text transition-colors'

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

function parseQoreJson(text) {
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
    throw new Error('Invalid JSON from Qore')
  }
}

/** Build app programme + routines from Claude JSON. */
export function buildProgrammeFromQore(parsed, allExercises, quiz) {
  const programmeId = `qore_${Date.now()}`
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
        restOverride: ex.restSeconds != null && ex.restSeconds !== '' ? Number(ex.restSeconds) : null,
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
      name: parsed.programmeName || 'Qore programme',
      type: 'rotation',
      routineIds,
      isActive: false,
      currentIndex: 0,
      isQoreGenerated: true,
      rationale: parsed.rationale || '',
      safetyNote: parsed.safetyNote || null,
      qoreGoal: quiz.goal,
      qoreLevel: quiz.level,
      qoreEquipment: quiz.equipment,
      qoreDaysPerWeek: quiz.daysPerWeek,
      qoreCreatedAt: new Date().toISOString(),
    },
    routines,
  }
}

function sanitizeParsedProgramme(parsed, validNamesLowerSet) {
  const routines = (parsed.routines || [])
    .map((r) => ({
      ...r,
      exercises: (r.exercises || []).filter((e) => {
        const n = (e.exerciseName || '').trim().toLowerCase()
        return n && validNamesLowerSet.has(n)
      }),
    }))
    .filter((r) => (r.exercises || []).length > 0)
  return { ...parsed, routines }
}

function SheetFrame({ label, title, subtitle, onBack, onClose, children }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-center bg-page">
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
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {label && <p className="text-[10px] font-bold text-muted-strong uppercase tracking-wider mt-4 mb-1">{label}</p>}
          <h1 className="text-xl font-bold text-text mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-muted-strong mb-6">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  )
}

export function CreateProgrammeChoiceScreen({ onQore, onManual, onClose }) {
  return (
    <SheetFrame
      label="NEW PROGRAMME"
      title="How do you want to create it?"
      subtitle="Build it yourself or let Qore design it based on your goals."
      onBack={onClose}
      onClose={onClose}
    >
      <div className="space-y-3">
        <button
          type="button"
          onClick={onQore}
          className="w-full rounded-2xl p-4 text-left border-2 border-accent/40 bg-accent/5 flex items-start gap-4 transition-colors hover:border-accent/60 hover:bg-accent/[0.08]"
        >
          <div className="w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 bg-accent/15 text-accent">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3a6 6 0 0 0 4.5 9.97A5 5 0 0 1 12 21a5 5 0 0 1-4.5-8.03A6 6 0 0 0 12 3z" />
              <path d="M15 9.5a2.5 2.5 0 0 0-5 0 2.5 2.5 0 0 0 5 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 bg-accent/15 text-accent">Qore — AI Personal Trainer</span>
            <div className="text-base font-bold text-text">Create with Qore</div>
            <p className="text-xs text-muted-strong mt-0.5">Answer a few questions. Qore builds a programme tailored to your goals, level and equipment.</p>
          </div>
        </button>

        <button
          type="button"
          onClick={onManual}
          className="w-full rounded-2xl p-4 text-left border-2 border-border bg-card flex items-start gap-4 transition-colors hover:border-border-strong"
        >
          <div className="w-12 h-12 rounded-[10px] bg-card-alt flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-strong">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-bold text-text">Build manually</div>
            <p className="text-xs text-muted-strong mt-0.5">Create your own programme from scratch. Add routines and choose exercises yourself.</p>
          </div>
        </button>
      </div>
    </SheetFrame>
  )
}

/** Shared Programme → Routines → Exercises ladder (readable icons via currentColor + theme tokens). */
export function ProgrammeStructureExplainerCards({ className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="rounded-2xl p-4 border border-border bg-card flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-accent/15 text-accent ring-1 ring-accent/20">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-text">Programme</div>
          <p className="text-xs text-muted-strong mt-0.5">Your overall training plan. Ex: &quot;3 Day Push/Pull/Legs&quot;</p>
        </div>
      </div>
      <div className="flex justify-center">
        <span className="text-muted-strong" aria-hidden>
          ↓
        </span>
      </div>
      <div className="rounded-2xl p-4 border border-border bg-card flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-success/15 text-success ring-1 ring-success/25">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-text">Routines</div>
          <p className="text-xs text-muted-strong mt-0.5">Individual workouts in the plan. Ex: &quot;Day 1 Push&quot;</p>
        </div>
      </div>
      <div className="flex justify-center">
        <span className="text-muted-strong" aria-hidden>
          ↓
        </span>
      </div>
      <div className="rounded-2xl p-4 border border-border bg-card flex items-start gap-3">
        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 4v16" />
            <path d="M18 4v16" />
            <path d="M2 8h4" />
            <path d="M2 16h4" />
            <path d="M18 8h4" />
            <path d="M18 16h4" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-text">Exercises + sets</div>
          <p className="text-xs text-muted-strong mt-0.5">The exercises in each routine with reps and weight.</p>
        </div>
      </div>
    </div>
  )
}

export function CreateProgrammeExplainerScreen({ onGotIt, onSkip, onBack, onClose }) {
  return (
    <SheetFrame
      label="BEFORE YOU START"
      title="How programmes work"
      subtitle="Here's how your training is structured in Repliqe."
      onBack={onBack}
      onClose={onClose}
    >
      <ProgrammeStructureExplainerCards className="mb-8" />
      <div className="space-y-2">
        <button type="button" onClick={onGotIt} className={primaryCta}>
          Got it — create my programme
        </button>
        <button type="button" onClick={onSkip} className={secondaryGhost}>
          Skip for now
        </button>
      </div>
    </SheetFrame>
  )
}

const QORE_GOALS = [
  { id: 'lose_weight', label: 'Lose weight', sub: 'Burn fat and get leaner' },
  { id: 'build_muscle', label: 'Build muscle', sub: 'Add size and strength' },
  { id: 'get_stronger', label: 'Get stronger', sub: 'Focus on heavy lifts and PRs' },
  { id: 'stay_in_shape', label: 'Stay in shape', sub: 'Maintain fitness and energy' },
]
const QORE_EQUIPMENT = [
  { id: 'full_gym', label: 'Full gym', sub: 'Barbells, machines, cables' },
  { id: 'dumbbells', label: 'Dumbbells only', sub: 'Free weights at home or gym' },
  { id: 'home_none', label: 'Home — no equipment', sub: 'Bodyweight exercises only' },
  { id: 'bands', label: 'Resistance bands', sub: 'Bands and bodyweight' },
]
const QORE_LEVELS = [
  { id: 'beginner', label: 'Beginner', sub: 'Less than 1 year of training' },
  { id: 'intermediate', label: 'Intermediate', sub: '1–3 years of consistent training' },
  { id: 'advanced', label: 'Advanced', sub: '3+ years, knows the basics well' },
]

export function CreateProgrammeQoreOnboarding({ onComplete, onBack, onClose, allExercises = DEFAULT_EXERCISES }) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(null)
  const [daysPerWeek, setDaysPerWeek] = useState(null)
  const [equipment, setEquipment] = useState(null)
  const [level, setLevel] = useState(null)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState('quiz')
  const [qoreConsentAccepted, setQoreConsentAccepted] = useState(false)
  const [generatedProgramme, setGeneratedProgramme] = useState(null)
  const [saving, setSaving] = useState(false)

  const titles = [
    "What's your main goal?",
    'How many days per week?',
    'What equipment do you have?',
    "What's your training level?",
    'Anything we should know?',
  ]
  const subtitles = [
    'Your programme will be built around this.',
    'Be realistic — consistency beats intensity.',
    'Your programme will only use what you have access to.',
    'This determines exercise complexity and volume.',
    'Optional — injuries, health conditions or preferences. Qore will adapt your programme.',
  ]

  async function startBuilding() {
    setLoading(true)
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

      const prompt = `You are Qore, an expert AI personal trainer. 
Build a complete weekly training programme based on these inputs:

Goal: ${goal}
Days per week: ${daysPerWeek}
Equipment: ${equipment}
Level: ${level}
Special notes from user: ${notes || 'None'}

Available exercises (use ONLY names from this list):
${JSON.stringify(relevantExercises)}

Rules:
- Create exactly ${daysPerWeek} routines (one per training day)
- Name routines clearly: e.g. "Day 1 – Push", "Day 2 – Pull", "Day 3 – Legs", or "Upper A", "Lower B" etc.
- Each routine should have 4-7 exercises appropriate for the goal and level
- Use progressive structure (compound lifts first, isolation after)
- For weight_reps exercises: suggest sets (3-4) and reps (e.g. 8-12)
- For reps_only: suggest sets and reps
- For time_only: suggest sets and duration in seconds
- ${notes ? 'IMPORTANT: Adapt programme based on user notes. If health concerns mentioned, avoid relevant exercises and add a safety note.' : ''}
- Beginner: simpler movements, 3 sets, higher reps (10-15)
- Intermediate: moderate complexity, 3-4 sets, 8-12 reps  
- Advanced: compound-heavy, 4-5 sets, 5-10 reps

Respond ONLY with a valid JSON object, no markdown, no explanation:
{
  "programmeName": "string (short, descriptive, e.g. '4-Day Push Pull')",
  "rationale": "string (2-3 sentences explaining your programme design thinking — written directly to the user as Qore)",
  "safetyNote": "string or null (only if user mentioned health concerns — recommend seeing a doctor/physio)",
  "routines": [
    {
      "name": "string (e.g. 'Day 1 – Push')",
      "exercises": [
        {
          "exerciseName": "string (must match exactly from exercise list)",
          "sets": number,
          "reps": number or null,
          "duration": number or null (seconds, for time_only),
          "restSeconds": number (60-120 for hypertrophy, 120-180 for strength)
        }
      ]
    }
  ]
}`

      const auth = getAuth(app)
      const user = auth.currentUser
      console.log('Current user before Qore call:', user?.uid, user?.email)

      const response = await fetch(
        'https://europe-west1-repliqe-710d2.cloudfunctions.net/generateQoreProgramme',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const data = await response.json()
      const text = data.text
      if (!text) throw new Error('Empty response from Qore')
      let parsed = parseQoreJson(text)
      parsed = sanitizeParsedProgramme(parsed, validNamesLower)
      if (!parsed.routines?.length) {
        throw new Error('No valid exercises returned — try again')
      }
      setGeneratedProgramme(parsed)
      setPhase('result')
    } catch (err) {
      console.error('Qore generation error:', err)
      setPhase('error')
    } finally {
      setLoading(false)
    }
  }

  function handleQuizNext() {
    if (step < 4) setStep((s) => s + 1)
    else setPhase('consent')
  }

  function handleConsentBack() {
    setQoreConsentAccepted(false)
    setPhase('quiz')
  }

  async function handleSaveAndActivate(makeActive) {
    if (!generatedProgramme) return
    setSaving(true)
    try {
      const payload = buildProgrammeFromQore(generatedProgramme, allExercises, {
        goal,
        level,
        equipment,
        daysPerWeek,
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

  const canNext = step === 0 ? goal : step === 1 ? daysPerWeek : step === 2 ? equipment : step === 3 ? level : true

  if (loading) {
    return (
      <SheetFrame title="Qore is building your programme" subtitle="Tailoring it to your goals, level and equipment." onBack={onClose} onClose={onClose}>
        <div className="flex flex-col items-center justify-center py-12 px-2">
          <div className="mb-8 drop-shadow-[0_0_28px_rgba(123,123,255,0.25)]">
            <RepliqeLogoBuilding size={100} />
          </div>
          <p className="text-muted-strong text-sm text-center animate-pulse">
            Qore is building your programme<span className="inline-block w-6 text-left">...</span>
          </p>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'error') {
    return (
      <SheetFrame title="Something went wrong" subtitle="Qore couldn't build your programme right now." onBack={() => setPhase('consent')} onClose={onClose}>
        <div className="rounded-2xl p-6 border border-border bg-card text-center">
          <p className="text-muted-strong text-sm mb-4">
            This can happen if there's a connection issue. Try again — your answers are saved.
          </p>
          <button type="button" onClick={() => setPhase('consent')} className={primaryCta}>
            Try again
          </button>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'result' && generatedProgramme) {
    return (
      <SheetFrame
        label="QORE"
        title={generatedProgramme.programmeName}
        subtitle="Here's what Qore built for you."
        onBack={() => setPhase('consent')}
        onClose={onClose}
      >
        <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent">
                <path d="M12 3a6 6 0 0 0 4.5 9.97A5 5 0 0 1 12 21a5 5 0 0 1-4.5-8.03A6 6 0 0 0 12 3z" />
              </svg>
            </div>
            <span className="text-xs font-bold text-accent uppercase tracking-wider">Qore's thinking</span>
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
            <div key={i} className="rounded-xl border border-border bg-card p-3.5">
              <div className="font-semibold text-text text-sm mb-1">{routine.name}</div>
              <div className="text-xs text-muted-strong">
                {routine.exercises.length} exercises · {routine.exercises.map((e) => e.exerciseName).join(', ')}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <button type="button" disabled={saving} onClick={() => handleSaveAndActivate(true)} className={primaryCta}>
            {saving ? 'Saving…' : 'Save & make active'}
          </button>
          <button type="button" disabled={saving} onClick={() => handleSaveAndActivate(false)} className={secondaryGhost}>
            Save without activating
          </button>
        </div>
      </SheetFrame>
    )
  }

  if (phase === 'consent') {
    return (
      <SheetFrame
        label="QORE"
        title="Your data & your programme"
        subtitle="One step before Qore builds your plan."
        onBack={handleConsentBack}
        onClose={onClose}
      >
        <div className="rounded-2xl border border-border bg-card p-4 mb-5">
          <p className="text-sm text-text leading-relaxed">
            Qore (AI) uses your training data to build your program. Your first program is free.
          </p>
          <a
            href={PRIVACY_POLICY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-accent underline underline-offset-2 hover:opacity-90"
          >
            Read our privacy policy
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6 rounded-xl border border-border bg-card-alt/50 p-3.5">
          <input
            type="checkbox"
            checked={qoreConsentAccepted}
            onChange={(e) => setQoreConsentAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border-strong bg-card text-accent accent-accent focus:ring-2 focus:ring-accent/30 focus:ring-offset-0"
          />
          <span className="text-sm text-muted-strong leading-snug">
            I accept the above and confirm I have read the privacy policy. Creating my programme records this acceptance.
          </span>
        </label>

        <div className="space-y-2">
          <button type="button" onClick={startBuilding} disabled={!qoreConsentAccepted} className={primaryCta}>
            + Create programme
          </button>
          <button type="button" onClick={handleConsentBack} className={secondaryGhost}>
            Back to answers
          </button>
        </div>
      </SheetFrame>
    )
  }

  return (
    <SheetFrame title={titles[step]} subtitle={subtitles[step]} onBack={step === 0 ? onBack : () => setStep((s) => s - 1)} onClose={onClose}>
      <div className="space-y-4">
        {step === 0 && (
          <div className="space-y-2">
            {QORE_GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGoal(g.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${goal === g.id ? 'border-accent/60 bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
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
                className={`w-14 h-14 rounded-[10px] font-bold text-lg border-2 transition-colors ${daysPerWeek === d ? 'border-accent bg-accent text-on-accent shadow-lg shadow-accent/20' : 'border-border bg-card text-muted-strong hover:border-border-strong'}`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {step === 2 && (
          <div className="space-y-2">
            {QORE_EQUIPMENT.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEquipment(e.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${equipment === e.id ? 'border-accent/60 bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{e.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{e.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-2">
            {QORE_LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                className={`w-full rounded-[10px] p-3.5 text-left border-2 transition-colors ${level === l.id ? 'border-accent/60 bg-accent/10' : 'border-border bg-card hover:border-border-strong'}`}
              >
                <div className="font-semibold text-text">{l.label}</div>
                <div className="text-xs text-muted-strong mt-0.5">{l.sub}</div>
              </button>
            ))}
          </div>
        )}
        {step === 4 && (
          <div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. bad knees, lower back issues, prefer no overhead pressing..."
              rows={4}
              className="w-full bg-card-alt border-[1.5px] border-border-strong rounded-xl px-4 py-3 text-sm text-text placeholder:text-muted-deep outline-none focus:border-accent transition-colors resize-none"
            />
            {hasMedicalKeywords(notes) && (
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
        <button type="button" onClick={handleQuizNext} disabled={!canNext} className={primaryCta}>
          Continue
        </button>
      </div>
    </SheetFrame>
  )
}

export default function CreateProgrammeFlow({ step, onStepChange, onManual, onClose, userId, saveQoreGeneratedProgramme, allExercises }) {
  const [resolvingEntry, setResolvingEntry] = useState(false)

  useEffect(() => {
    if (step !== 'entry' || !userId) return
    let cancelled = false
    setResolvingEntry(true)
    getUserDoc(userId)
      .then((data) => {
        if (cancelled) return
        onStepChange(data?.hasSeenProgrammeExplainer ? 'choice' : 'explainer')
      })
      .finally(() => {
        if (!cancelled) setResolvingEntry(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, userId, onStepChange])

  if (!step || step === null) return null

  async function handleExplainerDone() {
    if (userId) await setHasSeenProgrammeExplainer(userId)
    onStepChange('choice')
  }

  function handleQoreSelected() {
    onStepChange('qore')
  }

  if (step === 'entry' && resolvingEntry) {
    return (
      <div className="fixed inset-0 z-20 flex justify-center items-center bg-page">
        <div className="w-full max-w-md flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }
  if (step === 'entry') return null

  if (step === 'explainer') {
    return <CreateProgrammeExplainerScreen onGotIt={handleExplainerDone} onSkip={handleExplainerDone} onBack={onClose} onClose={onClose} />
  }
  if (step === 'choice') {
    return <CreateProgrammeChoiceScreen onQore={handleQoreSelected} onManual={onManual} onClose={onClose} />
  }
  if (step === 'qore') {
    return (
      <CreateProgrammeQoreOnboarding
        allExercises={allExercises}
        onComplete={(payload, makeActive) => saveQoreGeneratedProgramme?.(payload, makeActive)}
        onBack={() => onStepChange('choice')}
        onClose={onClose}
      />
    )
  }
  return null
}
