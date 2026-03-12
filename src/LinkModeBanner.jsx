export default function LinkModeBanner({ sourceName, onCancel }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-3"
      style={{
        background: 'rgba(123,123,255,0.08)',
        borderColor: 'rgba(123,123,255,0.2)'
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" className="w-4 h-4 shrink-0 stroke-accent">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
      <p className="flex-1 text-sm font-semibold text-accent/80">
        Tap an exercise to pair with <span className="text-text font-bold">{sourceName}</span>
      </p>
      <button onClick={onCancel} className="text-xs font-bold text-muted-mid hover:text-text transition-colors shrink-0">
        Cancel
      </button>
    </div>
  )
}
