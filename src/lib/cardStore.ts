/**
 * Card Management storage.
 *
 * Card Management is universal — it serves students, staff and members — so its
 * data no longer belongs inside the education module's store. This is its own
 * per-branch store, with a one-time migration that lifts any card data already
 * sitting in the education records.
 *
 * The stored shape is deliberately the same `Record<string, EduRow[]>` used by
 * the education records, so every existing card helper (statuses, numbering,
 * history, permissions) keeps working untouched.
 */
import { EDU_RECORDS_KEY, type EduRecords, type EduRow } from './eduRecords'

const CARDS_KEY = 'fitpro_cards_v1'
const CARD_MIGRATION_KEY = 'fitpro_cards_migrated_v1'

/** The collections that make up Card Management. */
export const CARD_COLLECTIONS = ['idCardTemplates', 'idCards', 'idCardHistory', 'idCardSettings'] as const

type BranchMap = Record<string, EduRecords>

const readCards = (): BranchMap => {
  try {
    const raw = localStorage.getItem(CARDS_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : {}
    return value && typeof value === 'object' ? (value as BranchMap) : {}
  } catch {
    return {}
  }
}

const readEdu = (): BranchMap => {
  try {
    const raw = localStorage.getItem(EDU_RECORDS_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : {}
    return value && typeof value === 'object' ? (value as BranchMap) : {}
  } catch {
    return {}
  }
}

const migratedBranches = (): string[] => {
  try {
    const raw = localStorage.getItem(CARD_MIGRATION_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const hasAnyCards = (records: EduRecords | undefined) =>
  Boolean(records) && CARD_COLLECTIONS.some((key) => (records?.[key] ?? []).length > 0)

/**
 * Loads this branch's card data, lifting it out of the education records the
 * first time (branches that never used the education card menus are left empty
 * rather than seeded, so a gym branch doesn't inherit school templates).
 */
export function loadCardStore(branchId: string): EduRecords {
  const all = readCards()
  const existing = all[branchId]
  if (hasAnyCards(existing)) return existing ?? {}
  if (migratedBranches().includes(branchId)) return existing ?? {}

  const fromEdu = readEdu()[branchId]
  const next: EduRecords = { ...(existing ?? {}) }
  let changed = false
  if (fromEdu) {
    for (const key of CARD_COLLECTIONS) {
      const rows = fromEdu[key]
      if (rows?.length && !(next[key] ?? []).length) {
        next[key] = rows.map((row) => {
          const copy = { ...row }
          // Templates predate holder types — they served students.
          if (key === 'idCardTemplates' && !String(copy.holderType ?? '').trim()) copy.holderType = 'Student'
          return copy
        })
        changed = true
      }
    }
  }
  /* Only record the branch once there was something to lift. A first visit can
   * happen before the education module has seeded its own data, and stamping
   * then would skip the migration for good. */
  try {
    if (changed) {
      all[branchId] = next
      localStorage.setItem(CARDS_KEY, JSON.stringify(all))
      localStorage.setItem(CARD_MIGRATION_KEY, JSON.stringify([...migratedBranches(), branchId]))
    }
  } catch {
    /* ignore quota */
  }
  return changed ? next : (existing ?? {})
}

export function saveCardStore(branchId: string, records: EduRecords) {
  try {
    const all = readCards()
    all[branchId] = records
    localStorage.setItem(CARDS_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}

export const emptyCardStore = (): EduRecords => ({})
