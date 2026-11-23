// Project Management — data layer.
// Projects are tenant-scoped (companyId / optional branchId) like every other
// operational record; the store pipes them through scopeOrgRecords.

import type { Project, ProjectPriority, ProjectStatus } from '../types'

export const PROJECTS_KEY = 'fitpro_projects_v1'

/**
 * Pipeline metadata. `card` is the solid colour used by the summary buttons at
 * the top of the page; `badge` is the soft pill shown in the table.
 */
export const PROJECT_STATUSES: {
  id: ProjectStatus
  label: string
  card: string
  badge: string
}[] = [
  { id: 'open',        label: 'Open',        card: '#14b8a6', badge: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'pending',     label: 'Pending',     card: '#f4626e', badge: 'bg-red-50 text-red-500 border-red-200' },
  { id: 'in_progress', label: 'In Progress', card: '#a855f7', badge: 'bg-purple-50 text-purple-500 border-purple-200' },
  { id: 'on_hold',     label: 'On Hold',     card: '#8d939b', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  { id: 'cancelled',   label: 'Cancelled',   card: '#e91e63', badge: 'bg-pink-50 text-pink-500 border-pink-200' },
  { id: 'testing',     label: 'Testing',     card: '#f5a623', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'completed',   label: 'Completed',   card: '#2ecc71', badge: 'bg-green-50 text-green-600 border-green-200' },
]

export const PRIORITY_META: Record<ProjectPriority, { label: string; badge: string }> = {
  high:   { label: 'High',   badge: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', badge: 'bg-purple-100 text-purple-600' },
  low:    { label: 'Low',    badge: 'bg-red-100 text-red-500' },
}

export const statusMeta = (id: ProjectStatus) =>
  PROJECT_STATUSES.find((s) => s.id === id) || PROJECT_STATUSES[0]

/** A project is overdue when its end date has passed but it is not closed. */
export function isOverdue(project: Project, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (project.status === 'completed' || project.status === 'cancelled') return false
  return Boolean(project.endDate) && project.endDate < today
}

export const SEED_PROJECTS: Project[] = [
  { id: 'pr_1', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Spinning Studio Build-Out', priority: 'high', clientName: 'Kaba Aniagdaga', clientPhone: '0246423357', startDate: '2025-05-18', endDate: '2025-05-18', progress: 45.78, status: 'cancelled', assigneeIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'] },
  { id: 'pr_2', companyId: 'co_fitpro', branchId: 'br_osu', name: 'Osu Sauna & Steam Install', priority: 'medium', clientName: 'Isaac Kojo Botchwey', clientPhone: '0242507161', startDate: '2025-05-18', endDate: '2025-05-18', progress: 50, status: 'pending', assigneeIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'] },
  { id: 'pr_3', companyId: 'co_fitpro', name: 'Member App Launch', priority: 'medium', clientName: 'Isaac Kojo Botchwey', clientPhone: '0242507161', startDate: '2026-06-01', endDate: '2026-11-30', progress: 75, status: 'testing', assigneeIds: ['u_staff', 'u_staff2'] },
  { id: 'pr_4', companyId: 'co_fitpro', branchId: 'br_legon', name: 'Legon Free-Weights Refit', priority: 'low', clientName: 'Isaac Kojo Botchwey', clientPhone: '0242507161', startDate: '2025-05-18', endDate: '2025-05-18', progress: 80, status: 'in_progress', assigneeIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'] },
  { id: 'pr_5', companyId: 'co_fitpro', branchId: 'br_tema', name: 'Tema Community Outreach Gym', priority: 'medium', clientName: 'Kaba Aniagdaga', clientPhone: '0246423357', startDate: '2026-07-01', endDate: '2026-12-15', progress: 67.5, status: 'pending', assigneeIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'] },
  { id: 'pr_6', companyId: 'co_fitpro', branchId: 'br_legon', name: 'East Legon Yoga Deck', priority: 'high', clientName: 'Kaba Aniagdaga', clientPhone: '0246423357', startDate: '2026-01-10', endDate: '2026-05-30', progress: 69, status: 'completed', assigneeIds: ['u_manager', 'u_staff', 'u_trainer4'] },
  { id: 'pr_7', companyId: 'co_fitpro', name: 'Reception & CRM Revamp', priority: 'high', clientName: 'Kaba Aniagdaga', clientPhone: '0246423357', startDate: '2026-02-01', endDate: '2026-08-01', progress: 90, status: 'completed', assigneeIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'] },
  { id: 'pr_8', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Airport Annex HVAC Upgrade', priority: 'medium', clientName: 'Isaac Kojo Botchwey', clientPhone: '0242507161', startDate: '2026-08-01', endDate: '2027-01-31', progress: 30, status: 'on_hold', assigneeIds: ['u_staff2', 'u_trainer4'] },
]

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) return JSON.parse(raw) as Project[]
  } catch { /* ignore */ }
  return SEED_PROJECTS.map((p) => ({ ...p }))
}

export function saveProjects(list: Project[]) {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export type ProjectCounts = Record<string, number> & { all: number; overdue: number }

/** Per-status counts plus `all` and the cross-cutting `overdue`. */
export function projectCounts(projects: Project[]): ProjectCounts {
  const counts = { all: projects.length, overdue: 0 } as ProjectCounts
  for (const s of PROJECT_STATUSES) counts[s.id] = 0
  for (const p of projects) {
    counts[p.status] = (counts[p.status] || 0) + 1
    if (isOverdue(p)) counts.overdue += 1
  }
  return counts
}
