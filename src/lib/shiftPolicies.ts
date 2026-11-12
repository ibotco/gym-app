import type { ShiftPolicy, StaffRecord, WorkShift } from '../types'

export const SHIFT_POLICIES_KEY = 'fitpro_shift_policies_v1'

export const SEED_SHIFT_POLICIES: ShiftPolicy[] = [
  {
    id: 'sp_frontdesk',
    name: 'Front of House coverage',
    shiftId: 'ws_morning',
    departments: ['Front of House'],
    staffUserIds: [],
    requiredStaff: 2,
    weeklyHours: 48,
    maxConsecutiveDays: 6,
    restDaysPerWeek: 1,
    rotation: 'weekly',
    workWeekends: true,
    workHolidays: false,
    active: true,
    notes: 'Keep the reception desk covered on every morning shift.',
    createdAt: '2024-01-01',
  },
  {
    id: 'sp_coaching',
    name: 'Coaching rotation',
    shiftId: 'ws_afternoon',
    departments: ['Coaching'],
    staffUserIds: [],
    requiredStaff: 2,
    weeklyHours: 44,
    maxConsecutiveDays: 5,
    restDaysPerWeek: 2,
    rotation: 'weekly',
    workWeekends: false,
    workHolidays: false,
    active: true,
    notes: 'Coaches rotate through afternoon shifts with two rest days.',
    createdAt: '2024-01-01',
  },
]

export function loadShiftPolicies(): ShiftPolicy[] {
  try {
    const raw = localStorage.getItem(SHIFT_POLICIES_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as ShiftPolicy[]
      if (Array.isArray(arr)) return arr
    }
  } catch { /* fall through */ }
  return SEED_SHIFT_POLICIES
}

export function saveShiftPolicies(list: ShiftPolicy[]) {
  try { localStorage.setItem(SHIFT_POLICIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

const DAY_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

export const shiftHoursPerDay = (sh: WorkShift) => {
  const [sh1, m1] = sh.startTime.split(':').map(Number)
  const [sh2, m2] = sh.endTime.split(':').map(Number)
  let mins = sh2 * 60 + (m2 || 0) - (sh1 * 60 + (m1 || 0))
  if (mins <= 0) mins += 24 * 60 // overnight shift
  return Math.round((mins / 60) * 100) / 100
}

const weeklyHoursOf = (sh: WorkShift) => shiftHoursPerDay(sh) * sh.days.length

/** Longest run of consecutive weekday indexes (Mon=0 … Sun=6). */
const longestConsecutive = (idx: number[]) => {
  const set = new Set(idx)
  let best = 0
  for (const i of set) {
    if (set.has(i - 1)) continue // only start of a run
    let len = 1
    while (set.has(i + len)) len++
    best = Math.max(best, len)
  }
  return best
}

export interface GenerateShiftsResult {
  /** staff → shift assignments to apply (idempotent). */
  assignments: { shiftId: string; userId: string }[]
  warnings: string[]
}

export interface GenerateShiftsInput {
  policies: ShiftPolicy[]
  shifts: WorkShift[]
  staff: StaffRecord[]
  nameOf: (userId: string) => string
  /** ISO dates (Mon–Sun) of the week being generated. */
  weekDates?: string[]
  /** Resolves the HR Admin holiday name covering an ISO date. */
  holidayName?: (iso: string) => string | undefined
}

/**
 * Reads every active policy, validates eligibility and produces conflict-free
 * staff→shift assignments. Never doubles a staff member on overlapping days,
 * honours weekly hours, consecutive-day and rest-day limits, and reports
 * everything it could not satisfy as warnings.
 */
export function generateShifts(input: GenerateShiftsInput): GenerateShiftsResult {
  const { policies, shifts, staff, nameOf } = input
  const assignments: { shiftId: string; userId: string }[] = []
  const warnings: string[] = []
  const assignedByUser = new Map<string, string[]>() // userId -> shiftIds

  const shiftsOf = (userId: string) => (assignedByUser.get(userId) || [])
    .map((id) => shifts.find((x) => x.id === id))
    .filter((x): x is WorkShift => !!x)

  const weekIndex = Math.floor(Date.now() / (7 * 24 * 3600 * 1000))

  for (const policy of policies.filter((p) => p.active)) {
    const shift = shifts.find((x) => x.id === policy.shiftId)
    if (!shift) { warnings.push(`Policy “${policy.name}”: the linked shift no longer exists.`); continue }

    const weekendDays = shift.days.filter((d) => d === 'Sat' || d === 'Sun')
    if (!policy.workWeekends && weekendDays.length) {
      warnings.push(`Policy “${policy.name}”: ${shift.name} runs on ${weekendDays.join('/')} but the policy forbids weekend work — no staff assigned.`)
      continue
    }

    const holidayHits = input.weekDates && input.holidayName
      ? [...new Set(shift.days.map((d) => input.weekDates![DAY_INDEX[d]]).filter((iso): iso is string => !!iso && !!input.holidayName!(iso)).map((iso) => input.holidayName!(iso)))]
      : []
    if (!policy.workHolidays && holidayHits.length) {
      warnings.push(`Policy “${policy.name}”: ${holidayHits.join(', ')} fall on ${shift.name} days but the policy forbids holiday work — no staff assigned.`)
      continue
    }

    let pool = staff
    if (policy.staffUserIds.length) pool = staff.filter((s) => policy.staffUserIds.includes(s.userId))
    else if (policy.departments.length) pool = staff.filter((s) => policy.departments.includes(s.department))

    if (policy.rotation === 'weekly' && pool.length) {
      const rot = weekIndex % pool.length
      pool = [...pool.slice(rot), ...pool.slice(0, rot)]
    }

    const eligible = (st: StaffRecord): string | null => {
      const mine = shiftsOf(st.userId)
      if (mine.some((m) => m.id === shift.id)) return 'already assigned'
      // Prevent overlapping / conflicting shifts: same weekday = conflict.
      const clash = mine.find((m) => m.days.some((d) => shift.days.includes(d)))
      if (clash) return `already works ${clash.name} on an overlapping day`
      // Weekly working hours.
      const hours = mine.reduce((sum, m) => sum + weeklyHoursOf(m), 0) + weeklyHoursOf(shift)
      if (hours > policy.weeklyHours) return `would exceed ${policy.weeklyHours} weekly hours`
      // Consecutive working days.
      const dayIdx = [...new Set([...mine.flatMap((m) => m.days), ...shift.days].map((d) => DAY_INDEX[d]))]
      if (longestConsecutive(dayIdx) > policy.maxConsecutiveDays) return `would exceed ${policy.maxConsecutiveDays} consecutive days`
      // Rest day requirement.
      if (7 - dayIdx.length < policy.restDaysPerWeek) return `would drop below ${policy.restDaysPerWeek} rest days`
      return null
    }

    let placed = 0
    const skipped: string[] = []
    for (const st of pool) {
      if (placed >= policy.requiredStaff) break
      const reason = eligible(st)
      if (reason) { skipped.push(`${nameOf(st.userId)} (${reason})`); continue }
      assignments.push({ shiftId: shift.id, userId: st.userId })
      assignedByUser.set(st.userId, [...(assignedByUser.get(st.userId) || []), shift.id])
      placed++
    }
    if (placed < policy.requiredStaff) {
      warnings.push(`Policy “${policy.name}”: only ${placed} of ${policy.requiredStaff} staff could be assigned to ${shift.name}.${skipped.length ? ` Skipped: ${skipped.join('; ')}.` : ''}`)
    }
  }

  // Staff left with no shift at all.
  const unassigned = staff.filter((s) => !(assignedByUser.get(s.userId) || []).length && !shifts.some((sh) => sh.staffUserIds.includes(s.userId)))
  if (unassigned.length) warnings.push(`Unassigned employees: ${unassigned.map((s) => nameOf(s.userId)).join(', ')}.`)

  return { assignments, warnings }
}
