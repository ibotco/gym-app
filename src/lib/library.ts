import type { EduRecords, EduRow } from './eduRecords'
import type { StaffRecord, User } from '../types'

/**
 * Library members are generated, not hand-typed: every student becomes a
 * "Student" member and every employee (HRM staff list) a "Staff" member.
 */
export function buildLibraryMembers(records: EduRecords, staff: StaffRecord[], users: User[], branchId: string): EduRow[] {
  const students = (records.studentList ?? []).map((r) => ({
    id: `mem-stu-${r.id}`,
    name: String(r.name ?? ''),
    memberType: 'Student',
    memberNo: String(r.admissionNo ?? r.rollNo ?? ''),
    className: String(r.className ?? ''),
    contactNumber: String(r.phone ?? ''),
    email: String(r.email ?? ''),
    address: String(r.address ?? ''),
  }))
  const employees = staff
    .filter((st) => !branchId || st.branchId === branchId)
    .map((st) => {
      const u = users.find((x) => x.id === st.userId)
      return {
        id: `mem-stf-${st.id}`,
        name: u?.name ?? 'Staff',
        memberType: 'Staff',
        memberNo: u?.username ?? '',
        className: '',
        contactNumber: u?.phone ?? '',
        email: u?.email ?? '',
        address: '',
      }
    })
  return [...students, ...employees]
}

export type MembershipState = { member: 'yes' | 'no'; status: 'Active' | 'Inactive' }

/** Default: everyone generated belongs with an Active membership until told otherwise. */
export function memberStateOf(overrides: EduRow[], rowId: string): MembershipState {
  const o = overrides.find((r) => r.id === rowId)
  return {
    member: o?.member === 'no' ? 'no' : 'yes',
    status: o?.status === 'Inactive' ? 'Inactive' : 'Active',
  }
}

export function withMemberState(overrides: EduRow[], rowId: string, patch: Partial<MembershipState>): EduRow[] {
  const cur = overrides.find((r) => r.id === rowId)
  const next: EduRow = { id: rowId, member: 'yes', status: 'Active', ...cur, ...patch }
  return [...overrides.filter((r) => r.id !== rowId), next]
}

export function withAllMemberState(overrides: EduRow[], rowIds: string[], member: 'yes' | 'no'): EduRow[] {
  return rowIds.reduce((acc, id) => withMemberState(acc, id, { member }), overrides)
}

/** Registered external members (neither student nor employee) live in the same
    store, prefixed so they never collide with generated person ids. */
export const EXTERNAL_MEMBER_PREFIX = 'mem-ext-'

export function splitMemberStore(store: EduRow[]): { externalRows: EduRow[]; membershipOverrides: EduRow[] } {
  return {
    externalRows: store.filter((r) => r.id.startsWith(EXTERNAL_MEMBER_PREFIX)),
    membershipOverrides: store.filter((r) => !r.id.startsWith(EXTERNAL_MEMBER_PREFIX)),
  }
}

/** Patch membership state wherever it lives: on the external registration row
    itself, or in an override entry for a generated student/staff person. */
export function applyMemberPatch(store: EduRow[], rowId: string, patch: Partial<MembershipState>): EduRow[] {
  if (rowId.startsWith(EXTERNAL_MEMBER_PREFIX)) {
    return store.map((r) => (r.id === rowId ? { ...r, ...patch } : r))
  }
  const { externalRows, membershipOverrides } = splitMemberStore(store)
  return [...withMemberState(membershipOverrides, rowId, patch), ...externalRows]
}

export function applyAllMemberPatch(store: EduRow[], rowIds: string[], member: 'yes' | 'no'): EduRow[] {
  return rowIds.reduce((acc, id) => applyMemberPatch(acc, id, { member }), store)
}

/** Selectable member names: everyone generated plus registered externals. */
export function memberNameOptions(records: EduRecords, staff: StaffRecord[], users: User[], branchId: string): string[] {
  const external = splitMemberStore(records.members ?? []).externalRows
  const names = [
    ...buildLibraryMembers(records, staff, users, branchId).map((r) => String(r.name ?? '').trim()),
    ...external.map((r) => String(r.name ?? '').trim()),
  ]
  return [...new Set(names.filter(Boolean))].sort()
}

type LeafShape = { fields: { key: string }[] }

/** Membership list filters: member type (Student/Staff/External) and class. */
export function filterMemberRows(rows: EduRow[], leaf: LeafShape | undefined, q: string, memberType: string, className: string): EduRow[] {
  let out = rows
  if (memberType) out = out.filter((r) => String(r.memberType ?? '') === memberType)
  if (className) out = out.filter((r) => String(r.className ?? '') === className)
  const ql = q.trim().toLowerCase()
  if (ql && leaf) out = out.filter((r) => leaf.fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(ql)))
  return out
}

/* ------------------------------------------------------------------ */
/* Circulation: loans, overdue detection, stock availability, stats.  */
/* ------------------------------------------------------------------ */

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** A loan is overdue while it is out (not returned) and past its due date. */
export function isOverdueLoan(r: EduRow, today: string = todayISO()): boolean {
  if (r.returnDate || r.status === 'Returned') return false
  return (r.status === 'Issued' || r.status === 'Overdue') && !!r.dueDate && String(r.dueDate) < today
}

export function isActiveLoan(r: EduRow): boolean {
  return !r.returnDate && r.status !== 'Returned'
}

/** How many copies of each book title are currently out on loan. */
export function activeLoansByTitle(records: EduRecords): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of records.bookIssueReturn ?? []) {
    if (!isActiveLoan(r)) continue
    const t = String(r.book ?? '').trim()
    if (t) out[t] = (out[t] ?? 0) + 1
  }
  return out
}

export function availableStock(book: EduRow, loansByTitle: Record<string, number>): number {
  const total = Number(book.totalStock ?? 0) || 0
  return Math.max(0, total - (loansByTitle[String(book.title ?? '').trim()] ?? 0))
}

export type LibrarySettings = { loanPeriodDays: number; finePerDay: number }

/** Circulation policy comes from Library → Library Settings (with sane defaults). */
export function settingsFrom(records: EduRecords): LibrarySettings {
  const row = (records.librarySettings ?? [])[0]
  const loan = Number(row?.loanPeriodDays ?? 0)
  const fine = Number(row?.finePerDay ?? 0)
  return {
    loanPeriodDays: loan > 0 ? Math.floor(loan) : 14,
    finePerDay: fine > 0 ? fine : 0,
  }
}

/** Approving a request issues the book for the configured loan period. */
export function makeLoanFromRequest(r: EduRow, today: string = todayISO(), loanPeriodDays = 14): EduRow {
  return {
    id: `loan-req-${r.id}`,
    book: String(r.book ?? ''),
    member: String(r.member ?? ''),
    issueDate: today,
    dueDate: addDays(today, loanPeriodDays),
    returnDate: '',
    status: 'Issued',
  }
}

/** Days past the due date while the book is still out (0 when not overdue). */
export function overdueDays(r: EduRow, today: string = todayISO()): number {
  if (!isOverdueLoan(r, today)) return 0
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${String(r.dueDate)}T00:00:00Z`)
  return Math.max(0, Math.floor(ms / 86400000))
}

export function overdueFine(r: EduRow, finePerDay: number, today: string = todayISO()): number {
  return overdueDays(r, today) * finePerDay
}

/** Whether another copy of the titled book can be issued right now. */
export function canIssueBook(records: EduRecords, title: string): boolean {
  const t = String(title ?? '').trim()
  if (!t) return false
  const book = (records.books ?? []).find((b) => String(b.title ?? '').trim() === t)
  if (!book) return false
  return availableStock(book, activeLoansByTitle(records)) > 0
}

/** Outstanding fines per member name (overdue loans only). */
export function finesByMember(records: EduRecords, today: string = todayISO()): Record<string, number> {
  const { finePerDay } = settingsFrom(records)
  const out: Record<string, number> = {}
  for (const r of records.bookIssueReturn ?? []) {
    const fine = overdueFine(r, finePerDay, today)
    if (fine <= 0) continue
    const name = String(r.member ?? '').trim()
    if (name) out[name] = (out[name] ?? 0) + fine
  }
  return out
}

/** One-line snapshot used when generating a library report record. */
export function snapshotTitle(stats: LibraryStats, today: string = todayISO()): string {
  return `Snapshot ${today} — ${stats.titles} titles, ${stats.available}/${stats.totalStock} available, ${stats.onLoan} on loan, ${stats.overdue} overdue`
}

export type LibraryStats = {
  titles: number
  totalStock: number
  available: number
  membersActive: number
  onLoan: number
  overdue: number
  pendingRequests: number
  fines: number
}

export function computeLibraryStats(records: EduRecords, staff: StaffRecord[], users: User[], branchId: string): LibraryStats {
  const books = records.books ?? []
  const loans = records.bookIssueReturn ?? []
  const requests = records.requestBooks ?? []
  const loansByTitle = activeLoansByTitle(records)
  const available = books.reduce((sum, b) => sum + availableStock(b, loansByTitle), 0)
  const totalStock = books.reduce((sum, b) => sum + (Number(b.totalStock ?? 0) || 0), 0)

  const store = records.members ?? []
  const { externalRows, membershipOverrides } = splitMemberStore(store)
  const generated = buildLibraryMembers(records, staff, users, branchId)
  const membersActive =
    generated.filter((r) => {
      const st = memberStateOf(membershipOverrides, r.id)
      return st.member === 'yes' && st.status === 'Active'
    }).length + externalRows.filter((r) => r.member !== 'no' && r.status !== 'Inactive').length

  const { finePerDay } = settingsFrom(records)
  return {
    titles: books.length,
    totalStock,
    available,
    membersActive,
    onLoan: loans.filter(isActiveLoan).length,
    overdue: loans.filter((r) => isOverdueLoan(r)).length,
    pendingRequests: requests.filter((r) => r.status === 'Pending').length,
    fines: loans.reduce((sum, r) => sum + overdueFine(r, finePerDay, todayISO()), 0),
  }
}
