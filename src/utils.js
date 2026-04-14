import { getExerciseSlugs } from './exerciseLibrary'

// ─── Per-muscle recovery windows (hours) ─────────────────────────────────────
export const MUSCLE_RECOVERY_HOURS = {
  chest: 48, 'front-delts': 48, triceps: 36,
  back: 60, lats: 60, traps: 36, 'lower-back': 72,
  biceps: 36, forearms: 24,
  'side-delts': 36, 'rear-delts': 36,
  quads: 72, hamstrings: 60, glutes: 60, calves: 24,
  abs: 24, obliques: 24,
}

/** Format muscle slug for display: "front-delts" → "Front delts", "lower-back" → "Lower back" */
export function formatMuscleLabel(slug) {
  if (!slug || typeof slug !== 'string') return slug
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Colour map shared by RecoveryModal bars and muscle tag pills ─────────────
export const MUSCLE_COLOURS_HEX = {
  chest: '#ff6b6b', 'front-delts': '#ff6b6b', triceps: '#ff6b6b',
  back: '#7b7fff', lats: '#7b7fff', traps: '#7b7fff', 'lower-back': '#7b7fff',
  biceps: '#00e5a0', forearms: '#00e5a0',
  'rear-delts': '#ffaa50', 'side-delts': '#ffaa50',
  quads: '#5bc8ff', hamstrings: '#5bc8ff', glutes: '#5bc8ff', calves: '#5bc8ff',
  abs: '#ffc850', obliques: '#ffc850',
}

/**
 * Recovery % (0–100) for a single muscle slug. Uses per-muscle window from MUSCLE_RECOVERY_HOURS.
 * @param {string} slug - e.g. 'back'
 * @param {string|null} lastWorkedAt - ISO timestamp or null
 * @returns {number} 0–100
 */
export function getMuscleRecoveryPct(slug, lastWorkedAt) {
  if (!lastWorkedAt) return 100
  const windowMs = (MUSCLE_RECOVERY_HOURS[slug] ?? 48) * 3_600_000
  const elapsed = Date.now() - new Date(lastWorkedAt).getTime()
  return Math.min(Math.round((elapsed / windowMs) * 100), 100)
}

/**
 * Overall recovery % for a workout day. Simple average across primary muscles only.
 * @param {{ primary: string[], secondary: string[] }} muscles
 * @param {Record<string, string|null>} muscleLastWorked
 * @returns {number} 0–100
 */
export function getRecoveryPct(muscles, muscleLastWorked) {
  const primary = muscles?.primary ?? []
  if (primary.length === 0) return 100
  const total = primary.reduce((sum, slug) => sum + getMuscleRecoveryPct(slug, muscleLastWorked?.[slug] ?? null), 0)
  return Math.round(total / primary.length)
}

/**
 * Human-readable elapsed time since last trained.
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatHoursAgo(isoString) {
  if (!isoString) return 'Never'
  const h = Math.floor((Date.now() - new Date(isoString).getTime()) / 3_600_000)
  if (h < 1) return 'Just now'
  if (h < 48) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Returns primary (and secondary) muscle groups for display — 8 groups from `muscle` field.
 * Used for MuscleMapCard when showing by group.
 */
export function getDayMuscles(exercises = [], library = []) {
  const primary = []
  const seen = new Set()
  for (const ex of exercises) {
    const name = ex.exerciseId || ex.name
    const lib = library.find((e) => e.name === name)
    const muscle = lib?.muscle
    if (muscle && !seen.has(muscle)) {
      seen.add(muscle)
      primary.push(muscle)
    }
  }
  return { primary, secondary: [] }
}

/**
 * Derives { primary, secondary } muscle slugs for a day from exercise list.
 * Secondary only includes slugs not already in primary.
 */
export function getDayMusclesSlugs(exercises = [], library = []) {
  const primary = new Set()
  const secondary = new Set()
  for (const ex of exercises) {
    const name = ex.exerciseId || ex.name
    const lib = library.find((e) => e.name === name)
    const m = lib?.muscles
    if (!m) continue
    ;(m.primary || []).forEach((s) => primary.add(s))
    ;(m.secondary || []).forEach((s) => {
      if (!primary.has(s)) secondary.add(s)
    })
  }
  return { primary: [...primary], secondary: [...secondary] }
}

/**
 * Format a number for display with the chosen decimal separator.
 * @param {number|null|undefined} n - Value to format
 * @param {'comma'|'period'} separator - User preference
 * @param {number} [decimals] - Fixed decimal places (optional; otherwise integers show no decimals)
 * @returns {string} e.g. "72,5" or "72.5" or "80"
 */
export function formatDecimal(n, separator, decimals) {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  const sep = separator === 'period' ? 'period' : 'comma'
  const num = Number(n)
  if (decimals !== undefined) {
    const s = num.toFixed(decimals)
    return sep === 'comma' ? s.replace('.', ',') : s
  }
  if (Number.isInteger(num)) return String(num)
  const s = num.toString()
  return sep === 'comma' ? s.replace('.', ',') : s
}

/**
 * Parse user input to a number. Accepts both comma and period as decimal separator.
 * @param {string} str - User input
 * @returns {number} Parsed number or NaN
 */
export function parseDecimal(str) {
  if (str === '' || str === null || str === undefined) return NaN
  const normalized = String(str).trim().replace(',', '.')
  return parseFloat(normalized)
}
