import type { LoanInstallment, LoanPolicy, StaffLoan } from '../types'

export const LOANS_KEY = 'fitpro_staff_loans_v1'
export const LOAN_INSTALLMENTS_KEY = 'fitpro_loan_installments_v1'
export const LOAN_POLICY_KEY = 'fitpro_loan_policy_v1'

export const DEFAULT_LOAN_POLICY: LoanPolicy = {
  interestPercent: 10,
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

export function loadLoanPolicy(): LoanPolicy {
  try { const r = localStorage.getItem(LOAN_POLICY_KEY); if (r) return { ...DEFAULT_LOAN_POLICY, ...(JSON.parse(r) as Partial<LoanPolicy>) } } catch { /* default */ }
  return DEFAULT_LOAN_POLICY
}
export const saveLoanPolicy = (p: LoanPolicy) => { try { localStorage.setItem(LOAN_POLICY_KEY, JSON.stringify(p)) } catch { /* ignore */ } }

/** Flat simple-interest schedule: total = P × (1 + rate/100 × months/12), equal monthly installments. */
export function loanSchedule(principal: number, months: number, interestPercent: number) {
  const total = Math.round(principal * (1 + (interestPercent / 100) * (months / 12)) * 100) / 100
  const monthly = Math.round((total / months) * 100) / 100
  return { total, monthly }
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
