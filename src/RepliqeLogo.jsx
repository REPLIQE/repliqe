export default function RepliqeLogo({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={['shrink-0', className].filter(Boolean).join(' ')}>
      <rect x="8" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9" />
      <rect x="54" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9" />
      <rect x="8" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7" />
      <rect x="54" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7" />
      <rect x="8" y="69" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.5" />
      <rect x="54" y="69" width="38" height="26" rx="8" fill="#5BF5A0" opacity="0.9" />
    </svg>
  )
}

/** Repliqe mark with squares lighting in sequence (one full round per animation cycle). */
export function RepliqeLogoBuilding({ size = 88 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0 repliqe-logo-building"
      aria-hidden
    >
      <rect x="8" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9" />
      <rect x="54" y="5" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.9" />
      <rect x="8" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7" />
      <rect x="54" y="37" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.7" />
      <rect x="8" y="69" width="38" height="26" rx="8" fill="#7B7BFF" opacity="0.5" />
      <rect x="54" y="69" width="38" height="26" rx="8" fill="#5BF5A0" opacity="0.9" />
    </svg>
  )
}
