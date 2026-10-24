/**
 * Generic record storage for the Education Management submenus.
 *
 * Every branch runs its own school: records are stored PER BRANCH, so switching
 * the active branch shows that branch's students, classes, timetable, fees…
 * Legacy (pre-branch) data is migrated into the branch that is active when the
 * new code first reads it.
 */

export type EduRow = { id: string } & Record<string, string>
export type EduRecords = Record<string, EduRow[]>

/** Parse Route pickup points stored as a JSON list or the legacy comma-separated text. */
export function parseTransportPickupPoints(value: unknown, preserveEmpty = false): string[] {
  const clean = (items: unknown[]) => items
    .map((item) => String(item ?? '').trim())
    .filter((item) => preserveEmpty || Boolean(item))
  if (Array.isArray(value)) return clean(value)
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return clean(parsed)
  } catch { /* Legacy plain-text pickup points */ }
  return clean(raw.split(/[\n,]+/))
}

export const formatTransportPickupPoints = (value: unknown) => parseTransportPickupPoints(value).join(', ')

import { isCollectionMarkedCleared } from './dataReset'

export const EDU_RECORDS_KEY = 'fitpro_edu_records_v1'
const EDU_SEEDED_KEY = 'fitpro_edu_seeded_v1'
const EDU_ASSIGN_CLASS_SUBJECTS_SAMPLE_KEY = 'fitpro_edu_assign_class_subjects_sampled_v1'
const EDU_ASSIGN_CLASS_TEACHER_SAMPLE_KEY = 'fitpro_edu_assign_class_teacher_coverage_v2'
const EDU_ASSIGN_SUBJECT_TEACHER_SAMPLE_KEY = 'fitpro_edu_assign_subject_teacher_reset_sample_v3'
const EDU_TRANSPORT_SAMPLE_KEY = 'fitpro_edu_transport_sample_data_v1'
const EDU_TIMETABLE_BREAK_SAMPLE_KEY = 'fitpro_edu_timetable_break_sample_data_v1'

type Nested = Record<string, EduRecords>

const isLeafMap = (v: unknown): v is EduRecords => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const vals = Object.values(v as Record<string, unknown>)
  return vals.length > 0 && vals.every(Array.isArray)
}

function readAll(): Nested {
  try {
    const raw = localStorage.getItem(EDU_RECORDS_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    // Legacy flat format (leafId -> rows): migrate into the calling branch below.
    if (isLeafMap(v)) return { __legacy__: v }
    return v as Nested
  } catch {
    return {}
  }
}

import { EDU_SEED } from './eduSeed'

function seededBranches(): string[] {
  try {
    const raw = localStorage.getItem(EDU_SEEDED_KEY)
    const v = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function branchesWithClassSubjectSamples(): string[] {
  try {
    const raw = localStorage.getItem(EDU_ASSIGN_CLASS_SUBJECTS_SAMPLE_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((branchId): branchId is string => typeof branchId === 'string') : []
  } catch {
    return []
  }
}

/** Add sample Assign Class Subjects once to existing branches that had no assignments. */
function seedClassSubjectSamplesOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const completed = branchesWithClassSubjectSamples()
  if (completed.includes(branchId)) return records

  const existing = records.assignClassSubjects
  const next = Array.isArray(existing) && existing.length > 0
    ? records
    : { ...records, assignClassSubjects: EDU_SEED.assignClassSubjects.map((row) => ({ ...row })) }

  try {
    all[branchId] = next
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
    localStorage.setItem(EDU_ASSIGN_CLASS_SUBJECTS_SAMPLE_KEY, JSON.stringify([...completed, branchId]))
  } catch {
    /* ignore quota */
  }
  return next
}

function branchesWithClassTeacherSamples(): string[] {
  try {
    const raw = localStorage.getItem(EDU_ASSIGN_CLASS_TEACHER_SAMPLE_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((branchId): branchId is string => typeof branchId === 'string') : []
  } catch {
    return []
  }
}

function missingClassTeacherSamples(records: EduRecords): EduRow[] {
  const classes = records.classList ?? []
  const existing = records.assignClassTeacher ?? []
  const activeYear = (records.academicYear ?? []).find((row) => String(row.status ?? '').trim().toLocaleLowerCase() === 'active')
    ?? records.academicYear?.[0]
  const session = String(activeYear?.name ?? '').trim() || String(existing[0]?.session ?? '').trim() || '2026/2027'
  const teacherNames = [...new Set([
    ...(records.staffList ?? [])
      .filter((row) => /teacher|teaching/i.test(String(row.designation ?? '')))
      .map((row) => String(row.name ?? '').trim()),
    ...existing.map((row) => String(row.teacher ?? '').trim()),
    ...(records.assignSubjectTeacher ?? []).map((row) => String(row.teacher ?? '').trim()),
    ...EDU_SEED.assignClassTeacher.map((row) => String(row.teacher ?? '').trim()),
  ].filter(Boolean))]
  const assignedKeys = new Set(existing.map((row) =>
    `${String(row.className ?? '').trim().toLocaleLowerCase()}|${String(row.session ?? '').trim().toLocaleLowerCase()}`,
  ))
  const seenClasses = new Set<string>()
  const additions: EduRow[] = []

  classes.forEach((row, index) => {
    const className = [row.name, row.section].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ')
    const normalizedClass = className.toLocaleLowerCase()
    if (!className || seenClasses.has(normalizedClass)) return
    seenClasses.add(normalizedClass)
    const assignmentKey = `${normalizedClass}|${session.toLocaleLowerCase()}`
    if (assignedKeys.has(assignmentKey)) return

    const teacher = String(row.classTeacher ?? '').trim() || teacherNames[index % Math.max(teacherNames.length, 1)] || ''
    if (!teacher) return
    additions.push({ id: `seed-act-auto-${index + 1}`, className, teacher, session })
    assignedKeys.add(assignmentKey)
  })
  return additions
}

/** Assign a sample class teacher to every currently unassigned class, once per branch. */
function seedClassTeacherSamplesOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const completed = branchesWithClassTeacherSamples()
  if (completed.includes(branchId)) return records

  const existing = records.assignClassTeacher ?? []
  const additions = missingClassTeacherSamples(records)
  const next = additions.length ? { ...records, assignClassTeacher: [...existing, ...additions] } : records

  try {
    all[branchId] = next
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
    localStorage.setItem(EDU_ASSIGN_CLASS_TEACHER_SAMPLE_KEY, JSON.stringify([...completed, branchId]))
  } catch {
    /* ignore quota */
  }
  return next
}

function branchesWithSubjectTeacherSamples(): string[] {
  try {
    const raw = localStorage.getItem(EDU_ASSIGN_SUBJECT_TEACHER_SAMPLE_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((branchId): branchId is string => typeof branchId === 'string') : []
  } catch {
    return []
  }
}

function buildSubjectTeacherSamples(records: EduRecords): EduRow[] {
  const subjects = records.subjectList ?? []
  const classes = [...new Set((records.classList ?? []).map((row) =>
    [row.name, row.section].map((part) => String(part ?? '').trim()).filter(Boolean).join(' '),
  ).filter(Boolean))]
  const teacherNames = [...new Set([
    ...(records.staffList ?? [])
      .filter((row) => /teacher|teaching/i.test(String(row.designation ?? '')))
      .map((row) => String(row.name ?? '').trim()),
    ...(records.assignClassTeacher ?? []).map((row) => String(row.teacher ?? '').trim()),
    ...subjects.map((row) => String(row.teacher ?? '').trim()),
    ...(records.assignSubjectTeacher ?? []).map((row) => String(row.teacher ?? '').trim()),
    ...EDU_SEED.assignSubjectTeacher.map((row) => String(row.teacher ?? '').trim()),
  ].filter(Boolean))]
  const sampleRows: EduRow[] = []
  const seenSubjects = new Set<string>()
  const seenClasses = new Set<string>()
  const uniqueClasses = classes.filter((className) => {
    const key = className.toLocaleLowerCase()
    if (seenClasses.has(key)) return false
    seenClasses.add(key)
    return true
  })

  subjects.forEach((subjectRow, subjectIndex) => {
    const subject = String(subjectRow.name ?? '').trim()
    const subjectKey = subject.toLocaleLowerCase()
    if (!subject || seenSubjects.has(subjectKey)) return
    seenSubjects.add(subjectKey)

    const seedForSubject = EDU_SEED.assignSubjectTeacher.find((row) =>
      String(row.subject ?? '').trim().toLocaleLowerCase() === subjectKey,
    )
    const teacher = String(subjectRow.teacher ?? '').trim()
      || String(seedForSubject?.teacher ?? '').trim()
      || teacherNames[subjectIndex % Math.max(teacherNames.length, 1)]
      || ''
    if (!teacher) return
    const periodsPerWeek = String(subjectRow.periodsPerWeek ?? '').trim()
      || String(seedForSubject?.periodsPerWeek ?? '').trim()
      || '4'

    uniqueClasses.forEach((className, classIndex) => {
      sampleRows.push({
        id: `seed-ast-sample-${subjectIndex + 1}-${classIndex + 1}`,
        subject,
        teacher,
        className,
        periodsPerWeek,
      })
    })
  })
  return sampleRows
}

/** Replace Assign Subject Teacher once per branch with sample rows for every subject/class pair. */
function seedSubjectTeacherSamplesOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const completed = branchesWithSubjectTeacherSamples()
  if (completed.includes(branchId)) return records

  const next: EduRecords = { ...records, assignSubjectTeacher: buildSubjectTeacherSamples(records) }
  try {
    all[branchId] = next
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
    localStorage.setItem(EDU_ASSIGN_SUBJECT_TEACHER_SAMPLE_KEY, JSON.stringify([...completed, branchId]))
  } catch {
    /* ignore quota */
  }
  return next
}

function branchesWithTransportSamples(): string[] {
  try {
    const raw = localStorage.getItem(EDU_TRANSPORT_SAMPLE_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((branchId): branchId is string => typeof branchId === 'string') : []
  } catch {
    return []
  }
}

/** Seed transport demo rows once per branch, filling only empty collections. */
function seedTransportSamplesOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const completed = branchesWithTransportSamples()
  const alreadyCompleted = completed.includes(branchId)
  // Backfill any newly shipped transport collection into branches that were seeded earlier.
  const pendingSeedCollections = [
    'transportVehicleAssignments',
    'transportPersonnel',
    'transportPersonnelHistory',
    'transportFees',
    'transportFeeAdjustments',
    'transportFeeHistory',
    'transportAttendance',
    'studentRegistration',
    'idCardTemplates',
    'idCards',
    'idCardHistory',
    'idCardSettings',
    'studentBilling',
    'transportVehicleMaintenance',
    'transportGpsSettings',
    'transportGeofences',
    'transportGpsAlerts',
    'transportGpsParentAccess',
    'transportGpsLogs',
    'markDistribution',
    'marksheetTemplate',
    'examSetup',
  ]
  const needsBackfill = pendingSeedCollections.some((key) =>
    !(records[key] ?? []).length && (EDU_SEED[key] ?? []).length > 0)
  if (alreadyCompleted && !needsBackfill) return records

  const next: EduRecords = { ...records }
  let changed = false
  const sampleCollections = [
    ['transportRoutes', EDU_SEED.transportRoutes ?? []],
    ['transportVehicles', EDU_SEED.transportVehicles ?? []],
    ['transportStoppage', EDU_SEED.transportStoppage ?? []],
    ['transportVehicleAssignments', EDU_SEED.transportVehicleAssignments ?? []],
    ['transportPersonnel', EDU_SEED.transportPersonnel ?? []],
    ['transportPersonnelHistory', EDU_SEED.transportPersonnelHistory ?? []],
    ['transportFees', EDU_SEED.transportFees ?? []],
    ['transportFeeAdjustments', EDU_SEED.transportFeeAdjustments ?? []],
    ['transportFeeHistory', EDU_SEED.transportFeeHistory ?? []],
    ['transportAttendance', EDU_SEED.transportAttendance ?? []],
    ['studentRegistration', EDU_SEED.studentRegistration ?? []],
    ['idCardTemplates', EDU_SEED.idCardTemplates ?? []],
    ['idCards', EDU_SEED.idCards ?? []],
    ['idCardHistory', EDU_SEED.idCardHistory ?? []],
    ['idCardSettings', EDU_SEED.idCardSettings ?? []],
    ['transportVehicleMaintenance', EDU_SEED.transportVehicleMaintenance ?? []],
    ['transportGpsSettings', EDU_SEED.transportGpsSettings ?? []],
    ['transportGeofences', EDU_SEED.transportGeofences ?? []],
    ['transportGpsAlerts', EDU_SEED.transportGpsAlerts ?? []],
    ['transportGpsParentAccess', EDU_SEED.transportGpsParentAccess ?? []],
    ['transportGpsLogs', EDU_SEED.transportGpsLogs ?? []],
    ['markDistribution', EDU_SEED.markDistribution ?? []],
    ['marksheetTemplate', EDU_SEED.marksheetTemplate ?? []],
    ['examSetup', EDU_SEED.examSetup ?? []],
  ] as const
  for (const [key, samples] of sampleCollections) {
    if (!(next[key] ?? []).length && samples.length) {
      next[key] = samples.map((row) => ({ ...row }))
      changed = true
    }
  }

  // Demo transport bills only land in branches that already carry seeded
  // transport fees, so real billing data is never mixed with sample rows.
  // Legacy ID card rows (student / issueDate / issued only) predate card
  // numbering — give them a real card number and status so every page works.
  const legacyCards = next.idCards ?? []
  if (legacyCards.some((row) => !String(row.cardNo ?? '').trim())) {
    let sequence = 1
    const year = String(new Date().getFullYear())
    next.idCards = legacyCards.map((row) => (
      String(row.cardNo ?? '').trim()
        ? row
        : {
          ...row,
          cardNo: `IDC-${year}-${String(sequence++).padStart(4, '0')}`,
          status: String(row.status ?? '').trim() || (String(row.issued ?? '').trim() === 'Yes' ? 'Issued' : 'Generated'),
          issueDate: String(row.issueDate ?? '').trim(),
          academicYear: String(row.academicYear ?? '').trim(),
        }
    ))
    changed = true
  }

  const sampleBills = EDU_SEED.studentBilling ?? []
  if (sampleBills.length && !(next.studentBilling ?? []).length && (next.transportFees ?? []).length) {
    next.studentBilling = sampleBills.map((row) => ({ ...row }))
    changed = true
  }

  const sampleStudents = EDU_SEED.studentList ?? []
  const sampleStudentFive = sampleStudents.find((row) => row.id === 'seed-st-5')
  const currentStudents = next.studentList ?? []
  const hasSeedStudent = currentStudents.some((row) => sampleStudents.some((sample) => sample.id === row.id))
  if (!currentStudents.length && sampleStudents.length) {
    next.studentList = sampleStudents.map((row) => ({ ...row }))
    changed = true
  } else if (hasSeedStudent && sampleStudentFive && !currentStudents.some((row) => row.id === sampleStudentFive.id)) {
    next.studentList = [...currentStudents, { ...sampleStudentFive }]
    changed = true
  }

  const sampleAssignments = EDU_SEED.studentTransportAssignments ?? []
  const sampleAssignmentIds = new Set(sampleAssignments.map((row) => row.id))
  const currentAssignments = next.studentTransportAssignments ?? []
  const hasCustomAssignments = currentAssignments.some((row) => !sampleAssignmentIds.has(row.id))
  if (!hasCustomAssignments) {
    const studentIds = new Set((next.studentList ?? []).map((row) => String(row.id ?? '').trim()).filter(Boolean))
    const routeNames = new Set((next.transportRoutes ?? []).map((row) => String(row.routeName ?? '').trim()).filter(Boolean))
    const vehicleNumbers = new Set((next.transportVehicles ?? []).map((row) => String(row.vehicleNo ?? '').trim()).filter(Boolean))
    const retainedSamples = currentAssignments.filter((row) =>
      sampleAssignmentIds.has(row.id) && studentIds.has(String(row.studentId ?? '').trim()),
    )
    const retainedIds = new Set(retainedSamples.map((row) => row.id))
    const missingSamples = sampleAssignments.filter((row) =>
      studentIds.has(String(row.studentId ?? '').trim())
        && routeNames.has(String(row.routeName ?? '').trim())
        && (!String(row.vehicleNo ?? '').trim() || vehicleNumbers.has(String(row.vehicleNo ?? '').trim()))
        && !retainedIds.has(row.id),
    )
    const nextAssignments = [...retainedSamples, ...missingSamples.map((row) => ({ ...row }))]
    if (nextAssignments.length !== currentAssignments.length
      || nextAssignments.some((row, index) => row.id !== currentAssignments[index]?.id)) {
      next.studentTransportAssignments = nextAssignments
      changed = true
    }
  }

  try {
    if (changed) all[branchId] = next
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
    localStorage.setItem(EDU_TRANSPORT_SAMPLE_KEY, JSON.stringify([...completed, branchId]))
  } catch {
    /* ignore quota */
  }
  return changed ? next : records
}

const CERT_TEMPLATES_CLEARED_KEY = 'fitpro_edu_cert_templates_cleared_v1'
const MARKSHEET_TEMPLATES_CLEARED_KEY = 'fitpro_edu_marksheet_templates_cleared_v1'

function branchesWithCertTemplatesCleared(): string[] {
  try {
    const raw = localStorage.getItem(CERT_TEMPLATES_CLEARED_KEY)
    const v = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function branchesWithMarksheetTemplatesCleared(): string[] {
  try {
    const raw = localStorage.getItem(MARKSHEET_TEMPLATES_CLEARED_KEY)
    const v = raw ? (JSON.parse(raw) as string[]) : []
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function clearCertificateTemplatesSampleOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const cleared = branchesWithCertTemplatesCleared()
  if (cleared.includes(branchId)) return records
  // Clear all sample data under Certificate Templates List for this branch
  if (Array.isArray(records.certificateTemplates) && records.certificateTemplates.length) {
    const isSample = (r: any) => {
      const id = String(r.id ?? '')
      const name = String(r.templateName ?? r.name ?? '')
      return id.startsWith('seed-') || /sample/i.test(name) || name.trim() === '' || ['Achievement Certificate','Sample Certificate','Test Template','Certificate Template'].includes(name.trim())
    }
    const hasSample = records.certificateTemplates.some(isSample)
    if (hasSample) {
      const next = { ...records, certificateTemplates: [] }
      try {
        all[branchId] = next
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
        localStorage.setItem(CERT_TEMPLATES_CLEARED_KEY, JSON.stringify([...cleared, branchId]))
      } catch {}
      return next
    }
  }
  try {
    localStorage.setItem(CERT_TEMPLATES_CLEARED_KEY, JSON.stringify([...cleared, branchId]))
  } catch {}
  return records
}

function clearMarksheetTemplatesSampleOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const cleared = branchesWithMarksheetTemplatesCleared()
  if (cleared.includes(branchId)) return records
  if (Array.isArray(records.marksheetTemplate) && records.marksheetTemplate.length) {
    const isSample = (r: any) => {
      const id = String(r.id ?? '')
      const name = String(r.templateName ?? r.name ?? '')
      return id.startsWith('seed-') || /sample/i.test(name) || name.trim() === '' || ['Sample Template','Test Template','Marksheet Template'].includes(name.trim())
    }
    const hasSample = records.marksheetTemplate.some(isSample)
    if (hasSample) {
      const next = { ...records, marksheetTemplate: [] }
      try {
        all[branchId] = next
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
        localStorage.setItem(MARKSHEET_TEMPLATES_CLEARED_KEY, JSON.stringify([...cleared, branchId]))
      } catch {}
      return next
    }
  }
  try {
    localStorage.setItem(MARKSHEET_TEMPLATES_CLEARED_KEY, JSON.stringify([...cleared, branchId]))
  } catch {}
  return records
}

function branchesWithTimetableBreakSamples(): string[] {
  try {
    const raw = localStorage.getItem(EDU_TIMETABLE_BREAK_SAMPLE_KEY)
    const value = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(value) ? value.filter((branchId): branchId is string => typeof branchId === 'string') : []
  } catch {
    return []
  }
}

/** Seed the two example timetable breaks once per branch when no breaks exist yet. */
function seedTimetableBreakSamplesOnce(branchId: string, records: EduRecords, all: Nested): EduRecords {
  const completed = branchesWithTimetableBreakSamples()
  if (completed.includes(branchId)) return records

  const current = records.classBreaks ?? []
  const samples = EDU_SEED.classBreaks ?? []
  const changed = !current.length && samples.length > 0
  const next = changed ? { ...records, classBreaks: samples.map((row) => ({ ...row })) } : records
  try {
    if (changed) all[branchId] = next
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
    localStorage.setItem(EDU_TIMETABLE_BREAK_SAMPLE_KEY, JSON.stringify([...completed, branchId]))
  } catch {
    /* ignore quota */
  }
  return next
}

/**
 * Sample student photos (and any students added to the samples later) are
 * backfilled into branches that were seeded before they shipped. Only rows
 * that match a sample student are touched, so real records are never altered.
 */
function backfillStudentSampleData(records: EduRecords): { records: EduRecords; changed: boolean } {
  const sampleReg = EDU_SEED.studentRegistration ?? []
  const sampleList = EDU_SEED.studentList ?? []
  if (!sampleReg.length && !sampleList.length) return { records, changed: false }

  const key = (value: unknown) => String(value ?? '').trim().toLowerCase()
  const photoByAdmission = new Map<string, string>()
  const photoByName = new Map<string, string>()
  for (const row of sampleReg) {
    const photo = String(row.photo ?? '').trim()
    if (!photo) continue
    const admission = key(row.admissionNo)
    if (admission && !photoByAdmission.has(admission)) photoByAdmission.set(admission, photo)
    const name = key(row.name)
    if (name && !photoByName.has(name)) photoByName.set(name, photo)
  }
  if (!photoByAdmission.size) return { records, changed: false }
  const photoFor = (row: EduRow) =>
    photoByAdmission.get(key(row.admissionNo)) ?? photoByName.get(key(row.student ?? row.name))

  let changed = false
  const next: EduRecords = { ...records }

  /* Installs the sample photo when a row has none. A row already pointing at a
   * superseded sample file (the illustrated .svg avatars the photographs
   * replaced) is moved on to the current one; anything else is left alone. */
  const applyPhoto = (row: EduRow): EduRow => {
    const sample = photoFor(row)
    if (!sample) return row
    const current = String(row.photo ?? '').trim()
    if (current && !current.endsWith('.svg')) return row
    return current === sample ? row : { ...row, photo: sample }
  }

  // 1. Sample photos onto registration rows that predate them.
  const registration = next.studentRegistration
  if (Array.isArray(registration) && registration.length) {
    const patched = registration.map(applyPhoto)
    if (patched.some((row, index) => row !== registration[index])) {
      next.studentRegistration = patched
      changed = true
    }
  }

  // 2. Sample photos onto cards already generated before the photos shipped.
  const cards = next.idCards
  if (Array.isArray(cards) && cards.length) {
    const patched = cards.map(applyPhoto)
    if (patched.some((row, index) => row !== cards[index])) {
      next.idCards = patched
      changed = true
    }
  }

  // 3. Students added to the samples after this branch was seeded.
  const sampleIds = new Set(sampleList.map((row) => key(row.id)))
  const students = next.studentList ?? []
  const hasSamples = students.some((row) => sampleIds.has(key(row.id)))
  if (hasSamples) {
    const known = new Set(students.map((row) => key(row.id)))
    const missing = sampleList.filter((row) => !known.has(key(row.id)))
    if (missing.length) {
      next.studentList = [...students, ...missing.map((row) => ({ ...row }))]
      changed = true
    }
    const regRows = next.studentRegistration ?? []
    if (regRows.length) {
      const knownReg = new Set(regRows.map((row) => key(row.id)))
      const missingReg = sampleReg.filter((row) => !knownReg.has(key(row.id)))
      if (missingReg.length) {
        next.studentRegistration = [...regRows, ...missingReg.map((row) => ({ ...row }))]
        changed = true
      }
    }
  }

  return { records: changed ? next : records, changed }
}

function removeDefaultTimetableRows(records: EduRecords): { records: EduRecords; changed: boolean } {
  const timetable = records.classTimetable
  if (!Array.isArray(timetable)) return { records, changed: false }
  const lessons = timetable.filter((lesson) => !lesson.id.startsWith('seed-tt-'))
  if (lessons.length === timetable.length) return { records, changed: false }
  return { records: { ...records, classTimetable: lessons }, changed: true }
}

/**
 * Marksheet work gained two fields after many branches already held rows:
 * Mark Distribution's Max Marks, and the Marksheet Template's Branch stamp.
 * Rows saved before then still render, but the sheet quietly falls back to an
 * even split of 100 and the Branch column reads blank. Fill the gaps from the
 * seed data on load; anything the user has since typed is left untouched.
 */
function backfillMarksheetFields(
  records: EduRecords,
  branchName?: string,
): { records: EduRecords; changed: boolean } {
  let changed = false
  const next: EduRecords = { ...records }

  // Max Marks, matched on the component name.
  const maxMarksByName = new Map<string, string>()
  for (const row of EDU_SEED.markDistribution ?? []) {
    const name = String(row.name ?? '').trim()
    const max = String(row.maxMarks ?? '').trim()
    if (name && max) maxMarksByName.set(name.toLowerCase(), max)
  }
  const distribution = next.markDistribution
  if (distribution?.length && maxMarksByName.size) {
    const filled = distribution.map((row) => {
      if (String(row.maxMarks ?? '').trim()) return row
      const seed = maxMarksByName.get(String(row.name ?? '').trim().toLowerCase())
      return seed ? { ...row, maxMarks: seed } : row
    })
    if (filled.some((row, i) => row !== distribution[i])) {
      next.markDistribution = filled
      changed = true
    }
  }

  // Branch stamp — only known when the caller can name the active branch.
  if (branchName) {
    const templates = next.marksheetTemplate
    if (templates?.length) {
      const filled = templates.map((row) =>
        String(row.branch ?? '').trim() ? row : { ...row, branch: branchName })
      if (filled.some((row, i) => row !== templates[i])) {
        next.marksheetTemplate = filled
        changed = true
      }
    }
  }

  return { records: next, changed }
}

export function loadEduRecords(branchId: string, branchName?: string): EduRecords {
  const all = readAll()
  if (isCollectionMarkedCleared('educationRecords')) {
    const branchData = all[branchId]
    if (!branchData || typeof branchData !== 'object') return {}
    const cleaned = removeDefaultTimetableRows(branchData)
    if (cleaned.changed) {
      try {
        all[branchId] = cleaned.records
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      } catch {
        /* ignore quota */
      }
    }
    return cleaned.records
  }
  if (all.__legacy__) {
    // First read after upgrade: attach the old global data to this branch.
    const cleaned = removeDefaultTimetableRows(all.__legacy__)
    const next: Nested = { [branchId]: cleaned.records }
    const withClassSubjectSamples = seedClassSubjectSamplesOnce(branchId, cleaned.records, next)
    const withClassTeacherSamples = seedClassTeacherSamplesOnce(branchId, withClassSubjectSamples, next)
    const withSubjectTeacherSamples = seedSubjectTeacherSamplesOnce(branchId, withClassTeacherSamples, next)
    const withTransportSamples = seedTransportSamplesOnce(branchId, withSubjectTeacherSamples, next)
    let migrated = seedTimetableBreakSamplesOnce(branchId, withTransportSamples, next)
    migrated = clearCertificateTemplatesSampleOnce(branchId, migrated, next)
    migrated = clearMarksheetTemplatesSampleOnce(branchId, migrated, next)
    next[branchId] = migrated
    try {
      localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
    return migrated
  }
  let branchData = all[branchId]
  // First visit to this branch: fill every submenu with sample data once.
  if (!seededBranches().includes(branchId)) {
    const existing = removeDefaultTimetableRows(branchData && typeof branchData === 'object' ? branchData : {}).records
    const merged: EduRecords = { ...EDU_SEED }
    for (const [leaf, rows] of Object.entries(existing)) {
      if (Array.isArray(rows) && rows.length) merged[leaf] = rows
    }
    branchData = seedClassSubjectSamplesOnce(branchId, merged, all)
    branchData = seedClassTeacherSamplesOnce(branchId, branchData, all)
    branchData = seedSubjectTeacherSamplesOnce(branchId, branchData, all)
    branchData = seedTransportSamplesOnce(branchId, branchData, all)
    branchData = seedTimetableBreakSamplesOnce(branchId, branchData, all)
    branchData = clearCertificateTemplatesSampleOnce(branchId, branchData, all)
    branchData = clearMarksheetTemplatesSampleOnce(branchId, branchData, all)
    try {
      all[branchId] = branchData
      localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      localStorage.setItem(EDU_SEEDED_KEY, JSON.stringify([...seededBranches(), branchId]))
    } catch {
      /* ignore quota */
    }
    return branchData
  }
  // Backfill new submenu defaults while preserving intentionally emptied lists.
  if (branchData && typeof branchData === 'object') {
    const cleaned = removeDefaultTimetableRows(branchData)
    let changed = cleaned.changed
    const merged = { ...cleaned.records }
    for (const [leaf, rows] of Object.entries(EDU_SEED)) {
      if (!merged[leaf]) { merged[leaf] = rows; changed = true }
    }
    if (changed) {
      branchData = merged
      try {
        all[branchId] = merged
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      } catch {
        /* ignore quota */
      }
    } else {
      branchData = cleaned.records
    }
    const withStudentSamples = backfillStudentSampleData(branchData)
    if (withStudentSamples.changed) {
      branchData = withStudentSamples.records
      try {
        all[branchId] = branchData
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      } catch {
        /* ignore quota */
      }
    }
    const withMarksheetFields = backfillMarksheetFields(branchData, branchName)
    if (withMarksheetFields.changed) {
      branchData = withMarksheetFields.records
      try {
        all[branchId] = branchData
        localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
      } catch {
        /* ignore quota */
      }
    }
    branchData = seedClassSubjectSamplesOnce(branchId, branchData, all)
    branchData = seedClassTeacherSamplesOnce(branchId, branchData, all)
    branchData = seedSubjectTeacherSamplesOnce(branchId, branchData, all)
    branchData = seedTransportSamplesOnce(branchId, branchData, all)
    branchData = seedTimetableBreakSamplesOnce(branchId, branchData, all)
    branchData = clearCertificateTemplatesSampleOnce(branchId, branchData, all)
    branchData = clearMarksheetTemplatesSampleOnce(branchId, branchData, all)
    return branchData
  }
  return {}
}

export function saveEduRecords(branchId: string, records: EduRecords) {
  try {
    const all = readAll()
    delete all.__legacy__
    all[branchId] = records
    localStorage.setItem(EDU_RECORDS_KEY, JSON.stringify(all))
  } catch {
    /* ignore quota */
  }
}
