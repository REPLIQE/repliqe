/** Shared trash icon for delete confirmations — one shape app-wide. */
export function DeleteTrashGlyph({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

/** Cirkelbaggrund som i øvrige delete-modaler (Programme, note, …) */
export function DeleteTrashBadge({ className = '' }) {
  return (
    <div
      className={`w-12 h-12 rounded-full bg-[rgba(255,85,85,0.1)] flex items-center justify-center mx-auto mb-4 text-[#FF5555] ${className}`}
    >
      <DeleteTrashGlyph className="w-6 h-6" />
    </div>
  )
}
