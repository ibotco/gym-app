/**
 * Graduation Record → existing-data linkage.
 *
 * The Graduation Record modal used to be 25 free-text boxes that duplicated
 * facts already held elsewhere in the app. This module derives each value from
 * the system of record instead:
 *
 *   identity      ← Students → Student Registration / Student List
 *   class         ← Classes & Subjects → Class List
 *   subjects      ← Examinations → Mark Entries  (+ Subject List / Subject register)
 *   institution   ← App → Branches (active branch of the tenant)
 *   signatories   ← Human Resource → Staff  &  Education → Staff List
 *   certificate # ← Certificate module (types, serial prefixes, existing numbers)
 *   dates / year  ← Academic Year & Term/Semester
 *
 * Everything here is pure: pass records in, get plain strings out. No React,
 * no storage access. Missing data yields an empty string, never a guess, so a
 * half-filled record is visibly incomplete rather than silently wrong.
 */

import type { EduRecords, EduRow } from './eduRecords'
import { readCertificateTypes, readCertificateGenerations } from './certificates'

const str = (v: unknown) => String(v ?? '').trim()

/** A student that can be attached to a graduation record. */
export type StudentOption = {
  name: string
  admissionNo: string
  studentId: string
  dateOfBirth: string
  gender: string
  className: string
  section: string
  photo: string
  /** Which register the row came from — shown in the UI as the link source. */
  source: 'Student Registration' | 'Student List'
}

/**
 * Students available for linking, richest source first.
 * Student Registration carries birth date / gender / section; Student List is
 * the lighter fallback and is merged in for anyone not yet registered.
 */
export function studentOptions(records: EduRecords): StudentOption[] {
  const byName = new Map<string, StudentOption>()

  for (const r of records.studentRegistration ?? []) {
    const name = str(r.name)
    if (!name) continue
    byName.set(name.toLowerCase(), {
      name,
      admissionNo: str(r.admissionNo),
      // Only a real student number — never the internal row id.
      studentId: str(r.studentId),
      dateOfBirth: str(r.dateOfBirth),
      gender: str(r.gender),
      className: str(r.className),
      section: str(r.section),
      photo: str(r.photo),
      source: 'Student Registration',
    })
  }

  for (const r of records.studentList ?? []) {
    const name = str(r.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (byName.has(key)) {
      // Fill blanks on the registered row from the list row.
      const existing = byName.get(key)!
      if (!existing.admissionNo) existing.admissionNo = str(r.admissionNo)
      if (!existing.className) existing.className = str(r.className)
      continue
    }
    byName.set(key, {
      name,
      admissionNo: str(r.admissionNo),
      studentId: str(r.studentId),
      dateOfBirth: '',
      gender: '',
      className: str(r.className),
      section: '',
      photo: '',
      source: 'Student List',
    })
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function findStudent(records: EduRecords, name: string): StudentOption | undefined {
  const key = str(name).toLowerCase()
  return studentOptions(records).find((s) => s.name.toLowerCase() === key)
}

/* ------------------------------- grading */

/** Ghanaian grading ladders used by the certificates this app issues. */
export type GradeScale = 'wassce' | 'bece' | 'university'

/** Pick the ladder from whatever the record already says about the award. */
export function scaleFor(programme: string, degree: string, className: string): GradeScale {
  const hay = `${programme} ${degree} ${className}`.toLowerCase()
  if (/bece|jhs|basic\s*[7-9]|middle/.test(hay)) return 'bece'
  if (/wassce|wass|sssce|shs|senior high|abitur/.test(hay)) return 'wassce'
  if (/bsc|ba\b|b\.?ed|b\.?a|msc|ma\b|mba|mph|phd|diploma|degree|hnd|postgrad/.test(hay)) {
    return 'university'
  }
  // Primary / basic schools grade on the BECE ladder; default to WASSCE.
  if (/primary|basic/.test(hay)) return 'bece'
  return 'wassce'
}

/** WASSCE: A1 best … F9 fail. */
function wassceGrade(pct: number): string {
  if (pct >= 75) return 'A1'
  if (pct >= 70) return 'B2'
  if (pct >= 65) return 'B3'
  if (pct >= 60) return 'C4'
  if (pct >= 55) return 'C5'
  if (pct >= 50) return 'C6'
  if (pct >= 45) return 'D7'
  if (pct >= 40) return 'E8'
  return 'F9'
}

/** BECE: 1 best … 9 fail. */
function beceGrade(pct: number): string {
  if (pct >= 80) return '1'
  if (pct >= 70) return '2'
  if (pct >= 60) return '3'
  if (pct >= 55) return '4'
  if (pct >= 50) return '5'
  if (pct >= 45) return '6'
  if (pct >= 40) return '7'
  if (pct >= 35) return '8'
  return '9'
}

/** University: letter grade on a 4.0 scale. */
function universityGrade(pct: number): string {
  if (pct >= 70) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  if (pct >= 35) return 'E'
  return 'F'
}

export function gradeForPercent(pct: number, scale: GradeScale): string {
  if (!Number.isFinite(pct)) return ''
  if (scale === 'bece') return beceGrade(pct)
  if (scale === 'university') return universityGrade(pct)
  return wassceGrade(pct)
}

/** Grade point on the 4.0 scale — used for CGPA on degree certificates. */
export function gradePoint(grade: string): number {
  const g = str(grade).toUpperCase()
  const map: Record<string, number> = {
    A: 4, 'A1': 4, 'A2': 3.6, B: 3, 'B2': 3.2, 'B3': 2.8, C: 2, 'C4': 2.4, 'C5': 2.2, 'C6': 2,
    D: 1, 'D7': 1.4, E: 0.5, 'E8': 1, F: 0, 'F9': 0,
    '1': 4, '2': 3.6, '3': 3.2, '4': 2.8, '5': 2.4, '6': 2, '7': 1.6, '8': 1.2, '9': 0,
  }
  return map[g] ?? NaN
}

/** One row of the certificate transcript. */
export type SubjectGrade = { code: string; name: string; grade: string; credits: string; gpa: string }

/** Subject code lookup: Subject register first, then the school's Subject List. */
function subjectCodeIndex(records: EduRecords): Map<string, string> {
  const idx = new Map<string, string>()
  for (const r of records.subjectList ?? []) {
    const name = str(r.name).toLowerCase()
    const code = str(r.short)
    if (name && code) idx.set(name, code)
  }
  for (const r of records.certificateSubjectGrades ?? []) {
    const name = str(r.subjectName).toLowerCase()
    const code = str(r.subjectCode)
    if (name && code) idx.set(name, code)
  }
  return idx
}

/**
 * Transcript rows for a student, pulled from Mark Entries.
 * When a student has several entries for one subject the best attempt wins —
 * a resit should not lower the record that is being certified.
 */
export function subjectGradesForStudent(
  records: EduRecords,
  studentName: string,
  scale: GradeScale,
): SubjectGrade[] {
  const who = str(studentName).toLowerCase()
  if (!who) return []
  const codes = subjectCodeIndex(records)
  const best = new Map<string, { pct: number; subject: string }>()

  // Mark Entries is the canonical store; `markEntries` is the legacy alias.
  for (const r of [...(records.marksEntry ?? []), ...(records.markEntries ?? [])]) {
    const student = str(r.student ?? r.studentName).toLowerCase()
    if (student !== who) continue
    const subject = str(r.subject ?? r.subjectName)
    if (!subject) continue
    const marks = Number(str(r.marks ?? r.score))
    const max = Number(str(r.maxMarks ?? r.max ?? 100)) || 100
    if (!Number.isFinite(marks)) continue
    const pct = Math.max(0, Math.min(100, (marks / max) * 100))
    const key = subject.toLowerCase()
    const prev = best.get(key)
    if (!prev || pct > prev.pct) best.set(key, { pct, subject })
  }

  return [...best.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject))
    .map(({ pct, subject }) => {
      const grade = gradeForPercent(pct, scale)
      const gp = gradePoint(grade)
      return {
        code: codes.get(subject.toLowerCase()) ?? '',
        name: subject,
        grade,
        // Credits are only meaningful on the university ladder; schools have none.
        credits: scale === 'university' && Number.isFinite(gp) ? '3' : '',
        gpa: scale === 'university' && Number.isFinite(gp) ? gp.toFixed(1) : '',
      }
    })
}

/** Serialise transcript rows the way the record + certificate preview expect. */
export function encodeSubjectGrades(rows: SubjectGrade[]): string {
  return rows.map((r) => `${r.code}:${r.name}:${r.grade}:${r.credits}:${r.gpa}`).join(', ')
}

/** CGPA / total credits across the transcript (university ladder only). */
export function totalsFromGrades(rows: SubjectGrade[]): { cgpa: string; totalCredits: string } {
  const scored = rows
    .map((r) => ({ credits: Number(r.credits), gp: Number(r.gpa) }))
    .filter((r) => Number.isFinite(r.gp) && Number.isFinite(r.credits) && r.credits > 0)
  if (!scored.length) return { cgpa: '', totalCredits: '' }
  const credits = scored.reduce((s, r) => s + r.credits, 0)
  const weighted = scored.reduce((s, r) => s + r.gp * r.credits, 0)
  return {
    cgpa: credits ? (weighted / credits).toFixed(2) : '',
    totalCredits: String(credits),
  }
}

/** Class of degree from a CGPA, using the common Ghanaian 4.0 bands. */
export function classOfDegree(cgpa: string): string {
  const v = Number(cgpa)
  if (!Number.isFinite(v) || v <= 0) return ''
  if (v >= 3.6) return 'First Class'
  if (v >= 3.0) return 'Second Class Upper'
  if (v >= 2.5) return 'Second Class Lower'
  if (v >= 2.0) return 'Third Class'
  return 'Pass'
}

/* ---------------------------- institution & people */

export type Institution = { schoolName: string; address: string; phone: string }

/** The awarding institution is the active branch of the tenant. */
export function institutionFor(
  branch: { name?: string; address?: string; city?: string; phone?: string } | undefined,
  fallbackName = '',
): Institution {
  if (!branch) return { schoolName: fallbackName, address: '', phone: '' }
  const address = [str(branch.address), str(branch.city)].filter(Boolean).join(', ')
  return { schoolName: str(branch.name) || fallbackName, address, phone: str(branch.phone) }
}

export type Signatories = { registrarName: string; vcName: string }

/**
 * Registrar / principal and vice-chancellor by designation.
 * Education's own Staff List is authoritative; the HR employee master is the
 * fallback so a school that keeps staff only in HR still links correctly.
 */
export function signatories(
  records: EduRecords,
  hrStaff: { name?: string; title?: string; staffDesignation?: string }[] = [],
): Signatories {
  const people = [
    ...(records.staffList ?? []).map((r) => ({ name: str(r.name), role: str(r.designation) })),
    ...hrStaff.map((s) => ({ name: str(s.name), role: str(s.staffDesignation ?? s.title) })),
  ].filter((p) => p.name)

  const pick = (re: RegExp) => people.find((p) => re.test(p.role))?.name ?? ''

  return {
    registrarName:
      pick(/registrar/i) ||
      pick(/principal|head\s*-?\s*(master|mistress|teacher)|headteacher/i),
    vcName: pick(/vice\s*-?\s*chancellor|provost|rector|director/i),
  }
}

/** Seal wording, derived from the institution name. */
export function sealNameFor(schoolName: string): string {
  const name = str(schoolName)
  if (!name) return ''
  if (/university/i.test(name)) return `${name} Seal`
  if (/waec|west african/i.test(name)) return 'WAEC Seal'
  return 'Official School Seal'
}

/* ------------------------------- certificate identity */

export type CertificateIdentity = {
  certificateNo: string
  serialNo: string
  qrCode: string
  verificationUrl: string
}

const slugHost = (schoolName: string) => {
  const s = str(schoolName)
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, '')
  return s || 'verify'
}

/**
 * Certificate number from the Certificate module's type register: the type's
 * serial prefix plus the next free sequence, skipping numbers already used by
 * generated certificates or other graduation records.
 */
export function certificateIdentityFor(
  records: EduRecords,
  schoolName: string,
  opts: { certificateTypeName?: string; award?: string } = {},
): CertificateIdentity {
  const types = readCertificateTypes(records)
  const wanted = str(opts.certificateTypeName).toLowerCase()
  const award = str(opts.award).toLowerCase()

  const type =
    types.find((t) => wanted && str(t.name).toLowerCase() === wanted) ||
    types.find((t) => award && str(t.name).toLowerCase().includes(award)) ||
    types.find((t) => /graduation/i.test(str(t.name))) ||
    types[0]

  const prefix = str(type?.serialPrefix).replace(/[-_\s]+$/, '') || 'GRAD'

  const used = new Set(
    [
      ...readCertificateGenerations(records).map((r) => str(r.certificateNo)),
      ...(records.graduationRecords ?? []).map((r) => str(r.certificateNo)),
    ]
      .filter(Boolean)
      .map((n) => n.toLowerCase()),
  )

  let seq = used.size + 1
  let certificateNo = nextNo(prefix, seq)
  while (used.has(certificateNo.toLowerCase())) {
    seq += 1
    certificateNo = nextNo(prefix, seq)
  }

  const year = new Date().getFullYear()
  return {
    certificateNo,
    serialNo: `SER-${year}-${String(seq).padStart(4, '0')}`,
    qrCode: `QR-${certificateNo}`,
    verificationUrl: `https://verify.${slugHost(schoolName)}.edu.gh/cert/${certificateNo}`,
  }
}

function nextNo(prefix: string, seq: number): string {
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

/* ------------------------------- dates & session */

const iso = (d: Date) => d.toISOString().slice(0, 10)
const parse = (v: unknown): Date | null => {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export type GraduationDates = {
  yearOfCompletion: string
  graduationDate: string
  ceremonyDate: string
  issueDate: string
}

/**
 * Session dates from Academic Year: the most recently *completed* year wins, so
 * a graduation record never picks up the year that is still running.
 * Issue date defaults to today.
 */
export function graduationDates(records: EduRecords, today = new Date()): GraduationDates {
  const years = (records.academicYear ?? [])
    .map((r) => ({ name: str(r.name), end: parse(r.endDate), start: parse(r.startDate) }))
    .filter((y) => y.end)

  const completed = years
    .filter((y) => y.end && y.end.getTime() <= today.getTime())
    .sort((a, b) => (b.end!.getTime() - a.end!.getTime()))[0]

  if (!completed?.end) {
    // Nothing completed yet — fall back to the active session's start year.
    const active = years.sort((a, b) => (b.start?.getTime() ?? 0) - (a.start?.getTime() ?? 0))[0]
    return {
      yearOfCompletion: str(records.academicYear?.find((r) => /active/i.test(str(r.status)))?.name).slice(0, 4),
      graduationDate: '',
      ceremonyDate: '',
      issueDate: iso(today),
    }
  }

  const grad = completed.end
  const ceremony = new Date(grad.getTime())
  ceremony.setDate(ceremony.getDate() + 15)

  // "2025/2026" completes in 2026; a bare "2026" stays as-is.
  const session = completed.name
  const yearOfCompletion = /\//.test(session) ? session.split('/')[1] : session.slice(0, 4)

  return {
    yearOfCompletion: str(yearOfCompletion),
    graduationDate: iso(grad),
    ceremonyDate: iso(ceremony),
    issueDate: iso(today),
  }
}

/** Department / faculty hint for the class or programme. */
export function departmentFor(records: EduRecords, className: string): string {
  const cls = str(className).toLowerCase()
  if (!cls) return ''
  const row: EduRow | undefined = (records.classList ?? []).find((c) => str(c.name).toLowerCase() === cls)
  if (!row) return ''
  // Class records carry level + room; the level often names the department.
  return str(row.level)
}

/**
 * Programme / Course for a class, resolved through the Academic registers:
 *
 *   Class List (name, level)
 *     → Level          (name → programme)
 *       → Programme    (the programme's own name)
 *
 * A class may also carry `programme` / `course` / `stream` directly, which wins
 * because it is the most specific statement. A class label that *is* a
 * programme name (e.g. "BSc Computer Science") resolves straight through.
 * Section suffixes are stripped, so "Basic 7 A" finds the "Basic 7" class row.
 */
export function programmeFor(records: EduRecords, className: string): string {
  const raw = str(className)
  if (!raw) return ''
  const norm = (v: unknown) => str(v).toLowerCase()
  const key = norm(raw)

  const classes = records.classList ?? []
  const levels = records.level ?? []
  const programmes = records.programme ?? []

  // Class row: exact, then ignoring a trailing section token ("Basic 7 A").
  const classRow =
    classes.find((c) => norm(c.name) === key) ??
    classes.find((c) => {
      const name = norm(c.name)
      return name && key.startsWith(`${name} `)
    })

  // 1. Programme stated on the class itself.
  const direct = str(classRow?.programme ?? classRow?.course ?? classRow?.stream)
  if (direct) return direct

  // 2. Class → level → programme.
  const levelName = str(classRow?.level)
  if (levelName) {
    const levelRow = levels.find((l) => norm(l.name) === norm(levelName))
    const programmeName = str(levelRow?.programme)
    if (programmeName) {
      // Prefer the programme register's canonical spelling when it exists.
      const canonical = programmes.find((pr) => norm(pr.name) === norm(programmeName))
      return str(canonical?.name) || programmeName
    }
  }

  // 3. The class label is itself a programme ("BSc Computer Science").
  const asProgramme = programmes.find((pr) => norm(pr.name) === key)
  if (asProgramme) return str(asProgramme.name)

  // 4. Nothing in the registers describes this class — leave it blank rather
  //    than echoing the class label into Programme/Course.
  return ''
}

/* ---------------------- Certificate Data → Cert Settings */

/**
 * A reusable certificate preset ("Cert Settings" in the Certificate Data menu).
 * Holds the award wording, dates and signatories so they are entered once per
 * award and applied to each student's Graduation Record.
 */
export type CertSetting = EduRow

/** Active presets, newest first, ready for a picker. */
export function certSettingOptions(records: EduRecords): CertSetting[] {
  return (records.certSettings ?? [])
    .filter((r) => !/inactive/i.test(str(r.status)))
    .sort((a, b) => str(a.settingName).localeCompare(str(b.settingName)))
}

/**
 * The fields a preset contributes to a Graduation Record. Anything the preset
 * leaves blank is omitted so the record keeps its own value.
 */
export function certSettingPatch(
  setting: CertSetting,
  opts: { existingCertificateNos?: string[] } = {},
): Record<string, string> {
  const patch: Record<string, string> = {}
  const map: [string, string][] = [
    ['degree', 'degree'],
    ['yearOfCompletion', 'yearOfCompletion'],
    ['graduationDate', 'graduationDate'],
    ['ceremonyDate', 'ceremonyDate'],
    ['sealName', 'sealName'],
    ['registrarName', 'registrarName'],
    ['vcName', 'vcName'],
    ['verificationUrl', 'verificationUrl'],
    ['qrCode', 'qrCode'],
    ['certificateNo', 'certificateNo'],
  ]
  for (const [from, to] of map) {
    const val = str(setting[from])
    if (val) patch[to] = val
  }

  // A preset can hold one number, but no two students may share a certificate.
  // If the preset's number is already taken, drop it and let the caller mint one.
  const certNo = patch.certificateNo
  if (certNo) {
    const taken = new Set((opts.existingCertificateNos ?? []).map((n) => n.toLowerCase()))
    if (taken.has(certNo.toLowerCase())) delete patch.certificateNo
  }

  // A verification URL ending in "/" is a base — append the certificate number.
  if (patch.verificationUrl && patch.verificationUrl.endsWith('/') && patch.certificateNo) {
    patch.verificationUrl = `${patch.verificationUrl}${patch.certificateNo}`
  }
  return patch
}

/**
 * Award wording for a programme when the register has none: exam-based awards
 * name their certificate, otherwise the class label is the best descriptor.
 */
export function degreeFor(programme: string, className: string): string {
  const p = str(programme)
  if (p && /exam|certificate/i.test(p)) return `${p} Certificate`
  if (p) return '' // a real programme already names the award
  return /bece|wassce/i.test(str(className)) ? '' : ''
}
