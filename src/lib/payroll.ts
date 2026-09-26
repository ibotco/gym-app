import type { SalaryBenefit, SalaryStructure, SalaryAssignment, PayrollAdjItem } from '../types'

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
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const arr = JSON.parse(raw) as T[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* fall through */ }
  return seed
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

/** Compute the monetary value of a benefit against a basic salary. */
export function benefitAmount(b: SalaryBenefit, basic: number): number {
  const raw = b.basis === 'percent' ? (basic * b.value) / 100 : b.value
  return Math.round(raw * 100) / 100
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
