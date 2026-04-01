import { useState, useEffect, useCallback, useRef } from 'react'
import RepliqeLogo from './RepliqeLogo'
import { invokeCoachGenerate, coachInvokeErrorMessage } from './lib/invokeCoachGenerate'
import { getUserDoc } from './lib/userFirestore'
import {
  listCoachConversations,
  getCoachConversation,
  createCoachConversation,
  saveCoachConversation,
  deleteCoachConversation,
} from './lib/coachConversationsFirestore'
import { mergePlanUsage, incrementPlanUsage, PLAN_LIMITS } from './lib/planUsage'

/** System instructions sent as part of the prompt (user message was truncated in spec). */
const COACH_CHAT_SYSTEM = `You are Coach, an expert AI personal trainer inside the REPLIQE app. You help users improve their programme, review progress, break plateaus, and explain exercises.

Rules:
- Be concise, specific, and encouraging. Use British English spelling where natural.
- **Health and medicine:** You are a training coach, not a clinician. Do **not** diagnose, treat, interpret symptoms, recommend medication, or give medical clearance. If the user raises illness, injury, pain, cardiovascular issues, pregnancy, eating disorders, or anything that sounds like a health problem, respond briefly with empathy, say you cannot advise on medical matters, and tell them to speak to a **doctor or qualified healthcare professional**. You may still explain general exercise technique in the abstract, but do **not** tailor training advice to their condition or suggest what is “safe” for their health issue.
- Use the CONTEXT block when it is relevant; do not invent workouts the user did not log. In CONTEXT, \`recentWorkouts\` are the only past sessions you may treat as logged — never invent, imply, or “remember” workouts, PRs, volumes, or dates that are not listed there. \`programme\` is their saved plan (targets), not proof they ran it; do not say they did a session unless it appears under \`recentWorkouts\`.
- If the user asks about history and CONTEXT has few or no \`recentWorkouts\`, say you only see what is in CONTEXT and avoid fabricating training history.
- When you recommend a programme layout, a new split, or substantive changes across their training week, ensure **all major muscle groups** are covered across those days: chest, back, shoulders, arms, legs, core (arms may be distributed, e.g. biceps on pull / triceps on push). Do **not** omit a major group by default. Exception: only if the user **explicitly** asks to exclude a specific muscle group or area (e.g. injury, “no leg work this block”) — then follow their request and say so briefly.
- If you recommend a concrete, one-tap change to their saved programme (e.g. adjust sets/reps, swap an exercise, tweak rest), append a machine-readable block at the VERY END of your message after your normal reply:

[SUGGESTION]
{"description":"Short summary the user will see","action":"adjust_volume|swap_exercise|general","exerciseName":null,"details":{}}
[/SUGGESTION]

- Put all normal coaching text BEFORE the block. The JSON must be valid. Use null for exerciseName if not applicable.
- Do not wrap the main answer in markdown code fences. Only the [SUGGESTION] block should contain JSON.`

export function parseCoachSuggestion(raw) {
  if (!raw || typeof raw !== 'string') return { displayText: '', suggestion: null }
  const re = /\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/i
  const m = raw.match(re)
  if (!m) return { displayText: raw.trim(), suggestion: null }
  let suggestion = null
  try {
    suggestion = JSON.parse(m[1].trim())
  } catch {
    /* ignore invalid JSON */
  }
  return { displayText: raw.replace(re, '').trim(), suggestion }
}

function coachChatLimit(userPlan) {
  const plan = userPlan || 'free'
  if (plan === 'elite') return { limit: PLAN_LIMITS.elite.coachMessages ?? 60 }
  if (plan === 'pro') return { limit: PLAN_LIMITS.pro.coachMessages ?? 20 }
  return { limit: 0 }
}

function buildContextPayload(activeProgramme, allRoutines, workoutSessions) {
  const routines = Array.isArray(allRoutines) ? allRoutines : []
  const sessions = Array.isArray(workoutSessions) ? workoutSessions : []
  let programmeSummary = null
  if (activeProgramme && typeof activeProgramme === 'object') {
    const ids = activeProgramme.routineIds || []
    const daySummaries = ids
      .map((rid) => routines.find((r) => r.id === rid))
      .filter(Boolean)
      .map((r) => ({
        name: r.name,
        exercises: (r.exercises || []).map((ex) => ex.exerciseId || ex.name).filter(Boolean),
      }))
    programmeSummary = {
      id: activeProgramme.id,
      name: activeProgramme.name,
      type: activeProgramme.type,
      days: daySummaries,
    }
  }
  const recent = sessions.slice(0, 12).map((s) => ({
    date: s.date,
    name: s.name,
    durationMin: s.duration != null ? Math.round(Number(s.duration) / 60) : null,
    exerciseNames: (s.exercises || []).map((e) => e.name || e.exerciseId).filter(Boolean).slice(0, 12),
  }))
  return { programme: programmeSummary, recentWorkouts: recent }
}

function titleFromMessage(text) {
  const t = (text || '').trim().replace(/\s+/g, ' ')
  if (!t) return 'New conversation'
  return t.length > 40 ? `${t.slice(0, 37)}…` : t
}

/**
 * Coach tab: home (overview + conversations) and chat (active thread).
 */
export default function CoachScreen({
  userId,
  userPlan,
  activeProgramme,
  allRoutines,
  workoutSessions,
  onApplyProgrammeChange,
  onShowPricing,
}) {
  const [view, setView] = useState('home')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConversationId, setActiveConversationId] = useState(null)
  const [planUsage, setPlanUsage] = useState(() => mergePlanUsage(null))
  const [loadingConversations, setLoadingConversations] = useState(true)
  const listRef = useRef(null)

  const { limit: msgLimit } = coachChatLimit(userPlan || 'free')
  const used = planUsage.coachGenerations ?? 0
  const outOfCredits = msgLimit != null && used >= msgLimit
  const chatLocked = userPlan === 'free' || outOfCredits
  /** Pro + Elite: show usage graphic (free has limit 0). */
  const showUsageMeter = msgLimit != null && msgLimit > 0
  const usedPct = showUsageMeter ? Math.min(100, (used / msgLimit) * 100) : 0

  const refreshPlanUsage = useCallback(async () => {
    if (!userId) return
    try {
      const data = await getUserDoc(userId)
      setPlanUsage(mergePlanUsage(data?.planUsage))
    } catch {
      /* ignore */
    }
  }, [userId])

  const loadConversations = useCallback(async () => {
    if (!userId) return
    setLoadingConversations(true)
    try {
      const list = await listCoachConversations(userId, 10)
      setConversations(list)
    } catch (e) {
      console.error('listCoachConversations', e)
    } finally {
      setLoadingConversations(false)
    }
  }, [userId])

  useEffect(() => {
    refreshPlanUsage()
  }, [refreshPlanUsage])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (view !== 'chat' || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, view, loading])

  async function persistMessages(conversationId, nextMessages, firstUserText) {
    if (!userId || !conversationId) return
    const stored = nextMessages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'coach',
      text: m.text,
      timestamp: typeof m.ts === 'number' ? m.ts : Date.now(),
    }))
    const title = firstUserText ? titleFromMessage(firstUserText) : undefined
    await saveCoachConversation(userId, conversationId, {
      ...(title ? { title } : {}),
      messages: stored,
    })
    loadConversations()
  }

  function startChatWithSeed(seed) {
    setInput(seed)
    setView('chat')
    setMessages([])
    setActiveConversationId(null)
    setError(null)
  }

  /** Open blank chat only in UI — Firestore doc is created on first sent message (avoids empty threads in list). */
  function handleNewConversation() {
    if (!userId) return
    setError(null)
    setActiveConversationId(null)
    setMessages([])
    setInput('')
    setView('chat')
  }

  async function openConversation(id) {
    if (!userId) return
    setError(null)
    try {
      const conv = await getCoachConversation(userId, id)
      if (!conv) return
      setActiveConversationId(id)
      const ui = (conv.messages || []).map((m, i) => {
        const text = m.text || ''
        if (m.role === 'coach') {
          const { displayText, suggestion } = parseCoachSuggestion(text)
          return {
            id: `m-${i}-${m.timestamp}`,
            role: 'coach',
            text: displayText,
            suggestion,
            ts: m.timestamp,
          }
        }
        return { id: `m-${i}-${m.timestamp}`, role: 'user', text, ts: m.timestamp }
      })
      setMessages(ui)
      setView('chat')
    } catch (e) {
      console.error(e)
      setError('Could not open conversation.')
    }
  }

  /** Leave chat; remove empty Firestore thread (e.g. "+ New conversation" with no messages sent). */
  async function cancelChatOrGoHome() {
    setError(null)
    const id = activeConversationId
    const isEmpty = messages.length === 0
    if (userId && id && isEmpty) {
      try {
        await deleteCoachConversation(userId, id)
        loadConversations()
      } catch (e) {
        console.error('deleteCoachConversation', e)
        setError('Could not cancel conversation. Try again.')
        return
      }
    }
    setView('home')
    setActiveConversationId(null)
    setMessages([])
    setInput('')
  }

  async function sendMessage(overrideText) {
    const text = (overrideText != null ? overrideText : input).trim()
    if (!text || loading) return
    if (chatLocked) {
      onShowPricing?.()
      return
    }

    const prevMessages = messages

    let convId = activeConversationId
    if (!convId) {
      try {
        convId = await createCoachConversation(userId)
        setActiveConversationId(convId)
      } catch (e) {
        console.error(e)
        setError('Could not create conversation.')
        return
      }
    }

    const userMsg = { id: crypto.randomUUID(), role: 'user', text, ts: Date.now() }
    const nextAfterUser = [...messages, userMsg]
    setMessages(nextAfterUser)
    setInput('')
    setLoading(true)
    setError(null)

    const context = buildContextPayload(activeProgramme, allRoutines, workoutSessions)
    const transcript = nextAfterUser
      .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.text}`)
      .join('\n\n')

    const prompt = `${COACH_CHAT_SYSTEM}

Remember: only \`recentWorkouts\` in CONTEXT are logged sessions — do not invent others. Do not discuss or advise on medical/health problems — redirect to a qualified professional.

CONTEXT (JSON):
${JSON.stringify(context)}

CONVERSATION:
${transcript}

Coach (reply as Coach; remember [SUGGESTION] rules only when appropriate):`

    try {
      const raw = await invokeCoachGenerate(prompt)

      const { displayText, suggestion } = parseCoachSuggestion(raw)
      const coachMsg = {
        id: crypto.randomUUID(),
        role: 'coach',
        text: displayText,
        suggestion,
        ts: Date.now(),
      }
      const finalMsgs = [...nextAfterUser, coachMsg]
      setMessages(finalMsgs)

      try {
        await incrementPlanUsage(userId, { coachGenerations: 1 })
        await refreshPlanUsage()
      } catch (usageErr) {
        console.error('Coach planUsage increment', usageErr)
      }

      const isFirstUserTurn = nextAfterUser.filter((m) => m.role === 'user').length === 1
      try {
        await persistMessages(convId, finalMsgs, isFirstUserTurn ? text : undefined)
      } catch (persistErr) {
        console.error('Coach persistMessages', persistErr)
        setError('Reply received but could not save the conversation. Check your connection.')
      }
    } catch (e) {
      console.error('Coach chat', e)
      setError(coachInvokeErrorMessage(e))
      setMessages(prevMessages)
    } finally {
      setLoading(false)
    }
  }

  function dismissSuggestion(id) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, suggestion: null } : m)))
  }

  async function applySuggestion(msg) {
    if (!msg?.suggestion) return
    try {
      await onApplyProgrammeChange?.(msg.suggestion)
    } finally {
      dismissSuggestion(msg.id)
    }
  }

  function UsageMeter({ compact = false }) {
    if (!showUsageMeter) return null
    const barH = compact ? 'h-2' : 'h-2.5'
    return (
      <div
        className={compact ? 'space-y-1.5' : 'space-y-2'}
        role="group"
        aria-label={`Coach messages this month: ${used} of ${msgLimit} used`}
      >
        <div
          className={`flex justify-between items-baseline gap-2 ${compact ? 'text-[10px]' : 'text-xs'} text-muted-strong`}
        >
          <span className="shrink-0">Coach messages · this month</span>
          <span className="font-bold text-text tabular-nums shrink-0">
            {used} / {msgLimit} used
          </span>
        </div>
        <div
          className={`w-full ${barH} rounded-full bg-card border border-border overflow-hidden`}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={msgLimit}
          aria-label="Share of coach messages used"
        >
          <div
            className={`${barH} rounded-full bg-gradient-to-r from-accent to-accent-end transition-[width] duration-500 ease-out min-w-0`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>
    )
  }

  const quickActions = [
    { label: 'Improve my programme', seed: 'Help me improve my current training programme based on my goals and equipment.' },
    { label: 'Review my progress', seed: 'Review my recent training and tell me what is working and what to adjust next.' },
    { label: 'Break a plateau', seed: 'I feel stuck on my lifts. What should I change to break a plateau?' },
    { label: 'Explain an exercise', seed: 'Explain how to perform one exercise from my programme with good form and common mistakes to avoid.' },
  ]

  if (!userId) {
    return (
      <div className="px-1 py-4 text-sm text-muted-strong text-center">
        Sign in to use Coach.
      </div>
    )
  }

  if (view === 'home') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <RepliqeLogo size={28} />
          <h1 className="text-3xl font-bold tracking-tight text-text min-w-0">Coach</h1>
        </div>

        <p className="text-sm text-muted-strong leading-relaxed">
          Ask questions about your programme, progress, and technique. Coach uses your active programme and recent sessions when relevant.
        </p>

        {showUsageMeter && (
          <div className="rounded-xl border border-border bg-card-alt px-3 py-3">
            <UsageMeter />
          </div>
        )}

        {chatLocked && (
          <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
            <p className="text-sm font-semibold text-text mb-1">Upgrade to send more messages</p>
            <p className="text-xs text-muted-strong mb-3">
              {userPlan === 'free'
                ? 'Coach chat is available on Pro and Elite plans.'
                : 'You have used your Coach messages for this month.'}
            </p>
            <button
              type="button"
              onClick={() => onShowPricing?.()}
              className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25"
            >
              View plans
            </button>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-muted-strong uppercase tracking-wider mb-2">Quick actions</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {quickActions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={chatLocked}
                onClick={() => startChatWithSeed(a.seed)}
                className="shrink-0 px-3 py-2 rounded-xl text-xs font-bold border border-border-strong bg-card text-text hover:border-accent/40 hover:bg-card-alt transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleNewConversation}
          disabled={chatLocked}
          className="w-full py-3 rounded-xl text-sm font-bold border-2 border-dashed border-accent/35 text-accent bg-accent/5 hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          + New conversation
        </button>

        <div>
          <p className="text-[10px] font-bold text-muted-strong uppercase tracking-wider mb-2">Recent conversations</p>
          {loadingConversations ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-strong">No conversations yet.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(c.id)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-accent/30 transition-colors"
                  >
                    <span className="text-sm font-semibold text-text line-clamp-2">{c.title}</span>
                    <span className="text-[10px] text-muted block mt-0.5">
                      {(c.messages?.length ?? 0)} messages
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <p className="text-sm font-semibold text-muted-strong">{error}</p>}
      </div>
    )
  }

  /* chat view */
  return (
    <div className="flex flex-col min-h-[60vh] max-h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <button
          type="button"
          onClick={() => cancelChatOrGoHome()}
          className="p-2 rounded-lg text-muted-strong hover:bg-card-alt border border-transparent hover:border-border transition-colors shrink-0"
          aria-label="Back to Coach home"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-text truncate min-w-0 flex-1">Chat</h2>
      </div>

      {showUsageMeter && (
        <div className="mb-2 shrink-0 rounded-xl border border-border bg-card-alt px-2.5 py-2">
          <UsageMeter compact />
        </div>
      )}

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3 min-h-[200px]"
      >
        {messages.length === 0 && !loading && (
          <p className="text-sm text-muted-strong text-center py-8">Type a message below or use quick actions from home.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-accent/20 border border-accent/25 text-text'
                  : 'bg-card border border-border text-text'
              }`}
            >
              {m.text || '…'}
            </div>
            {m.role === 'coach' && m.suggestion && (
              <div className="mt-2 w-full max-w-[90%] rounded-xl border border-accent/25 bg-card p-3">
                <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Suggested change</p>
                <p className="text-xs text-muted-strong mb-3">{m.suggestion.description || 'Apply this update to your programme.'}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => applySuggestion(m)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold border border-accent bg-accent/10 text-accent"
                  >
                    Apply to programme
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissSuggestion(m.id)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold bg-card-alt border border-border text-muted"
                  >
                    Not now
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm font-semibold text-muted-strong mb-2 shrink-0">{error}</p>}

      <div className="flex gap-2 shrink-0 pt-2 border-t border-border">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={chatLocked ? 'Upgrade to chat…' : 'Message Coach…'}
          disabled={loading || chatLocked}
          className="flex-1 min-w-0 bg-card-alt border border-border-strong rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-muted outline-none focus:border-accent disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => sendMessage()}
          disabled={loading || chatLocked || !input.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-accent to-accent-end text-on-accent shadow-lg shadow-accent/25 disabled:opacity-40 disabled:pointer-events-none"
        >
          Send
        </button>
      </div>
    </div>
  )
}
