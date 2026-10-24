import { loadHrmRows } from './hrmSettings'

/** Row shape used by HR Admin → Holidays (company-scoped settings list). */
export interface HolidayRow {
  id?: string
  name: string
  startDate: string
  endDate?: string
  /** '1' = repeats on the same month/day every year. */
  repeatAnnually?: string
  status: 'Active' | 'Inactive'
}

export const DEFAULT_HOLIDAYS: HolidayRow[] = [
  { name: "New Year's Day", startDate: '2026-01-01', endDate: '', repeatAnnually: '1', status: 'Active' },
  { name: 'Independence Day', startDate: '2026-03-06', endDate: '', repeatAnnually: '1', status: 'Active' },
  { name: 'Good Friday', startDate: '2026-04-03', endDate: '', repeatAnnually: '1', status: 'Active' },
  { name: 'Easter Monday', startDate: '2026-04-06', endDate: '', repeatAnnually: '1', status: 'Active' },
  { name: 'Christmas Day', startDate: '2026-12-25', endDate: '2026-12-26', repeatAnnually: '1', status: 'Active' },
]

/** Active holiday rows for a company (HR Admin is the source of truth). */
export function loadActiveHolidays(companyId: string | undefined): HolidayRow[] {
  return loadHrmRows<HolidayRow>(companyId, 'holidays', DEFAULT_HOLIDAYS)
    .filter((h) => h && h.startDate && h.status !== 'Inactive')
}

const num = (y: number, m: number, d: number) => y * 10000 + m * 100 + d

/** Name of the holiday covering `iso` (YYYY-MM-DD), respecting annual repetition and ranges. */
export function holidayNameOn(holidays: HolidayRow[], iso: string): string | undefined {
  const [y, m, d] = iso.split('-').map(Number)
  for (const h of holidays) {
    const [sy, sm, sd] = h.startDate.split('-').map(Number)
    const [ey, em, ed] = (h.endDate || h.startDate).split('-').map(Number)
    if (h.repeatAnnually === '1') {
      const md = m * 100 + d
      if (md >= sm * 100 + sd && md <= em * 100 + ed) return h.name
    } else if (num(y, m, d) >= num(sy, sm, sd) && num(y, m, d) <= num(ey, em, ed)) {
      return h.name
    }
  }
  return undefined
}
