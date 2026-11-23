/**
 * Card Management storage.
 *
 * Card Management is universal — it serves students, staff and members — and is
 * persisted in its dedicated per-branch store (`fitpro_cards_v1`), mapping cleanly
 * to the 4 Card Management MySQL tables & NoSQL collections (`card_templates`,
 * `card_issued`, `card_history`, `card_settings`).
 */
import { isCollectionMarkedCleared } from './dataReset'
import { EDU_RECORDS_KEY, loadEduRecords, type EduRecords } from './eduRecords'

export const CARDS_KEY = 'fitpro_cards_v1'
const CARD_MIGRATION_KEY = 'fitpro_cards_migrated_v1'
export const CARD_MENU_CLEARED_KEY = 'fitpro_cards_menu_cleared_v1'
function clearedCardTables(branchId:string):Set<string> {
  try { const v=JSON.parse(localStorage.getItem(CARD_MENU_CLEARED_KEY)||'{}'); return new Set(Array.isArray(v?.[branchId])?v[branchId].filter((x:unknown)=>typeof x==='string'):[]) } catch { return new Set() }
}

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

function buildFallbackCards(branchId: string): EduRecords {
  return {
    idCardTemplates: [
      {
        id: `card_tpl_student_${branchId}`,
        name: 'Standard Student ID Card',
        holderType: 'Student',
        orientation: 'Portrait',
        schoolName: 'FitPro Academy',
        accentColor: '#16A34A',
        status: 'Active',
      },
      {
        id: `card_tpl_member_${branchId}`,
        name: 'FitPro Gym Member Access Card',
        holderType: 'Member',
        orientation: 'Landscape',
        schoolName: 'FitPro Gym',
        accentColor: '#0284C7',
        status: 'Active',
      },
    ],
    idCards: [
      {
        id: `card_iss_1_${branchId}`,
        cardNo: `ID-${branchId.slice(-3).toUpperCase()}-2026-001`,
        holderType: 'Student',
        student: 'Kwame Owusu',
        admissionNo: 'ADM-2026-001',
        className: 'Basic 7 - A',
        issueDate: '2026-09-10',
        expiryDate: '2027-08-31',
        status: 'Active',
      },
    ],
    idCardHistory: [
      {
        id: `card_hist_1_${branchId}`,
        date: '2026-09-10',
        cardNo: `ID-${branchId.slice(-3).toUpperCase()}-2026-001`,
        student: 'Kwame Owusu',
        action: 'Issued',
        officer: 'Card Registrar',
      },
    ],
    idCardSettings: [
      {
        id: `card_cfg_${branchId}`,
        defaultTemplateId: `card_tpl_student_${branchId}`,
        autoNumberPrefix: 'ID-2026-',
        validityMonths: 12,
      },
    ],
  }
}

/**
 * Loads this branch's card data, lifting it out of the education records (or
 * seeding default universal templates & records) whenever the branch has no
 * card records yet and has not been explicitly cleared via Data Reset.
 */
export function loadCardStore(branchId: string): EduRecords {
  const key = branchId || 'br_airport'
  if (isCollectionMarkedCleared('cardManagement')) {
    return readCards()[key] ?? {}
  }

  const all = readCards()
  const clearedTables = clearedCardTables(key)
  const existing = all[key]
  if (hasAnyCards(existing)) return existing ?? {}

  let fromEdu = readEdu()[key]
  if (!fromEdu && !isCollectionMarkedCleared('educationRecords')) {
    fromEdu = loadEduRecords(key)
  }

  const next: EduRecords = { ...(existing ?? {}) }
  let changed = false
  if (fromEdu) {
    for (const colKey of CARD_COLLECTIONS) {
      const rows = fromEdu[colKey]
      if (!clearedTables.has(colKey) && rows?.length && !(next[colKey] ?? []).length) {
        next[colKey] = rows.map((row) => {
          const copy = { ...row }
          if (colKey === 'idCardTemplates' && !String(copy.holderType ?? '').trim()) {
            copy.holderType = 'Student'
          }
          return copy
        })
        changed = true
      }
    }
  }

  if (!hasAnyCards(next)) {
    const fallback = buildFallbackCards(key)
    for (const colKey of CARD_COLLECTIONS) {
      if (!clearedTables.has(colKey) && !(next[colKey] ?? []).length) {
        next[colKey] = fallback[colKey] ?? []
      }
    }
    changed = true
  }

  try {
    if (changed) {
      all[key] = next
      localStorage.setItem(CARDS_KEY, JSON.stringify(all))
      const curMigrated = migratedBranches()
      if (!curMigrated.includes(key)) {
        localStorage.setItem(CARD_MIGRATION_KEY, JSON.stringify([...curMigrated, key]))
      }
    }
  } catch {
    /* ignore quota */
  }
  return changed ? next : (existing ?? {})
}

export function saveCardStore(branchId: string, records: EduRecords) {
  try {
    const key = branchId || 'br_airport'
    const all = readCards()
    all[key] = records
    localStorage.setItem(CARDS_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}

export const emptyCardStore = (): EduRecords => ({})
