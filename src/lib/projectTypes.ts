// Project Settings — Types data layer.

import type { ProjectType } from '../types'
import { PROJECT_TYPES } from './taskTemplates'

export const PROJECT_TYPES_KEY = 'fitpro_project_types_v1'

export const SEED_PROJECT_TYPES: ProjectType[] = PROJECT_TYPES.map((name, i) => ({
  id: `pt_${i + 1}`,
  companyId: 'co_fitpro',
  name,
  status: 'ACTIVE',
}))

export function loadProjectTypes(): ProjectType[] {
  try {
    const raw = localStorage.getItem(PROJECT_TYPES_KEY)
    if (raw) return JSON.parse(raw) as ProjectType[]
  } catch { /* ignore */ }
  return SEED_PROJECT_TYPES.map((t) => ({ ...t }))
}
export function saveProjectTypes(list: ProjectType[]) {
  try { localStorage.setItem(PROJECT_TYPES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export const CONTRACT_TYPES_KEY = 'fitpro_contract_types_v1'

export const SEED_CONTRACT_TYPES: ProjectType[] = [
  { id: 'ct_1', companyId: 'co_fitpro', name: 'Works Contract', status: 'ACTIVE' },
  { id: 'ct_2', companyId: 'co_fitpro', name: 'Supply Contract', status: 'ACTIVE' },
  { id: 'ct_3', companyId: 'co_fitpro', name: 'Consultancy Contract', status: 'ACTIVE' },
]

export function loadContractTypes(): ProjectType[] {
  try {
    const raw = localStorage.getItem(CONTRACT_TYPES_KEY)
    if (raw) return JSON.parse(raw) as ProjectType[]
  } catch { /* ignore */ }
  return SEED_CONTRACT_TYPES.map((t) => ({ ...t }))
}
export function saveContractTypes(list: ProjectType[]) {
  try { localStorage.setItem(CONTRACT_TYPES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
