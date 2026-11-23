import type { StaffRecord, User } from '../types'

export type TeacherNameDisplayMode = 'full' | 'short'

/** Build an uppercase initial for every word in a teacher's full name. */
export function initialsForTeacherName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

/**
 * Resolve a teacher's timetable label. Prefer the employee's saved HR Short
 * value; fall back to initials for legacy staff records without one.
 */
export function teacherTimetableName(
  fullName: string,
  mode: TeacherNameDisplayMode,
  staff: StaffRecord[],
  users: User[],
  activeBranchId: string,
): string {
  if (mode !== 'short') return fullName
  const target = fullName.trim().toLocaleLowerCase()
  const employee = staff.find((record) => {
    if (record.branchId && activeBranchId && record.branchId !== activeBranchId) return false
    const employeeName = users.find((user) => user.id === record.userId)?.name?.trim().toLocaleLowerCase()
    return employeeName === target
  })
  return employee?.shortName?.trim() || initialsForTeacherName(fullName) || fullName
}
