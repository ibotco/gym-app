import type { ProjectDiscussion } from '../types'

export const DISCUSSIONS_KEY = 'fitpro_project_discussions'

export const PROJECT_DISCUSSIONS: ProjectDiscussion[] = [
  {
    id: 'pd_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    subject: 'Equipment delivery window — week 34',
    description: 'Supplier can only deliver racks and benches on a weekday morning. Need site access confirmed and a parking plan for the truck.',
    visibleToCustomer: true, createdBy: 'Kwesi Ampofo', createdAt: '2026-07-28T08:12:00', lastActivity: '2026-08-15T14:40:00',
    comments: [
      { id: 'pdc_1', author: 'Ekow Asante', text: 'Client approved Tuesday 07:00 access. Security has been briefed.', createdAt: '2026-08-14T09:05:00' },
      { id: 'pdc_2', author: 'Kwesi Ampofo', text: 'Perfect. I will have two staff on the floor to receive and sign.', createdAt: '2026-08-15T14:40:00' },
    ],
  },
  {
    id: 'pd_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    subject: 'Flooring quote came back higher than budget',
    description: 'Rubber tile quote is ~12% over. Options: reduce thickness in low-traffic zones or switch supplier for the turf strip.',
    visibleToCustomer: false, createdBy: 'Ekow Asante', createdAt: '2026-08-02T10:30:00', lastActivity: '2026-08-02T10:30:00',
    comments: [],
  },
]

export function loadProjectDiscussions(): ProjectDiscussion[] {
  try {
    const raw = localStorage.getItem(DISCUSSIONS_KEY)
    if (raw) return JSON.parse(raw) as ProjectDiscussion[]
  } catch { /* ignore */ }
  return PROJECT_DISCUSSIONS
}

export function saveProjectDiscussions(list: ProjectDiscussion[]) {
  try { localStorage.setItem(DISCUSSIONS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
