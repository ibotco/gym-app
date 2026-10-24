/**
 * aSc-style lesson helpers: divisions (groups), single/double length and
 * multi-placement ("Lessons/week"). A Double lesson occupies its period and
 * the next one; two lessons clash when their slot spans overlap and they
 * share a teacher, or share a class without being different divisions.
 */

export interface LessonLike {
  id?: string
  day?: string
  period?: string
  className?: string
  teacher?: string
  group?: string
  duration?: string
}

export const DIVISIONS = ['Entire class', 'Group A', 'Group B', 'Group C']

export const nextPeriod = (periods: string[], p: string): string => {
  const i = periods.indexOf(p)
  return i >= 0 && i + 1 < periods.length ? periods[i + 1] : ''
}

/** The periods a lesson occupies (1 for Single, 2 for Double). */
export const lessonSlots = (l: LessonLike, periods: string[]): { day: string; period: string }[] => {
  if (!l.day || !l.period) return []
  const slots = [{ day: l.day, period: l.period }]
  if (l.duration === 'Double') {
    const nx = nextPeriod(periods, l.period)
    if (nx) slots.push({ day: l.day, period: nx })
  }
  return slots
}

/** True when two rows are the same class and NOT parallel divisions. */
export const sameClassBlock = (a: LessonLike, b: LessonLike): boolean => {
  if (!a.className || a.className !== b.className) return false
  const ga = a.group || 'Entire class'
  const gb = b.group || 'Entire class'
  return !(ga !== 'Entire class' && gb !== 'Entire class' && ga !== gb)
}

export const lessonsClash = (a: LessonLike, b: LessonLike, periods: string[]): boolean => {
  if (a.id && b.id && a.id === b.id) return false
  const sa = lessonSlots(a, periods)
  const sb = lessonSlots(b, periods)
  if (!sa.some((x) => sb.some((y) => x.day === y.day && x.period === y.period))) return false
  if (a.teacher && a.teacher === b.teacher) return true
  return sameClassBlock(a, b)
}

/**
 * Find `count` start slots for a new lesson (teacher/class/division/duration)
 * that clash with nothing, respect time-off and room availability.
 */
export function findStartSlots(
  existing: LessonLike[],
  days: string[],
  periods: string[],
  job: LessonLike,
  count: number,
  roomFor: (day: string, period: string) => string,
  roomFree: (room: string, day: string, period: string) => boolean,
  blocked: (who: 'teacher' | 'class', name: string, day: string, period: string) => boolean,
): { day: string; period: string }[] {
  const chosen: { day: string; period: string }[] = []
  const placed: LessonLike[] = [...existing]
  for (let n = 0; n < count; n++) {
    const hit = days
      .flatMap((d) => periods.map((p) => ({ day: d, period: p })))
      .find((s) => {
        if (chosen.some((c) => c.day === s.day && c.period === s.period)) return false
        const cand: LessonLike = { ...job, day: s.day, period: s.period }
        const span = lessonSlots(cand, periods)
        if (cand.duration === 'Double' && span.length !== 2) return false
        for (const sp of span) {
          if (cand.teacher && blocked('teacher', cand.teacher, sp.day, sp.period)) return false
          if (cand.className && blocked('class', cand.className, sp.day, sp.period)) return false
          const room = roomFor(sp.day, sp.period)
          if (room && !roomFree(room, sp.day, sp.period)) return false
        }
        if (placed.some((l) => lessonsClash(l, cand, periods))) return false
        return true
      })
    if (!hit) break
    chosen.push(hit)
    placed.push({ ...job, day: hit.day, period: hit.period })
  }
  return chosen
}
