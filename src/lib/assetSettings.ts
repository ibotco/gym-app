import type { DepreciationPolicy } from '../types'

export const ASSET_CATEGORIES_KEY = 'fitpro_asset_categories'
export const ASSET_CONDITIONS_KEY = 'fitpro_asset_conditions'
export const DEPRECIATION_POLICY_KEY = 'fitpro_depreciation_policy'

export const DEFAULT_ASSET_CATEGORIES: string[] = [
  'Cardio equipment',
  'Strength equipment',
  'Functional / free weights',
  'Furniture',
  'IT & electronics',
  'Audio-visual',
  'Other',
]

export const DEFAULT_ASSET_CONDITIONS: string[] = [
  'Excellent',
  'Good',
  'Fair',
  'Poor',
]

export const DEFAULT_DEPRECIATION_POLICY: DepreciationPolicy = {
  method: 'straight_line',
  usefulLifeYears: 8,
  residualPercent: 20,
}

export function loadAssetCategories(): string[] {
  try {
    const raw = localStorage.getItem(ASSET_CATEGORIES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as string[]
      if (Array.isArray(list) && list.length) return list
    }
  } catch { /* ignore */ }
  return DEFAULT_ASSET_CATEGORIES
}

export function saveAssetCategories(list: string[]) {
  try { localStorage.setItem(ASSET_CATEGORIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// ---- Per-type categories (components / accessories / consumables / licenses) ----
export const ASSET_KIND_CATEGORIES_KEY = 'fitpro_asset_kind_categories_v1'

export type KindCategories = Record<'component' | 'accessory' | 'consumable' | 'license', string[]>

export const DEFAULT_KIND_CATEGORIES: KindCategories = {
  component: ['Spare parts', 'Repair kits'],
  accessory: ['Peripherals', 'Docking & hubs'],
  consumable: ['Cleaning supplies', 'Tape & grips'],
  license: ['Subscriptions', 'Software licenses'],
}

export function loadAssetKindCategories(): KindCategories {
  try {
    const raw = localStorage.getItem(ASSET_KIND_CATEGORIES_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<KindCategories>
      return {
        component: Array.isArray(parsed.component) ? parsed.component as string[] : DEFAULT_KIND_CATEGORIES.component,
        accessory: Array.isArray(parsed.accessory) ? parsed.accessory as string[] : DEFAULT_KIND_CATEGORIES.accessory,
        consumable: Array.isArray(parsed.consumable) ? parsed.consumable as string[] : DEFAULT_KIND_CATEGORIES.consumable,
        license: Array.isArray(parsed.license) ? parsed.license as string[] : DEFAULT_KIND_CATEGORIES.license,
      }
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_KIND_CATEGORIES, component: [...DEFAULT_KIND_CATEGORIES.component], accessory: [...DEFAULT_KIND_CATEGORIES.accessory], consumable: [...DEFAULT_KIND_CATEGORIES.consumable], license: [...DEFAULT_KIND_CATEGORIES.license] }
}

export function saveAssetKindCategories(v: KindCategories) {
  try { localStorage.setItem(ASSET_KIND_CATEGORIES_KEY, JSON.stringify(v)) } catch { /* ignore */ }
}

// ---- Named depreciation policies (asset-class based) ----
export const DEPRECIATION_POLICIES_KEY = 'fitpro_depreciation_policies_v1'

export interface DepreciationPolicyRec {
  id: string
  /** Policy / asset-class name, e.g. "Buildings". */
  name: string
  /** Useful life in years (0 = non-depreciable, e.g. land). */
  period: number
  /** Annual depreciation rate (%). */
  rate: number
  status: 'active' | 'inactive'
}

export const DEFAULT_DEPRECIATION_POLICIES: DepreciationPolicyRec[] = [
  { id: 'dp_1', name: 'Buildings', period: 40, rate: 3, status: 'active' },
  { id: 'dp_2', name: 'Computers', period: 3, rate: 20, status: 'active' },
  { id: 'dp_3', name: 'Evangelism Equipment', period: 5, rate: 25, status: 'active' },
  { id: 'dp_4', name: 'Furniture & Fixtures', period: 10, rate: 7, status: 'active' },
  { id: 'dp_5', name: 'Land', period: 0, rate: 0, status: 'active' },
  { id: 'dp_6', name: 'Cardio equipment', period: 8, rate: 12.5, status: 'active' },
  { id: 'dp_7', name: 'Strength equipment', period: 10, rate: 10, status: 'active' },
]

export function loadDepreciationPolicies(): DepreciationPolicyRec[] {
  try {
    const raw = localStorage.getItem(DEPRECIATION_POLICIES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as DepreciationPolicyRec[]
      if (Array.isArray(list)) return list
    }
  } catch { /* ignore */ }
  return DEFAULT_DEPRECIATION_POLICIES.map((p) => ({ ...p }))
}

export function saveDepreciationPolicies(list: DepreciationPolicyRec[]) {
  try { localStorage.setItem(DEPRECIATION_POLICIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadAssetConditions(): string[] {
  try {
    const raw = localStorage.getItem(ASSET_CONDITIONS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as string[]
      if (Array.isArray(list) && list.length) return list
    }
  } catch { /* ignore */ }
  return DEFAULT_ASSET_CONDITIONS
}

export function saveAssetConditions(list: string[]) {
  try { localStorage.setItem(ASSET_CONDITIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadDepreciationPolicy(): DepreciationPolicy {
  try {
    const raw = localStorage.getItem(DEPRECIATION_POLICY_KEY)
    if (raw) {
      const p = JSON.parse(raw) as DepreciationPolicy
      if (p && (p.method === 'straight_line' || p.method === 'reducing_balance' || p.method === 'sum_of_years') && Number.isFinite(p.usefulLifeYears) && Number.isFinite(p.residualPercent)) {
        return p
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_DEPRECIATION_POLICY
}

export function saveDepreciationPolicy(p: DepreciationPolicy) {
  try { localStorage.setItem(DEPRECIATION_POLICY_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
