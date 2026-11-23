// Project Management — Project Settings definitions (Statuses / Priorities /
// Categories). Each entry carries a hex colour that is applied wherever the
// item is displayed (project list, cards, badges).

import type { ProjectColorDef } from '../types'

export const PROJECT_STATUSES_KEY = 'fitpro_project_statuses_v1'
export const PROJECT_PRIORITIES_KEY = 'fitpro_project_priorities_v1'
export const PROJECT_CATEGORIES_KEY = 'fitpro_project_categories_v1'

export const SEED_PROJECT_STATUSES: ProjectColorDef[] = [
  { id: 'open', name: 'Open', color: '#14b8a6' },
  { id: 'pending', name: 'Pending', color: '#f4626e' },
  { id: 'in_progress', name: 'In Progress', color: '#a855f7' },
  { id: 'on_hold', name: 'On Hold', color: '#8d939b' },
  { id: 'cancelled', name: 'Cancelled', color: '#e91e63' },
  { id: 'testing', name: 'Testing', color: '#f5a623' },
  { id: 'completed', name: 'Completed', color: '#2ecc71' },
]

export const SEED_PROJECT_PRIORITIES: ProjectColorDef[] = [
  { id: 'high', name: 'High', color: '#16a34a' },
  { id: 'medium', name: 'Medium', color: '#9333ea' },
  { id: 'low', name: 'Low', color: '#dc2626' },
]

export const SEED_PROJECT_CATEGORIES: ProjectColorDef[] = [
  { id: 'pc_1', name: 'Construction', color: '#0d6efd' },
  { id: 'pc_2', name: 'Renovation', color: '#a855f7' },
  { id: 'pc_3', name: 'Electrical', color: '#f5a623' },
  { id: 'pc_4', name: 'Maintenance', color: '#17a2b8' },
]

function load(key: string, fallback: ProjectColorDef[]): ProjectColorDef[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as ProjectColorDef[]
  } catch { /* ignore */ }
  return fallback.map((x) => ({ ...x }))
}
function save(key: string, list: ProjectColorDef[]) {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* ignore */ }
}

export const loadProjectStatuses = () => load(PROJECT_STATUSES_KEY, SEED_PROJECT_STATUSES)
export const saveProjectStatuses = (l: ProjectColorDef[]) => save(PROJECT_STATUSES_KEY, l)
export const loadProjectPriorities = () => load(PROJECT_PRIORITIES_KEY, SEED_PROJECT_PRIORITIES)
export const saveProjectPriorities = (l: ProjectColorDef[]) => save(PROJECT_PRIORITIES_KEY, l)
export const loadProjectCategories = () => load(PROJECT_CATEGORIES_KEY, SEED_PROJECT_CATEGORIES)
export const saveProjectCategories = (l: ProjectColorDef[]) => save(PROJECT_CATEGORIES_KEY, l)
