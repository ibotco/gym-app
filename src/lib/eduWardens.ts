import type { StaffRecord, User } from '../types'
import type { EduRecords, EduRow } from './eduRecords'
import { uid } from './utils'

export type WardenStaffOption = {
  id: string
  name: string
  employeeNumber: string
  designation: string
  department: string
}

export type WardenPeriod = {
  academicYearId: string
  academicYearName: string
  sessionId: string
  sessionName: string
}

export type WardenAssignment = EduRow & {
  wardenId: string
  wardenName: string
  hostelId: string
  hostelName: string
  academicYearId: string
  academicYear: string
  sessionId: string
  session: string
  startDate: string
  status: string
  endDate: string
  endReason: string
}

export const normalizeWardenName = (value: string) => value.trim().toLocaleLowerCase()

/** Reads both the current JSON multi-select format and legacy single-name values. */
export function parseWardenNames(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map((item) => String(item ?? '').trim()).filter(Boolean))]
    if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()]
  } catch {
    // Older single-warden values were saved as plain text.
  }
  return [raw]
}

export function teachingWardensForBranch(staff: StaffRecord[], users: User[], branchId: string): WardenStaffOption[] {
  const userById = new Map(users.map((user) => [user.id, user]))
  return staff
    .filter((employee) => (!employee.branchId || employee.branchId === branchId)
      && (employee.staffType === 'teacher' || employee.staffCategory?.trim().toLocaleLowerCase() === 'teaching'))
    .map((employee) => {
      const name = userById.get(employee.userId)?.name?.trim() || ''
      if (!name) return null
      return {
        id: employee.id,
        name,
        employeeNumber: String(employee.employeeNumber ?? '').trim(),
        designation: String(employee.staffDesignation || employee.title || '').trim(),
        department: String(employee.department ?? '').trim(),
      }
    })
    .filter((row): row is WardenStaffOption => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

/** Active Academic Year and its active Term/Semester, if one is configured. */
export function activeWardenPeriod(records: EduRecords): WardenPeriod | null {
  const years = records.academicYear ?? []
  const year = years.find((row) => String(row.status ?? '').toLocaleLowerCase() === 'active') || years[0]
  const academicYearId = String(year?.id ?? '').trim()
  const academicYearName = String(year?.name ?? '').trim()
  if (!academicYearId || !academicYearName) return null

  const session = (records.termSemester ?? []).find((row) =>
    String(row.academicYear ?? '').trim() === academicYearName
      && String(row.status ?? '').toLocaleLowerCase() === 'active',
  )
  return {
    academicYearId,
    academicYearName,
    sessionId: String(session?.id ?? '').trim(),
    sessionName: String(session?.name ?? '').trim(),
  }
}

export const wardenAssignmentIsActive = (assignment: Pick<WardenAssignment, 'status'>) =>
  String(assignment.status ?? 'Active').toLocaleLowerCase() === 'active'

function assignmentAppliesToPeriod(assignment: WardenAssignment, period: WardenPeriod) {
  const sessionId = String(assignment.sessionId ?? '').trim()
  return assignment.academicYearId === period.academicYearId
    && (!sessionId || (Boolean(period.sessionId) && sessionId === period.sessionId))
}

/** Effective warden names for the Hostel form's current Academic Year/Session. */
export function currentHostelWardenNames(records: EduRecords, hostel: EduRow, period: WardenPeriod | null): string[] {
  const legacyNames = parseWardenNames(hostel.warden)
  if (!period) return legacyNames

  const hostelId = String(hostel.id ?? '')
  const yearAssignments = ((records.wardenAssignments ?? []) as WardenAssignment[]).filter((row) =>
    row.hostelId === hostelId && row.academicYearId === period.academicYearId,
  )
  const knownForPeriod = new Set(yearAssignments
    .filter((row) => assignmentAppliesToPeriod(row, period))
    .map((row) => normalizeWardenName(row.wardenName)))
  const periodNames = yearAssignments
    .filter((row) => wardenAssignmentIsActive(row) && assignmentAppliesToPeriod(row, period))
    .map((row) => String(row.wardenName ?? '').trim())
  const unscopedLegacyNames = legacyNames.filter((name) => !knownForPeriod.has(normalizeWardenName(name)))
  return [...new Set([...periodNames, ...unscopedLegacyNames])]
}

/** Keep the legacy Hostel Warden field in sync with the active year/session. */
export function syncCurrentHostelWardenFields(records: EduRecords, period: WardenPeriod | null): EduRecords {
  if (!period || !(records.hostelList ?? []).length) return records
  let changed = false
  const hostelList = (records.hostelList ?? []).map((hostel) => {
    const hasYearAssignments = ((records.wardenAssignments ?? []) as WardenAssignment[]).some((row) =>
      row.hostelId === hostel.id && row.academicYearId === period.academicYearId,
    )
    if (!hasYearAssignments) return hostel
    const warden = JSON.stringify(currentHostelWardenNames(records, hostel, period))
    if (String(hostel.warden ?? '') === warden) return hostel
    changed = true
    return { ...hostel, warden }
  })
  return changed ? { ...records, hostelList } : records
}

/**
 * Synchronize edits made in the Hostel form with period-specific assignments.
 * Removed assignments are retained as ended history rather than deleted.
 */
export function syncWardenAssignmentsFromHostel(
  records: EduRecords,
  previousHostel: EduRow | undefined,
  hostel: EduRow,
  selectedNames: string[],
  period: WardenPeriod | null,
  staffOptions: WardenStaffOption[],
): EduRecords {
  if (!period || !hostel.id) return records
  const today = new Date().toISOString().slice(0, 10)
  const names = [...new Set(selectedNames.map((name) => String(name ?? '').trim()).filter(Boolean))]
  const selectedKeys = new Set(names.map(normalizeWardenName))
  let assignments = [...((records.wardenAssignments ?? []) as WardenAssignment[])]
  const inScope = (row: WardenAssignment) => row.hostelId === hostel.id
    && row.academicYearId === period.academicYearId
    && (!row.sessionId || (Boolean(period.sessionId) && row.sessionId === period.sessionId))

  assignments = assignments.map((row) => {
    if (!inScope(row) || !wardenAssignmentIsActive(row) || selectedKeys.has(normalizeWardenName(row.wardenName))) return row
    return { ...row, status: 'Ended', endDate: today, endReason: 'Removed in Hostel form' }
  })

  const activeKeys = new Set(assignments.filter((row) => inScope(row) && wardenAssignmentIsActive(row))
    .map((row) => normalizeWardenName(row.wardenName)))
  for (const name of names) {
    const key = normalizeWardenName(name)
    if (activeKeys.has(key)) continue
    const option = staffOptions.find((staffOption) => normalizeWardenName(staffOption.name) === key)
    assignments.push({
      id: uid('wa'),
      wardenId: option?.id ?? '',
      wardenName: option?.name ?? name,
      hostelId: hostel.id,
      hostelName: String(hostel.hostelName ?? ''),
      academicYearId: period.academicYearId,
      academicYear: period.academicYearName,
      sessionId: period.sessionId,
      session: period.sessionName,
      startDate: today,
      status: 'Active',
      endDate: '',
      endReason: '',
    })
    activeKeys.add(key)
  }

  // A legacy name removed from the Hostel form has no assignment row to end yet.
  const previousNames = parseWardenNames(previousHostel?.warden)
  for (const name of previousNames) {
    const key = normalizeWardenName(name)
    if (selectedKeys.has(key)) continue
    const alreadyRecorded = assignments.some((row) => row.hostelId === hostel.id
      && row.academicYearId === period.academicYearId
      && normalizeWardenName(row.wardenName) === key)
    if (alreadyRecorded) continue
    const option = staffOptions.find((staffOption) => normalizeWardenName(staffOption.name) === key)
    assignments.push({
      id: uid('wa'),
      wardenId: option?.id ?? '',
      wardenName: option?.name ?? name,
      hostelId: hostel.id,
      hostelName: String(hostel.hostelName ?? ''),
      academicYearId: period.academicYearId,
      academicYear: period.academicYearName,
      sessionId: period.sessionId,
      session: period.sessionName,
      startDate: '',
      status: 'Ended',
      endDate: today,
      endReason: 'Removed in Hostel form',
    })
  }

  return { ...records, wardenAssignments: assignments }
}
