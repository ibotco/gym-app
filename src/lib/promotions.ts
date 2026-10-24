import type { SalaryIncreaseAmountType } from './salaryIncreases'
import { hrmSettingsKey } from './hrmSettings'

export type PromotionChangeKind = 'promotion' | 'grade_change'

/** A dated HR promotion/grade record, paired with its payroll raise entry. */
export interface PromotionChangeRecord {
  id: string
  staffUserId: string
  changeKind: PromotionChangeKind
  newTitle: string
  gradeLabel: string
  /** Optional structure reference recorded as the grade band; does not reassign payroll structure. */
  salaryStructureId?: string
  salaryStructureName?: string
  amountType: SalaryIncreaseAmountType
  amount: number
  effectivePeriod: string
  salaryIncreaseId: string
  note?: string
  createdAt: string
}

const PROMOTIONS_KEY = 'fitpro_hrm_promotions_v1'
const PROMOTION_GRADE_SETTINGS_KEY = 'fitpro_hrm_promotion_grade_settings_v1'
const PROMOTION_GRADE_SETTINGS_PAGE_KEY = 'promotion-grade-settings'

export interface PromotionGradeSettings {
  grades: string[]
}

export const DEFAULT_PROMOTION_GRADE_SETTINGS: PromotionGradeSettings = { grades: [] }

function normalizeOptions(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) continue
    const label = value.trim()
    const key = label.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(label)
  }
  return normalized
}

export function loadPromotionGradeSettings(companyId?: string): PromotionGradeSettings {
  try {
    const scopedKey = hrmSettingsKey(companyId, PROMOTION_GRADE_SETTINGS_PAGE_KEY)
    const scopedRaw = localStorage.getItem(scopedKey)
    const raw = scopedRaw ?? localStorage.getItem(PROMOTION_GRADE_SETTINGS_KEY)
    if (!raw) return DEFAULT_PROMOTION_GRADE_SETTINGS
    const parsed = JSON.parse(raw) as Partial<PromotionGradeSettings> | string[]
    const grades = Array.isArray(parsed) ? parsed : parsed.grades
    return { grades: normalizeOptions(grades) }
  } catch {
    return DEFAULT_PROMOTION_GRADE_SETTINGS
  }
}

/** Persist the active company's grade list and report storage failures to the caller. */
export function savePromotionGradeSettings(settings: PromotionGradeSettings, companyId?: string): boolean {
  try {
    const key = hrmSettingsKey(companyId, PROMOTION_GRADE_SETTINGS_PAGE_KEY)
    const serialized = JSON.stringify({ grades: normalizeOptions(settings.grades) })
    localStorage.setItem(key, serialized)
    return localStorage.getItem(key) === serialized
  } catch {
    return false
  }
}

export function loadPromotionChanges(): PromotionChangeRecord[] {
  try {
    const raw = localStorage.getItem(PROMOTIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as PromotionChangeRecord[] : []
  } catch {
    return []
  }
}

export function savePromotionChanges(records: PromotionChangeRecord[]): void {
  try { localStorage.setItem(PROMOTIONS_KEY, JSON.stringify(records)) } catch { /* storage quota/private mode */ }
}

export function promotionChangeLabel(kind: PromotionChangeKind): string {
  return kind === 'promotion' ? 'Promotion' : 'Change of grade'
}
