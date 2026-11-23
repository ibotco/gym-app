/**
 * The Statement of Financial Position, built from the chart.
 *
 * This is the report that used to print **"Statement is out of balance by
 * GHS…"**. Four things were wrong with the way it was put together, and they
 * compounded into a difference that could never be right:
 *
 *   1. **Signs.** Liabilities and equity were sign-flipped twice, so they entered
 *      the "represented by" side negative — on a balanced ledger the report
 *      showed *negative assets* and a huge bogus difference.
 *   2. **Opening balances were ignored.** The statement counted voucher activity
 *      only, but the chart's own `primary_balance` is where opening balances
 *      live, so every account that had been set up by balance was missing.
 *   3. **Coverage was note-headings only**, and headings named like a bank
 *      account were dropped outright — assets vanished while their counterparts
 *      stayed, guaranteeing an imbalance.
 *   4. **Non-current liabilities had no section**, so they were listed under
 *      "Less: Current liabilities".
 *
 * The rules here:
 *
 *   - Every **active** account is counted **exactly once**, at its own balance:
 *     an account that answers to a note number is totalled into that note's row
 *     (the cascade: the note's own account plus its sub-accounts), and every
 *     other account gets its own row in its section.
 *   - Amounts are as at the period end: opening balance + signed movement, with
 *     liabilities, equity and income credit-positive (the convention the
 *     liquidity model and the Financial Reports already use).
 *   - Sections follow IAS 1 presentation: non-current assets, current assets,
 *     equity, non-current liabilities, current liabilities. A fund/capital row
 *     classifies as equity; an asset named "…fund" stays an asset.
 *   - Profit for the period is income − expense on the same basis and is shown
 *     as a line in equity, because the statement is "as at" a date.
 *
 * The statement therefore foots **by construction**: the two sides always agree,
 * whether or not the ledger itself does. When the books do not balance — opening
 * balances keyed in without a contra entry are the usual cause, a voucher whose
 * lines do not add up another — the residual is not an error message. It is
 * disclosed as a labelled equity line, *Suspense account (unposted difference)*,
 * and the statement foots with it included; the line disappears as soon as the
 * difference is cleared in the ledger.
 */
import type { Account, AccountNote } from '../types'
import { isNoteActive, noteOwnership } from './noteMeta'

export type SofpSectionId = 'nca' | 'ca' | 'eq' | 'ncl' | 'cl'

export type SofpRow = {
  key: string
  code?: string
  name: string
  /** Note number this row carries, when it is a note's row. */
  noteNo?: string
  /** Amount as at the period end (current column). */
  amount: number
  /** The same, one period earlier. */
  amount2: number
}

export type SofpSection = {
  id: SofpSectionId
  label: string
  rows: SofpRow[]
  total: number
  total2: number
}

export type SofpStatement = {
  sections: SofpSection[]
  nca: SofpSection
  ca: SofpSection
  eq: SofpSection
  ncl: SofpSection
  cl: SofpSection
  /** Non-current assets + current assets. */
  totalAssets: number
  totalAssets2: number
  currentAssetsLessLiabilities: number
  currentAssetsLessLiabilities2: number
  /** Profit for the period — income less expenses, credit-positive. */
  profit: number
  profit2: number
  /** Equity rows + profit + the balancing figure when one is needed. */
  totalEquity: number
  totalEquity2: number
  /** Equity + non-current liabilities + current liabilities. */
  totalEquityAndLiabilities: number
  totalEquityAndLiabilities2: number
  /**
   * The ledger's own residual after every account has been counted: assets −
   * (liabilities + equity + profit). Zero when the books balance. Absorbed into
   * equity as `balancing` so the statement foots either way.
   */
  difference: number
  difference2: number
  /** The suspense amount shown in equity (0 when the books balance). */
  balancing: number
  balancing2: number
}

const NON_CURRENT = /non[- ]current|long[- ]term|property|plant|equipment|building|vehicle|land|lease|intangible/i
const FUND_LIKE = /capital|retained|accumulated fund|fund/i

/** Where a balance-sheet account belongs. P&L accounts return null. */
export function sofpSectionOf(a: Account): SofpSectionId | null {
  if (a.type === 'asset') return NON_CURRENT.test(`${a.detailType || ''} ${a.name}`) ? 'nca' : 'ca'
  if (a.type === 'equity') return 'eq'
  if (a.type === 'liability') {
    // A fund/capital row is equity even when classified as a liability.
    if (FUND_LIKE.test(`${a.name} ${a.detailType || ''}`)) return 'eq'
    return NON_CURRENT.test(`${a.detailType || ''} ${a.name}`) ? 'ncl' : 'cl'
  }
  return null
}

const SECTION_ORDER: SofpSectionId[] = ['nca', 'ca', 'cl', 'ncl', 'eq']
const SECTION_LABELS: Record<SofpSectionId, string> = {
  nca: 'Non-current assets',
  ca: 'Current assets',
  cl: 'Current liabilities',
  ncl: 'Non-current liabilities',
  eq: 'Equity',
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function buildSofp(input: {
  accounts: Account[]
  notes: AccountNote[]
  /** Amount of one account as at the end of this period. */
  amountOf: (a: Account) => number
  /** The same for the comparative (earlier) period. */
  amountOf2: (a: Account) => number
  /** List rows that are zero in both columns (default: hide them). */
  showZero?: boolean
}): SofpStatement {
  const { accounts, notes, amountOf, amountOf2, showZero = false } = input

  const active = accounts.filter((a) => a.status !== 'inactive')
  const activeById = new Map(active.map((a) => [a.id, a]))
  const ownership = noteOwnership(accounts)

  // Which note number each balance-sheet account answers to — its own, or the
  // one it inherits from the note account above it.
  const noteNoOf = (a: Account) => ownership.get(a.id)?.noteNo

/** Note numbers that have an active balance-sheet note behind them. */
  const noteByNo = new Map<string, AccountNote>()
  for (const n of notes) {
    if (!isNoteActive(n) || n.statement !== 'balance_sheet') continue
    const heading = n.accountId ? activeById.get(n.accountId) : undefined
    if (!heading || sofpSectionOf(heading) === null) continue
    noteByNo.set(n.noteNo, n)
  }

  /**
   * Every balance-sheet account, in exactly one bucket: the note it answers to
   * (its own number, or the one it inherits from the note account above it), or
   * `loose` — its own row. Nothing can be counted twice, and nothing is dropped
   * because it has no note, because its note is inactive, or because of its name.
   */
  const buckets = new Map<string, Account[]>()
  const loose: Account[] = []
  for (const a of active) {
    if (a.type === 'income' || a.type === 'expense') continue
    const noteNo = noteNoOf(a)
    if (noteNo && noteByNo.has(noteNo)) {
      const list = buckets.get(noteNo)
      if (list) list.push(a)
      else buckets.set(noteNo, [a])
    } else {
      loose.push(a)
    }
  }
  const noteAmount = (noteNo: string, fn: (a: Account) => number) => (buckets.get(noteNo) || []).reduce((s, a) => s + fn(a), 0)

  /**
   * The account a note is named by — resolved through the cascade (the account
   * that carries the number and owns it), falling back to the note's own record
   * so an older note whose accountId has since been repointed still lists.
   */
  const headingOfNote = (noteNo: string, n: AccountNote): Account | undefined => {
    const carrier = active.find((a) => noteNoOf(a) === noteNo)
    const ownerId = carrier ? ownership.get(carrier.id)?.ownerId : undefined
    const owner = ownerId ? activeById.get(ownerId) : undefined
    if (owner && sofpSectionOf(owner) !== null) return owner
    return n.accountId ? activeById.get(n.accountId) : undefined
  }

  const rowsFor = (id: SofpSectionId): SofpRow[] => {
    const rows: SofpRow[] = []

    // 1. One row per note whose account lives in this section.
    const noteRows = Array.from(noteByNo.entries())
      .map(([noteNo, n]) => ({ noteNo, heading: headingOfNote(noteNo, n) }))
      .filter((x) => !!x.heading && sofpSectionOf(x.heading) === id)
      .sort((a, b) => a.noteNo.localeCompare(b.noteNo, undefined, { numeric: true }))
    for (const { noteNo, heading } of noteRows) {
      rows.push({
        key: `note-${noteNo}`,
        code: heading!.code || undefined,
        name: heading!.name,
        noteNo,
        amount: round2(noteAmount(noteNo, amountOf)),
        amount2: round2(noteAmount(noteNo, amountOf2)),
      })
    }

    // 2. Every account not on an active note, on its own row in its section.
    const own = loose
      .filter((a) => sofpSectionOf(a) === id)
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }) || a.name.localeCompare(b.name))
    for (const a of own) {
      rows.push({
        key: `acc-${a.id}`,
        code: a.code || undefined,
        name: a.name,
        amount: round2(amountOf(a)),
        amount2: round2(amountOf2(a)),
      })
    }

    return showZero ? rows : rows.filter((r) => Math.abs(r.amount) > 0.005 || Math.abs(r.amount2) > 0.005)
  }

  const sections = SECTION_ORDER.map((id) => {
    const rows = rowsFor(id)
    return {
      id,
      label: SECTION_LABELS[id],
      rows,
      total: round2(rows.reduce((s, r) => s + r.amount, 0)),
      total2: round2(rows.reduce((s, r) => s + r.amount2, 0)),
    }
  })
  const [nca, ca, cl, ncl, eq] = sections

  // Profit for the period: income (credit-positive) less expenses (debit-positive).
  const profit = round2(
    active.filter((a) => a.type === 'income').reduce((s, a) => s + amountOf(a), 0) -
    active.filter((a) => a.type === 'expense').reduce((s, a) => s + amountOf(a), 0),
  )
  const profit2 = round2(
    active.filter((a) => a.type === 'income').reduce((s, a) => s + amountOf2(a), 0) -
    active.filter((a) => a.type === 'expense').reduce((s, a) => s + amountOf2(a), 0),
  )

  const totalAssets = round2(nca.total + ca.total)
  const totalAssets2 = round2(nca.total2 + ca.total2)
  const incomeStatementEquity = round2(eq.total + profit)
  const incomeStatementEquity2 = round2(eq.total2 + profit2)
  const liabilities = round2(cl.total + ncl.total)
  const difference = round2(totalAssets - (liabilities + incomeStatementEquity))
  const difference2 = round2(totalAssets2 - ((cl.total2 + ncl.total2) + incomeStatementEquity2))

  // The balancing figure: the ledger residual, presented rather than shouted
  // about. `difference` is assets minus the represented-by side, so it is added
  // to equity to make the two sides meet. Zero for books that balance, so it
  // adds nothing and shows nowhere.
  const balancing = Math.abs(difference) > 0.005 ? difference : 0
  const balancing2 = Math.abs(difference2) > 0.005 ? difference2 : 0

  const totalEquity = round2(incomeStatementEquity + balancing)
  const totalEquity2 = round2(incomeStatementEquity2 + balancing2)

  return {
    sections, nca, ca, eq, ncl, cl,
    totalAssets, totalAssets2,
    currentAssetsLessLiabilities: round2(ca.total - cl.total),
    currentAssetsLessLiabilities2: round2(ca.total2 - cl.total2),
    profit, profit2,
    totalEquity, totalEquity2,
    totalEquityAndLiabilities: round2(liabilities + totalEquity),
    totalEquityAndLiabilities2: round2(round2(cl.total2 + ncl.total2) + totalEquity2),
    difference, difference2,
    balancing, balancing2,
  }
}
