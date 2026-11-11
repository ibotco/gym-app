// Shared engine for the Financial Reporting Preferences (Accounting → Settings
// → Financial Reporting Preferences). Every financial report reads its prefs
// through resolveFinPrefs on each render, so toggles take effect immediately.
import type { AccountingSettings } from '../types'

export interface FinancialReportingPrefs {
  showAccountCodes: boolean
  includeZeroBalanceAccounts: boolean
  expandAccountGroups: boolean
  enableComparativePeriods: boolean
  showReportNotes: boolean
}

export const FIN_REPORTING_DEFAULTS: FinancialReportingPrefs = {
  showAccountCodes: true,
  includeZeroBalanceAccounts: false,
  expandAccountGroups: true,
  enableComparativePeriods: true,
  showReportNotes: true,
}

/** Normalized prefs with defaults backfilled — safe for settings saved before this section existed. */
export const resolveFinPrefs = (
  settings?: Pick<AccountingSettings, 'financialReporting'> | null,
): FinancialReportingPrefs => ({ ...FIN_REPORTING_DEFAULTS, ...(settings?.financialReporting || {}) })

/**
 * Row-visibility rule for the "Include Zero Balance Accounts" preference:
 * - enabled  → every account shows, whatever its balance or activity;
 * - disabled → an account shows only when at least one stated balance is
 *   visibly non-zero. The threshold matches the reports' display rounding
 *   (formatGhs shows whole cedis), so anything that would print as "GH₵0"
 *   is treated as a zero balance.
 */
export const keepAccountRowAt = (prefs: FinancialReportingPrefs, minVisible: number, ...balances: number[]): boolean =>
  prefs.includeZeroBalanceAccounts || balances.some((v) => Math.abs(Number(v) || 0) >= minVisible)

export const keepAccountRow = (prefs: FinancialReportingPrefs, ...balances: number[]): boolean =>
  keepAccountRowAt(prefs, 0.5, ...balances)

/** A row of a treegrid report: section/parent rows nest leaf/total rows by depth. */
export interface TreeishRow {
  depth: number
  kind: string
  amount?: number
}

/**
 * Drops rows that would print as zero while "Include Zero Balance Accounts"
 * is off: leaf/total rows whose stated amounts are all below the visible
 * minimum, plus any parent row left without a visible descendant.
 * Comparative reports pass `amountsOf` so a row survives when either column
 * has a visible amount.
 */
export const pruneZeroRows = <T extends TreeishRow>(
  prefs: FinancialReportingPrefs,
  minVisible: number,
  rows: T[],
  amountsOf: (r: T) => (number | undefined)[] = (r) => [r.amount],
): T[] => {
  if (prefs.includeZeroBalanceAccounts) return rows
  const kept = rows.map((r) =>
    r.kind === 'parent' || amountsOf(r).some((v) => Math.abs(Number(v) || 0) >= minVisible),
  )
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].kind !== 'parent') continue
    for (let j = i + 1; j < rows.length && rows[j].depth > rows[i].depth; j++) {
      if (kept[j]) {
        kept[i] = true
        break
      }
    }
  }
  return rows.filter((_, i) => kept[i])
}
