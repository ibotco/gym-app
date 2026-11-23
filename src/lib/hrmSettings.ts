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
import { isCollectionMarkedCleared } from './dataReset'

export interface HrJobTitleSetting {
  name: string
  description: string
  status: 'Active' | 'Inactive'
  _order?: number
}

/** Shared seed list for HR Admin → Job Settings → Job Title and payroll forms. */
export const DEFAULT_HR_JOB_TITLES: HrJobTitleSetting[] = [
  { name: 'HR Manager', description: 'HR Manager', status: 'Active' },
  { name: 'Account Officer', description: 'Account Officer', status: 'Active' },
  { name: 'Administrator', description: 'Administrator', status: 'Active' },
  { name: 'IT Manager', description: 'IT Manager', status: 'Active' },
  { name: 'Social Media Marketer', description: 'Social Media Marketer', status: 'Active' },
  { name: 'Trainer', description: 'Trainer', status: 'Active' },
  { name: 'Receptionist', description: 'Receptionist', status: 'Active' },
  { name: 'Branch Manager', description: 'Branch Manager', status: 'Active' },
]

export interface HrPromotionTypeSetting {
  name: string
  status: 'Active' | 'Inactive'
  _order?: number
}

/** Default promotion categories managed in HR Admin → Job Settings → Promotion Type. */
export const DEFAULT_HR_PROMOTION_TYPES: HrPromotionTypeSetting[] = [
  { name: 'Annual Increment', status: 'Active' },
  { name: 'Promotion', status: 'Active' },
  { name: 'Upgrading', status: 'Active' },
  { name: 'Regrading', status: 'Active' },
  { name: 'Change of Grade', status: 'Active' },
]

export function hrmSettingsKey(companyId: string | undefined, pageKey: string): string {
  return `fitpro_hrm_${companyId || DEFAULT_COMPANY_ID}_${pageKey}`
}

/** Rows saved for this company, or `seed` when the company has none yet. */
export function loadHrmRows<T>(companyId: string | undefined, pageKey: string, seed: T[]): T[] {
  const cleared = isCollectionMarkedCleared('hrmSettings')
  try {
    const raw = localStorage.getItem(hrmSettingsKey(companyId, pageKey))
    if (!raw) return cleared ? [] : seed
    const parsed = JSON.parse(raw) as T[]
    if (!Array.isArray(parsed)) return cleared ? [] : seed
    return parsed
  } catch {
    return cleared ? [] : seed
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
