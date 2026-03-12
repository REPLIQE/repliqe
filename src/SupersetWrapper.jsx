export default function SupersetWrapper({ groupId, exerciseA, exerciseB, nextSetInfo = null, renderCard, onBreak }) {
  const supersetPropsA = {
    supersetIsNext: nextSetInfo?.nextIsA === true,
    supersetNextSetIndex: nextSetInfo?.nextIsA === true ? nextSetInfo.nextSetIndex : null
  }
  const supersetPropsB = {
    supersetIsNext: nextSetInfo?.nextIsA === false,
    supersetNextSetIndex: nextSetInfo?.nextIsA === false ? nextSetInfo.nextSetIndex : null
  }
  return (
    <div id={groupId ? `superset-${groupId}` : undefined} className="relative mb-2 rounded-r-2xl border-l-4 border-accent/70">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold uppercase tracking-wide w-fit"
          style={{
            background: 'rgba(123,123,255,0.1)',
            borderColor: 'rgba(123,123,255,0.25)',
            color: 'var(--accent-primary)'
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3 stroke-current">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          Superset
        </div>
      </div>
      <div>
        {renderCard(exerciseA, 'A', supersetPropsA)}
      </div>
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px bg-border" />
        <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0" title="Superset – switch between A and B">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" className="w-3 h-3 stroke-accent">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </div>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="superset-card-enter">
        {renderCard(exerciseB, 'B', supersetPropsB)}
      </div>
    </div>
  )
}
