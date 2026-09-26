import type { LeaveTypeDef } from '../types'

export const LEAVE_TYPES_KEY = 'fitpro_leave_types_v1'

/** Seed leave types — names match the legacy hard-coded list so existing requests keep their colours. */
export const SEED_LEAVE_TYPES: LeaveTypeDef[] = [
  { id: 'lt_annual',    name: 'Annual',    color: '#3b82f6', daysPerYear: 20, paid: true,  description: 'Yearly vacation leave.' },
  { id: 'lt_sick',      name: 'Sick',      color: '#ef4444', daysPerYear: 10, paid: true,  description: 'Medical / sick leave.' },
  { id: 'lt_maternity', name: 'Maternity', color: '#ec4899', daysPerYear: 90, paid: true,  description: 'Maternity leave.' },
  { id: 'lt_paternity', name: 'Paternity', color: '#8b5cf6', daysPerYear: 7,  paid: true,  description: 'Paternity leave.' },
  { id: 'lt_unpaid',    name: 'Unpaid',    color: '#64748b', daysPerYear: 0,  paid: false, description: 'Leave without pay.' },
  { id: 'lt_other',     name: 'Other',     color: '#94a3b8', paid: true,      description: 'Any other approved leave.' },
]

export function loadLeaveTypes(): LeaveTypeDef[] {
  try {
    const raw = localStorage.getItem(LEAVE_TYPES_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as LeaveTypeDef[]
      if (Array.isArray(arr) && arr.length) return arr
    }
  } catch { /* fall through to seed */ }
  return SEED_LEAVE_TYPES
}

export function saveLeaveTypes(list: LeaveTypeDef[]) {
  try { localStorage.setItem(LEAVE_TYPES_KEY, JSON.stringify(list)) } catch { /* ignore quota */ }
}
