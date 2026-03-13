/**
 * Returns primary and secondary muscle groups for a list of exercises (e.g. a day's routine).
 * Each exercise is looked up in the library by exerciseId to get its muscle; we don't have
 * primary/secondary per exercise so all unique muscles are returned as primary.
 */
export function getDayMuscles(exercises = [], library = []) {
  const primary = []
  const seen = new Set()
  for (const ex of exercises) {
    const name = ex.exerciseId || ex.name
    const lib = library.find((e) => e.name === name)
    const muscle = lib?.muscle
    if (muscle && !seen.has(muscle)) {
      seen.add(muscle)
      primary.push(muscle)
    }
  }
  return { primary, secondary: [] }
}
