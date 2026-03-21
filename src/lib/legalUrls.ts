/** Override in `.env`: VITE_PRIVACY_POLICY_URL=https://... */
export const PRIVACY_POLICY_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRIVACY_POLICY_URL) ||
  'https://repliqe.com/privacy'
