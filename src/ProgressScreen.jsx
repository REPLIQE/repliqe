import { useState, useEffect } from 'react'
import RepliqeLogo from './RepliqeLogo'
import ProgressOverview from './ProgressOverview'
import ProgressStrength from './ProgressStrength'
import ProgressBody from './ProgressBody'
import ProgressRecovery from './ProgressRecovery'
import { TYPE_SCREEN_TITLE, TYPE_TAB } from './typographyTokens'

const TABS = ['Overview', 'Body', 'Strength', 'Recovery']

export default function ProgressScreen(props) {
  const {
    postCompleteOpenPhoto = false,
    onConsumedOpenAddPhoto,
    returnToWorkoutAfterPhotoClose = false,
    onReturnToWorkoutAfterPhoto,
    ...restProps
  } = props
  /** Start on Body when opening from workout complete → add photo (avoids one frame of Overview). */
  const [tab, setTab] = useState(() => (postCompleteOpenPhoto ? 'Body' : 'Overview'))
  const [strengthScrollSection, setStrengthScrollSection] = useState(null)
  const [bodyScrollSection, setBodyScrollSection] = useState(null)

  useEffect(() => {
    if (postCompleteOpenPhoto) setTab('Body')
  }, [postCompleteOpenPhoto])

  return (
    <div>
      {/* Fixed header – always at top of viewport */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-page border-b border-border/50 max-w-md mx-auto">
        <div className="px-4 pt-3 pb-1.5">
          <div className="flex items-center gap-3 mb-2">
            <RepliqeLogo size={28} />
            <h1 className={TYPE_SCREEN_TITLE}>Progress</h1>
          </div>

          <div className="flex rounded-[10px] p-[3px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  setStrengthScrollSection(null)
                  setBodyScrollSection(null)
                }}
                className={`flex-1 py-2 text-center rounded-lg ${TYPE_TAB} transition-colors border ${
                  tab === t
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-transparent text-muted-strong'
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
          onGoToTab={(t, opts) => {
            setTab(t)
            if (t === 'Recovery') {
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }
            if (t === 'Strength') {
              setStrengthScrollSection(opts?.strengthSection ?? 'volume')
            }
            if (t === 'Body') {
              setBodyScrollSection(opts?.bodySection ?? 'weight')
            }
          }}
          onGoToBody={() => {
            setTab('Body')
            setBodyScrollSection('photos')
          }}
        />
      )}
      {tab === 'Strength' && (
        <ProgressStrength
          {...props}
          scrollToSection={strengthScrollSection}
          onConsumedScrollSection={() => setStrengthScrollSection(null)}
        />
      )}
      {tab === 'Body' && (
        <ProgressBody
          {...restProps}
          bodyScrollSection={bodyScrollSection}
          onConsumedBodyScroll={() => setBodyScrollSection(null)}
          openAddPhoto={postCompleteOpenPhoto}
          onConsumedOpenAddPhoto={onConsumedOpenAddPhoto}
          returnToWorkoutAfterPhotoClose={returnToWorkoutAfterPhotoClose}
          onReturnToWorkoutAfterPhoto={onReturnToWorkoutAfterPhoto}
        />
      )}
      {tab === 'Recovery' && <ProgressRecovery {...props} />}
      </div>
    </div>
  )
}
