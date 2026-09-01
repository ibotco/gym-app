// Multi-company (tenant) persistence layer — mirrors the app's localStorage
// pattern: each collection has a seed default, a load function, and a save
// function. The "database" is browser localStorage scoped per tenant id.

import type { Company, ProductMode } from '../types'

export const COMPANIES_KEY = 'fitpro_companies'
export const ACTIVE_COMPANY_KEY = 'fitpro_active_company'
export const ACTIVE_BRANCH_KEY = 'fitpro_active_branch'
export const PRODUCT_MODE_KEY = 'fitpro_product_mode'

/** The migrated default tenant — all pre-multi-company FitPro data lives here. */
export const DEFAULT_COMPANY_ID = 'co_fitpro'

export const DEFAULT_COMPANY: Company = {
  id: DEFAULT_COMPANY_ID,
  name: 'FitPro',
  legalName: 'FitPro Gym Management Ltd.',
  email: 'hello@fitpro.gym',
  phone: '+233 30 396 4400',
  whatsapp: '233244889900',
  address: 'Airport City, Accra, Ghana',
  digitalAddress: 'GA-543-2211',
  country: 'Ghana',
  stateRegion: 'Greater Accra',
  location: 'Accra',
  taxId: 'C0067843210',
  currency: 'GHS',
  currencySymbol: '₵',
  timezone: 'Africa/Accra',
  brandPrimary: '#C8F542',
  logoText: 'FitPro',
  webAddress: 'https://fitpro.gym',
  status: 'active',
  isDefault: true,
  createdAt: '2023-01-08',
}

export function loadCompanies(): Company[] {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY)
    if (!raw) return [DEFAULT_COMPANY]
    const parsed = JSON.parse(raw) as Company[]
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_COMPANY]
    // Always ensure the default tenant is present (migration safety net).
    if (!parsed.some((c) => c.id === DEFAULT_COMPANY_ID)) return [DEFAULT_COMPANY, ...parsed]
    return parsed
  } catch {
    return [DEFAULT_COMPANY]
  }
}

export function saveCompanies(list: Company[]) {
  try {
    localStorage.setItem(COMPANIES_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

export function loadActiveCompanyId(companies: Company[]): string {
  try {
    const raw = localStorage.getItem(ACTIVE_COMPANY_KEY)
    if (raw && companies.some((c) => c.id === raw)) return raw
  } catch {
    /* ignore */
  }
  return companies.find((c) => c.isDefault)?.id || companies[0]?.id || DEFAULT_COMPANY_ID
}

export function saveActiveCompanyId(id: string) {
  try {
    localStorage.setItem(ACTIVE_COMPANY_KEY, id)
  } catch {
    /* ignore */
  }
}

export function loadActiveBranchId(branches: { id: string }[]): string {
  try {
    const raw = localStorage.getItem(ACTIVE_BRANCH_KEY)
    if (raw && branches.some((b) => b.id === raw)) return raw
  } catch {
    /* ignore */
  }
  return branches[0]?.id || ''
}

export function saveActiveBranchId(id: string) {
  try {
    localStorage.setItem(ACTIVE_BRANCH_KEY, id)
  } catch {
    /* ignore */
  }
}

export function loadProductMode(): ProductMode {
  try {
    const raw = localStorage.getItem(PRODUCT_MODE_KEY)
    if (raw === 'advance' || raw === 'fitpro') return raw
  } catch {
    /* ignore */
  }
  return 'fitpro'
}

export function saveProductMode(mode: ProductMode) {
  try {
    localStorage.setItem(PRODUCT_MODE_KEY, mode)
  } catch {
    /* ignore */
  }
}

/** Generate a stable company id, e.g. `co_1710000000000`. */
export function nextCompanyId(): string {
  return `co_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}
