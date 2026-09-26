// ---------------------------------------------------------------------------
// Company-scoped persistence for the HR Admin settings lists — Job Settings
// (Designation, Job Title, Job Category, ...) and Qualifications (Skills,
// Education, Languages, Licenses, ...), plus Leave, Work Week and Shifts.
//
// These lists used to live in component state seeded from a hardcoded array, so
// every company saw the same rows and edits were lost on navigation. Each
// company now keeps its own copy; the shipped defaults are used only until that
// company has saved something of its own.
// ---------------------------------------------------------------------------

import { DEFAULT_COMPANY_ID } from './companies'

export function hrmSettingsKey(companyId: string | undefined, pageKey: string): string {
  return `fitpro_hrm_${companyId || DEFAULT_COMPANY_ID}_${pageKey}`
}

/** Rows saved for this company, or `seed` when the company has none yet. */
export function loadHrmRows<T>(companyId: string | undefined, pageKey: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(hrmSettingsKey(companyId, pageKey))
    if (!raw) return seed
    const parsed = JSON.parse(raw) as T[]
    if (!Array.isArray(parsed)) return seed
    return parsed
  } catch {
    return seed
  }
}

export function saveHrmRows(companyId: string | undefined, pageKey: string, rows: unknown[]): void {
  try {
    localStorage.setItem(hrmSettingsKey(companyId, pageKey), JSON.stringify(rows))
  } catch {
    /* quota */
  }
}

/** Drop one company's saved settings — used by the data-maintenance reset. */
export function clearHrmRows(companyId: string | undefined, pageKey: string): void {
  try {
    localStorage.removeItem(hrmSettingsKey(companyId, pageKey))
  } catch {
    /* ignore */
  }
}
