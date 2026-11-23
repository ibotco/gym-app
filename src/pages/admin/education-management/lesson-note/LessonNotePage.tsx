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

const todayISO = () => new Date().toISOString().slice(0, 10)
import {
  CURRICULUM_FRAMEWORKS,
  SCHOOL_LEVELS,
  SHS_PROGRAMMES,
  SUBJECT_CATEGORIES,
  TEACHING_DAYS,
  classCodeToken,
  generateWeeklyLessonNotes,
  getCurriculumForSubject,
  getProgrammeOption,
  getSubjectDefinition,
  getSubjectsForLevel,
  getSubjectsForProgramme,
  inferLevelFromClassName,
  inferSubjectCategory,
  parseLessonNoteRow,
  serializeLessonNoteToRow,
  type CurriculumFrameworkId,
  type DailyLessonEntry,
  type ParsedLessonNote,
  type SchoolLevelId,
  type ShsProgrammeId,
  type SubjectCategoryId,
} from './lessonNoteCurriculum'
import { downloadLessonNoteDocx } from './lessonNoteDocx'

export type LessonNoteLeafMode = 'generator' | 'register' | 'approvals'

const STEP_LABELS = [
  'School Level',
  'Class',
  'Subject',
  'Strand',
  'Sub-Strand',
  'Content Standard',
  'Indicators',
  'Schedule & AI',
] as const

function statusTone(status: ParsedLessonNote['status']): 'lime' | 'amber' | 'rose' | 'zinc' {
  if (status === 'Approved') return 'lime'
  if (status === 'Pending') return 'amber'
  if (status === 'Returned') return 'rose'
  return 'zinc'
}

function formatTermBanner(term: string): string {
  const t = String(term || 'Term 1').trim()
  if (/1/.test(t)) return '1ST TERM – WEEKLY LESSON NOTES'
  if (/2/.test(t)) return '2ND TERM – WEEKLY LESSON NOTES'
  if (/3/.test(t)) return '3RD TERM – WEEKLY LESSON NOTES'
  return `${t.toUpperCase()} – WEEKLY LESSON NOTES`
}

/**
 * Crisp white-paper renderer for one or all daily lessons of a Ghana NaCCA
 * Weekly Lesson Note (matching the EduMate GH Lesson Note layout).
 */
function WeeklyLessonNoteSheet({
  note,
  lessonIndex,
  editing,
  onUpdateLesson,
}: {
  note: ParsedLessonNote
  lessonIndex: number
  editing: boolean
  onUpdateLesson?: (idx: number, patch: Partial<DailyLessonEntry>) => void
}) {
  const lesson = note.dailyLessons[lessonIndex] ?? note.dailyLessons[0]
  if (!lesson) return null

  const labelCell: React.CSSProperties = {
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    fontWeight: 700,
    fontSize: 12,
    padding: '9px 12px',
    border: '1px solid #cbd5e1',
    verticalAlign: 'top',
    width: '20%',
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
      {/* Purple Weekly Lesson Notes Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
          color: '#ffffff',
          padding: '16px 20px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.04em' }}>
          {formatTermBanner(note.term)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e7ff', marginTop: 2 }}>
          {note.week} · {note.subject}
        </div>
        <div style={{ fontSize: 11.5, color: '#c7d2fe', marginTop: 3 }}>
          {note.schoolName}
          {note.teacher ? ` · Facilitator: ${note.teacher}` : ''}
        </div>
      </div>

      {/* Metadata Table */}
      <div style={{ padding: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            <tr>
              <td style={labelCell}>Week Ending</td>
              <td style={{ ...valueCell, width: '34%' }}>{note.weekEnding || '—'}</td>
              <td style={{ ...labelCell, width: '18%' }}>Day</td>
              <td style={{ ...valueCell, width: '28%', fontWeight: 600 }}>{lesson.day}</td>
            </tr>
            <tr>
              <td style={labelCell}>Duration</td>
              <td style={valueCell}>{note.duration}</td>
              <td style={{ ...labelCell, width: '18%' }}>Strand</td>
              <td style={valueCell}>{note.strand}</td>
            </tr>
            <tr>
              <td style={labelCell}>Class</td>
              <td style={{ ...valueCell, fontWeight: 600 }}>{note.className}</td>
              <td style={{ ...labelCell, width: '18%' }}>Class Size</td>
              <td style={valueCell}>{note.classSize}</td>
            </tr>
            <tr>
              <td style={labelCell}>Sub Strand</td>
              <td colSpan={3} style={{ ...valueCell, fontWeight: 600 }}>
                {note.subStrand}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Content Standard</td>
              <td colSpan={3} style={valueCell}>
                {note.contentStandard}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Indicator</td>
              <td colSpan={3} style={valueCell}>
                {editing && onUpdateLesson ? (
                  <input
                    type="text"
                    value={lesson.indicatorText}
                    onChange={(e) => onUpdateLesson(lessonIndex, { indicatorText: e.target.value })}
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
                  <span style={{ fontWeight: 600 }}>{lesson.indicatorText}</span>
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Performance Indicator</td>
              <td colSpan={3} style={valueCell}>
                {editing && onUpdateLesson ? (
                  <textarea
                    rows={2}
                    value={lesson.performanceIndicator}
                    onChange={(e) =>
                      onUpdateLesson(lessonIndex, { performanceIndicator: e.target.value })
                    }
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
                  lesson.performanceIndicator
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Core Competencies</td>
              <td colSpan={3} style={valueCell}>
                {editing && onUpdateLesson ? (
                  <input
                    type="text"
                    value={lesson.coreCompetencies}
                    onChange={(e) =>
                      onUpdateLesson(lessonIndex, { coreCompetencies: e.target.value })
                    }
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
                  lesson.coreCompetencies
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>References</td>
              <td colSpan={3} style={valueCell}>
                {editing && onUpdateLesson ? (
                  <input
                    type="text"
                    value={lesson.references}
                    onChange={(e) => onUpdateLesson(lessonIndex, { references: e.target.value })}
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
                  lesson.references
                )}
              </td>
            </tr>
            <tr>
              <td style={labelCell}>Keywords</td>
              <td colSpan={3} style={valueCell}>
                {editing && onUpdateLesson ? (
                  <input
                    type="text"
                    value={lesson.keywords}
                    onChange={(e) => onUpdateLesson(lessonIndex, { keywords: e.target.value })}
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
                  lesson.keywords
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3-Phase Lesson Delivery Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            marginTop: 14,
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#eef2ff' }}>
              <th
                style={{
                  ...labelCell,
                  backgroundColor: '#eef2ff',
                  color: '#312e81',
                  textAlign: 'left',
                  width: '22%',
                }}
              >
                Phase / Duration
              </th>
              <th
                style={{
                  ...labelCell,
                  backgroundColor: '#eef2ff',
                  color: '#312e81',
                  textAlign: 'left',
                  width: '54%',
                }}
              >
                Learners Activities
              </th>
              <th
                style={{
                  ...labelCell,
                  backgroundColor: '#eef2ff',
                  color: '#312e81',
                  textAlign: 'left',
                  width: '24%',
                }}
              >
                Resources (TLMs)
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Phase 1 */}
            <tr>
              <td style={labelCell}>
                <div style={{ color: '#4338ca', fontWeight: 800 }}>PHASE 1: STARTER</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 3 }}>
                  ({lesson.starterDuration} — Preparing the Brain for Learning)
                </div>
              </td>
              <td style={{ ...valueCell, whiteSpace: 'pre-line' }}>
                {editing && onUpdateLesson ? (
                  <textarea
                    rows={4}
                    value={lesson.starterActivities}
                    onChange={(e) =>
                      onUpdateLesson(lessonIndex, { starterActivities: e.target.value })
                    }
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
                  lesson.starterActivities
                )}
              </td>
              <td style={{ ...valueCell, whiteSpace: 'pre-line' }}>
                {editing && onUpdateLesson ? (
                  <textarea
                    rows={3}
                    value={lesson.resources}
                    onChange={(e) => onUpdateLesson(lessonIndex, { resources: e.target.value })}
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
                  lesson.resources
                )}
              </td>
            </tr>

            {/* Phase 2 */}
            <tr>
              <td style={labelCell}>
                <div style={{ color: '#4338ca', fontWeight: 800 }}>PHASE 2: NEW LEARNING</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 3 }}>
                  ({lesson.mainDuration} — Main Activities &amp; Assessment)
                </div>
              </td>
              <td style={{ ...valueCell, whiteSpace: 'pre-line' }}>
                {editing && onUpdateLesson ? (
                  <textarea
                    rows={8}
                    value={lesson.mainActivities}
                    onChange={(e) =>
                      onUpdateLesson(lessonIndex, { mainActivities: e.target.value })
                    }
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
                  lesson.mainActivities
                )}
              </td>
              <td style={{ ...valueCell, whiteSpace: 'pre-line' }}>{lesson.resources}</td>
            </tr>

            {/* Phase 3 */}
            <tr>
              <td style={labelCell}>
                <div style={{ color: '#4338ca', fontWeight: 800 }}>PHASE 3: REFLECTION</div>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 3 }}>
                  ({lesson.reflectionDuration} — Learner &amp; Teacher Review)
                </div>
              </td>
              <td style={{ ...valueCell, whiteSpace: 'pre-line' }}>
                {editing && onUpdateLesson ? (
                  <textarea
                    rows={4}
                    value={lesson.reflectionActivities}
                    onChange={(e) =>
                      onUpdateLesson(lessonIndex, { reflectionActivities: e.target.value })
                    }
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
                  lesson.reflectionActivities
                )}
              </td>
              <td style={valueCell}>Exit tickets, learner notebooks, take-home exercise</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Download Lesson Note Modal — matches the reference video's 4 format options:
 *  - Portrait PDF (Vertical layout)
 *  - Landscape PDF (Horizontal layout)
 *  - Portrait DOCX (editable) (Vertical layout)
 *  - Landscape DOCX (editable) (Horizontal layout)
 */
function DownloadLessonNoteModal({
  note,
  onClose,
  onPrintPdf,
  onDownloadDocx,
}: {
  note: ParsedLessonNote | null
  onClose: () => void
  onPrintPdf: (note: ParsedLessonNote, orientation: 'portrait' | 'landscape') => void
  onDownloadDocx: (note: ParsedLessonNote, orientation: 'portrait' | 'landscape') => void
}) {
  if (!note) return null
  return (
    <Modal open={!!note} onClose={onClose} title="Download Lesson Note">
      <div className="space-y-4">
        <p className="text-xs text-mist">
          Select Format for <strong className="text-inherit">{note.subject}</strong> ·{' '}
          <strong className="text-inherit">{note.className}</strong> ({note.week}, {note.term})
        </p>

        {/* PDF Section */}
        <div>
          <div className="mb-2 text-[11px] font-bold tracking-wider text-mist uppercase">PDF</div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onPrintPdf(note, 'portrait')}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-indigo-500/60 hover:bg-indigo-500/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <FileText className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Portrait PDF</div>
                  <div className="text-xs text-mist">Vertical layout · Print-ready A4 PDF</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-mist" />
            </button>

            <button
              type="button"
              onClick={() => onPrintPdf(note, 'landscape')}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-indigo-500/60 hover:bg-indigo-500/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <FileText className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Landscape PDF</div>
                  <div className="text-xs text-mist">Horizontal layout · Wide table A4 PDF</div>
                </div>
              </div>
              <ChevronRight className="size-4 text-mist" />
            </button>
          </div>
        </div>

        {/* WORD DOCUMENT Section */}
        <div>
          <div className="mb-2 text-[11px] font-bold tracking-wider text-mist uppercase">
            Word Document
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onDownloadDocx(note, 'portrait')}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-emerald-500/60 hover:bg-emerald-500/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BookText className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Portrait DOCX (editable)</div>
                  <div className="text-xs text-mist">
                    Vertical layout · Microsoft Word / Google Docs
                  </div>
                </div>
              </div>
              <ChevronRight className="size-4 text-mist" />
            </button>

            <button
              type="button"
              onClick={() => onDownloadDocx(note, 'landscape')}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition hover:border-emerald-500/60 hover:bg-emerald-500/[0.04]"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BookText className="size-4.5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Landscape DOCX (editable)</div>
                  <div className="text-xs text-mist">
                    Horizontal layout · Microsoft Word / Google Docs
                  </div>
                </div>
              </div>
              <ChevronRight className="size-4 text-mist" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function LessonNotePage({ mode }: { mode: LessonNoteLeafMode }) {
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

  const persistLessonNotes = (nextRows: EduRow[]) => {
    const nextRecords: EduRecords = {
      ...records,
      lessonNotes: nextRows,
    }
    setRecords(nextRecords)
    saveEduRecords(activeBranchId, nextRecords)
  }

  // All Lesson Notes (scoped automatically when a Teacher logs in)
  const rawRows = (records.lessonNotes ?? []) as EduRow[]
  const scopedRows = useMemo(
    () =>
      teacherScope.isTeacher
        ? teacherScope.filterLeafRows('lessonNotes', rawRows)
        : rawRows,
    [teacherScope, rawRows],
  )
  const parsedNotes = useMemo(() => scopedRows.map(parseLessonNoteRow), [scopedRows])

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
  // 8-Step Guided / AI Generator State
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

  const [teacherName, setTeacherName] = useState<string>('')
  const [term, setTerm] = useState<string>('Term 1')
  const [week, setWeek] = useState<string>('Week 5')
  const [weekEnding, setWeekEnding] = useState<string>(todayISO())
  const [duration, setDuration] = useState<string>('55 minutes')
  const [classSize, setClassSize] = useState<string>('28')
  const [aiModel, setAiModel] = useState<'free' | 'pro'>('pro')
  const [curriculumFramework, setCurriculumFramework] =
    useState<CurriculumFrameworkId>('waec-wassce')
  const [selectedDays, setSelectedDays] = useState<string[]>(['Monday', 'Wednesday', 'Friday'])

  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [genProgress, setGenProgress] = useState<number>(0)
  const [generatedDraft, setGeneratedDraft] = useState<ParsedLessonNote | null>(null)
  const [activeLessonIdx, setActiveLessonIdx] = useState<number>(0)
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

    // Apply SHS programme filter (Ghana / West African SHS programmes)
    let programmedSubjects: string[]
    if (levelId === 'shs' && selectedProgramme !== 'all-programmes') {
      programmedSubjects = getSubjectsForProgramme(selectedProgramme, levelId)
    } else {
      programmedSubjects = levelSubjects
    }

    if (teacherScope.isTeacher) {
      const assignedForClass = teacherScope.subjectsForClass(selectedClass)
      if (assignedForClass.length > 0) {
        // Intersect assigned subjects with programme scope
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

  // Pre-select first 3 indicators whenever sub-strand changes so wizard is smooth
  useEffect(() => {
    setSelectedIndicators(indicatorOptions.slice(0, Math.min(3, indicatorOptions.length)))
  }, [indicatorOptions])

  const toggleIndicator = (ind: string) => {
    setSelectedIndicators((prev) => {
      if (prev.includes(ind)) return prev.filter((item) => item !== ind)
      if (prev.length >= 5) {
        toast.error('Maximum 5 indicators', 'You can select up to 5 indicators per weekly lesson note.')
        return prev
      }
      return [...prev, ind]
    })
  }

  const addCustomIndicator = () => {
    const clean = customIndicatorInput.trim()
    if (!clean) return
    if (selectedIndicators.length >= 5) {
      toast.error('Maximum 5 indicators', 'You can select up to 5 indicators per weekly lesson note.')
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

  const handleGenerateLessonNote = () => {
    if (!selectedClass) {
      toast.error('Select a class', 'Please choose a class before generating.')
      return
    }
    if (selectedDays.length === 0) {
      toast.error('Select at least one day', 'Choose one or more teaching days (Monday–Friday).')
      return
    }

    setIsGenerating(true)
    setGenProgress(12)

    const resolvedStrand = customStrand.trim() || selectedStrand
    const resolvedSubStrand = customSubStrand.trim() || selectedSubStrand
    const orderedDays = TEACHING_DAYS.filter((d) => selectedDays.includes(d))

    const t1 = window.setTimeout(() => setGenProgress(48), 260)
    const t2 = window.setTimeout(() => setGenProgress(84), 560)
    const t3 = window.setTimeout(() => {
      const dailyLessons = generateWeeklyLessonNotes({
        className: selectedClass,
        levelId,
        subject: selectedSubject,
        strand: resolvedStrand,
        subStrand: resolvedSubStrand,
        contentStandard: selectedStandard,
        indicators: selectedIndicators,
        duration,
        days: orderedDays,
        aiModel,
        curriculumFramework,
      })

      const levelLabel =
        SCHOOL_LEVELS.find((l) => l.id === levelId)?.name ||
        'Senior High / Senior Secondary (SHS / SSS)'

      const newDraft: ParsedLessonNote = {
        id: uid(),
        schoolName,
        teacher: teacherName || user?.name || 'Subject Facilitator',
        level: levelLabel,
        className: selectedClass,
        subject: selectedSubject,
        strand: resolvedStrand,
        subStrand: resolvedSubStrand,
        contentStandard: selectedStandard,
        indicators: selectedIndicators,
        term,
        week,
        weekEnding,
        duration,
        classSize,
        aiModel,
        curriculumFramework,
        days: orderedDays,
        dailyLessons,
        status: 'Draft',
        submittedOn: '',
        reviewerComment: '',
        reviewedBy: '',
        createdAt: todayISO(),
      }

      setGenProgress(100)
      setIsGenerating(false)
      setGeneratedDraft(newDraft)
      setActiveLessonIdx(0)
      setIsEditingGenerated(false)
      toast.success(
        'Lesson Note generated',
        `Created ${dailyLessons.length} daily lesson${dailyLessons.length === 1 ? '' : 's'} for ${selectedSubject} (${selectedClass}).`,
      )
    }, 880)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }

  const updateGeneratedDailyLesson = (idx: number, patch: Partial<DailyLessonEntry>) => {
    setGeneratedDraft((prev) => {
      if (!prev) return prev
      const nextLessons = prev.dailyLessons.map((item, i) =>
        i === idx ? { ...item, ...patch } : item,
      )
      return { ...prev, dailyLessons: nextLessons }
    })
  }

  const saveGeneratedNote = (submitForApproval = false) => {
    if (!generatedDraft) return
    const nextNote: ParsedLessonNote = {
      ...generatedDraft,
      status: submitForApproval ? 'Pending' : generatedDraft.status,
      submittedOn: submitForApproval ? todayISO() : generatedDraft.submittedOn,
    }
    const serialized = serializeLessonNoteToRow(nextNote)
    const exists = rawRows.some((r) => r.id === nextNote.id)
    const nextRows = exists
      ? rawRows.map((r) => (r.id === nextNote.id ? serialized : r))
      : [serialized, ...rawRows]

    persistLessonNotes(nextRows)
    setGeneratedDraft(nextNote)
    setIsEditingGenerated(false)
    toast.success(
      submitForApproval ? 'Submitted for approval' : 'Lesson Note saved',
      `${nextNote.subject} · ${nextNote.className} (${nextNote.week})`,
    )
  }

  // ---------------------------------------------------------------------------
  // Register / Approvals State & Modals
  // ---------------------------------------------------------------------------
  const [searchQ, setSearchQ] = useState('')
  const [termFilter, setTermFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [viewingNote, setViewingNote] = useState<ParsedLessonNote | null>(null)
  const [viewingLessonIdx, setViewingLessonIdx] = useState<number>(0)
  const [editingModalNote, setEditingModalNote] = useState<boolean>(false)
  const [reviewerRemarks, setReviewerRemarks] = useState<string>('')

  const [downloadTarget, setDownloadTarget] = useState<ParsedLessonNote | null>(null)
  const [printJob, setPrintJob] = useState<{
    note: ParsedLessonNote
    orientation: 'portrait' | 'landscape'
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ParsedLessonNote | null>(null)

  const handlePrintPdf = (note: ParsedLessonNote, orientation: 'portrait' | 'landscape') => {
    setDownloadTarget(null)
    setPrintJob({ note, orientation })
    setTimeout(() => {
      const prevTitle = document.title
      document.title = `${note.subject}_${note.className}_${note.week}_LessonNote`
      const cleanup = () => {
        document.title = prevTitle
        setPrintJob(null)
        window.removeEventListener('afterprint', cleanup)
      }
      window.addEventListener('afterprint', cleanup)
      window.print()
    }, 120)
  }

  const handleDownloadDocx = (
    note: ParsedLessonNote,
    orientation: 'portrait' | 'landscape',
  ) => {
    downloadLessonNoteDocx(note, orientation)
    setDownloadTarget(null)
    toast.success(
      'Word document downloaded',
      `${orientation === 'landscape' ? 'Landscape' : 'Portrait'} editable .docx saved.`,
    )
  }

  const handleStatusDecision = (
    note: ParsedLessonNote,
    decision: 'Approved' | 'Returned' | 'Pending',
    comment?: string,
  ) => {
    const updated: ParsedLessonNote = {
      ...note,
      status: decision,
      submittedOn: decision === 'Pending' ? todayISO() : note.submittedOn || todayISO(),
      reviewerComment: comment !== undefined ? comment : note.reviewerComment,
      reviewedBy:
        decision === 'Approved' || decision === 'Returned'
          ? user?.name || 'Academic Head'
          : note.reviewedBy,
    }
    const serialized = serializeLessonNoteToRow(updated)
    const nextRows = rawRows.map((r) => (r.id === updated.id ? serialized : r))
    persistLessonNotes(nextRows)
    if (viewingNote?.id === updated.id) setViewingNote(updated)
    toast.success(
      decision === 'Approved'
        ? 'Lesson Note approved'
        : decision === 'Returned'
          ? 'Returned for revision'
          : 'Submitted for approval',
      `${updated.subject} · ${updated.className} (${updated.week})`,
    )
  }

  const saveModalEditedNote = () => {
    if (!viewingNote) return
    const serialized = serializeLessonNoteToRow(viewingNote)
    const nextRows = rawRows.map((r) => (r.id === viewingNote.id ? serialized : r))
    persistLessonNotes(nextRows)
    setEditingModalNote(false)
    toast.success('Lesson Note updated', `${viewingNote.subject} · ${viewingNote.className}`)
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    persistLessonNotes(rawRows.filter((r) => r.id !== deleteTarget.id))
    if (viewingNote?.id === deleteTarget.id) setViewingNote(null)
    toast.success('Lesson Note deleted', `${deleteTarget.subject} · ${deleteTarget.week}`)
    setDeleteTarget(null)
  }

  const filteredNotes = useMemo(() => {
    const q = searchQ.trim().toLowerCase()
    return parsedNotes.filter((n) => {
      if (mode === 'approvals' && !statusFilter && n.status === 'Draft') return false
      if (termFilter && n.term !== termFilter) return false
      if (classFilter && n.className !== classFilter) return false
      if (statusFilter && n.status !== statusFilter) return false
      if (!q) return true
      return (
        n.subject.toLowerCase().includes(q) ||
        n.className.toLowerCase().includes(q) ||
        n.strand.toLowerCase().includes(q) ||
        n.subStrand.toLowerCase().includes(q) ||
        n.teacher.toLowerCase().includes(q) ||
        n.week.toLowerCase().includes(q)
      )
    })
  }, [parsedNotes, mode, searchQ, termFilter, classFilter, statusFilter])

  const stats = useMemo(() => {
    const total = parsedNotes.length
    const approved = parsedNotes.filter((n) => n.status === 'Approved').length
    const pending = parsedNotes.filter((n) => n.status === 'Pending').length
    const dailyCount = parsedNotes.reduce((sum, n) => sum + n.dailyLessons.length, 0)
    return { total, approved, pending, dailyCount }
  }, [parsedNotes])

  const progressPct = Math.round((step / STEP_LABELS.length) * 100)

  return (
    <div>
      {/* Dedicated Print Style & Root for Portrait / Landscape A4 PDF export */}
      {printJob &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="lesson-note-print-root">
            <style>{`
              @media screen {
                .lesson-note-print-root { display: none !important; }
              }
              @media print {
                @page { size: A4 ${printJob.orientation}; margin: 10mm; }
                body > *:not(.lesson-note-print-root) { display: none !important; }
                .lesson-note-print-root {
                  display: block !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                }
                .lesson-note-print-page {
                  page-break-after: always;
                  break-after: page;
                }
                .lesson-note-print-page:last-child {
                  page-break-after: auto;
                  break-after: auto;
                }
              }
            `}</style>
            {printJob.note.dailyLessons.map((_, idx) => (
              <div key={idx} className="lesson-note-print-page">
                <WeeklyLessonNoteSheet
                  note={printJob.note}
                  lessonIndex={idx}
                  editing={false}
                />
              </div>
            ))}
          </div>,
          document.body,
        )}

      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        <span>/</span>
        <span>Education Management</span>
        <span>/</span>
        <span>{t('nav.eduLessonNote')}</span>
        <span>/</span>
        <span className="font-semibold text-inherit">
          {mode === 'generator'
            ? t('nav.eduLessonNoteGenerator')
            : mode === 'approvals'
              ? t('nav.eduLessonNoteApprovals')
              : t('nav.eduLessonNotes')}
        </span>
      </div>

      <PageHeader
        title={
          mode === 'generator'
            ? t('nav.eduLessonNoteGenerator')
            : mode === 'approvals'
              ? t('nav.eduLessonNoteApprovals')
              : t('nav.eduLessonNotes')
        }
        desc={
          mode === 'generator'
            ? `${schoolName} — Generate structured weekly lesson notes across West African (WAEC / WASSCE) & Pan-African curricula, customize inline, and export to PDF or editable Word (.docx).`
            : mode === 'approvals'
              ? `${schoolName} — Review submitted weekly lesson notes, provide academic feedback, and approve for classroom delivery.`
              : `${schoolName} — Manage, preview, customize, and download weekly lesson notes across classes and subjects.`
        }
        actions={
          mode === 'generator' ? (
            <Button
              variant="ghost"
              onClick={() => navigate('/admin/education-management/lesson-note/lesson-notes')}
            >
              <BookOpen className="size-4" />
              Saved Lesson Notes ({parsedNotes.length})
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/admin/education-management/lesson-note/generate')}
            >
              <WandSparkles className="size-4" />
              Generate Lesson Note
            </Button>
          )
        }
      />

      {/* =====================================================================
          MODE 1: GUIDED / AI WEEKLY LESSON NOTE GENERATOR
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
                Structuring Starter, Main Learning, Assessment &amp; Reflection for{' '}
                {selectedDays.length} teaching day{selectedDays.length === 1 ? '' : 's'}…
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
            /* Generated Weekly Lesson Notes Viewer & Editor */
            <div className="space-y-4">
              {/* Top Action & Lesson Navigation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setGeneratedDraft(null)}
                  >
                    <RotateCcw className="size-4" />
                    Back to Generator
                  </Button>
                  <Badge tone={statusTone(generatedDraft.status)}>{generatedDraft.status}</Badge>
                </div>

                {/* Previous / Lesson X of N / Next (matching video) */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeLessonIdx === 0}
                    onClick={() => setActiveLessonIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </button>
                  <span className="px-2 text-xs font-bold">
                    Lesson {activeLessonIdx + 1} of {generatedDraft.dailyLessons.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeLessonIdx >= generatedDraft.dailyLessons.length - 1}
                    onClick={() =>
                      setActiveLessonIdx((i) =>
                        Math.min(generatedDraft.dailyLessons.length - 1, i + 1),
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]"
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                {/* Customize / Save / Submit / Download Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditingGenerated((v) => !v)}
                  >
                    <Pencil className="size-4" />
                    {isEditingGenerated ? 'Done Editing' : 'Edit Content'}
                  </Button>
                  <Button variant="ghost" onClick={() => saveGeneratedNote(false)}>
                    <Save className="size-4" />
                    Save Draft
                  </Button>
                  <Button variant="ghost" onClick={() => saveGeneratedNote(true)}>
                    <Send className="size-4" />
                    Submit for Approval
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      saveGeneratedNote(false)
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

              {/* Day Quick Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {generatedDraft.dailyLessons.map((dl, idx) => (
                  <button
                    key={dl.day + idx}
                    type="button"
                    onClick={() => setActiveLessonIdx(idx)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      idx === activeLessonIdx
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'border border-line bg-surface text-mist hover:text-inherit'
                    }`}
                  >
                    Lesson {idx + 1}: {dl.day}
                  </button>
                ))}
              </div>

              {/* Weekly Lesson Note Sheet */}
              <WeeklyLessonNoteSheet
                note={generatedDraft}
                lessonIndex={activeLessonIdx}
                editing={isEditingGenerated}
                onUpdateLesson={updateGeneratedDailyLesson}
              />

              {/* Full-width bottom Download Bar (matching mobile preview CTA in video) */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    saveGeneratedNote(false)
                    setDownloadTarget(generatedDraft)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition hover:opacity-95"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                  }}
                >
                  <Download className="size-4" />
                  Download Lesson Note (PDF / Editable DOCX)
                </button>
              </div>
            </div>
          ) : (
            /* 8-Step Guided Curriculum & AI Lesson Note Setup */
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xs">
                  {/* Purple Step Header & Progress Bar (matching video) */}
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

                        {/* SHS Programme / Stream Filter Pills (Ghana & West African SHS) */}
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

                    {/* STEP 7: Select Learning Indicators (Max 5) */}
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
                            },
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
                      </div>
                    )}

                    {/* STEP 8: Lesson Schedule, Curriculum Framework, AI Engine & Teaching Days */}
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

                        {/* Term Pills (matching Term 1 / Term 2 / Term 3 in video) */}
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

                        {/* Choose AI Model (matching Free AI vs EduMate Pro AI cards in video) */}
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
                                    Concise weekly lesson notes with starter, main &amp; reflection
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

                        {/* Select Days (matching Select All / Clear All + Monday..Friday cards in video) */}
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
                          onClick={handleGenerateLessonNote}
                          className="inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-95"
                          style={{
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                          }}
                        >
                          <WandSparkles className="size-4" />
                          Generate Lesson Note
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
                    <span>Lesson Note Summary</span>
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
                    onClick={handleGenerateLessonNote}
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
          MODE 2 & 3: LESSON NOTES REGISTER & LESSON NOTE APPROVALS
         ===================================================================== */}
      {mode !== 'generator' && (
        <div className="space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Weekly Lesson Notes"
              value={String(stats.total)}
              hint="Saved curriculum lesson notes"
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
              label="Daily Lessons"
              value={String(stats.dailyCount)}
              hint="Starter, Main & Reflection sheets"
              icon={<Users className="size-4" />}
            />
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-[220px] flex-1">
              <SearchInput
                value={searchQ}
                onChange={setSearchQ}
                placeholder="Search subject, strand, sub-strand, class, or teacher…"
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
                {Array.from(new Set(parsedNotes.map((n) => n.className))).map((cls) => (
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
          {filteredNotes.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface pb-10">
              <Empty
                title={
                  mode === 'approvals'
                    ? 'No lesson notes awaiting review'
                    : 'No weekly lesson notes found'
                }
                desc="Generate a structured weekly lesson note (WAEC / WASSCE & Pan-African curriculum aligned) in seconds using the guided generator."
              />
              <div className="flex justify-center">
                <Button
                  onClick={() => navigate('/admin/education-management/lesson-note/generate')}
                >
                  <WandSparkles className="size-4" />
                  Generate Lesson Note
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
                    <th className="px-4 py-3">Strand &amp; Sub-Strand</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3 text-center">Lessons</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredNotes.map((note) => (
                    <tr
                      key={note.id}
                      className="transition hover:bg-black/[0.015] dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold">{note.week}</div>
                        <div className="text-[11px] text-mist">
                          {note.term} · Ends {note.weekEnding}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold">{note.subject}</div>
                        <div className="text-[11px] text-mist">
                          {note.className} · {note.duration}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="truncate font-semibold">{note.subStrand}</div>
                        <div className="truncate text-[11px] text-mist">{note.strand}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap font-medium">
                        {note.teacher || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                          {note.dailyLessons.length} day
                          {note.dailyLessons.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <Badge tone={statusTone(note.status)}>{note.status}</Badge>
                        {note.reviewerComment && (
                          <div className="mt-1 max-w-[160px] truncate text-[10px] text-mist">
                            “{note.reviewerComment}”
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingNote(note)
                              setViewingLessonIdx(0)
                              setEditingModalNote(false)
                              setReviewerRemarks(note.reviewerComment || '')
                            }}
                            title="Preview & customize lesson note"
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                          >
                            <Eye className="size-3.5" />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => setDownloadTarget(note)}
                            title="Download PDF or editable Word (.docx)"
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-500/20 dark:text-indigo-300"
                          >
                            <Download className="size-3.5" />
                            Download
                          </button>

                          {mode !== 'approvals' &&
                            (note.status === 'Draft' || note.status === 'Returned') && (
                              <button
                                type="button"
                                onClick={() => handleStatusDecision(note, 'Pending')}
                                title="Submit for academic approval"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                              >
                                <Send className="size-3.5" />
                                Submit
                              </button>
                            )}

                          {mode === 'approvals' && !teacherScope.isTeacher && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStatusDecision(note, 'Approved')}
                                title="Approve Lesson Note"
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                              >
                                <Check className="size-3.5" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingNote(note)
                                  setViewingLessonIdx(0)
                                  setEditingModalNote(false)
                                  setReviewerRemarks(note.reviewerComment || '')
                                }}
                                title="Return with feedback"
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
                              >
                                <X className="size-3.5" />
                                Return
                              </button>
                            </>
                          )}

                          {mode !== 'approvals' && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(note)}
                              title="Delete lesson note"
                              className="rounded-lg p-1.5 text-mist transition hover:bg-rose-500/10 hover:text-rose-600"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
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

      {/* Full Weekly Lesson Note Viewer / Inline Editor / Approval Modal */}
      {viewingNote && (
        <Modal
          open={!!viewingNote}
          onClose={() => {
            setViewingNote(null)
            setEditingModalNote(false)
          }}
          title={`${viewingNote.subject} · ${viewingNote.className} (${viewingNote.week})`}
          wide
        >
          <div className="space-y-4">
            {/* Lesson Switcher & Modal Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-black/[0.02] p-3 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={viewingLessonIdx === 0}
                  onClick={() => setViewingLessonIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </button>
                <span className="text-xs font-bold">
                  Lesson {viewingLessonIdx + 1} of {viewingNote.dailyLessons.length}
                </span>
                <button
                  type="button"
                  disabled={viewingLessonIdx >= viewingNote.dailyLessons.length - 1}
                  onClick={() =>
                    setViewingLessonIdx((i) =>
                      Math.min(viewingNote.dailyLessons.length - 1, i + 1),
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(viewingNote.status)}>{viewingNote.status}</Badge>
                {mode !== 'approvals' && (
                  <Button
                    variant="ghost"
                    onClick={() => setEditingModalNote((v) => !v)}
                  >
                    <Pencil className="size-3.5" />
                    {editingModalNote ? 'Cancel Edit' : 'Edit Content'}
                  </Button>
                )}
                {editingModalNote && (
                  <Button onClick={saveModalEditedNote}>
                    <Save className="size-3.5" />
                    Save Changes
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setDownloadTarget(viewingNote)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                  }}
                >
                  <Download className="size-3.5" />
                  Download
                </button>
              </div>
            </div>

            <WeeklyLessonNoteSheet
              note={viewingNote}
              lessonIndex={viewingLessonIdx}
              editing={editingModalNote}
              onUpdateLesson={(idx, patch) => {
                setViewingNote((prev) => {
                  if (!prev) return prev
                  return {
                    ...prev,
                    dailyLessons: prev.dailyLessons.map((dl, i) =>
                      i === idx ? { ...dl, ...patch } : dl,
                    ),
                  }
                })
              }}
            />

            {/* Reviewer Feedback Box (Approvals Mode for Head Teacher / Admin, or Read-Only Feedback for Teacher) */}
            {(mode === 'approvals' || viewingNote.reviewerComment) && (
              <div className="rounded-xl border border-line bg-black/[0.02] p-4 dark:bg-white/[0.03]">
                {!teacherScope.isTeacher && mode === 'approvals' ? (
                  <div className="space-y-3">
                    <Field label="Academic Reviewer Remarks / Feedback">
                      <Textarea
                        rows={2}
                        placeholder="Add optional commendation or revision notes for the teacher…"
                        value={reviewerRemarks}
                        onChange={(e) => setReviewerRemarks(e.target.value)}
                      />
                    </Field>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() =>
                          handleStatusDecision(viewingNote, 'Returned', reviewerRemarks)
                        }
                      >
                        <X className="size-4" />
                        Return for Revision
                      </Button>
                      <Button
                        onClick={() =>
                          handleStatusDecision(viewingNote, 'Approved', reviewerRemarks)
                        }
                      >
                        <Check className="size-4" />
                        Approve Lesson Note
                      </Button>
                    </div>
                  </div>
                ) : (
                  viewingNote.reviewerComment && (
                    <div className="text-xs">
                      <span className="font-bold">Reviewer Feedback: </span>
                      <span>{viewingNote.reviewerComment}</span>
                      {viewingNote.reviewedBy && (
                        <span className="ml-2 text-mist">— {viewingNote.reviewedBy}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Download Format Selection Modal (Portrait/Landscape PDF + Portrait/Landscape Editable DOCX) */}
      <DownloadLessonNoteModal
        note={downloadTarget}
        onClose={() => setDownloadTarget(null)}
        onPrintPdf={handlePrintPdf}
        onDownloadDocx={handleDownloadDocx}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Weekly Lesson Note"
        >
          <p className="text-sm text-mist">
            Are you sure you want to delete the weekly lesson note for{' '}
            <strong className="text-inherit">
              {deleteTarget.subject} ({deleteTarget.className} · {deleteTarget.week})
            </strong>
            ?
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
