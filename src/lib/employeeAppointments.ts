import { DEFAULT_COMPANY_ID } from './companies.ts'
export const EMPLOYEE_APPOINTMENTS_KEY_PREFIX = 'fitpro_hrm_employee_appointments_v1_'

export type EmployeeAppointmentStatus = 'Active' | 'Inactive'

/** A dated employee appointment record; multiple records per employee preserve history. */
export interface EmployeeAppointmentRecord {
  id: string
  companyId: string
  branchId?: string
  staffRecordId: string
  staffUserId: string
  employeeName: string
  employeeNumber: string
  appointmentType: string
  effectiveDate: string
  endDate?: string
  status: EmployeeAppointmentStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export function employeeAppointmentsKey(companyId?: string): string {
  return `${EMPLOYEE_APPOINTMENTS_KEY_PREFIX}${companyId || DEFAULT_COMPANY_ID}`
}

export function loadEmployeeAppointments(companyId?: string): EmployeeAppointmentRecord[] {
  try {
    const raw = localStorage.getItem(employeeAppointmentsKey(companyId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((record): record is EmployeeAppointmentRecord => (
      Boolean(record && typeof record === 'object')
      && typeof (record as EmployeeAppointmentRecord).id === 'string'
      && typeof (record as EmployeeAppointmentRecord).staffRecordId === 'string'
      && typeof (record as EmployeeAppointmentRecord).appointmentType === 'string'
    ))
  } catch {
    return []
  }
}

export function saveEmployeeAppointments(companyId: string | undefined, rows: EmployeeAppointmentRecord[]): void {
  try {
    localStorage.setItem(employeeAppointmentsKey(companyId), JSON.stringify(rows))
  } catch {
    /* Keep the page usable if storage is unavailable or full. */
  }
}
