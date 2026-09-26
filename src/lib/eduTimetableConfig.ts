import type { EduRecords, EduRow } from './eduRecords'

/**
 * Timetable definition (aSc-style): how many days/periods the week has,
 * renamed days/periods, bell times, weekend and display options.
 * Stored as one row under records['ttConfig']; grids, prints, rules and the
 * auto-generator all read from here so a change applies everywhere.
 */

export const MAX_DAYS = 7
export const MAX_PERIODS = 10

export const DEFAULT_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DEFAULT_PERIOD_NAMES = Array.from({ length: MAX_PERIODS }, (_, i) => `Period ${i + 1}`)
export const DEFAULT_BELL_TIMES = [
  '08:00 – 08:45',
  '08:45 – 09:30',
  '09:30 – 10:15',
  '10:15 – 11:00',
  '11:15 – 12:00',
  '12:00 – 12:45',
  '12:45 – 13:30',
  '13:30 – 14:15',
  '14:15 – 15:00',
  '15:00 – 15:45',
]

export const WEEKEND_OPTIONS = ['Saturday - Sunday', 'Friday - Saturday', 'Thursday - Friday', 'None']

export type TtConfig = {
  days: string[] // stored day keys (used in records)
  shortDays: string[] // compact header names (Mon, Tue…)
  periods: string[] // stored period keys
  headerDays: string[] // what the grid prints (Day N when showDayNumbers)
  bellTimes: Record<string, string>
  showDayNumbers: boolean
  workZeroPeriods: boolean
  multiTerm: boolean
  weekend: string
  periodsPerDay: number
  daysCount: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)))

const shortOf = (name: string) => {
  const s = (name ?? '').trim().slice(0, 3)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const splitList = (v: string | undefined) =>
  (v ?? '').split('|').map((s) => s.trim()).filter(Boolean)

/** Read the definition row, falling back to the 5-day × 8-period default. */
export function loadTtConfig(records: EduRecords): TtConfig {
  const row: EduRow | undefined = (records['ttConfig'] ?? [])[0]
  const daysCount = clamp(Number(row?.daysCount) || 5, 1, MAX_DAYS)
  const periodsPerDay = clamp(Number(row?.periodsPerDay) || 8, 1, MAX_PERIODS)

  const dayNames = splitList(row?.dayNames)
  const fullDayNames = dayNames.length ? dayNames : DEFAULT_DAY_NAMES
  const days = fullDayNames.slice(0, daysCount)
  const dayShorts = splitList(row?.dayShorts)
  const shortDays = days.map((d, i) => dayShorts[i] || shortOf(fullDayNames[i] ?? d))

  const periodNames = splitList(row?.periodNames)
  const periods = (periodNames.length ? periodNames : DEFAULT_PERIOD_NAMES).slice(0, periodsPerDay)

  const bells = splitList(row?.bellTimes)
  const bellTimes: Record<string, string> = {}
  periods.forEach((p, i) => {
    bellTimes[p] = bells[i] ?? DEFAULT_BELL_TIMES[i] ?? ''
  })

  return {
    days,
    shortDays,
    periods,
    headerDays: row?.showDayNumbers === 'Yes' ? days.map((_, i) => `Day ${i + 1}`) : days,
    bellTimes,
    showDayNumbers: row?.showDayNumbers === 'Yes',
    workZeroPeriods: row?.workZeroPeriods !== '',
    multiTerm: row?.multiTerm === 'Yes',
    weekend: row?.weekend || WEEKEND_OPTIONS[0],
    periodsPerDay,
    daysCount,
  }
}

/** Label for the break row (between the 3rd and 4th period), or null when the week has fewer than 4 periods. */
export function breakLabel(cfg: TtConfig): string | null {
  if (cfg.periods.length < 4) return null
  const end = (cfg.bellTimes[cfg.periods[2]] ?? '').split('–')[1]?.trim()
  const start = (cfg.bellTimes[cfg.periods[3]] ?? '').split('–')[0]?.trim()
  return end && start ? `Break · ${end} – ${start}` : 'Break'
}

/** Serialise the definition back into the single ttConfig row. */
export function toTtConfigRow(cfg: {
  daysCount: number
  periodsPerDay: number
  dayNames: string[]
  dayShorts: string[]
  periodNames: string[]
  bellTimes: string[]
  showDayNumbers: boolean
  workZeroPeriods: boolean
  multiTerm: boolean
  weekend: string
}): EduRow {
  return {
    id: 'tt-config',
    daysCount: String(cfg.daysCount),
    periodsPerDay: String(cfg.periodsPerDay),
    dayNames: cfg.dayNames.join(' | '),
    dayShorts: cfg.dayShorts.join(' | '),
    periodNames: cfg.periodNames.join(' | '),
    bellTimes: cfg.bellTimes.join(' | '),
    showDayNumbers: cfg.showDayNumbers ? 'Yes' : '',
    workZeroPeriods: cfg.workZeroPeriods ? 'Yes' : '',
    multiTerm: cfg.multiTerm ? 'Yes' : '',
    weekend: cfg.weekend,
  }
}
