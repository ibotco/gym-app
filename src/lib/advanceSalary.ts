// Advance Salary data layer — seeded, deterministic, localStorage-backed.
import type { AdvanceRepayment, Payslip, SalaryAdvance } from '../types'
import { isCollectionMarkedCleared } from './dataReset'

export const ADVANCE_SALARY_KEY = 'fitpro_advance_salary_v1'

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => iso(new Date())

export const addDays = (base: string, days: number) => {
  const d = new Date(`${base}T00:00:00`)
  d.setDate(d.getDate() + days)
  return iso(d)
}

const T = todayIso()

export const SEED_SALARY_ADVANCES: SalaryAdvance[] = [
  { id: 'sa_1', staffUserId: 'u_staff', amount: 1500, reason: 'School fees — September term', date: addDays(T, -70), months: 3, recoveredMonths: 3, status: 'recovered', createdAt: addDays(T, -70) },
  { id: 'sa_2', staffUserId: 'u_trainer2', amount: 2400, reason: 'Emergency medical bill', date: addDays(T, -95), months: 4, recoveredMonths: 4, status: 'recovered', createdAt: addDays(T, -95) },
  { id: 'sa_3', staffUserId: 'u_trainer3', amount: 3000, reason: 'Rent advance — landlord request', date: addDays(T, -40), months: 3, recoveredMonths: 1, status: 'approved', createdAt: addDays(T, -40) },
  { id: 'sa_4', staffUserId: 'u_staff2', amount: 1200, reason: 'Car repair after accident', date: addDays(T, -25), months: 2, recoveredMonths: 1, status: 'approved', createdAt: addDays(T, -25) },
  { id: 'sa_5', staffUserId: 'u_trainer4', amount: 2000, reason: 'Family funeral expenses', date: addDays(T, -6), months: 4, recoveredMonths: 0, status: 'approved', createdAt: addDays(T, -6) },
  { id: 'sa_6', staffUserId: 'u_trainer', amount: 5000, reason: 'Coaching certification balance', date: addDays(T, -2), months: 5, recoveredMonths: 0, status: 'pending', createdAt: addDays(T, -2) },
  { id: 'sa_7', staffUserId: 'u_staff', amount: 800, reason: 'Phone replacement', date: addDays(T, -1), months: 2, recoveredMonths: 0, status: 'pending', createdAt: addDays(T, -1) },
  { id: 'sa_8', staffUserId: 'u_manager', amount: 10000, reason: 'Business investment', date: addDays(T, -15), months: 6, recoveredMonths: 0, status: 'rejected', createdAt: addDays(T, -15) },
]

export function loadSalaryAdvances(): SalaryAdvance[] {
  const cleared = isCollectionMarkedCleared('payroll')
  try {
    const raw = localStorage.getItem(ADVANCE_SALARY_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as SalaryAdvance[]
      if (Array.isArray(arr)) return arr
    }
  } catch { /* fall through */ }
  return cleared ? [] : SEED_SALARY_ADVANCES
}

export function saveSalaryAdvances(list: SalaryAdvance[]) {
  try { localStorage.setItem(ADVANCE_SALARY_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const monthlyDeduction = (a: SalaryAdvance) => Math.round((a.amount / Math.max(1, a.months)) * 100) / 100

const isIsoDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3])
}

/** Date validation shared by the staff request and manager forms. */
export function invalidAdvanceWindow(date: string, startDate: string, endDate: string): string | null {
  if (!isIsoDate(date)) return 'Enter a valid advance date.'
  if (startDate && !isIsoDate(startDate)) return 'Enter a valid recovery start date.'
  if (endDate && !isIsoDate(endDate)) return 'Enter a valid recovery end date.'
  if (startDate && startDate < date) return 'Recovery start date must be on or after the advance date.'
  const effectiveStart = startDate || date
  if (endDate && endDate < effectiveStart) return 'Recovery end date must be on or after the start date.'
  return null
}

const payrollMonth = (period?: string) => {
  if (period && /^\d{4}-\d{2}/.test(period)) return period.slice(0, 7)
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Monthly salary-advance recoveries apply to the months touched by this window. */
export function advanceAppliesToPeriod(advance: Pick<SalaryAdvance, 'date' | 'startDate' | 'endDate'>, period?: string): boolean {
  const month = payrollMonth(period)
  const start = (advance.startDate || advance.date).slice(0, 7)
  const end = advance.endDate?.slice(0, 7)
  return month >= start && (!end || month <= end)
}

export type AdvanceWindowStatus = 'scheduled' | 'active' | 'expired'

export function advanceWindowStatus(advance: Pick<SalaryAdvance, 'date' | 'startDate' | 'endDate'>, period?: string): AdvanceWindowStatus {
  const month = payrollMonth(period)
  const start = (advance.startDate || advance.date).slice(0, 7)
  const end = advance.endDate?.slice(0, 7)
  if (month < start) return 'scheduled'
  if (end && month > end) return 'expired'
  return 'active'
}

/** Friendly window label. Missing start falls back to the advance date; blank end is ongoing. */
export function advanceWindowText(advance: Pick<SalaryAdvance, 'date' | 'startDate' | 'endDate'>): string {
  const fmt = (iso: string) => {
    const date = new Date(`${iso.slice(0, 10)}T00:00:00`)
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  const start = advance.startDate || advance.date
  return `${fmt(start)} – ${advance.endDate ? fmt(advance.endDate) : 'No expiry'}`
}

/** The final repayment absorbs any per-month rounding cents. */
const repaymentAmount = (a: SalaryAdvance, installmentNo: number) => {
  const regular = monthlyDeduction(a)
  const raw = installmentNo >= a.months ? a.amount - regular * (a.months - 1) : regular
  return Math.round(raw * 100) / 100
}

export interface AdvanceDeductionLine extends AdvanceRepayment {
  label: string
}

/**
 * Plan one employee's approved salary advance recoveries for a payroll month.
 * A single advance can only be claimed by one slip per employee and period;
 * the existing slip being recalculated keeps its own exact installment.
 */
export function planAdvanceDeductions(input: {
  staffUserId: string
  period: string
  advances: SalaryAdvance[]
  payslips: Pick<Payslip, 'id' | 'staffUserId' | 'period' | 'advanceRepayments'>[]
  keepPayslipId?: string
}): { lines: AdvanceDeductionLine[]; total: number; skippedClaimed: number; skippedRecovered: number } {
  const { staffUserId, period, advances, payslips, keepPayslipId } = input
  const ownSlip = payslips.find((p) => p.id === keepPayslipId && p.staffUserId === staffUserId && p.period === period)
  const kept = ownSlip?.advanceRepayments || []
  const claimedByOther = new Set(
    payslips
      .filter((p) => p.staffUserId === staffUserId && p.period === period && p.id !== keepPayslipId)
      .flatMap((p) => (p.advanceRepayments || []).map((r) => r.advanceId)),
  )
  const lines: AdvanceDeductionLine[] = []
  let skippedClaimed = 0
  let skippedRecovered = 0

  for (const advance of advances) {
    const previous = kept.find((r) => r.advanceId === advance.id)
    if (previous) {
      lines.push({ ...previous, label: `Salary advance repayment — ${advance.reason} (${previous.installmentNo} of ${advance.months})` })
      continue
    }
    if (advance.staffUserId !== staffUserId || advance.status !== 'approved') continue
    if (!advanceAppliesToPeriod(advance, period) || advance.recoveredMonths >= advance.months) continue
    if (advance.recoveryPeriods?.includes(period)) { skippedRecovered++; continue }
    if (claimedByOther.has(advance.id)) { skippedClaimed++; continue }

    const installmentNo = advance.recoveredMonths + 1
    const amount = repaymentAmount(advance, installmentNo)
    if (amount <= 0) continue
    lines.push({
      advanceId: advance.id,
      installmentNo,
      amount,
      label: `Salary advance repayment — ${advance.reason} (${installmentNo} of ${advance.months})`,
    })
  }

  return {
    lines,
    total: Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100,
    skippedClaimed,
    skippedRecovered,
  }
}

/** Settle the advance repayments carried by a paid payslip, once per slip/month. */
export function planAdvanceSettlement(
  payslip: Pick<Payslip, 'id' | 'staffUserId' | 'period' | 'advanceRepayments'>,
  advances: SalaryAdvance[],
): { advances: SalaryAdvance[]; settled: number; total: number; completedAdvanceIds: string[] } {
  let settled = 0
  let total = 0
  const completedAdvanceIds: string[] = []
  const repayments = payslip.advanceRepayments || []
  if (!repayments.length) return { advances, settled, total, completedAdvanceIds }

  const next = advances.map((advance) => {
    const repayment = repayments.find((r) => r.advanceId === advance.id)
    if (!repayment || advance.staffUserId !== payslip.staffUserId) return advance
    if (advance.recoveryPayslipIds?.includes(payslip.id) || advance.recoveryPeriods?.includes(payslip.period)) return advance

    const recoveredMonths = Math.min(advance.months, advance.recoveredMonths + 1)
    const recoveryPeriods = [...new Set([...(advance.recoveryPeriods || []), payslip.period])]
    const recoveryPayslipIds = [...new Set([...(advance.recoveryPayslipIds || []), payslip.id])]
    const status = recoveredMonths >= advance.months ? 'recovered' as const : advance.status
    settled++
    total += repayment.amount
    if (status === 'recovered' && advance.status !== 'recovered') completedAdvanceIds.push(advance.id)
    return { ...advance, recoveredMonths, recoveryPeriods, recoveryPayslipIds, status }
  })
  return { advances: next, settled, total: Math.round(total * 100) / 100, completedAdvanceIds }
}

export const outstandingOf = (a: SalaryAdvance) =>
  Math.round(a.amount * ((a.months - a.recoveredMonths) / Math.max(1, a.months)))

export const recoveredOf = (a: SalaryAdvance) => a.amount - outstandingOf(a)

export const ADV_STATUS_META: Record<SalaryAdvance['status'], { label: string; tone: 'zinc' | 'lime' | 'amber' | 'rose' | 'sky' | 'violet' }> = {
  pending: { label: 'Pending', tone: 'sky' },
  approved: { label: 'Approved', tone: 'lime' },
  recovered: { label: 'Recovered', tone: 'violet' },
  rejected: { label: 'Rejected', tone: 'rose' },
}

export const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
