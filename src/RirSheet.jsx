import BottomSheet from './BottomSheet'

const RIR_THEME = { color: '#2DD4BF', bg: 'rgba(45,212,191,.14)', border: 'rgba(45,212,191,.3)' }

const RIR_OPTIONS = [
  { value: 0, label: 'Failure', sub: 'No reps left' },
  { value: 1, label: '1 rep left', sub: '' },
  { value: 2, label: '2 reps left', sub: '' },
  { value: 3, label: '3+ reps left', sub: '' },
]

export default function RirSheet({ setInfo, onSelect, onSkip }) {
  return (
    <BottomSheet onClose={onSkip} variant="card" zClass="z-50" layout="scrollable" padding="none" showHandle closeOnBackdrop backdropClassName="bg-black/60 backdrop-blur-sm" panelClassName="px-5 pt-2 pb-10">
        <div className="text-lg font-extrabold text-text mb-1">
          Set {setInfo.setNumber} — {setInfo.exerciseName}
        </div>
        <div className="text-sm text-muted mb-5">
          {setInfo.kg} kg × {setInfo.reps} reps · How close to failure?
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {RIR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl border-2 transition-all active:scale-95"
              style={{ background: RIR_THEME.bg, borderColor: RIR_THEME.border }}
            >
              <span className="text-3xl font-black" style={{ color: RIR_THEME.color }}>
                {opt.value === 3 ? '3+' : opt.value}
              </span>
              <span className="text-xs font-bold text-center leading-tight" style={{ color: RIR_THEME.color }}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-3.5 border-[1.5px] border-border-strong rounded-xl text-muted-mid text-sm font-semibold"
        >
          Skip
        </button>
    </BottomSheet>
  )
}
