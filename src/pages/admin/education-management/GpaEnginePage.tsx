import { useMemo, useState } from 'react'
import { Field, Select } from '../../../components/ui'
import type { EduRecords, EduRow } from '../../../lib/eduRecords'

const text = (v: unknown) => String(v ?? '').trim()
const key = (v: unknown) => text(v).toLocaleLowerCase()
const number = (v: unknown) => text(v) === '' ? NaN : Number(v)
const distinct = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))

type Attempt = { id: string; exam: string; subject: string; year: string; term: string; credits: number; points: number; grade: string; issue: string }

export function GpaEnginePage({ records }: { records: EduRecords }) {
  const [studentId, setStudentId] = useState('')
  const [year, setYear] = useState('')
  const [term, setTerm] = useState('')
  const mappings = records.gpaExamPeriods ?? []
  const students = records.studentList ?? []
  const marks = records.marksEntry ?? records.markEntries ?? []
  const years = distinct((records.academicYear ?? []).map(r => text(r.name)))
  const termsFor = (y: string) => distinct((records.termSemester ?? []).filter(r => key(r.academicYear) === key(y)).map(r => text(r.name)))
  const selectedStudent = students.find(s => s.id === studentId)
  const attempts = useMemo<Attempt[]>(() => {
    if (!selectedStudent) return []
    const admission = key(selectedStudent.admissionNo)
    const name = key(selectedStudent.name)
    const sameNameCount = students.filter(s => key(s.name) === name).length
    return marks.filter(r => {
      const rowAdmission = key(r.admissionNo)
      if (rowAdmission && admission) return rowAdmission === admission
      return sameNameCount === 1 && name !== '' && key(r.student) === name && (!rowAdmission || !admission)
    }).map(r => {
      // Prefer period information on the mark itself, then its uniquely named
      // exam. A previously saved explicit mapping is a fallback only.
      const examRows = (records.examSetup ?? []).filter(e => key(e.examName ?? e.name) === key(r.exam))
      const examRow = examRows.length === 1 ? examRows[0] : undefined
      const matchedPeriods = mappings.filter(m => key(m.exam) === key(r.exam))
      const legacy = matchedPeriods.length === 1 ? matchedPeriods[0] : undefined
      const markTerm = text(r.term ?? r.termSemester)
      const markYear = text(r.academicYear ?? r.session)
      let periodTerm = markTerm || text(examRow?.term ?? examRow?.termSemester)
      let periodYear = markYear || text(examRow?.academicYear ?? examRow?.session)
      let periodIssue = ''
      if ((!markTerm || !markYear) && examRows.length > 1) periodIssue = 'Exam name is ambiguous in Exam Setup'
      const legacyTerm = text(legacy?.term), legacyYear = text(legacy?.academicYear)
      const legacyCompatible = !((periodTerm && legacyTerm && key(periodTerm) !== key(legacyTerm)) || (periodYear && legacyYear && key(periodYear) !== key(legacyYear)))
      if (legacyCompatible) {
        periodTerm ||= legacyTerm
        periodYear ||= legacyYear
      }
      if (periodTerm && !periodYear) {
        const yearsForTerm = distinct((records.termSemester ?? []).filter(t => key(t.name) === key(periodTerm)).map(t => text(t.academicYear)))
        if (yearsForTerm.length === 1) periodYear = yearsForTerm[0]
      }
      if (!periodTerm || !periodYear) periodIssue ||= 'Academic period missing or ambiguous in Exam Setup'
      else {
        const validPeriod = (records.termSemester ?? []).some(t => key(t.name) === key(periodTerm) && key(t.academicYear) === key(periodYear))
        if (!validPeriod) periodIssue ||= 'Year and term do not match an academic period'
      }
      const matches = (records.subjectList ?? []).filter(s => key(s.name) === key(r.subject))
      const credits = matches.length === 1 ? number(matches[0].creditHours) : NaN
      const earned = number(r.marks), max = number(r.maxMarks)
      const pct = earned / max * 100
      const ranges = (records.gradesRange ?? []).filter(g => {
        const min = number(g.minScore), upper = number(g.maxScore)
        return Number.isFinite(min) && Number.isFinite(upper) && pct >= min && pct <= upper
      })
      const points = ranges.length === 1 ? number(ranges[0].gradePoint) : NaN
      let issue = ''
      if (periodIssue) issue = periodIssue
      else if (/^(yes|true|1)$/i.test(text(r.isAbsent)) || /^ab$/i.test(text(r.grade))) issue = 'Absent — review institution policy'
      else if (matches.length !== 1) issue = matches.length ? 'Ambiguous subject name' : 'Subject not found'
      else if (!Number.isFinite(credits) || credits <= 0) issue = 'Subject needs positive credit hours'
      else if (!Number.isFinite(earned) || !Number.isFinite(max) || max <= 0 || earned < 0 || earned > max) issue = 'Invalid or missing marks / maximum'
      else if (ranges.length !== 1) issue = ranges.length ? 'Overlapping grade ranges' : 'No grade range matches score'
      else if (!Number.isFinite(points) || points < 0) issue = 'Grade range needs a grade point'
      return { id: r.id, exam: text(r.exam), subject: text(r.subject), year: periodYear, term: periodTerm, credits, points, grade: text(ranges[0]?.grade), issue }
    })
  }, [selectedStudent, students, marks, mappings, records.subjectList, records.gradesRange, records.examSetup, records.termSemester])
  const selected = attempts.filter(a => key(a.year) === key(year) && key(a.term) === key(term))
  const calculate = (items: Attempt[]) => {
    if (!items.length || items.some(r => r.issue)) return null
    const credits = items.reduce((sum, r) => sum + r.credits, 0)
    return credits > 0 ? items.reduce((sum, r) => sum + r.credits * r.points, 0) / credits : null
  }
  const unassigned = attempts.some(a => !a.year || !a.term)
  const selectedName = key(selectedStudent?.name)
  const duplicateNames = Boolean(selectedName) && students.filter(s => key(s.name) === selectedName).length > 1
  const ambiguousMarks = duplicateNames && marks.some(r => key(r.student) === selectedName && !key(r.admissionNo))
  const duplicateAdmission = Boolean(key(selectedStudent?.admissionNo)) && students.filter(s => key(s.admissionNo) === key(selectedStudent?.admissionNo)).length > 1
  const identityIssue = ambiguousMarks || duplicateAdmission
  const gpa = unassigned || identityIssue ? null : calculate(selected)
  const cgpa = identityIssue ? null : calculate(attempts)
  return <div className="space-y-5">
    <div className="rounded-xl border border-line bg-card p-4 text-sm">
      <h2 className="font-semibold">Calculate GPA / CGPA</h2>
      <p className="mt-1 text-mist">GPA is credit-weighted for the selected term or semester. CGPA includes all recorded attempts, including repeats. Exam periods are taken from mark entries or Exam Setup and the academic calendar. Calculations use current credits and grade ranges; student results are not changed.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Field label="Student"><Select value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Select student</option>{students.map(s => <option key={s.id} value={s.id}>{s.name}{s.admissionNo ? ` (${s.admissionNo})` : ''}</option>)}</Select></Field>
        <Field label="Academic Year / Session"><Select value={year} onChange={e => { setYear(e.target.value); setTerm('') }}><option value="">Select year</option>{years.map(x => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Term / Semester"><Select value={term} onChange={e => setTerm(e.target.value)}><option value="">Select term</option>{termsFor(year).map(x => <option key={x}>{x}</option>)}</Select></Field>
      </div>
      {selectedStudent && <>
        <div className="mt-4 flex flex-wrap gap-5"><div><span className="text-mist">Period GPA: </span><strong>{gpa === null ? 'Unavailable' : gpa.toFixed(2)}</strong></div><div><span className="text-mist">Overall CGPA: </span><strong>{cgpa === null ? 'Unavailable' : cgpa.toFixed(2)}</strong></div></div>
        <p className="mt-2 text-xs text-mist">Formula: sum of (credit hours × grade point) ÷ sum of credit hours. Results are unavailable if any included attempt needs review; no partial GPA is shown.</p>
        {identityIssue && <p className="mt-2 text-xs text-amber-600">Student identification is ambiguous. Resolve duplicate admission numbers or add admission numbers to marks for students sharing a name before calculating.</p>}
        {unassigned && <p className="mt-2 text-xs text-amber-600">Some academic periods could not be identified. Review the exam year and term in Exam Setup and the academic calendar.</p>}
        <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-line"><th className="p-2">Exam</th><th className="p-2">Period</th><th className="p-2">Subject</th><th className="p-2">Credits</th><th className="p-2">Grade</th><th className="p-2">Point</th><th className="p-2">Status</th></tr></thead><tbody>{attempts.map(a => <tr key={a.id} className="border-b border-line"><td className="p-2">{a.exam}</td><td className="p-2">{a.year && a.term ? `${a.year} · ${a.term}` : 'Unassigned'}</td><td className="p-2">{a.subject}</td><td className="p-2">{Number.isFinite(a.credits) ? a.credits : '—'}</td><td className="p-2">{a.grade || '—'}</td><td className="p-2">{Number.isFinite(a.points) ? a.points : '—'}</td><td className="p-2">{a.issue || 'Ready'}</td></tr>)}</tbody></table>{attempts.length === 0 && <p className="p-3 text-mist">No matching mark entries found.</p>}</div>
      </>}
    </div>
  </div>
}
