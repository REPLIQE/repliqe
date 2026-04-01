/**
 * Top 10 #9 — Bevægelse / transition
 * Varighed og easing styres af `index.css` (`--motion-duration`, `--motion-ease`, …).
 */

/** Brug med `transition-colors`, `transition-opacity`, … */
export const MOTION_DURATION = 'duration-[var(--motion-duration)]'

export const MOTION_EASE = '[transition-timing-function:var(--motion-ease)]'

/** Standard UI-hover (kort) */
export const MOTION_TRANSITION_COLORS = `transition-colors ${MOTION_DURATION} ${MOTION_EASE}`

/** Knapper m.m. med opacity/transform */
export const MOTION_TRANSITION_INTERACTIVE = `transition-[opacity,transform,colors] ${MOTION_DURATION} ${MOTION_EASE}`
