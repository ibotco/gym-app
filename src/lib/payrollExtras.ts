/**
 * Payroll extensions — periods, gratuities, tax & social-security policies,
 * and the payslip state machine. Pure helpers + localStorage persistence.
 */

export const PAYROLL_PERIODS_KEY = 'fitpro_payroll_periods_v1'
export const GRATUITIES_KEY = 'fitpro_payroll_gratuities_v1'
export const TAX_POLICIES_KEY = 'fitpro_tax_policies_v1'
export const SS_POLICIES_KEY = 'fitpro_ss_policies_v1'
export const STATE_TRANSITIONS_KEY = 'fitpro_payroll_state_transitions_v1'

export interface PayrollPeriod {
  id: string
  companyId?: string
  name: string
  start: string
  end: string
  payDate: string
  status: 'open' | 'closed'
}

export interface GratuityEntry {
  id: string
  companyId?: string
  staffUserId: string
  basicSalary: number
  yearsOfService: number
  /** Percent of (basic × years) granted as gratuity. */
  ratePct: number
  date: string
  note?: string
}

export interface TaxBracket {
  id: string
  companyId?: string
  name: string
  /** Width of this band in currency units (null = top band, unlimited). */
  upTo: number | null
  ratePct: number
  active: boolean
}

export interface SocialSecurityPolicy {
  id: string
  companyId?: string
  name: string
  employeePct: number
  employerPct: number
  /** Monthly pensionable cap; null = uncapped. */
  cap: number | null
  active: boolean
}

export type PayslipState = 'draft' | 'approved' | 'paid' | 'cancelled'
export const PAYROLL_STATES: PayslipState[] = ['draft', 'approved', 'paid', 'cancelled']

export interface StateTransition {
  id: string
  companyId?: string
  from: PayslipState
  to: PayslipState
  roles: string[]
  note?: string
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return seed
    return JSON.parse(raw) as T
  } catch { return seed }
}
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* ignore */ } }

const monthIso = (d: Date, day: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day)).toISOString().slice(0, 10)

export const seedPayrollPeriods = (): PayrollPeriod[] => {
  const now = new Date()
  const start = monthIso(now, 1)
  const end = monthIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)), 0)
  return [{ id: 'pp_current', name: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, start, end, payDate: monthIso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)), 0), status: 'open' }]
}
export const loadPayrollPeriods = () => load<PayrollPeriod[]>(PAYROLL_PERIODS_KEY, seedPayrollPeriods())
export const savePayrollPeriods = (v: PayrollPeriod[]) => save(PAYROLL_PERIODS_KEY, v)

export const loadGratuities = () => load<GratuityEntry[]>(GRATUITIES_KEY, [])
export const saveGratuities = (v: GratuityEntry[]) => save(GRATUITIES_KEY, v)

export const SEED_TAX_BRACKETS: TaxBracket[] = [
  { id: 'tb1', name: 'First band', upTo: 490, ratePct: 0, active: true },
  { id: 'tb2', name: 'Second band', upTo: 110, ratePct: 5, active: true },
  { id: 'tb3', name: 'Third band', upTo: 3065, ratePct: 10, active: true },
  { id: 'tb4', name: 'Fourth band', upTo: 16000, ratePct: 17.5, active: true },
  { id: 'tb5', name: 'Fifth band', upTo: 32333, ratePct: 25, active: true },
  { id: 'tb6', name: 'Sixth band', upTo: 240000, ratePct: 30, active: true },
  { id: 'tb7', name: 'Top band', upTo: null, ratePct: 35, active: true },
]
export const loadTaxBrackets = () => load<TaxBracket[]>(TAX_POLICIES_KEY, SEED_TAX_BRACKETS)
export const saveTaxBrackets = (v: TaxBracket[]) => save(TAX_POLICIES_KEY, v)

export const SEED_SS_POLICIES: SocialSecurityPolicy[] = [
  { id: 'ss1', name: 'Tier 1 — Basic social security (employer)', employeePct: 0, employerPct: 13.5, cap: null, active: true },
  { id: 'ss2', name: 'Tier 2 — Occupational (employee)', employeePct: 5.5, employerPct: 0, cap: null, active: true },
]
export const loadSSPolicies = () => load<SocialSecurityPolicy[]>(SS_POLICIES_KEY, SEED_SS_POLICIES)
export const saveSSPolicies = (v: SocialSecurityPolicy[]) => save(SS_POLICIES_KEY, v)

export const SEED_STATE_TRANSITIONS: StateTransition[] = [
  { id: 'st1', from: 'draft', to: 'approved', roles: ['gym_manager', 'super_admin'], note: 'Manager review' },
  { id: 'st2', from: 'approved', to: 'paid', roles: ['accountant', 'super_admin'], note: 'After settlement' },
  { id: 'st3', from: 'draft', to: 'cancelled', roles: ['gym_manager', 'super_admin'] },
  { id: 'st4', from: 'approved', to: 'cancelled', roles: ['super_admin'], note: 'Exceptions only' },
]
export const loadStateTransitions = () => load<StateTransition[]>(STATE_TRANSITIONS_KEY, SEED_STATE_TRANSITIONS)
export const saveStateTransitions = (v: StateTransition[]) => save(STATE_TRANSITIONS_KEY, v)

// ---------------------------------------------------------------------------
// Pure payroll math
// ---------------------------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100

/** End-of-service gratuity = basic × years × rate%. */
export const gratuityAmount = (g: Pick<GratuityEntry, 'basicSalary' | 'yearsOfService' | 'ratePct'>) =>
  round2(g.basicSalary * g.yearsOfService * (g.ratePct / 100))

/** Progressive PAYE across band widths (Ghana-style monthly brackets). */
export function taxOn(income: number, brackets: TaxBracket[]): number {
  let remaining = Math.max(0, income)
  let tax = 0
  for (const b of brackets.filter((x) => x.active)) {
    if (remaining <= 0) break
    const width = b.upTo === null ? remaining : Math.min(remaining, b.upTo)
    tax += width * (b.ratePct / 100)
    remaining -= width
  }
  return round2(tax)
}

/** Effective tax rate, 0 when income is 0. */
export const effectiveRate = (income: number, tax: number) => (income > 0 ? round2((tax / income) * 100) : 0)

export interface SSContribution { employee: number; employer: number }

export function ssContribution(gross: number, p: SocialSecurityPolicy): SSContribution {
  const base = p.cap !== null ? Math.min(gross, p.cap) : gross
  return {
    employee: round2(base * (p.employeePct / 100)),
    employer: round2(base * (p.employerPct / 100)),
  }
}

/** Whether a transition is allowed by the configured state machine. */
export function canTransition(transitions: StateTransition[], from: PayslipState, to: PayslipState, role: string): boolean {
  return transitions.some((t) => t.from === from && t.to === to && t.roles.includes(role))
}
