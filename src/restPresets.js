/** Upper cap (seconds) for rest — global default, per-exercise override, Coach output. */
export const REST_MAX_SEC = 180

/** 0 = none, then 15, 30, … 180 — shared by Profile default, exercise picker, routine editor, Coach. */
export const REST_PRESETS = Object.freeze(
  Array.from({ length: REST_MAX_SEC / 15 + 1 }, (_, i) => i * 15)
)

/** Clamp to [0, REST_MAX_SEC] and round to nearest 15 s (ties: standard round). */
export function snapRestSecondsToPreset(seconds) {
  const n = Number(seconds)
  if (!Number.isFinite(n)) return 0
  const clamped = Math.max(0, Math.min(REST_MAX_SEC, n))
  const snapped = Math.round(clamped / 15) * 15
  return Math.max(0, Math.min(REST_MAX_SEC, snapped))
}
