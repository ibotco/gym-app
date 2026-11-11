// Project Management — Timesheet data layer.

import type { TimesheetEntry } from '../types'

export const TIMESHEETS_KEY = 'fitpro_timesheets_v1'

/** "HH:MM(:SS)" → fractional hours between two clocks (end < start rolls a day). */
export function computeHours(start: string, end: string): number {
  const toSec = (t: string) => {
    const [h = 0, m = 0, s = 0] = t.split(':').map((n) => Number(n) || 0)
    return h * 3600 + m * 60 + s
  }
  let diff = toSec(end) - toSec(start)
  if (diff < 0) diff += 24 * 3600
  return Math.round((diff / 3600) * 100) / 100
}

export const SEED_TIMESHEETS: TimesheetEntry[] = [
  { id: 'ts_1', companyId: 'co_fitpro', projectId: 'pr_2', projectName: 'Osu Sauna & Steam Install', userId: 'u_manager', userName: 'Kwesi Ampofo', userEmail: 'manager@fitpro.gym', userAvatar: '/images/member-ava-2.jpg', task: 'Site supervision', refNo: 'TS-1041', date: '2026-09-01', startTime: '08:00:00', endTime: '17:00:00', hours: 9, rate: 25, earnings: 225 },
  { id: 'ts_2', companyId: 'co_fitpro', projectId: 'pr_2', projectName: 'Osu Sauna & Steam Install', userId: 'u_trainer', userName: 'Kojo Mensah', userEmail: 'trainer@fitpro.gym', userAvatar: '/images/trainer-1.jpg', task: 'Equipment rigging', refNo: 'TS-1042', date: '2026-09-01', startTime: '09:00:00', endTime: '13:30:00', hours: 4.5, rate: 20, earnings: 90 },
  { id: 'ts_3', companyId: 'co_fitpro', projectId: 'pr_4', projectName: 'Legon Free-Weights Refit', userId: 'u_trainer2', userName: 'Amara Cole', userEmail: 'amara@fitpro.gym', userAvatar: '/images/trainer-2.jpg', task: 'Flooring installation', refNo: 'TS-1043', date: '2026-09-02', startTime: '08:00:00', endTime: '16:00:00', hours: 8, rate: 18, earnings: 144 },
  { id: 'ts_4', companyId: 'co_fitpro', projectId: 'pr_1', projectName: 'Spinning Studio Build-Out', userId: 'u_branchadmin', userName: 'Selina Ofori', userEmail: 'branchadmin@fitpro.gym', userAvatar: '/images/member-ava-1.jpg', task: 'Client walkthrough', refNo: 'TS-1044', date: '2026-09-03', startTime: '10:00:00', endTime: '11:00:00', hours: 1, rate: 20, earnings: 20 },
  { id: 'ts_5', companyId: 'co_fitpro', projectId: 'pr_4', projectName: 'Legon Free-Weights Refit', userId: 'u_companyadmin', userName: 'Ekow Asante', userEmail: 'companyadmin@fitpro.gym', userAvatar: '/images/member-ava-6.jpg', task: 'Procurement run', refNo: 'TS-1045', date: '2026-09-04', startTime: '13:00:00', endTime: '18:00:00', hours: 5, rate: 22, earnings: 110 },
]

export function loadTimesheets(): TimesheetEntry[] {
  try {
    const raw = localStorage.getItem(TIMESHEETS_KEY)
    if (raw) return JSON.parse(raw) as TimesheetEntry[]
  } catch { /* ignore */ }
  return SEED_TIMESHEETS.map((t) => ({ ...t }))
}
export function saveTimesheets(list: TimesheetEntry[]) {
  try { localStorage.setItem(TIMESHEETS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
