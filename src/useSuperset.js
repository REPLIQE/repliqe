import { useState } from 'react'

export function useSuperset(exercises, setExercises) {
  const [linkMode, setLinkMode] = useState({
    active: false,
    sourceId: null
  })

  function startLinkMode(exerciseId) {
    setLinkMode({ active: true, sourceId: exerciseId })
  }

  function confirmSuperset(bId, onCreated) {
    const groupId = crypto.randomUUID()
    setExercises(prev => {
      const updated = prev.map(ex => {
        if (ex.id === linkMode.sourceId) {
          return { ...ex, supersetGroupId: groupId, supersetRole: 'A', restOverride: null }
        }
        if (ex.id === bId) return { ...ex, supersetGroupId: groupId, supersetRole: 'B' }
        return ex
      })
      const bItem = updated.find(e => e.id === bId)
      const without = updated.filter(e => e.id !== bId)
      const aIndex = without.findIndex(e => e.id === linkMode.sourceId)
      without.splice(aIndex + 1, 0, bItem)
      return without
    })
    setLinkMode({ active: false, sourceId: null })
    if (typeof onCreated === 'function') {
      setTimeout(() => onCreated(groupId), 0)
    }
  }

  function cancelLinkMode() {
    setLinkMode({ active: false, sourceId: null })
  }

  function breakSuperset(groupId) {
    setExercises(prev =>
      prev.map(ex =>
        ex.supersetGroupId === groupId ? { ...ex, supersetGroupId: null, supersetRole: null } : ex
      )
    )
  }

  function getGrouped() {
    const result = []
    const seen = new Set()
    for (const ex of exercises) {
      if (ex.supersetGroupId && !seen.has(ex.supersetGroupId)) {
        const a = exercises.find(e => e.supersetGroupId === ex.supersetGroupId && e.supersetRole === 'A')
        const b = exercises.find(e => e.supersetGroupId === ex.supersetGroupId && e.supersetRole === 'B')
        if (a && b) {
          result.push({ type: 'superset', groupId: ex.supersetGroupId, a, b })
          seen.add(ex.supersetGroupId)
        }
      } else if (!ex.supersetGroupId) {
        result.push({ type: 'exercise', exercise: ex })
      }
    }
    return result
  }

  return {
    linkMode,
    startLinkMode,
    confirmSuperset,
    cancelLinkMode,
    breakSuperset,
    getGrouped
  }
}
