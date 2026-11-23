import type { Discount } from '../types'
import { formatGhsExact } from './utils'

export const DISCOUNTS_KEY = 'fitpro_discounts'

export const DISCOUNT_TYPES = [
  { id: 'percentage', label: 'Percentage (%)' },
  { id: 'fixed', label: 'Fixed amount (GHS)' },
] as const

export const DISCOUNT_APPLIES = [
  { id: 'all', label: 'Everything' },
  { id: 'members', label: 'Memberships only' },
  { id: 'plans', label: 'Plans only' },
  { id: 'products', label: 'Products only' },
] as const

export const DISCOUNTS: Discount[] = [
  {
    id: 'dc_1', code: 'WELCOME10', name: 'New member welcome', type: 'percentage', value: 10,
    minSpend: 200, status: 'active', appliesTo: 'members', used: 34, usageLimit: 0,
    createdAt: '2026-05-01T09:00:00',
  },
  {
    id: 'dc_2', code: 'ANNUAL50', name: 'Annual plan discount', type: 'fixed', value: 50,
    minSpend: 2000, status: 'active', appliesTo: 'plans', used: 12, usageLimit: 100,
    createdAt: '2026-04-15T10:00:00',
  },
  {
    id: 'dc_3', code: 'BLACKCARD', name: 'Black Card promo', type: 'percentage', value: 15,
    maxDiscount: 400, status: 'active', appliesTo: 'plans', used: 8, usageLimit: 50,
    expiresAt: '2026-09-30', createdAt: '2026-06-01T11:00:00',
  },
  {
    id: 'dc_4', code: 'SUMMER15', name: 'Summer sale', type: 'percentage', value: 15,
    status: 'expired', appliesTo: 'all', used: 120, usageLimit: 200,
    startsAt: '2026-06-01', expiresAt: '2026-07-31', createdAt: '2026-05-20T08:00:00',
  },
]

export function loadDiscounts(): Discount[] {
  try {
    const raw = localStorage.getItem(DISCOUNTS_KEY)
    if (raw) return JSON.parse(raw) as Discount[]
  } catch { /* ignore */ }
  return DISCOUNTS
}

export function saveDiscounts(list: Discount[]) {
  try { localStorage.setItem(DISCOUNTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

/**
 * Product-scope check for group-specific discounts. Returns a reason when the
 * sale does not include the assigned product, or null when in scope.
 */
function productScopeReason(
  d: Discount,
  itemIds?: string[],
  productName?: (id: string) => string | undefined,
): string | null {
  if (d.group !== 'specific_product') return null
  if (!d.productId) return 'no product is assigned to it yet'
  if (!itemIds || !itemIds.includes(d.productId)) {
    const nm = productName?.(d.productId)
    return nm ? `it applies only to ${nm}` : 'it applies only to its assigned product'
  }
  return null
}

/** Compute the discount amount for a given subtotal. Returns 0 if not applicable. */
export function computeDiscount(d: Discount, subtotal: number, itemIds?: string[]): number {
  if (d.status !== 'active') return 0
  const today = new Date().toISOString().slice(0, 10)
  if (d.startsAt && today < d.startsAt) return 0
  if (d.expiresAt && d.expiresAt < today) return 0
  if (d.minSpend && subtotal < d.minSpend) return 0
  if (d.usageLimit && d.used >= d.usageLimit) return 0
  if (productScopeReason(d, itemIds)) return 0
  let amount = d.type === 'percentage' ? (subtotal * d.value) / 100 : d.value
  if (d.maxDiscount && amount > d.maxDiscount) amount = d.maxDiscount
  return Math.min(amount, subtotal)
}

/** Discounts available for selection at checkout (status = active). */
export function activeDiscounts(): Discount[] {
  return loadDiscounts().filter((d) => d.status === 'active')
}

/** Human-readable option label for a discount-table entry. */
export function discountLabel(d: Discount): string {
  const amount = d.type === 'percentage' ? `${d.value}%` : formatGhsExact(d.value)
  const scope = d.group === 'specific_product' ? ' · product-specific' : ''
  return `${d.code} — ${d.name} (${amount})${scope}`
}

/**
 * Why a discount cannot be applied to the given subtotal, or null when it can.
 * Mirrors the rules enforced by computeDiscount so the UI can explain declines.
 * `opts.itemIds` are the products in the current sale (for group scoping) and
 * `opts.productName` resolves an assigned product's display name.
 */
export function discountBlockReason(
  d: Discount,
  subtotal: number,
  opts?: { itemIds?: string[]; productName?: (id: string) => string | undefined },
): string | null {
  if (d.status !== 'active') return 'this discount is not active'
  const today = new Date().toISOString().slice(0, 10)
  if (d.startsAt && today < d.startsAt) return `it starts on ${d.startsAt}`
  if (d.expiresAt && d.expiresAt < today) return `it expired on ${d.expiresAt}`
  if (d.minSpend && subtotal < d.minSpend) return `it needs a minimum spend of ${formatGhsExact(d.minSpend)}`
  if (d.usageLimit && d.used >= d.usageLimit) return 'its usage limit has been reached'
  const scope = productScopeReason(d, opts?.itemIds, opts?.productName)
  if (scope) return scope
  return null
}

/** Display label for the discount's group: 'General' or the assigned product. */
export function discountGroupLabel(d: Discount, productName?: (id: string) => string | undefined): string {
  if (d.group !== 'specific_product') return 'General'
  if (!d.productId) return 'Product: not assigned'
  return `Product: ${productName?.(d.productId) || d.productId}`
}

/** Increment a table discount's usage counter after it was applied to a saved sale. */
export function recordDiscountUsage(discountId: string) {
  const list = loadDiscounts()
  saveDiscounts(list.map((d) => (d.id === discountId ? { ...d, used: (d.used || 0) + 1 } : d)))
}
