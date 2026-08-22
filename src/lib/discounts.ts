import type { Discount } from '../types'

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

/** Compute the discount amount for a given subtotal. Returns 0 if not applicable. */
export function computeDiscount(d: Discount, subtotal: number): number {
  if (d.status !== 'active') return 0
  if (d.minSpend && subtotal < d.minSpend) return 0
  if (d.expiresAt && d.expiresAt < new Date().toISOString().slice(0, 10)) return 0
  if (d.usageLimit && d.used >= d.usageLimit) return 0
  let amount = d.type === 'percentage' ? (subtotal * d.value) / 100 : d.value
  if (d.maxDiscount && amount > d.maxDiscount) amount = d.maxDiscount
  return Math.min(amount, subtotal)
}
