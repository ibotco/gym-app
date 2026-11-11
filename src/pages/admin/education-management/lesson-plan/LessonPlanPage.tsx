import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  BookText,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  GraduationCap,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  DatePicker,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  StatCard,
  Textarea,
} from '../../../../components/ui'
import { useApp } from '../../../../context/AppContext'
import { useAuth } from '../../../../context/AuthContext'
import { useI18n } from '../../../../context/I18nContext'
import { useToast } from '../../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../../lib/eduRecords'
import { useTeacherAccess } from '../../../../lib/eduTeacherAccess'
import { uid } from '../../../../lib/utils'
import { downloadLessonPlanDocx } from './lessonPlanDocx'

const todayISO = () => new Date().toISOString().slice(0, 10)
import {
  CURRICULUM_FRAMEWORKS,
  SCHOOL_LEVELS,
  SHS_PROGRAMMES,
  SUBJECT_CATEGORIES,
  TEACHING_DAYS,
  classCodeToken,
  getCurriculumForSubject,
  getProgrammeOption,
  getSubjectDefinition,
  getSubjectsForLevel,
  getSubjectsForProgramme,
  inferLevelFromClassName,
  inferSubjectCategory,
  parseLessonPlanRow,
  generateLessonPlan,
  serializeLessonPlanToRow,
  type CurriculumFrameworkId,
  type ParsedLessonPlan,
  type SchoolLevelId,
  type ShsProgrammeId,
  type SubjectCategoryId,
} from './lessonPlanCurriculum'

export type LessonPlanLeafMode = 'generator' | 'plans' | 'approvals'

const STEP_LABELS = [
  'School Level',
  'Class',
  'Subject',
  'Strand',
  'Sub-Strand',
  'Content Standard',
  'Indicators & Topic',
  'Schedule & AI',
] as const

function statusTone(status: ParsedLessonPlan['status']): 'lime' | 'amber' | 'rose' | 'zinc' {
  if (status === 'Approved') return 'lime'
  if (status === 'Pending') return 'amber'
  if (status === 'Returned') return 'rose'
  return 'zinc'
}

function formatTermBanner(term: string): string {
  const t = String(term || 'Term 1').trim()
  if (/1/.test(t)) return '1ST TERM – LESSON PLAN'
  if (/2/.test(t)) return '2ND TERM – LESSON PLAN'
  if (/3/.test(t)) return '3RD TERM – LESSON PLAN'
  return `${t.toUpperCase()} – LESSON PLAN`
}

/** Crisp white-paper renderer for a generated Lesson Plan (matching the AI lesson plan template). */
function LessonPlanSheet({
  plan,
  editing,
  onUpdatePlan,
}: {
  plan: ParsedLessonPlan
  editing: boolean
  onUpdatePlan?: (patch: Partial<ParsedLessonPlan>) => void
}) {
  const labelCell: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    fontWeight: 700,
    fontSize: 12,
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    width: '22%',
  }
  const valueCell: React.CSSProperties = {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: 12.5,
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    lineHeight: 1.45,
  }

  const editableText = (
    val: string,
    onChange: (v: string) => void,
  ) =>
    editing ? (
      <textarea
        rows={2}
        value={val}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          border: '1px solid #94a3b8',
          borderRadius: 6,
          fontSize: 12.5,
          color: '#0f172a',
          backgroundColor: '#f8fafc',
        }}
      />
    ) : (
      <span style={{ fontWeight: 600 }}>{val}</span>
    )

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        color: '#0f172a',
        borderRadius: 12,
        border: '1px solid #cbd5e1',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
      }}
    >
      {/* Purple Lesson Plan Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
          color: '#ffffff',
          padding: '16px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em' }}>
          {formatTermBanner(plan.term)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e7ff', marginTop: 2 }}>
          {plan.topic}
        </div>
        <div style={{ fontSize: 11.5, color: '#c7d2fe', marginTop: 3 }}>
          {plan.schoolName}
          {plan.teacher ? ` · Teacher: ${plan.teacher}` : ''}
        </div>
      </div>

      {/* Metadata Table */}
      <div style={{ padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={labelCell}>Week Ending</td>
              <td style={{ ...valueCell, width: '28%' }}>{plan.weekEnding || '—'}</td>
              <td style={{ ...labelCell, width: '20%' }}>Class</td>
              <td style={{ ...valueCell, width: '30%', fontWeight: 600 }}>{plan.className}</td>
            </tr>
            <tr>
              <td style={labelCell}>Subject</td>
              <td style={valueCell}>{plan.subject}</td>
              <td style={{ ...labelCell, width: '20%' }}>Duration</td>
              <td style={valueCell}>{plan.duration}</td>
            </tr>
            <tr>
              <td style={labelCell}>Level</td>
              <td style={valueCell}>{plan.level}</td>
              <td style={{ ...labelCell, width: '20%' }}>Class Size</td>
              <td style={valueCell}>{plan.classSize}</td>
            </tr>
            <tr>
              <td style={labelCell}>Strand</td>
              <td colSpan={3} style={{ ...valueCell, fontWeight: 600 }}>
                {plan.strand}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Sub-Strand</td>
              <td colSpan={3} style={valueCell}>
                {plan.subStrand}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Content Standard</td>
              <td colSpan={3} style={valueCell}>
                {plan.contentStandard}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Keywords</td>
              <td colSpan={3} style={valueCell}>
                {plan.keywords}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Learning Objectives */}
      <div style={{ padding: '0 16px 16px' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>
          Learning Objectives (Bloom's Taxonomy)
        </h4>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12.5, color: '#0f172a', lineHeight: 1.5 }}>
          {plan.objectives.map((obj, idx) => (
            <li key={obj.id} style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: '#4338ca' }}>[{obj.domain}]</span> {obj.text}
            </li>
          ))}
        </ol>
      </div>

      {/* Lesson Plan Sections */}
      <div style={{ padding: '0 16px 16px' }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>
          Lesson Delivery Plan
        </h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc' }}>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', width: '18%', fontWeight: 700, color: '#1e293b' }}>
                Phase
              </th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', width: '10%', fontWeight: 700, color: '#1e293b' }}>
                Duration
              </th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#1e293b' }}>
                Teacher Activity
              </th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#1e293b' }}>
                Student Activity
              </th>
              <th style={{ border: '1px solid #cbd5e1', padding: '8px 10px', textAlign: 'left', width: '18%', fontWeight: 700, color: '#1e293b' }}>
                Resources
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.sections.map((sec, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', fontWeight: 700, color: '#1e293b', verticalAlign: 'top' }}>
                  {sec.title}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', color: '#475569', verticalAlign: 'top', textAlign: 'center' }}>
                  {sec.duration}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', color: '#0f172a', verticalAlign: 'top', lineHeight: 1.4 }}>
                  {editableText(sec.teacherActivity, (v) => {
                    const next = plan.sections.map((s, i) => i === idx ? { ...s, teacherActivity: v } : s)
                    onUpdatePlan?.({ sections: next })
                  })}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', color: '#0f172a', verticalAlign: 'top', lineHeight: 1.4 }}>
                  {editableText(sec.studentActivity, (v) => {
                    const next = plan.sections.map((s, i) => i === idx ? { ...s, studentActivity: v } : s)
                    onUpdatePlan?.({ sections: next })
                  })}
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 10px', color: '#475569', verticalAlign: 'top', fontSize: 11 }}>
                  {sec.resources}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Homework & References */}
      <div style={{ padding: '0 16px 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={labelCell}>Homework / Assignment</td>
              <td colSpan={3} style={valueCell}>
                {editableText(plan.homework, (v) => onUpdatePlan?.({ homework: v }))}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>References</td>
              <td colSpan={3} style={valueCell}>
                {editableText(plan.references, (v) => onUpdatePlan?.({ references: v }))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Download modal for lesson plan exports. */
function DownloadLessonPlanModal({
  plan,
  onClose,
  onPrintPdf,
  onDownloadDocx,
}: {
  plan: ParsedLessonPlan | null
  onClose: () => void
  onPrintPdf: (plan: ParsedLessonPlan, orientation: 'portrait' | 'landscape') => void
  onDownloadDocx: (plan: ParsedLessonPlan, orientation: 'portrait' | 'landscape') => void
}) {
  if (!plan) return null
  return (
    <Modal
      open
      onClose={onClose}
      title="Download Lesson Plan"
      maxWidth="md"
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="text-sm font-bold">Select Format</div>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onPrintPdf(plan, 'portrait')}
            className="flex w-full items-center justify-between rounded-xl border border-line p-4 transition hover:border-indigo-400/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileText className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Portrait PDF</div>
                <div className="text-xs text-mist">Vertical layout · Print or save as PDF</div>
              </div>
            </div>
            <ChevronRight className="size-4 text-mist" />
          </button>
          <button
            type="button"
            onClick={() => onPrintPdf(plan, 'landscape')}
            className="flex w-full items-center justify-between rounded-xl border border-line p-4 transition hover:border-indigo-400/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileText className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Landscape PDF</div>
                <div className="text-xs text-mist">Horizontal layout · Print or save as PDF</div>
              </div>
            </div>
            <ChevronRight className="size-4 text-mist" />
          </button>
          <button
            type="button"
            onClick={() => onDownloadDocx(plan, 'portrait')}
            className="flex w-full items-center justify-between rounded-xl border border-line p-4 transition hover:border-indigo-400/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Portrait DOCX (editable)</div>
                <div className="text-xs text-mist">Vertical layout · Microsoft Word / Google Docs</div>
              </div>
            </div>
            <ChevronRight className="size-4 text-mist" />
          </button>
          <button
            type="button"
            onClick={() => onDownloadDocx(plan, 'landscape')}
            className="flex w-full items-center justify-between rounded-xl border border-line p-4 transition hover:border-indigo-400/60 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <FileText className="size-4.5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Landscape DOCX (editable)</div>
                <div className="text-xs text-mist">Horizontal layout · Microsoft Word / Google Docs</div>
              </div>
            </div>
            <ChevronRight className="size-4 text-mist" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function LessonPlanPage({ mode }: { mode: LessonPlanLeafMode }) {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeBranchId, branches } = useApp()

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  )
  const schoolName = activeBranch?.name?.trim() || 'Airport City Flagship'

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
  }, [activeBranchId, activeBranch?.name])

  const teacherScope = useTeacherAccess(records)

  const persistLessonPlans = (nextRows: EduRow[]) => {
    const nextRecords: EduRecords = {
      ...records,
      lessonPlans: nextRows,
    }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
  }

  // All Lesson Plans (scoped automatically when a Teacher logs in)
  const rawRows = (records.lessonPlans ?? []) as EduRow[]
  const scopedRows = useMemo(
    () =>
      teacherScope.isTeacher
        ? teacherScope.filterLeafRows('lessonPlans', rawRows)
        : rawRows,
    [teacherScope, rawRows],
  )
  const parsedPlans = useMemo(() => scopedRows.map(parseLessonPlanRow), [scopedRows])

  // Available Classes & Subjects (scoped for Teacher)
  const availableClasses = useMemo(() => {
    const classRows = teacherScope.isTeacher
      ? teacherScope.filterLeafRows('classList', records.classList ?? [])
      : (records.classList ?? [])
    const names = Array.from(
      new Set(
        classRows
          .map((r) => {
            const base = String(r.name ?? '').trim()
            const sec = String(r.section ?? '').trim()
            if (!base) return ''
            return sec && !base.toLowerCase().endsWith(` ${sec.toLowerCase()}`)
              ? `${base} ${sec}`
              : base
          })
          .filter(Boolean),
      ),
    )
    return names
  }, [records.classList, teacherScope])

  const availableTeachers = useMemo(() => {
    const staff = (records.staffList ?? []) as EduRow[]
    const names = Array.from(
      new Set(
        staff
          .map((s) => String(s.fullName || s.name || '').trim())
          .filter(Boolean),
      ),
    )
    if (teacherScope.isTeacher && teacherScope.teacherDisplayName) {
      return [teacherScope.teacherDisplayName]
    }
    return names
  }, [records.staffList, teacherScope])

  const availableTerms = useMemo(() => {
    const terms = ((records.termSemester ?? []) as EduRow[])
      .map((r) => String(r.name ?? '').trim())
      .filter(Boolean)
    const unique = Array.from(new Set(terms))
    return unique.length > 0 ? unique : ['Term 1', 'Term 2', 'Term 3']
  }, [records.termSemester])

  // ---------------------------------------------------------------------------
  // 8-Step Guided / AI Lesson Plan Generator State
  // ---------------------------------------------------------------------------
  const [step, setStep] = useState<number>(1)
  const [levelId, setLevelId] = useState<SchoolLevelId>('shs')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [customClassInput, setCustomClassInput] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('Core Mathematics (General Mathematics)')
  const [selectedProgramme, setSelectedProgramme] = useState<ShsProgrammeId>('all-programmes')
  const [subjectCategory, setSubjectCategory] = useState<SubjectCategoryId>('all')
  const [subjectSearch, setSubjectSearch] = useState<string>('')
  const [customSubjectInput, setCustomSubjectInput] = useState<string>('')
  const [selectedStrand, setSelectedStrand] = useState<string>('Number, Numeration, Sets & Surds')
  const [customStrand, setCustomStrand] = useState<string>('')
  const [selectedSubStrand, setSelectedSubStrand] = useState<string>(
    'Sets, Venn Diagrams, Number Bases & Modular Arithmetic',
  )
  const [customSubStrand, setCustomSubStrand] = useState<string>('')
  const [selectedStandard, setSelectedStandard] = useState<string>('')
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([])
  const [customIndicatorInput, setCustomIndicatorInput] = useState<string>('')
  const [customTopic, setCustomTopic] = useState<string>('')

  const [teacherName, setTeacherName] = useState<string>('')
  const [term, setTerm] = useState<string>('Term 1')
  const [week, setWeek] = useState<string>('Week 5')
  const [weekEnding, setWeekEnding] = useState<string>(todayISO())
  const [duration, setDuration] = useState<string>('55 minutes')
  const [classSize, setClassSize] = useState<string>('28')
  const [aiModel, setAiModel] = useState<'free' | 'pro'>('pro')
  const [curriculumFramework, setCurriculumFramework] =
    useState<CurriculumFrameworkId>('waec-wassce')
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday'])

  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [genProgress, setGenProgress] = useState<number>(0)
  const [generatedDraft, setGeneratedDraft] = useState<ParsedLessonPlan | null>(null)
  const [isEditingGenerated, setIsEditingGenerated] = useState<boolean>(false)

  // Initialize default teacher & class when scope loads
  useEffect(() => {
    if (teacherScope.isTeacher && teacherScope.teacherDisplayName) {
      setTeacherName(teacherScope.teacherDisplayName)
    } else if (!teacherName && availableTeachers[0]) {
      setTeacherName(availableTeachers[0])
    }
  }, [teacherScope.isTeacher, teacherScope.teacherDisplayName, availableTeachers, teacherName])

  // If logged in as a Teacher, default levelId to match their first assigned class
  useEffect(() => {
    if (teacherScope.isTeacher && availableClasses[0]) {
      const inferred = inferLevelFromClassName(availableClasses[0])
      setLevelId(inferred)
      setCurriculumFramework(inferred === 'shs' ? 'waec-wassce' : 'universal-africa')
    }
  }, [teacherScope.isTeacher, availableClasses])

  // Classes shown in Step 2 for the chosen School Level
  const levelClasses = useMemo(() => {
    const levelDef = SCHOOL_LEVELS.find((l) => l.id === levelId) ?? SCHOOL_LEVELS[3]
    const matchingBranchClasses = availableClasses.filter(
      (c) => inferLevelFromClassName(c) === levelId,
    )
    if (teacherScope.isTeacher) {
      return matchingBranchClasses.length > 0 ? matchingBranchClasses : availableClasses
    }
    return Array.from(new Set([...matchingBranchClasses, ...levelDef.defaultClasses]))
  }, [levelId, availableClasses, teacherScope.isTeacher])

  useEffect(() => {
    if (!selectedClass || (!levelClasses.includes(selectedClass) && !customClassInput.trim())) {
      if (levelClasses[0]) setSelectedClass(levelClasses[0])
    }
  }, [levelClasses, selectedClass, customClassInput])

  // Auto-update Class Size when Class changes based on enrolled students
  useEffect(() => {
    if (!selectedClass) return
    const students = (records.studentList ?? []) as EduRow[]
    const count = students.filter((s) => {
      const sc = String(s.className ?? '').trim().toLowerCase()
      const sec = String(s.section ?? '').trim().toLowerCase()
      const target = selectedClass.trim().toLowerCase()
      return sc === target || `${sc} ${sec}`.trim() === target
    }).length
    if (count > 0) setClassSize(String(count))
  }, [selectedClass, records.studentList])

  // Subjects shown in Step 3 (level-aware West Africa SHS + Universal Africa catalogue, scoped for Teacher)
  const selectableSubjects = useMemo(() => {
    const levelSubjects = getSubjectsForLevel(levelId).map((s) => s.name)
    const branchSubjects = ((records.subjectList ?? []) as EduRow[])
      .map((s) => String(s.name ?? '').trim())
      .filter(Boolean)

    // Apply SHS programme filter
    let programmedSubjects: string[]
    if (levelId === 'shs' && selectedProgramme !== 'all-programmes') {
      programmedSubjects = getSubjectsForProgramme(selectedProgramme, levelId)
    } else {
      programmedSubjects = levelSubjects
    }

    if (teacherScope.isTeacher) {
      const assignedForClass = teacherScope.subjectsForClass(selectedClass)
      if (assignedForClass.length > 0) {
        return assignedForClass.filter((s) => programmedSubjects.includes(s))
      }
      if (teacherScope.assignedSubjects.length > 0) {
        return teacherScope.assignedSubjects.filter((s) => programmedSubjects.includes(s))
      }
    }
    return Array.from(new Set([...programmedSubjects, ...branchSubjects]))
  }, [levelId, records.subjectList, teacherScope, selectedClass, selectedProgramme])

  const filteredStepSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase()
    return selectableSubjects.filter((subj) => {
      if (subjectCategory !== 'all' && inferSubjectCategory(subj) !== subjectCategory) {
        return false
      }
      if (q && !subj.toLowerCase().includes(q)) return false
      return true
    })
  }, [selectableSubjects, subjectCategory, subjectSearch])

  useEffect(() => {
    if (
      selectableSubjects.length > 0 &&
      !selectableSubjects.includes(selectedSubject) &&
      !customSubjectInput.trim()
    ) {
      setSelectedSubject(selectableSubjects[0])
    }
  }, [selectableSubjects, selectedSubject, customSubjectInput])

  // Curriculum tree for the chosen Subject & School Level
  const strandsForSubject = useMemo(
    () => getCurriculumForSubject(selectedSubject, levelId),
    [selectedSubject, levelId],
  )

  useEffect(() => {
    if (customStrand.trim()) return
    if (!strandsForSubject.some((s) => s.name === selectedStrand)) {
      const firstStrand = strandsForSubject[0]
      if (firstStrand) {
        setSelectedStrand(firstStrand.name)
        if (firstStrand.subStrands[0]) {
          setSelectedSubStrand(firstStrand.subStrands[0].name)
        }
      }
    }
  }, [strandsForSubject, selectedStrand, customStrand])

  const activeStrandObj = useMemo(
    () => strandsForSubject.find((s) => s.name === selectedStrand) ?? strandsForSubject[0],
    [strandsForSubject, selectedStrand],
  )

  const subStrandsForStrand = useMemo(
    () => activeStrandObj?.subStrands ?? [],
    [activeStrandObj],
  )

  useEffect(() => {
    if (customSubStrand.trim()) return
    if (!subStrandsForStrand.some((ss) => ss.name === selectedSubStrand)) {
      if (subStrandsForStrand[0]) setSelectedSubStrand(subStrandsForStrand[0].name)
    }
  }, [subStrandsForStrand, selectedSubStrand, customSubStrand])

  const activeSubStrandObj = useMemo(
    () =>
      subStrandsForStrand.find((ss) => ss.name === selectedSubStrand) ?? subStrandsForStrand[0],
    [subStrandsForStrand, selectedSubStrand],
  )

  const codePrefix = useMemo(
    () => classCodeToken(selectedClass, levelId),
    [selectedClass, levelId],
  )

  const computedContentStandard = useMemo(() => {
    if (!activeSubStrandObj) {
      return `${codePrefix}.1.1.1 Demonstrate mastery of ${customSubStrand || selectedSubStrand}`
    }
    return `${codePrefix}.${activeSubStrandObj.standardSuffix} ${activeSubStrandObj.standardTitle}`
  }, [activeSubStrandObj, codePrefix, customSubStrand, selectedSubStrand])

  useEffect(() => {
    setSelectedStandard(computedContentStandard)
  }, [computedContentStandard])

  const indicatorOptions = useMemo(() => {
    const suffix = activeSubStrandObj?.standardSuffix || '1.1.1'
    const baseList = activeSubStrandObj?.indicators ?? []
    return baseList.map((txt, idx) => `${codePrefix}.${suffix}.${idx + 1} ${txt}`)
  }, [activeSubStrandObj, codePrefix])

  // Pre-select first 3 indicators whenever sub-strand changes
  useEffect(() => {
    setSelectedIndicators(indicatorOptions.slice(0, Math.min(3, indicatorOptions.length)))
  }, [indicatorOptions])

  const toggleIndicator = (ind: string) => {
    setSelectedIndicators((prev) => {
      if (prev.includes(ind)) return prev.filter((item) => item !== ind)
      if (prev.length >= 5) {
        toast.error('Maximum 5 indicators', 'You can select up to 5 indicators per lesson plan.')
        return prev
      }
      return [...prev, ind]
    })
  }

  const addCustomIndicator = () => {
    const clean = customIndicatorInput.trim()
    if (!clean) return
    if (selectedIndicators.length >= 5) {
      toast.error('Maximum 5 indicators', 'You can select up to 5 indicators per lesson plan.')
      return
    }
    const suffix = activeSubStrandObj?.standardSuffix || '1.1.1'
    const formatted = /^[A-Z]+\d*\./i.test(clean)
      ? clean
      : `${codePrefix}.${suffix}.${selectedIndicators.length + 1} ${clean}`
    setSelectedIndicators((prev) => [...prev, formatted])
    setCustomIndicatorInput('')
  }

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    )
  }

  const handleGenerateLessonPlan = () => {
    if (!selectedClass) {
      toast.error('Select a class', 'Please choose a class before generating.')
      return
    }
    if (selectedIndicators.length === 0) {
      toast.error('Select indicators', 'Choose at least one learning indicator.')
      return
    }

    setIsGenerating(true)
    setGenProgress(12)

    const resolvedStrand = customStrand.trim() || selectedStrand
    const resolvedSubStrand = customSubStrand.trim() || selectedSubStrand
    const resolvedTopic = customTopic.trim() || resolvedSubStrand

    const t1 = window.setTimeout(() => setGenProgress(48), 260)
    const t2 = window.setTimeout(() => setGenProgress(84), 560)
    const t3 = window.setTimeout(() => {
      const newDraft: ParsedLessonPlan = {
        ...generateLessonPlan({
          schoolName,
          teacher: teacherName || user?.name || 'Subject Teacher',
          className: selectedClass,
          levelId,
          subject: selectedSubject,
          strand: resolvedStrand,
          subStrand: resolvedSubStrand,
          contentStandard: selectedStandard,
          indicators: selectedIndicators,
          topic: resolvedTopic,
          duration,
          classSize,
          term,
          week,
          weekEnding,
          aiModel,
          curriculumFramework,
        }),
        id: uid(),
      }

      setGenProgress(100)
      setIsGenerating(false)
      setGeneratedDraft(newDraft)
      setIsEditingGenerated(false)
      toast.success(
        'Lesson Plan generated',
        `Created a structured lesson plan for ${selectedSubject} (${selectedClass}).`,
      )
    }, 880)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }

  const updateGeneratedPlan = (patch: Partial<ParsedLessonPlan>) => {
    setGeneratedDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const saveGeneratedPlan = (submitForApproval = false) => {
    if (!generatedDraft) return
    const nextPlan: ParsedLessonPlan = {
      ...generatedDraft,
      status: submitForApproval ? 'Pending' : generatedDraft.status,
      submittedOn: submitForApproval ? todayISO() : generatedDraft.submittedOn,
    }
    const serialized = serializeLessonPlanToRow(nextPlan)
    const exists = rawRows.some((r) => r.id === nextPlan.id)
    const nextRows = exists
      ? rawRows.map((r) => (r.id === nextPlan.id ? serialized : r))
      : [serialized, ...rawRows]

    persistLessonPlans(nextRows)
    setGeneratedDraft(nextPlan)
    setIsEditingGenerated(false)
    toast.success(
      submitForApproval ? 'Submitted for approval' : 'Lesson Plan saved',
      `${nextPlan.subject} · ${nextPlan.className} (${nextPlan.week})`,
    )
  }

  // ---------------------------------------------------------------------------
  // Register / Approvals State & Modals
  // ---------------------------------------------------------------------------
  const [searchQ, setSearchQ] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [viewingPlan, setViewingPlan] = useState<ParsedLessonPlan | null>(null)
  const [editingModalPlan, setEditingModalPlan] = useState<boolean>(false)
  const [viewingLessonIdx, setViewingLessonIdx] = useState<number>(0)
  const [reviewerRemarks, setReviewerRemarks] = useState<string>('')

  const [downloadTarget, setDownloadTarget] = useState<ParsedLessonPlan | null>(null)
  const [printJob, setPrintJob] = useState<{
    plan: ParsedLessonPlan
    orientation: 'portrait' | 'landscape'
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ParsedLessonPlan | null>(null)

  const handlePrintPdf = (plan: ParsedLessonPlan, orientation: 'portrait' | 'landscape') => {
    setDownloadTarget(null)
    setPrintJob({ plan, orientation })
    setTimeout(() => {
      const prevTitle = document.title
      document.title = `${plan.subject}_${plan.className}_${plan.week}_LessonPlan`
      const cleanup = () => {
        document.title = prevTitle
        setPrintJob(null)
        window.removeEventListener('afterprint', cleanup)
      }
      window.addEventListener('afterprint', cleanup)
      window.print()
    }, 120)
  }

  const handleStatusDecision = (
    plan: ParsedLessonPlan,
    decision: 'Approved' | 'Returned' | 'Pending',
    comment?: string,
  ) => {
    const updated: ParsedLessonPlan = {
      ...plan,
      status: decision,
      submittedOn: decision === 'Pending' ? todayISO() : plan.submittedOn || todayISO(),
      reviewerComment: comment !== undefined ? comment : plan.reviewerComment,
      reviewedBy:
        decision === 'Approved' || decision === 'Returned'
          ? user?.name || 'Academic Head'
          : plan.reviewedBy,
    }
    const serialized = serializeLessonPlanToRow(updated)
    const nextRows = rawRows.map((r) => (r.id === updated.id ? serialized : r))
    persistLessonPlans(nextRows)
    if (viewingPlan?.id === updated.id) setViewingPlan(updated)
    toast.success(
      decision === 'Approved'
        ? 'Lesson Plan approved'
        : decision === 'Returned'
          ? 'Returned for revision'
          : 'Submitted for approval',
      `${updated.subject} · ${updated.className} (${updated.week})`,
    )
  }

  const saveModalEditedPlan = () => {
    if (!viewingPlan) return
    const serialized = serializeLessonPlanToRow(viewingPlan)
    const nextRows = rawRows.map((r) => (r.id === viewingPlan.id ? serialized : r))
    persistLessonPlans(nextRows)
    setEditingModalPlan(false)
    toast.success('Lesson Plan updated', `${viewingPlan.subject} · ${viewingPlan.className}`)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    persistLessonPlans(rawRows.filter((r) => r.id !== deleteTarget.id))
    if (viewingPlan?.id === deleteTarget.id) setViewingPlan(null)
    toast.success('Lesson Plan deleted', `${deleteTarget.subject} · ${deleteTarget.week}`)
    setDeleteTarget(null)
  }

  const filteredPlans = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    return parsedPlans.filter((n) => {
      if (mode === 'approvals' && !statusFilter && n.status === 'Draft') return false
      if (termFilter && n.term !== termFilter) return false
      if (classFilter && n.className !== classFilter) return false
      if (statusFilter && n.status !== statusFilter) return false
      if (!q) return true
      return (
        n.subject.toLowerCase().includes(q) ||
        n.className.toLowerCase().includes(q) ||
        n.topic.toLowerCase().includes(q) ||
        n.subStrand.toLowerCase().includes(q) ||
        n.teacher.toLowerCase().includes(q) ||
        n.week.toLowerCase().includes(q)
      )
    })
  }, [parsedPlans, mode, searchQ, termFilter, classFilter, statusFilter])

  const stats = useMemo(() => {
    const total = parsedPlans.length
    const approved = parsedPlans.filter((n) => n.status === 'Approved').length
    const pending = parsedPlans.filter((n) => n.status === 'Pending').length
    return { total, approved, pending }
  }, [parsedPlans])

  const progressPct = Math.round((step / STEP_LABELS.length) * 100)

  return (
    <div>
      {/* Dedicated Print Style & Root for Portrait / Landscape A4 PDF export */}
      {printJob &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="lesson-plan-print-root">
            <style>{`
              @media screen {
                .lesson-plan-print-root { display: none !important; }
              }
              @media print {
                @page { size: A4 ${printJob.orientation}; margin: 10mm; }
                body > *:not(.lesson-plan-print-root) { display: none !important; }
                .lesson-plan-print-root {
                  display: block !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                }
                .lesson-plan-print-page {
                  page-break-after: always;
                  break-after: page;
                }
                .lesson-plan-print-page:last-child {
                  page-break-after: auto;
                  break-after: auto;
                }
              }
            `}</style>
            <div key={printJob.plan.id} className="lesson-plan-print-page">
              <LessonPlanSheet plan={printJob.plan} editing={false} />
            </div>
          </div>,
          document.body,
        )}

      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        <span>/</span>
        <span>Education Management</span>
        <span>/</span>
        <span>Lesson Plan</span>
        <span>/</span>
        <span className="font-semibold text-inherit">
          {mode === 'generator'
            ? 'Generate Lesson Plan'
            : mode === 'approvals'
              ? 'Lesson Plan Approvals'
              : 'Lesson Plans'}
        </span>
      </div>

      <PageHeader
        title={
          mode === 'generator'
            ? 'Generate Lesson Plan'
            : mode === 'approvals'
              ? 'Lesson Plan Approvals'
              : 'Lesson Plans'
        }
        desc={
          mode === 'generator'
            ? `${schoolName} — Generate structured AI lesson plans across West African (WAEC / WASSCE) & Pan-African curricula, customize inline, and export to PDF or editable Word (.docx).`
            : mode === 'approvals'
              ? `${schoolName} — Review submitted lesson plans, provide academic feedback, and approve for classroom delivery.`
              : `${schoolName} — Manage, preview, customize, and download structured lesson plans across classes and subjects.`
        }
        actions={
          mode === 'generator' ? (
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/education-management/lesson-plan/plans')}
            >
              <BookOpen className="size-4" />
              Saved Lesson Plans ({parsedPlans.length})
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/admin/education-management/lesson-plan/generate')}
            >
              <WandSparkles className="size-4" />
              Generate Lesson Plan
            </Button>
          )
        }
      />

      {/* =====================================================================
          MODE 1: GUIDED / AI LESSON PLAN GENERATOR
         ===================================================================== */}
      {mode === 'generator' && (
        <div className="space-y-6">
          {/* Generating Progress State */}
          {isGenerating ? (
            <div
              className="mx-auto max-w-xl rounded-2xl p-8 text-center text-white shadow-xl"
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 55%, #4338ca 100%)',
              }}
            >
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-400/20 ring-2 ring-emerald-300/50">
                <Sparkles className="size-8 text-emerald-300" />
              </div>
              <h3 className="text-xl font-bold">
                Generating with {aiModel === 'pro' ? 'Smart Curriculum Pro AI' : 'Standard AI'}
              </h3>
              <p className="mt-1 text-sm text-indigo-100">
                Structuring Introduction, Development, Assessment &amp; Conclusion…
              </p>

              <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                  style={{ width: `${genProgress}%` }}
                />
              </div>
              <div className="mt-2 text-xs font-semibold text-indigo-100">
                {genProgress}% Complete
              </div>
            </div>
          ) : generatedDraft ? (
            /* Generated Lesson Plan Viewer & Editor */
            <div className="space-y-4">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setGeneratedDraft(null)}>
                    <RotateCcw className="size-4" />
                    Back to Generator
                  </Button>
                  <Badge tone={statusTone(generatedDraft.status)}>{generatedDraft.status}</Badge>
                </div>

                {/* Customize / Save / Submit / Download Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" onClick={() => setIsEditingGenerated((v) => !v)}>
                    <Pencil className="size-4" />
                    {isEditingGenerated ? 'Done Editing' : 'Edit Content'}
                  </Button>
                  <Button variant="ghost" onClick={() => saveGeneratedPlan(false)}>
                    <Save className="size-4" />
                    Save Draft
                  </Button>
                  <Button variant="ghost" onClick={() => saveGeneratedPlan(true)}>
                    <Send className="size-4" />
                    Submit for Approval
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      saveGeneratedPlan(false)
                      setDownloadTarget(generatedDraft)
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                    }}
                  >
                    <Download className="size-4" />
                    Download
                  </button>
                </div>
              </div>

              {/* Lesson Plan Sheet */}
              <LessonPlanSheet
                plan={generatedDraft}
                editing={isEditingGenerated}
                onUpdatePlan={updateGeneratedPlan}
              />

              {/* Full-width bottom Download Bar */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    saveGeneratedPlan(false)
                    setDownloadTarget(generatedDraft)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                  }}
                >
                  <Download className="size-4" />
                  Download Lesson Plan (PDF / Editable DOCX)
                </button>
              </div>
            </div>
          ) : (
            /* 8-Step Guided Curriculum & AI Lesson Plan Setup */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
                  {/* Purple Step Header & Progress Bar */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                      color: '#ffffff',
                      padding: '18px 22px',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-100">
                      <span>
                        Step {step} of {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
                      </span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    {/* Clickable Step Pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {STEP_LABELS.map((lbl, i) => {
                        const sNum = i + 1
                        const active = sNum === step
                        const done = sNum < step
                        return (
                          <button
                            key={lbl}
                            type="button"
                            onClick={() => setStep(sNum)}
                            style={{
                              backgroundColor: active
                                ? '#ffffff'
                                : done
                                  ? 'rgba(255,255,255,0.22)'
                                  : 'rgba(255,255,255,0.1)',
                              color: active ? '#4338ca' : '#ffffff',
                            }}
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-90"
                          >
                            {sNum}. {lbl}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Step Body */}
                  <div className="p-6">
                    {/* STEP 1: School Level */}
                    {step === 1 && (
                      <div>
                        <h3 className="text-base font-bold">Select School Level</h3>
                        <p className="mt-0.5 text-xs text-mist">
                          Universal across West Africa (SHS / SSS / JHS / Basic) and all African education systems (Early Years, Primary, Junior &amp; Senior Secondary).
                        </p>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {SCHOOL_LEVELS.map((lvl) => {
                            const selected = lvl.id === levelId
                            return (
                              <button
                                key={lvl.id}
                                type="button"
                                onClick={() => {
                                  setLevelId(lvl.id)
                                  setSelectedProgramme('all-programmes')
                                  setSubjectCategory('all')
                                  setSubjectSearch('')
                                  setCustomClassInput('')
                                  setCustomSubjectInput('')
                                  setCurriculumFramework(
                                    lvl.id === 'shs' ? 'waec-wassce' : 'universal-africa',
                                  )
                                  setStep(2)
                                }}
                                className={`relative flex flex-col items-center rounded-2xl border-2 p-5 text-center transition ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                    : 'border-line hover:border-indigo-400/60'
                                }`}
                              >
                                {selected && (
                                  <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                                    <Check className="size-3 stroke-[3]" />
                                  </span>
                                )}
                                <div
                                  className={`flex size-12 items-center justify-center rounded-full ${
                                    selected
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                  }`}
                                >
                                  <GraduationCap className="size-6" />
                                </div>
                                <div className="mt-3 text-sm font-bold">{lvl.name}</div>
                                <div className="mt-0.5 text-xs text-mist">{lvl.subtitle}</div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Select Class */}
                    {step === 2 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-bold">Select Class</h3>
                          <p className="mt-0.5 text-xs text-mist">
                            {teacherScope.isTeacher
                              ? 'Showing classes assigned to you.'
                              : 'Choose a class/stream (SHS / SSS / Grade / Form) or enter a custom class name.'}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {levelClasses.map((cls, idx) => {
                            const selected = cls === selectedClass
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => {
                                  setCustomClassInput('')
                                  setSelectedClass(cls)
                                  setStep(3)
                                }}
                                className={`flex flex-col items-center justify-center rounded-xl border-2 px-4 py-4 text-center transition ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-500/[0.07]'
                                    : 'border-line hover:border-indigo-400/60'
                                }`}
                              >
                                <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                                  {idx + 1}
                                </span>
                                <span className="mt-1 text-xs font-bold">{cls}</span>
                              </button>
                            )
                          })}
                        </div>

                        {!teacherScope.isTeacher && (
                          <div className="flex gap-2 pt-1">
                            <Input
                              placeholder="Or type custom class / stream (e.g. SHS 2 Visual Arts, SS 3A, Form 4 East, Terminale C)…"
                              value={customClassInput}
                              onChange={(e) => setCustomClassInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customClassInput.trim()) {
                                  e.preventDefault()
                                  setSelectedClass(customClassInput.trim())
                                  setStep(3)
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={!customClassInput.trim()}
                              onClick={() => {
                                if (!customClassInput.trim()) return
                                setSelectedClass(customClassInput.trim())
                                setStep(3)
                              }}
                            >
                              Use Class
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 3: Select Subject */}
                    {step === 3 && (
                      <div className="space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-base font-bold">Select Subject</h3>
                            <p className="mt-0.5 text-xs text-mist">
                              {levelId === 'shs'
                                ? selectedProgramme !== 'all-programmes'
                                  ? `${getProgrammeOption(selectedProgramme)?.label ?? ''} programme subjects — West African SHS (WAEC / WASSCE) + Pan-African Senior Secondary for ${selectedClass}.`
                                  : `West African SHS (WAEC / WASSCE) Core & Elective subjects + Pan-African Senior Secondary subjects for ${selectedClass}.`
                                : `Universal African & West African subjects for ${selectedClass}.`}
                            </p>
                          </div>
                          <SearchInput
                            value={subjectSearch}
                            onChange={setSubjectSearch}
                            placeholder="Search subject…"
                            className="w-full sm:w-56"
                          />
                        </div>

                        {/* SHS Programme / Stream Filter Pills */}
                        {levelId === 'shs' && !teacherScope.isTeacher && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-mist">
                              Programme:
                            </span>
                            {SHS_PROGRAMMES.map((prog) => {
                              const active = selectedProgramme === prog.id
                              const countForProg =
                                prog.id === 'all-programmes'
                                  ? selectableSubjects.length
                                  : getSubjectsForProgramme(prog.id, levelId).length
                              if (prog.id !== 'all-programmes' && countForProg === 0) return null
                              return (
                                <button
                                  key={prog.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedProgramme(prog.id)
                                    setSubjectCategory('all')
                                    setSubjectSearch('')
                                  }}
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                    active
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-line text-mist hover:border-indigo-400/60 hover:text-inherit'
                                  }`}
                                >
                                  {prog.shortLabel} ({countForProg})
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {/* Subject Category / Department Filter Pills */}
                        {!teacherScope.isTeacher && (
                          <div className="flex flex-wrap gap-1.5">
                            {SUBJECT_CATEGORIES.map((cat) => {
                              const active = subjectCategory === cat.id
                              const countForCat =
                                cat.id === 'all'
                                  ? selectableSubjects.length
                                  : selectableSubjects.filter(
                                      (s) => inferSubjectCategory(s) === cat.id,
                                    ).length
                              if (cat.id !== 'all' && countForCat === 0) return null
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setSubjectCategory(cat.id)}
                                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                                    active
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-line text-mist hover:border-indigo-400/60 hover:text-inherit'
                                  }`}
                                >
                                  {cat.label} ({countForCat})
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {filteredStepSubjects.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-mist">
                            No subjects match &ldquo;{subjectSearch}&rdquo; in this category. Try &ldquo;All Subjects&rdquo; or enter a custom subject below.
                          </div>
                        ) : (
                          <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                            {filteredStepSubjects.map((subj) => {
                              const selected = subj === selectedSubject
                              const meta = getSubjectDefinition(subj)
                              return (
                                <button
                                  key={subj}
                                  type="button"
                                  onClick={() => {
                                    setCustomSubjectInput('')
                                    setSelectedSubject(subj)
                                    setCustomStrand('')
                                    setCustomSubStrand('')
                                    setStep(4)
                                  }}
                                  className={`flex flex-col items-center justify-between rounded-xl border-2 p-3.5 text-center transition ${
                                    selected
                                      ? 'border-indigo-600 bg-indigo-500/[0.07]'
                                      : 'border-line hover:border-indigo-400/60'
                                  }`}
                                >
                                  <div className="flex flex-col items-center">
                                    <div
                                      className={`flex size-9 items-center justify-center rounded-lg ${
                                        selected
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                      }`}
                                    >
                                      <BookOpen className="size-4.5" />
                                    </div>
                                    <span className="mt-2 text-xs font-bold leading-snug">
                                      {subj}
                                    </span>
                                  </div>
                                  {meta?.badge && (
                                    <span className="mt-2 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-medium text-mist dark:bg-white/[0.06]">
                                      {meta.badge}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {!teacherScope.isTeacher && (
                          <div className="flex gap-2 pt-1">
                            <Input
                              placeholder="Or enter any custom subject (e.g. Further Physics, Fisheries, Swahili Literature, Jewellery)…"
                              value={customSubjectInput}
                              onChange={(e) => setCustomSubjectInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && customSubjectInput.trim()) {
                                  e.preventDefault()
                                  setSelectedSubject(customSubjectInput.trim())
                                  setCustomStrand('')
                                  setCustomSubStrand('')
                                  setStep(4)
                                }
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={!customSubjectInput.trim()}
                              onClick={() => {
                                if (!customSubjectInput.trim()) return
                                setSelectedSubject(customSubjectInput.trim())
                                setCustomStrand('')
                                setCustomSubStrand('')
                                setStep(4)
                              }}
                            >
                              Use Subject
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 4: Select Strand */}
                    {step === 4 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-bold">Select Curriculum Strand</h3>
                          <p className="mt-0.5 text-xs text-mist">
                            Choose a curriculum strand under{' '}
                            <strong className="text-inherit">{selectedSubject}</strong>, or enter a custom strand.
                          </p>
                        </div>
                        <div className="space-y-2.5">
                          {strandsForSubject.map((st) => {
                            const selected = !customStrand.trim() && st.name === selectedStrand
                            return (
                              <button
                                key={st.name}
                                type="button"
                                onClick={() => {
                                  setCustomStrand('')
                                  setSelectedStrand(st.name)
                                  if (st.subStrands[0]) {
                                    setSelectedSubStrand(st.subStrands[0].name)
                                  }
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                    : 'border-line hover:border-indigo-400/60'
                                }`}
                              >
                                <span
                                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                    selected
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {selected && <Check className="size-3 stroke-[3]" />}
                                </span>
                                <span className="text-sm font-semibold">{st.name}</span>
                              </button>
                            )
                          })}
                        </div>

                        <Field label="Or Custom Strand (optional)">
                          <Input
                            placeholder="Type a custom strand if not listed above…"
                            value={customStrand}
                            onChange={(e) => setCustomStrand(e.target.value)}
                          />
                        </Field>
                      </div>
                    )}

                    {/* STEP 5: Select Sub-Strand */}
                    {step === 5 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-bold">Select Sub-Strand</h3>
                          <p className="mt-0.5 text-xs text-mist">
                            Strand:{' '}
                            <strong className="text-inherit">
                              {customStrand.trim() || selectedStrand}
                            </strong>
                          </p>
                        </div>

                        <div className="space-y-2.5">
                          {subStrandsForStrand.map((ss) => {
                            const selected = !customSubStrand.trim() && ss.name === selectedSubStrand
                            return (
                              <button
                                key={ss.name}
                                type="button"
                                onClick={() => {
                                  setCustomSubStrand('')
                                  setSelectedSubStrand(ss.name)
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                                  selected
                                    ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                    : 'border-line hover:border-indigo-400/60'
                                }`}
                              >
                                <span
                                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                    selected
                                      ? 'border-indigo-600 bg-indigo-600 text-white'
                                      : 'border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  {selected && <Check className="size-3 stroke-[3]" />}
                                </span>
                                <span className="text-sm font-semibold">{ss.name}</span>
                              </button>
                            )
                          })}
                        </div>

                        <Field label="Or Custom Sub-Strand (optional)">
                          <Input
                            placeholder="Type a custom sub-strand…"
                            value={customSubStrand}
                            onChange={(e) => setCustomSubStrand(e.target.value)}
                          />
                        </Field>
                      </div>
                    )}

                    {/* STEP 6: Content Standard */}
                    {step === 6 && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-base font-bold">Content Standard</h3>
                          <p className="mt-0.5 text-xs text-mist">
                            Select or refine the curriculum content standard for{' '}
                            <strong className="text-inherit">
                              {customSubStrand.trim() || selectedSubStrand}
                            </strong>
                            .
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedStandard(computedContentStandard)}
                          className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-4 text-left transition ${
                            selectedStandard === computedContentStandard
                              ? 'border-indigo-600 bg-indigo-500/[0.06]'
                              : 'border-line hover:border-indigo-400/60'
                          }`}
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                            <Check className="size-3 stroke-[3]" />
                          </span>
                          <span className="text-sm font-semibold leading-relaxed">
                            {computedContentStandard}
                          </span>
                        </button>

                        <Field label="Customize Content Standard">
                          <Textarea
                            rows={2}
                            value={selectedStandard}
                            onChange={(e) => setSelectedStandard(e.target.value)}
                          />
                        </Field>
                      </div>
                    )}

                    {/* STEP 7: Learning Indicators & Topic */}
                    {step === 7 && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/[0.06] px-4 py-2.5 text-xs">
                          <span className="font-medium">
                            You can select a maximum of <strong>5 indicators</strong>
                          </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            Selected: {selectedIndicators.length}/5
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {Array.from(new Set([...indicatorOptions, ...selectedIndicators])).map(
                            (ind) => {
                              const checked = selectedIndicators.includes(ind)
                              return (
                                <button
                                  key={ind}
                                  type="button"
                                  onClick={() => toggleIndicator(ind)}
                                  className={`flex w-full items-start justify-between gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition ${
                                    checked
                                      ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                      : 'border-line hover:border-indigo-400/60'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span
                                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                                        checked
                                          ? 'border-indigo-600 bg-indigo-600 text-white'
                                          : 'border-slate-300 dark:border-slate-600'
                                      }`}
                                    >
                                      {checked && <Check className="size-3 stroke-[3]" />}
                                    </span>
                                    <span className="text-xs font-medium leading-relaxed sm:text-sm">
                                      {ind}
                                    </span>
                                  </div>
                                  {checked && (
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                                  )}
                                </button>
                              )
                            }
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Input
                            placeholder="Add custom learning indicator (e.g. B8.2.3.1.6 Add and modify text)…"
                            value={customIndicatorInput}
                            onChange={(e) => setCustomIndicatorInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addCustomIndicator()
                              }
                            }}
                          />
                          <Button type="button" variant="ghost" onClick={addCustomIndicator}>
                            <Plus className="size-4" />
                            Add
                          </Button>
                        </div>

                        <Field label="Lesson Topic / Title (optional)">
                          <Input
                            placeholder="e.g. Introduction to Desktop Publishing"
                            value={customTopic}
                            onChange={(e) => setCustomTopic(e.target.value)}
                          />
                        </Field>
                      </div>
                    )}

                    {/* STEP 8: Schedule, Curriculum Framework, AI Engine & Teaching Days */}
                    {step === 8 && (
                      <div className="space-y-5">
                        <Field label="Curriculum / Examination Board Alignment">
                          <Select
                            value={curriculumFramework}
                            onChange={(e) =>
                              setCurriculumFramework(e.target.value as CurriculumFrameworkId)
                            }
                          >
                            {CURRICULUM_FRAMEWORKS.map((fw) => (
                              <option key={fw.id} value={fw.id}>
                                {fw.label}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <Field label="Teacher Name">
                            {teacherScope.isTeacher ? (
                              <Input value={teacherName} disabled />
                            ) : availableTeachers.length > 0 ? (
                              <Select
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                              >
                                <option value="">Select teacher…</option>
                                {availableTeachers.map((tName) => (
                                  <option key={tName} value={tName}>
                                    {tName}
                                  </option>
                                ))}
                              </Select>
                            ) : (
                              <Input
                                placeholder="Enter teacher name"
                                value={teacherName}
                                onChange={(e) => setTeacherName(e.target.value)}
                              />
                            )}
                          </Field>

                          <Field label="Week">
                            <Select value={week} onChange={(e) => setWeek(e.target.value)}>
                              {Array.from({ length: 14 }, (_, i) => `Week ${i + 1}`).map((w) => (
                                <option key={w} value={w}>
                                  {w}
                                </option>
                              ))}
                            </Select>
                          </Field>
                        </div>

                        {/* Term Pills */}
                        <div>
                          <div className="mb-1.5 text-xs font-semibold text-mist">Term</div>
                          <div className="grid grid-cols-3 gap-2.5">
                            {availableTerms.slice(0, 3).map((tm) => {
                              const active = tm === term
                              return (
                                <button
                                  key={tm}
                                  type="button"
                                  onClick={() => setTerm(tm)}
                                  className={`rounded-xl border-2 px-3 py-2.5 text-xs font-bold transition ${
                                    active
                                      ? 'border-indigo-600 bg-indigo-500/[0.08] text-indigo-700 dark:text-indigo-300'
                                      : 'border-line hover:border-indigo-400/60'
                                  }`}
                                >
                                  {tm}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <Field label="Week Ending">
                            <DatePicker value={weekEnding} onChange={setWeekEnding} />
                          </Field>

                          <Field label="Duration">
                            <Input
                              placeholder="e.g. 55 minutes"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {['35 minutes', '45 minutes', '55 minutes', '70 minutes'].map((d) => (
                                <button
                                  key={d}
                                  type="button"
                                  onClick={() => setDuration(d)}
                                  className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-medium text-mist hover:text-inherit"
                                >
                                  {d.replace(' minutes', 'm')}
                                </button>
                              ))}
                            </div>
                          </Field>

                          <Field label="Class Size">
                            <Input
                              type="number"
                              min={1}
                              placeholder="e.g. 25"
                              value={classSize}
                              onChange={(e) => setClassSize(e.target.value)}
                            />
                          </Field>
                        </div>

                        {/* Choose AI Model */}
                        <div>
                          <div className="mb-2 text-xs font-semibold text-mist">Choose AI Model</div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setAiModel('free')}
                              className={`flex items-start justify-between rounded-xl border-2 p-3.5 text-left transition ${
                                aiModel === 'free'
                                  ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                  : 'border-line hover:border-indigo-400/60'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                                    aiModel === 'free'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                  }`}
                                >
                                  <Sparkles className="size-3.5" />
                                </span>
                                <div>
                                  <div className="text-xs font-bold sm:text-sm">Standard AI</div>
                                  <div className="mt-0.5 text-[11px] text-mist">
                                    Concise lesson plan with objectives, phases &amp; assessment
                                  </div>
                                </div>
                              </div>
                              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                FREE
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAiModel('pro')}
                              className={`flex items-start justify-between rounded-xl border-2 p-3.5 text-left transition ${
                                aiModel === 'pro'
                                  ? 'border-indigo-600 bg-indigo-500/[0.06]'
                                  : 'border-line hover:border-indigo-400/60'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <span
                                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                                    aiModel === 'pro'
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                  }`}
                                >
                                  <WandSparkles className="size-3.5" />
                                </span>
                                <div>
                                  <div className="text-xs font-bold sm:text-sm">
                                    Smart Curriculum Pro AI
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-mist">
                                    Detailed group tasks, differentiation &amp; formative checks
                                  </div>
                                </div>
                              </div>
                              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                PRO
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Select Days */}
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-semibold text-mist">Select Days</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedDays([...TEACHING_DAYS])}
                                className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-mist hover:text-inherit"
                              >
                                Select All
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedDays([])}
                                className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-mist hover:text-inherit"
                              >
                                Clear All
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                            {TEACHING_DAYS.map((day) => {
                              const checked = selectedDays.includes(day)
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleDay(day)}
                                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left transition ${
                                    checked
                                      ? 'border-indigo-600 bg-indigo-500/[0.07]'
                                      : 'border-line hover:border-indigo-400/60'
                                  }`}
                                >
                                  <span
                                    className={`flex size-4.5 shrink-0 items-center justify-center rounded-full border ${
                                      checked
                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                        : 'border-slate-300 dark:border-slate-600'
                                    }`}
                                  >
                                    {checked && <Check className="size-2.5 stroke-[3]" />}
                                  </span>
                                  <span className="text-xs font-semibold">{day}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bottom Wizard Navigation */}
                    <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
                      <Button
                        variant="ghost"
                        disabled={step === 1}
                        onClick={() => setStep((s) => Math.max(1, s - 1))}
                      >
                        <ChevronLeft className="size-4" />
                        Back
                      </Button>

                      {step < STEP_LABELS.length ? (
                        <button
                          type="button"
                          onClick={() => setStep((s) => Math.min(STEP_LABELS.length, s + 1))}
                          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                          style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                          }}
                        >
                          Continue
                          <ChevronRight className="size-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleGenerateLessonPlan}
                          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95"
                          style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                          }}
                        >
                          <WandSparkles className="size-4" />
                          Generate Lesson Plan
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Live Curriculum Summary Card */}
              <div className="lg:col-span-4">
                <div className="sticky top-4 rounded-2xl border border-line bg-surface p-5 shadow-2xs">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-600 uppercase dark:text-indigo-400">
                    <Sparkles className="size-4" />
                    <span>Lesson Plan Summary</span>
                  </div>

                  <dl className="mt-4 space-y-3 text-xs">
                    <div className="flex justify-between gap-2 border-b border-line/60 pb-2">
                      <dt className="text-mist">School</dt>
                      <dd className="text-right font-semibold">{schoolName}</dd>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-line/60 pb-2">
                      <dt className="text-mist">Level &amp; Class</dt>
                      <dd className="text-right font-semibold">
                        {selectedClass || '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2 border-b border-line/60 pb-2">
                      <dt className="text-mist">Subject</dt>
                      <dd className="text-right font-semibold">{selectedSubject}</dd>
                    </div>
                    <div className="border-b border-line/60 pb-2">
                      <dt className="text-mist">Strand / Sub-Strand</dt>
                      <dd className="mt-0.5 font-semibold">
                        {customStrand.trim() || selectedStrand} →{' '}
                        {customSubStrand.trim() || selectedSubStrand}
                      </dd>
                    </div>
                    <div className="border-b border-line/60 pb-2">
                      <dt className="text-mist">Content Standard</dt>
                      <dd className="mt-0.5 line-clamp-2 font-medium">{selectedStandard}</dd>
                    </div>
                    <div className="border-b border-line/60 pb-2">
                      <dt className="text-mist">Indicators Selected</dt>
                      <dd className="mt-0.5 font-semibold">
                        {selectedIndicators.length} of 5 max
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-mist">Schedule</dt>
                      <dd className="text-right font-semibold">
                        {term} · {week} ({selectedDays.length} day
                        {selectedDays.length === 1 ? '' : 's'})
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={handleGenerateLessonPlan}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:opacity-95"
                    style={{
                      background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                    }}
                  >
                    <WandSparkles className="size-4" />
                    Quick Generate Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODE 2 & 3: LESSON PLANS REGISTER & LESSON PLAN APPROVALS
         ===================================================================== */}
      {mode !== 'generator' && (
        <div className="space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lesson Plans"
              value={String(stats.total)}
              hint="Saved curriculum lesson plans"
              icon={<BookText className="size-4" />}
            />
            <StatCard
              label="Approved"
              value={String(stats.approved)}
              hint="Cleared for classroom delivery"
              icon={<CheckCircle2 className="size-4" />}
            />
            <StatCard
              label="Pending Approval"
              value={String(stats.pending)}
              hint="Awaiting academic review"
              icon={<Clock className="size-4" />}
            />
            <StatCard
              label="Topics Covered"
              value={String(new Set(parsedPlans.map((n) => n.topic)).size)}
              hint="Unique lesson topics"
              icon={<ListChecks className="size-4" />}
            />
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-[220px] flex-1">
              <SearchInput
                value={searchQ}
                onChange={setSearchQ}
                placeholder="Search subject, topic, strand, sub-strand, class, or teacher…"
              />
            </div>
            <div className="w-36">
              <Select value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
                <option value="">All Terms</option>
                {availableTerms.map((tm) => (
                  <option key={tm} value={tm}>
                    {tm}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
                <option value="">All Classes</option>
                {Array.from(new Set(parsedPlans.map((n) => n.className))).map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-40">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">
                  {mode === 'approvals' ? 'Submitted Statuses' : 'All Statuses'}
                </option>
                {mode !== 'approvals' && <option value="Draft">Draft</option>}
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Returned">Returned</option>
              </Select>
            </div>
          </div>

          {/* Table */}
          {filteredPlans.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface pb-10">
              <Empty
                title={
                  mode === 'approvals'
                    ? 'No lesson plans awaiting review'
                    : 'No lesson plans found'
                }
                desc="Generate a structured lesson plan (WAEC / WASSCE & Pan-African curriculum aligned) in seconds using the guided generator."
              />
              <div className="flex justify-center">
                <Button
                  onClick={() => navigate('/admin/education-management/lesson-plan/generate')}
                >
                  <WandSparkles className="size-4" />
                  Generate Lesson Plan
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-line bg-black/[0.02] text-[11px] font-bold tracking-wider text-mist uppercase dark:bg-white/[0.02]">
                    <th className="px-4 py-3">Week / Term</th>
                    <th className="px-4 py-3">Class &amp; Subject</th>
                    <th className="px-4 py-3">Topic</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3 text-center">Duration</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="transition hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold">{plan.week}</div>
                        <div className="text-[11px] text-mist">
                          {plan.term} · Ends {plan.weekEnding}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold">{plan.subject}</div>
                        <div className="text-[11px] text-mist">{plan.className}</div>
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="truncate font-semibold">{plan.topic}</div>
                        <div className="truncate text-[11px] text-mist">{plan.subStrand}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                        {plan.teacher || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          {plan.duration}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge tone={statusTone(plan.status)}>{plan.status}</Badge>
                        {plan.reviewerComment && (
                          <div className="mt-1 max-w-[160px] truncate text-[10px] text-mist">
                            “{plan.reviewerComment}”
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingPlan(plan)
                              setViewingLessonIdx(0)
                            }}
                            className="rounded-lg p-1.5 text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
                            aria-label="View lesson plan"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDownloadTarget(plan)
                            }}
                            className="rounded-lg p-1.5 text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
                            aria-label="Download lesson plan"
                          >
                            <Download className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(plan)}
                            className="rounded-lg p-1.5 text-mist transition hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-500/20"
                            aria-label="Delete lesson plan"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* View / Edit Modal */}
      {viewingPlan && (
        <Modal
          open
          onClose={() => {
            setViewingPlan(null)
            setEditingModalPlan(false)
          }}
          title={`${viewingPlan.subject} · ${viewingPlan.className}`}
          maxWidth="2xl"
          actions={
            <>
              {editingModalPlan && (
                <Button onClick={saveModalEditedPlan}>
                  <Save className="size-4" />
                  Save
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setViewingPlan(null)
                  setEditingModalPlan(false)
                }}
              >
                Close
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(viewingPlan.status)}>{viewingPlan.status}</Badge>
              <span className="text-xs text-mist">
                {viewingPlan.term} · {viewingPlan.week} · {viewingPlan.duration}
              </span>
              {!editingModalPlan && (
                <button
                  type="button"
                  onClick={() => setEditingModalPlan(true)}
                  className="ml-auto rounded-lg p-1.5 text-mist transition hover:bg-black/[0.04] hover:text-inherit dark:hover:bg-white/[0.06]"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </div>
            <LessonPlanSheet
              plan={viewingPlan}
              editing={editingModalPlan}
              onUpdatePlan={(patch) => setViewingPlan((p) => (p ? { ...p, ...patch } : p))}
            />
          </div>
        </Modal>
      )}

      {/* Download Modal */}
      <DownloadLessonPlanModal
        plan={downloadTarget}
        onClose={() => setDownloadTarget(null)}
        onPrintPdf={handlePrintPdf}
        onDownloadDocx={(plan, orientation) => {
          downloadLessonPlanDocx(plan, orientation)
          setDownloadTarget(null)
          toast.success(
            'Word document downloaded',
            `${orientation === 'landscape' ? 'Landscape' : 'Portrait'} editable .docx saved.`,
          )
        }}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="Delete Lesson Plan"
          maxWidth="sm"
          actions={
            <>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-mist">
            Are you sure you want to delete the lesson plan for{' '}
            <strong className="text-inherit">
              {deleteTarget.subject} · {deleteTarget.className} ({deleteTarget.week})
            </strong>
            ? This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
