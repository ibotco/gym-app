import type { LoanInstallment, LoanPolicy, LoanType, Payslip, StaffLoan } from '../types'
import { emptyDataShape, isCollectionMarkedCleared } from './dataReset'

export const LOANS_KEY = 'fitpro_staff_loans_v1'
export const LOAN_INSTALLMENTS_KEY = 'fitpro_loan_installments_v1'
export const LOAN_POLICY_KEY = 'fitpro_loan_policy_v1'

export const DEFAULT_LOAN_TYPES: LoanType[] = [
  { id: 'loan_type_general', name: 'General', defaultMonths: 6, interestPercent: 10, active: true },
]

export const DEFAULT_LOAN_POLICY: LoanPolicy = {
  interestPercent: 10,
  loanTypes: DEFAULT_LOAN_TYPES,
  maxMonths: 12,
  maxSalaryMultiple: 3,
  allowMultipleActive: false,
  payDay: 28,
  graceDays: 3,
  minTenureMonths: 3,
  minSalary: 0,
  autoDeduct: true,
}

export function loadLoans(): StaffLoan[] {
  try { const r = localStorage.getItem(LOANS_KEY); if (r) { const a = JSON.parse(r) as StaffLoan[]; if (Array.isArray(a)) return a } } catch { /* seed */ }
  return []
}
export const saveLoans = (l: StaffLoan[]) => { try { localStorage.setItem(LOANS_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

export function loadLoanInstallments(): LoanInstallment[] {
  try { const r = localStorage.getItem(LOAN_INSTALLMENTS_KEY); if (r) { const a = JSON.parse(r) as LoanInstallment[]; if (Array.isArray(a)) return a } } catch { /* seed */ }
  return []
}
export const saveLoanInstallments = (l: LoanInstallment[]) => { try { localStorage.setItem(LOAN_INSTALLMENTS_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

/** Migrate older single-rate loan policies to one editable General product. */
export function normalizeLoanPolicy(input: Partial<LoanPolicy> = {}): LoanPolicy {
  const legacyRate = Number.isFinite(input.interestPercent) ? Number(input.interestPercent) : DEFAULT_LOAN_POLICY.interestPercent
  const loanTypes = Array.isArray(input.loanTypes)
    ? input.loanTypes
    : [{ ...DEFAULT_LOAN_TYPES[0], interestPercent: legacyRate }]
  return { ...DEFAULT_LOAN_POLICY, ...input, loanTypes }
}

export function invalidLoanTypes(types: LoanType[], maxMonths: number): string | null {
  if (!types.length) return 'Add at least one loan type.'
  if (!types.some((type) => type.active)) return 'Keep at least one loan type active for new applications.'
  const seen = new Set<string>()
  for (const type of types) {
    const name = type.name.trim()
    if (!name) return 'Every loan type needs a name.'
    const key = name.toLowerCase()
    if (seen.has(key)) return `Loan type “${name}” is listed more than once.`
    seen.add(key)
    if (!Number.isInteger(type.defaultMonths) || type.defaultMonths < 1 || type.defaultMonths > maxMonths) {
      return `The default term for ${name} must be between 1 and ${maxMonths} months.`
    }
    if (!Number.isFinite(type.interestPercent) || type.interestPercent < 0 || type.interestPercent > 100) {
      return `The flat annual interest rate for ${name} must be between 0 and 100%.`
    }
  }
  return null
}

export function loadLoanPolicy(): LoanPolicy {
  try {
    const r = localStorage.getItem(LOAN_POLICY_KEY)
    if (isCollectionMarkedCleared('payroll')) {
      return r ? JSON.parse(r) as LoanPolicy : emptyDataShape(normalizeLoanPolicy())
    }
    if (r) return normalizeLoanPolicy(JSON.parse(r) as Partial<LoanPolicy>)
  } catch { /* default */ }
  return isCollectionMarkedCleared('payroll') ? emptyDataShape(normalizeLoanPolicy()) : normalizeLoanPolicy()
}
export const saveLoanPolicy = (p: LoanPolicy) => { try { localStorage.setItem(LOAN_POLICY_KEY, JSON.stringify(p)) } catch { /* ignore */ } }

/** Flat simple-interest schedule: total = P × (1 + rate/100 × months/12), equal monthly installments. */
export function loanSchedule(principal: number, months: number, interestPercent: number) {
  const total = Math.round(principal * (1 + (interestPercent / 100) * (months / 12)) * 100) / 100
  const monthly = Math.round((total / months) * 100) / 100
  return { total, monthly }
}

/** One loan repayment line on a payslip. */
export interface LoanDeductionLine {
  loanId: string
  installmentId: string
  n: number
  months: number
  amount: number
  label: string
}

/**
 * The staff loans an individual's payslip should repay.
 *
 * An installment belongs to the payslip of the month it falls due in, and to
 * that individual only. It is deducted **once**: an installment already carried
 * by another payslip (or already paid through the Loan Installments page) is
 * left alone, while whatever the payslip being recalculated already carried
 * stays on it — so re-running Generate Salary never doubles a repayment and
 * never drops one off a slip that has already been settled.
 *
 * When the loan policy's *Installments deducted from salary* switch is off,
 * nothing is deducted here at all.
 */
export function planLoanDeduction(input: {
  staffUserId: string
  /** YYYY-MM — the installments falling due in this month. */
  period: string
  loans: StaffLoan[]
  installments: LoanInstallment[]
  /** Every payslip that could have claimed an installment, this one included. */
  payslips: Pick<Payslip, 'id' | 'loanInstallments'>[]
  policy: LoanPolicy
  /** The payslip being (re)calculated. */
  keepPayslipId?: string
}): { lines: LoanDeductionLine[]; total: number; autoDeductOff: boolean; skippedClaimed: number } {
  const { staffUserId, period, loans, installments, payslips, policy, keepPayslipId } = input
  const mine = installments.filter((i) => i.status !== 'paid' || (payslips.find((p) => p.id === keepPayslipId)?.loanInstallments || []).includes(i.id))

  const claimedElsewhere = new Set<string>()
  for (const p of payslips) {
    if (p.id === keepPayslipId) continue
    for (const id of p.loanInstallments || []) claimedElsewhere.add(id)
  }

  const staffLoans = loans.filter((l) => l.staffUserId === staffUserId && l.status !== 'rejected')
  const byLoan = new Map(staffLoans.map((l) => [l.id, l]))
  const due = mine.filter((i) => byLoan.has(i.loanId) && i.dueDate.slice(0, 7) === period)

  if (!policy.autoDeduct) return { lines: [], total: 0, autoDeductOff: true, skippedClaimed: due.filter((i) => claimedElsewhere.has(i.id)).length }

  const lines: LoanDeductionLine[] = due
    .filter((i) => !claimedElsewhere.has(i.id))
    .sort((a, b) => (byLoan.get(a.loanId)!.appliedAt.slice(0, 7)).localeCompare(byLoan.get(b.loanId)!.appliedAt.slice(0, 7)) || a.n - b.n)
    .map((i) => ({
      loanId: i.loanId,
      installmentId: i.id,
      n: i.n,
      months: byLoan.get(i.loanId)!.months,
      amount: i.amount,
      label: `Loan repayment (${i.n} of ${byLoan.get(i.loanId)!.months})`,
    }))

  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100
  return { lines, total, autoDeductOff: false, skippedClaimed: due.length - lines.length }
}

/**
 * What paying a payslip does to the loan schedule: its installments are marked
 * paid on the day the salary is paid, and a loan whose installments are all paid
 * is completed. Idempotent — installments already paid are left untouched.
 */
export function planLoanSettlement(
  payslip: Pick<Payslip, 'loanInstallments' | 'paidAt'>,
  installments: LoanInstallment[],
  loans: StaffLoan[],
  paidAt?: string,
): { installments: LoanInstallment[]; completedLoanIds: string[]; settled: number } {
  const ids = new Set(payslip.loanInstallments || [])
  if (!ids.size) return { installments, completedLoanIds: [], settled: 0 }
  const when = paidAt || payslip.paidAt || new Date().toISOString().slice(0, 10)
  let settled = 0
  const next = installments.map((i) => {
    if (!ids.has(i.id) || i.status === 'paid') return i
    settled++
    return { ...i, status: 'paid' as const, paidAt: when }
  })
  const completedLoanIds = loans
    .filter((l) => l.status === 'active')
    .filter((l) => next.filter((i) => i.loanId === l.id).length > 0 && next.filter((i) => i.loanId === l.id).every((i) => i.status === 'paid'))
    .map((l) => l.id)
  return { installments: next, completedLoanIds, settled }
}

export function buildInstallments(loan: StaffLoan): LoanInstallment[] {
  const { monthly } = loanSchedule(loan.principal, loan.months, loan.interestPercent)
  const [y, m] = loan.appliedAt.slice(0, 7).split('-').map(Number)
  const out: LoanInstallment[] = []
  for (let i = 1; i <= loan.months; i++) {
    const d = new Date(y, m - 1 + i, Math.min(28, Number(loan.appliedAt.slice(8, 10)) || 1))
    out.push({
      id: `${loan.id}_i${i}`,
      loanId: loan.id,
      n: i,
      dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      amount: i === loan.months ? Math.round((loanSchedule(loan.principal, loan.months, loan.interestPercent).total - monthly * (loan.months - 1)) * 100) / 100 : monthly,
      status: 'pending',
    })
  }
  return out
}
