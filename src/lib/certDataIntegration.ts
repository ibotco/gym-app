/**
 * Certificate Data Integration — auto-population engine.
 *
 * Reads from existing School (eduRecords), Employee (hrm/staff), and
 * Membership (AppContext members) data sources and maps them to
 * certificate template variables so generation requires zero manual entry.
 */
import type { EduRecords, EduRow } from './eduRecords'

/* ============================================================ types */

export type IntegrationSource = 'Student' | 'Employee' | 'Member'

export type IntegratedHolder = {
  id: string
  source: IntegrationSource
  name: string
  reference: string
  photo?: string
  gender?: string
  dateOfBirth?: string
  phone?: string
  email?: string
  // Student
  className?: string
  section?: string
  house?: string
  guardian?: string
  rollNo?: string
  admissionNo?: string
  academicYear?: string
  // Employee
  department?: string
  designation?: string
  joinDate?: string
  employeeNo?: string
  staffType?: string
  // Member
  plan?: string
  membershipNo?: string
  membershipStatus?: string
  joinDateMember?: string
  // Academic
  programme?: string
  level?: string
  gpa?: string
  grade?: string
  subjectScores?: string
  // Extras
  extra?: Record<string, string>
}

export type AutoPopulateResult = {
  holder: IntegratedHolder | null
  matchedFields: string[]
  unmatchedFields: string[]
}

/* ============================================================ student */

function findStudent(records: EduRecords, query: string): EduRow | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const students = (records.studentList ?? []) as EduRow[]
  return students.find((s) =>
    [String(s.id), String(s.admissionNo), String(s.name), String(s.rollNo)]
      .some((v) => v.trim().toLowerCase() === q) ||
    String(s.name ?? '').toLowerCase().includes(q) ||
    String(s.admissionNo ?? '').toLowerCase().includes(q),
  )
}

function buildStudentHolder(row: EduRow, records: EduRecords): IntegratedHolder {
  const className = String(row.className ?? '')
  const section = className.includes(' ') ? className.split(' ').slice(1).join(' ') : ''
  const baseClass = className.split(' ')[0] ?? ''

  // Find class record for level/programme
  const classRec = (records.classList ?? []).find((c) =>
    String(c.name ?? '').toLowerCase().startsWith(baseClass.toLowerCase()),
  )
  const level = classRec ? String(classRec.level ?? '') : ''

  // Find programme for this level
  const programme = (records.programme ?? []).find((p) =>
    String(p.name ?? '').toLowerCase().includes(String(level ?? '').toLowerCase()),
  )

  // Try to find marks/results
  const marksRow = (records.marksList ?? records.resultsList ?? []).find((m) =>
    String(m.student ?? m.studentName ?? '').toLowerCase() === String(row.name ?? '').toLowerCase(),
  )

  return {
    id: String(row.id ?? ''),
    source: 'Student',
    name: String(row.name ?? ''),
    reference: String(row.admissionNo ?? row.id ?? ''),
    admissionNo: String(row.admissionNo ?? ''),
    className,
    section,
    house: String(row.house ?? ''),
    guardian: String(row.guardian ?? ''),
    rollNo: String(row.rollNo ?? ''),
    phone: String(row.phone ?? ''),
    gender: String(row.gender ?? ''),
    dateOfBirth: String(row.dateOfBirth ?? row.dob ?? ''),
    email: String(row.email ?? ''),
    academicYear: String(row.academicYear ?? row.session ?? ''),
    programme: programme ? String(programme.name ?? '') : '',
    level,
    gpa: marksRow ? String(marksRow.gpa ?? marksRow.average ?? '') : '',
    grade: marksRow ? String(marksRow.grade ?? '') : '',
    subjectScores: marksRow ? String(marksRow.subjectScores ?? marksRow.scores ?? '') : '',
    extra: {},
  }
}

/* ============================================================ employee */

function findEmployee(records: EduRecords, query: string): EduRow | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const staff = (records.staffList ?? records.employees ?? []) as EduRow[]
  // Fallback to HRM staff data
  if (!staff.length) return undefined
  return staff.find((s) =>
    [String(s.id), String(s.employeeNo), String(s.name), String(s.employeeNumber)]
      .some((v) => v.trim().toLowerCase() === q) ||
    String(s.name ?? '').toLowerCase().includes(q),
  )
}

function buildEmployeeHolder(row: EduRow, records: EduRecords): IntegratedHolder {
  const department = String(row.department ?? '')
  const designation = String(row.designation ?? row.staffDesignation ?? '')

  // Find training records
  const trainingRecs = (records.trainingPrograms ?? records.staffTraining ?? []) as EduRow[]
  const training = trainingRecs.find((t) =>
    String(t.staff ?? t.staffName ?? t.employee ?? '').toLowerCase() === String(row.name ?? '').toLowerCase(),
  )

  return {
    id: String(row.id ?? ''),
    source: 'Employee',
    name: String(row.name ?? ''),
    reference: String(row.employeeNo ?? row.employeeNumber ?? row.id ?? ''),
    employeeNo: String(row.employeeNo ?? row.employeeNumber ?? ''),
    department,
    designation,
    joinDate: String(row.joinDate ?? row.dateEmployed ?? row.employmentDate ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    gender: String(row.gender ?? ''),
    dateOfBirth: String(row.dateOfBirth ?? row.dob ?? ''),
    staffType: String(row.staffType ?? ''),
    extra: training ? {
      trainingPrograms: String(training.program ?? training.training ?? ''),
      trainingDate: String(training.date ?? training.completedDate ?? ''),
    } : {},
  }
}

/* ============================================================ member */

function findMember(records: EduRecords, query: string): EduRow | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  const members = (records.memberList ?? records.members ?? []) as EduRow[]
  if (!members.length) return undefined
  return members.find((m) =>
    [String(m.id), String(m.membershipNo), String(m.name), String(m.membershipNumber)]
      .some((v) => v.trim().toLowerCase() === q) ||
    String(m.name ?? '').toLowerCase().includes(q),
  )
}

function buildMemberHolder(row: EduRow, records: EduRecords): IntegratedHolder {
  const membershipStatus = String(row.status ?? row.membershipStatus ?? 'Active')

  // Find membership record
  const membership = (records.memberships ?? records.membershipList ?? []).find((m) =>
    String(m.memberId ?? m.id ?? '') === String(row.id ?? ''),
  )

  return {
    id: String(row.id ?? ''),
    source: 'Member',
    name: String(row.name ?? ''),
    reference: String(row.membershipNo ?? row.membershipNumber ?? row.id ?? ''),
    membershipNo: String(row.membershipNo ?? row.membershipNumber ?? ''),
    plan: String(row.plan ?? membership?.plan ?? ''),
    membershipStatus,
    joinDateMember: String(row.joinDate ?? row.memberSince ?? row.startDate ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    gender: String(row.gender ?? ''),
    dateOfBirth: String(row.dateOfBirth ?? row.dob ?? ''),
    extra: {},
  }
}

/* ============================================================ unified search */

export function searchHolder(records: EduRecords, source: IntegrationSource, query: string): IntegratedHolder | null {
  if (source === 'Student') {
    const row = findStudent(records, query)
    return row ? buildStudentHolder(row, records) : null
  }
  if (source === 'Employee') {
    const row = findEmployee(records, query)
    return row ? buildEmployeeHolder(row, records) : null
  }
  if (source === 'Member') {
    const row = findMember(records, query)
    return row ? buildMemberHolder(row, records) : null
  }
  return null
}

export function listHolders(records: EduRecords, source: IntegrationSource): IntegratedHolder[] {
  if (source === 'Student') {
    return ((records.studentList ?? []) as EduRow[])
      .filter((s) => String(s.status ?? 'Active') === 'Active')
      .map((row) => buildStudentHolder(row, records))
  }
  if (source === 'Employee') {
    return ((records.staffList ?? records.employees ?? []) as EduRow[])
      .map((row) => buildEmployeeHolder(row, records))
  }
  if (source === 'Member') {
    return ((records.memberList ?? records.members ?? []) as EduRow[])
      .filter((m) => String(m.status ?? 'Active') === 'Active')
      .map((row) => buildMemberHolder(row, records))
  }
  return []
}

export function listStudentsByClass(records: EduRecords, className: string): IntegratedHolder[] {
  const q = className.trim().toLowerCase()
  return ((records.studentList ?? []) as EduRow[])
    .filter((s) => String(s.className ?? '').toLowerCase().includes(q))
    .map((row) => buildStudentHolder(row, records))
}

/* ============================================================ auto-populate */

/** Certificate template variable names that map to holder fields */
const TEMPLATE_VARIABLES = [
  'holderName', 'studentName', 'employeeName', 'memberName',
  'name', 'fullName',
  'admissionNo', 'studentId', 'studentNumber',
  'employeeNo', 'staffNo', 'employeeNumber',
  'membershipNo', 'memberId', 'membershipId',
  'className', 'class', 'section', 'stream',
  'department', 'designation', 'jobTitle',
  'programme', 'course', 'programmeName',
  'gpa', 'grade', 'score', 'result',
  'gender', 'dob', 'dateOfBirth',
  'phone', 'email',
  'guardian', 'rollNo',
  'house',
  'joinDate', 'employmentDate', 'memberSince',
  'status', 'membershipStatus',
] as const

export function autoPopulate(
  holder: IntegratedHolder,
  templateVars: string[],
): AutoPopulateResult {
  const holderMap: Record<string, string> = {
    // Name
    holderName: holder.name,
    studentName: holder.name,
    employeeName: holder.name,
    memberName: holder.name,
    name: holder.name,
    fullName: holder.name,
    // Student
    admissionNo: holder.admissionNo ?? '',
    studentId: holder.id,
    studentNumber: holder.reference,
    className: holder.className ?? '',
    class: holder.className ?? '',
    section: holder.section ?? '',
    stream: holder.section ?? '',
    rollNo: holder.rollNo ?? '',
    house: holder.house ?? '',
    guardian: holder.guardian ?? '',
    programme: holder.programme ?? '',
    programmeName: holder.programme ?? '',
    course: holder.programme ?? '',
    gpa: holder.gpa ?? '',
    grade: holder.grade ?? '',
    score: holder.subjectScores ?? '',
    result: holder.gpa ?? holder.grade ?? '',
    // Employee
    employeeNo: holder.employeeNo ?? '',
    staffNo: holder.reference,
    employeeNumber: holder.employeeNo ?? '',
    department: holder.department ?? '',
    designation: holder.designation ?? '',
    jobTitle: holder.designation ?? '',
    joinDate: holder.joinDate ?? '',
    employmentDate: holder.joinDate ?? '',
    // Member
    membershipNo: holder.membershipNo ?? '',
    memberId: holder.id,
    membershipId: holder.reference,
    membershipStatus: holder.membershipStatus ?? '',
    status: holder.membershipStatus ?? '',
    memberSince: holder.joinDateMember ?? '',
    // Common
    gender: holder.gender ?? '',
    dob: holder.dateOfBirth ?? '',
    dateOfBirth: holder.dateOfBirth ?? '',
    phone: holder.phone ?? '',
    email: holder.email ?? '',
  }

  const matchedFields: string[] = []
  const unmatchedFields: string[] = []

  for (const varName of templateVars) {
    const value = holderMap[varName]
    if (value && value.trim()) {
      matchedFields.push(`${varName} = ${value}`)
    } else {
      unmatchedFields.push(varName)
    }
  }

  return { holder, matchedFields, unmatchedFields }
}

/** Fill template content placeholders using holder data */
export function fillContent(content: string, holder: IntegratedHolder | null): string {
  if (!holder) return content
  return content
    .replace(/\{\{\s*holderName\s*\}\}/gi, holder.name)
    .replace(/\{\{\s*studentName\s*\}\}/gi, holder.name)
    .replace(/\{\{\s*employeeName\s*\}\}/gi, holder.name)
    .replace(/\{\{\s*memberName\s*\}\}/gi, holder.name)
    .replace(/\{\{\s*name\s*\}\}/gi, holder.name)
    .replace(/\{\{\s*admissionNo\s*\}\}/gi, holder.admissionNo ?? holder.reference)
    .replace(/\{\{\s*studentId\s*\}\}/gi, holder.id)
    .replace(/\{\{\s*className\s*\}\}/gi, holder.className ?? '')
    .replace(/\{\{\s*department\s*\}\}/gi, holder.department ?? '')
    .replace(/\{\{\s*designation\s*\}\}/gi, holder.designation ?? '')
    .replace(/\{\{\s*programme\s*\}\}/gi, holder.programme ?? '')
    .replace(/\{\{\s*gpa\s*\}\}/gi, holder.gpa ?? '')
    .replace(/\{\{\s*grade\s*\}\}/gi, holder.grade ?? '')
    .replace(/\{\{\s*membershipNo\s*\}\}/gi, holder.membershipNo ?? holder.reference)
    .replace(/\{\{\s*employeeNo\s*\}\}/gi, holder.employeeNo ?? holder.reference)
}

/* ============================================================ eligibility */

export function checkEligibility(holder: IntegratedHolder): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (holder.source === 'Student') {
    if (!holder.className) reasons.push('Student has no class assignment')
    if (!holder.admissionNo) reasons.push('Student has no admission number')
  }
  if (holder.source === 'Employee') {
    if (!holder.department) reasons.push('Employee has no department')
    if (!holder.designation) reasons.push('Employee has no designation')
  }
  if (holder.source === 'Member') {
    if (holder.membershipStatus && holder.membershipStatus.toLowerCase() !== 'active') {
      reasons.push(`Membership status is "${holder.membershipStatus}", not Active`)
    }
  }

  return { eligible: reasons.length === 0, reasons }
}

/* ============================================================ audit */

export type CertificateAuditEntry = {
  id: string
  certificateNo: string
  action: 'generated' | 'printed' | 'downloaded' | 'reprinted' | 'revoked' | 'verified'
  performedBy: string
  timestamp: string
  dataSource: IntegrationSource | 'manual'
  recordOwner?: string
  template?: string
  details?: string
}

export function createAuditEntry(
  certificateNo: string,
  action: CertificateAuditEntry['action'],
  performedBy: string,
  dataSource: IntegrationSource | 'manual',
  extra?: Partial<CertificateAuditEntry>,
): CertificateAuditEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    certificateNo,
    action,
    performedBy,
    timestamp: new Date().toISOString(),
    dataSource,
    ...extra,
  }
}

/** Read/write audit trail from EduRecords */
export function readAuditTrail(records: EduRecords): CertificateAuditEntry[] {
  const raw = (records as Record<string, unknown>)['certificateAudit'] ?? []
  try {
    return JSON.parse(JSON.stringify(raw)) as CertificateAuditEntry[]
  } catch {
    return []
  }
}

export function writeAuditTrail(records: EduRecords, entries: CertificateAuditEntry[]): EduRecords {
  return { ...records, certificateAudit: entries }
}

export function appendAuditEntry(records: EduRecords, entry: CertificateAuditEntry): EduRecords {
  const existing = readAuditTrail(records)
  return writeAuditTrail(records, [...existing, entry])
}
