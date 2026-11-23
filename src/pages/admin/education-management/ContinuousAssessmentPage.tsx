import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Download,
  Layers,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Badge, Button, DatePicker, Input, Modal, MultiSelect, PageHeader, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import {
  buildExamSetupSyncPatch,
  caScopeSubjectKey,
  distFieldKey,
  evaluateCaGrade,
  getCaClasses,
  getCaExamLinks,
  getCaSections,
  getCaTerms,
  GRADING_SCHEMES,
  inspectExamDistribution,
  isCaLinkedToExam,
  matchCaTermForExam,
  mergeActivitiesFromExam,
  normCaSec,
  resolveAllLinkedExams,
  resolveLinkedExamForTerm,
  resolveScopedSubjectMapKey,
  type CaExamLinkEntry,
  type GradingSchemeId,
} from '../../../lib/examCaSync'
import { useTeacherAccess } from '../../../lib/eduTeacherAccess'
import { formatDate, uid } from '../../../lib/utils'

type ActivityDef = {
  id: string
  name: string
  maxScore: number
}

/** scopedSubjectKey (`term::subject` or legacy `subject`) -> studentId -> activityId -> raw numeric string */
type CaScoreMap = Record<string, Record<string, Record<string, string>>>

/** scopedSubjectKey (`term::subject` or legacy `subject`) -> studentId -> { ca: string; exam: string } */
type ClassSheetMap = Record<string, Record<string, { ca: string; exam: string }>>

const CREATE_EXAM_SENTINEL = '__create_exam_setup__'

const cleanValues = (v: unknown[]) => [...new Set(v.map((x) => String(x ?? '').trim()).filter(Boolean))]

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return cleanValues(raw)
  const s = String(raw ?? '').trim()
  if (!s) return []
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p)) return cleanValues(p)
  } catch {
    /* ignore */
  }
  return cleanValues(s.split(/[\n,;]/).map((x) => x.replace(/^\s*[-•]\s*/, '')))
}

function canonicalSectionLabel(raw: string): string {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return ''
  const stripped = trimmed.replace(/^section\s+/i, '').trim()
  return stripped || trimmed
}

function dedupeSections(list: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const label = canonicalSectionLabel(item)
    const key = normCaSec(label)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

function sectionsForClass(records: EduRecords, className: string): string[] {
  const key = className.trim().toLowerCase()
  if (!key) return []
  const raw: string[] = []
  for (const r of records.assignClassSubjects ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    raw.push(...parseJsonArray((r as any).sections ?? (r as any).section))
  }
  for (const r of records.classList ?? []) {
    if (String(r.name ?? r.className ?? '').trim().toLowerCase() !== key) continue
    raw.push(...parseJsonArray((r as any).sections ?? (r as any).section))
  }
  for (const r of (records as any).classSections ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    const v = String(r.section ?? r.name ?? '').trim()
    if (v) raw.push(v)
  }
  for (const st of records.studentList ?? []) {
    const rc = String(st.className ?? '').trim()
    if (rc.toLowerCase().startsWith(key + ' ')) {
      const rest = rc.slice(className.trim().length).trim()
      if (rest) raw.push(rest)
    }
    if (rc.toLowerCase() === key && st.section) raw.push(String(st.section).trim())
  }
  return dedupeSections(raw)
}

function sectionsForClasses(records: EduRecords, classes: string[]): string[] {
  if (!classes.length) return []
  const raw: string[] = []
  for (const cls of classes) {
    raw.push(...sectionsForClass(records, cls))
  }
  // Include global academicSections so schools can apply across any configured section
  for (const sec of (records as any).academicSections ?? []) {
    const nm = String(sec.name ?? sec.section ?? '').trim()
    if (nm) raw.push(nm)
  }
  return dedupeSections(raw)
}

function subjectsForClassSection(records: EduRecords, className: string, section: string): string[] {
  const key = className.trim().toLowerCase()
  const secKey = normCaSec(section)
  const out: string[] = []
  for (const r of records.assignClassSubjects ?? []) {
    if (String(r.className ?? '').trim().toLowerCase() !== key) continue
    const secs = parseJsonArray((r as any).sections ?? (r as any).section)
    if (secKey && secs.length && !secs.some((s) => normCaSec(s) === secKey)) continue
    out.push(...parseJsonArray((r as any).subjects))
  }
  const cleaned = cleanValues(out)
  if (cleaned.length) return cleaned
  return cleanValues((records.subjectList ?? []).map((r: any) => String(r.name ?? r.subject ?? '').trim()))
}

function studentsForClassSection(studentRows: EduRow[], className: string, section: string): EduRow[] {
  const k = className.trim().toLowerCase()
  const sk = normCaSec(section)
  if (!k) return []
  return (studentRows ?? [])
    .filter((r) => {
      const rc = String(r.className ?? '').trim().toLowerCase()
      const rs = normCaSec(String((r as any).section ?? ''))
      if (rc === k) return !sk || !rs || rs === sk
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

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback
  if (typeof raw === 'object') return raw as T
  try {
    const p = JSON.parse(String(raw))
    return (p ?? fallback) as T
  } catch {
    return fallback
  }
}

type AssessmentForm = {
  id?: string
  classes: string[]
  sections: string[]
  terms: string[]
  /** Per-term Exam Setup choice: examSetup.id | CREATE_EXAM_SENTINEL */
  termExamChoices: Record<string, string>
  /** Per-term custom Exam Name when CREATE_EXAM_SENTINEL is chosen */
  termCustomExamNames: Record<string, string>
  academicYear: string
  reopeningDate: string
  gradingScheme: GradingSchemeId
  classScorePct: string
  importExamActivities: boolean
  syncToExamSetup: boolean
}

export function ContinuousAssessmentPage() {
  const { activeBranchId, activeBranch } = useApp() as any
  const branchName = activeBranch?.name
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [records, setRecords] = useState<EduRecords>(() => loadEduRecords(activeBranchId, branchName))
  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId, branchName))
    setActiveAssessmentId(null)
  }, [activeBranchId, branchName])

  const persist = (next: EduRecords) => {
    setRecords(next)
    saveEduRecords(activeBranchId, next)
  }

  // Top-level filters (no Branch filter — active Branch is already set in the global Header)
  const [filterExamId, setFilterExamId] = useState('')
  const [filterTerm, setFilterTerm] = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterSection, setFilterSection] = useState('')

  // Open assessment & active scope inside workspace
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null)
  const [activeScopeTerm, setActiveScopeTerm] = useState('')
  const [activeScopeClass, setActiveScopeClass] = useState('')
  const [activeScopeSection, setActiveScopeSection] = useState('')
  const [workspaceTab, setWorkspaceTab] = useState<'ca' | 'classSheet'>('ca')
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [activeSubject, setActiveSubject] = useState('')

  // Activity inline builder & editor
  const [newActName, setNewActName] = useState('')
  const [newActMax, setNewActMax] = useState('10')
  const [editingActId, setEditingActId] = useState<string | null>(null)
  const [headerEditActId, setHeaderEditActId] = useState<string | null>(null)
  const [headerEditName, setHeaderEditName] = useState('')
  const skipHeaderCommitRef = useRef(false)

  // Local working drafts for open assessment
  const [activitiesDraft, setActivitiesDraft] = useState<ActivityDef[]>([])
  const [scoresDraft, setScoresDraft] = useState<CaScoreMap>({})
  const [classSheetDraft, setClassSheetDraft] = useState<ClassSheetMap>({})

  // Create / Edit Assessment modal & Delete modals
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<EduRow | null>(null)
  const [deleteActTarget, setDeleteActTarget] = useState<ActivityDef | null>(null)

  const examSetupRows = useMemo(() => records.examSetup ?? [], [records.examSetup])
  const teacherScope = useTeacherAccess(records)

  const classOptions = useMemo(() => {
    const all = cleanValues((records.classList ?? []).map((r) => String(r.name ?? r.className ?? '').trim()))
    if (!teacherScope.isTeacher) return all
    return teacherScope.assignedBaseClasses
  }, [records.classList, teacherScope])

  const filterSectionOptions = useMemo(() => {
    if (teacherScope.isTeacher) {
      return filterClass
        ? teacherScope.sectionsForBaseClass(filterClass)
        : cleanValues(teacherScope.assignedPairs.map((p) => p.section).filter(Boolean))
    }
    return filterClass ? sectionsForClass(records, filterClass) : sectionsForClasses(records, classOptions)
  }, [records, filterClass, classOptions, teacherScope])

  const yearOptions = useMemo(() => {
    const yrs = cleanValues((records.academicYear ?? []).map((r) => String(r.name ?? '').trim()))
    return yrs.length ? yrs : ['2026/2027', '2025/2026']
  }, [records.academicYear])

  const activeYearDefault = useMemo(() => {
    const act = (records.academicYear ?? []).find(
      (r) => String(r.status ?? '').toLowerCase() === 'active',
    )
    return String(act?.name ?? yearOptions[0] ?? '2026/2027')
  }, [records.academicYear, yearOptions])

  const termChoices = useMemo(() => {
    const base = ['Term 1', 'Term 2', 'Term 3']
    const extra = cleanValues([
      ...(records.termSemester ?? []).map((r) => String(r.name ?? '').trim()),
      ...examSetupRows.map((r) => String(r.term ?? '').trim()),
    ])
    return cleanValues([...base, ...extra])
  }, [records.termSemester, examSetupRows])

  const defaultExamChoiceForTerm = (tm: string, preferredExam?: EduRow | null): { choice: string; customName: string } => {
    if (preferredExam && (!preferredExam.term || String(preferredExam.term).trim().toLowerCase() === tm.toLowerCase())) {
      return { choice: preferredExam.id, customName: String(preferredExam.examName ?? `${tm} Examination`) }
    }
    const matching = examSetupRows.find(
      (ex) => String(ex.term ?? '').trim().toLowerCase() === tm.toLowerCase(),
    )
    if (matching) {
      return { choice: matching.id, customName: String(matching.examName ?? `${tm} Examination`) }
    }
    return { choice: CREATE_EXAM_SENTINEL, customName: `${tm} Examination` }
  }

  const [form, setForm] = useState<AssessmentForm>({
    classes: [],
    sections: [],
    terms: ['Term 1'],
    termExamChoices: {},
    termCustomExamNames: {},
    academicYear: activeYearDefault,
    reopeningDate: '',
    gradingScheme: 'standard',
    classScorePct: '50',
    importExamActivities: true,
    syncToExamSetup: true,
  })

  const formSectionOptions = useMemo(() => {
    const base = sectionsForClasses(records, form.classes)
    if (!teacherScope.isTeacher) return base
    const teacherSecs = cleanValues(
      form.classes.flatMap((c) => teacherScope.sectionsForBaseClass(c)),
    )
    if (!teacherSecs.length) return base
    const inter = base.filter((s) => teacherSecs.some((ts) => normCaSec(ts) === normCaSec(s)))
    return inter.length ? inter : teacherSecs
  }, [records, form.classes, teacherScope])

  // Selected Exam Setup rows across currently selected Terms in the modal
  const selectedFormExams = useMemo(() => {
    const out: EduRow[] = []
    const seen = new Set<string>()
    for (const tm of form.terms) {
      const ch = form.termExamChoices[tm]
      if (ch && ch !== CREATE_EXAM_SENTINEL) {
        const ex = examSetupRows.find((e) => e.id === ch)
        if (ex && !seen.has(ex.id)) {
          seen.add(ex.id)
          out.push(ex)
        }
      }
    }
    return out
  }, [form.terms, form.termExamChoices, examSetupRows])

  const primaryFormExamInfo = useMemo(
    () => inspectExamDistribution(records, selectedFormExams[0] ?? null),
    [records, selectedFormExams],
  )

  const assessments: EduRow[] = useMemo(
    () => ((records as any).continuousAssessments ?? []) as EduRow[],
    [records],
  )

  const visibleAssessments = useMemo(() => {
    return assessments.filter((a) => {
      if (teacherScope.isTeacher && !teacherScope.filterCaAssessment(a)) return false
      if (filterExamId) {
        const exRow = examSetupRows.find((e) => e.id === filterExamId)
        if (!exRow || !isCaLinkedToExam(records, a, exRow)) return false
      }
      if (filterTerm) {
        const terms = getCaTerms(a)
        if (!terms.some((tm) => tm.toLowerCase() === filterTerm.toLowerCase())) return false
      }
      if (filterClass) {
        const classes = getCaClasses(a)
        if (!classes.some((c) => c.toLowerCase() === filterClass.toLowerCase())) return false
      }
      if (filterSection) {
        const secs = getCaSections(a)
        if (secs.length > 0 && !secs.some((s) => normCaSec(s) === normCaSec(filterSection))) return false
      }
      return true
    })
  }, [assessments, records, examSetupRows, filterExamId, filterTerm, filterClass, filterSection, teacherScope])

  const openAssessment = useMemo(
    () => assessments.find((a) => a.id === activeAssessmentId) ?? null,
    [assessments, activeAssessmentId],
  )

  const openClasses = useMemo(() => {
    const raw = getCaClasses(openAssessment)
    if (!teacherScope.isTeacher) return raw
    return raw.filter((c) =>
      teacherScope.assignedBaseClasses.some((bc) => bc.toLowerCase() === c.toLowerCase()),
    )
  }, [openAssessment, teacherScope])
  const openAllSections = useMemo(() => getCaSections(openAssessment), [openAssessment])
  const openTerms = useMemo(() => getCaTerms(openAssessment), [openAssessment])
  const primaryOpenTerm = openTerms[0] ?? 'Term 1'

  // Sections applicable to the currently selected Class in the open workspace
  const openClassValidSections = useMemo(() => {
    const basePool = (() => {
      if (!activeScopeClass) return openAllSections
      const classSpecific = sectionsForClass(records, activeScopeClass)
      if (!classSpecific.length) return openAllSections
      const intersection = openAllSections.filter((s) =>
        classSpecific.some((cs) => normCaSec(cs) === normCaSec(s)),
      )
      return intersection.length ? intersection : openAllSections
    })()
    if (!teacherScope.isTeacher || !activeScopeClass) return basePool
    const teacherSecs = teacherScope.sectionsForBaseClass(activeScopeClass)
    if (!teacherSecs.length) return basePool
    const scoped = basePool.filter((s) => teacherSecs.some((ts) => normCaSec(ts) === normCaSec(s)))
    return scoped.length ? scoped : teacherSecs
  }, [records, activeScopeClass, openAllSections, teacherScope])

  // Keep activeScopeTerm / activeScopeClass / activeScopeSection valid whenever openAssessment or scope changes
  useEffect(() => {
    if (!openAssessment) return
    if (openTerms.length && (!activeScopeTerm || !openTerms.includes(activeScopeTerm))) {
      setActiveScopeTerm(openTerms[0])
    }
    if (openClasses.length && (!activeScopeClass || !openClasses.includes(activeScopeClass))) {
      setActiveScopeClass(openClasses[0])
    }
  }, [openAssessment, openTerms, openClasses, activeScopeTerm, activeScopeClass])

  useEffect(() => {
    if (!openAssessment) return
    if (
      openClassValidSections.length &&
      (!activeScopeSection ||
        !openClassValidSections.some((s) => normCaSec(s) === normCaSec(activeScopeSection)))
    ) {
      setActiveScopeSection(openClassValidSections[0])
    }
  }, [openAssessment, openClassValidSections, activeScopeSection])

  const openLinkedExam = useMemo(
    () => resolveLinkedExamForTerm(records, openAssessment, activeScopeTerm || primaryOpenTerm),
    [records, openAssessment, activeScopeTerm, primaryOpenTerm],
  )

  const openLinkedExamInfo = useMemo(
    () => inspectExamDistribution(records, openLinkedExam),
    [records, openLinkedExam],
  )

  const openSubjects = useMemo(() => {
    if (!openAssessment || !activeScopeClass) return []
    const allSubs = subjectsForClassSection(records, activeScopeClass, activeScopeSection)
    if (!teacherScope.isTeacher) return allSubs
    return teacherScope.subjectsForClassSection(activeScopeClass, activeScopeSection, allSubs)
  }, [records, openAssessment, activeScopeClass, activeScopeSection, teacherScope])

  const openStudents = useMemo(() => {
    if (!openAssessment || !activeScopeClass) return []
    return studentsForClassSection(records.studentList ?? [], activeScopeClass, activeScopeSection)
  }, [records.studentList, openAssessment, activeScopeClass, activeScopeSection])

  useEffect(() => {
    if (openSubjects.length && (!activeSubject || !openSubjects.includes(activeSubject))) {
      setActiveSubject(openSubjects[0])
    }
  }, [openSubjects, activeSubject])

  // Load drafts when opening an assessment
  const enterAssessment = (
    row: EduRow,
    initialTab: 'ca' | 'classSheet' = 'ca',
    preferredScope?: { term?: string; className?: string; section?: string },
  ) => {
    const acts = parseJsonSafe<ActivityDef[]>(row.activitiesJson, [])
    const sc = parseJsonSafe<CaScoreMap>(row.scoresJson, {})
    const cs = parseJsonSafe<ClassSheetMap>(row.classSheetJson, {})

    const rowTerms = getCaTerms(row)
    const rawRowClasses = getCaClasses(row)
    const rowClasses = teacherScope.isTeacher
      ? rawRowClasses.filter((c) =>
          teacherScope.assignedBaseClasses.some((bc) => bc.toLowerCase() === c.toLowerCase()),
        )
      : rawRowClasses
    const rowSections = getCaSections(row)

    const initTerm =
      (preferredScope?.term && rowTerms.find((t) => t.toLowerCase() === preferredScope.term!.toLowerCase())) ||
      (filterTerm && rowTerms.find((t) => t.toLowerCase() === filterTerm.toLowerCase())) ||
      rowTerms[0] ||
      'Term 1'

    const initClass =
      (preferredScope?.className &&
        rowClasses.find((c) => c.toLowerCase() === preferredScope.className!.toLowerCase())) ||
      (filterClass && rowClasses.find((c) => c.toLowerCase() === filterClass.toLowerCase())) ||
      rowClasses[0] ||
      ''

    const clsSecs = initClass ? sectionsForClass(records, initClass) : []
    const validInitSecs = clsSecs.length
      ? rowSections.filter((s) => clsSecs.some((csx) => normCaSec(csx) === normCaSec(s)))
      : rowSections
    const baseSecPool = validInitSecs.length ? validInitSecs : rowSections
    const teacherInitSecs =
      teacherScope.isTeacher && initClass ? teacherScope.sectionsForBaseClass(initClass) : []
    const secPool =
      teacherInitSecs.length > 0
        ? baseSecPool.filter((s) => teacherInitSecs.some((ts) => normCaSec(ts) === normCaSec(s)))
        : baseSecPool
    const finalSecPool = secPool.length ? secPool : teacherInitSecs

    const initSection =
      (preferredScope?.section &&
        finalSecPool.find((s) => normCaSec(s) === normCaSec(preferredScope.section!))) ||
      (filterSection && finalSecPool.find((s) => normCaSec(s) === normCaSec(filterSection))) ||
      finalSecPool[0] ||
      ''

    const rawSubs = subjectsForClassSection(records, initClass, initSection)
    const subs = teacherScope.isTeacher
      ? teacherScope.subjectsForClassSection(initClass, initSection, rawSubs)
      : rawSubs
    setActivitiesDraft(acts)
    setScoresDraft(sc)
    setClassSheetDraft(cs)
    setActiveScopeTerm(initTerm)
    setActiveScopeClass(initClass)
    setActiveScopeSection(initSection)
    setActiveSubject(subs[0] ?? '')
    setSettingsOpen(acts.length === 0)
    setEditingActId(null)
    setHeaderEditActId(null)
    setHeaderEditName('')
    setDeleteActTarget(null)
    setNewActName('')
    setNewActMax('10')
    setWorkspaceTab(initialTab)
    setActiveAssessmentId(row.id)
  }

  const openCreateModalWithExam = (preferredExam?: EduRow | null) => {
    const defaultCls = filterClass || classOptions[0] || ''
    const initClasses = defaultCls ? [defaultCls] : []
    const baseAvailSecs = sectionsForClasses(records, initClasses)
    const teacherSecs = teacherScope.isTeacher
      ? cleanValues(initClasses.flatMap((c) => teacherScope.sectionsForBaseClass(c)))
      : []
    const availSecs =
      teacherSecs.length > 0
        ? baseAvailSecs.filter((s) => teacherSecs.some((ts) => normCaSec(ts) === normCaSec(s)))
        : baseAvailSecs
    const effectiveAvailSecs = availSecs.length ? availSecs : teacherSecs
    const initSections = filterSection
      ? [canonicalSectionLabel(filterSection)]
      : effectiveAvailSecs.length
        ? [effectiveAvailSecs[0]]
        : []

    const targetExam =
      preferredExam ??
      (filterExamId ? examSetupRows.find((e) => e.id === filterExamId) ?? null : null) ??
      examSetupRows[0] ??
      null

    const distInfo = inspectExamDistribution(records, targetExam)
    const inferredTerm =
      String(targetExam?.term ?? '').trim() || filterTerm || 'Term 1'
    const inferredPct = distInfo.inferredClassScorePct ?? 50

    const initChoices: Record<string, string> = {}
    const initCustomNames: Record<string, string> = {}
    for (const tm of termChoices) {
      const def = defaultExamChoiceForTerm(tm, tm === inferredTerm ? targetExam : null)
      initChoices[tm] = def.choice
      initCustomNames[tm] = def.customName
    }
    if (targetExam) {
      initChoices[inferredTerm] = targetExam.id
      initCustomNames[inferredTerm] = String(targetExam.examName ?? `${inferredTerm} Examination`)
    }

    setForm({
      classes: initClasses,
      sections: initSections,
      terms: [inferredTerm],
      termExamChoices: initChoices,
      termCustomExamNames: initCustomNames,
      academicYear: activeYearDefault,
      reopeningDate: '',
      gradingScheme: 'standard',
      classScorePct: String(inferredPct),
      importExamActivities: true,
      syncToExamSetup: true,
    })
    setModalOpen(true)
  }

  // Handle deep-link from Exam Setup (`?examId=...`)
  useEffect(() => {
    const qExamId = searchParams.get('examId')
    if (!qExamId) return
    const examRow = examSetupRows.find((e) => e.id === qExamId)
    if (!examRow) return

    setFilterExamId(qExamId)
    const matching = assessments.filter((a) => isCaLinkedToExam(records, a, examRow))
    if (matching.length === 1) {
      const matchedTerm = matchCaTermForExam(records, matching[0], examRow) ?? undefined
      enterAssessment(matching[0], 'ca', { term: matchedTerm })
    } else if (matching.length === 0) {
      openCreateModalWithExam(examRow)
    }
    const next = new URLSearchParams(searchParams)
    next.delete('examId')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, examSetupRows])

  const openEditModal = (row: EduRow, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const rowClasses = getCaClasses(row)
    const rowSections = dedupeSections(getCaSections(row))
    const rowTerms = getCaTerms(row)
    const existingLinks = getCaExamLinks(row)

    const choices: Record<string, string> = {}
    const customNames: Record<string, string> = {}
    for (const tm of cleanValues([...termChoices, ...rowTerms])) {
      const linkKey = Object.keys(existingLinks).find(
        (k) => k.trim().toLowerCase() === tm.toLowerCase(),
      )
      const linkEntry = linkKey ? existingLinks[linkKey] : undefined
      const resolved = resolveLinkedExamForTerm(records, row, tm)
      if (resolved) {
        choices[tm] = resolved.id
        customNames[tm] = String(resolved.examName ?? `${tm} Examination`)
      } else if (linkEntry?.examName) {
        choices[tm] = CREATE_EXAM_SENTINEL
        customNames[tm] = linkEntry.examName
      } else {
        const def = defaultExamChoiceForTerm(tm)
        choices[tm] = def.choice
        customNames[tm] = def.customName
      }
    }

    setForm({
      id: row.id,
      classes: rowClasses,
      sections: rowSections,
      terms: rowTerms,
      termExamChoices: choices,
      termCustomExamNames: customNames,
      academicYear: String(row.academicYear ?? activeYearDefault),
      reopeningDate: String(row.reopeningDate ?? ''),
      gradingScheme: (row.gradingScheme as GradingSchemeId) || 'standard',
      classScorePct: String(row.classScorePct ?? '50'),
      importExamActivities: false,
      syncToExamSetup: true,
    })
    setModalOpen(true)
  }

  const handleClassesChange = (nextClasses: string[]) => {
    const availSecs = sectionsForClasses(records, nextClasses)
    let nextSections = form.sections.filter((s) =>
      availSecs.some((as) => normCaSec(as) === normCaSec(s)),
    )
    if (nextClasses.length > 0 && nextSections.length === 0 && availSecs.length > 0) {
      nextSections = [availSecs[0]]
    }
    setForm((prev) => ({
      ...prev,
      classes: nextClasses,
      sections: nextSections,
    }))
  }

  const toggleFormTerm = (tm: string) => {
    setForm((prev) => {
      const exists = prev.terms.some((x) => x.toLowerCase() === tm.toLowerCase())
      const nextTerms = exists
        ? prev.terms.filter((x) => x.toLowerCase() !== tm.toLowerCase())
        : [...prev.terms, tm]

      const nextChoices = { ...prev.termExamChoices }
      const nextCustomNames = { ...prev.termCustomExamNames }
      if (!exists && !nextChoices[tm]) {
        const def = defaultExamChoiceForTerm(tm)
        nextChoices[tm] = def.choice
        nextCustomNames[tm] = def.customName
      }
      return {
        ...prev,
        terms: nextTerms,
        termExamChoices: nextChoices,
        termCustomExamNames: nextCustomNames,
      }
    })
  }

  const handleTermExamChoiceChange = (tm: string, nextChoice: string) => {
    if (nextChoice === CREATE_EXAM_SENTINEL) {
      setForm((prev) => ({
        ...prev,
        termExamChoices: { ...prev.termExamChoices, [tm]: CREATE_EXAM_SENTINEL },
        termCustomExamNames: {
          ...prev.termCustomExamNames,
          [tm]: prev.termCustomExamNames[tm] || `${tm} Examination`,
        },
        syncToExamSetup: true,
      }))
      return
    }
    const ex = examSetupRows.find((r) => r.id === nextChoice)
    if (!ex) return
    const info = inspectExamDistribution(records, ex)
    setForm((prev) => ({
      ...prev,
      termExamChoices: { ...prev.termExamChoices, [tm]: ex.id },
      termCustomExamNames: {
        ...prev.termCustomExamNames,
        [tm]: String(ex.examName ?? `${tm} Examination`),
      },
      classScorePct:
        prev.terms.length === 1 && info.inferredClassScorePct !== null
          ? String(info.inferredClassScorePct)
          : prev.classScorePct,
    }))
  }

  const saveAssessmentMeta = () => {
    if (!form.classes.length) {
      toast.error('Select at least one Class')
      return
    }
    if (formSectionOptions.length > 0 && !form.sections.length) {
      toast.error('Select at least one Section')
      return
    }
    if (!form.terms.length) {
      toast.error('Select at least one Term')
      return
    }
    for (const tm of form.terms) {
      const choice = form.termExamChoices[tm] ?? CREATE_EXAM_SENTINEL
      const custom = (form.termCustomExamNames[tm] ?? '').trim()
      if (choice === CREATE_EXAM_SENTINEL && !custom) {
        toast.error(`Enter Exam Name for ${tm}`)
        return
      }
    }

    const pctNum = Number(form.classScorePct)
    if (!Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100) {
      toast.error('Class Score % must be between 1 and 100')
      return
    }

    let workingRecords: EduRecords = { ...records }
    let nextExamSetup = [...(records.examSetup ?? [])]
    let nextMarkDistribution = [...(records.markDistribution ?? [])]

    // Determine initial or merged activities
    let targetActivities: ActivityDef[] = form.id
      ? parseJsonSafe<ActivityDef[]>(
          assessments.find((r) => r.id === form.id)?.activitiesJson,
          [],
        )
      : []

    if (form.importExamActivities) {
      for (const ex of selectedFormExams) {
        const info = inspectExamDistribution(records, ex)
        targetActivities = mergeActivitiesFromExam(targetActivities, info.concreteActivities)
      }
    }

    // Resolve or create/sync Exam Setup per selected Term
    const examLinksByTerm: Record<string, CaExamLinkEntry> = {}
    for (const tm of form.terms) {
      const choice = form.termExamChoices[tm] ?? defaultExamChoiceForTerm(tm).choice
      const existingEx =
        choice !== CREATE_EXAM_SENTINEL
          ? nextExamSetup.find((e) => e.id === choice) ?? null
          : null

      if (choice === CREATE_EXAM_SENTINEL || form.syncToExamSetup) {
        const desiredName =
          choice === CREATE_EXAM_SENTINEL
            ? (form.termCustomExamNames[tm] ?? '').trim() || `${tm} Examination`
            : String(existingEx?.examName ?? `${tm} Examination`)
        const patch = buildExamSetupSyncPatch(
          {
            ...workingRecords,
            examSetup: nextExamSetup,
            markDistribution: nextMarkDistribution,
          },
          {
            examRow: existingEx,
            desiredExamName: desiredName,
            term: tm,
            caWeightPct: pctNum,
            gradingScheme: form.gradingScheme,
            activities: targetActivities,
          },
        )
        nextExamSetup = patch.examSetup
        nextMarkDistribution = patch.markDistribution
        workingRecords = {
          ...workingRecords,
          examSetup: nextExamSetup,
          markDistribution: nextMarkDistribution,
        }
        examLinksByTerm[tm] = {
          examId: patch.syncedExam.id,
          examName: String(patch.syncedExam.examName ?? ''),
        }
      } else if (existingEx) {
        examLinksByTerm[tm] = {
          examId: existingEx.id,
          examName: String(existingEx.examName ?? ''),
        }
      }
    }

    const primaryTerm = form.terms[0]
    const primaryLink = examLinksByTerm[primaryTerm]
    const allLinkedNames = cleanValues(Object.values(examLinksByTerm).map((v) => v.examName))
    const normalizedSections = dedupeSections(form.sections)

    const sharedFields = {
      examId: primaryLink?.examId ?? '',
      examName: allLinkedNames.join(', '),
      examLinksJson: JSON.stringify(examLinksByTerm),
      className: form.classes.join(', '),
      classesJson: JSON.stringify(form.classes),
      section: normalizedSections.join(', '),
      sectionsJson: JSON.stringify(normalizedSections),
      term: form.terms.join(', '),
      termsJson: JSON.stringify(form.terms),
      academicYear: form.academicYear,
      reopeningDate: form.reopeningDate,
      gradingScheme: form.gradingScheme,
      classScorePct: String(pctNum),
      examScorePct: String(Math.max(0, 100 - pctNum)),
      activitiesJson: JSON.stringify(targetActivities),
    }

    const nextList = [...assessments]
    if (form.id) {
      const idx = nextList.findIndex((r) => r.id === form.id)
      if (idx >= 0) {
        const updatedRow: EduRow = {
          ...nextList[idx],
          ...sharedFields,
        }
        nextList[idx] = updatedRow
        if (activeAssessmentId === updatedRow.id) {
          setActivitiesDraft(targetActivities)
        }
        persist({
          ...records,
          examSetup: nextExamSetup,
          markDistribution: nextMarkDistribution,
          continuousAssessments: nextList,
        } as EduRecords)
        toast.success(
          'Assessment updated',
          `Applied to ${form.classes.length} class${form.classes.length === 1 ? '' : 'es'}, ${normalizedSections.length || 1} section${normalizedSections.length === 1 ? '' : 's'}, ${form.terms.length} term${form.terms.length === 1 ? '' : 's'}.`,
        )
      }
      setModalOpen(false)
      return
    }

    const created: EduRow = {
      id: uid(),
      ...sharedFields,
      scoresJson: '{}',
      classSheetJson: '{}',
      createdAt: new Date().toISOString().slice(0, 10),
    }
    const updated = [created, ...nextList]
    persist({
      ...records,
      examSetup: nextExamSetup,
      markDistribution: nextMarkDistribution,
      continuousAssessments: updated,
    } as EduRecords)
    setModalOpen(false)
    enterAssessment(created, 'ca')
    toast.success(
      'Continuous Assessment created',
      `Applied to ${form.classes.join(', ')}${normalizedSections.length ? ` (Sec ${normalizedSections.join(', ')})` : ''} · ${form.terms.join(', ')}.`,
    )
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    const nextList = assessments.filter((a) => a.id !== deleteTarget.id)
    persist({ ...records, continuousAssessments: nextList } as EduRecords)
    if (activeAssessmentId === deleteTarget.id) setActiveAssessmentId(null)
    toast.success('Assessment deleted')
    setDeleteTarget(null)
  }

  // Persist current open assessment's activities, CA scores & Class Sheet
  const persistOpenWorkspace = (
    nextActs: ActivityDef[],
    nextScores: CaScoreMap,
    nextClassSheet: ClassSheetMap,
    extraPatch?: Partial<EduRecords>,
    rowMetaPatch?: Partial<EduRow>,
  ) => {
    if (!openAssessment) return
    const nextList = assessments.map((a) =>
      a.id === openAssessment.id
        ? {
            ...a,
            ...(rowMetaPatch ?? {}),
            activitiesJson: JSON.stringify(nextActs),
            scoresJson: JSON.stringify(nextScores),
            classSheetJson: JSON.stringify(nextClassSheet),
          }
        : a,
    )
    persist({
      ...records,
      continuousAssessments: nextList,
      ...(extraPatch ?? {}),
    } as EduRecords)
  }

  // Pull Mark Distribution activities, weights, and existing Mark Entries from Exam Setup -> Continuous Assessment
  const handlePullFromExamSetup = () => {
    if (!openAssessment) return
    if (!openLinkedExam) {
      openEditModal(openAssessment)
      toast.error('No Exam linked for this Term', 'Select or create an Exam in Exam Setup to link.')
      return
    }

    const info = inspectExamDistribution(records, openLinkedExam)
    const mergedActs = mergeActivitiesFromExam(activitiesDraft, info.concreteActivities)
    const nextCaPct =
      info.inferredClassScorePct !== null
        ? info.inferredClassScorePct
        : Number(openAssessment.classScorePct ?? 50) || 50
    const nextExamPct = Math.max(0, 100 - nextCaPct)

    const targetExamName = String(openLinkedExam.examName ?? '').trim().toLowerCase()
    const markRows = records.markEntries ?? records.marksEntry ?? []
    const nextScores: CaScoreMap = { ...scoresDraft }
    const nextCs: ClassSheetMap = { ...classSheetDraft }
    const curTerm = activeScopeTerm || primaryOpenTerm
    let pulledMarks = 0

    for (const r of markRows) {
      if (String(r.exam ?? '').trim().toLowerCase() !== targetExamName) continue
      const subj = openSubjects.find(
        (s) => s.trim().toLowerCase() === String(r.subject ?? '').trim().toLowerCase(),
      )
      if (!subj) continue
      const st = openStudents.find(
        (s) => String(s.name ?? '').trim().toLowerCase() === String(r.student ?? '').trim().toLowerCase(),
      )
      if (!st) continue
      const sid = String(st.id)

      const sKey = resolveScopedSubjectMapKey(nextScores, subj, curTerm, primaryOpenTerm)
      const csKey = resolveScopedSubjectMapKey(nextCs, subj, curTerm, primaryOpenTerm)

      const breakdown = parseJsonSafe<Record<string, string>>(r.markBreakdown, {})
      for (const act of mergedActs) {
        const val = breakdown[act.name] ?? (r as any)[distFieldKey(act.name)] ?? ''
        if (String(val).trim() !== '') {
          nextScores[sKey] = {
            ...(nextScores[sKey] ?? {}),
            [sid]: {
              ...(nextScores[sKey]?.[sid] ?? {}),
              [act.id]: String(val),
            },
          }
          pulledMarks++
        }
      }

      const examPart = info.examParts[0]
      const examVal = examPart
        ? breakdown[examPart.name] ?? (r as any)[distFieldKey(examPart.name)] ?? (r as any).exams ?? ''
        : (r as any).exams ?? ''
      const aggCaPart = info.caParts.find((p) => p.isAggregateCa)
      const aggCaVal = aggCaPart
        ? breakdown[aggCaPart.name] ?? (r as any)[distFieldKey(aggCaPart.name)] ?? ''
        : ''

      if (String(examVal).trim() !== '' || String(aggCaVal).trim() !== '') {
        nextCs[csKey] = {
          ...(nextCs[csKey] ?? {}),
          [sid]: {
            ca: String(aggCaVal).trim() !== '' ? String(aggCaVal) : nextCs[csKey]?.[sid]?.ca ?? '',
            exam: String(examVal).trim() !== '' ? String(examVal) : nextCs[csKey]?.[sid]?.exam ?? '',
          },
        }
        pulledMarks++
      }
    }

    setActivitiesDraft(mergedActs)
    setScoresDraft(nextScores)
    setClassSheetDraft(nextCs)
    persistOpenWorkspace(mergedActs, nextScores, nextCs, undefined, {
      classScorePct: String(nextCaPct),
      examScorePct: String(nextExamPct),
    })

    toast.success(
      'Synced from Exam Setup',
      `${openLinkedExam.examName}: ${mergedActs.length} CA activit${mergedActs.length === 1 ? 'y' : 'ies'} (${nextCaPct}% CA / ${nextExamPct}% Exam)${pulledMarks ? ` · ${pulledMarks} mark(s) imported` : ''}.`,
    )
  }

  // Push Continuous Assessment activities & weights -> all linked Exam Setup rows across selected Terms
  const handlePushToExamSetup = () => {
    if (!openAssessment) return
    const caPct = Number(openAssessment.classScorePct ?? 50) || 50
    const scheme = (openAssessment.gradingScheme as GradingSchemeId) || 'standard'
    let nextExamSetup = [...(records.examSetup ?? [])]
    let nextMarkDistribution = [...(records.markDistribution ?? [])]
    const nextLinks: Record<string, CaExamLinkEntry> = { ...getCaExamLinks(openAssessment) }

    for (const tm of openTerms) {
      const exForTerm = resolveLinkedExamForTerm(
        { ...records, examSetup: nextExamSetup },
        openAssessment,
        tm,
      )
      const patch = buildExamSetupSyncPatch(
        { ...records, examSetup: nextExamSetup, markDistribution: nextMarkDistribution },
        {
          examRow: exForTerm,
          desiredExamName: String(exForTerm?.examName ?? '').trim() || `${tm} Examination`,
          term: tm,
          caWeightPct: caPct,
          gradingScheme: scheme,
          activities: activitiesDraft,
        },
      )
      nextExamSetup = patch.examSetup
      nextMarkDistribution = patch.markDistribution
      nextLinks[tm] = {
        examId: patch.syncedExam.id,
        examName: String(patch.syncedExam.examName ?? ''),
      }
    }

    const primaryLink = nextLinks[primaryOpenTerm]
    const allNames = cleanValues(Object.values(nextLinks).map((v) => v.examName))

    persistOpenWorkspace(
      activitiesDraft,
      scoresDraft,
      classSheetDraft,
      {
        examSetup: nextExamSetup,
        markDistribution: nextMarkDistribution,
      },
      {
        examId: primaryLink?.examId ?? '',
        examName: allNames.join(', '),
        examLinksJson: JSON.stringify(nextLinks),
      },
    )

    toast.success(
      'Synced to Exam Setup',
      `Updated ${allNames.join(', ')} (Class Score ${caPct}% + Exam ${100 - caPct}%).`,
    )
  }

  const startEditActivity = (act: ActivityDef) => {
    setSettingsOpen(true)
    setEditingActId(act.id)
    setNewActName(act.name)
    setNewActMax(String(act.maxScore))
  }

  const cancelEditActivity = () => {
    setEditingActId(null)
    setNewActName('')
    setNewActMax('10')
  }

  const buildAutoExamPatchForActivities = (
    _nextActs: ActivityDef[],
    renamed?: { oldName: string; newName: string; newMax: number },
  ): Partial<EduRecords> | undefined => {
    if (!openLinkedExam || !renamed) return undefined
    const distNames = parseJsonArray(openLinkedExam.markDistribution)
    if (!distNames.length) return undefined

    const mdRows = [...(records.markDistribution ?? [])]
    const nextDistNames = [...distNames]
    const idx = nextDistNames.findIndex(
      (n) => n.trim().toLowerCase() === renamed.oldName.trim().toLowerCase(),
    )
    if (idx < 0) return undefined

    nextDistNames[idx] = renamed.newName
    const mdIdx = mdRows.findIndex(
      (m) => String(m.name ?? '').trim().toLowerCase() === renamed.oldName.trim().toLowerCase(),
    )
    if (mdIdx >= 0) {
      mdRows[mdIdx] = {
        ...mdRows[mdIdx],
        name: renamed.newName,
        maxMarks: String(renamed.newMax),
      }
    } else {
      mdRows.push({
        id: uid(),
        name: renamed.newName,
        maxMarks: String(renamed.newMax),
        sortOrder: String(idx + 1),
      })
    }

    const nextExams = (records.examSetup ?? []).map((e) =>
      e.id === openLinkedExam.id
        ? { ...e, markDistribution: JSON.stringify(nextDistNames) }
        : e,
    )
    return {
      examSetup: nextExams,
      markDistribution: mdRows,
    }
  }

  const addOrUpdateActivity = () => {
    const name = newActName.trim()
    const max = Number(newActMax)
    if (!name) {
      toast.error('Enter an activity name (e.g. Class Test 1)')
      return
    }
    if (!Number.isFinite(max) || max <= 0) {
      toast.error('Enter a valid Max Score greater than 0')
      return
    }
    if (
      activitiesDraft.some(
        (a) => a.id !== editingActId && a.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast.error(`"${name}" is already configured`)
      return
    }

    if (editingActId) {
      const prevAct = activitiesDraft.find((a) => a.id === editingActId)
      const nextActs = activitiesDraft.map((a) =>
        a.id === editingActId ? { ...a, name, maxScore: max } : a,
      )
      const autoExamPatch = prevAct
        ? buildAutoExamPatchForActivities(nextActs, {
            oldName: prevAct.name,
            newName: name,
            newMax: max,
          })
        : undefined
      setActivitiesDraft(nextActs)
      setEditingActId(null)
      setNewActName('')
      setNewActMax('10')
      persistOpenWorkspace(nextActs, scoresDraft, classSheetDraft, autoExamPatch)
      toast.success('Activity updated', `${name} (Max: ${max})`)
      return
    }

    const nextActs = [...activitiesDraft, { id: uid(), name, maxScore: max }]
    setActivitiesDraft(nextActs)
    setNewActName('')
    setNewActMax('10')
    persistOpenWorkspace(nextActs, scoresDraft, classSheetDraft)
  }

  const commitHeaderRename = (act: ActivityDef, rawName?: string) => {
    if (skipHeaderCommitRef.current) {
      skipHeaderCommitRef.current = false
      return
    }
    const name = (rawName ?? headerEditName).trim()
    setHeaderEditActId(null)
    setHeaderEditName('')
    if (!name || name === act.name) return
    if (
      activitiesDraft.some(
        (a) => a.id !== act.id && a.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      toast.error(`"${name}" is already configured`)
      return
    }
    const nextActs = activitiesDraft.map((a) => (a.id === act.id ? { ...a, name } : a))
    const autoExamPatch = buildAutoExamPatchForActivities(nextActs, {
      oldName: act.name,
      newName: name,
      newMax: act.maxScore,
    })
    setActivitiesDraft(nextActs)
    if (editingActId === act.id) {
      setNewActName(name)
    }
    persistOpenWorkspace(nextActs, scoresDraft, classSheetDraft, autoExamPatch)
    toast.success('Activity renamed', name)
  }

  const requestDeleteActivity = (act: ActivityDef) => {
    setDeleteActTarget(act)
  }

  const deleteActScoreCount = useMemo(() => {
    if (!deleteActTarget) return 0
    let count = 0
    for (const subjMap of Object.values(scoresDraft)) {
      for (const stMap of Object.values(subjMap ?? {})) {
        if (String(stMap?.[deleteActTarget.id] ?? '').trim() !== '') count++
      }
    }
    return count
  }, [deleteActTarget, scoresDraft])

  const confirmDeleteActivity = () => {
    if (!deleteActTarget) return
    const actId = deleteActTarget.id
    const actName = deleteActTarget.name
    const nextActs = activitiesDraft.filter((a) => a.id !== actId)

    const nextScores: CaScoreMap = {}
    for (const [subj, subjMap] of Object.entries(scoresDraft)) {
      const nextSubjMap: Record<string, Record<string, string>> = {}
      for (const [sid, stMap] of Object.entries(subjMap ?? {})) {
        const copy = { ...(stMap ?? {}) }
        delete copy[actId]
        nextSubjMap[sid] = copy
      }
      nextScores[subj] = nextSubjMap
    }

    let extraPatch: Partial<EduRecords> | undefined
    if (openLinkedExam) {
      const curDist = parseJsonArray(openLinkedExam.markDistribution)
      const filteredDist = curDist.filter(
        (n) => n.trim().toLowerCase() !== actName.trim().toLowerCase(),
      )
      if (filteredDist.length !== curDist.length && filteredDist.length > 0) {
        extraPatch = {
          examSetup: (records.examSetup ?? []).map((e) =>
            e.id === openLinkedExam.id
              ? { ...e, markDistribution: JSON.stringify(filteredDist) }
              : e,
          ),
        }
      }
    }

    setActivitiesDraft(nextActs)
    setScoresDraft(nextScores)
    if (editingActId === actId) cancelEditActivity()
    if (headerEditActId === actId) {
      setHeaderEditActId(null)
      setHeaderEditName('')
    }
    setDeleteActTarget(null)
    persistOpenWorkspace(nextActs, nextScores, classSheetDraft, extraPatch)
    toast.success('Activity deleted', actName)
  }

  const rawTotalMax = useMemo(
    () => activitiesDraft.reduce((sum, a) => sum + (Number(a.maxScore) || 0), 0),
    [activitiesDraft],
  )

  const caWeightPct = Number(openAssessment?.classScorePct ?? 50) || 50
  const examWeightPct = Math.max(0, 100 - caWeightPct)
  const openScheme = (openAssessment?.gradingScheme as GradingSchemeId) || 'standard'

  const computeStudentCaForTerm = (
    term: string,
    subj: string,
    studentId: string,
    scoresSource: CaScoreMap = scoresDraft,
  ) => {
    const sKey = resolveScopedSubjectMapKey(scoresSource, subj, term, primaryOpenTerm)
    const stScores = scoresSource[sKey]?.[studentId] ?? {}
    let hasAny = false
    let rawSum = 0
    for (const act of activitiesDraft) {
      const v = String(stScores[act.id] ?? '').trim()
      if (v !== '') {
        const n = Number(v)
        if (Number.isFinite(n)) {
          hasAny = true
          rawSum += n
        }
      }
    }
    const scaled = rawTotalMax > 0 ? (rawSum / rawTotalMax) * caWeightPct : 0
    return { hasAny, rawSum, scaled }
  }

  const computeStudentCa = (subj: string, studentId: string) =>
    computeStudentCaForTerm(activeScopeTerm || primaryOpenTerm, subj, studentId)

  const getScopedCellScore = (subj: string, studentId: string, actId: string): string => {
    const curTerm = activeScopeTerm || primaryOpenTerm
    const sKey = resolveScopedSubjectMapKey(scoresDraft, subj, curTerm, primaryOpenTerm)
    return scoresDraft[sKey]?.[studentId]?.[actId] ?? ''
  }

  const handleCaScoreChange = (subj: string, studentId: string, act: ActivityDef, rawVal: string) => {
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) return
    if (rawVal !== '') {
      const num = Number(rawVal)
      if (num > act.maxScore) {
        toast.error(
          'Invalid score',
          `Score (${rawVal}) cannot exceed maximum score of ${act.maxScore} for ${act.name}.`,
        )
        return
      }
    }
    const curTerm = activeScopeTerm || primaryOpenTerm
    setScoresDraft((prev) => {
      const sKey =
        openTerms.length > 1
          ? resolveScopedSubjectMapKey(prev, subj, curTerm, primaryOpenTerm) ||
            caScopeSubjectKey(curTerm, subj)
          : resolveScopedSubjectMapKey(prev, subj, curTerm, primaryOpenTerm)
      return {
        ...prev,
        [sKey]: {
          ...(prev[sKey] ?? {}),
          [studentId]: {
            ...(prev[sKey]?.[studentId] ?? {}),
            [act.id]: rawVal,
          },
        },
      }
    })
  }

  const handleSaveCa = () => {
    persistOpenWorkspace(activitiesDraft, scoresDraft, classSheetDraft)
    toast.success(
      'Continuous Assessment saved',
      `${activeScopeTerm} · ${activeScopeClass}${activeScopeSection ? ` (${activeScopeSection})` : ''} · ${activeSubject || 'All subjects'}`,
    )
  }

  // Sync computed CA scores across ALL configured Terms, Classes, and Sections into Class Sheet & Terminal Mark Entries
  const handleApplyToTerminal = () => {
    if (!openAssessment) return
    if (!activitiesDraft.length && workspaceTab === 'ca') {
      toast.error('Add at least one CA activity first')
      return
    }

    const nextClassSheet: ClassSheetMap = { ...classSheetDraft }
    const termsToProcess = openTerms.length ? openTerms : ['Term 1']
    const classesToProcess = openClasses
    const sectionsPool = openAllSections.length ? openAllSections : ['']

    // 1. Update Class Sheet across all (term, class, section, subject, student) combinations
    if (activitiesDraft.length > 0) {
      for (const tm of termsToProcess) {
        for (const cls of classesToProcess) {
          const clsSecs = sectionsForClass(records, cls)
          const effectiveSecs = clsSecs.length
            ? sectionsPool.filter((s) => !s || clsSecs.some((cs) => normCaSec(cs) === normCaSec(s)))
            : sectionsPool
          const targetSecs = effectiveSecs.length ? effectiveSecs : ['']

          for (const sec of targetSecs) {
            if (teacherScope.isTeacher && !teacherScope.matchesClassSection(cls, sec)) continue
            const rawSubs = subjectsForClassSection(records, cls, sec)
            const subs = teacherScope.isTeacher
              ? teacherScope.subjectsForClassSection(cls, sec, rawSubs)
              : rawSubs
            const sts = studentsForClassSection(records.studentList ?? [], cls, sec)
            for (const subj of subs) {
              const csKey =
                termsToProcess.length > 1
                  ? resolveScopedSubjectMapKey(nextClassSheet, subj, tm, primaryOpenTerm) ||
                    caScopeSubjectKey(tm, subj)
                  : resolveScopedSubjectMapKey(nextClassSheet, subj, tm, primaryOpenTerm)
              const subjMap = { ...(nextClassSheet[csKey] ?? {}) }
              for (const st of sts) {
                const sid = String(st.id)
                const { hasAny, scaled } = computeStudentCaForTerm(tm, subj, sid)
                if (hasAny) {
                  subjMap[sid] = {
                    ca: Number(scaled.toFixed(2)).toString(),
                    exam: subjMap[sid]?.exam ?? '',
                  }
                }
              }
              nextClassSheet[csKey] = subjMap
            }
          }
        }
      }
      setClassSheetDraft(nextClassSheet)
    }

    // 2. Sync each Term's linked Exam Setup & push student marks to Mark Entries
    let nextExamSetup = [...(records.examSetup ?? [])]
    let nextMarkDistribution = [...(records.markDistribution ?? [])]
    const nextLinks: Record<string, CaExamLinkEntry> = { ...getCaExamLinks(openAssessment) }

    const existingMarks: EduRow[] = [...(records.markEntries ?? records.marksEntry ?? [])]
    const idxByKey = new Map<string, number>()
    existingMarks.forEach((r, idx) => {
      const k = `${String(r.exam ?? '').trim().toLowerCase()}|${String(r.student ?? '').trim().toLowerCase()}|${String(r.subject ?? '').trim().toLowerCase()}`
      idxByKey.set(k, idx)
    })

    let syncedCount = 0
    for (const tm of termsToProcess) {
      const curLinked = resolveLinkedExamForTerm(
        { ...records, examSetup: nextExamSetup },
        openAssessment,
        tm,
      )
      const synced = buildExamSetupSyncPatch(
        { ...records, examSetup: nextExamSetup, markDistribution: nextMarkDistribution },
        {
          examRow: curLinked,
          desiredExamName: String(curLinked?.examName ?? '').trim() || `${tm} Examination`,
          term: tm,
          caWeightPct,
          gradingScheme: openScheme,
          activities: activitiesDraft,
        },
      )
      nextExamSetup = synced.examSetup
      nextMarkDistribution = synced.markDistribution
      const targetExam = synced.syncedExam
      const targetExamName = String(targetExam.examName ?? `${tm} Examination`).trim()
      nextLinks[tm] = { examId: targetExam.id, examName: targetExamName }

      for (const cls of classesToProcess) {
        const clsSecs = sectionsForClass(records, cls)
        const effectiveSecs = clsSecs.length
          ? sectionsPool.filter((s) => !s || clsSecs.some((cs) => normCaSec(cs) === normCaSec(s)))
          : sectionsPool
        const targetSecs = effectiveSecs.length ? effectiveSecs : ['']

        for (const sec of targetSecs) {
          if (teacherScope.isTeacher && !teacherScope.matchesClassSection(cls, sec)) continue
          const rawSubs = subjectsForClassSection(records, cls, sec)
          const subs = teacherScope.isTeacher
            ? teacherScope.subjectsForClassSection(cls, sec, rawSubs)
            : rawSubs
          const sts = studentsForClassSection(records.studentList ?? [], cls, sec)
          for (const subj of subs) {
            const csKey = resolveScopedSubjectMapKey(nextClassSheet, subj, tm, primaryOpenTerm)
            for (const st of sts) {
              const sid = String(st.id)
              const cell = nextClassSheet[csKey]?.[sid]
              if (!cell || (cell.ca === '' && cell.exam === '')) continue

              const sName = String(st.name ?? '').trim()
              const key = `${targetExamName.toLowerCase()}|${sName.toLowerCase()}|${subj.toLowerCase()}`
              const existingIdx = idxByKey.get(key)
              const prevRow = existingIdx !== undefined ? existingMarks[existingIdx] : undefined
              const prevBreakdown = parseJsonSafe<Record<string, string>>(prevRow?.markBreakdown, {})

              const caVal = Number(cell.ca || 0)
              const fallbackPrevExam =
                prevBreakdown.Exam ??
                prevBreakdown.Exams ??
                (prevRow as any)?.exam ??
                prevRow?.exams ??
                ''
              const effectiveExamStr = cell.exam !== '' ? cell.exam : String(fallbackPrevExam ?? '')
              const exVal = Number(effectiveExamStr || 0)

              const total = Number((caVal + exVal).toFixed(2))
              const evalRes = evaluateCaGrade(total, openScheme)

              const breakdown: Record<string, string> = {
                ...prevBreakdown,
                'Class Score': String(caVal),
                ...(effectiveExamStr !== '' ? { Exam: String(exVal) } : {}),
              }

              const payload: EduRow = {
                id: prevRow?.id ?? uid(),
                exam: targetExamName,
                className: cls,
                section: sec,
                student: sName,
                admissionNo: String(st.admissionNo ?? ''),
                rollNo: String(st.rollNo ?? ''),
                subject: subj,
                classScore: String(caVal),
                classWork: String(caVal),
                examScore: effectiveExamStr !== '' ? String(exVal) : '',
                exams: effectiveExamStr !== '' ? String(exVal) : '',
                marks: String(total),
                maxMarks: '100',
                grade: evalRes.grade,
                markBreakdown: JSON.stringify(breakdown),
              }

              if (existingIdx !== undefined) {
                existingMarks[existingIdx] = { ...prevRow, ...payload, id: prevRow!.id }
              } else {
                existingMarks.push(payload)
                idxByKey.set(key, existingMarks.length - 1)
              }
              syncedCount++
            }
          }
        }
      }
    }

    const primaryLink = nextLinks[primaryOpenTerm]
    const allNames = cleanValues(Object.values(nextLinks).map((v) => v.examName))

    persistOpenWorkspace(
      activitiesDraft,
      scoresDraft,
      nextClassSheet,
      {
        examSetup: nextExamSetup,
        markDistribution: nextMarkDistribution,
        markEntries: existingMarks,
        marksEntry: existingMarks,
      },
      {
        examId: primaryLink?.examId ?? '',
        examName: allNames.join(', '),
        examLinksJson: JSON.stringify(nextLinks),
      },
    )

    toast.success(
      'Synced with Terminal Exam & Mark Entries',
      `${syncedCount} student-subject score(s) applied across ${allNames.join(', ')}.`,
    )
  }

  const getScopedClassSheetCell = (subj: string, studentId: string): { ca: string; exam: string } => {
    const curTerm = activeScopeTerm || primaryOpenTerm
    const csKey = resolveScopedSubjectMapKey(classSheetDraft, subj, curTerm, primaryOpenTerm)
    return classSheetDraft[csKey]?.[studentId] ?? { ca: '', exam: '' }
  }

  const setClassSheetCell = (subj: string, studentId: string, field: 'ca' | 'exam', rawVal: string) => {
    if (rawVal !== '' && !/^\d*\.?\d*$/.test(rawVal)) return
    const maxAllowed = field === 'ca' ? caWeightPct : examWeightPct
    if (rawVal !== '' && Number(rawVal) > maxAllowed) {
      toast.error(
        'Invalid score',
        `${field === 'ca' ? 'Class Score' : 'Exam Score'} (${rawVal}) cannot exceed ${maxAllowed}%.`,
      )
      return
    }
    const curTerm = activeScopeTerm || primaryOpenTerm
    setClassSheetDraft((prev) => {
      const csKey =
        openTerms.length > 1
          ? resolveScopedSubjectMapKey(prev, subj, curTerm, primaryOpenTerm) ||
            caScopeSubjectKey(curTerm, subj)
          : resolveScopedSubjectMapKey(prev, subj, curTerm, primaryOpenTerm)
      return {
        ...prev,
        [csKey]: {
          ...(prev[csKey] ?? {}),
          [studentId]: {
            ca: prev[csKey]?.[studentId]?.ca ?? '',
            exam: prev[csKey]?.[studentId]?.exam ?? '',
            [field]: rawVal,
          },
        },
      }
    })
  }

  const importCurrentSubjectFromCa = () => {
    if (!activeSubject) return
    const curTerm = activeScopeTerm || primaryOpenTerm
    const csKey =
      openTerms.length > 1
        ? resolveScopedSubjectMapKey(classSheetDraft, activeSubject, curTerm, primaryOpenTerm) ||
          caScopeSubjectKey(curTerm, activeSubject)
        : resolveScopedSubjectMapKey(classSheetDraft, activeSubject, curTerm, primaryOpenTerm)

    const subjMap = { ...(classSheetDraft[csKey] ?? {}) }
    let count = 0
    for (const st of openStudents) {
      const sid = String(st.id)
      const { hasAny, scaled } = computeStudentCa(activeSubject, sid)
      if (hasAny) {
        subjMap[sid] = {
          ca: Number(scaled.toFixed(2)).toString(),
          exam: subjMap[sid]?.exam ?? '',
        }
        count++
      }
    }
    const nextCs = { ...classSheetDraft, [csKey]: subjMap }
    setClassSheetDraft(nextCs)
    persistOpenWorkspace(activitiesDraft, scoresDraft, nextCs)
    toast.success(
      'Imported CA scores',
      `${count} student score(s) imported into ${activeSubject} (${curTerm}, ${caWeightPct}%)`,
    )
  }

  const formCaPctNum = Math.max(0, Math.min(100, Number(form.classScorePct) || 0))
  const formExamPctNum = Math.max(0, 100 - formCaPctNum)

  return (
    <div className="space-y-5">
      {/* Breadcrumb + Header */}
      <div>
        <div className="mb-1 flex items-center gap-1 text-xs text-mist">
          <span>Administration</span>
          <span>/</span>
          <span>Education Management</span>
          <span>/</span>
          <span>Examinations</span>
          <span>/</span>
          <span className="font-semibold text-inherit">Continuous Assessment</span>
        </div>
        <PageHeader
          title="Continuous Assessment"
          desc={
            teacherScope.isTeacher
              ? `${teacherScope.teacherName} · Classes: ${teacherScope.assignedClassLabels.join(', ') || 'None'} · Subjects: ${teacherScope.assignedSubjects.join(', ') || 'Assigned'}`
              : `Examinations · ${branchName ?? 'Branch'} — Linked with Exam Setup, Mark Distribution, and Terminal Mark Entries`
          }
          actions={
            !openAssessment ? (
              <div className="flex flex-wrap items-center gap-2">
                {!teacherScope.isTeacher && (
                  <Link
                    to="/admin/education-management/examinations/exam-setup"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <Link2 className="size-3.5" /> Exam Setup
                  </Link>
                )}
                <Button
                  variant="primary"
                  onClick={() => openCreateModalWithExam()}
                  className="h-9 gap-2 rounded-lg px-4 text-xs font-bold"
                >
                  <Plus className="size-4" /> New Assessment
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>

      {/* =====================================================================
          VIEW 1: ASSESSMENTS OVERVIEW (when no individual sheet is open)
         ===================================================================== */}
      {!openAssessment && (
        <>
          {/* Exam / Term / Class / Section filter bar */}
          <div className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b-2 border-amber-400 bg-zinc-50/80 px-4 py-2.5 text-sm font-bold text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
              <span>Filter Assessments</span>
              <span className="text-xs font-normal text-mist">
                Showing <b className="text-zinc-900 dark:text-zinc-100">{visibleAssessments.length}</b> assessment
                {visibleAssessments.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <span>Exam (Exam Setup)</span>
                <Select value={filterExamId} onChange={(e) => setFilterExamId(e.target.value)}>
                  <option value="">All Exams</option>
                  {examSetupRows.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {String(ex.examName ?? '')}
                      {ex.term ? ` (${ex.term})` : ''}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <span>Term</span>
                <Select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}>
                  <option value="">All Terms</option>
                  {termChoices.map((tm) => (
                    <option key={tm} value={tm}>
                      {tm}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <span>Class</span>
                <Select
                  value={filterClass}
                  onChange={(e) => {
                    setFilterClass(e.target.value)
                    setFilterSection('')
                  }}
                >
                  <option value="">All Classes</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <span>Section</span>
                <Select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  <option value="">All Sections</option>
                  {filterSectionOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          {/* Empty state vs Cards Grid */}
          {visibleAssessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-16 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-3 grid size-12 place-items-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                <ClipboardList className="size-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No assessments yet</h3>
              <p className="mt-1 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
                Create a Continuous Assessment across one or multiple Classes, Sections, and Terms — linked directly
                with Exam Setup and Terminal Mark Entries.
              </p>
              <Button
                variant="outline"
                onClick={() => openCreateModalWithExam()}
                className="mt-5 h-9 gap-2 rounded-lg px-4 text-xs"
              >
                <Plus className="size-4" /> Create First Assessment
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleAssessments.map((row) => {
                const acts = parseJsonSafe<ActivityDef[]>(row.activitiesJson, [])
                const rawMax = acts.reduce((s, a) => s + (Number(a.maxScore) || 0), 0)
                const caPct = Number(row.classScorePct ?? 50) || 50
                const exPct = Math.max(0, 100 - caPct)
                const schemeMeta =
                  GRADING_SCHEMES.find((g) => g.id === row.gradingScheme) ?? GRADING_SCHEMES[0]

                const rawRowClasses = getCaClasses(row)
                const rowClasses = teacherScope.isTeacher
                  ? rawRowClasses.filter((c) =>
                      teacherScope.assignedBaseClasses.some((bc) => bc.toLowerCase() === c.toLowerCase()),
                    )
                  : rawRowClasses
                const isSharedOutsideTeacherScope =
                  teacherScope.isTeacher && rawRowClasses.length > rowClasses.length
                const rowSections = getCaSections(row)
                const rowTerms = getCaTerms(row)
                const linkedExams = resolveAllLinkedExams(records, row)

                // Aggregate unique subjects & students across configured classes/sections
                const subjSet = new Set<string>()
                const studentIdSet = new Set<string>()
                for (const cls of rowClasses) {
                  const clsSecs = sectionsForClass(records, cls)
                  const matchingSecs = clsSecs.length
                    ? rowSections.filter((s) => clsSecs.some((cs) => normCaSec(cs) === normCaSec(s)))
                    : rowSections
                  const secsToCheck = matchingSecs.length ? matchingSecs : ['']
                  for (const sec of secsToCheck) {
                    if (teacherScope.isTeacher && !teacherScope.matchesClassSection(cls, sec)) continue
                    const rawSubs = subjectsForClassSection(records, cls, sec)
                    const scopedSubs = teacherScope.isTeacher
                      ? teacherScope.subjectsForClassSection(cls, sec, rawSubs)
                      : rawSubs
                    scopedSubs.forEach((sb) => subjSet.add(sb))
                    studentsForClassSection(records.studentList ?? [], cls, sec).forEach((st) =>
                      studentIdSet.add(String(st.id)),
                    )
                  }
                }

                return (
                  <div
                    key={row.id}
                    onClick={() => enterAssessment(row, 'ca')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        enterAssessment(row, 'ca')
                      }
                    }}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-xs transition hover:border-amber-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-amber-400/70"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rowTerms.map((tm) => (
                              <span
                                key={tm}
                                className="rounded-md bg-zinc-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-white dark:text-zinc-900"
                              >
                                {tm}
                              </span>
                            ))}
                            <Badge tone="zinc">{String(row.academicYear ?? '')}</Badge>
                          </div>

                          <p className="mt-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {rowClasses.join(', ')}
                            {rowSections.length > 0
                              ? ` · Section${rowSections.length > 1 ? 's' : ''}: ${rowSections.join(', ')}`
                              : ''}
                          </p>
                        </div>

                        {!isSharedOutsideTeacherScope && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              aria-label="Edit assessment settings"
                              title="Edit classes, sections, terms & exam link"
                              onClick={(e) => openEditModal(row, e)}
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Delete assessment"
                              onClick={() => setDeleteTarget(row)}
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Linked Exam Setup Pill(s) */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {linkedExams.length > 0 ? (
                          linkedExams.map((ex) => (
                            <span
                              key={ex.id}
                              className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
                            >
                              <Link2 className="size-3" />
                              {String(ex.examName ?? '')}
                            </span>
                          ))
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                            <Link2 className="size-3" />
                            {String(row.examName || 'Unlinked Exam')}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          Class: {caPct}% · Exam: {exPct}%
                        </span>
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {schemeMeta.short}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <div>
                          {acts.length} CA activit{acts.length === 1 ? 'y' : 'ies'}
                          {rawMax > 0 ? ` (Raw Max: ${rawMax})` : ''} · {subjSet.size} subject
                          {subjSet.size === 1 ? '' : 's'} · {studentIdSet.size} student
                          {studentIdSet.size === 1 ? '' : 's'}
                        </div>
                        {row.reopeningDate && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <Calendar className="size-3" /> Reopening: {formatDate(row.reopeningDate)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs font-semibold dark:border-zinc-800">
                      <span className="text-zinc-700 group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-white">
                        Open CA Sheet →
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          enterAssessment(row, 'classSheet')
                        }}
                        className="rounded-md border border-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Class Assessment
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          VIEW 2: OPEN ASSESSMENT WORKSPACE (Continuous Assessment + Class Sheet)
         ===================================================================== */}
      {openAssessment && (
        <div className="space-y-4">
          {/* Workspace Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveAssessmentId(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="size-3.5" /> Back
              </button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {activeScopeClass}
                    {activeScopeSection ? ` (${activeScopeSection})` : ''} —{' '}
                    {workspaceTab === 'ca' ? 'CA' : 'Assessment Sheet'}
                  </h2>
                  <Badge tone="zinc">
                    {activeScopeTerm} · {String(openAssessment.academicYear)}
                  </Badge>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                    Class {caWeightPct}% / Exam {examWeightPct}%
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditModal(openAssessment)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    title="Edit classes, sections, terms, and grading settings"
                  >
                    <Pencil className="size-3" /> Edit Scope
                  </button>
                </div>
              </div>
            </div>

            {/* Switch between Continuous Assessment & auto-created Class Assessment Sheet */}
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100/70 p-1 dark:border-zinc-700 dark:bg-zinc-800/80">
              <button
                type="button"
                onClick={() => setWorkspaceTab('ca')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  workspaceTab === 'ca'
                    ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
                }`}
              >
                Continuous Assessment
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('classSheet')}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-bold transition ${
                  workspaceTab === 'classSheet'
                    ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
                }`}
              >
                Class Assessment Sheet
              </button>
            </div>
          </div>

          {/* Multi-Term / Multi-Class / Multi-Section Active Scope Switcher Bar */}
          {(openTerms.length > 1 || openClasses.length > 1 || openClassValidSections.length > 1) && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-400/35 bg-amber-50/50 px-4 py-2.5 text-xs dark:border-amber-500/25 dark:bg-amber-950/15">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <Layers className="size-3.5" />
                <span>Active Sheet:</span>
              </div>

              {openTerms.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Term:
                  </span>
                  {openTerms.map((tm) => {
                    const active = tm === activeScopeTerm
                    return (
                      <button
                        key={tm}
                        type="button"
                        onClick={() => setActiveScopeTerm(tm)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          active
                            ? 'bg-zinc-900 text-white shadow-2xs dark:bg-white dark:text-zinc-900'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {tm}
                      </button>
                    )
                  })}
                </div>
              )}

              {openClasses.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Class:
                  </span>
                  {openClasses.map((cls) => {
                    const active = cls === activeScopeClass
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setActiveScopeClass(cls)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          active
                            ? 'bg-amber-500 text-zinc-950 shadow-2xs'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {cls}
                      </button>
                    )
                  })}
                </div>
              )}

              {openClassValidSections.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Section:
                  </span>
                  {openClassValidSections.map((sec) => {
                    const active = normCaSec(sec) === normCaSec(activeScopeSection)
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setActiveScopeSection(sec)}
                        className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-bold transition ${
                          active
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {sec}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Exam Setup Link & Bidirectional Sync Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-2.5 text-xs dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
            <div className="flex flex-wrap items-center gap-2">
              <Link2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                Exam Setup ({activeScopeTerm}):{' '}
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  {openLinkedExam ? String(openLinkedExam.examName) : 'Not linked yet'}
                </span>
              </span>
              {openLinkedExam && openLinkedExamInfo.allParts.length > 0 && (
                <span className="text-[11px] text-zinc-600 dark:text-zinc-300">
                  · Distribution:{' '}
                  {openLinkedExamInfo.allParts
                    .map((p) => `${p.name}${p.maxMarks ? ` (${p.maxMarks})` : ''}`)
                    .join(' + ')}
                </span>
              )}
              <button
                type="button"
                onClick={() => openEditModal(openAssessment)}
                className="cursor-pointer font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                Change Exam / Scope
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handlePullFromExamSetup}
                title="Import Mark Distribution activities, CA/Exam weights, and existing Mark Entries from Exam Setup"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px]"
              >
                <Download className="size-3" /> Pull from Exam Setup
              </Button>
              <Button
                variant="outline"
                onClick={handlePushToExamSetup}
                title="Update Exam Setup & Mark Distribution with this Continuous Assessment's activities and CA/Exam split"
                className="h-7 gap-1.5 rounded-lg px-2.5 text-[11px]"
              >
                <RefreshCw className="size-3" /> Sync to Exam Setup
              </Button>
            </div>
          </div>

          {/* ---------------------------------------------------------------
              TAB A: CONTINUOUS ASSESSMENT (Activities + Subject Pills + Grid)
             --------------------------------------------------------------- */}
          {workspaceTab === 'ca' && (
            <>
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((o) => !o)}
                  className="flex w-full cursor-pointer items-center justify-between border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 text-left dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Settings className="size-4 text-zinc-500" />
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100">
                      Activity Types &amp; Settings
                    </span>
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      ({activitiesDraft.length} configured)
                    </span>
                    {rawTotalMax > 0 && (
                      <span className="rounded bg-zinc-200/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        Raw Total Max: {rawTotalMax} → Scaled to {caWeightPct}% Class Score
                      </span>
                    )}
                  </div>
                  {settingsOpen ? (
                    <ChevronUp className="size-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="size-4 text-zinc-400" />
                  )}
                </button>

                {settingsOpen && (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="grid min-w-[200px] flex-1 gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:max-w-xs">
                        <span>{editingActId ? 'Edit Activity Name' : 'Activity Name'}</span>
                        <Input
                          value={newActName}
                          onChange={(e) => setNewActName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addOrUpdateActivity()
                            } else if (e.key === 'Escape' && editingActId) {
                              e.preventDefault()
                              cancelEditActivity()
                            }
                          }}
                          placeholder="e.g. Class Test 1, Home Work, Project Work"
                          className="h-9 text-xs font-normal tracking-normal normal-case"
                        />
                      </label>

                      <label className="grid w-28 gap-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        <span>Max Score</span>
                        <Input
                          type="number"
                          min="1"
                          value={newActMax}
                          onChange={(e) => setNewActMax(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              addOrUpdateActivity()
                            } else if (e.key === 'Escape' && editingActId) {
                              e.preventDefault()
                              cancelEditActivity()
                            }
                          }}
                          placeholder="10"
                          className="h-9 text-center text-xs font-semibold tracking-normal normal-case"
                        />
                      </label>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="primary"
                          onClick={addOrUpdateActivity}
                          className="h-9 gap-1.5 rounded-lg px-4 text-xs font-bold"
                        >
                          {editingActId ? (
                            <>
                              <Check className="size-3.5" /> Update
                            </>
                          ) : (
                            <>
                              <Plus className="size-3.5" /> Add
                            </>
                          )}
                        </Button>
                        {editingActId && (
                          <Button
                            variant="outline"
                            onClick={cancelEditActivity}
                            className="h-9 rounded-lg px-3 text-xs"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    {activitiesDraft.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {activitiesDraft.map((act) => {
                          const isEditing = editingActId === act.id
                          return (
                            <span
                              key={act.id}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                                isEditing
                                  ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200'
                                  : 'border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => startEditActivity(act)}
                                title="Click to edit activity name or max score"
                                className="cursor-pointer text-left hover:underline"
                              >
                                {act.name}{' '}
                                <span className="text-zinc-500 dark:text-zinc-400">({act.maxScore})</span>
                              </button>
                              <button
                                type="button"
                                aria-label={`Edit ${act.name}`}
                                title={`Edit ${act.name}`}
                                onClick={() => startEditActivity(act)}
                                className="ml-0.5 cursor-pointer rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                              >
                                <Pencil className="size-3" />
                              </button>
                              <button
                                type="button"
                                aria-label={`Delete ${act.name}`}
                                title={`Delete ${act.name}`}
                                onClick={() => requestDeleteActivity(act)}
                                className="cursor-pointer rounded-full p-0.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-rose-600 dark:hover:bg-zinc-700 dark:hover:text-rose-400"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Horizontal Subject Pill Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                {openSubjects.map((subj) => {
                  const isActive = subj === activeSubject
                  const scoredStudents = openStudents.filter(
                    (st) => computeStudentCa(subj, String(st.id)).hasAny,
                  ).length
                  return (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setActiveSubject(subj)}
                      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                        isActive
                          ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                          : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <span>{subj}</span>
                      {scoredStudents > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                            isActive
                              ? 'bg-white/20 text-white dark:bg-zinc-900/15 dark:text-zinc-900'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {scoredStudents}/{openStudents.length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* CA Scores Grid */}
              {activitiesDraft.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center dark:border-zinc-700 dark:bg-zinc-900">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">No CA activities yet</p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="cursor-pointer text-xs font-semibold text-amber-600 underline underline-offset-2 dark:text-amber-400"
                    >
                      Open settings above to add an activity
                    </button>
                    {openLinkedExam && openLinkedExamInfo.concreteActivities.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePullFromExamSetup}
                        className="cursor-pointer text-xs font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
                      >
                        or pull {openLinkedExamInfo.concreteActivities.length} activit
                        {openLinkedExamInfo.concreteActivities.length === 1 ? 'y' : 'ies'} from{' '}
                        {openLinkedExam.examName}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50/90 text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-300">
                          <th className="px-4 py-3 text-left">Student</th>
                          {activitiesDraft.map((act) => {
                            const isInlineEditing = headerEditActId === act.id
                            return (
                              <th key={act.id} className="min-w-[140px] px-3 py-2.5 text-center">
                                {isInlineEditing ? (
                                  <div className="mx-auto flex max-w-[170px] items-center gap-1 normal-case tracking-normal">
                                    <Input
                                      autoFocus
                                      value={headerEditName}
                                      onChange={(e) => setHeaderEditName(e.target.value)}
                                      onFocus={(e) => e.currentTarget.select()}
                                      onBlur={(e) => commitHeaderRename(act, e.currentTarget.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          e.currentTarget.blur()
                                        } else if (e.key === 'Escape') {
                                          e.preventDefault()
                                          skipHeaderCommitRef.current = true
                                          setHeaderEditActId(null)
                                          setHeaderEditName('')
                                        }
                                      }}
                                      className="h-7 px-2 text-center text-xs font-semibold"
                                    />
                                  </div>
                                ) : (
                                  <div className="group/act inline-flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      title="Click to edit Activity Name"
                                      onClick={() => {
                                        setHeaderEditActId(act.id)
                                        setHeaderEditName(act.name)
                                      }}
                                      className="cursor-pointer uppercase hover:text-zinc-900 hover:underline dark:hover:text-white"
                                    >
                                      {act.name}
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Rename ${act.name}`}
                                      title={`Edit ${act.name}`}
                                      onClick={() => {
                                        setHeaderEditActId(act.id)
                                        setHeaderEditName(act.name)
                                      }}
                                      className="cursor-pointer rounded p-0.5 text-zinc-400 opacity-75 transition hover:bg-zinc-200/70 hover:text-zinc-700 group-hover/act:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                                    >
                                      <Pencil className="size-3" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Delete ${act.name}`}
                                      title={`Delete ${act.name}`}
                                      onClick={() => requestDeleteActivity(act)}
                                      className="cursor-pointer rounded p-0.5 text-zinc-400 opacity-75 transition hover:bg-rose-100 hover:text-rose-600 group-hover/act:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </div>
                                )}
                                <div className="mt-0.5 text-[10px] font-medium text-zinc-400">MAX: {act.maxScore}</div>
                              </th>
                            )
                          })}
                          <th className="w-28 bg-zinc-100/70 px-3 py-2.5 text-center dark:bg-zinc-800">
                            <div>Total</div>
                            <div className="mt-0.5 text-[10px] font-medium text-zinc-400">MAX: {rawTotalMax}</div>
                          </th>
                          {rawTotalMax !== caWeightPct && (
                            <th className="w-28 bg-amber-50/70 px-3 py-2.5 text-center dark:bg-amber-950/20">
                              <div>Class Score</div>
                              <div className="mt-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {caWeightPct}%
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {openStudents.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + activitiesDraft.length}
                              className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                            >
                              <Users className="mx-auto mb-2 size-7 opacity-40" />
                              No students enrolled in <b>{activeScopeClass}</b>
                              {activeScopeSection ? (
                                <>
                                  {' '}
                                  (Section <b>{activeScopeSection}</b>)
                                </>
                              ) : null}
                              .
                            </td>
                          </tr>
                        ) : (
                          openStudents.map((st) => {
                            const sid = String(st.id)
                            const { hasAny, rawSum, scaled } = computeStudentCa(activeSubject, sid)
                            return (
                              <tr
                                key={sid}
                                className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/60 dark:border-zinc-800/70 dark:hover:bg-white/[0.02]"
                              >
                                <td className="px-4 py-2.5">
                                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                                    {String(st.name ?? '—')}
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    {String(st.admissionNo ?? '')}
                                    {st.rollNo ? ` · Roll ${st.rollNo}` : ''}
                                  </div>
                                </td>

                                {activitiesDraft.map((act) => {
                                  const cellVal = getScopedCellScore(activeSubject, sid, act.id)
                                  return (
                                    <td key={act.id} className="px-3 py-2 text-center">
                                      <Input
                                        value={cellVal}
                                        inputMode="decimal"
                                        placeholder="—"
                                        onChange={(e) =>
                                          handleCaScoreChange(activeSubject, sid, act, e.target.value)
                                        }
                                        className="mx-auto h-8 w-20 text-center text-xs font-medium"
                                      />
                                    </td>
                                  )
                                })}

                                <td className="bg-zinc-50/60 px-3 py-2 text-center font-mono text-xs font-bold text-zinc-900 dark:bg-zinc-800/40 dark:text-zinc-100">
                                  {hasAny ? rawSum.toFixed(1) : '0.0'}
                                </td>

                                {rawTotalMax !== caWeightPct && (
                                  <td className="bg-amber-50/40 px-3 py-2 text-center font-mono text-xs font-bold text-amber-700 dark:bg-amber-950/15 dark:text-amber-300">
                                    {hasAny ? scaled.toFixed(1) : '0.0'}
                                  </td>
                                )}
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer bar: Save + Apply to Terminal */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {openStudents.length} student{openStudents.length === 1 ? '' : 's'} ·{' '}
                      <b className="text-zinc-800 dark:text-zinc-200">
                        {activeScopeClass}
                        {activeScopeSection ? ` (${activeScopeSection})` : ''} · {activeScopeTerm}
                      </b>{' '}
                      · Subject: <b className="text-zinc-800 dark:text-zinc-200">{activeSubject || '—'}</b>
                      {openLinkedExam ? (
                        <>
                          {' '}
                          · Terminal Exam:{' '}
                          <b className="text-emerald-700 dark:text-emerald-300">{openLinkedExam.examName}</b>
                        </>
                      ) : null}
                    </span>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={handleSaveCa} className="h-8 gap-1.5 rounded-lg px-4 text-xs">
                        <Save className="size-3.5" /> Save
                      </Button>
                      <Button
                        variant="primary"
                        onClick={handleApplyToTerminal}
                        className="h-8 gap-1.5 rounded-lg px-4 text-xs font-bold"
                      >
                        <CheckCircle2 className="size-3.5" /> Apply to Terminal
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ---------------------------------------------------------------
              TAB B: AUTO-CREATED CLASS ASSESSMENT SHEET (CA% + Exam% = 100%)
             --------------------------------------------------------------- */}
          {workspaceTab === 'classSheet' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {openSubjects.map((subj) => {
                    const isActive = subj === activeSubject
                    return (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setActiveSubject(subj)}
                        className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold transition ${
                          isActive
                            ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                            : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
                        }`}
                      >
                        {subj}
                      </button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={importCurrentSubjectFromCa}
                  className="h-8 gap-1.5 rounded-lg px-3 text-xs"
                >
                  <RefreshCw className="size-3.5" /> Import {activeSubject} from CA ({caWeightPct}%)
                </Button>
              </div>

              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-xs">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-sky-50/70 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                        <th className="px-4 py-3 text-left">Student Name</th>
                        <th className="w-36 px-3 py-2.5 text-center">
                          <div>CA</div>
                          <div className="text-[10px] font-normal text-zinc-500">MAX: {caWeightPct}</div>
                        </th>
                        <th className="w-36 px-3 py-2.5 text-center">
                          <div>Exam</div>
                          <div className="text-[10px] font-normal text-zinc-500">MAX: {examWeightPct}</div>
                        </th>
                        <th className="w-28 px-3 py-2.5 text-center">Total (100)</th>
                        <th className="w-24 px-3 py-2.5 text-center">Grade</th>
                        <th className="w-36 px-3 py-2.5 text-left">Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openStudents.map((st) => {
                        const sid = String(st.id)
                        const cell = getScopedClassSheetCell(activeSubject, sid)
                        const hasScore = cell.ca !== '' || cell.exam !== ''
                        const total = Number(cell.ca || 0) + Number(cell.exam || 0)
                        const evalRes = hasScore ? evaluateCaGrade(total, openScheme) : null
                        return (
                          <tr
                            key={sid}
                            className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50/60 dark:border-zinc-800/70 dark:hover:bg-white/[0.02]"
                          >
                            <td className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100">
                              {String(st.name ?? '—')}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Input
                                value={cell.ca}
                                inputMode="decimal"
                                placeholder="0"
                                onChange={(e) => setClassSheetCell(activeSubject, sid, 'ca', e.target.value)}
                                className="mx-auto h-8 w-20 text-center text-xs font-medium"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Input
                                value={cell.exam}
                                inputMode="decimal"
                                placeholder="0"
                                onChange={(e) => setClassSheetCell(activeSubject, sid, 'exam', e.target.value)}
                                className="mx-auto h-8 w-20 text-center text-xs font-medium"
                              />
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              {hasScore ? total.toFixed(2) : '0.00'}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-zinc-800 dark:text-zinc-200">
                              {evalRes ? evalRes.grade : '—'}
                            </td>
                            <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                              {evalRes ? evalRes.remark : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Grading Scheme:{' '}
                    <b className="text-zinc-800 dark:text-zinc-200">
                      {GRADING_SCHEMES.find((g) => g.id === openScheme)?.label}
                    </b>
                  </span>
                  <Button
                    variant="primary"
                    onClick={handleApplyToTerminal}
                    className="h-8 gap-1.5 rounded-lg px-4 text-xs font-bold"
                  >
                    <ClipboardCheck className="size-3.5" /> Save &amp; Sync Terminal Marks
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: NEW / EDIT CONTINUOUS ASSESSMENT (Multiple Classes, Sections & Terms)
         ===================================================================== */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit Assessment' : 'New Assessment'}
      >
        <div className="space-y-4">
          {/* Multiple Classes & Multiple Sections */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <div className="flex items-center justify-between">
                <span>
                  Classes <span className="text-red-500">*</span>
                </span>
                {classOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleClassesChange(
                        form.classes.length === classOptions.length ? [] : [...classOptions],
                      )
                    }
                    className="cursor-pointer text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    {form.classes.length === classOptions.length ? 'Clear All' : 'Select All'}
                  </button>
                )}
              </div>
              <MultiSelect
                options={classOptions.map((c) => ({ value: c, label: c }))}
                values={form.classes}
                onChange={handleClassesChange}
                placeholder="Select one or more classes"
                aria-label="Classes"
              />
              {form.classes.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {form.classes.map((cls) => (
                    <span
                      key={cls}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                    >
                      {cls}
                      <button
                        type="button"
                        onClick={() =>
                          handleClassesChange(form.classes.filter((c) => c !== cls))
                        }
                        className="cursor-pointer rounded-full hover:text-rose-600"
                        aria-label={`Remove ${cls}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <div className="flex items-center justify-between">
                <span>
                  Sections <span className="text-red-500">*</span>
                </span>
                {form.classes.length > 0 && formSectionOptions.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        sections:
                          prev.sections.length === formSectionOptions.length
                            ? []
                            : [...formSectionOptions],
                      }))
                    }
                    className="cursor-pointer text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    {form.sections.length === formSectionOptions.length ? 'Clear All' : 'Select All'}
                  </button>
                )}
              </div>
              <MultiSelect
                options={formSectionOptions.map((s) => ({ value: s, label: `Section ${s}` }))}
                values={form.sections}
                disabled={form.classes.length === 0}
                onChange={(vals) => setForm((prev) => ({ ...prev, sections: vals }))}
                placeholder={
                  form.classes.length === 0 ? 'Select Classes first' : 'Select one or more sections'
                }
                aria-label="Sections"
              />
              {form.sections.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {form.sections.map((sec) => (
                    <span
                      key={sec}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                    >
                      Sec {sec}
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            sections: prev.sections.filter((s) => s !== sec),
                          }))
                        }
                        className="cursor-pointer rounded-full hover:text-rose-600"
                        aria-label={`Remove Section ${sec}`}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Multiple Terms Selector */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                Terms <span className="text-red-500">*</span>{' '}
                <span className="font-normal text-mist">(select one or multiple)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const allSelected = form.terms.length === termChoices.length
                  if (allSelected) {
                    setForm((prev) => ({ ...prev, terms: [termChoices[0] ?? 'Term 1'] }))
                  } else {
                    const nextChoices = { ...form.termExamChoices }
                    const nextCustom = { ...form.termCustomExamNames }
                    for (const tm of termChoices) {
                      if (!nextChoices[tm]) {
                        const def = defaultExamChoiceForTerm(tm)
                        nextChoices[tm] = def.choice
                        nextCustom[tm] = def.customName
                      }
                    }
                    setForm((prev) => ({
                      ...prev,
                      terms: [...termChoices],
                      termExamChoices: nextChoices,
                      termCustomExamNames: nextCustom,
                    }))
                  }
                }}
                className="cursor-pointer text-[11px] font-semibold text-amber-600 hover:underline dark:text-amber-400"
              >
                {form.terms.length === termChoices.length ? 'Single Term' : 'Select All Terms'}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {termChoices.map((tm) => {
                const selected = form.terms.some((x) => x.toLowerCase() === tm.toLowerCase())
                return (
                  <button
                    key={tm}
                    type="button"
                    onClick={() => toggleFormTerm(tm)}
                    className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition ${
                      selected
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {selected && <Check className="size-3.5 stroke-[2.5]" />}
                    <span>{tm}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Linked Exam (Exam Setup) — adapts cleanly for 1 Term vs Multiple Terms */}
          {form.terms.length > 0 && (
            <div className="grid gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-3 dark:border-emerald-500/20 dark:bg-emerald-500/[0.08]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <Link2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Linked Exam{form.terms.length > 1 ? 's per Term' : ''} (Exam Setup){' '}
                  <span className="text-red-500">*</span>
                </span>
              </div>

              <div className="space-y-2">
                {form.terms.map((tm) => {
                  const curChoice =
                    form.termExamChoices[tm] ?? defaultExamChoiceForTerm(tm).choice
                  const curCustom =
                    form.termCustomExamNames[tm] ?? `${tm} Examination`
                  return (
                    <div
                      key={tm}
                      className="grid gap-1.5 rounded-lg border border-emerald-500/15 bg-white/70 p-2 dark:bg-zinc-900/60"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {form.terms.length > 1 && (
                          <span className="min-w-[64px] rounded bg-zinc-900 px-2 py-0.5 text-center text-[11px] font-bold text-white dark:bg-white dark:text-zinc-900">
                            {tm}
                          </span>
                        )}
                        <div className="min-w-[180px] flex-1">
                          <Select
                            value={curChoice}
                            onChange={(e) => handleTermExamChoiceChange(tm, e.target.value)}
                          >
                            {examSetupRows.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {String(ex.examName ?? '')}
                                {ex.term ? ` — ${ex.term}` : ''}
                              </option>
                            ))}
                            <option value={CREATE_EXAM_SENTINEL}>
                              + Auto-create Exam for {tm} in Exam Setup
                            </option>
                          </Select>
                        </div>
                      </div>

                      {curChoice === CREATE_EXAM_SENTINEL && (
                        <Input
                          value={curCustom}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              termCustomExamNames: {
                                ...prev.termCustomExamNames,
                                [tm]: e.target.value,
                              },
                            }))
                          }
                          placeholder={`e.g. ${tm} Examination`}
                          className="h-8 text-xs"
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {primaryFormExamInfo.concreteActivities.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-zinc-900 dark:accent-amber-400"
                    checked={form.importExamActivities}
                    onChange={(e) => setForm({ ...form, importExamActivities: e.target.checked })}
                  />
                  <span>
                    Import CA activities from Exam Setup (
                    {primaryFormExamInfo.concreteActivities
                      .map((a) => `${a.name} [${a.maxScore}]`)
                      .join(', ')}
                    )
                  </span>
                </label>
              )}

              <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  className="size-3.5 accent-zinc-900 dark:accent-amber-400"
                  checked={form.syncToExamSetup}
                  onChange={(e) => setForm({ ...form, syncToExamSetup: e.target.checked })}
                />
                <span>
                  Sync Exam Setup Mark Distribution with this Class Score % / Exam % split
                </span>
              </label>
            </div>
          )}

          {/* Year + Reopening Date (using Add New Income DatePicker) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <span>Year</span>
              <Select
                value={form.academicYear}
                onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
              <span>Reopening</span>
              <DatePicker
                value={form.reopeningDate}
                onChange={(iso) => setForm({ ...form, reopeningDate: iso })}
                placeholder="Select reopening date"
                aria-label="Reopening date"
              />
            </label>
          </div>

          {/* Grading Scheme */}
          <label className="grid gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            <span>Grading Scheme</span>
            <Select
              value={form.gradingScheme}
              onChange={(e) =>
                setForm({ ...form, gradingScheme: e.target.value as GradingSchemeId })
              }
            >
              {GRADING_SCHEMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </Select>
          </label>

          {/* CLASS SCORE % + automatic Exam % remainder */}
          <div className="grid gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Class Score %
            </span>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="100"
                value={form.classScorePct}
                onChange={(e) => setForm({ ...form, classScorePct: e.target.value })}
                className="w-24 text-center font-bold"
              />
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-700 dark:text-zinc-200">Class: {formCaPctNum}%</span>
                  <span className="text-zinc-500 dark:text-zinc-400">Exam: {formExamPctNum}%</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div
                    className="bg-zinc-900 transition-all dark:bg-amber-400"
                    style={{ width: `${formCaPctNum}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Scope Summary Preview */}
          {form.classes.length > 0 && form.terms.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300">
              Applies to <b>{form.classes.length}</b> class{form.classes.length === 1 ? '' : 'es'} (
              {form.classes.join(', ')}) ·{' '}
              <b>{form.sections.length || 1}</b> section{form.sections.length === 1 ? '' : 's'}
              {form.sections.length ? ` (${form.sections.join(', ')})` : ''} ·{' '}
              <b>{form.terms.length}</b> term{form.terms.length === 1 ? '' : 's'} (
              {form.terms.join(', ')})
            </div>
          )}

          <Button
            variant="primary"
            onClick={saveAssessmentMeta}
            className="mt-1 h-10 w-full gap-2 rounded-xl text-sm font-bold"
          >
            <Sparkles className="size-4" />
            {form.id ? 'Save Changes' : 'Create Assessment'}
          </Button>
        </div>
      </Modal>

      {/* Delete Activity confirmation modal */}
      <Modal
        open={!!deleteActTarget}
        onClose={() => setDeleteActTarget(null)}
        title="Delete Activity"
        size="sm"
      >
        <div className="space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-300">
            Are you sure you want to delete activity{' '}
            <b className="text-zinc-900 dark:text-zinc-100">
              {deleteActTarget?.name} (Max: {deleteActTarget?.maxScore})
            </b>
            ?
          </p>
          {deleteActScoreCount > 0 && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              This will permanently remove <b>{deleteActScoreCount}</b> recorded student score
              {deleteActScoreCount === 1 ? '' : 's'} entered under this activity.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteActTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDeleteActivity}>
              Delete Activity
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Assessment confirmation modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Assessment" size="sm">
        <div className="space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-300">
            Delete Continuous Assessment for{' '}
            <b>
              {getCaClasses(deleteTarget).join(', ')}
              {getCaSections(deleteTarget).length
                ? ` (${getCaSections(deleteTarget).join(', ')})`
                : ''}{' '}
              — {getCaTerms(deleteTarget).join(', ')}
            </b>
            ?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
