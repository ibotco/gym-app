// Clearable data collections for the Settings → Data maintenance screen.
// `resetData(keys)` in AppContext resets each of these to factory (seed) defaults.

import { downloadText } from './utils'

export interface DataCollection {
  key: string
  label: string
  desc: string
  persisted: boolean
}

/** Builds the JSON payload string for a backup snapshot. */
export function buildBackup(data: Record<string, unknown>): { filename: string; json: string } {
  const payload = {
    app: 'FitPro',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  return { filename: `fitpro-backup-${stamp}.json`, json: JSON.stringify(payload, null, 2) }
}

/** Downloads a full JSON snapshot of the app data as a backup file. */
export function createBackup(data: Record<string, unknown>) {
  const { filename, json } = buildBackup(data)
  downloadText(filename, json, 'application/json')
}

export const DATA_COLLECTIONS: DataCollection[] = [
  { key: 'users', label: 'Users & accounts', desc: 'All user accounts and their login records.', persisted: true },
  { key: 'members', label: 'Members', desc: 'Member records, tags, goals, and medical notes.', persisted: false },
  { key: 'trainers', label: 'Trainers', desc: 'Trainer profiles and specialties.', persisted: false },
  { key: 'staff', label: 'Staff & payroll', desc: 'Staff records, salaries, and departments.', persisted: false },
  { key: 'plans', label: 'Plans & pricing', desc: 'Membership plans and features.', persisted: false },
  { key: 'memberships', label: 'Memberships', desc: 'Active, expired, and cancelled memberships.', persisted: true },
  { key: 'payments', label: 'Payments', desc: 'Payment history and pending charges.', persisted: true },
  { key: 'invoices', label: 'Invoices', desc: 'Issued invoices.', persisted: true },
  { key: 'classes', label: 'Classes & timetable', desc: 'Group classes, rooms, and capacity.', persisted: false },
  { key: 'bookings', label: 'Class bookings', desc: 'Bookings and waitlists.', persisted: false },
  { key: 'attendance', label: 'Attendance', desc: 'Check-ins and class attendance.', persisted: false },
  { key: 'workouts', label: 'Workout plans', desc: 'Published workout programmes.', persisted: false },
  { key: 'progress', label: 'Progress logs', desc: 'Weigh-ins and measurements.', persisted: false },
  { key: 'notifications', label: 'Notifications', desc: 'In-app notifications.', persisted: false },
  { key: 'branches', label: 'Branches', desc: 'Club locations.', persisted: false },
  { key: 'leads', label: 'Leads CRM', desc: 'Sales leads and consultations.', persisted: false },
  { key: 'messages', label: 'Messages', desc: 'Member ↔ coach messages.', persisted: false },
  { key: 'audit', label: 'Audit log', desc: 'System activity log.', persisted: false },
  { key: 'leaves', label: 'Leave requests', desc: 'Staff leave records.', persisted: false },
  { key: 'sessions', label: 'PT sessions', desc: 'Personal training bookings.', persisted: false },
  { key: 'inventory', label: 'Inventory', desc: 'Stock items, suppliers, and stock movements.', persisted: true },
  { key: 'assets', label: 'Assets', desc: 'Fixed assets, equipment, and depreciation entries.', persisted: true },
  { key: 'customers', label: 'Customers', desc: 'Walk-in and retail customer records.', persisted: true },
  { key: 'modules', label: 'Module visibility', desc: 'Which modules are shown in the sidebar.', persisted: true },
  { key: 'accounting', label: 'Accounting', desc: 'Chart of accounts, vouchers, banking, budget, and reports.', persisted: true },
  { key: 'credentialEvents', label: 'Credential events', desc: 'Issued and resent login credentials history.', persisted: true },
  { key: 'roles', label: 'Custom roles', desc: 'Custom roles (built-in roles are kept).', persisted: true },
  { key: 'permissions', label: 'Custom permissions', desc: 'Custom permissions (built-in ones are kept).', persisted: true },
  { key: 'integrations', label: 'Integrations', desc: 'Integration configs and activity logs.', persisted: true },
]
