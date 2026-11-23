import type { LoanInstallment, LoanPolicy, Payslip, PayslipItem, SalaryBenefit, SalaryStructure, SalaryAssignment, PayrollAdjItem, SalaryAdvance, StaffLoan } from '../types'
import { planLoanDeduction, type LoanDeductionLine } from './loans'
import { planAdvanceDeductions, type AdvanceDeductionLine } from './advanceSalary'
import { isCollectionMarkedCleared } from './dataReset'

export const SALARY_BENEFITS_KEY = 'fitpro_salary_benefits_v1'
export const SALARY_STRUCTURES_KEY = 'fitpro_salary_structures_v1'
export const SALARY_ASSIGNMENTS_KEY = 'fitpro_salary_assignments_v1'
export const PAYROLL_ADJ_KEY = 'fitpro_payroll_adj_v1'

export const SEED_SALARY_BENEFITS: SalaryBenefit[] = [
  { id: 'sb_housing', name: 'Housing', kind: 'allowance', basis: 'percent', value: 10, color: '#0ea5e9', description: '10% of basic salary.' },
  { id: 'sb_transport', name: 'Transport', kind: 'allowance', basis: 'fixed', value: 300, color: '#84cc16', description: 'Fixed monthly transport allowance.' },
  { id: 'sb_meal', name: 'Meal', kind: 'allowance', basis: 'fixed', value: 200, color: '#f59e0b', description: 'Fixed monthly meal allowance.' },
  { id: 'sb_ssf', name: 'SSF Contribution', kind: 'deduction', basis: 'percent', value: 5.5, color: '#ef4444', description: 'Social security contribution (5.5% of basic).' },
]

export const SEED_SALARY_STRUCTURES: SalaryStructure[] = [
  { id: 'ss_trainer', name: 'Trainer', basic: 2500, benefitIds: ['sb_housing', 'sb_transport', 'sb_ssf'], description: 'Standard trainer package.' },
  { id: 'ss_frontdesk', name: 'Front Desk', basic: 1800, benefitIds: ['sb_housing', 'sb_transport', 'sb_meal', 'sb_ssf'], description: 'Front of house package.' },
]

function load<T>(key: string, seed: T[]): T[] {
  const cleared = isCollectionMarkedCleared('payroll')
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const arr = JSON.parse(raw) as T[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* fall through */ }
  return cleared ? [] : seed
}
function save(key: string, list: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ }
}

export const loadSalaryBenefits = () => load<SalaryBenefit>(SALARY_BENEFITS_KEY, SEED_SALARY_BENEFITS)
export const saveSalaryBenefits = (l: SalaryBenefit[]) => save(SALARY_BENEFITS_KEY, l)
export const loadSalaryStructures = () => load<SalaryStructure>(SALARY_STRUCTURES_KEY, SEED_SALARY_STRUCTURES)
export const saveSalaryStructures = (l: SalaryStructure[]) => save(SALARY_STRUCTURES_KEY, l)
export const loadSalaryAssignments = () => load<SalaryAssignment>(SALARY_ASSIGNMENTS_KEY, [])
export const saveSalaryAssignments = (l: SalaryAssignment[]) => save(SALARY_ASSIGNMENTS_KEY, l)
export const loadPayrollAdj = () => load<PayrollAdjItem>(PAYROLL_ADJ_KEY, [])
export const savePayrollAdj = (l: PayrollAdjItem[]) => save(PAYROLL_ADJ_KEY, l)

/** Compute the monetary value of a benefit against a basic salary.
 *
 *  A fixed-amount benefit can be overridden per salary structure — one
 *  structure may pay GHS 350 transport while another keeps the GHS 300 defined
 *  on the Salary Benefits page — by passing that structure's figure as
 *  `override`. A percentage is a formula, so an override never applies to it.
 */
export function benefitAmount(b: SalaryBenefit, basic: number, override?: number): number {
  const raw = b.basis === 'percent'
    ? (basic * b.value) / 100
    : (typeof override === 'number' && Number.isFinite(override) && override >= 0 ? override : b.value)
  return Math.round(raw * 100) / 100
}

/** What one of a structure's benefits is worth inside that structure. */
export const structureBenefitAmount = (st: SalaryStructure, b: SalaryBenefit, basic: number) =>
  benefitAmount(b, basic, st.amounts?.[b.id])

export type BenefitStatus = 'always' | 'scheduled' | 'active' | 'expired' | 'inactive'

/** The month a benefit's window is measured in, or today's local month when none is given. */
const monthKey = (period?: string): string => {
  if (period && /^\d{4}-\d{2}/.test(period)) return period.slice(0, 7)
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * A benefit's standing in a payroll period (`YYYY-MM`), or today when no period
 * is given. The window is **month-granular**: a benefit starting 15 October is
 * in force for October's payroll, one ending 5 December is in force through
 * December, and the month after the end date it is expired. No dates at all
 * means it never expires.
 */
export function benefitStatusIn(b: Pick<SalaryBenefit, 'startDate' | 'endDate' | 'status'>, period?: string): BenefitStatus {
  if (b.status === 'inactive') return 'inactive'
  const month = monthKey(period)
  if (!b.startDate && !b.endDate) return 'always'
  if (b.startDate && month < b.startDate.slice(0, 7)) return 'scheduled'
  if (b.endDate && month > b.endDate.slice(0, 7)) return 'expired'
  return 'active'
}

/** Is the benefit enabled and in force for this payroll period (or today)? */
export const benefitAppliesToPeriod = (b: Pick<SalaryBenefit, 'startDate' | 'endDate' | 'status'>, period?: string): boolean => {
  const status = benefitStatusIn(b, period)
  return status === 'always' || status === 'active'
}

/** How the window reads on screen: "Always available", "From 1 Oct 2026", "Until 31 Dec 2026", "1 Oct 2026 – 31 Dec 2026". */
export function benefitWindowText(b: Pick<SalaryBenefit, 'startDate' | 'endDate'>): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  if (b.startDate && b.endDate) return `${fmt(b.startDate)} – ${fmt(b.endDate)}`
  if (b.startDate) return `From ${fmt(b.startDate)}`
  if (b.endDate) return `Until ${fmt(b.endDate)}`
  return 'Always available'
}

/** Stored figures (numbers) read back into a form (strings). */
export const structureAmountsToForm = (amounts?: Record<string, number>): Record<string, string> =>
  Object.fromEntries(Object.entries(amounts || {}).map(([id, v]) => [id, String(v)]))

/**
 * What to store when the Salary Structure modal is saved: an entry for every
 * selected fixed-amount benefit whose typed figure differs from the benefit's
 * own value. A figure left alone is not stored, so the structure keeps
 * following the Salary Benefits page; a percentage is never stored.
 */
export function planStructureAmounts(
  benefitIds: string[],
  typed: Record<string, string>,
  benefits: SalaryBenefit[],
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of benefitIds) {
    const b = benefits.find((x) => x.id === id)
    const raw = typed[id]
    if (!b || b.basis !== 'fixed' || raw === undefined || raw.trim() === '') continue
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 0 && Math.round(n * 100) / 100 !== b.value) out[id] = Math.round(n * 100) / 100
  }
  return out
}

/** The first typed fixed figure that is not a number ≥ 0, named for the error. */
export function invalidStructureAmount(
  benefitIds: string[],
  typed: Record<string, string>,
  benefits: SalaryBenefit[],
): string | null {
  for (const id of benefitIds) {
    const b = benefits.find((x) => x.id === id)
    const raw = typed[id]
    if (!b || b.basis !== 'fixed' || raw === undefined || raw.trim() === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return b.name
  }
  return null
}

/** One individual's payroll for a period: the figures and the lines behind them. */
export interface PlannedPayslip {
  basic: number
  /** Allowances from the structure only — bonuses are itemised separately. */
  allowances: number
  /** One-off bonuses for this individual in this period. */
  bonus: number
  /** Deductions from the structure **plus** this individual's one-off deductions. */
  deductions: number
  /** This individual's loan installments falling due in the period. */
  loanDeduction: number
  /** This individual's approved salary-advance installments falling due. */
  advanceDeduction: number
  net: number
  /** Every allowance, bonus, deduction and loan repayment, in slip order. */
  items: PayslipItem[]
  /** The installments the slip settles (ids, for the loan schedule). */
  loanInstallments: string[]
  loanLines: LoanDeductionLine[]
  advanceLines: AdvanceDeductionLine[]
  advanceRepayments: NonNullable<Payslip['advanceRepayments']>
  /** Set when loans were left off because the policy deducts at source elsewhere. */
  autoDeductOff: boolean
}

/**
 * Build one individual's payslip from their structure, their own one-off items
 * (bonus / deduction for the period) and their own loans.
 *
 * The one place this is worked out: the preview on Generate Salary, the stored
 * payslip and the itemised slip a staff member is handed all come from here, so
 * a bonus or a loan repayment can never appear on one and not the others.
 */
export function planPayslip(input: {
  structure: Pick<SalaryStructure, 'basic' | 'benefitIds' | 'amounts'>
  benefits: SalaryBenefit[]
  basicOverride?: number
  /** This individual's one-off items for this period. */
  oneOffs: PayrollAdjItem[]
  loans: StaffLoan[]
  installments: LoanInstallment[]
  /** The payslips that could already have claimed a loan/advance installment. */
  payslips: Pick<Payslip, 'id' | 'loanInstallments' | 'advanceRepayments' | 'staffUserId' | 'period'>[]
  /** Stored staff advances; omitted by callers which do not use the feature. */
  advances?: SalaryAdvance[]
  policy: LoanPolicy
  staffUserId: string
  period: string
  keepPayslipId?: string
}): PlannedPayslip {
  const { structure, benefits, basicOverride, oneOffs, loans, installments, payslips, advances = [], policy, staffUserId, period, keepPayslipId } = input
  const round = (n: number) => Math.round(n * 100) / 100
  const est = structureEstimate(structure, benefits, basicOverride, period)
  // This individual's items only — whatever the caller passes through.
  const mine = oneOffs.filter((a) => a.staffUserId === staffUserId && (!period || a.period === period))

  const items: PayslipItem[] = []
  let allowances = 0
  let deductions = 0
  for (const id of structure.benefitIds) {
    const b = benefits.find((x) => x.id === id)
    if (!b || !benefitAppliesToPeriod(b, period)) continue
    const amount = benefitAmount(b, est.basic, structure.amounts?.[id])
    items.push({ label: b.name, kind: b.kind === 'allowance' ? 'earning' : 'deduction', amount })
    if (b.kind === 'allowance') allowances += amount
    else deductions += amount
  }

  let bonus = 0
  for (const adj of mine) {
    const label = adj.note?.trim() || (adj.kind === 'bonus' ? 'Bonus' : 'Deduction')
    if (adj.kind === 'bonus') {
      bonus += adj.amount
      items.push({ label, kind: 'earning', amount: adj.amount, adjId: adj.id })
    } else {
      deductions += adj.amount
      items.push({ label, kind: 'deduction', amount: adj.amount, adjId: adj.id })
    }
  }

  const loan = planLoanDeduction({ staffUserId, period, loans, installments, payslips, policy, keepPayslipId })
  for (const line of loan.lines) {
    items.push({ label: line.label, kind: 'deduction', amount: line.amount, loanId: line.loanId, installmentId: line.installmentId })
  }

  const advance = planAdvanceDeductions({ staffUserId, period, advances, payslips, keepPayslipId })
  for (const line of advance.lines) {
    items.push({ label: line.label, kind: 'deduction', amount: line.amount, advanceId: line.advanceId, advanceInstallmentNo: line.installmentNo })
  }

  allowances = round(allowances)
  deductions = round(deductions)
  bonus = round(bonus)
  const net = round(est.basic + allowances + bonus - deductions - loan.total - advance.total)
  return {
    basic: est.basic,
    allowances,
    bonus,
    deductions,
    loanDeduction: loan.total,
    advanceDeduction: advance.total,
    net,
    items,
    loanInstallments: loan.lines.map((l) => l.installmentId),
    loanLines: loan.lines,
    advanceLines: advance.lines,
    advanceRepayments: advance.lines.map(({ advanceId, installmentNo, amount }) => ({ advanceId, installmentNo, amount })),
    autoDeductOff: loan.autoDeductOff,
  }
}

export interface StructureEstimate {
  basic: number
  add: number
  sub: number
  net: number
}

/**
 * A structure's basic plus its allowances and deductions, using its own fixed
 * amounts where it has them. One place, so the Salary Structure page, the
 * assignment list and payroll generation can never disagree about a figure.
 */
export function structureEstimate(
  structure: Pick<SalaryStructure, 'basic' | 'benefitIds' | 'amounts'>,
  benefits: SalaryBenefit[],
  basicOverride?: number,
  /**
   * The payroll period (`YYYY-MM`) the estimate is for. Benefits outside their
   * window are not in force then, so they are left out; without a period the
   * estimate is "as at today".
   */
  period?: string,
): StructureEstimate {
  const basic = typeof basicOverride === 'number' && basicOverride > 0 ? basicOverride : structure.basic
  let add = 0
  let sub = 0
  for (const id of structure.benefitIds) {
    const b = benefits.find((x) => x.id === id)
    if (!b || !benefitAppliesToPeriod(b, period)) continue
    const amount = benefitAmount(b, basic, structure.amounts?.[id])
    if (b.kind === 'allowance') add += amount
    else sub += amount
  }
  const round = (n: number) => Math.round(n * 100) / 100
  return { basic, add: round(add), sub: round(sub), net: round(basic + add - sub) }
}

/** GHS amount in words for cheques. */
export function amountInWords(n: number): string {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  const three = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100
    const t = r < 20 ? ones[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? '-' + ones[r % 10] : ''}`
    return `${h ? ones[h] + ' Hundred' + (t ? ' ' : '') : ''}${t}`.trim()
  }
  const int = Math.floor(Math.abs(n))
  const pesewas = Math.round((Math.abs(n) - int) * 100)
  if (int === 0 && pesewas === 0) return 'Zero Cedis'
  const parts: string[] = []
  const m = Math.floor(int / 1000000), k = Math.floor((int % 1000000) / 1000), rest = int % 1000
  if (m) parts.push(`${three(m)} Million`)
  if (k) parts.push(`${three(k)} Thousand`)
  if (rest) parts.push(three(rest))
  let words = parts.join(' ') || ''
  if (pesewas) words += `${words ? ' and ' : ''}${three(pesewas)} Pesewas`
  return `${words} Cedis${pesewas ? '' : ' Only'}`
}
