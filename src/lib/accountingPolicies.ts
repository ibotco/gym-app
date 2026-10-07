/**
 * Accounting Policies — a standalone register that lives *beside* the Chart of
 * Accounts and the Notes to Accounts, never inside them.
 *
 * Policies carry no account links, no balances and no posting behaviour: they
 * are narrative disclosures numbered 1.1, 1.2 … that the Financial Statement
 * package prints as NOTE 1 before the existing numbered notes. Nothing here
 * touches account codes, parent/child relationships or the notes hierarchy.
 *
 * Table (localStorage document `fitpro_accounting_policies_v1`):
 *   PolicyID · PolicyCode · PolicyTitle · PolicyText · EffectiveYear
 *   SortOrder · IsActive · CreatedDate · ModifiedDate
 */

export interface AccountingPolicy {
  /** PolicyID */
  id: string
  /** Owning tenant company (falls back to the default company). */
  companyId?: string
  /** PolicyCode — printed as the sub-note number, e.g. "1.1". */
  code: string
  /** PolicyTitle */
  title: string
  /** PolicyText — the narrative paragraph(s). */
  text: string
  /** EffectiveYear — the financial year the wording applies from. */
  effectiveYear: number
  /** SortOrder — print order inside NOTE 1. */
  sortOrder: number
  /** IsActive — inactive policies stay on file but are not printed. */
  isActive: boolean
  /** CreatedDate */
  createdAt: string
  /** ModifiedDate */
  modifiedAt?: string
}

export const ACCOUNTING_POLICIES_KEY = 'fitpro_accounting_policies_v1'

/** The note number the policies are printed under. */
export const POLICY_NOTE_NUMBER = 1

const thisYear = new Date().getFullYear()

/** Starter wording every set of statements needs — editable by the user. */
export const DEFAULT_ACCOUNTING_POLICIES: AccountingPolicy[] = [
  {
    id: 'pol_1', code: '1.1', title: 'Basis of Preparation', sortOrder: 1, effectiveYear: thisYear, isActive: true,
    text: 'The financial statements have been prepared on the historical cost basis, except where stated otherwise, and in accordance with the International Financial Reporting Standard for Small and Medium-sized Entities (IFRS for SMEs) and the requirements of the Companies Act. They are presented in Ghana Cedis, which is the entity\u2019s functional currency, and are prepared on the going-concern and accrual bases.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pol_2', code: '1.2', title: 'Revenue Recognition', sortOrder: 2, effectiveYear: thisYear, isActive: true,
    text: 'Revenue is measured at the fair value of the consideration received or receivable, net of discounts and taxes collected on behalf of the Revenue Authority. Subscription and membership income is recognised evenly over the period of the membership, service income when the service is rendered, and product sales when control of the goods passes to the customer.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pol_3', code: '1.3', title: 'Property, Plant and Equipment', sortOrder: 3, effectiveYear: thisYear, isActive: true,
    text: 'Property, plant and equipment are stated at cost less accumulated depreciation and any accumulated impairment losses. Cost includes expenditure directly attributable to bringing the asset to the location and condition necessary for it to operate. Subsequent costs are capitalised only when future economic benefits are probable; repairs and maintenance are charged to profit or loss as incurred.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pol_4', code: '1.4', title: 'Depreciation Policy', sortOrder: 4, effectiveYear: thisYear, isActive: true,
    text: '<p>Depreciation is calculated on a straight-line basis at the following rates:</p><ul><li>Buildings — 3%</li><li>Motor Vehicle — 25%</li><li>Office Equipment — 20%</li><li>Evangelical Equipment — 25%</li><li>Computer and Accessories — 20%</li><li>Furniture and Fittings — 7%</li><li>Other Fixed Assets — 20%</li></ul><p>Residual values and useful lives are reviewed at each reporting date.</p>',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pol_5', code: '1.5', title: 'Inventory Valuation', sortOrder: 5, effectiveYear: thisYear, isActive: true,
    text: 'Inventories are measured at the lower of cost and net realisable value. Cost is determined on the weighted average basis and includes purchase price, import duties and other costs directly attributable to bringing the inventory to its present location and condition. Net realisable value is the estimated selling price less the estimated costs necessary to make the sale.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pol_6', code: '1.6', title: 'Employee Benefits', sortOrder: 6, effectiveYear: thisYear, isActive: true,
    text: 'Short-term employee benefits are recognised as an expense in the period in which the service is rendered. The entity contributes to the national social security scheme (SSNIT Tier 1 and Tier 2) and, where applicable, a Tier 3 provident fund; these are defined contribution plans and the contributions are charged to profit or loss as they fall due. Accrued leave is recognised as a liability at the reporting date.',
    createdAt: new Date().toISOString(),
  },
]

const read = (): AccountingPolicy[] => {
  try {
    const raw = localStorage.getItem(ACCOUNTING_POLICIES_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? (parsed as AccountingPolicy[]) : []
  } catch { return [] }
}

/** One-time stamp so the starter policies are merged in exactly once. */
const POLICY_SEED_STAMP = 'fitpro_accounting_policies_seed_v1'
const POLICY_FORMAT_MIGRATION_STAMP = 'fitpro_accounting_policies_depreciation_format_v1'

export function loadAccountingPolicies(): AccountingPolicy[] {
  const saved = read()
  let seeded = false
  try { seeded = localStorage.getItem(POLICY_SEED_STAMP) === '1' } catch { seeded = true }
  if (seeded) {
    // Upgrade the original plain-text depreciation policy for existing users.
    // Only replace the known starter wording; custom edits are preserved.
    let migrated = false
    let formatted = saved
    try { migrated = localStorage.getItem(POLICY_FORMAT_MIGRATION_STAMP) === '1' } catch { migrated = true }
    if (!migrated) {
      const starter = DEFAULT_ACCOUNTING_POLICIES.find((p) => p.id === 'pol_4')
      formatted = saved.map((p) => p.id === 'pol_4' && starter && !p.text.includes('<ul>') && (p.text.startsWith('Depreciation is charged') || p.text.startsWith('Depreciation is calculated'))
        ? { ...p, text: starter.text, modifiedAt: new Date().toISOString() } : p)
      try { localStorage.setItem(POLICY_FORMAT_MIGRATION_STAMP, '1') } catch { /* ignore */ }
      if (formatted.some((p, i) => p !== saved[i])) saveAccountingPolicies(formatted)
    }
    return formatted
  }
  const byId = new Map(saved.map((p) => [p.id, p]))
  const merged = [...saved, ...DEFAULT_ACCOUNTING_POLICIES.filter((p) => !byId.has(p.id))]
  try { localStorage.setItem(POLICY_SEED_STAMP, '1') } catch { /* ignore */ }
  if (merged.length !== saved.length) saveAccountingPolicies(merged)
  return merged
}

export function saveAccountingPolicies(list: AccountingPolicy[]) {
  try { localStorage.setItem(ACCOUNTING_POLICIES_KEY, JSON.stringify(list)) } catch { /* storage full */ }
}

/** Policies printed for a year: active only, in SortOrder then PolicyCode. */
export const policiesForYear = (list: AccountingPolicy[], year: number) =>
  list
    .filter((p) => p.isActive && p.effectiveYear <= year)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code, undefined, { numeric: true }))

/** Next free code/sort order, e.g. 1.7 after 1.6. */
export const nextPolicyCode = (list: AccountingPolicy[]) => {
  const tails = list
    .map((p) => Number(String(p.code).split('.')[1] || 0))
    .filter((n) => Number.isFinite(n))
  const next = (tails.length ? Math.max(...tails) : 0) + 1
  return `${POLICY_NOTE_NUMBER}.${next}`
}
