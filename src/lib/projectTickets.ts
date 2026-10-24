import type { ProjectTicket } from '../types'

export const TICKETS_KEY = 'fitpro_project_tickets'

export const PROJECT_TICKETS: ProjectTicket[] = [
  {
    id: 'ptk_1', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    number: 1041, subject: 'Access door hinge broken on site store',
    description: 'The store room door hinge snapped during the morning delivery. Needs a welder or full hinge replacement before Friday.',
    tags: ['site', 'maintenance'], department: 'Technical', service: 'Maintenance',
    contact: 'Kaba Aniagdaga', status: 'answered', priority: 'high',
    createdAt: '2026-08-10T07:55:00', lastReply: '2026-08-12T09:20:00',
    replies: [
      { id: 'ptr_1', author: 'Kwesi Ampofo', text: 'Hinge sourced from the Osu supplier. Fitting scheduled Thursday 08:00.', createdAt: '2026-08-12T09:20:00' },
    ],
  },
  {
    id: 'ptk_2', companyId: 'co_fitpro', branchId: 'br_airport', projectId: 'pr_1',
    number: 1042, subject: 'Invoice query — variation order 3',
    description: 'Client asks why VO3 (extra power points) is billed at the day rate instead of the agreed schedule rate.',
    tags: ['billing'], department: 'Billing', service: 'Site Works',
    contact: 'Kaba Aniagdaga', status: 'open', priority: 'medium',
    createdAt: '2026-08-16T13:05:00', replies: [],
  },
]

export function loadProjectTickets(): ProjectTicket[] {
  try {
    const raw = localStorage.getItem(TICKETS_KEY)
    if (raw) return JSON.parse(raw) as ProjectTicket[]
  } catch { /* ignore */ }
  return PROJECT_TICKETS
}

export function saveProjectTickets(list: ProjectTicket[]) {
  try { localStorage.setItem(TICKETS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
