// Project Management — Tasks Assign data layer. Tenant-scoped like other records.

import type { ProjectPriority, TaskStatus, ProjectTask } from '../types'

export const TASKS_KEY = 'fitpro_tasks_v1'

/** Pipeline metadata — `card` for the summary buttons, `badge` for the table pill. */
export const TASK_STATUSES: { id: TaskStatus; label: string; card: string; badge: string }[] = [
  { id: 'to_do',       label: 'To Do',       card: '#17a2b8', badge: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'in_progress', label: 'In Progress', card: '#a855f7', badge: 'bg-purple-50 text-purple-500 border-purple-200' },
  { id: 'review',      label: 'Review',      card: '#f5a623', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'completed',   label: 'Done',        card: '#2ecc71', badge: 'bg-green-50 text-green-600 border-green-200' },
]

export const TASK_PRIORITY_META: Record<ProjectPriority, { label: string; badge: string }> = {
  high:   { label: 'High',   badge: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', badge: 'bg-purple-100 text-purple-600' },
  low:    { label: 'Low',    badge: 'bg-red-100 text-red-500' },
}

export const taskStatusMeta = (id: TaskStatus) =>
  TASK_STATUSES.find((s) => s.id === id) || TASK_STATUSES[0]

/** Overdue when the due date has passed but the task is not completed. */
export function isTaskOverdue(t: ProjectTask, today: string = new Date().toISOString().slice(0, 10)): boolean {
  if (t.status === 'completed') return false
  return Boolean(t.dueDate) && t.dueDate < today
}

export const SEED_TASKS: ProjectTask[] = [
  { id: 'tk_1', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Access To Site', priority: 'medium', projectId: 'pr_1', projectName: 'Spinning Studio Build-Out', startDate: '2025-05-18', dueDate: '2025-05-18', assigneeId: 'u_manager', collaboratorIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'], status: 'in_progress', progress: 67.5 },
  { id: 'tk_2', companyId: 'co_fitpro', branchId: 'br_osu', name: 'Building Drawings', priority: 'medium', projectId: 'pr_2', projectName: 'Osu Sauna & Steam Install', startDate: '2025-05-18', dueDate: '2025-05-18', assigneeId: 'u_staff', collaboratorIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'], status: 'in_progress', progress: 50 },
  { id: 'tk_3', companyId: 'co_fitpro', branchId: 'br_legon', name: 'Setting-out', priority: 'high', projectId: 'pr_4', projectName: 'Legon Free-Weights Refit', startDate: '2025-05-18', dueDate: '2025-05-18', assigneeId: 'u_manager', collaboratorIds: ['u_manager', 'u_staff'], status: 'completed', progress: 90 },
  { id: 'tk_4', companyId: 'co_fitpro', branchId: 'br_tema', name: 'Site Striping', priority: 'low', projectId: 'pr_5', projectName: 'Tema Community Outreach Gym', startDate: '2025-05-18', dueDate: '2025-05-18', assigneeId: 'u_staff2', collaboratorIds: ['u_manager', 'u_staff', 'u_staff2', 'u_trainer4'], status: 'review', progress: 80 },
  { id: 'tk_5', companyId: 'co_fitpro', name: 'Equipment Procurement List', priority: 'high', projectId: 'pr_7', projectName: 'Reception & CRM Revamp', startDate: '2026-08-01', dueDate: '2026-12-31', assigneeId: 'u_trainer4', collaboratorIds: ['u_staff'], status: 'to_do', progress: 0 },
  { id: 'tk_6', companyId: 'co_fitpro', branchId: 'br_airport', name: 'Flooring Inspection', priority: 'medium', projectId: 'pr_8', projectName: 'Airport Annex HVAC Upgrade', startDate: '2026-09-01', dueDate: '2027-01-31', assigneeId: 'u_staff', collaboratorIds: [], status: 'to_do', progress: 0 },
  { id: 'tk_7', companyId: 'co_fitpro', branchId: 'br_legon', name: 'Yoga Deck Sign-off', priority: 'high', projectId: 'pr_6', projectName: 'East Legon Yoga Deck', startDate: '2026-04-01', dueDate: '2026-06-30', assigneeId: 'u_manager', collaboratorIds: ['u_staff2'], status: 'completed', progress: 100 },
]

export function loadTasks(): ProjectTask[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    if (raw) return JSON.parse(raw) as ProjectTask[]
  } catch { /* ignore */ }
  return SEED_TASKS.map((t) => ({ ...t }))
}

export function saveTasks(list: ProjectTask[]) {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export type TaskCounts = Record<string, number> & { overdue: number }

export function taskCounts(list: ProjectTask[]): TaskCounts {
  const counts = { overdue: 0 } as TaskCounts
  for (const s of TASK_STATUSES) counts[s.id] = 0
  for (const t of list) {
    counts[t.status] = (counts[t.status] || 0) + 1
    if (isTaskOverdue(t)) counts.overdue += 1
  }
  return counts
}
