/**
 * Generic record storage for the Education Management submenus.
 *
 * Every branch runs its own school: records are stored PER BRANCH, so switching
 * the active branch shows that branch's students, classes, timetable, fees…
 * Legacy (pre-branch) data is migrated into the branch that is active when the
 * new code first reads it.
 */

export type EduRow = { id: string } & Record<string, string>
export type EduRecords = Record<string, EduRow[]>

export const EDU_RECORDS_KEY = 'fitpro_edu_records_v1'
const EDU_SEEDED_KEY = 'fitpro_edu_seeded_v1'

type Nested = Record<string, EduRecords>

const isLeafMap = (v: unknown): v is EduRecords => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const vals = Object.values(v as Record<string, unknown>)
  return vals.length > 0 && vals.every(Array.isArray)
}

function readAll(): Nested {
  try {
    const raw = localStorage.getItem(EDU_RECORDS_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    // Legacy flat format (leafId -> rows): migrate into the calling branch below.
    if (isLeafMap(v)) return { __legacy__: v }
    return v as Nested
  } catch {
    return {}
  }
}

import { EDU_SEED } from './eduSeed'

function seededBranches(): string[] {
  try {
    const raw = localStorage.getItem(EDU_SEEDED_KEY)
    const v = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export function loadEduRecords(branchId: string): EduRecords {
  const all = readAll()
  if (all.__legacy__) {
    // First read after upgrade: attach the old global data to this branch.
    const legacy = all.__legacy__
    const next: Nested = { [branchId]: legacy }
    try {
      localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
    return legacy
  }
  let branchData = all[branchId]
  // First visit to this branch: fill every submenu with sample data once.
  if (!seededBranches().includes(branchId)) {
    const existing = branchData && typeof branchData === 'object' ? branchData : {}
    const merged: EduRecords = { ...EDU_SEED }
    for (const [leaf, rows] of Object.entries(existing)) {
      if (Array.isArray(rows) && rows.length) merged[leaf] = rows
    }
    branchData = merged
    try {
      all[branchId] = merged
      localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      localStorage.setItem(EDU_SEEDED_KEY, JSON.stringify([...seededBranches(), branchId]))
    } catch {
      /* ignore quota */
    }
    return merged
  }
  // Backfill: branches seeded earlier still get sample rows for any brand-new
  // submenu (existing or intentionally emptied lists are never touched).
  if (branchData && typeof branchData === 'object') {
    let changed = false
    const merged = { ...branchData }
    for (const [leaf, rows] of Object.entries(EDU_SEED)) {
      if (!merged[leaf]) { merged[leaf] = rows; changed = true }
    }
    if (changed) {
      branchData = merged
      try {
        all[branchId] = merged
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      } catch {
        /* ignore quota */
      }
    }
    return branchData
  }
  return {}
}

export function saveEduRecords(branchId: string, records: EduRecords) {
  try {
    const all = readAll()
    delete all.__legacy__
    all[branchId] = records
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}
