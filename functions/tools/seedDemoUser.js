/**
 * Seeds a complete demo user (testactiveuser@repliqe.com) on the production
 * Firebase project for marketing/screenshot/demo purposes.
 *
 * What it creates:
 *   - Auth user: testactiveuser@repliqe.com / nyfedapp, displayName "Alex"
 *   - users/{uid}                : profile, plan='pro', settings, onboarding done
 *   - users/{uid}/appData/main   : weightLog (26 weekly), measurementsLog (7 monthly),
 *                                  photoSessions (3 placeholders, no images),
 *                                  muscleLastWorked
 *   - users/{uid}/workoutPlans/  : ONE active programme (4-day Upper/Lower split)
 *   - users/{uid}/workoutSessions: ~95 backdated sessions over the last 6 months
 *
 * Realistic touches:
 *   - 4 days/week, varied weekly schedule (Mon/Tue/Thu/Fri vs Tue/Wed/Fri/Sat)
 *   - Progressive overload from intermediate baseline (Bench 70x5 → 85x5,
 *     Squat 90x5 → 110x5, Deadlift 110x5 → 140x5)
 *   - One deload week (~week 12) and one fully missed week (~week 18, "vacation")
 *   - Occasional plateaus, ±jitter on weights, rep variance
 *   - Bodyweight: ~85kg → ~81kg with weekly weigh-in noise
 *   - Body composition: chest/arm/thigh up, waist down (recomp signal)
 *
 * Photo sessions are created with `front/back/side: null` so the demo user
 * uploads the 9 images (3 dates × 3 angles) manually via the app UI. The
 * date placeholders (6mo ago, 3mo ago, this week) are pre-set.
 *
 * Idempotent — running again deletes the auth user + all Firestore docs
 * under users/{uid} and recreates from scratch. There's a YES-prompt
 * before any destructive action because this script targets PRODUCTION.
 *
 *
 * USAGE
 * -----
 *
 *   1. Authenticate as a service account / project owner. Either:
 *
 *      a) Application Default Credentials (recommended for personal devs):
 *           gcloud auth application-default login
 *
 *      b) Service account key file:
 *           export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/key.json
 *
 *   2. From the repo root:
 *           npm run seed:demo
 *
 *      Or directly:
 *           cd functions
 *           node tools/seedDemoUser.js
 *
 *   3. When prompted, type YES to confirm production write.
 *
 *
 * SAFETY
 * ------
 *   - Hard-coded to project repliqe-710d2 (matches .firebaserc).
 *   - Auth user is keyed by email; if the email already exists, that auth
 *     user AND every Firestore doc under their UID is wiped before re-seeding.
 *   - Will NOT touch any other user.
 */

'use strict'

const admin = require('firebase-admin')
const readline = require('readline')
const crypto = require('crypto')

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

const EXPECTED_PROJECT_ID = 'repliqe-710d2'

const DEMO = {
  email: 'testactiveuser@repliqe.com',
  password: 'nyfedapp',
  displayName: 'Alex',
  plan: 'pro',
  startBodyweightKg: 85.0,
  endBodyweightKg: 81.0,
}

// 6 months back from "today" (date the script is run)
const TIMELINE_WEEKS = 26
const SESSIONS_PER_WEEK = 4

// Programme + routine IDs are stable strings so re-runs produce the same
// document IDs (helpful when looking at the data in Firebase console).
const PROG_ID = 'prog_demo_upperlower'
const ROUTINE_IDS = {
  upperA: 'rtn_demo_upper_a',
  lowerA: 'rtn_demo_lower_a',
  upperB: 'rtn_demo_upper_b',
  lowerB: 'rtn_demo_lower_b',
}

// ---------------------------------------------------------------------------
// EXERCISE DEFINITIONS
//
// Each main lift has a starting and ending working-set weight; accessories
// have slower progression. `type` matches src/exerciseLibrary.js so set
// shapes serialize correctly (Pull-ups uses 'bw_reps').
//
// `name` MUST match `DEFAULT_EXERCISES[].name` in src/exerciseLibrary.js
// exactly — the app does library.find((e) => e.name === exerciseId).
// ---------------------------------------------------------------------------

const EX = {
  // Upper A
  bench:       { name: 'Barbell Bench Press',     type: 'weight_reps', start: 70,  end: 85,  reps: 5, sets: 4 },
  row:         { name: 'Barbell Row',             type: 'weight_reps', start: 65,  end: 82.5, reps: 6, sets: 4 },
  ohp:         { name: 'Barbell Overhead Press',  type: 'weight_reps', start: 45,  end: 55,  reps: 6, sets: 3 },
  pullups:     { name: 'Pull-ups',                type: 'bw_reps',     start: 5,   end: 10,  reps: null, sets: 3 },
  dbCurl:      { name: 'Dumbbell Curl',           type: 'weight_reps', start: 12,  end: 16,  reps: 10, sets: 3 },
  triPushdown: { name: 'Tricep Pushdown',         type: 'weight_reps', start: 25,  end: 40,  reps: 12, sets: 3 },

  // Lower A
  squat:       { name: 'Barbell Back Squat',      type: 'weight_reps', start: 90,  end: 110, reps: 5, sets: 4 },
  rdl:         { name: 'Romanian Deadlift',       type: 'weight_reps', start: 80,  end: 100, reps: 6, sets: 3 },
  legPress:    { name: 'Leg Press',               type: 'weight_reps', start: 140, end: 200, reps: 10, sets: 3 },
  legCurl:     { name: 'Seated Leg Curl',         type: 'weight_reps', start: 35,  end: 50,  reps: 10, sets: 3 },
  calfStand:   { name: 'Standing Calf Raise',     type: 'weight_reps', start: 60,  end: 90,  reps: 12, sets: 3 },

  // Upper B
  inclineDb:   { name: 'Incline Dumbbell Press',  type: 'weight_reps', start: 22,  end: 32,  reps: 8, sets: 4 },
  cableRow:    { name: 'Seated Cable Row',        type: 'weight_reps', start: 50,  end: 70,  reps: 10, sets: 4 },
  dbOhp:       { name: 'Dumbbell Shoulder Press', type: 'weight_reps', start: 16,  end: 24,  reps: 8, sets: 3 },
  latPulldown: { name: 'Lat Pulldown',            type: 'weight_reps', start: 50,  end: 70,  reps: 10, sets: 3 },
  latRaise:    { name: 'Lateral Raise',           type: 'weight_reps', start: 8,   end: 14,  reps: 12, sets: 3 },
  skullCrush:  { name: 'Skull Crushers',          type: 'weight_reps', start: 25,  end: 40,  reps: 10, sets: 3 },
  hammerCurl:  { name: 'Hammer Curl',             type: 'weight_reps', start: 12,  end: 18,  reps: 10, sets: 3 },

  // Lower B
  frontSquat:  { name: 'Front Squat',             type: 'weight_reps', start: 60,  end: 80,  reps: 5, sets: 3 },
  deadlift:    { name: 'Conventional Deadlift',   type: 'weight_reps', start: 110, end: 140, reps: 5, sets: 3 },
  walkLunge:   { name: 'Walking Lunge',           type: 'weight_reps', start: 12,  end: 20,  reps: 10, sets: 3 },
  legExt:      { name: 'Leg Extension',           type: 'weight_reps', start: 40,  end: 60,  reps: 12, sets: 3 },
  calfSeated:  { name: 'Seated Calf Raise',       type: 'weight_reps', start: 30,  end: 50,  reps: 15, sets: 3 },
}

// Each routine = ordered list of exercise keys from EX.
const ROUTINE_DEFS = [
  { id: ROUTINE_IDS.upperA, name: 'Upper A', exerciseKeys: ['bench', 'row', 'ohp', 'pullups', 'dbCurl', 'triPushdown'] },
  { id: ROUTINE_IDS.lowerA, name: 'Lower A', exerciseKeys: ['squat', 'rdl', 'legPress', 'legCurl', 'calfStand'] },
  { id: ROUTINE_IDS.upperB, name: 'Upper B', exerciseKeys: ['inclineDb', 'cableRow', 'dbOhp', 'latPulldown', 'latRaise', 'skullCrush', 'hammerCurl'] },
  { id: ROUTINE_IDS.lowerB, name: 'Lower B', exerciseKeys: ['frontSquat', 'deadlift', 'walkLunge', 'legExt', 'calfSeated'] },
]

// ---------------------------------------------------------------------------
// WEEKLY SCHEDULE GENERATION
//
// Two patterns alternate-ish so the data isn't mechanically rigid:
//   A: Mon, Tue, Thu, Fri  (most common — 60% of weeks)
//   B: Tue, Wed, Fri, Sat
// One full week is "missed" entirely (~week 18 — vacation).
// One week is a deload (~week 12) — same days, lighter weights, fewer reps.
// 2 individual sessions are randomly skipped throughout the rest.
// ---------------------------------------------------------------------------

const SCHEDULE_A = [1, 2, 4, 5] // Mon, Tue, Thu, Fri (0=Sun)
const SCHEDULE_B = [2, 3, 5, 6] // Tue, Wed, Fri, Sat

const MISSED_WEEK_INDEX = 18 // 0-based from start
const DELOAD_WEEK_INDEX = 12

// Deterministic-ish RNG so the same seed run produces similar (but not
// identical) data each invocation; uses Math.random which is fine for demo
// realism. We DO want some run-to-run variation if the user re-seeds, since
// otherwise it's obvious the data is fake.
function rand(min, max) {
  return Math.random() * (max - min) + min
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1))
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatDateEnGB(date) {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function dateAtNoon(date) {
  // Workouts are saved with date strings like "23/04/2026" + a Timestamp.
  // We anchor sessions to noon local time so the dd/mm/yyyy string and the
  // timestamp's local-day are guaranteed to match (avoids midnight rollover
  // edge cases when run from various timezones).
  const d = new Date(date)
  d.setHours(12, randInt(0, 59), randInt(0, 59), 0)
  return d
}

function startOfWeekN(weeksAgo, today) {
  const d = new Date(today)
  d.setDate(d.getDate() - weeksAgo * 7)
  return d
}

// Round to nearest 2.5 kg (matches typical plate increment) for main lifts.
// For DB/cable accessories, round to 0.5 kg.
function roundKg(value, increment = 2.5) {
  return Math.round(value / increment) * increment
}

// Compute target working weight for an exercise on a given session index.
// Uses linear progression with diminishing returns (sqrt curve), plus jitter,
// plus a deload modifier when applicable.
function computeWeight(exDef, sessionIdxForExercise, totalSessionsForExercise, isDeload) {
  if (exDef.type === 'bw_reps') return 0
  const span = exDef.end - exDef.start
  // Sqrt curve: faster gains early, slower late — realistic intermediate progression.
  const t = totalSessionsForExercise <= 1 ? 1 : sessionIdxForExercise / (totalSessionsForExercise - 1)
  const progressFactor = Math.sqrt(Math.max(0, Math.min(1, t)))
  let weight = exDef.start + span * progressFactor
  // Jitter ±5% so not every session is a textbook PR
  weight += rand(-0.04, 0.04) * weight
  // Deload: drop ~20-30%
  if (isDeload) weight *= 0.72
  // Choose increment based on lift size (heavy compound = 2.5, accessory dumbbell = 0.5)
  const increment = exDef.start >= 30 ? 2.5 : 0.5
  weight = roundKg(weight, increment)
  // Never go below start - 5kg or above end + 5kg
  return Math.max(exDef.start - 5, Math.min(exDef.end + 5, weight))
}

function computeReps(exDef, isDeload) {
  if (exDef.type === 'bw_reps') {
    // Pull-ups: progress reps over time; deload = lower reps
    return null // handled separately by caller
  }
  let reps = exDef.reps
  // ±1 rep variance, occasional 0 ("missed reps", failed top set)
  reps += randInt(-1, 1)
  if (isDeload) reps = Math.max(8, reps + 3)
  return Math.max(1, reps)
}

// Build the `sets` array for one exercise on one session.
// Returns the shape expected by the app:
//   weight_reps: [{ kg: '70', reps: '5', done: true }]
//   bw_reps:     [{ kg: '0', reps: '8', bwSign: '+', done: true }]
function buildSets(exDef, sessionIdxForExercise, totalSessionsForExercise, isDeload) {
  const setCount = exDef.sets
  const sets = []

  if (exDef.type === 'bw_reps') {
    // Pull-ups: reps grow from start to end across the timeline
    const t = totalSessionsForExercise <= 1 ? 1 : sessionIdxForExercise / (totalSessionsForExercise - 1)
    const progress = Math.sqrt(Math.max(0, Math.min(1, t)))
    let reps = Math.round(exDef.start + (exDef.end - exDef.start) * progress)
    if (isDeload) reps = Math.max(3, reps - 2)
    // First set strongest, later sets drop ±1
    for (let i = 0; i < setCount; i++) {
      const setReps = Math.max(1, reps - (i > 0 ? randInt(0, 2) : 0))
      sets.push({ kg: '0', reps: String(setReps), bwSign: '+', done: true })
    }
    return sets
  }

  const baseWeight = computeWeight(exDef, sessionIdxForExercise, totalSessionsForExercise, isDeload)
  const baseReps = computeReps(exDef, isDeload)

  for (let i = 0; i < setCount; i++) {
    // Set-to-set fatigue: drop reps slightly on later sets
    const setReps = Math.max(1, baseReps - (i > 0 && Math.random() < 0.4 ? 1 : 0))
    sets.push({
      kg: String(baseWeight),
      reps: String(setReps),
      done: true,
    })
  }
  return sets
}

// ---------------------------------------------------------------------------
// PROGRAMME / ROUTINE BUILDERS
// ---------------------------------------------------------------------------

// Build the days[] array embedded in the programme document. Each day's
// setConfigs use the exercise's CURRENT (end-of-timeline) target so the
// programme template reflects where the user is now.
function buildProgrammeDays() {
  return ROUTINE_DEFS.map((rdef) => ({
    id: rdef.id,
    name: rdef.name,
    exercises: rdef.exerciseKeys.map((key) => {
      const ex = EX[key]
      const targetKg = ex.type === 'bw_reps' ? '' : String(ex.end)
      const targetReps = ex.type === 'bw_reps' ? String(ex.end) : String(ex.reps)
      const setConfigs = Array.from({ length: ex.sets }, () => ({ targetKg, targetReps }))
      return {
        exerciseId: ex.name,
        setConfigs,
        restOverride: null,
        rirOverride: null,
        note: '',
        supersetGroupId: null,
        supersetRole: null,
      }
    }),
  }))
}

function buildProgramme() {
  return {
    id: PROG_ID,
    name: 'Upper / Lower 4-Day',
    type: 'rotation',
    routineIds: ROUTINE_DEFS.map((r) => r.id),
    isActive: true,
    currentIndex: 0, // overwritten after sessions are generated
    days: buildProgrammeDays(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }
}

// ---------------------------------------------------------------------------
// SESSION GENERATION
// ---------------------------------------------------------------------------

// Generates an ordered (oldest-first) array of session "plans": for each
// training day in the 26-week timeline, which routine, on which date,
// and which session-index-for-that-routine (so progression can be applied
// per-routine, not globally).
function generateSessionPlans(today) {
  const plans = []
  // Track per-routine session counts for progression curves
  const perRoutineCount = { upperA: 0, lowerA: 0, upperB: 0, lowerB: 0 }
  // Routine rotation cursor — which routine is next?
  let rotationIdx = 0

  for (let week = 0; week < TIMELINE_WEEKS; week++) {
    if (week === MISSED_WEEK_INDEX) continue // vacation

    const weekStart = startOfWeekN(TIMELINE_WEEKS - 1 - week, today)
    // Snap to Monday of that week so daysOfWeek line up cleanly
    const dayOfWeekNow = weekStart.getDay()
    const offsetToMonday = (dayOfWeekNow + 6) % 7 // Sun→6, Mon→0, Tue→1, ...
    weekStart.setDate(weekStart.getDate() - offsetToMonday)

    const schedule = Math.random() < 0.6 ? SCHEDULE_A : SCHEDULE_B
    const isDeload = week === DELOAD_WEEK_INDEX

    for (const dayOfWeek of schedule) {
      // 3% chance to skip an individual session for realism (sick, busy)
      if (!isDeload && Math.random() < 0.03) continue

      const sessionDate = new Date(weekStart)
      sessionDate.setDate(weekStart.getDate() + dayOfWeek)
      // Don't generate sessions in the future
      if (sessionDate > today) continue

      const routine = ROUTINE_DEFS[rotationIdx]
      const routineKey = Object.keys(ROUTINE_IDS).find((k) => ROUTINE_IDS[k] === routine.id)
      plans.push({
        date: dateAtNoon(sessionDate),
        routine,
        routineKey,
        sessionIdxForRoutine: perRoutineCount[routineKey],
        isDeload,
      })
      perRoutineCount[routineKey] += 1
      rotationIdx = (rotationIdx + 1) % ROUTINE_DEFS.length
    }
  }

  return { plans, perRoutineCount }
}

// Convert a plan into the `workout` payload stored under workoutSessions.
// Matches the shape produced by App.jsx#confirmFinish().
function buildWorkoutForSession(plan, perRoutineTotals) {
  const totalForRoutine = perRoutineTotals[plan.routineKey]
  const exercises = plan.routine.exerciseKeys.map((key) => {
    const ex = EX[key]
    return {
      name: ex.name,
      type: ex.type,
      sets: buildSets(ex, plan.sessionIdxForRoutine, totalForRoutine, plan.isDeload),
      restOverride: null,
      note: '',
      muscle: undefined,    // app pulls these from the library at render time
      equipment: undefined,
      movement: undefined,
    }
  })

  // Realistic durations: 50-80 min for full sessions, 35-50 for deloads
  const durationSecs = plan.isDeload ? randInt(35 * 60, 50 * 60) : randInt(50 * 60, 80 * 60)

  return {
    date: formatDateEnGB(plan.date),
    name: plan.routine.name,
    duration: durationSecs,
    exercises,
    routineId: plan.routine.id,
  }
}

// ---------------------------------------------------------------------------
// LOGS (weight, measurements, photos)
// ---------------------------------------------------------------------------

function buildWeightLog(today) {
  // 26 weekly weigh-ins, anchor each to Monday morning
  const entries = []
  const start = DEMO.startBodyweightKg
  const end = DEMO.endBodyweightKg
  for (let week = 0; week < TIMELINE_WEEKS; week++) {
    const date = startOfWeekN(TIMELINE_WEEKS - 1 - week, today)
    // Snap to Monday of that week
    const offsetToMonday = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offsetToMonday)
    if (date > today) continue
    const t = TIMELINE_WEEKS <= 1 ? 1 : week / (TIMELINE_WEEKS - 1)
    // Linear downtrend with ±0.4kg jitter; first/last anchored to start/end
    let value = start + (end - start) * t
    if (week !== 0 && week !== TIMELINE_WEEKS - 1) {
      value += rand(-0.4, 0.4)
    }
    entries.push({ date: formatDateEnGB(date), value: Math.round(value * 10) / 10 })
  }
  return entries
}

function buildMeasurementsLog(today) {
  // 7 monthly entries (start + every 4 weeks). cm.
  const series = {
    chest:    { start: 104, end: 107 },
    waist:    { start: 92,  end: 87  },
    hips:     { start: 96,  end: 95  },
    upperArm: { start: 37,  end: 39  },
    thigh:    { start: 60,  end: 61  },
    calf:     { start: 38,  end: 38.5 },
  }
  const entries = []
  const monthlyOffsets = [26, 22, 18, 14, 10, 6, 1] // weeks ago — last entry ~1 week ago
  for (let i = 0; i < monthlyOffsets.length; i++) {
    const date = startOfWeekN(monthlyOffsets[i], today)
    if (date > today) continue
    const t = monthlyOffsets.length <= 1 ? 1 : i / (monthlyOffsets.length - 1)
    const entry = { date: formatDateEnGB(date) }
    for (const key of Object.keys(series)) {
      const { start, end } = series[key]
      let v = start + (end - start) * t
      if (i !== 0 && i !== monthlyOffsets.length - 1) v += rand(-0.4, 0.4)
      entry[key] = Math.round(v * 10) / 10
    }
    entries.push(entry)
  }
  return entries
}

function buildPhotoSessions(today) {
  // 3 placeholder sessions: 6mo, 3mo, this week. Front/back/side null so the
  // demo user fills them in via the app's photo upload UI.
  const offsets = [TIMELINE_WEEKS, Math.floor(TIMELINE_WEEKS / 2), 1]
  return offsets.map((weeksAgo) => {
    const date = startOfWeekN(weeksAgo, today)
    const offsetToMonday = (date.getDay() + 6) % 7
    date.setDate(date.getDate() - offsetToMonday)
    return {
      id: 'photoSession_' + crypto.randomUUID(),
      date: formatDateEnGB(date),
      front: null,
      back: null,
      side: null,
      createdAt: date.getTime(),
    }
  })
}

// muscleLastWorked: derived from the most recent session per muscle slug.
// Simplified — we mark each slug used by the LAST session as worked at that
// session's timestamp. The app recomputes this on every workout finish.
function buildMuscleLastWorked(plans) {
  if (plans.length === 0) return {}
  const last = plans[plans.length - 1]
  const ts = last.date.toISOString()
  // Crude: mark every primary muscle worked across the routine that finished last
  // (the app will refine this naturally once the user trains again).
  const slugMap = {
    upperA: ['chest', 'back', 'lats', 'front-delts', 'triceps', 'biceps'],
    lowerA: ['quads', 'glutes', 'hamstrings', 'calves'],
    upperB: ['chest', 'back', 'lats', 'side-delts', 'front-delts', 'triceps', 'biceps'],
    lowerB: ['quads', 'glutes', 'hamstrings', 'calves'],
  }
  const out = {}
  for (const slug of slugMap[last.routineKey] || []) out[slug] = ts
  return out
}

// ---------------------------------------------------------------------------
// FIRESTORE WRITERS
// ---------------------------------------------------------------------------

async function findUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(email)
  } catch (err) {
    if (err.code === 'auth/user-not-found') return null
    throw err
  }
}

async function deleteAllSubcollections(db, uid) {
  // Delete each known subcollection's documents in batches.
  for (const subcol of ['workoutSessions', 'workoutPlans', 'appData', 'coachConversations']) {
    const ref = db.collection('users').doc(uid).collection(subcol)
    let total = 0
    for (;;) {
      const snap = await ref.limit(500).get()
      if (snap.empty) break
      const batch = db.batch()
      snap.docs.forEach((d) => batch.delete(d.ref))
      await batch.commit()
      total += snap.size
    }
    if (total > 0) console.log(`  deleted ${total} doc(s) from users/${uid}/${subcol}`)
  }
  // Then the user doc itself
  await db.collection('users').doc(uid).delete().catch(() => {})
  console.log(`  deleted users/${uid}`)
}

async function writeUserDoc(db, uid) {
  await db.collection('users').doc(uid).set({
    displayName: DEMO.displayName,
    email: DEMO.email,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    plan: DEMO.plan,
    onboardingComplete: true,
    onboardingStep: 5,
    settings: {
      weightUnit: 'kg',
      measurementUnit: 'cm',
      defaultRest: 90,
      bodyweight: DEMO.endBodyweightKg, // current
      weekStart: 1, // Monday
      unitWeight: 'kg',
      unitDistance: 'km',
      unitLength: 'cm',
      decimalSeparator: 'comma',
      dateFormat: 'ddmmyyyy',
      rirEnabled: false,
      keepScreenAwake: false,
      theme: 'dark',
    },
  })
  console.log(`  wrote users/${uid}`)
}

async function writeAppData(db, uid, weightLog, measurementsLog, photoSessions, muscleLastWorked) {
  await db.collection('users').doc(uid).collection('appData').doc('main').set({
    folders: [{ name: 'My Templates', open: true, templates: [] }],
    customExercises: [],
    weightLog,
    bodyFatLog: [],
    measurementsLog,
    muscleMassLog: [],
    photoSessions,
    muscleLastWorked,
    currentWorkout: null,
  })
  console.log(`  wrote users/${uid}/appData/main (${weightLog.length} weights, ${measurementsLog.length} measurements, ${photoSessions.length} photo sessions)`)
}

async function writeWorkoutPlan(db, uid, programme) {
  await db.collection('users').doc(uid).collection('workoutPlans').doc(programme.id).set(programme)
  console.log(`  wrote users/${uid}/workoutPlans/${programme.id}`)
}

async function writeWorkoutSessions(db, uid, sessionPlans, perRoutineTotals) {
  // Use chunked batches (max 500 ops/batch in Firestore).
  const col = db.collection('users').doc(uid).collection('workoutSessions')
  const CHUNK = 400
  let written = 0
  for (let i = 0; i < sessionPlans.length; i += CHUNK) {
    const batch = db.batch()
    const slice = sessionPlans.slice(i, i + CHUNK)
    for (const plan of slice) {
      const workout = buildWorkoutForSession(plan, perRoutineTotals)
      const ref = col.doc() // auto-id
      batch.set(ref, {
        completedAt: admin.firestore.Timestamp.fromDate(plan.date),
        workout,
      })
    }
    await batch.commit()
    written += slice.length
    console.log(`  wrote ${written}/${sessionPlans.length} workout sessions`)
  }
}

// ---------------------------------------------------------------------------
// PROMPT
// ---------------------------------------------------------------------------

function confirmProd() {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const msg =
      `\n⚠  PRODUCTION SEED — repliqe-710d2\n` +
      `\nThis will:\n` +
      `  1. DELETE the auth user '${DEMO.email}' (if it exists)\n` +
      `  2. DELETE all Firestore docs under that user's UID\n` +
      `  3. RECREATE the auth user with password '${DEMO.password}'\n` +
      `  4. Seed ~${TIMELINE_WEEKS * SESSIONS_PER_WEEK} workout sessions + programme + logs\n` +
      `\nType YES to continue, anything else to abort: `
    rl.question(msg, (answer) => {
      rl.close()
      if (answer.trim() === 'YES') resolve()
      else reject(new Error('Aborted by user'))
    })
  })
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  await confirmProd()

  admin.initializeApp({ projectId: EXPECTED_PROJECT_ID })
  const projectId = admin.app().options.projectId
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Refusing to run: expected project '${EXPECTED_PROJECT_ID}', got '${projectId}'`)
  }
  const auth = admin.auth()
  const db = admin.firestore()
  // App-side writes go through `JSON.parse(JSON.stringify(...))` which silently drops
  // undefined fields. Admin SDK is stricter — explicitly opt in to the same behaviour
  // so optional `muscle/equipment/movement` (looked up from the library at render time
  // by the app, never persisted) don't blow up the batch.
  db.settings({ ignoreUndefinedProperties: true })

  console.log(`\n→ Project: ${projectId}`)
  console.log(`→ Demo user: ${DEMO.email}\n`)

  // Step 1: delete existing user + data (idempotent reset)
  const existing = await findUserByEmail(auth, DEMO.email)
  if (existing) {
    console.log(`Existing user found (uid=${existing.uid}). Wiping...`)
    await deleteAllSubcollections(db, existing.uid)
    await auth.deleteUser(existing.uid)
    console.log(`  deleted auth user ${existing.uid}\n`)
  } else {
    console.log('No existing user found — fresh seed.\n')
  }

  // Step 2: create auth user
  console.log('Creating auth user...')
  const userRecord = await auth.createUser({
    email: DEMO.email,
    emailVerified: true,
    password: DEMO.password,
    displayName: DEMO.displayName,
    disabled: false,
  })
  const uid = userRecord.uid
  console.log(`  created uid=${uid}\n`)

  // Step 3: user doc
  console.log('Writing user doc...')
  await writeUserDoc(db, uid)

  // Step 4: programme + routines
  console.log('\nWriting programme...')
  const programme = buildProgramme()

  // Step 5: generate session plans (needed before we can finalise programme.currentIndex)
  console.log('Generating workout sessions...')
  const today = new Date()
  const { plans: sessionPlans, perRoutineCount } = generateSessionPlans(today)
  console.log(`  ${sessionPlans.length} sessions across ${TIMELINE_WEEKS} weeks (target ${TIMELINE_WEEKS * SESSIONS_PER_WEEK})`)

  // Set currentIndex to point at the routine AFTER the last completed one
  // so "Up Next" on the Start screen makes sense the moment the demo loads.
  if (sessionPlans.length > 0) {
    const lastRoutineId = sessionPlans[sessionPlans.length - 1].routine.id
    const lastIdx = programme.routineIds.indexOf(lastRoutineId)
    programme.currentIndex = (lastIdx + 1) % programme.routineIds.length
  }
  await writeWorkoutPlan(db, uid, programme)

  // Step 6: write the sessions
  await writeWorkoutSessions(db, uid, sessionPlans, perRoutineCount)

  // Step 7: app data (logs, photos, muscleLastWorked)
  console.log('\nWriting app data (logs, photo placeholders)...')
  const weightLog = buildWeightLog(today)
  const measurementsLog = buildMeasurementsLog(today)
  const photoSessions = buildPhotoSessions(today)
  const muscleLastWorked = buildMuscleLastWorked(sessionPlans)
  await writeAppData(db, uid, weightLog, measurementsLog, photoSessions, muscleLastWorked)

  console.log('\n✓ Done.')
  console.log(`\n  Login: ${DEMO.email} / ${DEMO.password}`)
  console.log(`  UID:   ${uid}`)
  console.log(`  Plan:  ${DEMO.plan}`)
  console.log(`\n  Photo placeholders are set for 3 dates — upload 9 photos`)
  console.log(`  (front/side/back × 3) via the app's Progress > Photos UI.\n`)
}

main().catch((err) => {
  console.error('\n✗ Seed failed:', err && err.stack ? err.stack : err)
  process.exit(1)
})
