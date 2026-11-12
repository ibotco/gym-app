import { isCollectionMarkedCleared } from './dataReset'

export const SUPPLIER_CATEGORIES_KEY = 'fitpro_supplier_categories'
export const CUSTOMER_CATEGORIES_KEY = 'fitpro_customer_categories'

export const DEFAULT_SUPPLIER_CATEGORIES: string[] = [
  'Equipment',
  'Supplements',
  'Beverages',
  'Apparel',
  'Recovery',
  'Services',
]

export const DEFAULT_CUSTOMER_CATEGORIES: string[] = [
  'Walk-in',
  'Corporate',
  'Personal training',
  'Retail',
  'Prospect',
]

export function loadSupplierCategories(): string[] {
  const cleared = isCollectionMarkedCleared('customers')
  try {
    const raw = localStorage.getItem(SUPPLIER_CATEGORIES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as string[]
      if (Array.isArray(list) && (list.length || cleared)) return list
    }
  } catch { /* ignore */ }
  return cleared ? [] : DEFAULT_SUPPLIER_CATEGORIES
}

export function saveSupplierCategories(list: string[]) {
  try { localStorage.setItem(SUPPLIER_CATEGORIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadCustomerCategories(): string[] {
  const cleared = isCollectionMarkedCleared('customers')
  try {
    const raw = localStorage.getItem(CUSTOMER_CATEGORIES_KEY)
    if (raw) {
      const list = JSON.parse(raw) as string[]
      if (Array.isArray(list) && (list.length || cleared)) return list
    }
  } catch { /* ignore */ }
  return cleared ? [] : DEFAULT_CUSTOMER_CATEGORIES
}

export function saveCustomerCategories(list: string[]) {
  try { localStorage.setItem(CUSTOMER_CATEGORIES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
