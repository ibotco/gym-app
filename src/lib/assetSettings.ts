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
      if (p && (p.method === 'straight_line' || p.method === 'reducing_balance') && Number.isFinite(p.usefulLifeYears) && Number.isFinite(p.residualPercent)) {
        return p
      }
    }
  } catch { /* ignore */ }
  return DEFAULT_DEPRECIATION_POLICY
}

export function saveDepreciationPolicy(p: DepreciationPolicy) {
  try { localStorage.setItem(DEPRECIATION_POLICY_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}
