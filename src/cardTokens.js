/**
 * Top 10 #5 — Én fælles “card”-flade: radius, border, baggrund (+ valgfri hover).
 * Importer og sæt sammen med padding fra `spacingTokens.js` (fx `CARD_PADDING`).
 */

import { MOTION_TRANSITION_COLORS } from './motionTokens'

/** Standard indholdskort (Progress, Plan-lignende flader) */
export const CARD_SURFACE = 'rounded-[14px] border border-border bg-card'

/** Klikbart kort / række */
export const CARD_SURFACE_INTERACTIVE = `${CARD_SURFACE} ${MOTION_TRANSITION_COLORS} hover:border-accent/30`

/** Kompakt række inde i lister (bevarer eksisterende visuelle mål) */
export const CARD_ROW_PAD = 'p-[13px_14px]'

/** Lidt tættere vertikal kompakt variant */
export const CARD_ROW_PAD_TIGHT = 'p-[13px_12px]'

/** Store sektioner (profil, pricing, store callouts) */
export const CARD_SURFACE_LG = 'rounded-2xl border border-border bg-card'

/** Små fliser (tal, kompakte felter) */
export const CARD_SURFACE_SM = 'rounded-[12px] border border-border bg-card'

/** Mellem (fx workout complete stats) */
export const CARD_SURFACE_MD = 'rounded-xl border border-border bg-card'
