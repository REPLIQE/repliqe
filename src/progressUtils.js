/**
 * Epley estimated 1RM: weight × (1 + reps / 30)
 * Returns null if inputs invalid.
 */
export function calcE1RM(kg, reps) {
  const w = parseFloat(String(kg).trim().replace(',', '.'))
  const r = parseInt(reps)
  if (!w || w <= 0 || !r || r <= 0) return null
  return Math.round(w * (1 + r / 30))
}

/**
 * Returns the best e1RM across all history for a given exercise name.
 * Only weight_reps and bw_reps sets are considered; only done sets.
 */
export function getBestE1RM(exerciseName, history) {
  let best = null
  for (const w of history) {
    for (const ex of w.exercises || []) {
      if (ex.name !== exerciseName) continue
      for (const s of ex.sets || []) {
        if (!s.done) continue
        const e = calcE1RM(s.kg, s.reps)
        if (e != null && (best === null || e > best)) best = e
      }
    }
  }
  return best
}

/**
 * Returns e1RM history for a given exercise: [{ date, e1rm, dateStr }]
 * Sorted oldest → newest. date is JS Date.
 */
export function getE1RMHistory(exerciseName, history) {
  const points = []
  const list = Array.isArray(history) ? [...history].reverse() : []
  for (const w of list) {
    const ex = (w.exercises || []).find(e => e.name === exerciseName)
    if (!ex) continue
    let best = null
    for (const s of ex.sets || []) {
      if (!s.done) continue
      const e = calcE1RM(s.kg, s.reps)
      if (e != null && (best === null || e > best)) best = e
    }
    if (best === null) continue
    const parts = (w.date || '').split('/')
    if (parts.length !== 3) continue
    const date = new Date(parts[2], parts[1] - 1, parts[0])
    points.push({ date, e1rm: best, dateStr: w.date })
  }
  return points
}

/**
 * Returns exercises with biggest e1RM improvement between last two sessions.
 * Only includes exercises trained at least 2 times. Sorted by % improvement desc.
 * Returns top N movers.
 */
export function getTopMovers(history, n = 3) {
  function parseDate(dateStr) {
    const parts = (dateStr || '').split('/')
    if (parts.length !== 3) return null
    return new Date(parts[2], parts[1] - 1, parts[0])
  }

  // Per exercise: list of { date, e1rm } (best e1rm per workout), oldest first
  const byExercise = {}

  for (const w of history) {
    const d = parseDate(w.date)
    if (!d) continue
    const exercises = w.exercises || []
    for (const ex of exercises) {
      const sets = ex.sets || []
      let best = null
      for (const s of sets) {
        if (!s.done) continue
        const e = calcE1RM(s.kg, s.reps)
        if (e != null && (best === null || e > best)) best = e
      }
      if (best === null) continue
      const name = ex.name && String(ex.name).trim()
      if (!name) continue
      if (!byExercise[name]) byExercise[name] = []
      byExercise[name].push({ date: d, e1rm: best })
    }
  }

  const movers = []
  for (const [name, points] of Object.entries(byExercise)) {
    if (points.length < 2) continue
    points.sort((a, b) => a.date.getTime() - b.date.getTime())
    const current = points[points.length - 1].e1rm
    const prev = points[points.length - 2].e1rm
    if (prev <= 0) continue
    const pct = Math.round(((current - prev) / prev) * 100)
    movers.push({ name, currentE1RM: current, prevE1RM: prev, pct })
  }

  return movers.sort((a, b) => b.pct - a.pct).slice(0, n)
}

/**
 * Returns list of exercises the user has actually trained (from history),
 * sorted alphabetically. Only weight_reps and bw_reps.
 */
export function getTrainedExercises(history) {
  const seen = new Set()
  for (const w of history) {
    for (const ex of w.exercises) {
      if (ex.type === 'weight_reps' || ex.type === 'bw_reps') {
        seen.add(ex.name)
      }
    }
  }
  return [...seen].sort()
}

/**
 * Returns exercise names ordered by most recent workout (last time trained first).
 * Only weight_reps and bw_reps. Up to n names.
 */
export function getRecentlyTrainedExercises(history, n = 12) {
  const seen = new Set()
  const order = []
  const list = Array.isArray(history) ? [...history] : []
  list.sort((a, b) => {
    const pa = (a.date || '').split('/')
    const pb = (b.date || '').split('/')
    if (pa.length !== 3 || pb.length !== 3) return 0
    const da = new Date(pa[2], pa[1] - 1, pa[0]).getTime()
    const db = new Date(pb[2], pb[1] - 1, pb[0]).getTime()
    return db - da
  })
  for (const w of list) {
    for (const ex of w.exercises || []) {
      if (ex.type !== 'weight_reps' && ex.type !== 'bw_reps') continue
      const name = ex.name && String(ex.name).trim()
      if (!name || seen.has(name)) continue
      seen.add(name)
      order.push(name)
      if (order.length >= n) return order
    }
  }
  return order
}

/**
 * Returns last logged entry: { value, date } or null.
 */
export function getLatestMeasurement(entries) {
  if (!entries || entries.length === 0) return null
  return entries[entries.length - 1]
}

/**
 * Parse en-GB date string "dd/mm/yyyy" → Date
 */
export function parseGBDate(str) {
  const parts = (str || '').split('/')
  if (parts.length !== 3) return null
  return new Date(parts[2], parts[1] - 1, parts[0])
}

/**
 * Compare sessions for timeline: newest calendar day first (session.date),
 * then newest createdAt within the same day (so edited/backdated dates sort correctly).
 */
export function comparePhotoSessionsByDateDesc(a, b) {
  const dayA = parseGBDate(a?.date)?.getTime() ?? 0
  const dayB = parseGBDate(b?.date)?.getTime() ?? 0
  if (dayB !== dayA) return dayB - dayA
  const ca = a?.createdAt != null && typeof a.createdAt === 'number' ? a.createdAt : 0
  const cb = b?.createdAt != null && typeof b.createdAt === 'number' ? b.createdAt : 0
  return cb - ca
}

/**
 * Sort key for rough ordering by calendar day only (e.g. when a simple scalar is needed).
 * Prefer comparePhotoSessionsByDateDesc for full sort.
 */
export function getPhotoSessionSortKey(session) {
  const d = parseGBDate(session?.date)
  return d ? d.getTime() : 0
}

/**
 * Sort photo sessions for timeline: newest session.date first; same day → newest createdAt first.
 */
export function sortPhotoSessionsByDate(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []
  return [...sessions].sort(comparePhotoSessionsByDateDesc)
}

/**
 * From sorted-by-date sessions (newest first), return [oldest, middle, newest] for display.
 * If fewer than 3 sessions, returns all in chronological order (oldest first).
 */
export function getOldestMiddleNewestSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []
  const sorted = sortPhotoSessionsByDate(sessions)
  const asc = [...sorted].reverse()
  const n = asc.length
  if (n <= 3) return asc
  const mid = Math.floor((n - 1) / 2)
  return [asc[0], asc[mid], asc[n - 1]]
}

/**
 * Format a Date to "Mar 2026" label
 */
export function formatMonthLabel(date) {
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/**
 * Group photo sessions by month (newest month first).
 * Returns [{ monthLabel: 'Mar 2026', sessions: [...] }, ...]
 */
export function groupPhotoSessionsByMonth(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []
  const sorted = sortPhotoSessionsByDate(sessions)
  const byMonth = new Map()
  for (const s of sorted) {
    const d = parseGBDate(s?.date)
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : 'unknown'
    const label = d ? formatMonthLabel(d) : 'Unknown'
    if (!byMonth.has(key)) byMonth.set(key, { monthLabel: label, sessions: [] })
    byMonth.get(key).sessions.push(s)
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([, g]) => g)
}
