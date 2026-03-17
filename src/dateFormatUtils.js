/**
 * Date format preference: stored dates are always dd/mm/yyyy (en-GB).
 * These helpers convert for display only; time is not shown.
 */

/** 'ddmmyyyy' | 'mmddyyyy' */
export const DATE_FORMAT_DDMY = 'ddmmyyyy'
export const DATE_FORMAT_MMDY = 'mmddyyyy'

/**
 * Format a stored date string for display.
 * @param {string} stored - Date stored as "dd/mm/yyyy"
 * @param {string} dateFormat - 'ddmmyyyy' or 'mmddyyyy'
 * @returns {string} Display string (e.g. "08/03/2026" or "03/08/2026"), or original if unparseable
 */
export function formatStoredDateForDisplay(stored, dateFormat) {
  if (!stored || typeof stored !== 'string') return stored || ''
  const parts = stored.trim().split('/')
  if (parts.length !== 3) return stored
  const [d, m, y] = parts
  if (dateFormat === DATE_FORMAT_MMDY) return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}
