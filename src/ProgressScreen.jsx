import { useState } from 'react'
import RepliqeLogo from './RepliqeLogo'
import ProgressOverview from './ProgressOverview'
import ProgressStrength from './ProgressStrength'
import ProgressBody from './ProgressBody'
import ProgressRecovery from './ProgressRecovery'

const TABS = ['Overview', 'Strength', 'Body', 'Recovery']

export default function ProgressScreen(props) {
  const [tab, setTab] = useState('Overview')

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <RepliqeLogo size={28} />
        <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
      </div>

      <div className="flex rounded-[10px] p-[3px] mb-5 border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-center rounded-lg text-[11px] font-bold transition-all ${
              tab === t
                ? 'bg-accent text-on-accent shadow-lg shadow-accent/25'
                : 'text-muted-strong'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <ProgressOverview {...props} onGoToBody={() => setTab('Body')} />}
      {tab === 'Strength' && <ProgressStrength {...props} />}
      {tab === 'Body' && <ProgressBody {...props} />}
      {tab === 'Recovery' && <ProgressRecovery {...props} />}
    </div>
  )
}
