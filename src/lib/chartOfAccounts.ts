// ---------------------------------------------------------------------------
// Chart of Accounts — multi-company / multi-branch ownership model.
//
// Every account belongs to exactly one scope:
//   GLOBAL  — shared by every company and branch (Cash, Bank, A/R, A/P, …)
//   COMPANY — visible to one company only        (Export Revenue, Mining Revenue)
//   BRANCH  — visible to one branch only         (Municipal Levy, Local Market Fees)
//
// Also owns automatic account-code generation across the eight standard code
// groups, the one-off classification migration, and the validation rules.
// Everything here is pure; persistence lives in lib/accounting.ts.
// ---------------------------------------------------------------------------

import type { Account, AccountScope, AccountType } from '../types'

export type { AccountScope }

/** The eight standard code groups and the numeric band each one owns. */
export type CodeGroup =
  | 'assets' | 'liabilities' | 'equity' | 'revenue'
  | 'cost_of_sales' | 'operating_expenses' | 'other_income' | 'other_expenses'

export const CODE_GROUPS: { id: CodeGroup; label: string; start: number; end: number }[] = [
  { id: 'assets',             label: 'Assets',             start: 1000, end: 1999 },
  { id: 'liabilities',        label: 'Liabilities',        start: 2000, end: 2999 },
  { id: 'equity',             label: 'Equity',             start: 3000, end: 3999 },
  { id: 'revenue',            label: 'Revenue',            start: 4000, end: 4999 },
  { id: 'cost_of_sales',      label: 'Cost of Sales',      start: 5000, end: 5999 },
  { id: 'operating_expenses', label: 'Operating Expenses', start: 6000, end: 7999 },
  { id: 'other_income',       label: 'Other Income',       start: 8000, end: 8999 },
  { id: 'other_expenses',     label: 'Other Expenses',     start: 9000, end: 9999 },
]

/** Codes are handed out in tens, leaving room to slot accounts in later. */
export const CODE_STEP = 10

/** The two intercompany control accounts every chart must have. */
export const DUE_FROM_CODE = '1500'
export const DUE_TO_CODE = '2500'

/**
 * Reserved so automatic generation can never hand these codes to another
 * account — otherwise the intercompany control accounts could not be created.
 */
const RESERVED_CODES = new Set([Number(DUE_FROM_CODE), Number(DUE_TO_CODE)])

/**
 * accounting_account_type ids (ACCOUNT_TYPE_DEFS) mapped onto the eight code
 * groups. This is what lets the finer 16-type catalogue drive code ranges even
 * though `Account.type` only carries the five broad classes.
 */
const TYPE_ID_TO_GROUP: Record<number, CodeGroup> = {
  1: 'assets', 2: 'assets', 3: 'assets', 4: 'assets', 5: 'assets', 16: 'assets',
  6: 'liabilities', 7: 'liabilities', 8: 'liabilities', 9: 'liabilities',
  10: 'equity',
  11: 'revenue',
  12: 'other_income',
  13: 'cost_of_sales',
  14: 'operating_expenses',
  15: 'other_expenses',
}

/** Fallback when an account has no `accountTypeId`: use its broad class. */
const CLASS_TO_GROUP: Record<AccountType, CodeGroup> = {
  asset: 'assets',
  liability: 'liabilities',
  equity: 'equity',
  income: 'revenue',
  expense: 'operating_expenses',
}

export function codeGroupFor(account: Pick<Account, 'type' | 'accountTypeId'>): CodeGroup {
  if (account.accountTypeId && TYPE_ID_TO_GROUP[account.accountTypeId]) {
    return TYPE_ID_TO_GROUP[account.accountTypeId]
  }
  return CLASS_TO_GROUP[account.type] || 'assets'
}

export function rangeFor(group: CodeGroup) {
  const found = CODE_GROUPS.find((g) => g.id === group)
  return found || CODE_GROUPS[0]
}

/** A code is valid when it is numeric and sits inside its own group's band. */
export function isValidCode(account: Pick<Account, 'code' | 'type' | 'accountTypeId'>): boolean {
  const raw = String(account.code || '').trim()
  if (!/^\d{1,20}$/.test(raw)) return false
  const n = Number(raw)
  const { start, end } = rangeFor(codeGroupFor(account))
  return n >= start && n <= end
}

// ---------------------------------------------------------------------------
// Automatic code generation
// ---------------------------------------------------------------------------

export type CodeAssignment = { id: string; name: string; code: string; group: CodeGroup }

export type CodeGenerationResult = {
  accounts: Account[]
  /** Accounts that received a new code. */
  assigned: CodeAssignment[]
  /** Accounts whose existing code was kept. */
  preserved: CodeAssignment[]
  /** Accounts whose existing code was outside their group's band and was replaced. */
  corrected: { id: string; name: string; from: string; to: string; group: CodeGroup }[]
  /** Accounts that could not be given a code because their band is full. */
  unresolved: { id: string; name: string; group: CodeGroup }[]
}

/**
 * Assign a code to every account that lacks a valid one.
 *
 * Rules: group by code group, sort alphabetically within the group, hand out
 * sequential codes in steps of ten, skip codes already in use, and never touch
 * an account that already has a valid code.
 */
export function generateAccountCodes(input: Account[]): CodeGenerationResult {
  const accounts = input.map((a) => ({ ...a }))
  const assigned: CodeAssignment[] = []
  const preserved: CodeAssignment[] = []
  const corrected: CodeGenerationResult['corrected'] = []
  const unresolved: CodeGenerationResult['unresolved'] = []

  // Codes that are already taken anywhere in the chart are reserved up front,
  // so a preserved code can never be handed to another account.
  const taken = new Set<number>(RESERVED_CODES)
  for (const a of accounts) {
    const raw = String(a.code || '').trim()
    if (/^\d{1,20}$/.test(raw)) taken.add(Number(raw))
  }

  const byGroup = new Map<CodeGroup, Account[]>()
  for (const a of accounts) {
    const group = codeGroupFor(a)
    if (!byGroup.has(group)) byGroup.set(group, [])
    byGroup.get(group)!.push(a)
  }

  for (const [group, list] of byGroup) {
    const { start, end } = rangeFor(group)
    // Alphabetical within the group, so codes read in a predictable order.
    const sorted = [...list].sort((x, y) => x.name.localeCompare(y.name))
    let cursor = start

    for (const account of sorted) {
      if (isValidCode(account)) {
        preserved.push({ id: account.id, name: account.name, code: account.code, group })
        continue
      }

      const previous = String(account.code || '').trim()
      // Find the next free slot at or after the cursor, inside the band.
      let code = -1
      for (let candidate = Math.max(cursor, start); candidate <= end; candidate += CODE_STEP) {
        if (!taken.has(candidate)) { code = candidate; break }
      }
      if (code === -1) {
        // Band exhausted — fall back to any unused slot in the band.
        for (let candidate = start; candidate <= end; candidate += CODE_STEP) {
          if (!taken.has(candidate)) { code = candidate; break }
        }
      }
      if (code === -1) {
        unresolved.push({ id: account.id, name: account.name, group })
        continue
      }

      taken.add(code)
      cursor = code + CODE_STEP
      if (previous) taken.delete(Number(previous))
      account.code = String(code)
      assigned.push({ id: account.id, name: account.name, code: account.code, group })
      if (previous) corrected.push({ id: account.id, name: account.name, from: previous, to: account.code, group })
    }
  }

  // Renumbering an account must not orphan its children: parentCode is a code
  // reference, so it is re-pointed here. parentId is authoritative when it is
  // present; otherwise the old -> new code map is used.
  const codeById = new Map(accounts.map((a) => [a.id, String(a.code || '')]))
  const movedCode = new Map(corrected.map((c) => [c.from, c.to]))
  for (const a of accounts) {
    if (a.parentId) {
      const parentCode = codeById.get(a.parentId)
      if (parentCode && parentCode !== a.parentCode) a.parentCode = parentCode
    } else if (a.parentCode && movedCode.has(a.parentCode)) {
      a.parentCode = movedCode.get(a.parentCode)!
    }
  }

  return { accounts, assigned, preserved, corrected, unresolved }
}

/** The next free code in a group — used by the account editor for new accounts. */
export function nextCodeForGroup(accounts: Account[], group: CodeGroup): string {
  const { start, end } = rangeFor(group)
  const taken = new Set<number>(RESERVED_CODES)
  for (const a of accounts) {
    const raw = String(a.code || '').trim()
    if (/^\d{1,20}$/.test(raw)) taken.add(Number(raw))
  }
  for (let candidate = start; candidate <= end; candidate += CODE_STEP) {
    if (!taken.has(candidate)) return String(candidate)
  }
  return ''
}

// ---------------------------------------------------------------------------
// Scope classification (migration)
// ---------------------------------------------------------------------------

/**
 * Core accounts are genuinely shared: they appear in every company's books and
 * are the ones the spec names as GLOBAL. Matching is on the account name and
 * its detail type so renamed seeds still classify.
 */
const CORE_ACCOUNT_PATTERNS = [
  'cash', 'bank', 'accounts receivable', 'a/r', 'accounts payable', 'a/p',
  'sales revenue', 'sales', 'revenue', 'inventory', 'stock',
  'salaries', 'salary', 'wages', 'rent', 'utilities', 'electricity', 'water',
  'capital', 'retained earnings', 'drawings', 'owner',
  'depreciation', 'amortisation', 'amortization', 'tax', 'vat',
  'prepaid', 'accrued', 'suspense', 'clearing', 'opening balance',
  'cost of sales', 'purchases', 'discount', 'bank charge', 'interest',
  'mobile money', 'momo', 'petty cash', 'fixed asset', 'equipment', 'property',
]

export function isCoreAccount(account: Pick<Account, 'name' | 'detailType'>): boolean {
  const haystack = `${account.name} ${account.detailType || ''}`.toLowerCase()
  return CORE_ACCOUNT_PATTERNS.some((needle) => haystack.includes(needle))
}

export type ScopeClassification = { scope: AccountScope; needsReview: boolean; reason: string }

/**
 * Decide the ownership level of an account.
 *
 * An explicit branch wins, then company, then the core-account heuristic.
 * Anything that cannot be decided defaults to GLOBAL and is flagged for
 * administrator review, as specified.
 */
export function classifyScope(account: Account): ScopeClassification {
  if (account.scopeType === 'GLOBAL' || account.scopeType === 'COMPANY' || account.scopeType === 'BRANCH') {
    // An existing classification stands, but a review flag raised earlier (e.g.
    // by orphan reconciliation) must survive every subsequent load.
    return {
      scope: account.scopeType,
      needsReview: Boolean(account.scopeNeedsReview),
      reason: account.scopeNeedsReview
        ? 'Previously flagged for administrator review.'
        : 'Already classified.',
    }
  }
  if (account.branchId && account.companyId) {
    return { scope: 'BRANCH', needsReview: false, reason: 'Assigned to a single branch.' }
  }
  if (account.companyId) {
    return { scope: 'COMPANY', needsReview: false, reason: 'Assigned to a single company.' }
  }
  if (isCoreAccount(account)) {
    return { scope: 'GLOBAL', needsReview: false, reason: 'Core account shared by all companies and branches.' }
  }
  return { scope: 'GLOBAL', needsReview: true, reason: 'No ownership recorded and not a recognised core account.' }
}

export type MigrationResult = {
  accounts: Account[]
  assigned: CodeAssignment[]
  preserved: CodeAssignment[]
  corrected: CodeGenerationResult['corrected']
  unresolved: CodeGenerationResult['unresolved']
  /** Accounts flagged for administrator review. */
  needsReview: { id: string; name: string; reason: string }[]
  counts: Record<AccountScope, number>
}

/**
 * One-off upgrade of an existing chart: stamp a scope on every account and fill
 * in any missing codes. Account ids are never changed, so existing journal
 * entries and ledger history stay linked.
 */
export function migrateChartOfAccounts(input: Account[]): MigrationResult {
  const classified = input.map((account) => {
    const { scope, needsReview, reason } = classifyScope(account)
    const next: Account = {
      ...account,
      scopeType: scope,
      // Keep the scope/ownership fields consistent with the rules.
      companyId: scope === 'GLOBAL' ? undefined : account.companyId,
      branchId: scope === 'BRANCH' ? account.branchId : undefined,
      scopeNeedsReview: needsReview || account.scopeNeedsReview || undefined,
    }
    return { next, needsReview, reason }
  })

  const { accounts, assigned, preserved, corrected, unresolved } = generateAccountCodes(
    classified.map((c) => c.next),
  )

  const needsReview = classified
    .filter((c) => c.needsReview)
    .map((c, i) => ({ id: accounts[i].id, name: accounts[i].name, reason: c.reason }))

  const counts: Record<AccountScope, number> = { GLOBAL: 0, COMPANY: 0, BRANCH: 0 }
  for (const a of accounts) counts[a.scopeType || 'GLOBAL'] += 1

  return { accounts, assigned, preserved, corrected, unresolved, needsReview, counts }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type AccountValidation = { ok: boolean; errors: string[] }

/**
 * Rules 1–5 from the spec. Rule 6 (journal entries stay linked) is structural —
 * ids are never rewritten — and rule 7 (no orphans) is enforced on delete.
 */
export function validateAccount(
  candidate: Account,
  all: Account[],
  ctx: { companyExists: (id: string) => boolean; branchExists: (id: string) => boolean },
): AccountValidation {
  const errors: string[] = []
  const scope = candidate.scopeType || 'GLOBAL'
  const name = (candidate.name || '').trim()

  if (!name) errors.push('Account name is required.')

  // 3/4/5 — ownership fields must match the declared scope.
  if (scope === 'GLOBAL') {
    if (candidate.companyId) errors.push('A GLOBAL account cannot belong to a company.')
    if (candidate.branchId) errors.push('A GLOBAL account cannot belong to a branch.')
  } else if (scope === 'COMPANY') {
    if (!candidate.companyId) errors.push('A COMPANY account must be assigned to a company.')
    if (candidate.branchId) errors.push('A COMPANY account cannot belong to a branch.')
  } else if (scope === 'BRANCH') {
    if (!candidate.companyId) errors.push('A BRANCH account must be assigned to a company.')
    if (!candidate.branchId) errors.push('A BRANCH account must be assigned to a branch.')
  }

  if (candidate.companyId && !ctx.companyExists(candidate.companyId)) {
    errors.push('The assigned company does not exist.')
  }
  if (candidate.branchId && !ctx.branchExists(candidate.branchId)) {
    errors.push('The assigned branch does not exist.')
  }

  // 2 — codes are unique across the whole chart.
  const code = String(candidate.code || '').trim()
  if (code) {
    const dupeCode = all.some((a) => a.id !== candidate.id && String(a.code || '').trim() === code)
    if (dupeCode) errors.push(`Account code ${code} is already in use.`)
    if (!isValidCode(candidate)) {
      const { start, end } = rangeFor(codeGroupFor(candidate))
      errors.push(`Code ${code} is outside the ${rangeFor(codeGroupFor(candidate)).label} range ${start}–${end}.`)
    }
  }

  // 1 — names are unique within the same scope.
  const sameScope = (a: Account) => {
    const s = a.scopeType || 'GLOBAL'
    if (s !== scope) return false
    if (scope === 'COMPANY') return a.companyId === candidate.companyId
    if (scope === 'BRANCH') return a.companyId === candidate.companyId && a.branchId === candidate.branchId
    return true
  }
  if (name) {
    const dupeName = all.some(
      (a) => a.id !== candidate.id && sameScope(a) && (a.name || '').trim().toLowerCase() === name.toLowerCase(),
    )
    if (dupeName) errors.push(`An account named “${name}” already exists in this scope.`)
  }

  return { ok: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Visibility and reporting
// ---------------------------------------------------------------------------

export type AccountViewer = {
  companyId?: string
  branchId?: string
  /** Super Admin sees every account in every company. */
  isSuperAdmin?: boolean
}

/** GLOBAL + own COMPANY + own BRANCH. Nothing from other tenants. */
export function isAccountVisible(account: Account, viewer: AccountViewer): boolean {
  if (viewer.isSuperAdmin) return true
  const scope = account.scopeType || 'GLOBAL'
  if (scope === 'GLOBAL') return true
  if (!viewer.companyId) return false
  if (account.companyId !== viewer.companyId) return false
  if (scope === 'COMPANY') return true
  return Boolean(viewer.branchId) && account.branchId === viewer.branchId
}

export function visibleAccounts(accounts: Account[], viewer: AccountViewer): Account[] {
  return accounts.filter((a) => isAccountVisible(a, viewer))
}

export type ReportLevel = 'branch' | 'company' | 'group'

/**
 * The account set a report should run against.
 *  - branch  → GLOBAL + COMPANY + BRANCH available to that branch
 *  - company → GLOBAL + COMPANY, with all branches consolidated
 *  - group   → every scope across every company
 */
export function accountsForReport(accounts: Account[], level: ReportLevel, viewer: AccountViewer): Account[] {
  if (level === 'group') return accounts
  if (level === 'company') {
    return accounts.filter((a) => {
      const scope = a.scopeType || 'GLOBAL'
      if (scope === 'GLOBAL') return true
      if (!viewer.companyId) return false
      return scope === 'COMPANY' && a.companyId === viewer.companyId
    })
  }
  return visibleAccounts(accounts, viewer)
}

// ---------------------------------------------------------------------------
// Orphan reconciliation (validation rule 7)
// ---------------------------------------------------------------------------

export type OrphanReconciliation = {
  accounts: Account[]
  /** Accounts whose owning company or branch no longer exists. */
  repaired: { id: string; name: string; reason: string }[]
}

/**
 * A deleted company or branch must not leave accounts pointing at it.
 *
 * Such accounts are not deleted — that would orphan their journal entries — so
 * instead the dead ownership link is dropped, the account falls back to GLOBAL,
 * and it is flagged for administrator review.
 */
export function reconcileOrphanedAccounts(
  accounts: Account[],
  refs: { companyIds: Set<string>; branchIds: Set<string> },
): OrphanReconciliation {
  const repaired: OrphanReconciliation['repaired'] = []
  const next = accounts.map((account) => {
    const scope = account.scopeType || 'GLOBAL'
    if (scope === 'GLOBAL') return account

    const companyGone = Boolean(account.companyId) && !refs.companyIds.has(account.companyId!)
    const branchGone = Boolean(account.branchId) && !refs.branchIds.has(account.branchId!)
    if (!companyGone && !branchGone) return account

    repaired.push({
      id: account.id,
      name: account.name,
      reason: companyGone
        ? 'Owning company was deleted — moved to GLOBAL for review.'
        : 'Owning branch was deleted — moved to GLOBAL for review.',
    })
    return { ...account, scopeType: 'GLOBAL' as AccountScope, companyId: undefined, branchId: undefined, scopeNeedsReview: true }
  })
  return { accounts: next, repaired }
}

// ---------------------------------------------------------------------------
// Intercompany accounts
// ---------------------------------------------------------------------------

/**
 * The two control accounts every chart needs for intercompany balances, plus
 * one child per company (1510/1520… Due From, 2510/2520… Due To).
 */
export function buildIntercompanyAccounts(
  companies: { id: string; name: string }[],
  existing: Account[],
): Account[] {
  const out: Account[] = []
  const hasCode = (code: string) => existing.some((a) => String(a.code || '').trim() === code)
  const hasName = (name: string) =>
    existing.some((a) => (a.name || '').trim().toLowerCase() === name.toLowerCase())

  const control: { code: string; name: string; type: AccountType; accountTypeId: number; detailType: string }[] = [
    { code: DUE_FROM_CODE, name: 'Due From Related Companies', type: 'asset', accountTypeId: 2, detailType: 'Current Assets' },
    { code: DUE_TO_CODE, name: 'Due To Related Companies', type: 'liability', accountTypeId: 8, detailType: 'Current Liabilities' },
  ]

  for (const c of control) {
    if (!hasCode(c.code) && !hasName(c.name)) {
      out.push({
        id: `ac_ic_${c.code}`,
        code: c.code,
        name: c.name,
        type: c.type,
        accountTypeId: c.accountTypeId,
        detailType: c.detailType,
        scopeType: 'GLOBAL',
        primaryBalance: 0,
        status: 'active',
        description: 'Intercompany control account.',
      })
    }
  }

  // Children are GLOBAL control accounts split by counterparty company; they are
  // deliberately not owned by a single company, since both sides post to them.
  companies.forEach((company, index) => {
    const dueFromCode = String(1510 + index * CODE_STEP)
    const dueToCode = String(2510 + index * CODE_STEP)
    const dueFromName = `Due From ${company.name}`
    const dueToName = `Due To ${company.name}`
    if (!hasCode(dueFromCode) && !hasName(dueFromName)) {
      out.push({
        id: `ac_ic_from_${company.id}`,
        code: dueFromCode,
        name: dueFromName,
        type: 'asset',
        accountTypeId: 2,
        detailType: 'Current Assets',
        scopeType: 'GLOBAL',
        parentCode: DUE_FROM_CODE,
        primaryBalance: 0,
        status: 'active',
      })
    }
    if (!hasCode(dueToCode) && !hasName(dueToName)) {
      out.push({
        id: `ac_ic_to_${company.id}`,
        code: dueToCode,
        name: dueToName,
        type: 'liability',
        accountTypeId: 8,
        detailType: 'Current Liabilities',
        scopeType: 'GLOBAL',
        parentCode: DUE_TO_CODE,
        primaryBalance: 0,
        status: 'active',
      })
    }
  })

  return out
}
