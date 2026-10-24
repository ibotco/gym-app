import type { CompanySettings, CostCenter } from '../types'

/**
 * Company-wide toggle: when enabled, transaction line items expose an
 * optional Cost Center field. When disabled the field is hidden everywhere,
 * but values already stored on lines are kept untouched.
 */
export function costCenterOnLineItems(company?: CompanySettings | null): boolean {
  return Boolean(company?.costCenterOnLineItems)
}

/** Cost centers offered on pickers: active only, sorted by code. */
export function pickableCostCenters(costCenters: CostCenter[]): CostCenter[] {
  return costCenters
    .filter((c) => (c.status || 'active') === 'active')
    .sort((a, b) => a.code.localeCompare(b.code))
}
