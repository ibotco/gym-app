import type { WorkShift } from '../types'

export const WORK_SHIFTS_KEY = 'fitpro_work_shifts_v1'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const SEED_WORK_SHIFTS: WorkShift[] = [
  { id: 'ws_morning',   name: 'Morning',   startTime: '06:00', endTime: '14:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], color: '#0ea5e9', staffUserIds: [] },
  { id: 'ws_afternoon', name: 'Afternoon', startTime: '14:00', endTime: '22:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], color: '#f59e0b', staffUserIds: [] },
  { id: 'ws_fullday',   name: 'Full Day',  startTime: '08:00', endTime: '17:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], color: '#84cc16', staffUserIds: [] },
  { id: 'ws_weekend',   name: 'Weekend',   startTime: '08:00', endTime: '20:00', days: ['Sat', 'Sun'], color: '#8b5cf6', staffUserIds: [] },
]

export function loadWorkShifts(): WorkShift[] {
  try {
    const raw = localStorage.getItem(WORK_SHIFTS_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as WorkShift[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* fall through */ }
  return SEED_WORK_SHIFTS
}

export function saveWorkShifts(list: WorkShift[]) {
  try { localStorage.setItem(WORK_SHIFTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
