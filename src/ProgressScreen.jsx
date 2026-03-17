import { useState, useEffect } from 'react'
import RepliqeLogo from './RepliqeLogo'
import ProgressOverview from './ProgressOverview'
import ProgressStrength from './ProgressStrength'
import ProgressBody from './ProgressBody'
import ProgressRecovery from './ProgressRecovery'

const TABS = ['Overview', 'Strength', 'Body', 'Recovery']

export default function ProgressScreen(props) {
  const [tab, setTab] = useState('Overview')
  const [scrollToPhotosSection, setScrollToPhotosSection] = useState(false)
  const [scrollRecoveryToTop, setScrollRecoveryToTop] = useState(false)

  useEffect(() => {
    if (tab === 'Recovery' && scrollRecoveryToTop) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setScrollRecoveryToTop(false)
    }
  }, [tab, scrollRecoveryToTop])

  return (
    <div>
      {/* Fixed header – always at top of viewport */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-page border-b border-border/50 max-w-md mx-auto">
        <div className="px-4 pt-3 pb-1.5">
          <div className="flex items-center gap-3 mb-2">
            <RepliqeLogo size={28} />
            <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
          </div>

          <div className="flex rounded-[10px] p-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
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
        </div>
      </div>

      {/* Spacer so content starts below fixed header */}
      <div className="h-[6rem]" aria-hidden="true" />

      <div className="mt-1">
      {tab === 'Overview' && (
        <ProgressOverview
          {...props}
          onGoToTab={(t) => {
            setTab(t)
            if (t === 'Recovery') setScrollRecoveryToTop(true)
          }}
          onGoToBody={() => {
            setTab('Body')
            setScrollToPhotosSection(true)
          }}
        />
      )}
      {tab === 'Strength' && <ProgressStrength {...props} />}
      {tab === 'Body' && (
        <ProgressBody
          {...props}
          scrollToPhotosSection={scrollToPhotosSection}
          onScrolledToPhotos={() => setScrollToPhotosSection(false)}
        />
      )}
      {tab === 'Recovery' && <ProgressRecovery {...props} />}
      </div>
    </div>
  )
}
