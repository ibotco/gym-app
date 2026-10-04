// Custom stakeholder classes — user-defined groups of payers/payees for
// vouchers (e.g. a church's "Ministry" class with Children Ministry, Youth
// Ministry, Women's Ministry as its members). Built-in classes (customer,
// supplier, employee, branch, …) are backed by the app registers; custom
// classes carry their own member list, managed in Accounting settings.

import type { StakeholderClassDef, StakeholderEntity } from '../types'

export const STAKEHOLDER_CLASSES_KEY = 'fitpro_stakeholder_classes'
export const STAKEHOLDER_ENTITIES_KEY = 'fitpro_stakeholder_entities'

export const SEED_STAKEHOLDER_CLASSES: StakeholderClassDef[] = [
  { id: 'sc_ministry', name: 'Ministry', description: 'Church ministries / departments', createdAt: '2026-08-01T09:00:00' },
]

export const SEED_STAKEHOLDER_ENTITIES: StakeholderEntity[] = [
  { id: 'se_1', classId: 'sc_ministry', name: 'Children Ministry', status: 'active', createdAt: '2026-08-01T09:00:00' },
  { id: 'se_2', classId: 'sc_ministry', name: 'Youth Ministry', status: 'active', createdAt: '2026-08-01T09:00:00' },
  { id: 'se_3', classId: 'sc_ministry', name: "Women's Ministry", status: 'active', createdAt: '2026-08-01T09:00:00' },
  { id: 'se_4', classId: 'sc_ministry', name: "Men's Ministry", status: 'active', createdAt: '2026-08-01T09:00:00' },
]

export function loadStakeholderClasses(): StakeholderClassDef[] {
  try {
    const raw = localStorage.getItem(STAKEHOLDER_CLASSES_KEY)
    if (!raw) return SEED_STAKEHOLDER_CLASSES
    const parsed = JSON.parse(raw) as StakeholderClassDef[]
    return Array.isArray(parsed) ? parsed : SEED_STAKEHOLDER_CLASSES
  } catch {
    return SEED_STAKEHOLDER_CLASSES
  }
}

export function saveStakeholderClasses(list: StakeholderClassDef[]) {
  localStorage.setItem(STAKEHOLDER_CLASSES_KEY, JSON.stringify(list))
}

export function loadStakeholderEntities(): StakeholderEntity[] {
  try {
    const raw = localStorage.getItem(STAKEHOLDER_ENTITIES_KEY)
    if (!raw) return SEED_STAKEHOLDER_ENTITIES
    const parsed = JSON.parse(raw) as StakeholderEntity[]
    return Array.isArray(parsed) ? parsed : SEED_STAKEHOLDER_ENTITIES
  } catch {
    return SEED_STAKEHOLDER_ENTITIES
  }
}

export function saveStakeholderEntities(list: StakeholderEntity[]) {
  localStorage.setItem(STAKEHOLDER_ENTITIES_KEY, JSON.stringify(list))
}
