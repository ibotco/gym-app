/**
 * Every account in the Chart of Accounts is **Active**.
 *
 * The seeds ship Active and `loadAccounts()` keeps seeded rows in step on every
 * load, so a fresh browser starts all active. This module covers the other half:
 * stores that already hold deactivated rows — accounts switched off by hand, or
 * seeded inactive by an older release. It runs **once per browser**, so
 * afterwards the Active switch on the chart is yours again: deactivating an
 * account later is never silently undone by a later boot.
 *
 * Only `status` is touched — codes, names, parents, balances and the note
 * columns are left exactly as they are.
 */
import type { Account, BankAccount } from '../types'
import { ACCOUNTS_KEY, BANKS_KEY } from './accounting'

/** Set once every account has been switched on in this browser. */
export const ACCOUNTS_ACTIVE_STAMP = 'fitpro_accounts_all_active_v1'

/** Minimal storage surface — a real `localStorage` or a test double. */
type Storage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } | undefined

type StatusRow = { status?: 'active' | 'inactive' }

const read = <T,>(storage: Storage, key: string): T[] | null => {
  try {
    const raw = storage?.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch {
    return null
  }
}

const write = (storage: Storage, key: string, value: unknown) => {
  try {
    storage?.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/**
 * The rows as they should read: every one Active. A row is only rewritten when
 * it is explicitly `'inactive'` — an absent status already means active, so such
 * rows are returned untouched (same object), which keeps this a no-op when there
 * is nothing to change.
 */
export function activateAll<T extends StatusRow>(rows: T[]): { rows: T[]; changed: number } {
  let changed = 0
  const next = rows.map((row) => {
    if (row.status !== 'inactive') return row
    changed++
    return { ...row, status: 'active' as const }
  })
  return { rows: next, changed }
}

export type ActivateSummary = {
  /** Chart of Accounts rows switched on. */
  accounts: number
  /** Bank accounts (Banking → Bank Accounts) switched on. */
  banks: number
  /** False when the pass had already run in this browser. */
  ran: boolean
}

/**
 * Switch every Chart of Accounts row (and bank account) Active — once per
 * browser. Returns what changed, or `{ ran: false }` when the pass has already
 * stamped this store.
 */
export function runActivateAllAccountsOnce(
  storage: Storage = typeof localStorage === 'undefined' ? undefined : localStorage,
): ActivateSummary {
  if (!storage) return { accounts: 0, banks: 0, ran: false }
  try {
    if (storage.getItem(ACCOUNTS_ACTIVE_STAMP)) return { accounts: 0, banks: 0, ran: false }
  } catch {
    return { accounts: 0, banks: 0, ran: false }
  }

  const accounts = read<Account>(storage, ACCOUNTS_KEY)
  const banks = read<BankAccount>(storage, BANKS_KEY)

  const accountResult = accounts ? activateAll(accounts) : { rows: null, changed: 0 }
  const bankResult = banks ? activateAll(banks) : { rows: null, changed: 0 }

  if (accountResult.rows && accountResult.changed) write(storage, ACCOUNTS_KEY, accountResult.rows)
  if (bankResult.rows && bankResult.changed) write(storage, BANKS_KEY, bankResult.rows)

  // Stamped even when nothing needed changing, so the pass never runs twice.
  try {
    storage.setItem(ACCOUNTS_ACTIVE_STAMP, '1')
  } catch {
    /* ignore */
  }
  return { accounts: accountResult.changed, banks: bankResult.changed, ran: true }
}
