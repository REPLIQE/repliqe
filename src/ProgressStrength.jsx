import { useState, useMemo, useEffect } from 'react'
import { getTopMovers, getTrainedExercises, getRecentlyTrainedExercises, getE1RMHistory, getBestE1RM } from './progressUtils'

const PERIODS = ['4W', '3M', '6M', '1Y', 'All']

export default function ProgressStrength({ history, unitWeight, formatDecimal, formatDateForDisplay }) {
  const fmt = formatDecimal ?? ((n) => (n != null && n !== '' ? String(n) : '—'))
  const [period, setPeriod] = useState('6M')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [showAllExercises, setShowAllExercises] = useState(false)

  const safeHistory = Array.isArray(history) ? history : []
  const movers = useMemo(() => getTopMovers(safeHistory, 3), [safeHistory])
  const trained = useMemo(() => getTrainedExercises(safeHistory), [safeHistory])
  const recentExercises = useMemo(() => getRecentlyTrainedExercises(safeHistory, 12), [safeHistory])

  useEffect(() => {
    if (recentExercises.length > 0 && selected === null) {
      setSelected(recentExercises[0])
    }
  }, [recentExercises, selected])

  const filtered = search ? trained.filter((n) => n.toLowerCase().includes(search.toLowerCase())) : []

  function filterByPeriod(points) {
    if (period === 'All') return points
    const now = Date.now()
    const MS = { '4W': 28, '3M': 90, '6M': 180, '1Y': 365 }[period] * 86400000
    return points.filter((p) => now - p.date.getTime() <= MS)
  }

  const e1rmHistory = selected ? filterByPeriod(getE1RMHistory(selected, safeHistory)) : []
  const allTimePR = selected ? getBestE1RM(selected, safeHistory) : null

  const lastSession = selected
    ? (() => {
        for (const w of safeHistory) {
          const ex = (w.exercises || []).find((e) => e.name === selected)
          if (!ex) continue
          const doneSets = (ex.sets || []).filter((s) => s.done === true && s.kg != null && s.reps != null)
          if (!doneSets.length) continue
          return { date: w.date, sets: doneSets }
        }
        return null
      })()
    : null

  const lastSetRir = lastSession?.sets?.length ? lastSession.sets[lastSession.sets.length - 1]?.rir : null

  const chartMax = e1rmHistory.length ? Math.max(...e1rmHistory.map((p) => p.e1rm)) : 0

  return (
    <div className="-mt-4">
      <div className="sec">Top movers</div>
      {movers.length === 0 && (
        <div className="text-sm text-muted italic mb-4">Train each exercise at least 2 times to see top movers</div>
      )}
      {movers.map((m) => (
        <button
          key={m.name}
          onClick={() => {
            setSelected(m.name)
            setSearch('')
          }}
          className="w-full bg-card border border-border rounded-[14px] p-[13px_14px] mb-[6px] flex items-center justify-between text-left"
        >
          <div>
            <div className="text-[14px] font-bold text-text">{m.name}</div>
            <div className="text-[10px] text-muted mt-0.5">
              {m.prevE1RM} → {m.currentE1RM} {unitWeight} est. max
            </div>
          </div>
          <div className={`rounded-[6px] px-[10px] py-[4px] text-[12px] font-extrabold ${
            m.pct > 0 ? 'bg-[rgba(91,245,160,0.09)] border border-[rgba(91,245,160,0.2)] text-success' : 'bg-card-alt border border-border text-muted'
          }`}>
            {m.pct > 0 ? `↑ +${m.pct}%` : m.pct < 0 ? `↓ ${m.pct}%` : '—'}
          </div>
        </button>
      ))}

      <div className="sec">Exercise deep-dive</div>
      <div className="bg-card border border-border rounded-[12px] p-[11px_14px] flex items-center gap-[9px] mb-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-muted shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setSelected(null)
          }}
          placeholder="Search your exercises..."
          className="bg-transparent text-[13px] text-text placeholder-muted outline-none flex-1 font-medium"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-muted text-sm">
            ✕
          </button>
        )}
      </div>

      {recentExercises.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold text-muted uppercase tracking-[0.5px] mb-2">Recent</div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1" style={{ scrollbarWidth: 'none' }}>
            {recentExercises.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setSelected(name)
                  setSearch('')
                  setShowAllExercises(false)
                }}
                className={`shrink-0 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                  selected === name
                    ? 'bg-accent text-on-accent shadow-lg shadow-accent/20'
                    : 'bg-card border border-border text-text hover:border-accent/50'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setShowAllExercises((v) => !v)}
          className="flex-1 py-2.5 rounded-xl border border-dashed border-border-strong text-[12px] font-semibold text-muted-strong hover:border-accent/50 hover:text-accent transition-colors"
        >
          {showAllExercises ? 'Hide all exercises' : `All exercises (${trained.length})`}
        </button>
      </div>

      {showAllExercises && (
        <div className="bg-card border border-border rounded-[12px] mb-3 overflow-hidden max-h-[220px] overflow-y-auto">
          {trained.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSelected(name)
                setSearch('')
                setShowAllExercises(false)
              }}
              className={`w-full px-4 py-3 text-left text-[13px] font-semibold border-b border-border last:border-0 transition-colors ${
                selected === name ? 'bg-accent/10 text-accent border-accent/20' : 'text-text hover:bg-card-alt'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {search && filtered.length > 0 && (
        <div className="bg-card border border-border rounded-[12px] mb-3 overflow-hidden">
          {filtered.slice(0, 6).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSelected(name)
                setSearch('')
              }}
              className="w-full px-4 py-3 text-left text-[13px] font-semibold text-text border-b border-border last:border-0 hover:bg-card-alt"
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <>
          <div className="bg-card border border-border rounded-[14px] p-4 mb-2">
            <div className="flex justify-between items-start gap-3 mb-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold text-text truncate">{selected}</div>
                <div className="text-[11px] text-muted mt-0.5">Est. 1RM over time</div>
                <div className="text-[9px] text-muted/80 mt-0.5">
                  Estimated one-rep max from each session (from your best set that day)
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {allTimePR && (
                  <span className="text-[11px] font-bold text-success">
                    PR {allTimePR} {unitWeight}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg text-muted hover:bg-card-alt hover:text-text transition-colors"
                  aria-label="Change exercise"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            {e1rmHistory.length > 1 ? (
              <>
                <div className="flex items-end gap-1 h-[80px]">
                  {e1rmHistory.map((p, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t-[3px] min-w-0"
                      style={{
                        height: `${Math.round((p.e1rm / chartMax) * 100)}%`,
                        background:
                          i === e1rmHistory.length - 1
                            ? '#7B7BFF'
                            : `rgba(123,123,255,${0.25 + (i / e1rmHistory.length) * 0.6})`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[8px] text-muted font-semibold">
                    {formatDateForDisplay && e1rmHistory[0]?.dateStr
                      ? formatDateForDisplay(e1rmHistory[0].dateStr)
                      : e1rmHistory[0]?.date?.toLocaleDateString('en-GB', { month: 'short' })}
                  </span>
                  <span className="text-[8px] text-muted font-semibold">
                    {formatDateForDisplay && e1rmHistory[e1rmHistory.length - 1]?.dateStr
                      ? formatDateForDisplay(e1rmHistory[e1rmHistory.length - 1].dateStr)
                      : e1rmHistory[e1rmHistory.length - 1]?.date?.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted italic">Not enough data for this period</div>
            )}
          </div>

          <div className="flex gap-[3px] bg-[rgba(255,255,255,0.03)] border border-border rounded-[10px] p-[3px] mb-3">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-[6px] rounded-[7px] text-[10px] font-bold text-center ${
                  period === p ? 'bg-[rgba(123,123,255,0.15)] text-accent' : 'text-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className={`grid gap-2 mb-2 ${lastSetRir != null ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
              <div className="text-[20px] font-extrabold text-text">
                {e1rmHistory.length > 0 ? fmt(e1rmHistory[e1rmHistory.length - 1].e1rm) : '—'}
                <span className="text-[10px] text-muted ml-0.5">{unitWeight}</span>
              </div>
              <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">
                Est. max now
              </div>
              <div className="text-[8px] text-muted/80 mt-0.5">From your latest session</div>
            </div>
            <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
              <div className="text-[20px] font-extrabold text-text">
                {allTimePR != null ? fmt(allTimePR) : '—'}
                <span className="text-[10px] text-muted ml-0.5">{unitWeight}</span>
              </div>
              <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">
                All-time PR
              </div>
              <div className="text-[8px] text-muted/80 mt-0.5">Best estimated 1RM ever</div>
            </div>
            {lastSetRir != null && (
              <div className="bg-card border border-border rounded-[14px] p-[13px_12px]">
                <div className="text-[20px] font-extrabold text-text" style={{ color: '#2DD4BF' }}>
                  {lastSetRir === 3 ? '3+' : lastSetRir} RIR
                </div>
                <div className="text-[9px] font-bold text-muted uppercase tracking-[0.5px] mt-1">
                  Last set RIR
                </div>
                <div className="text-[8px] text-muted/80 mt-0.5">Reps in reserve, latest session</div>
              </div>
            )}
          </div>

          {lastSession && (
            <div className="bg-card border border-border rounded-[14px] p-[13px_14px] mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[13px] font-bold text-text">Last session</div>
                  <div className="text-[10px] text-muted mt-0.5">
                    {(formatDateForDisplay ? formatDateForDisplay(lastSession.date) : lastSession.date)} · {lastSession.sets.length} sets
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[16px] font-extrabold text-text">
                    {fmt(lastSession.sets[0].kg)} {unitWeight} × {lastSession.sets[0].reps}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
