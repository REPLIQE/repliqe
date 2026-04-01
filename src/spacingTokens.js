/**
 * Top 10 #4 — Spacing-system (4px-base, samme som Tailwind: n → n×4px).
 *
 * Brug disse strenge i `className` for ensartet luft på tværs af sheets, kort og lister.
 * Foretræk `gap-2|3|4`, `p-3|4|6` frem for tilfældige værdier som `p-3.5` hvor det er muligt.
 */

/** Standard horisontal “gutter” på smal app (16px) */
export const GUTTER_X = 'px-4'

/** Bund-sheet: top efter safe feel, sides 16px */
export const BOTTOM_SHEET_INSET = 'pt-3 px-4'

/** Centreret dialog: 24px → 32px fra md */
export const CENTER_SHEET_INSET = 'p-6 sm:p-8'

/** Lodret afstand mellem sektioner på en skærm */
export const SECTION_GAP = 'mb-6'

/** Mellem relaterede blokke (fx felt + hjælpetekst) */
export const BLOCK_GAP = 'mb-4'

/** Liste/kort — mellem rækker (12px) */
export const LIST_GAP = 'gap-3'

/** Indvendig padding på “kort” */
export const CARD_PADDING = 'p-4'

/** Kompakt kort (12px) */
export const CARD_PADDING_SM = 'p-3'

/** Stablede primær/sekundær handlinger i modal */
export const MODAL_STACK = 'space-y-3'

/** Når BottomSheet har padding="none": ens vandret margin mod GUTTER_X */
export const MODAL_SHEET_HEADER = `${GUTTER_X} pt-5 pb-2`
export const MODAL_SHEET_SCROLL = `${GUTTER_X} pb-4`
export const MODAL_SHEET_FOOTER = `${GUTTER_X} pb-8 pt-3`
