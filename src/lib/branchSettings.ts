// Branch-level settings overrides. Company (global) settings are the source of
// truth and are inherited by every branch by default; a branch may override only
// the permitted keys listed in BRANCH_OVERRIDABLE_KEYS.

import type { BranchSettings, BranchOverridableKey, BranchCurrency, BranchTax, CompanySettings } from '../types'

export const BRANCH_SETTINGS_KEY = 'fitpro_branch_settings'

/** Default currency list inherited by a branch when it has none configured. */
export const DEFAULT_BRANCH_CURRENCIES: BranchCurrency[] = [
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', status: 'base' },
  { code: 'USD', symbol: '$', name: 'US Dollar', status: 'alternate' },
  { code: 'EUR', symbol: '€', name: 'Euro', status: 'alternate' },
]

/** Default tax rates inherited by a branch when it has none configured. */
export const DEFAULT_BRANCH_TAXES: BranchTax[] = [
  { name: 'Withholding Tax', rate: 25, status: 'active' },
  { name: 'VAT', rate: 17.5, status: 'active' },
]

/** The only settings a branch is allowed to customise. */
export const BRANCH_OVERRIDABLE_KEYS: BranchOverridableKey[] = [
  'address',
  'phone',
  'whatsapp',
  'timezone',
  'dateFormat',
  'timeFormat',
  'startDayOfWeek',
  'weekends',
  'defaultLanguage',
  'cardCodeFormat',
  'sidebarColor',
  'headerColor',
]

export function loadBranchSettings(): BranchSettings[] {
  try {
    const raw = localStorage.getItem(BRANCH_SETTINGS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BranchSettings[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBranchSettings(list: BranchSettings[]) {
  try {
    localStorage.setItem(BRANCH_SETTINGS_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function branchSettingsFor(list: BranchSettings[], branchId: string): BranchSettings | undefined {
  return list.find((s) => s.branchId === branchId)
}

/**
 * The effective currencies for a branch: its configured list, or the defaults.
 */
export function effectiveCurrencies(branch: BranchSettings | undefined): BranchCurrency[] {
  return branch?.currencies && branch.currencies.length ? branch.currencies : DEFAULT_BRANCH_CURRENCIES
}

/** The base currency code for a branch (first `base`, else the company default). */
export function baseCurrency(currencies: BranchCurrency[], fallback?: string): string {
  return currencies.find((c) => c.status === 'base')?.code || currencies[0]?.code || fallback || ''
}

/** All alternate currency codes for a branch. */
export function alternateCurrencies(currencies: BranchCurrency[]): string[] {
  return currencies.filter((c) => c.status === 'alternate').map((c) => c.code)
}

/**
 * Resolve the effective settings for a branch: company defaults merged with the
 * branch's permitted overrides (an empty/undefined value means "inherit").
 */
export function resolveSettings(company: CompanySettings, branch: BranchSettings | undefined): CompanySettings {
  if (!branch) return company
  const out: CompanySettings = { ...company }
  for (const k of BRANCH_OVERRIDABLE_KEYS) {
    const v = branch.overrides[k]
    if (v !== undefined && v !== '') {
      ;(out as unknown as Record<string, unknown>)[k] = v
    }
  }
  return out
}
