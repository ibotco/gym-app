// @ts-nocheck
import { useMemo, useState } from 'react'
import { X, Plus, Trash2, Award, Printer, Link2, Users, GraduationCap, BadgeCheck, Hash } from 'lucide-react'
import { Button, Field, Input, Select, DatePicker } from '../../../components/ui'
import type { EduRecords, EduRow } from '../../../lib/eduRecords'
import {
  certSettingOptions,
  certSettingPatch,
  certificateIdentityFor,
  classOfDegree,
  departmentFor,
  encodeSubjectGrades,
  findStudent,
  graduationDates,
  institutionFor,
  programmeFor,
  scaleFor,
  sealNameFor,
  signatories,
  studentOptions,
  subjectGradesForStudent,
  totalsFromGrades,
} from '../../../lib/graduationLink'

interface Props {
  edit: EduRow
  onChange: (key: string, value: string) => void
  onClose: () => void
  onSubmit: () => void
  branchName: string
  availableSubjects: string[]
  /** Education Management records — the system of record for every linked field. */
  records?: EduRecords
  /** Active branch: the awarding institution. */
  branch?: { name?: string; address?: string; city?: string; phone?: string }
  /** HR employee master, used when Education's Staff List has no signatory. */
  hrStaff?: { name?: string; title?: string; staffDesignation?: string }[]
}

export function GraduationRecordsModal({
  edit, onChange, onClose, onSubmit, branchName, availableSubjects, records, branch, hrStaff,
}: Props) {
  const v = (key: string) => String(edit[key] ?? '')
  const s = (key: string, val: string) => onChange(key, val)
  /** Apply a whole derived record in one go (each key goes through onChange). */
  const apply = (patch: Record<string, string>) => {
    for (const [key, val] of Object.entries(patch)) {
      // A derived blank means "the register has nothing for this" — leave
      // whatever is already on the record alone.
      if (val === undefined || val === null || String(val).trim() === '') continue
      onChange(key, String(val))
    }
  }

  const [studentPick, setStudentPick] = useState(v('student'))
  const [certSettingPick, setCertSettingPick] = useState('')
  const [linked, setLinked] = useState<string[]>([])

  const students = useMemo(() => (records ? studentOptions(records) : []), [records])
  const certSettings = useMemo(() => (records ? certSettingOptions(records) : []), [records])
  /** Classes come from the Class register, plus any class already on this record. */
  const classOptions = useMemo(() => {
    const fromRegister = (records?.classList ?? []).map((c) => String(c.name ?? '').trim()).filter(Boolean)
    const fromStudents = students.map((st) => st.className).filter(Boolean)
    return [...new Set([...fromRegister, ...fromStudents, v('className')].filter(Boolean))]
  }, [records, students, edit.className])
  /** Departments / faculties known to the app, for the department datalist. */
  const departmentOptions = useMemo(() => {
    const levels = (records?.classList ?? []).map((c) => String(c.level ?? '').trim())
    const staffDepts = [
      ...(records?.staffList ?? []).map((r) => String(r.department ?? '').trim()),
      ...(hrStaff ?? []).map((r) => String(r.directorateUnit ?? '').trim()),
    ]
    return [...new Set([...levels, ...staffDepts].filter(Boolean))]
  }, [records, hrStaff])
  /** Everyone who can sign, for the signatory datalists. */
  const staffNames = useMemo(() => {
    const edu = (records?.staffList ?? []).map((r) => String(r.name ?? '').trim())
    const hr = (hrStaff ?? []).map((r) => String(r.name ?? '').trim())
    return [...new Set([...edu, ...hr].filter(Boolean))]
  }, [records, hrStaff])
  const institution = useMemo(
    () => institutionFor(branch, branchName),
    [branch, branchName],
  )
  const award = `${v('programme')} ${v('degree')} ${v('className')}`
  const scale = scaleFor(v('programme'), v('degree'), v('className'))

  const note = (label: string) => setLinked((prev) => (prev.includes(label) ? prev : [...prev, label]))

  /* ---- Link 1: student identity from the Students register ---- */
  const linkStudent = (name: string) => {
    setStudentPick(name)
    const student = records ? findStudent(records, name) : undefined
    if (!student) {
      s('student', name)
      return
    }
    const programme = records ? programmeFor(records, student.className) : student.className
    apply({
      student: student.name,
      photo: student.photo || v('photo'),
      admissionNo: student.admissionNo,
      studentId: student.studentId,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      className: student.className,
      // Only fill award fields that are still blank, so a deliberate edit wins.
      programme: v('programme') || programme,
      // Degrees are only inferred for degree-awarding classes; school
      // certificates keep their own award field blank rather than echoing.
      degree: v('degree'),
      department: v('department') || (records ? departmentFor(records, student.className) : ''),
      schoolName: v('schoolName') || institution.schoolName,
      status: v('status') || 'Eligible',
    })
    note(`Student → ${student.source}`)
  }

  /* ---- Cert Settings preset from Certificate Data ---- */
  const applyCertSetting = (settingId: string) => {
    setCertSettingPick(settingId)
    if (!records || !settingId) return
    const setting = certSettings.find((cs) => String(cs.id) === settingId)
    if (!setting) return

    // Never let two students share a certificate number.
    const usedByOthers = (records.graduationRecords ?? [])
      .filter((r) => String(r.id) !== String(edit.id))
      .map((r) => String(r.certificateNo ?? ''))
      .filter(Boolean)
    const patch = certSettingPatch(setting, { existingCertificateNos: usedByOthers })

    // The preset is an explicit choice, so it overwrites the fields it carries.
    for (const [key, val] of Object.entries(patch)) onChange(key, val)

    // `onChange` is async from this component's point of view, so reason about
    // the post-apply state locally instead of re-reading `edit`.
    const merged: Record<string, string> = { ...(edit as Record<string, string>), ...patch }

    if (!merged.certificateNo) {
      const id = certificateIdentityFor(records, merged.schoolName || institution.schoolName, {
        award: `${merged.degree ?? ''} ${merged.programme ?? ''} ${merged.className ?? ''}`.trim(),
      })
      merged.certificateNo = id.certificateNo
      onChange('certificateNo', id.certificateNo)
      if (!merged.serialNo) { merged.serialNo = id.serialNo; onChange('serialNo', id.serialNo) }
      if (!merged.qrCode) { merged.qrCode = id.qrCode; onChange('qrCode', id.qrCode) }
      if (!merged.verificationUrl) { merged.verificationUrl = id.verificationUrl; onChange('verificationUrl', id.verificationUrl) }
    }

    // A preset may hold a verification *base* (e.g. …/cert/) — complete it with
    // this student's certificate number rather than leaving a dangling URL.
    if (merged.verificationUrl && merged.verificationUrl.endsWith('/')) {
      const full = `${merged.verificationUrl}${merged.certificateNo}`
      onChange('verificationUrl', full)
    }
    if (!merged.qrCode && merged.certificateNo) {
      onChange('qrCode', `QR-${merged.certificateNo}`)
    }

    note(`Cert Settings → ${String(setting.settingName ?? 'preset')}`)
  }

  /* ---- Link 2: transcript from Mark Entries ---- */
  const linkGrades = () => {
    if (!records) return
    const rows = subjectGradesForStudent(records, v('student') || studentPick, scale)
    if (!rows.length) {
      note('No marks found for this student')
      return
    }
    const totals = totalsFromGrades(rows)
    apply({
      subjectGrades: encodeSubjectGrades(rows),
      ...(totals.cgpa ? { cgpa: totals.cgpa } : {}),
      ...(totals.totalCredits ? { totalCredits: totals.totalCredits } : {}),
      ...(totals.cgpa ? { grade: v('grade') || classOfDegree(totals.cgpa) } : {}),
    })
    note(`Subjects → Mark Entries (${rows.length})`)
  }

  /* ---- Link 3: institution + signatories ---- */
  const linkInstitution = () => {
    const sig = records ? signatories(records, hrStaff) : { registrarName: '', vcName: '' }
    const schoolName = v('schoolName') || institution.schoolName
    apply({
      schoolName,
      sealName: v('sealName') || sealNameFor(schoolName),
      ...(sig.registrarName ? { registrarName: sig.registrarName } : {}),
      ...(sig.vcName ? { vcName: sig.vcName } : {}),
    })
    note('Institution → Branches · Signatories → Staff')
  }

  /* ---- Link 4: certificate identity + session dates ---- */
  const linkCertificate = () => {
    if (!records) return
    const schoolName = v('schoolName') || institution.schoolName
    const id = certificateIdentityFor(records, schoolName, { award: award.trim() })
    const dates = graduationDates(records)
    apply({
      certificateNo: v('certificateNo') || id.certificateNo,
      serialNo: v('serialNo') || id.serialNo,
      qrCode: v('qrCode') || id.qrCode,
      verificationUrl: v('verificationUrl') || id.verificationUrl,
      yearOfCompletion: v('yearOfCompletion') || dates.yearOfCompletion,
      graduationDate: v('graduationDate') || dates.graduationDate,
      ceremonyDate: v('ceremonyDate') || dates.ceremonyDate,
      issueDate: v('issueDate') || dates.issueDate,
    })
    note('Certificate → Certificate module · Dates → Academic Year')
  }

  const linkAll = () => {
    if (!studentPick && students[0]) linkStudent(students[0].name)
    linkInstitution()
    linkGrades()
    linkCertificate()
  }

  // Parse subject grades into structured rows
  const parseSubjectGrades = (): { code: string; name: string; grade: string; credits: string; gpa: string }[] => {
    const raw = v('subjectGrades')
    if (!raw.trim()) return []
    return raw.split(',').map(p => p.trim()).filter(Boolean).map(pair => {
      const parts = pair.split(':').map(x => x.trim())
      return {
        code: parts[0] || '',
        name: parts[1] || '',
        grade: parts[2] || '',
        credits: parts[3] || '',
        gpa: parts[4] || '',
      }
    }).filter(e => e.name)
  }

  const updateSubjectGrade = (idx: number, field: string, value: string) => {
    const entries = parseSubjectGrades()
    entries[idx] = { ...entries[idx], [field]: value }
    const newRaw = entries.map(e => `${e.code}:${e.name}:${e.grade}:${e.credits}:${e.gpa}`).join(', ')
    s('subjectGrades', newRaw)
  }

  const addSubjectGrade = () => {
    const entries = parseSubjectGrades()
    entries.push({ code: '', name: '', grade: '', credits: '', gpa: '' })
    const newRaw = entries.map(e => `${e.code}:${e.name}:${e.grade}:${e.credits}:${e.gpa}`).join(', ')
    s('subjectGrades', newRaw)
  }

  const removeSubjectGrade = (idx: number) => {
    const entries = parseSubjectGrades()
    entries.splice(idx, 1)
    const newRaw = entries.map(e => `${e.code}:${e.name}:${e.grade}:${e.credits}:${e.gpa}`).join(', ')
    s('subjectGrades', newRaw)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-base font-bold">Graduation Record</h2>
            {v('status') && (
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                {v('status')}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10">
            <X className="size-4" />
          </button>
        </div>

        {/* Body: Two columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Form fields */}
          <div className="w-full max-w-2xl overflow-y-auto border-r border-line p-5">
            {/* Link from records — every value below is derived from data the app
                already holds, so nothing is typed twice. */}
            <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Link2 className="size-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    Link from existing records
                  </h3>
                </div>
                <Button size="sm" variant="outline" onClick={linkAll}>
                  <Link2 className="size-3.5" /> Autofill all
                </Button>
              </div>

              <Field label="Student">
                <Select
                  value={studentPick}
                  onChange={(e) => linkStudent(e.target.value)}
                >
                  <option value="">Select a registered student…</option>
                  {students.map((st) => (
                    <option key={`${st.source}-${st.name}`} value={st.name}>
                      {st.name}
                      {st.admissionNo ? ` — ${st.admissionNo}` : ''}
                      {st.className ? ` · ${st.className}` : ''}
                    </option>
                  ))}
                  {!students.length && <option value="" disabled>No students in the register yet</option>}
                </Select>
              </Field>

              <div className="mt-3">
                <Field label="Cert Settings">
                  <Select
                    value={certSettingPick}
                    onChange={(e) => applyCertSetting(e.target.value)}
                  >
                    <option value="">Select a saved certificate setting…</option>
                    {certSettings.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {String(cs.settingName ?? '')}
                        {cs.degree ? ` — ${cs.degree}` : ''}
                      </option>
                    ))}
                    {!certSettings.length && <option value="" disabled>No settings yet — add them under Certificate Data → Cert Settings</option>}
                  </Select>
                </Field>
                <p className="mt-1 text-[10px] leading-snug text-mist">
                  Applies degree, dates, seal, registrar, VC and verification details to this student.
                </p>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button size="sm" variant="ghost" onClick={() => linkStudent(studentPick || v('student'))}>
                  <Users className="size-3.5" /> Student
                </Button>
                <Button size="sm" variant="ghost" onClick={linkGrades}>
                  <GraduationCap className="size-3.5" /> Grades
                </Button>
                <Button size="sm" variant="ghost" onClick={linkInstitution}>
                  <BadgeCheck className="size-3.5" /> Institution
                </Button>
                <Button size="sm" variant="ghost" onClick={linkCertificate}>
                  <Hash className="size-3.5" /> Certificate
                </Button>
              </div>

              {linked.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {linked.map((l) => (
                    <span key={l} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                      {l}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-2 text-[10px] leading-snug text-mist">
                Linked values stay editable — anything you change by hand is kept on re-link.
              </p>
            </div>

            {/* Student Information */}
            <div className="rounded-xl border border-line p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-mist">Student Information</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full Name" required>
                  <Input value={v('student')} onChange={(e) => { s('student', e.target.value); setStudentPick(e.target.value) }} placeholder="e.g. Ama Owusu" />
                </Field>
                <Field label="Index Number">
                  <Input value={v('admissionNo')} onChange={(e) => s('admissionNo', e.target.value)} placeholder="e.g. WASSCE-2026-004" />
                </Field>
                <Field label="Student ID">
                  <Input value={v('studentId')} onChange={(e) => s('studentId', e.target.value)} placeholder="e.g. STU-2026004" />
                </Field>
                <Field label="Date of Birth">
                  <DatePicker value={v('dateOfBirth')} onChange={(val) => s('dateOfBirth', val)} />
                </Field>
                <Field label="Gender">
                  <Select value={v('gender')} onChange={(e) => s('gender', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="Class / Programme">
                  <Select value={v('className')} onChange={(e) => {
                    const cls = e.target.value
                    s('className', cls)
                    // Class drives programme + department, so keep them in step.
                    if (records) {
                      apply({
                        programme: v('programme') || programmeFor(records, cls),
                        department: v('department') || departmentFor(records, cls),
                      })
                    }
                  }}>
                    <option value="">Select class…</option>
                    {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
              </div>
            </div>

            {/* Academic Details */}
            <div className="rounded-xl border border-line p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-mist">Academic Details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Programme / Course">
                  <Input value={v('programme')} onChange={(e) => s('programme', e.target.value)} placeholder="e.g. WASSCE" />
                </Field>
                <Field label="Degree Awarded">
                  <Input value={v('degree')} onChange={(e) => s('degree', e.target.value)} placeholder="e.g. WASSCE Certificate" />
                </Field>
                <Field label="Class of Degree / Grade">
                  <Select value={v('grade')} onChange={(e) => s('grade', e.target.value)}>
                    <option value="">Select…</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="B3">B3</option>
                    <option value="B2">B2</option>
                    <option value="C4">C4</option>
                    <option value="C5">C5</option>
                    <option value="C6">C6</option>
                    <option value="D7">D7</option>
                    <option value="E8">E8</option>
                    <option value="F9">F9</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                    <option value="First Class">First Class</option>
                    <option value="Second Class Upper">Second Class Upper</option>
                    <option value="Second Class Lower">Second Class Lower</option>
                    <option value="Third Class">Third Class</option>
                    <option value="Distinction">Distinction</option>
                    <option value="Credit">Credit</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </Select>
                </Field>
                <Field label="Department / Faculty">
                  <Input value={v('department')} onChange={(e) => s('department', e.target.value)} placeholder="Optional" list="grad-departments" />
                  <datalist id="grad-departments">
                    {departmentOptions.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </Field>
                <Field label="School / University">
                  <Input value={v('schoolName')} onChange={(e) => s('schoolName', e.target.value)} placeholder={institution.schoolName || 'e.g. Achimota Senior High School'} />
                </Field>
                <Field label="Year of Completion">
                  <Input value={v('yearOfCompletion')} onChange={(e) => s('yearOfCompletion', e.target.value)} placeholder="e.g. 2026" />
                </Field>
              </div>
            </div>

            {/* Subjects & Grades — WAEC Style */}
            <div className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wide text-mist">Subjects & Grades</h3>
                <Button size="sm" variant="outline" onClick={addSubjectGrade}>
                  <Plus className="size-3.5" /> Add Subject
                </Button>
              </div>

              {parseSubjectGrades().length === 0 ? (
                <div className="rounded-lg border border-dashed border-line py-6 text-center text-sm text-mist">
                  No subjects added. Click "Add Subject" or pick from common WAEC subjects below.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Table header */}
                  <div className="grid grid-cols-12 gap-1 px-1 pb-1 text-[10px] font-bold uppercase text-mist">
                    <div className="col-span-1 text-center">#</div>
                    <div className="col-span-6">Subject</div>
                    <div className="col-span-2 text-center">Grade</div>
                    <div className="col-span-2 text-center">Credit</div>
                    <div className="col-span-1"></div>
                  </div>

                  {parseSubjectGrades().map((entry, idx) => (
                    <div key={idx} className="grid grid-cols-12 items-center gap-1 rounded-lg border border-line bg-white p-1.5 dark:bg-zinc-800/50">
                      <div className="col-span-1 text-center text-xs font-bold text-mist">{idx + 1}</div>
                      <div className="col-span-6">
                        <Input
                          className="text-xs"
                          value={entry.name}
                          onChange={(e) => updateSubjectGrade(idx, 'name', e.target.value)}
                          placeholder="Subject name"
                          list="grad-subjects"
                        />
                      </div>
                      <div className="col-span-2">
                        <Select
                          className="text-xs text-center"
                          value={entry.grade}
                          onChange={(e) => updateSubjectGrade(idx, 'grade', e.target.value)}
                        >
                          <option value="">—</option>
                          <option value="A1">A1</option>
                          <option value="A2">A2</option>
                          <option value="B3">B3</option>
                          <option value="B2">B2</option>
                          <option value="C4">C4</option>
                          <option value="C5">C5</option>
                          <option value="C6">C6</option>
                          <option value="D7">D7</option>
                          <option value="E8">E8</option>
                          <option value="F9">F9</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="E">E</option>
                          <option value="F">F</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                          <option value="6">6</option>
                          <option value="7">7</option>
                          <option value="8">8</option>
                          <option value="9">9</option>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Input
                          className="text-xs text-center"
                          value={entry.credits}
                          onChange={(e) => updateSubjectGrade(idx, 'credits', e.target.value)}
                          placeholder="—"
                        />
                      </div>
                      <div className="col-span-1 flex items-center justify-center">
                        <button
                          onClick={() => removeSubjectGrade(idx)}
                          className="text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* WAEC subject presets */}
              <datalist id="grad-subjects">
                {availableSubjects.map((subj) => <option key={subj} value={subj} />)}
              </datalist>

              {/* Quick add subject */}
              {parseSubjectGrades().length < 25 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-mist">Quick add:</span>
                  <div className="flex flex-wrap gap-1">
                    {availableSubjects.slice(0, 15).map((subj) => {
                      const exists = parseSubjectGrades().some(e => e.name === subj)
                      return !exists ? (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => {
                            const entries = parseSubjectGrades()
                            entries.push({ code: '', name: subj, grade: '', credits: '', gpa: '' })
                            const newRaw = entries.map(e => `${e.code}:${e.name}:${e.grade}:${e.credits}:${e.gpa}`).join(', ')
                            s('subjectGrades', newRaw)
                          }}
                          className="rounded-full border border-line px-2 py-0.5 text-[10px] text-mist hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-300"
                        >
                          + {subj.split(' ')[0]}
                        </button>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Certificate Details */}
            <div className="rounded-xl border border-line p-4">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-mist">Certificate Details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Certificate Number">
                  <Input value={v('certificateNo')} onChange={(e) => s('certificateNo', e.target.value)} placeholder="e.g. WASS-2026-0004" />
                </Field>
                <Field label="Serial Number">
                  <Input value={v('serialNo')} onChange={(e) => s('serialNo', e.target.value)} placeholder="e.g. SER-2026-0004" />
                </Field>
                <Field label="QR Verification Code">
                  <Input value={v('qrCode')} onChange={(e) => s('qrCode', e.target.value)} placeholder="e.g. QR-WASS-2026-0004" />
                </Field>
                <Field label="Verification URL">
                  <Input value={v('verificationUrl')} onChange={(e) => s('verificationUrl', e.target.value)} placeholder="https://verify..." />
                </Field>
                <Field label="Graduation Date">
                  <DatePicker value={v('graduationDate')} onChange={(val) => s('graduationDate', val)} />
                </Field>
                <Field label="Ceremony Date">
                  <DatePicker value={v('ceremonyDate')} onChange={(val) => s('ceremonyDate', val)} />
                </Field>
                <Field label="Issue Date">
                  <DatePicker value={v('issueDate')} onChange={(val) => s('issueDate', val)} />
                </Field>
                <Field label="Status">
                  <Select value={v('status')} onChange={(e) => s('status', e.target.value)}>
                    <option value="Eligible">Eligible</option>
                    <option value="Graduated">Graduated</option>
                    <option value="Pending">Pending</option>
                  </Select>
                </Field>
                <Field label="Vice Chancellor / Principal">
                  <Input value={v('vcName')} onChange={(e) => s('vcName', e.target.value)} placeholder="e.g. Mr. Samuel Okyere" list="grad-staff" />
                </Field>
                <Field label="Registrar Name">
                  <Input value={v('registrarName')} onChange={(e) => s('registrarName', e.target.value)} placeholder="e.g. Dr. Beatrice Dede" list="grad-staff" />
                </Field>
                <datalist id="grad-staff">
                  {staffNames.map((n) => <option key={n} value={n} />)}
                </datalist>
                <Field label="Seal Name">
                  <Input value={v('sealName')} onChange={(e) => s('sealName', e.target.value)} placeholder="e.g. WAEC Seal" />
                </Field>
              </div>
            </div>
          </div>

          {/* Right: Certificate Preview */}
          <div className="hidden w-full flex-1 overflow-y-auto bg-zinc-100 p-6 dark:bg-zinc-950 lg:block">
            <div className="mx-auto max-w-md">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-mist">Live Certificate Preview</span>
                <Button size="sm" variant="ghost" onClick={() => window.print()}>
                  <Printer className="size-3.5" /> Print
                </Button>
              </div>
              <CertificatePreview
                student={v('student')}
                admissionNo={v('admissionNo')}
                studentId={v('studentId')}
                dateOfBirth={v('dateOfBirth')}
                gender={v('gender')}
                className={v('className')}
                programme={v('programme')}
                degree={v('degree')}
                grade={v('grade')}
                department={v('department')}
                schoolName={v('schoolName')}
                yearOfCompletion={v('yearOfCompletion')}
                graduationDate={v('graduationDate')}
                certificateNo={v('certificateNo')}
                serialNo={v('serialNo')}
                verificationUrl={v('verificationUrl')}
                issueDate={v('issueDate')}
                registrarName={v('registrarName')}
                vcName={v('vcName')}
                cgpa={v('cgpa')}
                totalCredits={v('totalCredits')}
                subjectGrades={v('subjectGrades')}
                sealName={v('sealName')}
                branchName={branchName}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSubmit}>Save Record</Button>
        </div>
      </div>
    </div>
  )
}

/* ---- Certificate Preview ---- */
function CertificatePreview({ student, admissionNo, studentId, dateOfBirth, gender, className, programme, degree, grade, department, schoolName, yearOfCompletion, graduationDate, certificateNo, serialNo, verificationUrl, issueDate, registrarName, vcName, cgpa, totalCredits, subjectGrades, sealName, branchName }: {
  student: string; admissionNo: string; studentId: string; dateOfBirth: string; gender: string; className: string; programme: string; degree: string; grade: string; department: string; schoolName: string; yearOfCompletion: string; graduationDate: string; certificateNo: string; serialNo: string; verificationUrl: string; issueDate: string; registrarName: string; vcName: string; cgpa: string; totalCredits: string; subjectGrades: string; sealName: string; branchName: string
}) {
  // Parse subject grades for the transcript table
  const entries = subjectGrades ? subjectGrades.split(',').map(p => p.trim()).filter(Boolean).map(pair => {
    const parts = pair.split(':').map(x => x.trim())
    return { code: parts[0] || '', name: parts[1] || '', grade: parts[2] || '', credits: parts[3] || '', gpa: parts[4] || '' }
  }).filter(e => e.name) : []
  const isFullTranscript = entries.some(e => e.code && e.credits)

  return (
    <div className="relative" style={{
      width: '210mm', minHeight: '297mm', padding: '20mm 15mm',
      backgroundColor: '#FFFDF0', border: '3px solid #b7791f', borderRadius: '4px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      fontFamily: '"Playfair Display", "Poppins", serif',
      color: '#1a1a2e',
    }}>
      {/* Inner decorative border */}
      <div style={{
        position: 'absolute', top: '8mm', left: '8mm', right: '8mm', bottom: '8mm',
        border: '1px solid #b7791f', borderRadius: '2px', pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* School Name */}
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '16pt', fontWeight: 700, color: '#1a1a2e', letterSpacing: '1px' }}>
            {schoolName || branchName || 'WEST AFRICAN SENIOR SCHOOL CERTIFICATE EXAMINATION'}
          </div>
          {department && (
            <div style={{ fontSize: '9pt', color: '#8B6914', fontWeight: 600, marginTop: '2mm' }}>
              {department}
            </div>
          )}
        </div>

        {/* Decorative line */}
        <div style={{ height: '2px', backgroundColor: '#b7791f', margin: '3mm 0', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '8mm', height: '8mm', border: '2px solid #b7791f', borderRadius: '50%', backgroundColor: '#FFFDF0' }} />
        </div>

        {/* Certificate Title */}
        <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '13pt', fontWeight: 700, color: '#1a1a2e', letterSpacing: '2px' }}>
            {degree ? `CERTIFICATE OF ${degree.toUpperCase()}` : 'CERTIFICATE OF ACHIEVEMENT'}
          </div>
        </div>

        {/* Certificate Body */}
        <div style={{ textAlign: 'center', marginBottom: '6mm', fontSize: '10pt', lineHeight: 1.8, color: '#333' }}>
          <div style={{ fontStyle: 'italic', marginBottom: '3mm' }}>This is to certify that</div>
          <div style={{ fontFamily: '"Playfair Display", serif', fontSize: '14pt', fontWeight: 700, margin: '3mm 0', textDecoration: 'underline' }}>
            {student || '[Student Name]'}
          </div>
          {(admissionNo || studentId || dateOfBirth) && (
            <div style={{ fontSize: '8pt', color: '#666', marginTop: '2mm' }}>
              Index No: {admissionNo || '—'} · Student ID: {studentId || '—'}
            </div>
          )}
          {(dateOfBirth || gender) && (
            <div style={{ fontSize: '8pt', color: '#666', marginTop: '1mm' }}>
              Born: {dateOfBirth || '—'} · {gender || '—'}
            </div>
          )}
          <div style={{ marginTop: '3mm' }}>
            has successfully completed all requirements for the {degree || programme || 'certificate'}
          </div>
          {grade && (
            <div style={{ marginTop: '2mm' }}>
              Overall Grade: <span style={{ fontWeight: 700, color: '#8B6914' }}>{grade}</span>
            </div>
          )}
          {yearOfCompletion && (
            <div style={{ marginTop: '1mm' }}>Session: {yearOfCompletion}</div>
          )}
          {graduationDate && (
            <div style={{ marginTop: '1mm' }}>Issued: {graduationDate}</div>
          )}
        </div>

        {/* Subject Table — WAEC Style */}
        {entries.length > 0 && (
          <div style={{ marginTop: '4mm', marginBottom: '4mm' }}>
            <div style={{ textAlign: 'center', fontSize: '9pt', fontWeight: 700, color: '#1a1a2e', marginBottom: '2mm', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Subjects and Grades
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt', fontFamily: '"Poppins", sans-serif' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #1a1a2e' }}>
                  <th style={{ padding: '3px 6px', textAlign: 'left', fontWeight: 700 }}>Subject</th>
                  <th style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700 }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '3px 6px' }}>{e.name}</td>
                    <td style={{ padding: '3px 6px', textAlign: 'center', fontWeight: 700, color: '#1a1a2e' }}>{e.grade || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8mm', padding: '0 10mm' }}>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '2px solid #333', paddingTop: '3px', marginBottom: '2px' }}>
              <span style={{ fontSize: '8pt', fontWeight: 600 }}>{vcName || 'Principal'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <div style={{ borderTop: '2px solid #333', paddingTop: '3px', marginBottom: '2px' }}>
              <span style={{ fontSize: '8pt', fontWeight: 600 }}>{registrarName || 'Registrar'}</span>
            </div>
          </div>
        </div>

        {/* Seal */}
        {sealName && (
          <div style={{
            position: 'absolute', bottom: '25mm', right: '15mm',
            width: '24mm', height: '24mm', borderRadius: '50%',
            border: '3px double #b7791f', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center', fontSize: '7pt', fontWeight: 700,
            color: '#b7791f', opacity: 0.8,
          }}>
            {sealName}
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '6mm', fontSize: '7pt', color: '#666', fontFamily: '"Poppins", sans-serif' }}>
          {certificateNo && <div>Certificate No: {certificateNo} · Serial: {serialNo}</div>}
          {issueDate && <div>Issued: {issueDate}</div>}
          {verificationUrl && <div>Verify: {verificationUrl}</div>}
        </div>
      </div>
    </div>
  )
}
