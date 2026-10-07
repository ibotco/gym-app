/**
 * Bank reconciliation math — pure helpers powering the QuickBooks-style
 * workflow. Ledger rows posted to a bank account (AccountHistoryEntry with
 * `account === bank.code`) are the matchable items: debits = money in
 * (deposits), credits = money out (withdrawals).
 */
import type { AccountHistoryEntry, BankAccount, BankReconciliation } from '../types'

export type ReconDirection = 'deposit' | 'withdrawal'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Direction of a ledger row against the bank account. */
export function entryDirection(e: AccountHistoryEntry): ReconDirection {
  return e.debit >= e.credit ? 'deposit' : 'withdrawal'
}

/**
 * Ledger rows belonging to a bank account, oldest first.
 *
 * Postings carry the chart ACCOUNT ID in `account` (e.g. `ac_1100`), while
 * older rows may carry the bank CODE (e.g. `1020`) — match either so the
 * reconciliation workspace and report always see the bank's transactions.
 */
export function bankEntries(history: AccountHistoryEntry[], bank: Pick<BankAccount, 'code' | 'id'>): AccountHistoryEntry[] {
  const keys = new Set([bank.id, bank.code].filter(Boolean) as string[])
  if (!keys.size) return []
  return history
    .filter((e) => keys.has(e.account))
    .sort((a, b) => a.dateCreated.localeCompare(b.dateCreated) || a.id.localeCompare(b.id))
}

/**
 * Rows available to match in a statement window: posted on or before the
 * statement end date and after the period start (when given).
 */
export function windowEntries(entries: AccountHistoryEntry[], periodStart?: string, statementDate?: string): AccountHistoryEntry[] {
  return entries.filter((e) => {
    const d = e.dateCreated.slice(0, 10)
    if (statementDate && d > statementDate) return false
    if (periodStart && d < periodStart) return false
    return true
  })
}

export interface ReconSummary {
  clearedDeposits: number
  clearedWithdrawals: number
  clearedCount: number
  /** Ending book balance after cleared items. */
  endingBook: number
  unclearedCount: number
}

/** Running totals for the workspace difference meter. */
export function reconSummary(
  entries: AccountHistoryEntry[],
  clearedIds: ReadonlySet<string> | string[],
  startingBalance: number,
): ReconSummary {
  const ids = clearedIds instanceof Set ? clearedIds : new Set(clearedIds)
  let clearedDeposits = 0
  let clearedWithdrawals = 0
  let clearedCount = 0
  let unclearedCount = 0
  for (const e of entries) {
    if (ids.has(e.id)) {
      clearedCount++
      if (entryDirection(e) === 'deposit') clearedDeposits += e.debit
      else clearedWithdrawals += e.credit
    } else unclearedCount++
  }
  return {
    clearedDeposits: round2(clearedDeposits),
    clearedWithdrawals: round2(clearedWithdrawals),
    clearedCount,
    endingBook: round2(startingBalance + clearedDeposits - clearedWithdrawals),
    unclearedCount,
  }
}

/** Difference the user must drive to zero: statement balance − ending book balance. */
export const reconDifference = (statementBalance: number, s: ReconSummary) => round2(statementBalance - s.endingBook)

/**
 * QuickBooks-style carry-forward: the first session starts from the bank's
 * opening balance; later sessions start from the previous statement's
 * reconciled ending balance.
 */
export function computeStartingBalance(bank: Pick<BankAccount, 'openingBalance'>, previous?: Pick<BankReconciliation, 'bookBalance'>): number {
  return previous ? previous.bookBalance : bank.openingBalance
}

/** Day after an ISO date — default start of the next statement window (UTC-safe). */
export function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}
