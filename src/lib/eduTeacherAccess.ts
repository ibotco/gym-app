import { useMemo } from 'react'
import type { StaffRecord, User } from '../types'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { loadEduRecords, type EduRecords, type EduRow } from './eduRecords'
import { getCaClasses, getCaSections, normCaSec } from './examCaSync'
import { loadRoles } from './permissions'

/** Admin / managerial roles that always retain full unrestricted access across all classes & subjects. */
const UNRESTRICTED_ADMIN_ROLES = new Set([
  'super_admin',
  'gym_manager',
  'company_admin',
  'branch_admin',
  'head_office',
  'accountant',
  'receptionist',
  'hr_officer',
  'hr_manager',
  'finance_officer',
  'payroll_administrator',
])

/** Education Management leaf IDs accessible to a signed-in Teacher. */
export const TEACHER_EDU_LEAVES = new Set<string>([
  // Classes & Subjects (assigned view)
  'classList',
  'assignClassTeacher',
  'subjectList',
  'assignClassSubjects',
  'assignSubjectTeacher',
  // Timetable
  'classTimetable',
  'teacherTimetable',
  'roomAllocation',
  'print',
  // Attendance
  'studentAttendance',
  'attendanceReports',
  // Students
  'studentList',
  'parents',
  'prefectsLeadership',
  // Staff leave
  'staffLeave',
  // Lesson Plan
  'lessonPlanGenerator',
  'lessonPlans',
  'lessonPlanApprovals',
  // Lesson Note
  'lessonNoteGenerator',
  'lessonNotes',
  'lessonNoteApprovals',
  // Examinations
  'continuousAssessment',
  'examSchedule',
  'markEntries',
  'gradesRange',
  'examResult',
  'promotions',
  'examReports',
  // Online Examinations & Homework
  'homework',
  'evaluationReport',
  'onlineExam',
  'questionBank',
  'questionGroup',
  'onlineExamResult',
  'onlineExamReports',
  // Library
  'books',
  'requestBooks',
  'bookIssueReturn',
  // Reports
  'reportStudentInformation',
  'reportAttendance',
  'reportExaminations',
  'reportOnlineExaminations',
  'reportLessonPlan',
  'reportLessonNote',
  'reportHomework',
  'reportLibrary',
])

/** Sidebar i18n keys under Education Management (and Overview) visible to a Teacher. */
export const TEACHER_ALLOWED_NAV_KEYS = new Set<string>([
  'nav.overview',
  'nav.educationManagement',
  'nav.eduOverview',
  // Groups
  'nav.eduClasses',
  'nav.eduSubjects',
  'nav.eduTimetable',
  'nav.eduAttendance',
  'nav.eduStudents',
  'nav.eduLessonPlan',
  'nav.eduLessonNote',
  'nav.eduExaminations',
  'nav.eduOnlineExaminations',
  'nav.eduLibrary',
  'nav.eduReports',
  // Leaves
  'nav.eduClassList',
  'nav.eduAssignClassTeacher',
  'nav.eduSubjectList',
  'nav.eduAssignClassSubjects',
  'nav.eduAssignSubjectTeacher',
  'nav.eduClassTimetable',
  'nav.eduTeacherTimetable',
  'nav.eduRoomAllocation',
  'nav.eduPrint',
  'nav.eduStudentAttendance',
  'nav.eduAttendanceReports',
  'nav.eduStudentList',
  'nav.eduParents',
  'nav.eduPrefectsLeadership',
  'nav.eduLessonPlans',
  'nav.eduLessonPlanApprovals',
  'nav.eduLessonNoteGenerator',
  'nav.eduLessonNotes',
  'nav.eduLessonNoteApprovals',
  'nav.eduContinuousAssessment',
  'nav.eduExamSchedule',
  'nav.eduMarkEntries',
  'nav.eduGradesRange',
  'nav.eduExamResult',
  'nav.eduPromotions',
  'nav.eduExamReports',
  'nav.eduHomework',
  'nav.eduEvaluationReport',
  'nav.eduOnlineExam',
  'nav.eduQuestionBank',
  'nav.eduQuestionGroup',
  'nav.eduOnlineExamResult',
  'nav.eduOnlineExamReports',
  'nav.eduBooks',
  'nav.eduRequestBooks',
  'nav.eduBookIssueReturn',
  'nav.eduReportStudentInformation',
  'nav.eduReportAttendance',
  'nav.eduReportExaminations',
  'nav.eduReportOnlineExaminations',
  'nav.eduReportLessonPlan',
  'nav.eduReportLessonNote',
  'nav.eduReportHomework',
  'nav.eduReportLibrary',
])

/** Reference leaves where Teachers can view/search their assigned records without modifying master setup. */
export const TEACHER_READ_ONLY_LEAVES = new Set<string>([
  'classList',
  'assignClassTeacher',
  'subjectList',
  'assignClassSubjects',
  'assignSubjectTeacher',
  'studentList',
  'parents',
  'prefectsLeadership',
  'examSchedule',
  'gradesRange',
  'examResult',
  'examReports',
  'books',
  'bookIssueReturn',
  'attendanceReports',
])

export interface ClassSectionPair {
  baseClass: string
  section: string
  fullLabel: string
}

export interface TeacherScope {
  /** True when the signed-in user is a Teacher (and NOT an unrestricted school admin). */
  isTeacher: boolean
  /** Canonical teacher full name matching Education Management records. */
  teacherName: string
  /**
   * Display alias of `teacherName`. Older Education Management screens
   * (Lesson Plan / Lesson Note generators) still read this name.
   */
  teacherDisplayName: string
  /** Optional HR employee number (e.g. T-001). */
  employeeNumber: string
  /** Optional designation / title (e.g. Mathematics Teacher). */
  designation: string
  /** Homeroom / Form Teacher class labels (e.g. ['Basic 7 A']). */
  homeroomClassLabels: string[]
  /** All assigned class+section labels (e.g. ['Basic 7 A', 'Basic 8 A', 'Basic 9 B']). */
  assignedClassLabels: string[]
  /** Unique base class names (e.g. ['Basic 7', 'Basic 8', 'Basic 9']). */
  assignedBaseClasses: string[]
  /** Structured (baseClass, section, fullLabel) pairs assigned to this teacher. */
  assignedPairs: ClassSectionPair[]
  /** All unique subject names assigned to this teacher (e.g. ['Mathematics']). */
  assignedSubjects: string[]
  /** Assigned sections for a specific base class (e.g. 'Basic 7' -> ['A']). */
  sectionsForBaseClass: (baseClass: string) => string[]
  /** Assigned subjects for a specific base class + optional section. */
  subjectsForClassSection: (
    baseClass: string,
    section?: string,
    classConfiguredSubjects?: string[],
  ) => string[]
  /**
   * Assigned subjects for a class label, e.g. 'Basic 7' or 'Basic 7 A'.
   * Convenience alias of `subjectsForClassSection` that parses the label itself.
   */
  subjectsForClass: (classLabel: string, classConfiguredSubjects?: string[]) => string[]
  /** True if (rawClassName, rawSection) belongs to this teacher's assigned classes/sections. */
  matchesClassSection: (rawClassName: unknown, rawSection?: unknown) => boolean
  /** True if (rawClassName, rawSection) belongs to this teacher's homeroom class(es). */
  matchesHomeroomClassSection: (rawClassName: unknown, rawSection?: unknown) => boolean
  /** True if rawSubject is taught by this teacher (optionally within rawClassName/rawSection). */
  matchesSubject: (rawSubject: unknown, rawClassName?: unknown, rawSection?: unknown) => boolean
  /** True if a student (by name or id) belongs to one of this teacher's assigned classes/sections. */
  matchesStudent: (rawStudentNameOrId: unknown) => boolean
  /** Case-insensitive match against this teacher's name. */
  matchesTeacherName: (rawName: unknown) => boolean
  /** True if a Continuous Assessment record overlaps at least one assigned (Class, Section) pair. */
  filterCaAssessment: (caRow: EduRow) => boolean
  /** Filter rows of an Education Management leaf table to this teacher's scope. */
  filterLeafRows: (leafId: string, rows: EduRow[]) => EduRow[]
}

const cleanStr = (v: unknown) => String(v ?? '').trim()
const normLower = (v: unknown) => cleanStr(v).toLocaleLowerCase()
const canonicalSec = (v: unknown) => cleanStr(v).replace(/^section\s+/i, '').trim()

function uniqueSorted(values: Iterable<string>): string[] {
  const seen = new Map<string, string>()
  for (const raw of values) {
    const val = cleanStr(raw)
    if (!val) continue
    const k = val.toLocaleLowerCase()
    if (!seen.has(k)) seen.set(k, val)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(cleanStr).filter(Boolean)
  const s = cleanStr(raw)
  if (!s) return []
  try {
    const parsed = JSON.parse(s)
    if (Array.isArray(parsed)) return parsed.map(cleanStr).filter(Boolean)
  } catch {
    /* ignore */
  }
  return s
    .split(/[\n,;]/)
    .map((x) => x.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean)
}

/**
 * Determine whether a signed-in user is a Teacher (either via role === 'teacher',
 * custom teacher role, HRM StaffRecord with staffType === 'teacher' / Teaching,
 * or Education Management staffList / teacher assignments).
 */
export function isTeacherUser(
  user: User | null | undefined,
  staff: StaffRecord[],
  records?: EduRecords,
): boolean {
  if (!user) return false
  if (UNRESTRICTED_ADMIN_ROLES.has(user.role)) return false
  if (user.role === 'teacher' || user.role === 'role_teacher') return true

  // Custom role check
  const roleDef = loadRoles().find((r) => r.id === user.role && !r.builtin)
  if (
    roleDef &&
    (roleDef.name.trim().toLocaleLowerCase() === 'teacher' ||
      roleDef.permissions.includes('education.teach'))
  ) {
    return true
  }

  // Only staff/custom users below can be employee-linked teachers (never member/customer/supplier/trainer)
  if (['member', 'customer', 'supplier', 'trainer'].includes(user.role)) return false

  const emp = staff.find((s) => s.userId === user.id)
  if (emp) {
    if (emp.staffType === 'teacher') return true
    if (normLower(emp.staffCategory) === 'teaching') return true
    if (
      normLower(emp.title).includes('teacher') ||
      normLower(emp.staffDesignation).includes('teacher')
    ) {
      return true
    }
  }

  if (records) {
    const uEmail = normLower(user.email)
    const uName = normLower(user.name)
    const staffRow = (records.staffList ?? []).find(
      (r) =>
        (uEmail && normLower(r.email) === uEmail) ||
        (uName && normLower(r.name) === uName),
    )
    if (staffRow && normLower(staffRow.designation).includes('teacher')) return true
    if (
      uName &&
      ((records.assignClassTeacher ?? []).some((r) => normLower(r.teacher) === uName) ||
        (records.assignSubjectTeacher ?? []).some((r) => normLower(r.teacher) === uName))
    ) {
      return true
    }
  }

  return false
}

/**
 * Parse a class + optional section reference (such as 'Basic 7 A' or ('Basic 7', 'Section A'))
 * into canonical { baseClass, section, fullLabel } using known classes & sections in `records`.
 */
export function parseClassSection(
  rawClassName: unknown,
  rawSection: unknown,
  records: EduRecords,
): ClassSectionPair | null {
  const clsInput = cleanStr(rawClassName)
  const secInput = canonicalSec(rawSection)
  if (!clsInput) return null

  const knownBaseClasses = uniqueSorted([
    ...(records.classList ?? []).map((r) => cleanStr(r.name)),
    ...(records.level ?? []).map((r) => cleanStr(r.name)),
    ...(records.assignClassSubjects ?? []).map((r) => cleanStr(r.className)),
  ]).sort((a, b) => b.length - a.length) // match longest base class prefix first

  const knownSections = new Set(
    [
      ...(records.academicSections ?? []).map((r) => normCaSec(r.name)),
      ...(records.classList ?? []).map((r) => normCaSec(r.section)),
      ...(records.assignClassSubjects ?? []).flatMap((r) =>
        parseJsonArray(r.sections ?? r.section).map((s) => normCaSec(s)),
      ),
      'a',
      'b',
      'c',
      'd',
      'e',
    ].filter(Boolean),
  )

  const displaySec = (s: string) => (s.length === 1 ? s.toUpperCase() : s)

  if (secInput) {
    // Check if clsInput already ends with secInput (e.g. 'Basic 7 A' + 'A')
    const suffixRe = new RegExp(`\\s+${secInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    const base = clsInput.replace(suffixRe, '').trim() || clsInput
    const sec = displaySec(secInput)
    return { baseClass: base, section: sec, fullLabel: `${base} ${sec}`.trim() }
  }

  // Try matching against known base classes
  const lowerInput = clsInput.toLocaleLowerCase()
  for (const base of knownBaseClasses) {
    const lowerBase = base.toLocaleLowerCase()
    if (lowerInput === lowerBase) {
      return { baseClass: base, section: '', fullLabel: base }
    }
    if (lowerInput.startsWith(`${lowerBase} `)) {
      const remainder = canonicalSec(clsInput.slice(base.length).trim())
      if (remainder) {
        const sec = displaySec(remainder)
        return { baseClass: base, section: sec, fullLabel: `${base} ${sec}` }
      }
    }
  }

  // Fallback: check trailing token if it looks like a section (e.g., 'Basic 10 A')
  const parts = clsInput.split(/\s+/)
  if (parts.length >= 2) {
    const last = canonicalSec(parts[parts.length - 1])
    if (knownSections.has(normCaSec(last))) {
      const base = parts.slice(0, -1).join(' ')
      const sec = displaySec(last)
      return { baseClass: base, section: sec, fullLabel: `${base} ${sec}` }
    }
  }

  return { baseClass: clsInput, section: '', fullLabel: clsInput }
}

/**
 * Resolve the full class, section, subject, and student scope for a Teacher.
 */
export function resolveTeacherScope(
  user: User | null | undefined,
  staff: StaffRecord[],
  records: EduRecords,
): TeacherScope {
  const teacherFlag = isTeacherUser(user, staff, records)

  const emp = user ? staff.find((s) => s.userId === user.id) : undefined
  const uEmail = normLower(user?.email)
  const uName = cleanStr(user?.name)
  const staffRow = (records.staffList ?? []).find(
    (r) =>
      (uEmail && normLower(r.email) === uEmail) ||
      (uName && normLower(r.name) === normLower(uName)),
  )

  const teacherName = cleanStr(staffRow?.name) || uName
  const teacherLower = normLower(teacherName)
  const employeeNumber = cleanStr(emp?.employeeNumber || staffRow?.staffNo)
  const designation = cleanStr(
    emp?.staffDesignation || emp?.title || staffRow?.designation || (teacherFlag ? 'Teacher' : ''),
  )

  const matchesTeacherName = (rawName: unknown): boolean => {
    const n = normLower(rawName)
    if (!n || !teacherLower) return false
    return n === teacherLower || (!!uName && n === normLower(uName))
  }

  // If NOT a teacher (e.g. Admin / Manager), return an unrestricted pass-through scope
  if (!teacherFlag) {
    return {
      isTeacher: false,
      teacherName,
      teacherDisplayName: teacherName,
      employeeNumber,
      designation,
      homeroomClassLabels: [],
      assignedClassLabels: [],
      assignedBaseClasses: [],
      assignedPairs: [],
      assignedSubjects: [],
      sectionsForBaseClass: () => [],
      subjectsForClassSection: (_cls, _sec, configured) => configured ?? [],
      subjectsForClass: (_label, configured) => configured ?? [],
      matchesClassSection: () => true,
      matchesHomeroomClassSection: () => true,
      matchesSubject: () => true,
      matchesStudent: () => true,
      matchesTeacherName,
      filterCaAssessment: () => true,
      filterLeafRows: (_leafId, rows) => rows,
    }
  }

  // 1. Collect Homeroom / Form Teacher class+section pairs
  const homeroomMap = new Map<string, ClassSectionPair>()
  const pairMap = new Map<string, ClassSectionPair>()
  const pairKeyOf = (p: ClassSectionPair) =>
    `${normLower(p.baseClass)}::${normCaSec(p.section)}`

  const registerPair = (p: ClassSectionPair | null, isHomeroom = false) => {
    if (!p) return
    // If section is empty, expand to matching classList sections if any exist
    if (!p.section) {
      const matchingClassRows = (records.classList ?? []).filter(
        (c) => normLower(c.name) === normLower(p.baseClass) && cleanStr(c.section),
      )
      if (matchingClassRows.length > 0) {
        for (const cr of matchingClassRows) {
          const expanded = parseClassSection(cr.name, cr.section, records)
          if (expanded) {
            pairMap.set(pairKeyOf(expanded), expanded)
            if (isHomeroom) homeroomMap.set(pairKeyOf(expanded), expanded)
          }
        }
        return
      }
    }
    pairMap.set(pairKeyOf(p), p)
    if (isHomeroom) homeroomMap.set(pairKeyOf(p), p)
  }

  for (const r of records.assignClassTeacher ?? []) {
    if (matchesTeacherName(r.teacher)) {
      registerPair(parseClassSection(r.className, r.section, records), true)
    }
  }
  for (const r of records.classList ?? []) {
    if (matchesTeacherName(r.classTeacher)) {
      registerPair(parseClassSection(r.name, r.section, records), true)
    }
  }

  // 2. Collect Subject Teacher assignments per (class, section) & globally
  const subjectsByPair = new Map<string, Set<string>>()
  const subjectsByBase = new Map<string, Set<string>>()
  const globalSubjects = new Map<string, string>() // lower -> display name

  const recordSubject = (subjRaw: unknown, p?: ClassSectionPair | null) => {
    const subj = cleanStr(subjRaw)
    if (!subj) return
    const sLow = subj.toLocaleLowerCase()
    if (!globalSubjects.has(sLow)) globalSubjects.set(sLow, subj)
    if (p) {
      registerPair(p, false)
      const pk = pairKeyOf(p)
      if (!subjectsByPair.has(pk)) subjectsByPair.set(pk, new Set())
      subjectsByPair.get(pk)!.add(subj)

      const bk = normLower(p.baseClass)
      if (!subjectsByBase.has(bk)) subjectsByBase.set(bk, new Set())
      subjectsByBase.get(bk)!.add(subj)
    }
  }

  for (const r of records.assignSubjectTeacher ?? []) {
    if (matchesTeacherName(r.teacher)) {
      const p = parseClassSection(r.className, r.section, records)
      recordSubject(r.subject, p)
    }
  }
  for (const r of records.classTimetable ?? []) {
    if (matchesTeacherName(r.teacher)) {
      const p = parseClassSection(r.className, r.section, records)
      recordSubject(r.subject, p)
    }
  }
  for (const r of records.roomAllocation ?? []) {
    if (matchesTeacherName(r.teacher)) {
      const p = parseClassSection(r.className, r.section, records)
      recordSubject(r.subject, p)
    }
  }
  // Default subject teacher on subjectList
  const defaultSubjectListNames: string[] = []
  for (const r of records.subjectList ?? []) {
    if (matchesTeacherName(r.teacher)) {
      const sName = cleanStr(r.name)
      if (sName) {
        defaultSubjectListNames.push(sName)
        recordSubject(sName)
      }
    }
  }

  const assignedPairs = [...pairMap.values()].sort((a, b) =>
    a.fullLabel.localeCompare(b.fullLabel, undefined, { numeric: true, sensitivity: 'base' }),
  )
  const homeroomPairs = [...homeroomMap.values()].sort((a, b) =>
    a.fullLabel.localeCompare(b.fullLabel, undefined, { numeric: true, sensitivity: 'base' }),
  )

  const homeroomClassLabels = uniqueSorted(homeroomPairs.map((p) => p.fullLabel))
  const assignedClassLabels = uniqueSorted(assignedPairs.map((p) => p.fullLabel))
  const assignedBaseClasses = uniqueSorted(assignedPairs.map((p) => p.baseClass))
  const assignedSubjects = uniqueSorted(globalSubjects.values())

  const sectionsForBaseClass = (baseClass: string): string[] => {
    const bLow = normLower(baseClass)
    if (!bLow) {
      return uniqueSorted(assignedPairs.map((p) => p.section).filter(Boolean))
    }
    return uniqueSorted(
      assignedPairs
        .filter((p) => normLower(p.baseClass) === bLow && p.section)
        .map((p) => p.section),
    )
  }

  const matchesPairList = (
    list: ClassSectionPair[],
    rawClassName: unknown,
    rawSection?: unknown,
  ): boolean => {
    const parsed = parseClassSection(rawClassName, rawSection, records)
    if (!parsed) return false
    const bLow = normLower(parsed.baseClass)
    const sNorm = normCaSec(parsed.section)
    return list.some((p) => {
      if (normLower(p.baseClass) !== bLow) return false
      if (!sNorm) {
        // Only match bare base class when no section was specified on the row
        return true
      }
      if (!p.section) return true
      return normCaSec(p.section) === sNorm
    })
  }

  const matchesClassSection = (rawClassName: unknown, rawSection?: unknown): boolean =>
    matchesPairList(assignedPairs, rawClassName, rawSection)

  const matchesHomeroomClassSection = (rawClassName: unknown, rawSection?: unknown): boolean =>
    matchesPairList(homeroomPairs, rawClassName, rawSection)

  const subjectsForClassSection = (
    baseClass: string,
    section?: string,
    classConfiguredSubjects?: string[],
  ): string[] => {
    const parsed = parseClassSection(baseClass, section, records)
    if (!parsed) return assignedSubjects

    const pk = pairKeyOf(parsed)
    const bk = normLower(parsed.baseClass)
    const directSet = new Set<string>()

    if (parsed.section && subjectsByPair.has(pk)) {
      subjectsByPair.get(pk)!.forEach((s) => directSet.add(s))
    } else if (!parsed.section && subjectsByBase.has(bk)) {
      subjectsByBase.get(bk)!.forEach((s) => directSet.add(s))
    }

    // Include subjects from subjectList where this teacher is default teacher,
    // provided the class offers them (or no class subjects are configured)
    for (const defSub of defaultSubjectListNames) {
      if (
        !classConfiguredSubjects?.length ||
        classConfiguredSubjects.some((cs) => normLower(cs) === normLower(defSub))
      ) {
        directSet.add(defSub)
      }
    }

    if (directSet.size > 0) {
      const list = uniqueSorted(directSet)
      if (classConfiguredSubjects?.length) {
        const filtered = classConfiguredSubjects.filter((cs) =>
          list.some((ts) => normLower(ts) === normLower(cs)),
        )
        return filtered.length > 0 ? filtered : list
      }
      return list
    }

    // Fallback for Primary-style Class Teachers who have NO subject-specific assignments anywhere
    if (assignedSubjects.length === 0 && matchesHomeroomClassSection(baseClass, section)) {
      return classConfiguredSubjects ?? []
    }

    if (assignedSubjects.length > 0 && matchesClassSection(baseClass, section)) {
      return classConfiguredSubjects?.length
        ? classConfiguredSubjects.filter((cs) =>
            assignedSubjects.some((as) => normLower(as) === normLower(cs)),
          )
        : assignedSubjects
    }

    return []
  }

  const matchesSubject = (
    rawSubject: unknown,
    rawClassName?: unknown,
    rawSection?: unknown,
  ): boolean => {
    const subj = normLower(rawSubject)
    if (!subj) return false
    if (rawClassName && cleanStr(rawClassName)) {
      const allowed = subjectsForClassSection(cleanStr(rawClassName), cleanStr(rawSection))
      return allowed.some((s) => normLower(s) === subj)
    }
    if (assignedSubjects.length === 0 && homeroomPairs.length > 0) return true
    return assignedSubjects.some((s) => normLower(s) === subj)
  }

  // Build fast set of assigned students (by id and lowercase name)
  const assignedStudentIds = new Set<string>()
  const assignedStudentNames = new Set<string>()
  for (const st of records.studentList ?? []) {
    if (matchesClassSection(st.className, st.section)) {
      if (st.id) assignedStudentIds.add(cleanStr(st.id))
      if (st.name) assignedStudentNames.add(normLower(st.name))
    }
  }

  const matchesStudent = (rawStudentNameOrId: unknown): boolean => {
    const val = cleanStr(rawStudentNameOrId)
    if (!val) return false
    return assignedStudentIds.has(val) || assignedStudentNames.has(val.toLocaleLowerCase())
  }

  const filterCaAssessment = (caRow: EduRow): boolean => {
    const caClasses = getCaClasses(caRow)
    const caSecs = getCaSections(caRow)
    if (caClasses.length === 0) return false
    for (const cls of caClasses) {
      if (caSecs.length === 0) {
        if (assignedBaseClasses.some((bc) => normLower(bc) === normLower(cls))) return true
      } else {
        for (const sec of caSecs) {
          if (matchesClassSection(cls, sec)) return true
        }
      }
    }
    return false
  }

  // Teacher's own online exam titles for filtering online exam attempts
  const teacherOnlineExamTitles = new Set<string>()
  for (const oe of [...(records.onlineExam ?? []), ...(records.onlineExams ?? [])]) {
    if (matchesClassSection(oe.className) && matchesSubject(oe.subject, oe.className)) {
      const title = normLower(oe.title)
      if (title) teacherOnlineExamTitles.add(title)
    }
  }

  const filterLeafRows = (leafId: string, rows: EduRow[]): EduRow[] => {
    switch (leafId) {
      case 'classList':
        return rows.filter((r) => matchesClassSection(r.name, r.section))
      case 'assignClassTeacher':
        return rows.filter(
          (r) => matchesTeacherName(r.teacher) || matchesHomeroomClassSection(r.className, r.section),
        )
      case 'subjectList':
        return rows.filter((r) => matchesSubject(r.name))
      case 'assignClassSubjects':
        return rows.filter((r) =>
          assignedBaseClasses.some((bc) => normLower(bc) === normLower(r.className)),
        )
      case 'assignSubjectTeacher':
        return rows.filter((r) => matchesTeacherName(r.teacher))
      case 'studentAttendance':
        return rows.filter(
          (r) =>
            (cleanStr(r.className) && matchesClassSection(r.className, r.section)) ||
            matchesStudent(r.studentId || r.student),
        )
      case 'attendanceReports':
        return rows.filter((r) => matchesClassSection(r.className, r.section))
      case 'studentList':
      case 'studentRegistration':
        return rows.filter((r) => matchesClassSection(r.className, r.section))
      case 'parents':
        return rows.filter((r) => matchesStudent(r.student))
      case 'prefectsLeadership':
        return rows.filter(
          (r) => matchesClassSection(r.className) || matchesStudent(r.student),
        )
      case 'staffLeave':
        return rows.filter((r) => matchesTeacherName(r.staff))
      case 'lessonPlans':
      case 'lessonNotes':
        return rows.filter(
          (r) =>
            matchesTeacherName(r.teacher) ||
            (matchesClassSection(r.className) && matchesSubject(r.subject, r.className)),
        )
      case 'lessonPlanApprovals':
      case 'lessonNoteApprovals':
        return rows.filter((r) => matchesTeacherName(r.teacher))
      case 'continuousAssessment':
        return rows.filter(filterCaAssessment)
      case 'examSchedule':
        return rows.filter(
          (r) =>
            matchesClassSection(r.className, r.section) &&
            (!cleanStr(r.subject) || matchesSubject(r.subject, r.className, r.section)),
        )
      case 'markEntries':
        return rows.filter(
          (r) =>
            matchesStudent(r.studentId || r.student) &&
            matchesSubject(r.subject, r.className, r.section),
        )
      case 'gradesRange':
      case 'books':
        return rows
      case 'examResult':
      case 'examResults':
        return rows.filter((r) => matchesClassSection(r.className, r.section))
      case 'promotions':
      case 'studentPromotion':
        return rows.filter(
          (r) => matchesClassSection(r.fromClass) || matchesStudent(r.student),
        )
      case 'homework':
      case 'onlineExam':
      case 'onlineExams':
        return rows.filter(
          (r) =>
            matchesClassSection(r.className, r.section) &&
            (!cleanStr(r.subject) || matchesSubject(r.subject, r.className, r.section)),
        )
      case 'evaluationReport':
        return rows.filter(
          (r) => matchesClassSection(r.className, r.section) || matchesStudent(r.student),
        )
      case 'questionBank':
      case 'questionGroup':
        return rows.filter((r) => matchesSubject(r.subject))
      case 'onlineExamResult':
      case 'examAttempts':
        return rows.filter(
          (r) =>
            matchesStudent(r.student) &&
            (!teacherOnlineExamTitles.size || teacherOnlineExamTitles.has(normLower(r.exam))),
        )
      case 'requestBooks':
      case 'bookIssueReturn':
        return rows.filter(
          (r) => matchesTeacherName(r.member) || matchesStudent(r.member),
        )
      default:
        return rows
    }
  }

  return {
    isTeacher: true,
    teacherName,
    teacherDisplayName: teacherName,
    employeeNumber,
    designation,
    homeroomClassLabels,
    assignedClassLabels,
    assignedBaseClasses,
    assignedPairs,
    assignedSubjects,
    sectionsForBaseClass,
    subjectsForClassSection,
    subjectsForClass: (classLabel, classConfiguredSubjects) => {
      const parsed = parseClassSection(classLabel, undefined, records)
      return subjectsForClassSection(parsed?.baseClass ?? classLabel, parsed?.section, classConfiguredSubjects)
    },
    matchesClassSection,
    matchesHomeroomClassSection,
    matchesSubject,
    matchesStudent,
    matchesTeacherName,
    filterCaAssessment,
    filterLeafRows,
  }
}

/**
 * Return a copy of `EduRecords` pre-filtered to a Teacher's assigned classes, subjects, and students
 * so reports and exports only surface data within the Teacher's scope.
 */
export function scopeEduRecordsForTeacher(records: EduRecords, scope: TeacherScope): EduRecords {
  if (!scope.isTeacher) return records
  const combinedMarks = [...(records.markEntries ?? []), ...(records.marksEntry ?? [])]
  const seenMarkIds = new Set<string>()
  const uniqueScopedMarks = combinedMarks.filter((r) => {
    if (seenMarkIds.has(r.id)) return false
    seenMarkIds.add(r.id)
    return (
      scope.matchesStudent(r.studentId || r.student) &&
      scope.matchesSubject(r.subject, r.className, r.section)
    )
  })

  return {
    ...records,
    studentList: scope.filterLeafRows('studentList', records.studentList ?? []),
    studentAttendance: scope.filterLeafRows('studentAttendance', records.studentAttendance ?? []),
    attendanceReports: scope.filterLeafRows('attendanceReports', records.attendanceReports ?? []),
    marksEntry: uniqueScopedMarks,
    markEntries: uniqueScopedMarks,
    reportCards: (records.reportCards ?? []).filter(
      (r) => scope.matchesHomeroomClassSection(r.className) || scope.matchesClassSection(r.className),
    ),
    examResults: scope.filterLeafRows('examResults', records.examResults ?? []),
    onlineExams: scope.filterLeafRows('onlineExams', [
      ...(records.onlineExam ?? []),
      ...(records.onlineExams ?? []),
    ]),
    examAttempts: scope.filterLeafRows('examAttempts', [
      ...(records.onlineExamResult ?? []),
      ...(records.examAttempts ?? []),
    ]),
    lessonPlans: scope.filterLeafRows('lessonPlans', records.lessonPlans ?? []),
    lessonNotes: scope.filterLeafRows('lessonNotes', records.lessonNotes ?? []),
    homework: scope.filterLeafRows('homework', records.homework ?? []),
    bookIssueReturn: scope.filterLeafRows('bookIssueReturn', records.bookIssueReturn ?? []),
  }
}

/**
 * Convenience React hook returning the active user's `TeacherScope` for the active branch.
 */
export function useTeacherAccess(recordsOverride?: EduRecords): TeacherScope {
  const { user } = useAuth()
  const { staff, activeBranchId } = useApp()
  const records = useMemo(
    () => recordsOverride ?? loadEduRecords(activeBranchId),
    [recordsOverride, activeBranchId],
  )
  return useMemo(() => resolveTeacherScope(user, staff, records), [user, staff, records])
}
