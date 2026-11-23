import type { Coupon, CouponAssignment, CouponTargetType } from '../types'

export const COUPONS_KEY = 'fitpro_coupons'
export const COUPON_ASSIGNMENTS_KEY = 'fitpro_coupon_assignments'

export const COUPON_TARGET_TYPES: { id: CouponTargetType; label: string }[] = [
  { id: 'customer', label: 'Customer / Member' },
  { id: 'product', label: 'Product' },
  { id: 'transaction', label: 'Transaction' },
]

export const COUPONS: Coupon[] = [
  {
    id: 'cp_1', code: 'WELCOME5', name: 'Welcome coupon', discountType: 'percentage', discountValue: 5,
    validFrom: '2026-01-01', validTo: '2026-12-31', status: 'active', usageLimit: 100, used: 12,
    notes: 'Handed out at sign-up.', createdAt: '2026-01-01T09:00:00',
  },
  {
    id: 'cp_2', code: 'PROTEIN20', name: 'Protein bar promo', discountType: 'fixed', discountValue: 20,
    validFrom: '2026-08-01', validTo: '2026-10-31', status: 'active', usageLimit: 50, used: 6,
    createdAt: '2026-08-01T10:00:00',
  },
  {
    id: 'cp_3', code: 'LOYAL10', name: 'Loyalty reward', discountType: 'percentage', discountValue: 10,
    validFrom: '2026-05-01', validTo: '2026-07-31', status: 'inactive', usageLimit: 0, used: 23,
    notes: 'Paused after the summer campaign.', createdAt: '2026-05-01T11:00:00',
  },
]

export const COUPON_ASSIGNMENTS: CouponAssignment[] = [
  {
    id: 'ca_1', couponId: 'cp_1', targetType: 'customer', targetId: 'u_member', targetLabel: 'Ama Boateng',
    status: 'active', usedCount: 1, assignedAt: '2026-08-12T09:30:00',
  },
  {
    id: 'ca_2', couponId: 'cp_2', targetType: 'customer', targetId: 'u_member', targetLabel: 'Ama Boateng',
    status: 'active', usedCount: 0, assignedAt: '2026-08-20T14:05:00',
  },
  {
    id: 'ca_3', couponId: 'cp_2', targetType: 'product', targetId: 'inv_1', targetLabel: 'Whey Protein (2.27kg) — SUP-WHEY-2.2',
    status: 'active', usedCount: 0, assignedAt: '2026-08-20T14:10:00',
  },
]

export function loadCoupons(): Coupon[] {
  try {
    const raw = localStorage.getItem(COUPONS_KEY)
    if (raw) return JSON.parse(raw) as Coupon[]
  } catch { /* ignore */ }
  return COUPONS
}

export function saveCoupons(list: Coupon[]) {
  try { localStorage.setItem(COUPONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function loadCouponAssignments(): CouponAssignment[] {
  try {
    const raw = localStorage.getItem(COUPON_ASSIGNMENTS_KEY)
    if (raw) return JSON.parse(raw) as CouponAssignment[]
  } catch { /* ignore */ }
  return COUPON_ASSIGNMENTS
}

export function saveCouponAssignments(list: CouponAssignment[]) {
  try { localStorage.setItem(COUPON_ASSIGNMENTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

/** A coupon is redeemable when it is active and inside its validity window. */
export function isCouponLive(c: Coupon, today = new Date().toISOString().slice(0, 10)): boolean {
  if (c.status !== 'active') return false
  if (c.validFrom && today < c.validFrom) return false
  if (c.validTo && today > c.validTo) return false
  if ((c.usageLimit || 0) > 0 && (c.used || 0) >= (c.usageLimit || 0)) return false
  return true
}

/**
 * Why a coupon cannot be applied right now — null when it is valid.
 * Messages follow the POS coupon-redemption spec.
 */
export function couponBlockReason(c: Coupon, invoiceAmount: number, today = new Date().toISOString().slice(0, 10)): string | null {
  const oneTime = (c.usageLimit || 0) === 1
  if (c.status !== 'active') {
    return (c.used || 0) > 0 && oneTime ? 'This coupon has already been redeemed.' : 'Selected coupon is not active.'
  }
  if (c.validTo && today > c.validTo) return 'Selected coupon has expired.'
  if (c.validFrom && today < c.validFrom) return 'Selected coupon is not valid yet.'
  if ((c.usageLimit || 0) > 0 && (c.used || 0) >= (c.usageLimit || 0)) {
    return oneTime ? 'This coupon has already been redeemed.' : 'Coupon usage limit has been exceeded.'
  }
  if ((c.minPurchase || 0) > 0 && invoiceAmount < (c.minPurchase || 0)) {
    return 'Minimum purchase amount required for this coupon has not been reached.'
  }
  return null
}

/**
 * Records a redemption after a sale posts: bumps the coupon's usage count,
 * bumps the assignment's used count, and consumes one-time coupons.
 */
export function recordCouponRedemption(couponId: string, assignmentId?: string) {
  saveCoupons(loadCoupons().map((c) => {
    if (c.id !== couponId) return c
    const used = (c.used || 0) + 1
    const oneTime = (c.usageLimit || 0) === 1
    const exhausted = (c.usageLimit || 0) > 0 && used >= (c.usageLimit || 0)
    return { ...c, used, status: oneTime || exhausted ? 'inactive' : c.status }
  }))
  if (assignmentId) {
    saveCouponAssignments(loadCouponAssignments().map((a) => (a.id === assignmentId ? { ...a, usedCount: (a.usedCount || 0) + 1 } : a)))
  }
}

/** Human-readable coupon value, e.g. "10%" or "GHS 20". */
export function couponValueLabel(c: Pick<Coupon, 'discountType' | 'discountValue'>): string {
  return c.discountType === 'percentage'
    ? `${Number(c.discountValue) || 0}%`
    : `GHS ${Number(c.discountValue) || 0}`
}
