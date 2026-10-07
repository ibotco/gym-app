// Recurring invoices (Sales → Invoices): frequency helpers plus the logic
// that generates the next occurrence of a recurring billing cycle.
//
// Model: the invoice the cycle was created on is the ANCHOR and carries
// `recurrence` (schedule + progress). Every later invoice of the cycle is a
// plain copy (fresh number, unpaid, `recurringFromId` → anchor) and is
// created by `makeNextInvoice` / `generateDueCycles`.

import type { Invoice, InvoiceRecurrence, RecurrenceFrequency, InvoiceScheme } from '../types'
import { nextInvoiceNumber, resolveInvoiceScheme, upcomingInvoiceNumbers } from './invoiceScheme'

export const RECUR_FREQUENCIES: { id: RecurrenceFrequency; label: string }[] = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
]

export const recurrenceFrequencyLabel = (f?: RecurrenceFrequency) =>
  RECUR_FREQUENCIES.find((x) => x.id === f)?.label || f || ''

const toIso = (d: Date) => d.toISOString().slice(0, 10)

const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Add calendar months, preserving the day of month (clamped to the target month's length). */
const addMonthsClamped = (iso: string, months: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toIso(d)
}

/** Add `times` frequency steps to an ISO date (calendar-aware, day-of-month preserved). */
export function addFrequency(dateIso: string, frequency: RecurrenceFrequency, times = 1): string {
  const d = new Date(`${dateIso}T00:00:00`)
  if (!Number.isFinite(d.getTime())) return dateIso
  const step = Math.max(1, times || 1)
  if (frequency === 'weekly') { d.setDate(d.getDate() + 7 * step); return toIso(d) }
  if (frequency === 'monthly') return addMonthsClamped(dateIso, step)
  if (frequency === 'quarterly') return addMonthsClamped(dateIso, 3 * step)
  return addMonthsClamped(dateIso, 12 * step)
}

/**
 * When the next occurrence should be raised, or null when the anchor is not a
 * live cycle. `stops` means the cycle will end once this occurrence is issued
 * (occurrence count reached or end date passed).
 */
export function nextCycleDate(anchor: Invoice): { next: string; stops: boolean } | null {
  const rec = anchor.recurrence
  if (!rec || rec.stopped) return null
  const every = rec.every || 1
  const base = rec.nextAt && rec.nextAt > anchor.issuedAt
    ? rec.nextAt
    : addFrequency(anchor.issuedAt, rec.frequency, every)
  const countDone = rec.count != null && (rec.issued || 1) >= rec.count
  if (countDone || (rec.endsAt && base > rec.endsAt)) return { next: base, stops: true }
  return { next: base, stops: false }
}

/** True when the cycle still has an occurrence that is due today (nextAt ≤ today). */
export function isCycleDue(anchor: Invoice, todayIso: string): boolean {
  if (!anchor.recurrence || anchor.recurrence.stopped) return false
  const n = nextCycleDate(anchor)
  if (!n || n.stops) return false
  return n.next <= todayIso
}

export interface GeneratedCycle {
  child: Invoice
  anchor: Invoice
}

/**
 * Build the next invoice of a recurring cycle. Pure — persists nothing.
 * Returns null when the cycle has ended (count / end date reached).
 */
export function makeNextInvoice(
  anchor: Invoice,
  today: Date,
  numberFor: () => string,
): GeneratedCycle | null {
  const rec = anchor.recurrence
  if (!rec || rec.stopped) return null
  const n = nextCycleDate(anchor)
  if (!n || n.stops) return null

  const every = rec.every || 1
  const issued = (rec.issued || 1) + 1
  const nextAfter = addFrequency(n.next, rec.frequency, every)

  // Preserve the anchor's issue→due terms on the new cycle.
  const termsDays = Math.round((new Date(anchor.dueAt).getTime() - new Date(anchor.issuedAt).getTime()) / 86400000)
  const due = termsDays > 0 ? addDaysIso(n.next, termsDays) : n.next

  const child: Invoice = {
    ...anchor,
    id: `inv_${Math.random().toString(36).slice(2, 10)}`,
    number: numberFor(),
    issuedAt: n.next,
    dueAt: due,
    status: 'unpaid',
    recurrence: undefined,
    recurringFromId: anchor.id,
    // A generated cycle is a fresh charge — do not re-link the source order.
    salesOrderId: undefined,
  }

  const updatedAnchor: Invoice = {
    ...anchor,
    recurrence: { ...rec, issued, nextAt: nextAfter },
  }
  return { child, anchor: updatedAnchor }
}

export interface DueCycleResult {
  created: Invoice[]
  updated: Invoice[]
  /** The invoice numbers handed to the created children (consume them in the scheme). */
  numbers: string[]
}

/**
 * Generate every missed + due occurrence for all recurring anchors in the
 * list, capped at `cap` per cycle so a long-closed app cannot run away.
 * Pure — the caller persists the results.
 */
export function generateDueCycles(
  invoices: Invoice[],
  scheme: InvoiceScheme | null | undefined,
  today: Date = new Date(),
  cap = 24,
): DueCycleResult {
  const created: Invoice[] = []
  const updated: Invoice[] = []
  const todayIso = toIso(today)
  const pool = upcomingInvoiceNumbers(resolveInvoiceScheme(scheme), cap, today)
  let used = 0

  for (const inv of invoices) {
    if (!inv.recurrence || inv.recurrence.stopped || !isCycleDue(inv, todayIso)) continue
    let cur = inv
    let made = 0
    while (made < cap) {
      const res = makeNextInvoice(cur, today, () => pool[used++])
      if (!res) break
      created.push(res.child)
      cur = res.anchor
      made++
      if (!isCycleDue(cur, todayIso)) break
    }
    if (cur !== inv) {
      const rec = cur.recurrence
      if (rec && !rec.stopped) {
        const n = nextCycleDate(cur)
        if (!n || n.stops) cur = { ...cur, recurrence: { ...rec, stopped: true, nextAt: undefined } }
      }
      updated.push(cur)
    }
  }
  return { created, updated, numbers: pool.slice(0, used) }
}

/** Human summary for list rows / exports, e.g. "monthly — next 2026-09-04". */
export function recurrenceSummary(inv: Invoice): string {
  const rec = inv.recurrence
  if (!rec) return ''
  const base = `${recurrenceFrequencyLabel(rec.frequency).toLowerCase()}${rec.every && rec.every > 1 ? ` every ${rec.every}` : ''}`
  if (rec.stopped) return `${base} — ended`
  if (rec.count) return `${base} — next ${rec.nextAt || '—'} (${rec.issued || 1}/${rec.count})`
  if (rec.endsAt) return `${base} — next ${rec.nextAt || '—'} (until ${rec.endsAt})`
  return `${base} — next ${rec.nextAt || '—'}`
}

/** Convenience for a single manual "Generate next". */
export function generateSingle(
  anchor: Invoice,
  scheme: InvoiceScheme | null | undefined,
  today: Date = new Date(),
): GeneratedCycle | null {
  return makeNextInvoice(anchor, today, () => nextInvoiceNumber(resolveInvoiceScheme(scheme), today))
}
