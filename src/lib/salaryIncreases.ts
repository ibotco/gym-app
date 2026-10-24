export type SalaryIncreaseAmountType = 'fixed' | 'percent'
export type SalaryIncreaseTargetScope = 'all' | 'structure' | 'department' | 'individual'

export interface SalaryIncreaseTarget {
  scope: SalaryIncreaseTargetScope
  /** Structure ids, department names, or staff user ids, depending on scope. */
  values: string[]
}

export const DEFAULT_SALARY_INCREASE_TARGET: SalaryIncreaseTarget = { scope: 'all', values: [] }

export function normalizeSalaryIncreaseTarget(target?: SalaryIncreaseTarget): SalaryIncreaseTarget {
  const validScopes: SalaryIncreaseTargetScope[] = ['all', 'structure', 'department', 'individual']
  const scope = target && validScopes.includes(target.scope) ? target.scope : 'all'
  const values = Array.isArray(target?.values)
    ? [...new Set(target.values.filter((value): value is string => typeof value === 'string').map((value) => value.trim()).filter(Boolean))]
    : []
  return { scope, values: scope === 'all' ? [] : values }
}

export function salaryIncreaseTargetMatches(
  target: SalaryIncreaseTarget | undefined,
  employee: { staffUserId: string; department?: string; salaryStructureId?: string },
): boolean {
  const normalized = normalizeSalaryIncreaseTarget(target)
  if (normalized.scope === 'all') return true
  if (normalized.scope === 'individual') return normalized.values.includes(employee.staffUserId)
  if (normalized.scope === 'department') return !!employee.department && normalized.values.includes(employee.department)
  return !!employee.salaryStructureId && normalized.values.includes(employee.salaryStructureId)
}

export function sameSalaryIncreaseTarget(a?: SalaryIncreaseTarget, b?: SalaryIncreaseTarget): boolean {
  const left = normalizeSalaryIncreaseTarget(a)
  const right = normalizeSalaryIncreaseTarget(b)
  return left.scope === right.scope && JSON.stringify(left.values.slice().sort()) === JSON.stringify(right.values.slice().sort())
}

export function salaryIncreaseTargetLabel(target?: SalaryIncreaseTarget): string {
  const scope = normalizeSalaryIncreaseTarget(target).scope
  if (scope === 'structure') return 'Salary structures'
  if (scope === 'department') return 'Departments'
  if (scope === 'individual') return 'Individual staff'
  return 'All active staff'
}

export interface ManualSalaryIncrease {
  id: string
  amountType: SalaryIncreaseAmountType
  amount: number
  effectivePeriod: string // YYYY-MM
  /** Active employees included when this increase was scheduled. */
  staffUserIds: string[]
  /** Original targeting rule, retained for the increase history. */
  target?: SalaryIncreaseTarget
  note?: string
  createdAt: string
}

/** A policy version applies once a year in the month of firstEffectivePeriod. */
export interface AnnualSalaryIncreasePolicy {
  id: string
  amountType: SalaryIncreaseAmountType
  amount: number
  firstEffectivePeriod: string // YYYY-MM
  /** Active staff must match this scope when each yearly raise is calculated. */
  target?: SalaryIncreaseTarget
  /** Inclusive last period in which the annual raise may occur; omitted while active. */
  endEffectivePeriod?: string
  createdAt: string
}

export interface SalaryIncreaseSettings {
  annualPolicies: AnnualSalaryIncreasePolicy[]
  manualIncreases: ManualSalaryIncrease[]
}

const SALARY_INCREASES_KEY = 'fitpro_salary_increases'

export const DEFAULT_SALARY_INCREASE_SETTINGS: SalaryIncreaseSettings = {
  annualPolicies: [],
  manualIncreases: [],
}

export function loadSalaryIncreaseSettings(): SalaryIncreaseSettings {
  try {
    const raw = localStorage.getItem(SALARY_INCREASES_KEY)
    if (!raw) return DEFAULT_SALARY_INCREASE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SalaryIncreaseSettings>
    return {
      annualPolicies: Array.isArray(parsed.annualPolicies) ? parsed.annualPolicies : [],
      manualIncreases: Array.isArray(parsed.manualIncreases) ? parsed.manualIncreases : [],
    }
  } catch {
    return DEFAULT_SALARY_INCREASE_SETTINGS
  }
}

export function saveSalaryIncreaseSettings(settings: SalaryIncreaseSettings): void {
  try { localStorage.setItem(SALARY_INCREASES_KEY, JSON.stringify(settings)) } catch { /* storage quota/private mode */ }
}

export function currentPayrollPeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function nextPayrollPeriod(date = new Date()): string {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return currentPayrollPeriod(next)
}

export function formatPayrollPeriod(period: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period)
  if (!match) return period
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function describeSalaryIncrease(amountType: SalaryIncreaseAmountType, amount: number): string {
  if (amountType === 'percent') return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function validPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period)
}

function previousMonth(period: string): string {
  if (!validPeriod(period)) return period
  const [year, month] = period.split('-').map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

/** Last annual occurrence strictly before `beforePeriod`; returns null if none exists. */
export function lastAnnualOccurrenceBefore(policy: AnnualSalaryIncreasePolicy, beforePeriod: string): string | null {
  if (!validPeriod(policy.firstEffectivePeriod) || !validPeriod(beforePeriod)) return null
  const startYear = Number(policy.firstEffectivePeriod.slice(0, 4))
  const month = policy.firstEffectivePeriod.slice(5, 7)
  const beforeYear = Number(beforePeriod.slice(0, 4))
  let year = beforeYear
  let occurrence = `${year}-${month}`
  if (occurrence >= beforePeriod) occurrence = `${--year}-${month}`
  if (year < startYear || occurrence < policy.firstEffectivePeriod) return null
  return occurrence
}

/** Last annual occurrence on or before a payroll period. */
export function lastAnnualOccurrenceOnOrBefore(policy: AnnualSalaryIncreasePolicy, period: string): string | null {
  if (!validPeriod(policy.firstEffectivePeriod) || !validPeriod(period)) return null
  const startYear = Number(policy.firstEffectivePeriod.slice(0, 4))
  const month = policy.firstEffectivePeriod.slice(5, 7)
  const periodYear = Number(period.slice(0, 4))
  let year = periodYear
  let occurrence = `${year}-${month}`
  if (occurrence > period) occurrence = `${--year}-${month}`
  if (year < startYear || occurrence < policy.firstEffectivePeriod) return null
  return occurrence
}

function applyAmount(basic: number, amountType: SalaryIncreaseAmountType, amount: number): number {
  const adjusted = amountType === 'percent' ? basic * (1 + amount / 100) : basic + amount
  return Math.round(adjusted * 100) / 100
}

/**
 * Compute the basic salary for one staff member and payroll month. Scheduled
 * manual increases apply from their effective month onward. Annual policy
 * versions compound once per year and continue to contribute their already
 * effective raises after the policy is stopped.
 */
export function salaryBasicForPeriod(input: {
  baseBasic: number
  staffUserId: string
  period: string
  hireDate?: string
  department?: string
  salaryStructureId?: string
  active: boolean
  settings: SalaryIncreaseSettings
}): number {
  const { baseBasic, staffUserId, period, hireDate, department, salaryStructureId, active, settings } = input
  const original = Number.isFinite(baseBasic) ? Math.max(0, baseBasic) : 0
  if (!validPeriod(period)) return Math.round(original * 100) / 100
  const hirePeriod = validPeriod(hireDate?.slice(0, 7) || '') ? hireDate!.slice(0, 7) : ''
  const operations: { period: string; amountType: SalaryIncreaseAmountType; amount: number; order: number; tie: string }[] = []

  for (const increase of settings.manualIncreases) {
    if (!increase.staffUserIds.includes(staffUserId) || !validPeriod(increase.effectivePeriod)) continue
    if (increase.effectivePeriod > period || (hirePeriod && increase.effectivePeriod < hirePeriod)) continue
    if (!Number.isFinite(increase.amount) || increase.amount <= 0) continue
    operations.push({ period: increase.effectivePeriod, amountType: increase.amountType, amount: increase.amount, order: 0, tie: `${increase.createdAt}-${increase.id}` })
  }

  for (const policy of settings.annualPolicies) {
    if (!active || !salaryIncreaseTargetMatches(policy.target, { staffUserId, department, salaryStructureId }) || !validPeriod(policy.firstEffectivePeriod)) continue
    const lastPeriod = policy.endEffectivePeriod && validPeriod(policy.endEffectivePeriod)
      ? (policy.endEffectivePeriod < period ? policy.endEffectivePeriod : period)
      : period
    const firstYear = Number(policy.firstEffectivePeriod.slice(0, 4))
    const targetYear = Number(lastPeriod.slice(0, 4))
    const month = policy.firstEffectivePeriod.slice(5, 7)
    for (let year = firstYear; year <= targetYear; year += 1) {
      const effectivePeriod = `${year}-${month}`
      if (effectivePeriod < policy.firstEffectivePeriod || effectivePeriod > lastPeriod) continue
      if (hirePeriod && effectivePeriod < hirePeriod) continue
      if (!Number.isFinite(policy.amount) || policy.amount <= 0) continue
      operations.push({ period: effectivePeriod, amountType: policy.amountType, amount: policy.amount, order: 1, tie: `${policy.createdAt}-${policy.id}` })
    }
  }

  operations.sort((a, b) => a.period.localeCompare(b.period) || a.order - b.order || a.tie.localeCompare(b.tie))
  return operations.reduce((basic, operation) => applyAmount(basic, operation.amountType, operation.amount), Math.round(original * 100) / 100)
}
