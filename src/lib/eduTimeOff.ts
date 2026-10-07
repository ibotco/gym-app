import type { EduRow } from './eduRecords'
import type { GenTimeOff } from './eduTimetableGen'

/**
 * aSc-style Time Off: per teacher or class, every day × period slot is one of
 * Appropriate (default), Conditional (used only when nothing else fits) or
 * Inappropriate (never used). Stored as one row per person with pipe-joined
 * slot lists: `Wednesday|Period 1 | Wednesday|Period 2`.
 * Legacy range rows ({ day, from, to }) are migrated on first read.
 */

export type SlotState = 'ok' | 'conditional' | 'blocked'

export const slotKey = (day: string, period: string) => `${day}|${period}`

export const parseSlots = (v: string | undefined): string[] =>
  (v ?? '').split(';').map((s) => s.trim()).filter(Boolean)

const joinSlots = (list: string[]) => list.join('; ')

export function stateOf(row: EduRow | undefined, day: string, period: string): SlotState {
  if (!row) return 'ok'
  const key = slotKey(day, period)
  if (parseSlots(row.blocked).includes(key)) return 'blocked'
  if (parseSlots(row.conditional).includes(key)) return 'conditional'
  return 'ok'
}

/** Return the row for a person with `slot` moved to `state` (new row when none). */
export function withSlot(row: EduRow | undefined, whoType: string, name: string, day: string, period: string, state: SlotState): EduRow {
  const base: EduRow = row ? { ...row } : { id: `to-${name}-${whoType}`.replace(/\s+/g, '-').toLowerCase(), whoType, name, blocked: '', conditional: '' }
  const key = slotKey(day, period)
  let blocked = parseSlots(base.blocked).filter((s) => s !== key)
  let conditional = parseSlots(base.conditional).filter((s) => s !== key)
  if (state === 'blocked') blocked = [...blocked, key]
  if (state === 'conditional') conditional = [...conditional, key]
  return { ...base, whoType, name, blocked: joinSlots(blocked), conditional: joinSlots(conditional) }
}

const isLegacy = (r: EduRow) => r.blocked === undefined && r.day !== undefined

/** Merge legacy range rows into per-person slot rows; new rows pass through. */
export function migrateTimeOffRows(rows: EduRow[], days: string[], periods: string[]): EduRow[] {
  if (!rows.some(isLegacy)) return rows
  const out: EduRow[] = rows.filter((r) => !isLegacy(r)).map((r) => ({ ...r }))
  for (const r of rows.filter(isLegacy)) {
    const from = Math.max(0, periods.indexOf(r.from || periods[0]))
    let to = periods.indexOf(r.to || r.from || periods[0])
    if (to < 0) to = from
    const lo = Math.min(from, to)
    const hi = Math.max(from, to)
    let row = out.find((o) => o.whoType === r.whoType && o.name === r.name)
    if (!row) {
      row = { id: r.id, whoType: r.whoType ?? 'Teacher', name: r.name ?? '', blocked: '', conditional: '' }
      out.push(row)
    }
    const add = parseSlots(row.blocked)
    for (let i = lo; i <= hi; i++) {
      const key = slotKey(r.day, periods[i])
      if (periods[i] && !add.includes(key)) add.push(key)
    }
    row.blocked = joinSlots(add)
  }
  return out.filter((r) => r.name)
}

/** Flatten rows (new or legacy) into generator inputs. */
export function flattenTimeOff(rows: EduRow[], days: string[], periods: string[]): { blocked: GenTimeOff[]; conditional: GenTimeOff[] } {
  const migrated = migrateTimeOffRows(rows, days, periods)
  const idx = (p: string) => Math.max(0, periods.indexOf(p))
  const blocked: GenTimeOff[] = []
  const conditional: GenTimeOff[] = []
  for (const r of migrated) {
    const whoType = r.whoType === 'Class' ? 'class' as const : 'teacher' as const
    for (const key of parseSlots(r.blocked)) {
      const [day, period] = key.split('|')
      if (days.includes(day) && periods.includes(period)) blocked.push({ whoType, name: r.name, day, fromIdx: idx(period), toIdx: idx(period) })
    }
    for (const key of parseSlots(r.conditional)) {
      const [day, period] = key.split('|')
      if (days.includes(day) && periods.includes(period)) conditional.push({ whoType, name: r.name, day, fromIdx: idx(period), toIdx: idx(period) })
    }
  }
  return { blocked, conditional }
}
