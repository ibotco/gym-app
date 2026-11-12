import type { EduRow } from './eduRecords'
import type { TtConfig } from './eduTimetableConfig'

/** Position of a break in the teaching-period sequence (zero-based, before this period). */
export function breakBeforePeriodIndex(row: EduRow): number {
  const rawBefore = String(row.beforePeriodIndex ?? '').trim()
  const value = rawBefore ? Number(rawBefore) : Number.NaN
  if (Number.isInteger(value)) return value
  // Upgrade rows saved by the earlier after-period editor.
  const rawAfter = String(row.afterPeriodIndex ?? '').trim()
  const legacyAfter = rawAfter ? Number(rawAfter) : Number.NaN
  return Number.isInteger(legacyAfter) ? legacyAfter + 1 : -1
}

export function breakClassNames(row: EduRow): string[] {
  const raw = String(row.classNames ?? '').trim()
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) return parsed.filter((name): name is string => typeof name === 'string')
    } catch {
      // Backward-compatible parsing for any separator-based rows.
    }
    const split = raw.split('|').map((name) => name.trim()).filter(Boolean)
    if (split.length) return split
  }
  return row.className ? [row.className] : []
}

export function breakAppliesToClass(row: EduRow, className: string): boolean {
  return row.applyToAll === 'Yes' || breakClassNames(row).includes(className)
}

export function breakScopeLabel(row: EduRow): string {
  if (row.applyToAll === 'Yes') return 'All classes'
  const names = breakClassNames(row)
  if (names.length > 3) return `${names.length} classes`
  return names.join(', ') || row.className || '—'
}

export function classBreaksFor(rows: EduRow[], className: string): EduRow[] {
  return rows
    .filter((row) => breakAppliesToClass(row, className))
    .sort((a, b) => {
      const indexDiff = breakBeforePeriodIndex(a) - breakBeforePeriodIndex(b)
      return indexDiff || String(a.name ?? a.title ?? '').localeCompare(String(b.name ?? b.title ?? ''))
    })
}

export function breaksBeforePeriod(rows: EduRow[], periodIndex: number): EduRow[] {
  return rows.filter((row) => breakBeforePeriodIndex(row) === periodIndex)
}

const timeParts = (value: string) => value.split(/\s*[–—-]\s*/).map((part) => part.trim())

function bellBoundary(value: string, end: boolean): string {
  const parts = timeParts(value)
  const raw = end ? parts[parts.length - 1] : parts[0]
  const match = raw?.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!match) return ''
  let hour = Number(match[1])
  const suffix = match[3]?.toUpperCase()
  if (suffix === 'AM' && hour === 12) hour = 0
  if (suffix === 'PM' && hour < 12) hour += 12
  return `${String(hour).padStart(2, '0')}:${match[2]}`
}

/** Suggested manual break times: end of the previous period to start of this period. */
export function breakTimeDefaults(cfg: TtConfig, beforePeriodIndex: number): { startTime: string; endTime: string } {
  if (!Number.isInteger(beforePeriodIndex) || beforePeriodIndex <= 0 || beforePeriodIndex >= cfg.periods.length) {
    return { startTime: '', endTime: '' }
  }
  const previous = cfg.periods[beforePeriodIndex - 1]
  const next = cfg.periods[beforePeriodIndex]
  return {
    startTime: bellBoundary(cfg.bellTimes[previous] ?? '', true),
    endTime: bellBoundary(cfg.bellTimes[next] ?? '', false),
  }
}

/** Bell-derived gap for the chosen “before period” position. */
export function breakTimeRange(cfg: TtConfig, beforePeriodIndex: number): string {
  const { startTime, endTime } = breakTimeDefaults(cfg, beforePeriodIndex)
  return startTime && endTime ? `${startTime} – ${endTime}` : ''
}

/** Current display time: follow bells unless the user explicitly edited the suggested times. */
export function breakDisplayTime(cfg: TtConfig, row: EduRow): string {
  const beforeIndex = breakBeforePeriodIndex(row)
  const defaults = breakTimeDefaults(cfg, beforeIndex)
  const manual = row.timeEdited === 'Yes'
  const start = manual ? String(row.startTime ?? '').trim() : defaults.startTime
  const end = manual ? String(row.endTime ?? '').trim() : defaults.endTime
  return start && end ? `${start} – ${end}` : ''
}

/** Full/short break title used for vertical break labels in the print layout. */
export function breakDisplayName(cfg: Pick<TtConfig, 'breakNameDisplay'>, row: EduRow): string {
  const fullName = String(row.name ?? row.title ?? '').trim()
  const shortName = String(row.short ?? '').trim() || fullName
  return (cfg.breakNameDisplay === 'short' ? shortName : fullName) || shortName || 'Break'
}

/** Horizontal break row in the grid, with its full name and time range. */
export function breakGridHeaderLabel(cfg: TtConfig, row: EduRow): string {
  const range = breakDisplayTime(cfg, row)
  // Break name display is print-only; grid bars keep the full break name.
  const title = String(row.name ?? row.title ?? '').trim() || String(row.short ?? '').trim() || 'Break'
  return range ? `${title} · ${range}` : title
}

/** Horizontal print break bar uses the break Name (Full/Short setting) and time range. */
export function breakHeaderLabel(cfg: TtConfig, row: EduRow): string {
  const range = breakDisplayTime(cfg, row)
  const title = breakDisplayName(cfg, row)
  return range ? `${title} · ${range}` : title
}

/** Print label is an explicit override; otherwise follow the full/short setting. */
export function breakPrintTitle(row: EduRow, cfg?: Pick<TtConfig, 'breakNameDisplay'>): string {
  const fullName = String(row.name ?? row.title ?? '').trim()
  const printText = String(row.printText ?? '').trim()
  // Older editor versions stored the full name as the automatic print label.
  // New rows carry printTextCustom so even a custom label identical to Name is honored.
  const hasCustomPrintText = printText && (row.printTextCustom === 'Yes' || printText.toLocaleLowerCase() !== fullName.toLocaleLowerCase())
  if (hasCustomPrintText) return printText
  if (cfg) return breakDisplayName(cfg, row)
  return fullName || String(row.short ?? '').trim() || printText || 'Break'
}

export function breakPrintFontSize(row: EduRow): number {
  const raw = String(row.printFontSize ?? '').trim()
  if (!raw) return 12
  const size = Number(raw)
  return Number.isFinite(size) ? Math.max(6, Math.min(36, Math.round(size))) : 12
}
