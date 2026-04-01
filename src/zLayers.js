/**
 * Top 10 #3 — Z-index skala: bundmenu under, overlays over.
 *
 * Brug disse strenge i `className` / `zClass` så fuldskærms-overlays altid
 * ligger over den faste bundnavigation (`Z_NAV`).
 */
export const Z_NAV = 'z-30'

/** Standard modal / bottom sheet (over nav) */
export const Z_OVERLAY = 'z-50'

/** Ekstra lag ovenpå et åbent sheet (bekræftelser, nestede dialoger) */
export const Z_OVERLAY_STACKED = 'z-[100]'
