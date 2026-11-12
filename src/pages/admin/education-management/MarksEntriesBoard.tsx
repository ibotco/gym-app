import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, Download, Filter, Link2, RefreshCw, Save, Upload, Users } from 'lucide-react'
import { Button, Input, Select } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { EduRecords, EduRow } from '../../../lib/eduRecords'
import { useTeacherAccess } from '../../../lib/eduTeacherAccess'
import {
  caScopeSubjectKey,
  computeStudentCaScoreFromRow,
  distFieldKey,
  evaluateCaGrade,
  getCaTerms,
  GRADING_SCHEMES,
  isAggregateCaPart,
  isExamDistributionPart,
  resolveExamCaSyncState,
  resolveScopedSubjectMapKey,
} from '../../../lib/examCaSync'

const cleanValues = (v: unknown[]) => [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanValues(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p)) return cleanValues(p)
  } catch { /* ignore */ }
  return cleanValues(s.split(/[\n,;]/).map((x) => x.replace(/^\s*[-•]\s*/, '')))
}

function normSec(raw: string) {
  return raw.trim().replace(/^section\s+/i, '').trim().toLowerCase()
}

function sectionsForClass(records: EduRecords, className: string): string[] {
  const key = className.trim().toLowerCase()
  if (!key) return []
  const set = new Set<string>()

  for (const r of records.assignClassSubjects ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    parseJsonArray((r as any).sections ?? (r as any).section).forEach((s) => set.add(s))
  }
  for (const r of records.classList ?? []) {
    if (String(r.name ?? r.className ?? '').trim().toLowerCase() !== key) continue
    parseJsonArray((r as any).sections ?? (r as any).section).forEach((s) => set.add(s))
  }
  for (const r of (records as any).classSections ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    const v = String(r.section ?? r.name ?? '').trim()
    if (v) set.add(v)
  }
  for (const st of records.studentList ?? []) {
    const rc = String(st.className ?? '').trim()
    if (rc.toLowerCase().startsWith(key + ' ')) {
      const rest = rc.slice(className.trim().length).trim()
      if (rest) set.add(rest)
    }
    if (rc.toLowerCase() === key && st.section) {
      set.add(String(st.section).trim())
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b))
}

function subjectsForSelection(records: EduRecords, exam: string, className: string, section: string): string[] {
  const key = className.trim().toLowerCase()
  if (!key) return []
  const secKey = normSec(section)
  const out: string[] = []

  for (const r of records.assignClassSubjects ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    const secs = parseJsonArray((r as any).sections ?? (r as any).section)
    if (secKey && secs.length && !secs.some((s) => normSec(s) === secKey)) continue
    out.push(...parseJsonArray((r as any).subjects))
  }

  if (exam) {
    for (const r of records.examSchedule ?? []) {
      if (String(r.exam ?? '').trim().toLowerCase() !== exam.trim().toLowerCase()) continue
      const rc = String(r.className ?? '').trim().toLowerCase()
      const rs = normSec(String((r as any).section ?? ''))
      const classMatch = rc === key || (secKey && rc === `${key} ${secKey}`)
      const secMatch = !secKey || !rs || rs === secKey || rc === `${key} ${secKey}`
      if (classMatch && secMatch && r.subject) out.push(String(r.subject).trim())
    }
  }

  const cleaned = cleanValues(out)
  if (cleaned.length) return cleaned.sort((a, b) => a.localeCompare(b))

  return cleanValues((records.subjectList ?? []).map((r: any) => String(r.name ?? r.subject ?? '').trim())).sort((a, b) =>
    a.localeCompare(b),
  )
}

function studentsForClassSection(studentRows: EduRow[], className: string, section: string): EduRow[] {
  const k = className.trim().toLowerCase()
  const sk = normSec(section)
  if (!k) return []
  return (studentRows ?? [])
    .filter((r) => {
      const rc = String(r.className ?? '').trim().toLowerCase()
      const rs = normSec(String((r as any).section ?? ''))
      if (rc === k) {
        if (!sk) return true
        return !rs || rs === sk
      }
      if (sk && rc === `${k} ${sk}`) return true
      if (!sk && rc.startsWith(`${k} `)) return true
      return false
    })
    .sort((a, b) => {
      const ra = Number(a.rollNo)
      const rb = Number(b.rollNo)
      if (Number.isFinite(ra) && Number.isFinite(rb) && ra !== rb) return ra - rb
      return String(a.name ?? '').localeCompare(String(b.name ?? ''))
    })
}

function fallbackGradeFor(pct: number, gradesRange?: EduRow[]) {
  if (gradesRange && gradesRange.length > 0) {
    for (const g of gradesRange) {
      const min = Number(g.minScore)
      const max = Number(g.maxScore)
      if (Number.isFinite(min) && Number.isFinite(max) && pct >= min && pct <= max) {
        return String(g.grade ?? '—')
      }
    }
  }
  if (pct >= 90) return 'A+'
  if (pct >= 80) return 'A'
  if (pct >= 70) return 'B+'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

type StudentDraft = {
  isAbsent: boolean
  scores: Record<string, string>
}

export function MarksEntriesBoard({
  records,
  persist,
}: {
  records: EduRecords
  persist: (next: EduRecords) => void
}) {
  const toast = useToast()

  // Select Ground state (Branch is omitted because it is already selected in the app Header)
  const [exam, setExam] = useState('')
  const [klass, setKlass] = useState('')
  const [section, setSection] = useState('')
  const [subject, setSubject] = useState('')
  const [filtered, setFiltered] = useState(false)
  const [draft, setDraft] = useState<Record<string, StudentDraft>>({})

  const existingMarks: EduRow[] = records.markEntries ?? records.marksEntry ?? []
  const teacherScope = useTeacherAccess(records)

  const examOptions = useMemo(
    () =>
      cleanValues((records.examSetup ?? []).map((r) => String(r.examName ?? r.name ?? r.title ?? '').trim())),
    [records.examSetup],
  )

  const classOptions = useMemo(() => {
    const all = cleanValues((records.classList ?? []).map((r) => String(r.name ?? r.className ?? '').trim()))
    if (!teacherScope.isTeacher) return all
    return teacherScope.assignedBaseClasses
  }, [records.classList, teacherScope])

  const sectionOptions = useMemo(() => {
    const base = sectionsForClass(records, klass)
    if (!teacherScope.isTeacher || !klass) return base
    const teacherSecs = teacherScope.sectionsForBaseClass(klass)
    if (!teacherSecs.length) return base
    const inter = base.filter((s) => teacherSecs.some((ts) => normSec(ts) === normSec(s)))
    return inter.length ? inter : teacherSecs
  }, [records, klass, teacherScope])

  const subjectOptions = useMemo(() => {
    const all = subjectsForSelection(records, exam, klass, section)
    if (!teacherScope.isTeacher || !klass) return all
    return teacherScope.subjectsForClassSection(klass, section, all)
  }, [records, exam, klass, section, teacherScope])

  // Auto-select single available options for teachers to streamline mark entry
  useEffect(() => {
    if (!teacherScope.isTeacher) return
    if (!exam && examOptions.length === 1) setExam(examOptions[0])
    if (!klass && classOptions.length === 1) setKlass(classOptions[0])
  }, [teacherScope.isTeacher, exam, examOptions, klass, classOptions])

  useEffect(() => {
    if (!teacherScope.isTeacher || !klass) return
    if (!section && sectionOptions.length === 1) setSection(sectionOptions[0])
  }, [teacherScope.isTeacher, klass, section, sectionOptions])

  useEffect(() => {
    if (!teacherScope.isTeacher || !klass) return
    if (!subject && subjectOptions.length === 1) setSubject(subjectOptions[0])
  }, [teacherScope.isTeacher, klass, subject, subjectOptions])

  const selectedExamRow = useMemo(
    () =>
      (records.examSetup ?? []).find(
        (r: any) => String(r.examName ?? r.name ?? r.title ?? '').trim().toLowerCase() === exam.trim().toLowerCase(),
      ) ?? null,
    [records.examSetup, exam],
  )

  // Check whether the selected Exam Setup is synced/linked with Continuous Assessment
  const caSyncState = useMemo(
    () => resolveExamCaSyncState(records, selectedExamRow, klass, section),
    [records, selectedExamRow, klass, section],
  )

  // When Exam Setup is synced with Continuous Assessment, Mark Entries form uses the exact
  // columns: Class Score + Exam (with CA% and Exam% maxMarks). Otherwise uses Exam's Mark Distribution.
  const distDefs = useMemo(() => {
    if (caSyncState.isSynced) {
      const cols: { name: string; key: string; maxMark: number }[] = [
        { name: 'Class Score', key: 'classScore', maxMark: caSyncState.caMax },
      ]
      if (caSyncState.examMax > 0) {
        cols.push({ name: 'Exam', key: 'exam', maxMark: caSyncState.examMax })
      }
      return cols
    }

    const names = parseJsonArray(
      (selectedExamRow as any)?.markDistribution ??
        (selectedExamRow as any)?.markDistributions ??
        (selectedExamRow as any)?.distribution,
    )
    const cols = names.length ? names : ['Marks']

    const schedRow = (records.examSchedule ?? []).find((r: any) => {
      if (String(r.exam ?? '').trim().toLowerCase() !== exam.trim().toLowerCase()) return false
      if (String(r.subject ?? '').trim().toLowerCase() !== subject.trim().toLowerCase()) return false
      const rc = String(r.className ?? '').trim().toLowerCase()
      const k = klass.trim().toLowerCase()
      const sk = normSec(section)
      const rs = normSec(String(r.section ?? ''))
      const classOk = rc === k || (sk && rc === `${k} ${sk}`)
      const secOk = !sk || !rs || rs === sk || rc === `${k} ${sk}`
      return classOk && secOk
    }) as any

    const mdRows = records.markDistribution ?? []

    return cols.map((dist) => {
      const k = distFieldKey(dist)
      const schedMax = Number(schedRow?.[k] ?? schedRow?.[dist] ?? '')
      const mdRow = mdRows.find((m: any) => String(m.name ?? '').trim().toLowerCase() === dist.trim().toLowerCase())
      const mdMax = Number((mdRow as any)?.maxMarks ?? '')
      const maxMark =
        Number.isFinite(schedMax) && schedMax > 0
          ? schedMax
          : Number.isFinite(mdMax) && mdMax > 0
            ? mdMax
            : cols.length === 1
              ? 100
              : 0
      return { name: dist, key: k, maxMark }
    })
  }, [
    caSyncState.isSynced,
    caSyncState.caMax,
    caSyncState.examMax,
    selectedExamRow,
    records.examSchedule,
    records.markDistribution,
    exam,
    klass,
    section,
    subject,
  ])

  const students = useMemo(
    () => studentsForClassSection(records.studentList ?? [], klass, section),
    [records.studentList, klass, section],
  )

  const readSavedCaAndExam = (saved: any, breakdown: Record<string, string>) => {
    // Extract saved Class Score from breakdown or flat keys
    let savedCa =
      breakdown['Class Score'] ??
      saved?.classScore ??
      breakdown['Class Work'] ??
      saved?.classWork ??
      ''
    if (String(savedCa).trim() === '') {
      // Sum any non-exam parts in breakdown if saved under older distribution names
      const nonExamEntries = Object.entries(breakdown).filter(
        ([k, v]) => !isExamDistributionPart(k) && String(v ?? '').trim() !== '',
      )
      if (nonExamEntries.length > 0) {
        const sum = nonExamEntries.reduce((s, [, v]) => s + (Number(v) || 0), 0)
        savedCa = String(Number(sum.toFixed(2)))
      }
    }

    // Extract saved Exam score from breakdown or flat keys
    let savedEx =
      breakdown.Exam ??
      breakdown.Exams ??
      saved?.exam ??
      saved?.exams ??
      ''
    if (String(savedEx).trim() === '') {
      const examEntry = Object.entries(breakdown).find(
        ([k, v]) => isExamDistributionPart(k) && String(v ?? '').trim() !== '',
      )
      if (examEntry) savedEx = String(examEntry[1])
    }

    return {
      savedCa: String(savedCa ?? '').trim(),
      savedEx: String(savedEx ?? '').trim(),
    }
  }

  const buildDraftForStudents = (preferLiveCa = true): Record<string, StudentDraft> => {
    const byStudent = new Map<string, EduRow>()
    for (const r of existingMarks) {
      if (String(r.exam ?? '').trim().toLowerCase() !== exam.trim().toLowerCase()) continue
      if (String(r.subject ?? '').trim().toLowerCase() !== subject.trim().toLowerCase()) continue
      byStudent.set(String(r.student ?? '').trim().toLowerCase(), r)
    }

    const nextDraft: Record<string, StudentDraft> = {}
    for (const st of students) {
      const sid = String(st.id)
      const sName = String(st.name ?? '').trim().toLowerCase()
      const saved = byStudent.get(sName) as any
      let breakdown: Record<string, string> = {}
      if (saved?.markBreakdown) {
        try {
          const parsed = JSON.parse(String(saved.markBreakdown))
          if (parsed && typeof parsed === 'object') breakdown = parsed
        } catch { /* ignore */ }
      }

      const isAbsent =
        saved?.isAbsent === true ||
        String(saved?.isAbsent ?? '').toLowerCase() === 'true' ||
        String(saved?.isAbsent ?? '').toLowerCase() === 'yes'

      if (caSyncState.isSynced) {
        const { caScore, examScore } = computeStudentCaScoreFromRow(
          caSyncState.classSectionCa,
          subject,
          sid,
          caSyncState.caMax,
          caSyncState.matchedTerm,
        )
        const { savedCa, savedEx } = readSavedCaAndExam(saved, breakdown)

        const classScoreStr =
          preferLiveCa && caScore !== null
            ? String(caScore)
            : savedCa !== ''
              ? savedCa
              : caScore !== null
                ? String(caScore)
                : ''

        const examScoreStr =
          savedEx !== ''
            ? savedEx
            : examScore !== null
              ? String(examScore)
              : ''

        const scores: Record<string, string> = {
          'Class Score': classScoreStr,
        }
        if (caSyncState.examMax > 0) {
          scores.Exam = examScoreStr
        }
        nextDraft[sid] = { isAbsent, scores }
      } else {
        const scores: Record<string, string> = {}
        distDefs.forEach((d, idx) => {
          const fromBreakdown = breakdown[d.name] ?? saved?.[d.key]
          if (fromBreakdown !== undefined && fromBreakdown !== null && String(fromBreakdown) !== '') {
            scores[d.name] = String(fromBreakdown)
          } else if (distDefs.length === 1 && idx === 0 && saved?.marks !== undefined) {
            scores[d.name] = String(saved.marks ?? '')
          } else {
            scores[d.name] = ''
          }
        })
        nextDraft[sid] = { isAbsent, scores }
      }
    }
    return nextDraft
  }

  const syncFromContinuousAssessment = () => {
    if (!caSyncState.classSectionCa || !subject) return
    let importedStudents = 0
    setDraft((prev) => {
      const next = { ...prev }
      for (const st of students) {
        const sid = String(st.id)
        const cur = next[sid] ?? { isAbsent: false, scores: {} }
        const { caScore, examScore } = computeStudentCaScoreFromRow(
          caSyncState.classSectionCa,
          subject,
          sid,
          caSyncState.caMax,
          caSyncState.matchedTerm,
        )
        if (caScore === null && examScore === null) continue
        const updatedScores = { ...cur.scores }
        if (caScore !== null) updatedScores['Class Score'] = String(caScore)
        if (examScore !== null && caSyncState.examMax > 0 && !updatedScores.Exam) {
          updatedScores.Exam = String(examScore)
        }
        next[sid] = { ...cur, scores: updatedScores }
        importedStudents++
      }
      return next
    })

    toast.success(
      'Synced from Continuous Assessment',
      `${importedStudents} student Class Score(s) refreshed for ${subject}.`,
    )
  }

  const handleFilter = () => {
    if (!exam) {
      toast.error('Select Exam first')
      return
    }
    if (!klass) {
      toast.error('Select Class first')
      return
    }
    if (!section) {
      toast.error('Select Section first')
      return
    }
    if (!subject) {
      toast.error('Select Subject first')
      return
    }

    setDraft(buildDraftForStudents(true))
    setFiltered(true)
  }

  const toggleAbsent = (sid: string, checked: boolean) => {
    setDraft((prev) => {
      const cur = prev[sid] ?? { isAbsent: false, scores: {} }
      return { ...prev, [sid]: { ...cur, isAbsent: checked } }
    })
  }

  const setScore = (sid: string, distName: string, rawVal: string, maxMark: number) => {
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) return
    if (rawVal !== '' && maxMark > 0 && Number(rawVal) > maxMark) {
      toast.error(
        'Invalid score',
        `${distName} (${rawVal}) cannot exceed MaxMark ${maxMark}.`,
      )
      return
    }
    setDraft((prev) => {
      const cur = prev[sid] ?? { isAbsent: false, scores: {} }
      return {
        ...prev,
        [sid]: {
          ...cur,
          scores: { ...cur.scores, [distName]: rawVal },
        },
      }
    })
  }

  const evaluateRowGrade = (pct: number): string => {
    if (caSyncState.isSynced) {
      return evaluateCaGrade(pct, caSyncState.gradingScheme).grade
    }
    return fallbackGradeFor(pct, records.gradesRange)
  }

  const handleSave = () => {
    if (!filtered) {
      toast.error('Click Filter first')
      return
    }
    if (!students.length) {
      toast.error('No students found in this Class / Section')
      return
    }

    for (const st of students) {
      const d = draft[String(st.id)]
      if (!d || d.isAbsent) continue
      for (const col of distDefs) {
        const raw = String(d.scores[col.name] ?? '').trim()
        if (!raw) continue
        const num = Number(raw)
        if (col.maxMark > 0 && num > col.maxMark) {
          toast.error(
            'Mark exceeds maximum',
            `${String(st.name ?? 'Student')}: ${col.name} (${num}) exceeds MaxMark ${col.maxMark}`,
          )
          return
        }
      }
    }

    const nextMarks = [...existingMarks]
    const idxByKey = new Map<string, number>()
    nextMarks.forEach((r, i) => {
      const k = `${String(r.exam ?? '').trim().toLowerCase()}|${String(r.student ?? '').trim().toLowerCase()}|${String(r.subject ?? '').trim().toLowerCase()}`
      idxByKey.set(k, i)
    })

    const sumConfiguredMax = distDefs.reduce((acc, c) => acc + (c.maxMark > 0 ? c.maxMark : 0), 0)
    const totalMax = sumConfiguredMax > 0 ? sumConfiguredMax : 100

    let creates = 0
    let updates = 0

    // Also keep linked Continuous Assessment's Class Assessment Sheet (`classSheetJson`) in sync
    let updatedCaAssessments: EduRow[] | undefined
    let csPatchForSubject: Record<string, { ca: string; exam: string }> | undefined
    if (caSyncState.isSynced && caSyncState.classSectionCa) {
      let existingCs: Record<string, Record<string, { ca: string; exam: string }>> = {}
      try {
        existingCs = JSON.parse(String(caSyncState.classSectionCa.classSheetJson || '{}'))
      } catch { /* ignore */ }
      const caTerms = getCaTerms(caSyncState.classSectionCa)
      const primaryTerm = caTerms[0] ?? 'Term 1'
      const subjKey =
        caTerms.length > 1
          ? resolveScopedSubjectMapKey(existingCs, subject, caSyncState.matchedTerm, primaryTerm) ||
            caScopeSubjectKey(caSyncState.matchedTerm, subject)
          : resolveScopedSubjectMapKey(existingCs, subject, caSyncState.matchedTerm, primaryTerm)
      csPatchForSubject = { ...(existingCs[subjKey] ?? {}) }

      for (const st of students) {
        const sid = String(st.id)
        const d = draft[sid]
        if (!d) continue
        if (d.isAbsent) {
          csPatchForSubject[sid] = { ca: '0', exam: '0' }
        } else {
          const caStr = String(d.scores['Class Score'] ?? '').trim()
          const exStr = String(d.scores.Exam ?? '').trim()
          if (caStr !== '' || exStr !== '') {
            csPatchForSubject[sid] = {
              ca: caStr !== '' ? caStr : csPatchForSubject[sid]?.ca ?? '',
              exam: exStr !== '' ? exStr : csPatchForSubject[sid]?.exam ?? '',
            }
          }
        }
      }

      const nextCsAll = { ...existingCs, [subjKey]: csPatchForSubject }
      const allCa = ((records as any).continuousAssessments ?? []) as EduRow[]
      updatedCaAssessments = allCa.map((row) =>
        row.id === caSyncState.classSectionCa!.id
          ? { ...row, classSheetJson: JSON.stringify(nextCsAll) }
          : row,
      )
    }

    for (const st of students) {
      const sid = String(st.id)
      const d = draft[sid]
      if (!d) continue

      const hasAnyScore = distDefs.some((c) => String(d.scores[c.name] ?? '').trim() !== '')
      if (!d.isAbsent && !hasAnyScore) continue

      const totalEarned = d.isAbsent
        ? 0
        : distDefs.reduce((acc, c) => {
            const v = Number(d.scores[c.name] ?? '')
            return acc + (Number.isFinite(v) ? v : 0)
          }, 0)

      const pct = d.isAbsent ? 0 : (totalEarned / totalMax) * 100
      const gradeVal = d.isAbsent ? 'AB' : evaluateRowGrade(pct)

      const sName = String(st.name ?? '').trim()
      const lookup = `${exam.trim().toLowerCase()}|${sName.toLowerCase()}|${subject.trim().toLowerCase()}`

      const caValStr = caSyncState.isSynced
        ? d.isAbsent
          ? '0'
          : String(d.scores['Class Score'] ?? '')
        : undefined
      const exValStr = caSyncState.isSynced
        ? d.isAbsent
          ? '0'
          : String(d.scores.Exam ?? '')
        : undefined

      const rowPayload: EduRow = {
        id: uid(),
        exam: exam.trim(),
        className: klass.trim(),
        section: section.trim(),
        student: sName,
        admissionNo: String(st.admissionNo ?? ''),
        rollNo: String(st.rollNo ?? ''),
        subject: subject.trim(),
        isAbsent: d.isAbsent ? 'Yes' : 'No',
        marks: String(Number(totalEarned.toFixed(2))),
        maxMarks: String(totalMax),
        grade: gradeVal,
        markBreakdown: JSON.stringify(d.isAbsent ? {} : d.scores),
        ...Object.fromEntries(
          distDefs.map((c) => [c.key, d.isAbsent ? '0' : String(d.scores[c.name] ?? '')]),
        ),
        ...(caSyncState.isSynced
          ? {
              classScore: caValStr ?? '',
              classWork: caValStr ?? '',
              examScore: exValStr ?? '',
              exams: exValStr ?? '',
            }
          : {}),
      }

      const existingIdx = idxByKey.get(lookup)
      if (existingIdx !== undefined) {
        nextMarks[existingIdx] = { ...nextMarks[existingIdx], ...rowPayload, id: nextMarks[existingIdx].id }
        updates++
      } else {
        nextMarks.push(rowPayload)
        idxByKey.set(lookup, nextMarks.length - 1)
        creates++
      }
    }

    const next: EduRecords = {
      ...records,
      markEntries: nextMarks,
      marksEntry: nextMarks,
      ...(updatedCaAssessments ? { continuousAssessments: updatedCaAssessments } : {}),
    } as EduRecords
    persist(next)
    toast.success('Marks saved', `${creates} new, ${updates} updated for ${subject}`)
  }

  const exportCsv = () => {
    const distHeaders = distDefs.map((d) => d.name)
    const header = ['Student Name', 'Register No', 'Roll', 'Is Absent', ...distHeaders, 'Total', 'Grade'].join(',')
    const sumMax = distDefs.reduce((a, c) => a + (c.maxMark > 0 ? c.maxMark : 0), 0) || 100
    const lines = students.map((st, idx) => {
      const d = draft[String(st.id)] ?? { isAbsent: false, scores: {} }
      const anyEntered = distDefs.some((c) => String(d.scores[c.name] ?? '').trim() !== '')
      const total = d.isAbsent
        ? 0
        : distDefs.reduce((a, c) => a + (Number(d.scores[c.name] ?? '') || 0), 0)
      const pct = d.isAbsent ? 0 : anyEntered ? (total / sumMax) * 100 : null
      const grd = d.isAbsent ? 'AB' : pct !== null ? evaluateRowGrade(pct) : ''
      const vals = [
        st.name ?? '',
        st.admissionNo ?? '',
        st.rollNo ?? String(idx + 1),
        d.isAbsent ? 'Yes' : 'No',
        ...distDefs.map((c) => (d.isAbsent ? '0' : d.scores[c.name] ?? '')),
        anyEntered || d.isAbsent ? String(Number(total.toFixed(2))) : '',
        grd,
      ]
      return vals.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mark-entries-${klass}-${section}-${subject}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result ?? '')
      const rows = raw.split(/\r?\n/).filter((l) => l.trim())
      if (rows.length < 2) {
        toast.error('CSV has no data rows')
        return
      }
      const nextDraft = { ...draft }
      let matched = 0
      for (const line of rows.slice(1)) {
        const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const sName = (cols[0] ?? '').toLowerCase()
        const adm = (cols[1] ?? '').toLowerCase()
        const st = students.find(
          (s) =>
            String(s.name ?? '').trim().toLowerCase() === sName ||
            (adm && String(s.admissionNo ?? '').trim().toLowerCase() === adm),
        )
        if (!st) continue
        const isAbs = (cols[3] ?? '').toLowerCase() === 'yes' || (cols[3] ?? '').toLowerCase() === 'true'
        const scores: Record<string, string> = {}
        distDefs.forEach((d, idx) => {
          scores[d.name] = cols[4 + idx] ?? ''
        })
        nextDraft[String(st.id)] = { isAbsent: isAbs, scores }
        matched++
      }
      setDraft(nextDraft)
      toast.success('CSV loaded into sheet', `${matched} student row(s) matched — click Save to persist`)
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-5">
      {/* Select Ground — Branch omitted since active Branch is already set in the global Header */}
      <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-400 bg-zinc-50/80 px-4 py-2.5 text-sm font-bold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
          <span>Select Ground</span>
          {teacherScope.isTeacher && (
            <span className="text-xs font-normal text-emerald-700 dark:text-emerald-300">
              Assigned Scope: <b>{teacherScope.assignedClassLabels.join(', ') || 'None'}</b> ·{' '}
              <b>{teacherScope.assignedSubjects.join(', ') || 'Assigned Subjects'}</b>
            </span>
          )}
        </div>

        <div className="px-4 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              <span>
                Exam <span className="text-red-500">*</span>
              </span>
              <Select
                value={exam}
                onChange={(e) => {
                  setExam(e.target.value)
                  setFiltered(false)
                }}
              >
                <option value="">Select</option>
                {examOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              <span>
                Class <span className="text-red-500">*</span>
              </span>
              <Select
                value={klass}
                onChange={(e) => {
                  setKlass(e.target.value)
                  setSection('')
                  setSubject('')
                  setFiltered(false)
                }}
              >
                <option value="">Select</option>
                {classOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              <span>
                Section <span className="text-red-500">*</span>
              </span>
              <Select
                value={section}
                disabled={!klass}
                onChange={(e) => {
                  setSection(e.target.value)
                  setSubject('')
                  setFiltered(false)
                }}
              >
                <option value="">{klass ? 'Select' : 'Select Class First'}</option>
                {sectionOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
              <span>
                Subject <span className="text-red-500">*</span>
              </span>
              <Select
                value={subject}
                disabled={!klass}
                onChange={(e) => {
                  setSubject(e.target.value)
                  setFiltered(false)
                }}
              >
                <option value="">{klass ? 'Select' : 'Select Class First'}</option>
                {subjectOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        <div className="flex justify-end border-t border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
          <button
            type="button"
            onClick={handleFilter}
            className="inline-flex h-8 min-w-[190px] cursor-pointer items-center justify-center gap-1.5 rounded border border-zinc-300 bg-white px-5 text-xs font-bold text-zinc-800 transition hover:bg-zinc-100 active:scale-[0.99] sm:w-[215px] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            <Filter className="size-3.5 fill-current" /> Filter
          </button>
        </div>
      </div>

      {/* Mark Entries table — shown after Filter is clicked */}
      {filtered && (
        <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-amber-400 bg-zinc-50/80 px-4 py-2.5 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
              <ClipboardCheck className="size-4" />
              <span>Mark Entries</span>
              <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                — {exam} · {klass} ({section}) · {subject}
              </span>
            </div>

            {students.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                  <Upload className="size-3.5" /> Import CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
                </label>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border border-zinc-300 bg-white px-2.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Download className="size-3.5" /> Export CSV
                </button>
              </div>
            )}
          </div>

          {selectedExamRow && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs dark:bg-emerald-500/[0.08]">
              {caSyncState.isSynced ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-zinc-700 dark:text-zinc-200">
                    <Link2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Synced with Continuous Assessment · Class Score <b>{caSyncState.caMax}%</b> / Exam{' '}
                      <b>{caSyncState.examMax}%</b> · Scheme:{' '}
                      <b>
                        {GRADING_SCHEMES.find((g) => g.id === caSyncState.gradingScheme)?.short ?? 'Standard'}
                      </b>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {caSyncState.classSectionCa && (
                      <button
                        type="button"
                        onClick={syncFromContinuousAssessment}
                        className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded border border-emerald-600/30 bg-white px-2.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-zinc-900 dark:text-emerald-300 dark:hover:bg-zinc-800"
                      >
                        <RefreshCw className="size-3" /> Refresh Class Score
                      </button>
                    )}
                    <Link
                      to={`/admin/education-management/examinations/continuous-assessment?examId=${encodeURIComponent(selectedExamRow.id)}`}
                      className="text-[11px] font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300"
                    >
                      {caSyncState.classSectionCa ? 'Open CA →' : 'Create Class CA →'}
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex w-full flex-wrap items-center justify-between gap-2 text-zinc-600 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="size-3.5 text-zinc-400" />
                    Not yet synced with Continuous Assessment for <b>{exam}</b>.
                  </span>
                  <Link
                    to={`/admin/education-management/examinations/continuous-assessment?examId=${encodeURIComponent(selectedExamRow.id)}`}
                    className="text-[11px] font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300"
                  >
                    Sync with Continuous Assessment →
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[780px] text-xs">
                <thead>
                  <tr className="bg-zinc-100/90 text-left text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {!caSyncState.isSynced && (
                      <th className="w-12 border-b border-r border-zinc-200 px-3 py-2.5 text-center dark:border-zinc-700">#</th>
                    )}
                    <th className="border-b border-r border-zinc-200 px-3 py-2.5 dark:border-zinc-700">Student Name</th>
                    <th className="border-b border-r border-zinc-200 px-3 py-2.5 dark:border-zinc-700">Register No</th>
                    <th className="w-20 border-b border-r border-zinc-200 px-3 py-2.5 text-center dark:border-zinc-700">Roll</th>
                    <th className="w-24 border-b border-r border-zinc-200 px-3 py-2.5 text-center dark:border-zinc-700">Is Absent</th>
                    {distDefs.map((col) => (
                      <th
                        key={col.name}
                        className="min-w-[155px] border-b border-r border-zinc-200 px-3 py-2.5 dark:border-zinc-700"
                      >
                        {col.name}
                        {col.maxMark > 0 ? ` (MaxMark : ${col.maxMark})` : ''}
                      </th>
                    ))}
                    <th className="w-24 border-b border-r border-zinc-200 px-3 py-2.5 text-center dark:border-zinc-700">Total</th>
                    <th className="w-24 border-b border-zinc-200 px-3 py-2.5 text-center dark:border-zinc-700">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length ? (
                    students.map((st, idx) => {
                      const sid = String(st.id)
                      const d = draft[sid] ?? { isAbsent: false, scores: {} }
                      const anyEntered = distDefs.some((c) => String(d.scores[c.name] ?? '').trim() !== '')
                      const total = d.isAbsent
                        ? 0
                        : distDefs.reduce((acc, c) => {
                            const n = Number(d.scores[c.name] ?? '')
                            return acc + (Number.isFinite(n) ? n : 0)
                          }, 0)
                      const sumMax = distDefs.reduce((a, c) => a + (c.maxMark > 0 ? c.maxMark : 0), 0) || 100
                      const pct = d.isAbsent ? 0 : anyEntered ? (total / sumMax) * 100 : null
                      const grd = d.isAbsent ? 'AB' : pct !== null ? evaluateRowGrade(pct) : '—'

                      return (
                        <tr
                          key={sid}
                          className="border-b border-zinc-200 last:border-b-0 hover:bg-black/[0.015] dark:border-zinc-800 dark:hover:bg-white/[0.02]"
                        >
                          {!caSyncState.isSynced && (
                            <td className="border-r border-zinc-200 px-3 py-2 text-center text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                              {idx + 1}
                            </td>
                          )}
                          <td className="border-r border-zinc-200 px-3 py-2 font-medium text-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                            {String(st.name ?? '—')}
                          </td>
                          <td className="border-r border-zinc-200 px-3 py-2 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                            {String(st.admissionNo ?? '—')}
                          </td>
                          <td className="border-r border-zinc-200 px-3 py-2 text-center text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                            {String(st.rollNo || idx + 1)}
                          </td>
                          <td className="border-r border-zinc-200 px-3 py-2 text-center dark:border-zinc-800">
                            <input
                              type="checkbox"
                              checked={d.isAbsent}
                              onChange={(e) => toggleAbsent(sid, e.target.checked)}
                              aria-label={`Mark ${String(st.name ?? 'student')} absent`}
                              className="size-4 cursor-pointer accent-amber-500"
                            />
                          </td>
                          {distDefs.map((col) => {
                            const val = d.scores[col.name] ?? ''
                            const overMax = !d.isAbsent && col.maxMark > 0 && val !== '' && Number(val) > col.maxMark
                            return (
                              <td key={col.name} className="border-r border-zinc-200 px-3 py-2 dark:border-zinc-800">
                                <Input
                                  value={d.isAbsent ? '' : val}
                                  disabled={d.isAbsent}
                                  onChange={(e) => setScore(sid, col.name, e.target.value, col.maxMark)}
                                  placeholder={d.isAbsent ? 'Absent' : `0 - ${col.maxMark || 100}`}
                                  inputMode="decimal"
                                  className={`h-8 text-xs ${overMax ? '!border-red-500 !ring-red-500/20' : ''}`}
                                />
                              </td>
                            )
                          })}
                          <td className="border-r border-zinc-200 px-3 py-2 text-center font-mono font-bold text-zinc-800 dark:border-zinc-800 dark:text-zinc-100">
                            {d.isAbsent ? '0' : anyEntered ? Number(total.toFixed(2)) : '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                grd === 'F' || grd === 'AB' || grd === '9' || grd === 'Needs Support' || grd === 'B5'
                                  ? 'bg-rose-500 text-white'
                                  : grd === 'A+' || grd === 'A' || grd === '1' || grd === 'EX' || grd === 'A1' || grd === 'Distinction'
                                    ? 'bg-emerald-500 text-white'
                                    : grd === '—'
                                      ? 'text-zinc-400'
                                      : 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900'
                              }`}
                            >
                              {grd}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={(caSyncState.isSynced ? 6 : 7) + distDefs.length}
                        className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                      >
                        <Users className="mx-auto mb-2 size-7 opacity-40" />
                        No students found in <b>{klass}</b> (Section <b>{section}</b>).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {students.length > 0 && (
            <div className="flex justify-end border-t border-zinc-200 bg-zinc-50/70 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <Button
                onClick={handleSave}
                className="h-8 gap-2 rounded border border-zinc-800 bg-zinc-900 px-6 text-xs font-bold text-white hover:bg-zinc-800 dark:border-zinc-200 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Save className="size-3.5" /> Save
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
