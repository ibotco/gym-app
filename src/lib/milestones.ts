import type { ProjectMilestone } from '../types'

export const MILESTONES_KEY = 'fitpro_milestones'

export const MILESTONES: ProjectMilestone[] = [
  {
    id: 'pm_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    name: 'Site Preparation', color: '#0ea5e9', createdAt: '2026-05-18T09:00:00',
  },
  {
    id: 'pm_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    name: 'Fit-Out & Handover', notes: 'Equipment install, snagging and client sign-off.', color: '#10b981', createdAt: '2026-06-02T10:00:00',
  },
]

export function loadMilestones(): ProjectMilestone[] {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY)
    if (raw) return JSON.parse(raw) as ProjectMilestone[]
  } catch { /* ignore */ }
  return MILESTONES
}

export function saveMilestones(list: ProjectMilestone[]) {
  try { localStorage.setItem(MILESTONES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
