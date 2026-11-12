import type { ProjectNote } from '../types'

export const NOTES_KEY = 'fitpro_project_notes'

export const PROJECT_NOTES: ProjectNote[] = [
  {
    id: 'pn_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    title: 'Site access hours', body: 'Client allows works 07:00-18:00 on weekdays only. Saturday access needs written approval 48h ahead.',
    createdBy: 'Kwesi Ampofo', createdAt: '2026-06-05T08:20:00',
  },
  {
    id: 'pn_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    title: 'Paint colour codes', body: 'Main floor walls: RAL 7016. Studio accent wall: RAL 6018. Ceilings matte black.',
    createdBy: 'Ekow Asante', createdAt: '2026-07-22T15:45:00',
  },
]

export function loadProjectNotes(): ProjectNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (raw) return JSON.parse(raw) as ProjectNote[]
  } catch { /* ignore */ }
  return PROJECT_NOTES
}

export function saveProjectNotes(list: ProjectNote[]) {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
