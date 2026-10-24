/**
 * Automatic timetable generation (aSc-style).
 *
 * Places every requested lesson into the week grid under three hard
 * constraints: a class has at most one lesson per slot, a teacher teaches at
 * most one lesson per slot, and a room (the class's home room) hosts at most
 * one lesson per slot. Random-restart greedy search keeps the best result.
 */

export interface GenClass {
  name: string
  room?: string
}

export interface GenAssignment {
  className: string
  subject: string
  teacher: string
  periodsPerWeek: number
}

export interface GenLesson {
  id: string
  className: string
  day: string
  period: string
  subject: string
  teacher: string
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface GenClassRule {
  name: string
  maxPerDay?: number
  maxPerWeek?: number
}

export interface GenTeacherRule {
  name: string
  maxPerDay?: number
  maxPerWeek?: number
  /** 'Any' or a specific day/period; a specified value blocks that time for the teacher. */
  unavailableDay?: string
  unavailablePeriod?: string
}

/** A blocked time range for a teacher or a class (inclusive period indices). */
export interface GenTimeOff {
  whoType: 'teacher' | 'class'
  name: string
  day: string
  fromIdx: number
  toIdx: number
}

export type ConstraintKind = 'teacherConsec' | 'classConsec' | 'classSubjectOnce'

export interface GenConstraint {
  kind: ConstraintKind
  /** '' / undefined = applies to all teachers / classes */
  target?: string
  value?: number
}

export interface GenRules {
  classRules?: GenClassRule[]
  teacherRules?: GenTeacherRule[]
  timeOff?: GenTimeOff[]
  /** Slots used only when no appropriate slot fits (aSc "Conditional"). */
  timeOffConditional?: GenTimeOff[]
  constraints?: GenConstraint[]
}

export function generateTimetable(
  days: string[],
  periods: string[],
  classes: GenClass[],
  assignments: GenAssignment[],
  rules?: GenRules,
): { lessons: GenLesson[]; unplaced: number } {
  const roomOf = new Map(classes.map((c) => [c.name, c.room ?? '']))
  const maxSlots = days.length * periods.length

  const classRule = new Map((rules?.classRules ?? []).map((r) => [r.name, r]))
  const teacherRule = new Map((rules?.teacherRules ?? []).map((r) => [r.name, r]))
  const timeOff = rules?.timeOff ?? []
  const constraints = rules?.constraints ?? []
  const pIdx = new Map(periods.map((p, i) => [p, i]))

  const applies = (c: GenConstraint, name: string) => !c.target || c.target === name
  const consecFor = (kind: ConstraintKind, name: string) => {
    let n = 0
    for (const c of constraints) {
      if (c.kind === kind && applies(c, name) && (c.value ?? 0) > 0) n = Math.max(n, c.value ?? 0)
    }
    return n || undefined
  }
  const isOff = (whoType: 'teacher' | 'class', name: string, day: string, idx: number) =>
    timeOff.some((t) => t.whoType === whoType && t.name === name && t.day === day && idx >= t.fromIdx && idx <= t.toIdx)
  const condOff = rules?.timeOffConditional ?? []
  const isCond = (whoType: 'teacher' | 'class', name: string, day: string, idx: number) =>
    condOff.some((t) => t.whoType === whoType && t.name === name && t.day === day && idx >= t.fromIdx && idx <= t.toIdx)
  const runLen = (slots: Set<number>, idx: number) => {
    let n = 1
    for (let i = idx - 1; slots.has(i); i--) n++
    for (let i = idx + 1; slots.has(i); i++) n++
    return n
  }

  const jobs: { className: string; subject: string; teacher: string }[] = []
  for (const a of assignments) {
    const weekCap = classRule.get(a.className)?.maxPerWeek
    const n = Math.max(1, Math.min(a.periodsPerWeek || 4, weekCap ?? maxSlots, maxSlots))
    for (let i = 0; i < n; i++) jobs.push({ className: a.className, subject: a.subject, teacher: a.teacher })
  }
  if (!jobs.length) return { lessons: [], unplaced: 0 }

  let best: { lessons: GenLesson[]; unplaced: number } | null = null

  for (let attempt = 0; attempt < 80; attempt++) {
    const rnd = mulberry32(0x9e3779b9 ^ Math.imul(attempt + 1, 2654435761))
    const classBusy = new Set<string>()
    const teacherBusy = new Set<string>()
    const roomBusy = new Set<string>()
    const classDay = new Map<string, number>()
    const teacherDay = new Map<string, number>()
    const classWeek = new Map<string, number>()
    const teacherWeek = new Map<string, number>()
    const teacherDaySlots = new Map<string, Set<number>>()
    const classDaySlots = new Map<string, Set<number>>()
    const classDaySubjects = new Map<string, Set<string>>()
    const NONE = new Set<number>()
    const placed: GenLesson[] = []
    let unplaced = 0

    for (const job of shuffle(jobs, rnd)) {
      const room = roomOf.get(job.className) || ''
      const cr = classRule.get(job.className)
      const tr = teacherRule.get(job.teacher)
      const fits = ({ d, p }: { d: string; p: string }, allowCond: boolean) => {
        const idx = pIdx.get(p) ?? 0
        if (classBusy.has(`${job.className}|${d}|${p}`)) return false
        if (teacherBusy.has(`${job.teacher}|${d}|${p}`)) return false
        if (room && roomBusy.has(`${room}|${d}|${p}`)) return false
        // Time Off: blocked ranges for this teacher or class.
        if (isOff('teacher', job.teacher, d, idx) || isOff('class', job.className, d, idx)) return false
        // Constraints: consecutive-period caps and one-lesson-per-subject-per-day.
        const tConsec = consecFor('teacherConsec', job.teacher)
        if (tConsec && runLen(teacherDaySlots.get(`${job.teacher}|${d}`) ?? NONE, idx) > tConsec) return false
        const cConsec = consecFor('classConsec', job.className)
        if (cConsec && runLen(classDaySlots.get(`${job.className}|${d}`) ?? NONE, idx) > cConsec) return false
        if (
          constraints.some((c) => c.kind === 'classSubjectOnce' && applies(c, job.className)) &&
          (classDaySubjects.get(`${job.className}|${d}`)?.has(job.subject) ?? false)
        ) return false
        // Timetable Rules: teacher unavailability (specific day and/or period).
        if (tr) {
          const daySpec = tr.unavailableDay && tr.unavailableDay !== 'Any' ? tr.unavailableDay : ''
          const periodSpec = tr.unavailablePeriod && tr.unavailablePeriod !== 'Any' ? tr.unavailablePeriod : ''
          if ((daySpec || periodSpec) && (!daySpec || daySpec === d) && (!periodSpec || periodSpec === p)) return false
        }
        // Timetable Rules: per-day / per-week workload caps.
        if (cr?.maxPerDay && (classDay.get(`${job.className}|${d}`) ?? 0) >= cr.maxPerDay) return false
        if (cr?.maxPerWeek && (classWeek.get(job.className) ?? 0) >= cr.maxPerWeek) return false
        if (tr?.maxPerDay && (teacherDay.get(`${job.teacher}|${d}`) ?? 0) >= tr.maxPerDay) return false
        if (tr?.maxPerWeek && (teacherWeek.get(job.teacher) ?? 0) >= tr.maxPerWeek) return false
        // Time Off: conditional slots are a last resort.
        if (!allowCond && (isCond('teacher', job.teacher, d, idx) || isCond('class', job.className, d, idx))) return false
        return true
      }
      const pool = () => shuffle(days.flatMap((d) => periods.map((p) => ({ d, p }))), rnd)
      const slot = pool().find((s) => fits(s, false)) ?? pool().find((s) => fits(s, true))
      if (!slot) {
        unplaced++
        continue
      }
      classBusy.add(`${job.className}|${slot.d}|${slot.p}`)
      teacherBusy.add(`${job.teacher}|${slot.d}|${slot.p}`)
      if (room) roomBusy.add(`${room}|${slot.d}|${slot.p}`)
      classDay.set(`${job.className}|${slot.d}`, (classDay.get(`${job.className}|${slot.d}`) ?? 0) + 1)
      teacherDay.set(`${job.teacher}|${slot.d}`, (teacherDay.get(`${job.teacher}|${slot.d}`) ?? 0) + 1)
      classWeek.set(job.className, (classWeek.get(job.className) ?? 0) + 1)
      teacherWeek.set(job.teacher, (teacherWeek.get(job.teacher) ?? 0) + 1)
      const idx = pIdx.get(slot.p) ?? 0
      const tKey = `${job.teacher}|${slot.d}`
      if (!teacherDaySlots.has(tKey)) teacherDaySlots.set(tKey, new Set())
      teacherDaySlots.get(tKey)!.add(idx)
      const cKey = `${job.className}|${slot.d}`
      if (!classDaySlots.has(cKey)) classDaySlots.set(cKey, new Set())
      classDaySlots.get(cKey)!.add(idx)
      if (!classDaySubjects.has(cKey)) classDaySubjects.set(cKey, new Set())
      classDaySubjects.get(cKey)!.add(job.subject)
      placed.push({ id: '', ...job, day: slot.d, period: slot.p })
    }

    if (!best || unplaced < best.unplaced) best = { lessons: placed, unplaced }
    if (unplaced === 0) break
  }

  const stamp = Date.now().toString(36)
  const lessons = (best?.lessons ?? []).map((l, i) => ({ ...l, id: `gen-${stamp}-${i}` }))
  return { lessons, unplaced: best?.unplaced ?? 0 }
}
