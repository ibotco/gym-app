// Persistence helpers for Inventory Settings CRUD pages.
// Each page's data lives in localStorage so changes (add/edit/delete/toggle
// status) survive page reloads, mirroring how branch/tax settings are kept.

import type { InvCategory, InvBrand, InvUnit, InvWarranty } from './invSeed'
import {
  SEED_INV_CATEGORIES, SEED_INV_BRANDS, SEED_INV_UNITS, SEED_INV_WARRANTIES,
} from './invSeed'

// ---- Variations ----
export type InvVariation = { id: number; name: string; values: string[] }

const SEED_VARIATIONS: InvVariation[] = [
  { id: 1, name: 'Color',        values: ['Black', 'Blue', 'Green', 'Red', 'White', 'Yellow'] },
  { id: 2, name: 'Packaging',    values: ['Box', 'Mini Box', 'Pack'] },
  { id: 3, name: 'Shoe Size',    values: ['Extra Large', 'Large', 'Medium', 'Small'] },
  { id: 4, name: 'Size',         values: ['Large', 'Medium', 'Small'] },
  { id: 5, name: 'Water Groups', values: ['Warm'] },
]

// ---- Price Groups ----
export type InvPriceGroup = { id: number; name: string; description: string; active: boolean }

const SEED_PRICE_GROUPS: InvPriceGroup[] = [
  { id: 1, name: 'Best Selling Price', description: '', active: true },
  { id: 2, name: 'WholeSale Price',    description: '', active: true },
]

// ---- Storage keys + generic helpers ----
const KEY = {
  variations: 'fitpro_inv_variations',
  categories: 'fitpro_inv_categories',
  brands:     'fitpro_inv_brands',
  units:      'fitpro_inv_units',
  warranties: 'fitpro_inv_warranties',
  priceGroups:'fitpro_inv_price_groups',
} as const

function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return seed
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T) : seed
  } catch {
    return seed
  }
}

function save<T>(key: string, list: T) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* quota */ }
  // Notify any open modals / list pages in the same tab that settings data
  // changed (the native 'storage' event only fires across tabs).
  try { window.dispatchEvent(new CustomEvent('fitpro-inv-settings-changed', { detail: { key } })) } catch { /* noop */ }
}

// ---- Public loaders / savers ----
export const loadVariations = () => load<InvVariation[]>(KEY.variations, SEED_VARIATIONS)
export const saveVariations = (list: InvVariation[]) => save(KEY.variations, list)

export const loadCategories = () => load<InvCategory[]>(KEY.categories, SEED_INV_CATEGORIES)
export const saveCategories = (list: InvCategory[]) => save(KEY.categories, list)

export const loadBrands     = () => load<InvBrand[]>(KEY.brands, SEED_INV_BRANDS)
export const saveBrands     = (list: InvBrand[]) => save(KEY.brands, list)

export const loadUnits      = () => load<InvUnit[]>(KEY.units, SEED_INV_UNITS)
export const saveUnits      = (list: InvUnit[]) => save(KEY.units, list)

export const loadWarranties = () => load<InvWarranty[]>(KEY.warranties, SEED_INV_WARRANTIES)
export const saveWarranties = (list: InvWarranty[]) => save(KEY.warranties, list)

export const loadPriceGroups= () => load<InvPriceGroup[]>(KEY.priceGroups, SEED_PRICE_GROUPS)
export const savePriceGroups= (list: InvPriceGroup[]) => save(KEY.priceGroups, list)

/** Reset all inventory settings to factory seeds (used by "Reset demo data"). */
export function resetInvSettings() {
  try {
    Object.values(KEY).forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
