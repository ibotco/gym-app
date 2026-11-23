import type { StaffRecord, Status, User } from '../types'

export interface StaffListFilterValues {
  department: string
  staffId: string
  status: Status | ''
}

export const emptyStaffListFilters = (): StaffListFilterValues => ({
  department: '',
  staffId: '',
  status: '',
})

const normalized = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase()

// HR screens repeatedly filter employee and activity rows against the same
// store arrays. Cache lookups by the immutable array reference so large teams
// use O(1) joins rather than a find() scan for every row.
const usersByIdCache = new WeakMap<User[], Map<string, User>>()
const staffByUserIdCache = new WeakMap<StaffRecord[], Map<string, StaffRecord>>()

function usersById(users: User[]): Map<string, User> {
  let index = usersByIdCache.get(users)
  if (!index) {
    index = new Map()
    for (const user of users) if (!index.has(user.id)) index.set(user.id, user)
    usersByIdCache.set(users, index)
  }
  return index
}

function staffByUserId(staff: StaffRecord[]): Map<string, StaffRecord> {
  let index = staffByUserIdCache.get(staff)
  if (!index) {
    index = new Map()
    for (const record of staff) if (!index.has(record.userId)) index.set(record.userId, record)
    staffByUserIdCache.set(staff, index)
  }
  return index
}

/** Match shared employee filters against the employee master and linked account. */
export function matchesStaffListFilters(
  record: Pick<StaffRecord, 'id' | 'userId' | 'department' | 'employeeNumber'> | undefined,
  personOrUsers: Pick<User, 'status'> | User[] | undefined,
  filters: StaffListFilterValues,
): boolean {
  const staffIdQuery = normalized(filters.staffId)
  const department = normalized(filters.department)

  // The common All Departments / all statuses state can return immediately —
  // no employee lookups or string work are needed for every row.
  if (!filters.status && !department && !staffIdQuery) return true

  const person = filters.status
    ? Array.isArray(personOrUsers)
      ? record ? usersById(personOrUsers).get(record.userId) : undefined
      : personOrUsers
    : undefined

  if (filters.status && (!record || person?.status !== filters.status)) return false
  if (department && normalized(record?.department) !== department) return false
  if (staffIdQuery) {
    if (!record) return false
    const identifiers = [record.employeeNumber, record.id, record.userId]
    if (!identifiers.some((value) => normalized(value).includes(staffIdQuery))) return false
  }
  if (department && !record) return false
  return true
}

/** Match an activity row's employee user id to the staff master before filtering. */
export function matchesStaffUserId(
  staffUserId: string,
  staff: StaffRecord[],
  users: User[],
  filters: StaffListFilterValues,
): boolean {
  if (!normalized(filters.department) && !normalized(filters.staffId) && !filters.status) return true
  const record = staffByUserId(staff).get(staffUserId)
  const person = filters.status ? usersById(users).get(staffUserId) : undefined
  return matchesStaffListFilters(record, person, filters)
}

export function staffDepartmentOptions(staff: StaffRecord[]): string[] {
  const values = new Map<string, string>()
  for (const record of staff) {
    const department = String(record.department || '').trim()
    const key = department.toLocaleLowerCase()
    if (department && !values.has(key)) values.set(key, department)
  }
  return [...values.values()].sort((a, b) => a.localeCompare(b))
}
