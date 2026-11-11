/**
 * Auto-assignment of Chart of Accounts rows to the notes **you** have entered.
 *
 * The Map Chart of Accounts action is an assistant, not a generator: it never
 * invents a note number, never edits a note and never overwrites an assignment.
 * It matches each chart row that is not on a note yet against the names (and,
 * where written, the descriptions) of the active notes on file, and reports the
 * rows it could not place so they can be assigned by hand.
 *
 * A row is "on a note" when it carries a Note No. of its own **or** inherits one
 * from the account above it: the sub-accounts of a note account are already
 * part of that note, and are never re-matched onto another one.
 *
 * The notes it maps to are the open ones **and the parked ones** — the
 * definitions Unmap kept. That is what makes Unmap → Map a round trip: matching
 * a parked note puts its number back on the chart, which brings it straight back
 * Active. A note the user deactivated by hand is not parked and stays off.
 */
import type { Account, AccountNote } from '../types'
import { isMapCandidate, isReservedAccountNoteNo, noteDescriptionOf, noteOwnership, statementForAccountType } from './noteMeta'

/** Words too common to signal a match. */
const STOPWORDS = new Set(['and', 'of', 'the', 'for', 'to', 'in', 'on', 'with', 'per', 'other', 'accounts', 'account', 'notes', 'note'])

const tokens = (text?: string): string[] =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

/**
 * Rows that *are* a bank or mobile-money account — not merely rows with "bank"
 * in their name, so "Bank charges" is never swept into the cash note.
 */
const BANK_TYPE_ID = 16
const isBankAccount = (a: Account) =>
  a.type === 'asset' && (Number(a.accountTypeId) === BANK_TYPE_ID || /^(bank|mobile money)$/i.test((a.detailType || '').trim()))

export type NoteMappingResult = {
  /** Column writes: only the Note No. — apply through patchAccounts. */
  updates: { id: string; patch: Partial<Account> }[]
  /** How many rows each note gained, keyed by note number. */
  byNoteNo: Map<string, number>
  /** Rows with no Note No. that no note's wording matched. */
  unmatched: Account[]
  /** Rows skipped because they already carry a Note No. */
  alreadyAssigned: number
}

/**
 * Match every unassigned chart row to the best-fitting active note. A row is
 * only placed when the match is confident (a shared significant word, or the
 * note's own description naming it), so nothing wanders onto a note by guess.
 */
export function matchAccountsToNotes(accounts: Account[], notes: AccountNote[]): NoteMappingResult {
  const active = notes.filter((n) => isMapCandidate(n) && !isReservedAccountNoteNo(n.noteNo))
  const candidates = active.map((note) => {
    const anchor = note.accountId ? accounts.find((a) => a.id === note.accountId) : undefined
    const name = anchor?.name || note.name || ''
    return {
      note,
      anchor,
      nameTokens: tokens(name),
      descTokens: tokens(noteDescriptionOf(note)),
    }
  })

  const updates: { id: string; patch: Partial<Account> }[] = []
  const byNoteNo = new Map<string, number>()
  const unmatched: Account[] = []
  let alreadyAssigned = 0

  const ownership = noteOwnership(accounts)
  for (const account of accounts) {
    // Never touch a row that answers to a note already — its own Note No., or
    // the number it inherits from its note account. That is the user's work.
    if (ownership.has(account.id)) { alreadyAssigned++; continue }
    const accountTokens = tokens(account.name)
    let best: { score: number; noteNo: string } | undefined
    for (const cand of candidates) {
      if (cand.anchor?.id === account.id) continue
      const sharedName = accountTokens.filter((w) => cand.nameTokens.includes(w)).length
      // Fall back to the note's description only when the name says nothing.
      const sharedDesc = sharedName === 0 ? accountTokens.filter((w) => cand.descTokens.includes(w)).length : 0
      let score = sharedName + Math.min(sharedDesc * 0.5, 1)
      // A bank/momo row belongs with the cash note, the way statements expect,
      // even when no word matches (GCB, MTN, an account number…).
      if (isBankAccount(account) && (cand.nameTokens.includes('cash') || cand.nameTokens.includes('bank'))) score += 1
      // Word overlap alone may be weak; type and statement agreement confirm it.
      // They never place a row on their own (0.75 < the 1 point threshold).
      if (score > 0) {
        if (cand.anchor && cand.anchor.type === account.type) score += 0.5
        if (cand.note.noteStatement === statementForAccountType(account.type)) score += 0.25
      }
      if (score <= 0) continue
      if (!best || score > best.score) best = { score, noteNo: cand.note.noteNo }
    }
    if (best && best.score >= 1) {
      updates.push({ id: account.id, patch: { noteNo: best.noteNo } })
      byNoteNo.set(best.noteNo, (byNoteNo.get(best.noteNo) || 0) + 1)
    } else {
      unmatched.push(account)
    }
  }

  return { updates, byNoteNo, unmatched, alreadyAssigned }
}

/** Human summary of a mapping pass, for the toast and the audit log. */
export function describeMapping(result: NoteMappingResult): string {
  const parts = [`${result.updates.length} account(s) assigned to ${result.byNoteNo.size} note(s)`]
  if (result.alreadyAssigned) parts.push(`${result.alreadyAssigned} already on a note`)
  if (result.unmatched.length) parts.push(`${result.unmatched.length} left to assign by hand`)
  return parts.join(' · ')
}
