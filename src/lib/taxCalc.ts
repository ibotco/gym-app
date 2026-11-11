// Shared math for the dual tax system: GLOBAL mode (order-level taxes applied
// to every line) and PRODUCT mode (each line carries its own taxes). All
// amounts are additive on the same taxable base and rounded to 2 decimals.
import type { LineTax } from '../types'

export interface TaxOpt {
  name: string
  rate: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Taxes for one line: every selected tax applies to the same base, duplicates
 * are ignored, unknown names are skipped. Base should already have the line
 * discount applied.
 */
export function computeLineTaxes(base: number, names: string[], taxes: TaxOpt[]): LineTax[] {
  const cleanBase = Math.max(0, Number(base) || 0)
  const seen = new Set<string>()
  const out: LineTax[] = []
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    const tax = taxes.find((t) => t.name === name)
    if (!tax) continue
    out.push({ name, rate: tax.rate, amount: round2((cleanBase * tax.rate) / 100) })
  }
  return out
}

/** Sum of a line's tax amounts. */
export const lineTaxTotal = (taxes?: LineTax[]) =>
  round2((taxes || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0))

/** Line total including its taxes: discounted base + tax total. */
export const lineTotalWithTax = (base: number, taxes?: LineTax[]) =>
  round2(Math.max(0, Number(base) || 0) + lineTaxTotal(taxes))

export interface TaxSummaryRow {
  name: string
  rate: number
  amount: number
}

/**
 * Invoice-footer tax summary: per-tax-type totals across every line (PRODUCT
 * mode) plus the total tax. Rows keep first-seen order.
 */
export function taxSummary(lineTaxes: (LineTax[] | undefined)[]): { rows: TaxSummaryRow[]; total: number } {
  const map = new Map<string, TaxSummaryRow>()
  for (const list of lineTaxes) {
    for (const t of list || []) {
      const row = map.get(t.name)
      if (row) row.amount += Number(t.amount) || 0
      else map.set(t.name, { name: t.name, rate: t.rate, amount: Number(t.amount) || 0 })
    }
  }
  const rows = [...map.values()].map((r) => ({ ...r, amount: round2(r.amount) }))
  return { rows, total: round2(rows.reduce((s, r) => s + r.amount, 0)) }
}

/** Distinct tax names across lines — used for the combined receipt label. */
export const distinctTaxNames = (lineTaxes: (LineTax[] | undefined)[]) => {
  const names: string[] = []
  for (const list of lineTaxes) {
    for (const t of list || []) if (!names.includes(t.name)) names.push(t.name)
  }
  return names
}
