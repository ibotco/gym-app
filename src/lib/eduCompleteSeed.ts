import { loadEduRecords, saveEduRecords, type EduRecords } from './eduRecords'
import { applyCompleteEduSubmenuDefaults } from './eduCompleteDefaults'

/**
 * Ensures every menu & sub-menu under Education Management and Certificate
 * Management starts with realistic school/academy records across all 121
 * edu_* tables and 8 cert_* tables.
 */
export function ensureCompleteEduBranchSeed(branchId: string, branchName = 'Airport Main Campus'): EduRecords {
  const rec = loadEduRecords(branchId, branchName)
  const { records, changed } = applyCompleteEduSubmenuDefaults(rec, branchId, branchName)
  if (changed) {
    saveEduRecords(branchId, records)
  }
  return records
}
