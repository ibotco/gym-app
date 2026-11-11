// Company-level Tax & Discount policy.
//
// One source of truth for whether tax / discount are optional, mandatory or
// hidden, shared by every transaction form (Standard POS, Advanced POS, the
// sale editor used by Sales / Sales orders / Quotations / Invoices).
//
// The policy only decides *visibility and editability*. It never changes how a
// total is computed — the forms keep their own arithmetic and simply ask this
// module what to show, what to lock, and what to seed.

import type { CompanySettings, SaleDiscountType, TaxDiscountSettings, TaxDiscountMode } from '../types'

export const TAX_DISCOUNT_MODES: { value: TaxDiscountMode; label: string; hint: string }[] = [
  { value: 'optional', label: 'Optional', hint: 'Users may apply or remove it during a transaction.' },
  { value: 'mandatory', label: 'Mandatory', hint: 'Always applied. Users cannot remove or bypass it.' },
  { value: 'hidden', label: 'Hidden / Disabled', hint: 'Fields never appear and nothing is calculated.' },
]

/** Shipped defaults: both features on and freely editable — today's behaviour. */
export const DEFAULT_TAX_DISCOUNT_SETTINGS: TaxDiscountSettings = {
  taxEnabled: true,
  taxMode: 'optional',
  defaultTaxName: '',
  defaultTaxRate: 0,
  allowTaxOverride: true,
  discountEnabled: true,
  discountMode: 'optional',
  defaultDiscountType: 'percentage',
  defaultDiscountValue: 0,
  allowDiscountOverride: true,
}

/** Company settings merged over the defaults, so partial saves stay valid. */
export function taxDiscountSettings(company: Pick<CompanySettings, 'taxDiscount'> | undefined): TaxDiscountSettings {
  return { ...DEFAULT_TAX_DISCOUNT_SETTINGS, ...(company?.taxDiscount || {}) }
}

/**
 * What a transaction form should actually do, with the "enabled" switch and the
 * mode collapsed into three plain booleans per feature.
 */
export interface TaxDiscountPolicy {
  settings: TaxDiscountSettings
  tax: {
    /** Render tax fields at all? */
    visible: boolean
    /** Tax must be present on every applicable transaction. */
    required: boolean
    /** May the cashier change the tax on this transaction? */
    editable: boolean
    /** Tax name to seed a new transaction with (mandatory mode enforces it). */
    defaultName: string
    defaultRate: number
    /** Badge copy for the UI, e.g. "Company-Mandated Tax". */
    label: string
  }
  discount: {
    visible: boolean
    required: boolean
    editable: boolean
    defaultType: SaleDiscountType
    defaultValue: number
    label: string
  }
}

export function resolveTaxDiscountPolicy(
  company: Pick<CompanySettings, 'taxDiscount'> | undefined,
): TaxDiscountPolicy {
  const s = taxDiscountSettings(company)

  const taxOn = s.taxEnabled && s.taxMode !== 'hidden'
  const taxRequired = taxOn && s.taxMode === 'mandatory'
  const discountOn = s.discountEnabled && s.discountMode !== 'hidden'
  const discountRequired = discountOn && s.discountMode === 'mandatory'

  return {
    settings: s,
    tax: {
      visible: taxOn,
      required: taxRequired,
      // Mandatory tax is read-only unless an administrator has explicitly
      // allowed overrides; optional tax is editable unless overrides are off.
      editable: taxOn && s.allowTaxOverride,
      defaultName: s.defaultTaxName || '',
      defaultRate: Math.max(0, s.defaultTaxRate || 0),
      label: taxRequired ? 'Company-Mandated Tax' : taxOn ? 'Optional' : 'Disabled',
    },
    discount: {
      visible: discountOn,
      required: discountRequired,
      editable: discountOn && s.allowDiscountOverride,
      defaultType: s.defaultDiscountType || 'percentage',
      defaultValue: Math.max(0, s.defaultDiscountValue || 0),
      label: discountRequired ? 'Mandatory Discount' : discountOn ? 'Optional' : 'Disabled',
    },
  }
}

/**
 * Blocks a save that would violate the mandatory rules.
 * Returns a human-readable reason, or null when the transaction may proceed.
 */
export function taxDiscountViolation(
  policy: TaxDiscountPolicy,
  current: { taxName: string; taxRate: number; discountValue: number },
): string | null {
  if (policy.tax.required && !(current.taxRate > 0)) {
    return 'This company requires tax on every sale. Select a tax before completing the transaction.'
  }
  if (policy.tax.required && !current.taxName) {
    return 'This company requires a named tax on every sale.'
  }
  if (policy.discount.required && !(current.discountValue > 0)) {
    return 'This company requires a discount on every sale. Enter a discount before completing the transaction.'
  }
  return null
}

/** Field-by-field diff of a settings change, for the audit trail. */
const FIELD_LABELS: Record<keyof TaxDiscountSettings, string> = {
  taxEnabled: 'Enable Tax',
  taxMode: 'Tax Mode',
  defaultTaxName: 'Default Tax',
  defaultTaxRate: 'Default Tax Rate',
  allowTaxOverride: 'Allow tax modification',
  discountEnabled: 'Enable Discount',
  discountMode: 'Discount Mode',
  defaultDiscountType: 'Default Discount Type',
  defaultDiscountValue: 'Default Discount Value',
  allowDiscountOverride: 'Allow discount modification',
}

const show = (value: unknown) => {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  if (value === '' || value === undefined || value === null) return '—'
  return String(value)
}

/**
 * "Tax Mode: Optional → Mandatory; Default Tax Rate: 0 → 17.5"
 * Empty string when nothing changed.
 */
export function describeTaxDiscountChange(before: TaxDiscountSettings, after: TaxDiscountSettings): string {
  const parts: string[] = []
  for (const key of Object.keys(FIELD_LABELS) as (keyof TaxDiscountSettings)[]) {
    if (before[key] === after[key]) continue
    parts.push(`${FIELD_LABELS[key]}: ${show(before[key])} → ${show(after[key])}`)
  }
  return parts.join('; ')
}
