import { GpaEnginePage } from './GpaEnginePage'
import { ensureSemesterResultTheme, removeDefaultThemeEight } from '../../../lib/semesterResultTheme'
import { CustomSubjectTable, type SubjectColumn } from './CustomSubjectTable'
import { useEffect, useMemo, useRef, useState } from 'react'
import Swal from 'sweetalert2'
import {
  Check, FileText, Plus, Pencil, Trash2, Copy, ClipboardPaste, Scissors, Crosshair, MapPin,
  Search, X, Printer, LayoutGrid, Type, Image as ImageIcon,
  Palette, Layers, Settings, Eye, Save, ArrowLeft, ArrowRight, Award, Upload, RotateCcw,
} from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Empty, SearchInput } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'
import { isCollectionMarkedCleared } from '../../../lib/dataReset'
import {
  REPORTSHEET_THEMES,
  deleteReportsheetThemeFromRecords,
  getAllReportsheetThemes,
  publishReportsheetThemeToRecords,
  type PublishReportsheetThemeDraft,
  type ReportsheetThemeDef,
} from '../../../lib/reportsheetThemes'
import { ReportsheetSheetRenderer, type ThemeElementOverride, type CustomSubjectEntry } from './ReportsheetThemePage'
import { resolveMarkParts, type MarkPart } from './EduModulePage'
import { uid } from '../../../lib/utils'

// ---------------------------------------------------------------------------
// multiSelectValues helper (mirrors EduModulePage.tsx)
// ---------------------------------------------------------------------------

const multiSelectValues = (value: unknown): string[] => {
  if (Array.isArray(value)) return [...new Set(value.map((item) => String(item ?? '').trim()).filter(Boolean))]
  const raw = String(value ?? '').trim()
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) return [...new Set(parsed.map((item) => String(item ?? '').trim()).filter(Boolean))]
  } catch { /* legacy single-value field */ }
  return [raw]
}

const resolveExamMarkParts = (
  targetExamName: string,
  examSetupRows: EduRow[],
  markDistributionRows: EduRow[],
): MarkPart[] => {
  const trimmed = targetExamName.trim()
  if (!trimmed) return []
  const exam = examSetupRows.find(
    (row) => String(row.examName ?? row.name ?? '').trim() === trimmed,
  )
  const names = multiSelectValues(exam?.markDistribution)
  if (!names.length) return []
  return resolveMarkParts(names, markDistributionRows)
}

// ---------------------------------------------------------------------------
// Sample data for report preview
// ---------------------------------------------------------------------------

const SAMPLE_SUBJECTS = [
  { name: 'English Language', ca: 26, exam: 62, total: 88 },
  { name: 'Mathematics', ca: 27, exam: 65, total: 92 },
  { name: 'Integrated Science', ca: 24, exam: 58, total: 82 },
  { name: 'Social Studies', ca: 25, exam: 55, total: 80 },
  { name: 'Ghanaian Language', ca: 26, exam: 60, total: 86 },
  { name: 'Computing', ca: 25, exam: 58, total: 83 },
  { name: 'Creative Arts', ca: 23, exam: 52, total: 75 },
  { name: 'RME', ca: 27, exam: 61, total: 88 },
]

const gradeOf = (total: number) =>
  total >= 80 ? '1' : total >= 70 ? '2' : total >= 60 ? '3' : total >= 50 ? '4' : '5'

const remarkOf = (total: number) =>
  total >= 80 ? 'Excellent' : total >= 70 ? 'Very Good' : total >= 60 ? 'Good' : total >= 50 ? 'Credit' : 'Pass'

// ---------------------------------------------------------------------------
// Element data mapping — connects canvas elements to real data
// ---------------------------------------------------------------------------

function getElementDisplay(
  el: CanvasElement,
  cs: {
    schoolName: string
    schoolAddress: string
    schoolMotto: string
    reportTitle: string
    examName: string
    class: string
    term: string
    academicYear: string
  },
  reportName: string,
): string {
  const label = (el.text || el.label || '').toLowerCase()
  switch (true) {
    case label.includes('school name'):
      return cs.schoolName || 'School Name'
    case label.includes('motto'):
      return cs.schoolMotto || 'Excellence in Education'
    case label.includes('address'):
      return cs.schoolAddress || 'Accra, Greater Accra'
    case label.includes('report title') || label.includes('report name'):
      return cs.reportTitle || reportName || 'Report Title'
    case label.includes('exam'):
      return cs.examName || reportName || 'Exam Name'
    case label.includes('class'):
      return cs.class || 'All Classes'
    case label.includes('term'):
      return cs.term || 'All Terms'
    case label.includes('academic year') || label.includes('session'):
      return cs.academicYear || '2026/2027'
    case label.includes('student name'):
      return 'Ama Owusu'
    case label.includes('admission') || label.includes('admission number'):
      return 'ADM-001'
    case label.includes('position'):
      return '1st'
    case label.includes('overall grade'):
      return '1'
    case label.includes('no. on roll') || label.includes('number in class'):
      return '32'
    case label.includes('sex'):
      return 'Female'
    case label.includes('email'):
      return 'info@school.edu'
    case label.includes('phone'):
      return '+233 30 000 0000'
    case label.includes('website'):
      return 'www.school.edu'
    case label.includes('date of birth'):
      return '15th Jan, 2010'
    case label.includes('printed date'):
      return '30th June, 2026'
    case label.includes('section'):
      return 'A'
    case label.includes('grade') && !label.includes('overall'):
      return '1'
    case label.includes('remark'):
      return 'Excellent'
    case label.includes('no. of subjects') || label.includes('number of subjects'):
      return '9'
    case label.includes('affective'):
      return 'Affective Domain'
    case label.includes('psychomotor'):
      return 'Psychomotor Domain'
    case label.includes('attendance'):
      return 'Present'
    case label.includes('times school opened'):
      return '180'
    case label.includes('times present'):
      return '175'
    case label.includes('times absent'):
      return '5'
    case label.includes('times excused'):
      return '0'
    case label.includes('rating key'):
      return '1–5'
    case label.includes('performance chart'):
      return 'Performance Chart'
    case label.includes('mark/percentage summary') || label.includes('mark percentage summary'):
      return 'Summary'
    case label.includes('school bill') && label.includes('item'):
      return 'Tuition'
    case label.includes('school bill'):
      return 'GH₵ 2,500.00'
    case label.includes('next term fees'):
      return 'GH₵ 2,500.00'
    case label.includes('principal') && label.includes('head') && label.includes('comment'):
      return 'Excellent performance. Keep it up.'
    case label.includes('principal') && label.includes('head') && label.includes('signature'):
      return ''
    case label.includes('section'):
      return 'A'
    case label.includes('reopening') || label.includes('next term begins'):
      return '15th Sept, 2026'
    case label.includes('end of term'):
      return '30th June, 2026'
    case label.includes('teacher') && label.includes('comment'):
      return 'A very promising term.'
    case label.includes('principal') && label.includes('comment'):
      return 'Excellent performance. Keep it up.'
    case label.includes('signature'):
      return ''
    case label.includes('logo') || label.includes('photo'):
      return ''
    case label.includes('grading'):
      return 'Grading Scale'
    case label.includes('subject table') || label.includes('table'):
      return 'Subject Table'
    default:
      return el.text || el.label
  }
}

// ---------------------------------------------------------------------------
// Wizard steps
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  { id: 'template', label: 'Template', icon: FileText },
  { id: 'canvas', label: 'Canvas', icon: LayoutGrid },
  { id: 'preview', label: 'Preview', icon: Eye },
]

const TEMPLATE_TYPES = [
  { id: 'blank', label: 'Blank Canvas', icon: LayoutGrid, desc: 'Start from scratch with a custom canvas' },
  { id: 'arithmetic', label: 'Arithmetic Template', icon: Type, desc: 'Pre-built subject columns with CA + Exam + Total' },
  { id: 'attendance', label: 'Attendance Template', icon: Layers, desc: 'Daily attendance register with present/absent columns' },
  { id: 'summary', label: 'Summary Template', icon: FileText, desc: 'Class averages and performance summary' },
  { id: 'certificate', label: 'New Certificate Template', icon: Award, desc: 'Create a certificate with custom background color' },
]

// ---------------------------------------------------------------------------
// ReportBuilderPage (list view)
// ---------------------------------------------------------------------------

// Replace the known old generated example once per branch; keep real reports and
// published themes untouched. The marker is stored with branch data, not per browser.
function refreshReportBuilderSamples(records: EduRecords, branchId: string, branchName: string): EduRecords {
  if (isCollectionMarkedCleared('educationRecords')) return records
  const migrated = records.reportBuilderSampleMigration ?? []
  const v2Done = migrated.some(r => r.id === 'sample-refresh-v2')
  const v3Done = migrated.some(r => r.id === 'sample-published-theme-v1')
  if (v2Done && v3Done) return records
  const existing = records.reportBuilder ?? []
  const retained = existing.filter(r => !(r.id === `edu_reportBuilder_${branchId}_1` && r.reportName === 'End of First Term Terminal Report' && r.examName === 'End of Term Exam'))
  const exams = records.examSetup ?? []
  const activeYear = (records.academicYear ?? []).find(r => String(r.status ?? '').toLowerCase() === 'active')?.name ?? ''
  const availableThemes = getAllReportsheetThemes(records)
  const candidates = [
    { suffix: 'terminal', name: 'Sample — Term Report', index: 0 },
    { suffix: 'progress', name: 'Sample — Student Progress Report', index: 1 },
  ]
  const samples: EduRow[] = (v2Done ? [] : candidates).map(({ suffix, name, index }) => {
    const exam = exams[index] ?? exams[0]
    const theme = availableThemes[index % availableThemes.length]
    return { id: `sample-report-v2-${suffix}`, branch: branchName, reportName: name, reportType: 'Standard', examName: String(exam?.examName ?? ''), className: '', term: String(exam?.term ?? ''), academicYear: String(exam?.academicYear ?? activeYear), reportsheetTheme: theme.name, reportsheetThemeId: theme.id, pageOrientation: 'portrait', status: 'Draft', createdAt: new Date().toISOString().slice(0, 10) }
  }).filter(sample => !retained.some(row => row.id === sample.id))
  let next: EduRecords = { ...records, reportBuilder: [...samples, ...retained], reportBuilderSampleMigration: v2Done ? migrated : [...migrated, { id: 'sample-refresh-v2' }] }
  if (!v3Done) {
    const existingSample = (next.reportsheetTheme ?? []).find(r => r.sampleKey === 'published-report-sample-v1') ?? (next.reportsheetTheme ?? []).find(r => r.sampleKey === 'semester-result-pdf-v1')
    let sampleTheme = existingSample ? getAllReportsheetThemes(next).find(t => t.id === existingSample.themeId) : undefined
    if (!sampleTheme) {
      const published = publishReportsheetThemeToRecords(next, {
        tagline: 'Sample — Published Report',
        description: 'Sample published report theme for the Report Builder.',
        baseThemeId: availableThemes.find(t => !t.isCustom)?.id ?? 'theme-1',
        examName: String(exams[0]?.examName ?? ''),
      })
      sampleTheme = published.theme
      next = { ...published.nextRecords, reportsheetTheme: (published.nextRecords.reportsheetTheme ?? []).map(r => r.id === `custom-${sampleTheme!.id}` ? { ...r, sampleKey: 'published-report-sample-v1' } : r) }
    }
    const sampleReportId = 'sample-report-v2-published'
    if (!(next.reportBuilder ?? []).some(r => r.id === sampleReportId)) {
      const sampleReport: EduRow = {
        id: sampleReportId, branch: branchName, reportName: 'Sample — Published Report', reportType: existingSample?.sampleKey === 'semester-result-pdf-v1' ? 'CGPA' : 'Standard',
        examName: sampleTheme.examName ?? '', className: '', term: String(exams[0]?.term ?? ''),
        academicYear: String(exams[0]?.academicYear ?? activeYear), reportsheetTheme: sampleTheme.name,
        reportsheetThemeId: sampleTheme.id, publishedThemeId: sampleTheme.id,
        canvasElementsJson: sampleTheme.canvasElementsJson ?? '', tableCellOverridesJson: sampleTheme.tableCellOverridesJson ?? '',
        canvasSettingsJson: sampleTheme.canvasSettingsJson ?? '', pageOrientation: 'portrait', status: 'Published',
        createdAt: sampleTheme.createdAt ?? new Date().toISOString().slice(0, 10),
      }
      next = { ...next, reportBuilder: [sampleReport, ...(next.reportBuilder ?? [])] }
    }
    next = { ...next, reportBuilderSampleMigration: [...(next.reportBuilderSampleMigration ?? []), { id: 'sample-published-theme-v1' }] }
  }
  return next
}

/** Correct published Theme 7 and the semester-slip sample without altering drafts. */
function markCgpaThemeReports(records: EduRecords): EduRecords {
  const marker = 'theme-seven-cgpa-v1'
  if ((records.reportBuilderSampleMigration ?? []).some(r => r.id === marker)) return records
  const ids = new Set(['theme-7', ...(records.reportsheetTheme ?? []).filter(r => r.sampleKey === 'semester-result-pdf-v1').map(r => String(r.themeId ?? '').trim().toLowerCase()).filter(Boolean)])
  const reports = (records.reportBuilder ?? []).map(r => String(r.status ?? '').toLowerCase() === 'published' && ids.has(String(r.publishedThemeId ?? '').trim().toLowerCase()) ? { ...r, reportType: 'CGPA' } : r)
  return { ...records, reportBuilder: reports, reportBuilderSampleMigration: [...(records.reportBuilderSampleMigration ?? []), { id: marker }] }
}

export default function ReportBuilderPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeBranchId, branches } = useApp()

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  )

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    const refresh = () => {
      const loaded = loadEduRecords(activeBranchId, activeBranch?.name)
      const withReferenceTheme = ensureSemesterResultTheme(loaded)
      const updated = markCgpaThemeReports(removeDefaultThemeEight(refreshReportBuilderSamples(withReferenceTheme, activeBranchId, activeBranch?.name ?? '')))
      if (updated !== loaded) saveEduRecords(activeBranchId, updated)
      setRecords(updated)
    }
    refresh()
    const unsubscribeHydrated = subscribeDbHydrated(refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('fitpro:eduThemesUpdated', refresh)
    return () => {
      unsubscribeHydrated()
      window.removeEventListener('focus', refresh)
      window.removeEventListener('fitpro:eduThemesUpdated', refresh)
    }
  }, [activeBranchId, activeBranch?.name])

  const reportRecords = (records.reportBuilder ?? []) as EduRow[]

  // Show every available reportsheet theme alongside reports, including built-in themes.
  // A theme is hidden only when a published report explicitly represents that theme.
  const mergedRecords = useMemo(() => {
    const reportRows: EduRow[] = reportRecords.map((r) => ({
      ...r,
      format: r.pageOrientation === 'landscape' ? 'Landscape' : 'Portrait',
      __source: 'report' as const,
    }))
    const coveredThemeIds = new Set(
      reportRecords
        .filter((r) => String(r.status ?? '').toLowerCase() === 'published')
        .map((r) => String(r.publishedThemeId ?? '').trim().toLowerCase())
        .filter(Boolean),
    )
    const publishedThemeFallbackRows: EduRow[] = getAllReportsheetThemes(records)
      .filter((th) => !coveredThemeIds.has(th.id.toLowerCase()))
      .map((th) => {
        let orientation: 'portrait' | 'landscape' = 'portrait'
        if (th.canvasSettingsJson) {
          try {
            const parsed = JSON.parse(th.canvasSettingsJson)
            if (parsed?.orientation === 'landscape') orientation = 'landscape'
          } catch { /* ignore */ }
        }
        const cleanTagline = String(th.tagline ?? '').trim()
        const displayName =
          th.isCustom && cleanTagline && !cleanTagline.toLowerCase().startsWith('custom ')
            ? cleanTagline
            : th.name
        return {
          id: `published-${th.id}`,
          branch: activeBranch?.name ?? '',
          reportName: displayName,
          reportType: th.id.toLowerCase() === 'theme-7' || (records.reportsheetTheme ?? []).some(r => r.sampleKey === 'semester-result-pdf-v1' && String(r.themeId ?? '').toLowerCase() === th.id.toLowerCase()) ? 'CGPA' : 'Standard',
          examName: th.examName ?? '',
          className: '',
          reportsheetTheme: th.name,
          reportsheetThemeId: th.id,
          publishedThemeId: th.id,
          canvasElementsJson: th.canvasElementsJson ?? '',
          tableCellOverridesJson: th.tableCellOverridesJson ?? '',
          canvasSettingsJson: th.canvasSettingsJson ?? '',
          reportOptions: th.reportOptionsJson ?? '',
          pageOrientation: orientation,
          format: orientation === 'landscape' ? 'Landscape' : 'Portrait',
          status: 'Published',
          createdAt: th.createdAt ?? new Date().toISOString().slice(0, 10),
          __source: 'theme' as const,
        }
      })
    return [...reportRows, ...publishedThemeFallbackRows]
  }, [reportRecords, records, activeBranch?.name])
  const [search, setSearch] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'wizard'>('list')

  const collapseSidebar = (collapsed: boolean) => {
    window.dispatchEvent(new CustomEvent('fitpro:collapseSidebar', { detail: { collapsed } }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mergedRecords
    return mergedRecords.filter((r) =>
      String(r.reportName ?? '').toLowerCase().includes(q) ||
      String(r.reportType ?? '').toLowerCase().includes(q) ||
      String(r.className ?? '').toLowerCase().includes(q) ||
      String(r.examName ?? '').toLowerCase().includes(q) ||
      String(r.status ?? '').toLowerCase().includes(q) ||
      String(r.reportsheetTheme ?? '').toLowerCase().includes(q)
    )
  }, [mergedRecords, search])

  const openNew = () => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
    setEditing(null)
    setWizardOpen(true)
    setViewMode('wizard')
    collapseSidebar(true)
  }

  const openEdit = (row: EduRow) => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
    setEditing(row)
    setWizardOpen(true)
    setViewMode('wizard')
    collapseSidebar(true)
  }

  const save = (data: EduRow) => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const latestReportRecords = (latestRecords.reportBuilder ?? []) as EduRow[]
    const next = latestReportRecords.filter(
      (r) => r.id !== data.id && (!editing?.id || r.id !== editing.id),
    )
    const updated = [data, ...next]
    const nextRecords = { ...latestRecords, reportBuilder: updated }
    saveEduRecords(activeBranchId, nextRecords)
    setRecords(nextRecords)
    toast(
      editing
        ? data.status === 'Published'
          ? 'Report published'
          : 'Report updated'
        : data.status === 'Published'
          ? 'Report published'
          : 'Report created',
      'success',
    )
    setWizardOpen(false)
    setViewMode('list')
    collapseSidebar(false)
  }

  const remove = (id: string) => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const latestReportRecords = (latestRecords.reportBuilder ?? []) as EduRow[]
    const next = latestReportRecords.filter((r) => r.id !== id)
    const nextRecords = { ...latestRecords, reportBuilder: next }
    saveEduRecords(activeBranchId, nextRecords)
    setRecords(nextRecords)
    toast('Report deleted', 'info')
  }

  const allReportsheetThemes = useMemo(() => getAllReportsheetThemes(records), [records])

  const handlePublishThemeFromWizard = (
    draft: PublishReportsheetThemeDraft,
    buildPublishedReportRow?: (theme: ReportsheetThemeDef) => EduRow,
  ): ReportsheetThemeDef => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const { nextRecords: themeUpdatedRecords, theme } = publishReportsheetThemeToRecords(latestRecords, draft)
    let finalRecords = themeUpdatedRecords
    if (buildPublishedReportRow) {
      const publishedRow = buildPublishedReportRow(theme)
      const existingReports = (themeUpdatedRecords.reportBuilder ?? []) as EduRow[]
      const deduped = existingReports.filter(
        (r) => r.id !== publishedRow.id && (!editing?.id || r.id !== editing.id),
      )
      finalRecords = {
        ...themeUpdatedRecords,
        reportBuilder: [publishedRow, ...deduped],
      }
    }
    saveEduRecords(activeBranchId, finalRecords)
    setRecords(finalRecords)
    window.dispatchEvent(new CustomEvent('fitpro:eduThemesUpdated'))
    return theme
  }

  const handleDeleteThemeFromWizard = (themeId: string): ReportsheetThemeDef | null => {
    const latestRecords = loadEduRecords(activeBranchId, activeBranch?.name)
    const result = deleteReportsheetThemeFromRecords(latestRecords, themeId)
    if (!result.deleted) {
      toast(
        result.reason === 'last-theme'
          ? 'At least one reportsheet theme must remain'
          : 'Could not delete theme',
        'error',
      )
      return null
    }
    saveEduRecords(activeBranchId, result.nextRecords)
    setRecords(result.nextRecords)
    window.dispatchEvent(new CustomEvent('fitpro:eduThemesUpdated'))
    toast(`${result.deletedTheme?.name || 'Theme'} deleted from Reportsheet Theme`, 'info')
    return result.activeTheme
  }

  // Data sources for wizard selects
  const examSetupRecords = (records.examSetup ?? []) as EduRow[]
  const markDistributionRecords = (records.markDistribution ?? []) as EduRow[]
  const classListRecords = (records.classList ?? []) as EduRow[]
  const subjectListRecords = (records.subjectList ?? []) as EduRow[]
  const termRecords = (records.academicTerms ?? []) as EduRow[]

  return (
    <div>
      <PageHeader
        title={t('nav.eduReportBuilder')}
        desc="Configure and build exam reports with live preview"
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
            <Button variant="primary" size="sm" onClick={openNew}>
              <Plus className="size-4" /> New Report
            </Button>
          </>
        }
      />

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs text-mist">Total Reports</p>
          <p className="mt-1 text-2xl font-bold">{mergedRecords.length}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs text-mist">Published</p>
          <p className="mt-1 text-2xl font-bold">{mergedRecords.filter((r) => r.status === 'Published').length}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <p className="text-xs text-mist">Drafts</p>
          <p className="mt-1 text-2xl font-bold">{mergedRecords.filter((r) => r.status === 'Draft').length}</p>
        </div>
      </div>

      {/* Search + table */}
      <div className="rounded-xl border border-line bg-card">
        <div className="border-b border-line p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search reports and themes…" />
        </div>

        {filtered.length === 0 ? (
          <Empty
            title="No reports or themes yet"
            desc="Click New Report to create your first report."
            action={<Button variant="primary" size="sm" onClick={openNew}><Plus className="size-4" /> New Report</Button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wider text-mist">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Exam</th>
                  <th className="px-4 py-3">Orientation</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{String(r.reportName ?? '')}</span>
                        {r.reportsheetTheme && String(r.reportsheetTheme) !== String(r.reportName ?? '') && (
                          <span className="rounded bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-mist">
                            {String(r.reportsheetTheme)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.__source === 'marksheet' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                        {r.__source === 'theme' ? 'Reportsheet Theme' : 'Report'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-mist">{String(r.reportType ?? '')}</td>
                    <td className="px-4 py-3 text-mist">{String(r.examName ?? '—')}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{String(r.format ?? 'PDF')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.status === 'Published' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                        {String(r.status ?? 'Draft')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(r.__source === 'report' || r.__source === 'theme') && (
                          <button type="button" onClick={() => openEdit(r)} className="rounded-md p-1.5 text-mist hover:bg-muted hover:text-foreground" title="Edit">
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {r.__source !== 'theme' && <button type="button" onClick={() => remove(r.id)} className="rounded-md p-1.5 text-mist hover:bg-red-500/10 hover:text-red-500" title="Delete">
                          <Trash2 className="size-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {wizardOpen && (
        <ReportBuilderWizard
          editing={editing}
          records={records}
          branchName={activeBranch?.name ?? ''}
          allThemes={allReportsheetThemes}
          onPublishTheme={handlePublishThemeFromWizard}
          onDeleteTheme={handleDeleteThemeFromWizard}
          examOptions={examSetupRecords}
          markDistributionOptions={markDistributionRecords}
          classOptions={classListRecords}
          subjectOptions={subjectListRecords}
          termOptions={termRecords}
          initialStep={1}
          initialView={!editing ? 'templates' : undefined}
          onSave={save}
          onClose={() => {
            setWizardOpen(false)
            setViewMode('list')
            collapseSidebar(false)
          }}
          isFullPage={viewMode === 'wizard'}
        />
      )}

    </div>
  )
}

// Editor-only guides use unscaled canvas pixels; their positions track zoom.
function CanvasRulers({ zoom }: { zoom: number }) {
  const ticks = (length: number, vertical: boolean) => Array.from({ length: Math.floor(length / 20) + 1 }, (_, i) => {
    const value = i * 20
    const major = value % 100 === 0
    return <div key={value} style={{ position: 'absolute', ...(vertical ? { top: value * zoom, right: 0, width: major ? 9 : 5, height: 1 } : { left: value * zoom, bottom: 0, width: 1, height: major ? 9 : 5 }), background: '#64748b' }}>
      {major && <span style={{ position: 'absolute', fontSize: 8, lineHeight: 1, color: '#334155', ...(vertical ? { right: 10, top: 2 } : { left: 2, bottom: 10 }) }}>{value}</span>}
    </div>
  })
  return <div className="report-canvas-guides" aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 30 }}>
    <div style={{ position: 'absolute', left: 0, top: -22, width: 560 * zoom, height: 20, background: '#f1f5f9', border: '1px solid #cbd5e1', overflow: 'hidden' }}>{ticks(560, false)}</div>
    <div style={{ position: 'absolute', left: -24, top: 0, width: 22, height: 780 * zoom, background: '#f1f5f9', border: '1px solid #cbd5e1', overflow: 'hidden' }}>{ticks(780, true)}</div>
    <div style={{ position: 'absolute', left: -24, top: -22, width: 22, height: 20, background: '#e2e8f0', color: '#475569', fontSize: 8, textAlign: 'center', paddingTop: 4 }}>px</div>
  </div>
}

function CanvasGrid({ zoom }: { zoom: number }) {
  return <div className="report-canvas-guides" aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none', backgroundImage: 'linear-gradient(to right, rgba(59,130,246,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,130,246,.22) 1px, transparent 1px)', backgroundSize: `${20 * zoom}px ${20 * zoom}px` }} />
}

// ---------------------------------------------------------------------------
// ReportBuilderWizard
// ---------------------------------------------------------------------------

interface CanvasElement {
  id: string
  type: 'header' | 'text' | 'table' | 'image' | 'logo' | 'custom_text' | 'custom_heading' | 'line' | 'divider' | 'signature'
  label: string
  x: number
  y: number
  width: number
  height: number
  offsetX?: number
  offsetY?: number
  imageSrc?: string
  caption?: string
  hidden?: boolean
  style?: Record<string, unknown>
  text?: string
  showOn?: string[]
  locked?: boolean
  field?: string
  groupId?: string
}

interface ThemeClipboardPayload {
  sourceThemeId: string
  sourceThemeName: string
  pasteCount: number
  items: CanvasElement[]
}

let sharedReportThemeClipboard: ThemeClipboardPayload | null = null

function rgbToHexOrCss(color: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(color.trim())
  if (!m) return color
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1
  if (a === 0) return 'transparent'
  if (a < 1) return color
  const r = Math.min(255, parseInt(m[1], 10)).toString(16).padStart(2, '0')
  const g = Math.min(255, parseInt(m[2], 10)).toString(16).padStart(2, '0')
  const b = Math.min(255, parseInt(m[3], 10)).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

const DEFAULT_THEME1_SUBJECTS: CustomSubjectEntry[] = [
  { subject: 'Mathematics', classScore: 28, examScore: 61 },
  { subject: 'English Language', classScore: 26, examScore: 57 },
  { subject: 'Integrated Science', classScore: 24, examScore: 53 },
  { subject: 'Social Studies', classScore: 24, examScore: 53 },
  { subject: 'Information & Communication Technology', classScore: 29, examScore: 64 },
]

const DEFAULT_TERMINAL_SUBJECTS: CustomSubjectEntry[] = [
  { subject: 'Ghanaian Language Twi', classScore: 25.8, examScore: 63.0 },
  { subject: 'Computing', classScore: 25.5, examScore: 61.6 },
  { subject: 'Creative Arts', classScore: 24.0, examScore: 60.9 },
  { subject: 'Mathematics', classScore: 26.4, examScore: 65.1 },
  { subject: 'Integrated Science', classScore: 23.7, examScore: 58.8 },
  { subject: 'English Language', classScore: 24.6, examScore: 61.6 },
  { subject: 'History of Ghana', classScore: 22.8, examScore: 58.1 },
  { subject: 'Religious and Moral Education', classScore: 27.0, examScore: 61.6 },
]

// Field registry — mirrors EduMESS RTB_FIELD_REGISTRY
const FIELD_REGISTRY: Record<string, { label: string; type: string; w: number; h: number; icon: string }> = {
  school_logo:      { label: 'School Logo', type: 'image', w: 90, h: 90, icon: '🖼' },
  school_name:      { label: 'School Name', type: 'text_field', w: 320, h: 40, icon: '🏫' },
  school_motto:     { label: 'School Motto', type: 'text_field', w: 260, h: 24, icon: '💬' },
  school_address:   { label: 'School Address', type: 'text_field', w: 320, h: 24, icon: '📍' },
  school_email:     { label: 'School Email', type: 'text_field', w: 260, h: 24, icon: '📧' },
  school_phone:     { label: 'School Phone', type: 'text_field', w: 200, h: 24, icon: '📞' },
  school_website:   { label: 'School Website', type: 'text_field', w: 260, h: 24, icon: '🌐' },
  student_photo:    { label: 'Student Photo', type: 'image', w: 80, h: 90, icon: '📷' },
  student_name:     { label: 'Student Name', type: 'text_field', w: 220, h: 24, icon: '👤' },
  class_name:       { label: 'Class', type: 'text_field', w: 160, h: 24, icon: '📋' },
  level:            { label: 'Level', type: 'text_field', w: 160, h: 24, icon: '🎓' },
  admission_number: { label: 'Admission Number', type: 'text_field', w: 180, h: 24, icon: '🔢' },
  sex:              { label: 'Sex', type: 'text_field', w: 120, h: 24, icon: '⚧' },
  date_of_birth:    { label: 'Date of Birth', type: 'text_field', w: 180, h: 24, icon: '🎂' },
  printed_date:     { label: 'Printed Date', type: 'text_field', w: 180, h: 24, icon: '📅' },
  position:         { label: 'Position', type: 'text_field', w: 120, h: 24, icon: '🏆' },
  section_name:     { label: 'School Section', type: 'text_field', w: 160, h: 24, icon: '🔖' },
  number_in_class:  { label: 'Number In Class', type: 'text_field', w: 160, h: 24, icon: '👥' },
  overall_grade:    { label: 'Overall Grade', type: 'text_field', w: 160, h: 24, icon: '⭐' },
  grade:            { label: 'Grade', type: 'text_field', w: 100, h: 24, icon: '🔢' },
  remark:           { label: 'Remark', type: 'text_field', w: 200, h: 24, icon: '💬' },
  no_of_subjects:   { label: 'No. of Subjects', type: 'text_field', w: 160, h: 24, icon: '📚' },
  term_name:        { label: 'Term Name', type: 'text_field', w: 200, h: 24, icon: '📅' },
  session_name:     { label: 'Session Name', type: 'text_field', w: 180, h: 24, icon: '📆' },
  report_type:      { label: 'Report Type', type: 'text_field', w: 160, h: 24, icon: '📄' },
  subject_table:    { label: 'Subject Table', type: 'subject_table', w: 700, h: 320, icon: '📊' },
  affective_domain: { label: 'Affective Domain', type: 'text_field', w: 200, h: 24, icon: '🧠' },
  psychomotor_domain: { label: 'Psychomotor Domain', type: 'text_field', w: 200, h: 24, icon: '🏃' },
  attendance:       { label: 'Attendance', type: 'text_field', w: 160, h: 24, icon: '✅' },
  times_school_opened: { label: 'Times School Opened', type: 'text_field', w: 180, h: 24, icon: '📆' },
  times_present:    { label: 'Times Present', type: 'text_field', w: 160, h: 24, icon: '🟢' },
  times_absent:     { label: 'Times Absent', type: 'text_field', w: 160, h: 24, icon: '🔴' },
  times_excused:    { label: 'Times Excused', type: 'text_field', w: 160, h: 24, icon: '🟡' },
  rating_key:       { label: 'Rating Key', type: 'text_field', w: 200, h: 24, icon: '🔑' },
  performance_chart: { label: 'Performance Chart', type: 'text_field', w: 200, h: 24, icon: '📊' },
  mark_percentage_summary: { label: 'Mark/Percentage Summary', type: 'text_field', w: 220, h: 24, icon: '📋' },
  grading_key:      { label: 'Grading Scale', type: 'grading_key', w: 260, h: 170, icon: '🎨' },
  mark_obtainable:  { label: 'Marks Obtainable', type: 'text_field', w: 160, h: 24, icon: '📐' },
  mark_obtained:    { label: 'Mark Obtained', type: 'text_field', w: 160, h: 24, icon: '📏' },
  percentage_score: { label: 'Percentage Score', type: 'text_field', w: 160, h: 24, icon: '📈' },
  class_average:    { label: 'Class Average', type: 'text_field', w: 160, h: 24, icon: '📊' },
  teacher_comment:  { label: "Teacher's Comment", type: 'text_field', w: 500, h: 24, icon: '✏️' },
  principal_head_teacher_comment: { label: "Principal/Head Teacher's Comment", type: 'text_field', w: 500, h: 24, icon: '📝' },
  school_bill:      { label: 'School Bill', type: 'text_field', w: 200, h: 24, icon: '💰' },
  school_bill_item: { label: 'School Bill Item', type: 'text_field', w: 200, h: 24, icon: '🧾' },
  next_term_fees:   { label: 'Next Term Fees', type: 'text_field', w: 200, h: 24, icon: '💵' },
  next_term_begins: { label: 'Next Term Begins', type: 'text_field', w: 300, h: 24, icon: '🔄' },
  end_of_term:      { label: 'End of Term', type: 'text_field', w: 300, h: 24, icon: '🏁' },
  principal_head_teacher_signature: { label: "Principal/Head Teacher's Signature", type: 'image', w: 100, h: 60, icon: '✍️' },
  principal_signature: { label: "Principal's Signature", type: 'image', w: 100, h: 60, icon: '✍️' },
  class_teacher_signature: { label: "Class Teacher's Signature", type: 'image', w: 100, h: 60, icon: '✍️' },
}

const EDITOR_ELEMENTS = [
  { key: 'custom_text', label: 'Custom Text', icon: '🔤', w: 300, h: 70 },
  { key: 'custom_heading', label: 'Custom Heading', icon: 'H', w: 460, h: 48 },
  { key: 'line', label: 'Line', icon: '─', w: 200, h: 16 },
  { key: 'divider', label: 'Divider', icon: '➖', w: 500, h: 12 },
  { key: 'custom_shape', label: 'Shape / Box', icon: '⬜', w: 220, h: 110 },
]

const SECTION_BLOCKS = [
  {
    key: 'header_block', label: 'Header Block', desc: 'Logo, school name, motto and address, pre-arranged.',
    elements: [
      { field: 'school_logo', dx: 30, dy: 24, w: 90, h: 90 },
      { field: 'school_name', dx: 140, dy: 24, w: 400, h: 40 },
      { field: 'school_motto', dx: 140, dy: 66, w: 400, h: 22 },
      { field: 'school_address', dx: 140, dy: 90, w: 400, h: 22 },
    ],
  },
  {
    key: 'student_info_block', label: 'Student Info Block', desc: 'Class, Name, Admission No, Sex, Overall Grade — pre-arranged in a grid.',
    elements: [
      { field: 'class_name', dx: 30, dy: 150, w: 200, h: 22 },
      { field: 'overall_grade', dx: 250, dy: 150, w: 200, h: 22 },
      { field: 'number_in_class', dx: 470, dy: 150, w: 200, h: 22 },
      { field: 'student_name', dx: 30, dy: 180, w: 300, h: 22 },
      { field: 'admission_number', dx: 350, dy: 180, w: 250, h: 22 },
      { field: 'sex', dx: 30, dy: 208, w: 150, h: 22 },
      { field: 'section_name', dx: 200, dy: 208, w: 250, h: 22 },
    ],
  },
  {
    key: 'signoff_block', label: 'Sign-off Block', desc: 'Next Term Begins, Teacher Comment, Principal Comment and Signature.',
    elements: [
      { field: 'next_term_begins', dx: 30, dy: 780, w: 400, h: 22 },
      { field: 'teacher_comment', dx: 30, dy: 808, w: 700, h: 22 },
      { field: 'principal_comment', dx: 30, dy: 836, w: 700, h: 22 },
      { field: 'principal_signature', dx: 30, dy: 864, w: 100, h: 60 },
    ],
  },
]

// Theme element layouts — pre-arranged canvas elements per Reportsheet Theme
function getThemeElements(_theme: ReportsheetThemeDef): CanvasElement[] {
  const elements: CanvasElement[] = []
  // Positions are approximate (794px canvas space, scaled to 560px renderer space)
  // Used for properties panel metadata — actual click detection uses data-element-id.
  // Keep `text` undefined and `style` empty by default so ReportsheetSheetRenderer
  // preserves each theme's native typography, colors, SVG signatures, and live data,
  // and never mutates React-managed child DOM nodes on theme switches.
  const M = 34
  const CW = 725
  const isClassicTheme = (_theme.baseThemeId || _theme.id) === 'theme-1'

  // ── Header ──
  elements.push({
    id: 'school-logo',
    type: 'image',
    label: 'School Logo',
    x: M,
    y: 20,
    width: isClassicTheme ? 46 : 52,
    height: isClassicTheme ? 32 : 50,
    field: 'school_logo',
    style: {},
  })
  elements.push({ id: 'school-name', type: 'text', label: 'School Name', x: M, y: 56, width: 512, height: 13, style: {} })
  elements.push({ id: 'school-address', type: 'text', label: 'School Address', x: M, y: 69, width: 512, height: 13, style: {} })
  elements.push({ id: 'school-phone', type: 'text', label: 'School Phone', x: M, y: 82, width: 300, height: 13, style: {} })
  elements.push({ id: 'exam-name', type: 'text', label: 'Exam Name', x: M, y: 95, width: 512, height: 13, style: {} })
  elements.push({ id: 'exam-title', type: 'text', label: 'Exam Title', x: M, y: 95, width: 512, height: 13, style: {} })
  if (isClassicTheme || _theme.id === 'theme-4' || _theme.id === 'theme-5' || _theme.id === 'theme-6') {
    elements.push({ id: 'header-line', type: 'line', label: 'Header Horizontal Line', x: M, y: 112, width: 524, height: 10, style: {} })
  }
  if (_theme.id === 'theme-3' || _theme.id === 'theme-5') {
    elements.push({ id: 'exam-title-top-line', type: 'line', label: 'Title Top Horizontal Line', x: M, y: 116, width: 516, height: 8, style: {} })
    elements.push({ id: 'exam-title-bottom-line', type: 'line', label: 'Title Bottom Horizontal Line', x: M, y: 138, width: 516, height: 8, style: {} })
  }

  // ── Student Details ──
  elements.push({ id: 'student-name', type: 'text', label: 'Student Name', x: M, y: 100, width: 90, height: 22, style: {} })
  if (!isClassicTheme) {
    elements.push({ id: 'student-name-line', type: 'line', label: 'Student Name Horizontal Line', x: 82, y: 158, width: 454, height: 8, style: {} })
  }
  elements.push({ id: 'admission-no', type: 'text', label: 'Admission No', x: 130, y: 100, width: 90, height: 22, style: {} })
  elements.push({ id: 'student-class', type: 'text', label: 'Class', x: 230, y: 100, width: 90, height: 22, style: {} })
  elements.push({ id: 'term-label', type: 'text', label: 'Term', x: 330, y: 100, width: 90, height: 22, style: {} })
  if (!isClassicTheme) {
    elements.push({ id: 'student-class-line', type: 'line', label: 'Class Horizontal Line', x: 74, y: 176, width: 110, height: 8, style: {} })
    elements.push({ id: 'academic-year-line', type: 'line', label: 'Academic Year Horizontal Line', x: 274, y: 176, width: 98, height: 8, style: {} })
    elements.push({ id: 'term-label-line', type: 'line', label: 'Term Horizontal Line', x: 422, y: 176, width: 114, height: 8, style: {} })
    elements.push({ id: 'position-field-line', type: 'line', label: 'Position Horizontal Line', x: 86, y: 194, width: 82, height: 8, style: {} })
    elements.push({ id: 'roll-number-line', type: 'line', label: 'No. on Roll Horizontal Line', x: 248, y: 194, width: 68, height: 8, style: {} })
    elements.push({ id: 'reopening-date-line', type: 'line', label: 'Reopening Date Horizontal Line', x: 392, y: 194, width: 144, height: 8, style: {} })
  }
  elements.push({ id: 'exam-name-field', type: 'text', label: 'Exam (Student Details)', x: 430, y: 100, width: 90, height: 22, style: {} })
  elements.push({
    id: 'student-photo',
    type: 'image',
    label: 'Student Photo',
    x: 530,
    y: 100,
    width: isClassicTheme ? 38 : 52,
    height: isClassicTheme ? 38 : 50,
    field: 'student_photo',
    style: {},
  })

  // ── Subject Table ──
  elements.push({ id: 'subject-table', type: 'table', label: 'Subject Table', x: M, y: 140, width: 512, height: 200, field: 'subject_table', style: {} })

  // ── Summary Metrics & Extended Terminal Report Fields ──
  elements.push({ id: 'attendance-field', type: 'text', label: 'Attendance', x: M, y: 350, width: 160, height: 22, style: {} })
  elements.push({ id: 'attendance-total', type: 'text', label: 'Total Attendance', x: 200, y: 350, width: 120, height: 22, style: {} })
  elements.push({ id: 'position-field', type: 'text', label: 'Position', x: 200, y: 350, width: 160, height: 22, style: {} })
  elements.push({ id: 'class-average', type: 'text', label: 'Class Average', x: 380, y: 350, width: 160, height: 22, style: {} })
  elements.push({ id: 'academic-year', type: 'text', label: 'Academic Year', x: M, y: 118, width: 120, height: 20, style: {} })
  elements.push({ id: 'roll-number', type: 'text', label: 'No. on Roll', x: 230, y: 118, width: 100, height: 20, style: {} })
  elements.push({ id: 'reopening-date', type: 'text', label: 'Next Term Begins', x: 380, y: 118, width: 140, height: 20, style: {} })
  elements.push({ id: 'promoted-to', type: 'text', label: 'Promoted To', x: 380, y: 350, width: 140, height: 20, style: {} })
  elements.push({ id: 'conduct-field', type: 'text', label: 'Conduct', x: M, y: 372, width: 180, height: 18, style: {} })
  elements.push({ id: 'attitude-field', type: 'text', label: 'Attitude', x: 220, y: 372, width: 180, height: 18, style: {} })
  elements.push({ id: 'interest-field', type: 'text', label: 'Interest', x: 400, y: 372, width: 180, height: 18, style: {} })
  if (!isClassicTheme) {
    elements.push({ id: 'attendance-field-line', type: 'line', label: 'Attendance Horizontal Line', x: 104, y: 492, width: 88, height: 8, style: {} })
    elements.push({ id: 'attendance-total-line', type: 'line', label: 'Attendance Out Of Horizontal Line', x: 248, y: 492, width: 104, height: 8, style: {} })
    elements.push({ id: 'promoted-to-line', type: 'line', label: 'Promoted To Horizontal Line', x: 444, y: 492, width: 92, height: 8, style: {} })
    elements.push({ id: 'conduct-field-line', type: 'line', label: 'Conduct Horizontal Line', x: 86, y: 528, width: 450, height: 8, style: {} })
    elements.push({ id: 'attitude-field-line', type: 'line', label: 'Attitude Horizontal Line', x: 86, y: 546, width: 450, height: 8, style: {} })
    elements.push({ id: 'interest-field-line', type: 'line', label: 'Interest Horizontal Line', x: 86, y: 564, width: 450, height: 8, style: {} })
  }

  // ── Grading Scale ──
  elements.push({ id: 'grading-scale-line', type: 'line', label: 'Grading Scale Horizontal Line', x: M, y: 380, width: 524, height: 10, style: {} })
  elements.push({ id: 'grading-scale', type: 'text', label: 'Grading Scale', x: M, y: 385, width: CW, height: 14, style: {} })

  // ── Remarks ──
  elements.push({ id: 'class-teacher-remarks', type: 'text', label: "Class Teacher's Remark", x: M, y: 405, width: CW, height: 14, style: {} })
  elements.push({ id: 'head-teacher-remarks', type: 'text', label: "Head Teacher's Remark", x: M, y: 425, width: CW, height: 14, style: {} })
  if (!isClassicTheme) {
    elements.push({ id: 'class-teacher-remarks-line', type: 'line', label: 'Class Teacher Remarks Horizontal Line', x: 162, y: 582, width: 374, height: 8, style: {} })
    elements.push({ id: 'head-teacher-remarks-line', type: 'line', label: 'Head Teacher Remarks Horizontal Line', x: 162, y: 600, width: 374, height: 8, style: {} })
  }

  // ── Signatures ──
  if (isClassicTheme) {
    elements.push({ id: 'footer-line', type: 'line', label: 'Footer Horizontal Line', x: M, y: 444, width: 524, height: 10, style: {} })
  } else {
    elements.push({ id: 'class-teacher-signature-line', type: 'line', label: 'Class Teacher Signature Horizontal Line', x: 46, y: 718, width: 200, height: 8, style: {} })
    elements.push({ id: 'head-teacher-signature-line', type: 'line', label: 'Head Teacher Signature Horizontal Line', x: 314, y: 718, width: 200, height: 8, style: {} })
  }
  elements.push({ id: 'class-teacher-signature', type: 'signature', label: 'Class Teacher Signature', x: M, y: 450, width: 150, height: 40, field: 'class_teacher_signature', style: {} })
  elements.push({ id: 'head-teacher-signature', type: 'signature', label: 'Head Teacher Signature', x: 200, y: 450, width: 150, height: 40, field: 'head_teacher_signature', style: {} })
  elements.push({ id: 'head-of-school-signature', type: 'signature', label: 'Head of School Signature', x: 200, y: 450, width: 150, height: 40, field: 'head_of_school_signature', style: {} })
  elements.push({ id: 'principal-signature', type: 'signature', label: 'Principal Signature', x: 380, y: 450, width: 150, height: 40, field: 'principal_signature', style: {} })

  // ── Printed Line + Template Caption ──
  elements.push({ id: 'printed-line', type: 'text', label: 'Printed Line', x: M, y: 500, width: 200, height: 13, style: {} })
  elements.push({ id: 'template-caption', type: 'text', label: 'Template Caption', x: M, y: 515, width: 300, height: 12, style: {} })

  if (_theme.isCustom && _theme.canvasElementsJson) {
    try {
      const parsed = JSON.parse(_theme.canvasElementsJson) as CanvasElement[]
      if (Array.isArray(parsed) && _theme.canvasSettingsJson) {
        try {
          if (JSON.parse(_theme.canvasSettingsJson)?.blankForm === true) return parsed
        } catch { /* use the normal theme defaults */ }
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((el) => el.id))
        return [
          ...parsed.map((el) => ({ ...el, style: el.style ? { ...el.style } : {} })),
          ...elements.filter((d) => !existingIds.has(d.id)),
        ]
      }
    } catch { /* fallback to base theme elements */ }
  }

  return elements
}

function ReportBuilderWizard({
  editing,
  records,
  branchName,
  allThemes,
  onPublishTheme,
  onDeleteTheme,
  examOptions,
  markDistributionOptions,
  classOptions,
  subjectOptions,
  termOptions,
  initialStep,
  initialTemplateType,
  initialReportName,
  initialReportType,
  initialExamName,
  initialView,
  certificateColor,
  onSave,
  onClose,
  isFullPage,
}: {
  editing: EduRow | null
  records: EduRecords
  branchName: string
  allThemes: ReportsheetThemeDef[]
  onPublishTheme: (
    draft: PublishReportsheetThemeDraft,
    buildPublishedReportRow?: (theme: ReportsheetThemeDef) => EduRow,
  ) => ReportsheetThemeDef
  onDeleteTheme: (themeId: string) => ReportsheetThemeDef | null
  examOptions: EduRow[]
  markDistributionOptions: EduRow[]
  classOptions: EduRow[]
  subjectOptions: EduRow[]
  termOptions: EduRow[]
  initialStep?: number
  initialTemplateType?: string
  initialReportName?: string
  initialReportType?: string
  initialExamName?: string
  initialView?: 'elements' | 'editor' | 'sections' | 'templates' | 'setup' | 'style'
  certificateColor?: string
  onSave: (data: EduRow) => void
  onClose: () => void
  isFullPage?: boolean
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const [search, setSearch] = useState('')

  // Reusable color picker with native picker + hex input + preset swatches
  const PRESET_COLORS = ['#000000', '#ffffff', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#16325c', '#8aa0b5']
  const ColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 32, border: '1px solid var(--line)', borderRadius: 4, cursor: 'pointer', padding: 2, flexShrink: 0 }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 12, fontFamily: 'monospace' }}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
              background: c, border: value === c ? '2px solid #136ee5' : '1px solid var(--line)',
            }}
          />
        ))}
      </div>
    </div>
  )

  const [step, setStep] = useState(initialStep ?? 0)
  const [templateType, setTemplateType] = useState(initialTemplateType ?? 'blank')

  // Form state
  const wizardReportIdRef = useRef<string>(
    editing?.id && !String(editing.id).startsWith('published-') ? String(editing.id) : uid(),
  )
  const hasPublishedThemeOnCurrentIdRef = useRef(false)
  const [reportName, setReportName] = useState(editing?.reportName ?? initialReportName ?? '')
  const [reportType, setReportType] = useState(editing?.reportType ?? initialReportType ?? 'Standard')
  const [examName, setExamName] = useState(editing?.examName ?? initialExamName ?? '')
  const [className, setClassName] = useState(editing?.className ?? '')

  // Exam Name options sourced from Exam Setup (matching AddMarksheetTemplateModal)
  const examNameList = useMemo(() => {
    const list = Array.from(
      new Set(
        examOptions
          .map((row) => String(row.examName ?? row.name ?? '').trim())
          .filter(Boolean),
      ),
    )
    if (examName && !list.includes(examName)) {
      return [examName, ...list]
    }
    return list
  }, [examOptions, examName])

  // Dynamic Mark Distribution parts resolved from the selected Exam Name in Exam Setup
  const examMarkParts = useMemo<MarkPart[]>(
    () => resolveExamMarkParts(examName, examOptions, markDistributionOptions),
    [examName, examOptions, markDistributionOptions],
  )
  const [term, setTerm] = useState(editing?.term ?? '')
  const [academicYear, setAcademicYear] = useState(editing?.academicYear ?? '')
  const [fromDate, setFromDate] = useState(editing?.fromDate ?? '')
  const [toDate, setToDate] = useState(editing?.toDate ?? '')
  const [includeSubjects, setIncludeSubjects] = useState<string[]>(multiSelectValues(editing?.includeSubjects))
  const [reportOptions, setReportOptions] = useState<string[]>(
    editing && editing.reportOptions
      ? multiSelectValues(editing.reportOptions)
      : ['Class Average', 'Subject Average', 'Remark', 'Grading Scale', 'Attendance Percentage'],
  )
  const [format, setFormat] = useState(editing?.format ?? 'PDF')
  const [status, setStatus] = useState(editing?.status ?? 'Draft')
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>(
    editing?.pageOrientation === 'landscape' ? 'landscape' : 'portrait',
  )
  const pageSize = pageOrientation === 'portrait' ? { w: 794, h: 1123 } : { w: 1123, h: 794 }

  const initialResolvedTheme = useMemo<ReportsheetThemeDef>(() => {
    if (editing?.reportsheetThemeId) {
      const byId = allThemes.find((t) => t.id === editing.reportsheetThemeId)
      if (byId) return byId
    }
    if (editing?.reportsheetTheme) {
      const byName = allThemes.find((t) => t.name === editing.reportsheetTheme)
      if (byName) return byName
    }
    return allThemes[0] ?? REPORTSHEET_THEMES[0]
  }, [editing, allThemes])

  // Canvas elements — initialized from saved report or default theme's pre-arranged layout
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>(() => {
    if (typeof editing?.canvasElementsJson === 'string' && editing.canvasElementsJson.trim()) {
      try {
        const parsed = JSON.parse(editing.canvasElementsJson) as CanvasElement[]
        if (Array.isArray(parsed)) {
          try {
            if (editing?.canvasSettingsJson && JSON.parse(editing.canvasSettingsJson).blankForm === true) return parsed
          } catch { /* use the normal theme defaults */ }
          if (parsed.length === 0) return getThemeElements(initialResolvedTheme)
          const defaults = getThemeElements(initialResolvedTheme)
          const existingIds = new Set(parsed.map((el) => el.id))
          return [...parsed, ...defaults.filter((d) => !existingIds.has(d.id))]
        }
      } catch { /* fallback to theme defaults */ }
    }
    return getThemeElements(initialResolvedTheme)
  })
  const [tableCellOverrides, setTableCellOverrides] = useState<Record<string, ThemeElementOverride>>(() => {
    if (typeof editing?.tableCellOverridesJson === 'string' && editing.tableCellOverridesJson.trim()) {
      try {
        const parsed = JSON.parse(editing.tableCellOverridesJson)
        if (parsed && typeof parsed === 'object') return parsed as Record<string, ThemeElementOverride>
      } catch { /* ignore */ }
    }
    return {}
  })
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [liveSelectedText, setLiveSelectedText] = useState<string>('')
  const [inlineEdit, setInlineEdit] = useState<{
    kind: 'element' | 'table-cell'
    id: string
    label: string
    value: string
    multiline: boolean
    rect: { left: number; top: number; width: number; height: number }
  } | null>(null)
  const [dragState, setDragState] = useState<{
    ids: string[]
    isTheme: boolean
    hasMoved: boolean
    startClientX: number
    startClientY: number
    startPos: Record<string, { x: number; y: number }>
    toggleOffOnClickIds?: string[]
    holdAdded?: boolean
  } | null>(null)
  const [resizeState, setResizeState] = useState<{
    id: string
    isTheme: boolean
    corner: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'
    startX: number
    startY: number
    startW: number
    startH: number
    startPosX: number
    startPosY: number
  } | null>(null)
  const [configElement, setConfigElement] = useState<CanvasElement | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number; additive: boolean; insideSheet?: boolean } | null>(null)
  const [marqueePreviewIds, setMarqueePreviewIds] = useState<string[]>([])
  const [insertionPoint, setInsertionPoint] = useState<{ x: number; y: number } | null>(null)
  const [cursorMode, setCursorMode] = useState(false)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [hoverCursorPoint, setHoverCursorPoint] = useState<{ x: number; y: number } | null>(null)
  const [draggingInsertionPin, setDraggingInsertionPin] = useState(false)
  const [paletteDropPreview, setPaletteDropPreview] = useState<{
    x: number
    y: number
    w: number
    h: number
    label: string
  } | null>(null)
  const [activeSnapGuides, setActiveSnapGuides] = useState<{
    vertical: number[]
    horizontal: number[]
    readout?: { x: number; y: number }
  } | null>(null)
  const fallbackInsertYRef = useRef(120)
  const holdTimerRef = useRef<number | null>(null)
  const clearHoldTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }
  useEffect(() => () => clearHoldTimer(), [])
  const canvasRef = useRef<HTMLDivElement>(null)
  const elImageInputRef = useRef<HTMLInputElement>(null)
  const [imageUploadTargetId, setImageUploadTargetId] = useState<string | null>(null)
  const [selectedElRect, setSelectedElRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [multiSelectRect, setMultiSelectRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const snapPointToCanvas = (
    rawX: number,
    rawY: number,
    boxW = 0,
    boxH = 0,
    excludeIds: string[] = [],
    bypassSnap = false,
  ): { x: number; y: number; vertical: number[]; horizontal: number[] } => {
    const maxW = Math.min(boxW, 560)
    const maxH = Math.min(boxH, 780)
    const clampedX = Math.max(0, Math.min(rawX, 560 - maxW))
    const clampedY = Math.max(0, Math.min(rawY, 780 - maxH))
    if (!snapEnabled || bypassSnap) {
      return { x: Math.round(clampedX), y: Math.round(clampedY), vertical: [], horizontal: [] }
    }

    const excludeSet = new Set(excludeIds)
    const xTargets: number[] = [
      Math.max(0, Number(canvasSettings.marginLeft) || 14),
      280,
      Math.min(560, 560 - (Number(canvasSettings.marginRight) || 14)),
    ]
    const yTargets: number[] = [
      Math.max(0, Number(canvasSettings.marginTop) || 12),
      390,
      Math.min(780, 780 - (Number(canvasSettings.marginBottom) || 12)),
    ]
    if (insertionPoint && (boxW > 0 || boxH > 0)) {
      xTargets.push(insertionPoint.x)
      yTargets.push(insertionPoint.y)
    }
    for (const ce of canvasElements) {
      if (ce.hidden || !ce.id.startsWith('id_') || excludeSet.has(ce.id)) continue
      xTargets.push(ce.x, Math.round(ce.x + ce.width / 2), ce.x + ce.width)
      yTargets.push(ce.y, Math.round(ce.y + ce.height / 2), ce.y + ce.height)
    }

    const THRESH = 5
    let bestX = Math.round(clampedX / 4) * 4
    let bestXDist = THRESH + 1
    const vertical: number[] = []
    const xAnchors = boxW > 0 ? [0, boxW / 2, boxW] : [0]
    for (const anchor of xAnchors) {
      const curEdge = clampedX + anchor
      for (const t of xTargets) {
        const dist = Math.abs(curEdge - t)
        if (dist <= THRESH && dist < bestXDist) {
          const candidateX = t - anchor
          if (candidateX >= 0 && candidateX <= 560 - maxW) {
            bestXDist = dist
            bestX = Math.round(candidateX)
            vertical.length = 0
            vertical.push(Math.round(t))
          }
        }
      }
    }

    let bestY = Math.round(clampedY / 4) * 4
    let bestYDist = THRESH + 1
    const horizontal: number[] = []
    const yAnchors = boxH > 0 ? [0, boxH / 2, boxH] : [0]
    for (const anchor of yAnchors) {
      const curEdge = clampedY + anchor
      for (const t of yTargets) {
        const dist = Math.abs(curEdge - t)
        if (dist <= THRESH && dist < bestYDist) {
          const candidateY = t - anchor
          if (candidateY >= 0 && candidateY <= 780 - maxH) {
            bestYDist = dist
            bestY = Math.round(candidateY)
            horizontal.length = 0
            horizontal.push(Math.round(t))
          }
        }
      }
    }

    return {
      x: Math.max(0, Math.min(bestX, 560 - maxW)),
      y: Math.max(0, Math.min(bestY, 780 - maxH)),
      vertical,
      horizontal,
    }
  }

  const expandWithGroupMembers = (ids: string[], list: CanvasElement[] = canvasElements): string[] => {
    const groupIds = new Set<string>()
    for (const id of ids) {
      const found = list.find((ce) => ce.id === id)
      if (found?.groupId) groupIds.add(found.groupId)
    }
    if (groupIds.size === 0) return Array.from(new Set(ids))
    const expanded = new Set<string>(ids)
    for (const ce of list) {
      if (!ce.hidden && ce.groupId && groupIds.has(ce.groupId)) {
        expanded.add(ce.id)
      }
    }
    return Array.from(expanded)
  }

  const triggerElementImageUpload = (targetId: string) => {
    setImageUploadTargetId(targetId)
    if (elImageInputRef.current) {
      elImageInputRef.current.value = ''
      elImageInputRef.current.click()
    }
  }

  const handleElementImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const targetId = imageUploadTargetId || selectedElement
    if (!file || !targetId) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '')
      if (!dataUrl) return
      setCanvasElements((prev) =>
        prev.map((el) => (el.id === targetId ? { ...el, imageSrc: dataUrl } : el)),
      )
      const targetEl = canvasElements.find((el) => el.id === targetId)
      if (targetId === 'school-logo' || targetEl?.field === 'school_logo') {
        setCanvasSettings((s) => ({ ...s, schoolLogo: dataUrl }))
      }
      toast('Image updated on canvas', 'success')
    }
    reader.readAsDataURL(file)
  }

  const ensureThemeElement = (elId: string, domNode?: Element | null): CanvasElement => {
    const existing = canvasElements.find((ce) => ce.id === elId)
    if (existing) return existing
    const elType = domNode?.getAttribute('data-element-type') || 'text'
    const elLabel = domNode?.getAttribute('data-element-label') || elId
    const rect = domNode instanceof HTMLElement ? domNode.getBoundingClientRect() : null
    const w = rect && zoom > 0 ? Math.max(24, Math.round(rect.width / zoom)) : 200
    const h = rect && zoom > 0 ? Math.max(14, Math.round(rect.height / zoom)) : 24
    const created: CanvasElement = {
      id: elId,
      type: elType as CanvasElement['type'],
      label: elLabel,
      x: 0,
      y: 0,
      width: w,
      height: h,
      style: {},
    }
    setCanvasElements((prev) => (prev.some((ce) => ce.id === elId) ? prev : [...prev, created]))
    return created
  }

  // Canvas element drag + press-and-hold multi-selection handlers
  const handleElementMouseDown = (e: React.MouseEvent, el: CanvasElement) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (inlineEdit) return
    e.preventDefault()
    clearHoldTimer()

    if (cursorMode && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const rawX = (e.clientX - rect.left) / zoom
      const rawY = (e.clientY - rect.top) / zoom
      const snapped = snapPointToCanvas(rawX, rawY, 0, 0, [], e.altKey)
      setInsertionPoint({ x: snapped.x, y: snapped.y })
      setCursorMode(false)
      setHoverCursorPoint(null)
      toast(`Insertion point set at (${snapped.x}, ${snapped.y}) — click an element or Paste to place here`, 'info')
      return
    }

    const isTheme = !el.id.startsWith('id_')
    const prevSelectedIds = expandWithGroupMembers(selectedElements)
    const unitIds = el.groupId ? expandWithGroupMembers([el.id]) : [el.id]
    const isToggle = multiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey
    const allAlreadySelected = unitIds.every((id) => prevSelectedIds.includes(id))

    let nextSelectedIds: string[]
    let toggleOffOnClickIds: string[] | undefined

    if (isToggle) {
      if (allAlreadySelected) {
        // Keep all selected during mousedown so dragging moves the entire multi-selection;
        // only toggle off on mouseup if the user clicked without dragging.
        nextSelectedIds = prevSelectedIds
        toggleOffOnClickIds = unitIds
      } else {
        nextSelectedIds = Array.from(new Set([...prevSelectedIds, ...unitIds]))
        setSelectedElements(nextSelectedIds)
        setSelectedElement(el.id)
      }
    } else if (allAlreadySelected) {
      nextSelectedIds = prevSelectedIds
      setSelectedElements(nextSelectedIds)
      setSelectedElement(el.id)
    } else {
      nextSelectedIds = unitIds
      setSelectedElements(nextSelectedIds)
      setSelectedElement(el.id)
    }
    if (currentView !== 'style') setLastPaletteView(currentView as 'elements' | 'editor' | 'sections' | 'templates' | 'setup')
    setCurrentView('style')

    const buildStartPos = (ids: string[]) => {
      const pos: Record<string, { x: number; y: number }> = {}
      ids.forEach((id) => {
        const selEl = canvasElements.find((ce) => ce.id === id) || (id === el.id ? el : null)
        if (selEl && !selEl.locked) {
          pos[id] = selEl.id.startsWith('id_')
            ? { x: selEl.x, y: selEl.y }
            : { x: selEl.offsetX ?? 0, y: selEl.offsetY ?? 0 }
        }
      })
      return pos
    }

    const startClientX = e.clientX
    const startClientY = e.clientY

    if (!el.locked) {
      setDragState({
        ids: nextSelectedIds,
        isTheme,
        hasMoved: false,
        startClientX,
        startClientY,
        startPos: buildStartPos(nextSelectedIds),
        toggleOffOnClickIds,
      })
    } else if (toggleOffOnClickIds) {
      setDragState({
        ids: [],
        isTheme,
        hasMoved: false,
        startClientX,
        startClientY,
        startPos: {},
        toggleOffOnClickIds,
      })
    }

    // Press-and-hold (~380ms without dragging) adds the element into Multiple Selection
    if (!isToggle) {
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null
        const mergedIds = Array.from(new Set([...prevSelectedIds, ...unitIds]))
        setMultiSelectMode(true)
        setSelectedElements(mergedIds)
        setSelectedElement(el.id)
        if (!el.locked) {
          setDragState((cur) =>
            cur && !cur.hasMoved
              ? {
                  ...cur,
                  ids: mergedIds,
                  startPos: buildStartPos(mergedIds),
                  toggleOffOnClickIds: undefined,
                  holdAdded: true,
                }
              : cur,
          )
        }
        toast(
          mergedIds.length > 1
            ? `${mergedIds.length} elements selected — hold/click more or drag to move together`
            : 'Multi-select ON — click, hold, or drag a box across elements to select more',
          'info',
        )
      }, 380)
    }
  }

  // Dragging the Multi-Selection / Group floating badge also moves all selected elements together
  const handleMultiSelectionBarMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || inlineEdit) return
    const target = e.target as HTMLElement
    if (target.closest('button')) return
    e.stopPropagation()
    e.preventDefault()
    clearHoldTimer()
    const activeIds = expandWithGroupMembers(selectedElements)
    if (activeIds.length === 0) return
    const startPos: Record<string, { x: number; y: number }> = {}
    activeIds.forEach((id) => {
      const selEl = canvasElements.find((ce) => ce.id === id)
      if (selEl && !selEl.locked) {
        startPos[id] = selEl.id.startsWith('id_')
          ? { x: selEl.x, y: selEl.y }
          : { x: selEl.offsetX ?? 0, y: selEl.offsetY ?? 0 }
      }
    })
    setDragState({
      ids: activeIds,
      isTheme: activeIds.some((id) => !id.startsWith('id_')),
      hasMoved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPos,
    })
  }

  // Canvas click handler — keeps inline text preview fresh without clobbering multi-selection/groups
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (inlineEdit) return
    const target = e.target as HTMLElement
    const domEl = target.closest('[data-element-id]') as HTMLElement | null
    if (domEl) {
      e.stopPropagation()
      const txt = (domEl.innerText || '').trim()
      setLiveSelectedText(txt)
    }
  }

  const openInlineEditorForDomElement = (
    kind: 'element' | 'table-cell',
    id: string,
    label: string,
    domEl: HTMLElement,
    currentVal: string,
  ) => {
    if (!canvasRef.current) return
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const r = domEl.getBoundingClientRect()
    const multiline = currentVal.includes('\n') || r.height / Math.max(zoom, 0.4) > 34
    setInlineEdit({
      kind,
      id,
      label,
      value: currentVal,
      multiline,
      rect: {
        left: Math.max(2, r.left - canvasRect.left - 2),
        top: Math.max(2, r.top - canvasRect.top - 2),
        width: Math.max(96, r.width + 16),
        height: Math.max(26, r.height + 6),
      },
    })
  }

  const commitInlineEdit = () => {
    if (!inlineEdit) return
    if (inlineEdit.kind === 'table-cell') {
      setTableCellOverrides((prev) => ({
        ...prev,
        [inlineEdit.id]: { ...prev[inlineEdit.id], text: inlineEdit.value },
      }))
    } else {
      const targetEl = canvasElements.find((ce) => ce.id === inlineEdit.id)
      if (targetEl?.type === 'signature') {
        updateElement(inlineEdit.id, { caption: inlineEdit.value })
      } else {
        updateElement(inlineEdit.id, { text: inlineEdit.value })
        setLiveSelectedText(inlineEdit.value)
      }
    }
    setInlineEdit(null)
  }

  // Double-click handler — edit any theme text/cell right on the canvas or upload logo/photo/signature
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    clearHoldTimer()
    const target = e.target as HTMLElement
    // 1. Check if double-clicking a specific table header or cell inside subject-table
    const cellEl = target.closest('[data-table-cell-key]') as HTMLElement | null
    if (cellEl) {
      e.stopPropagation()
      e.preventDefault()
      const cellKey = cellEl.getAttribute('data-table-cell-key')!
      const cellLabel = cellEl.getAttribute('data-table-cell-label') || 'Table Cell'
      const cur = tableCellOverrides[cellKey]?.text ?? (cellEl.innerText || '').trim()
      openInlineEditorForDomElement('table-cell', cellKey, cellLabel, cellEl, cur)
      return
    }
    // 2. Check custom drag-added canvas element
    const customBox = target.closest('[data-canvas-element]') as HTMLElement | null
    if (customBox) {
      const customId = customBox.getAttribute('data-custom-id')
      const customEl = customId ? canvasElements.find((ce) => ce.id === customId) : null
      if (customEl) {
        e.stopPropagation()
        if (customEl.type === 'image' || customEl.type === 'logo' || customEl.type === 'signature') {
          triggerElementImageUpload(customEl.id)
        } else if (customEl.type !== 'table' && customEl.type !== 'divider' && customEl.type !== 'line') {
          openInlineEditorForDomElement('element', customEl.id, customEl.label, customBox, customEl.text ?? customEl.label)
        }
      }
      return
    }
    // 3. Check theme element ([data-element-id])
    const domEl = target.closest('[data-element-id]') as HTMLElement | null
    if (!domEl) return
    e.stopPropagation()
    e.preventDefault()
    const elId = domEl.getAttribute('data-element-id')!
    const el = ensureThemeElement(elId, domEl)
    setSelectedElements([elId])
    setSelectedElement(elId)
    setCurrentView('style')

    if (el.type === 'image' || el.type === 'logo') {
      triggerElementImageUpload(elId)
      return
    }
    if (el.type === 'signature') {
      // If double-clicking the caption text at the bottom of the signature, edit caption inline; otherwise upload image
      const curCaption = el.caption ?? el.text ?? (domEl.innerText || '').trim()
      openInlineEditorForDomElement('element', elId, `${el.label} Caption`, domEl, curCaption)
      return
    }
    if (el.type === 'table' || el.type === 'line' || el.type === 'divider') return
    const currentText = el.text !== undefined ? el.text : (domEl.innerText || '').trim()
    openInlineEditorForDomElement('element', elId, el.label, domEl, currentText)
  }

  const startMarqueeFromClientPoint = (clientX: number, clientY: number, additive: boolean, insideSheet = false) => {
    if (!canvasRef.current) return
    clearHoldTimer()
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const x = (clientX - canvasRect.left) / zoom
    const y = (clientY - canvasRect.top) / zoom
    setMarqueeStart({ x, y, additive, insideSheet })
    setMarquee({ x, y, w: 0, h: 0 })
    setMarqueePreviewIds([])
  }

  // A click on the surrounding workspace clears the selection, independently of
  // multi-select mode. Track the starting point so marquee drags are preserved.
  const workspacePressRef = useRef<{ x: number; y: number } | null>(null)
  const handleWorkspaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const start = workspacePressRef.current
    workspacePressRef.current = null
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return
    const target = e.target as HTMLElement
    if (canvasRef.current?.contains(target) || target.closest('[data-canvas-toolbar], [data-inline-editor], [data-resize-handle], [data-insertion-cursor], button, input, select, textarea, a')) return
    setSelectedElements([])
    setSelectedElement(null)
    setLiveSelectedText('')
    setCurrentView(lastPaletteView)
  }

  // Allow starting hold-and-drag marquee selection from the grey workspace surrounding the sheet too
  const handleWorkspaceMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    workspacePressRef.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    if (e.button !== 0 || inlineEdit) return
    const target = e.target as HTMLElement
    if (
      target.closest('[data-canvas-toolbar]') ||
      target.closest('[data-inline-editor]') ||
      target.closest('[data-resize-handle]') ||
      target.closest('[data-insertion-cursor]') ||
      target.closest('button, input, select, textarea, a') ||
      (canvasRef.current && canvasRef.current.contains(target))
    ) {
      return
    }
    e.preventDefault()
    const additive = multiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey
    startMarqueeFromClientPoint(e.clientX, e.clientY, additive, false)
  }

  // Live hover crosshair when Place Insertion Cursor mode is active
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!cursorMode || !canvasRef.current) {
      if (hoverCursorPoint) setHoverCursorPoint(null)
      return
    }
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) / zoom
    const rawY = (e.clientY - rect.top) / zoom
    const snapped = snapPointToCanvas(rawX, rawY, 0, 0, [], e.altKey)
    setHoverCursorPoint({ x: snapped.x, y: snapped.y })
  }

  // Mouse down on canvas sheet — handles cursor placement, element drag/hold start, and marquee/insertion click
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || inlineEdit) return
    const target = e.target as HTMLElement
    if (target.closest('[data-inline-editor]') || target.closest('[data-insertion-cursor]')) return

    if (cursorMode && canvasRef.current) {
      e.preventDefault()
      e.stopPropagation()
      const rect = canvasRef.current.getBoundingClientRect()
      const rawX = (e.clientX - rect.left) / zoom
      const rawY = (e.clientY - rect.top) / zoom
      const snapped = snapPointToCanvas(rawX, rawY, 0, 0, [], e.altKey)
      setInsertionPoint({ x: snapped.x, y: snapped.y })
      setCursorMode(false)
      setHoverCursorPoint(null)
      toast(`Insertion point set at (${snapped.x}, ${snapped.y}) — click an element or Paste to place here`, 'info')
      return
    }

    // If clicking on a drag-added element (has onMouseDown handler), let it handle
    if (target.closest('[data-canvas-element]')) return
    if (target.closest('[data-resize-handle]')) return
    // If clicking on a renderer element (data-element-id), select & prepare drag / hold-to-multiselect
    const elIdEl = target.closest('[data-element-id]') as HTMLElement | null
    if (elIdEl) {
      const elId = elIdEl.getAttribute('data-element-id')!
      const stateEl = ensureThemeElement(elId, elIdEl)
      setLiveSelectedText((elIdEl.innerText || '').trim())
      handleElementMouseDown(e, stateEl)
      return
    }
    // Empty canvas area — prevent native text selection, start marquee if dragged, or place insertion point if clicked
    e.preventDefault()
    const additive = multiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey
    startMarqueeFromClientPoint(e.clientX, e.clientY, additive, true)
  }

  const computeMarqueeHits = (
    box: { x: number; y: number; w: number; h: number },
    ensureMissing: boolean,
  ): { hitIds: string[]; newlyEnsured: CanvasElement[] } => {
    if (!canvasRef.current) return { hitIds: [], newlyEnsured: [] }
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const rawHits: string[] = []

    // 1. Custom drag-added elements (exact unzoomed canvas coordinates)
    for (const el of canvasElements) {
      if (el.hidden || !el.id.startsWith('id_')) continue
      const elRight = el.x + el.width
      const elBottom = el.y + el.height
      if (
        el.x < box.x + box.w &&
        elRight > box.x &&
        el.y < box.y + box.h &&
        elBottom > box.y
      ) {
        rawHits.push(el.id)
      }
    }

    // 2. Rendered theme elements ([data-element-id]) using real measured DOM rects
    const themeNodes = canvasRef.current.querySelectorAll('[data-element-id]')
    const newlyEnsured: CanvasElement[] = []
    themeNodes.forEach((node) => {
      if (!(node instanceof HTMLElement) || node.style.display === 'none') return
      const elId = node.getAttribute('data-element-id')
      if (!elId) return
      const r = node.getBoundingClientRect()
      if (r.width <= 0 || r.height <= 0) return
      const rx = (r.left - canvasRect.left) / zoom
      const ry = (r.top - canvasRect.top) / zoom
      const rw = r.width / zoom
      const rh = r.height / zoom
      if (
        rx < box.x + box.w &&
        rx + rw > box.x &&
        ry < box.y + box.h &&
        ry + rh > box.y
      ) {
        rawHits.push(elId)
        if (ensureMissing && !canvasElements.some((ce) => ce.id === elId)) {
          newlyEnsured.push({
            id: elId,
            type: (node.getAttribute('data-element-type') || 'text') as CanvasElement['type'],
            label: node.getAttribute('data-element-label') || elId,
            x: Math.round(rx),
            y: Math.round(ry),
            width: Math.max(24, Math.round(rw)),
            height: Math.max(14, Math.round(rh)),
            style: {},
          })
        }
      }
    })

    const mergedList = newlyEnsured.length > 0 ? [...canvasElements, ...newlyEnsured] : canvasElements
    return {
      hitIds: expandWithGroupMembers(rawHits, mergedList),
      newlyEnsured,
    }
  }

  // Resize handle mouse down (supports both custom boxes and theme elements)
  const handleResizeMouseDown = (e: React.MouseEvent, el: CanvasElement, corner: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
    e.stopPropagation()
    e.preventDefault()
    clearHoldTimer()
    if (el.locked) return
    const isTheme = !el.id.startsWith('id_')
    let startW = el.width
    let startH = el.height
    if (isTheme && selectedElRect && zoom > 0) {
      startW = Math.max(20, Math.round(selectedElRect.width / zoom))
      startH = Math.max(14, Math.round(selectedElRect.height / zoom))
    }
    setResizeState({
      id: el.id,
      isTheme,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
      startPosX: isTheme ? (el.offsetX ?? 0) : el.x,
      startPosY: isTheme ? (el.offsetY ?? 0) : el.y,
    })
  }

  const processPointerMove = (clientX: number, clientY: number) => {
    if (resizeState) {
      if (!canvasRef.current) return
      const dx = (clientX - resizeState.startX) / zoom
      const dy = (clientY - resizeState.startY) / zoom
      setCanvasElements((prev) =>
        prev.map((el) => {
          if (el.id !== resizeState.id) return el
          const minW = el.type === 'line' || el.type === 'divider' ? 8 : 20
          const minH = el.type === 'line' || el.type === 'divider' ? 8 : 14
          let newW = resizeState.startW
          let newH = resizeState.startH
          let newPosX = resizeState.startPosX
          let newPosY = resizeState.startPosY
          if (resizeState.corner === 'se') {
            newW = Math.max(minW, Math.round(resizeState.startW + dx))
            newH = Math.max(minH, Math.round(resizeState.startH + dy))
          } else if (resizeState.corner === 'nw') {
            newW = Math.max(minW, Math.round(resizeState.startW - dx))
            newH = Math.max(minH, Math.round(resizeState.startH - dy))
            newPosX = Math.round(resizeState.startPosX + (resizeState.startW - newW))
            newPosY = Math.round(resizeState.startPosY + (resizeState.startH - newH))
          } else if (resizeState.corner === 'ne') {
            newW = Math.max(minW, Math.round(resizeState.startW + dx))
            newH = Math.max(minH, Math.round(resizeState.startH - dy))
            newPosY = Math.round(resizeState.startPosY + (resizeState.startH - newH))
          } else if (resizeState.corner === 'sw') {
            newW = Math.max(minW, Math.round(resizeState.startW - dx))
            newH = Math.max(minH, Math.round(resizeState.startH + dy))
            newPosX = Math.round(resizeState.startPosX + (resizeState.startW - newW))
          } else if (resizeState.corner === 'n') {
            newH = Math.max(minH, Math.round(resizeState.startH - dy))
            newPosY = Math.round(resizeState.startPosY + (resizeState.startH - newH))
          } else if (resizeState.corner === 's') {
            newH = Math.max(minH, Math.round(resizeState.startH + dy))
          } else if (resizeState.corner === 'e') {
            newW = Math.max(minW, Math.round(resizeState.startW + dx))
          } else if (resizeState.corner === 'w') {
            newW = Math.max(minW, Math.round(resizeState.startW - dx))
            newPosX = Math.round(resizeState.startPosX + (resizeState.startW - newW))
          }
          if (resizeState.isTheme) {
            return {
              ...el,
              width: newW,
              height: newH,
              offsetX: newPosX,
              offsetY: newPosY,
              style: { ...el.style, customSize: true },
            }
          }
          return { ...el, width: newW, height: newH, x: newPosX, y: newPosY }
        }),
      )
      return
    }
    if (draggingInsertionPin && canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect()
      const cx = (clientX - canvasRect.left) / zoom
      const cy = (clientY - canvasRect.top) / zoom
      const snapped = snapPointToCanvas(cx, cy, 0, 0, [], false)
      setInsertionPoint({ x: snapped.x, y: snapped.y })
      setActiveSnapGuides({
        vertical: snapped.vertical,
        horizontal: snapped.horizontal,
        readout: { x: snapped.x, y: snapped.y },
      })
      return
    }
    if (!dragState || !canvasRef.current) {
      if (marqueeStart && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect()
        const cx = (clientX - canvasRect.left) / zoom
        const cy = (clientY - canvasRect.top) / zoom
        const nextBox = {
          x: Math.min(marqueeStart.x, cx),
          y: Math.min(marqueeStart.y, cy),
          w: Math.abs(cx - marqueeStart.x),
          h: Math.abs(cy - marqueeStart.y),
        }
        setMarquee(nextBox)
        if ((nextBox.w > 3 || nextBox.h > 3) && Math.hypot(nextBox.w, nextBox.h) > 5) {
          const { hitIds } = computeMarqueeHits(nextBox, false)
          setMarqueePreviewIds(hitIds)
        } else {
          setMarqueePreviewIds([])
        }
      }
      return
    }
    const rawDx = clientX - dragState.startClientX
    const rawDy = clientY - dragState.startClientY
    if (!dragState.hasMoved && Math.hypot(rawDx, rawDy) < 4) return
    clearHoldTimer()
    if (!dragState.hasMoved) {
      setDragState((prev) => (prev ? { ...prev, hasMoved: true } : null))
    }
    if (dragState.ids.length === 0) return
    const deltaX = rawDx / zoom
    const deltaY = rawDy / zoom

    // Compute smart snap across dragged custom elements so positioning is effortless and pixel-clean
    const draggedCustom = canvasElements.filter(
      (el) => dragState.ids.includes(el.id) && !el.locked && el.id.startsWith('id_'),
    )
    let minDx = -Infinity
    let maxDx = Infinity
    let minDy = -Infinity
    let maxDy = Infinity
    let minStartX = Infinity
    let minStartY = Infinity
    let maxStartRight = -Infinity
    let maxStartBottom = -Infinity
    for (const el of draggedCustom) {
      const start = dragState.startPos[el.id] || { x: el.x, y: el.y }
      minDx = Math.max(minDx, -start.x)
      maxDx = Math.min(maxDx, Math.max(0, 560 - el.width) - start.x)
      minDy = Math.max(minDy, -start.y)
      maxDy = Math.min(maxDy, Math.max(0, 780 - el.height) - start.y)
      minStartX = Math.min(minStartX, start.x)
      minStartY = Math.min(minStartY, start.y)
      maxStartRight = Math.max(maxStartRight, start.x + el.width)
      maxStartBottom = Math.max(maxStartBottom, start.y + el.height)
    }
    let effectiveDx = minDx <= maxDx ? Math.max(minDx, Math.min(maxDx, deltaX)) : deltaX
    let effectiveDy = minDy <= maxDy ? Math.max(minDy, Math.min(maxDy, deltaY)) : deltaY

    if (draggedCustom.length > 0 && Number.isFinite(minStartX) && Number.isFinite(minStartY)) {
      const boxW = Math.max(1, maxStartRight - minStartX)
      const boxH = Math.max(1, maxStartBottom - minStartY)
      const snapped = snapPointToCanvas(
        minStartX + effectiveDx,
        minStartY + effectiveDy,
        boxW,
        boxH,
        dragState.ids,
        false,
      )
      effectiveDx = snapped.x - minStartX
      effectiveDy = snapped.y - minStartY
      setActiveSnapGuides({
        vertical: snapped.vertical,
        horizontal: snapped.horizontal,
        readout: { x: snapped.x, y: snapped.y },
      })
    } else if (dragState.ids.length > 0) {
      const firstId = dragState.ids[0]
      const start0 = dragState.startPos[firstId] || { x: 0, y: 0 }
      setActiveSnapGuides({
        vertical: [],
        horizontal: [],
        readout: { x: Math.round(start0.x + effectiveDx), y: Math.round(start0.y + effectiveDy) },
      })
    }

    setCanvasElements((prev) =>
      prev.map((el) => {
        if (!dragState.ids.includes(el.id) || el.locked) return el
        const start = dragState.startPos[el.id] || { x: 0, y: 0 }
        if (!el.id.startsWith('id_')) {
          return {
            ...el,
            offsetX: Math.round(start.x + effectiveDx),
            offsetY: Math.round(start.y + effectiveDy),
          }
        }
        return {
          ...el,
          x: Math.round(start.x + effectiveDx),
          y: Math.round(start.y + effectiveDy),
        }
      }),
    )
  }

  const processPointerUp = (
    _clientX: number,
    _clientY: number,
    modifiers: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean },
    target: EventTarget | null,
  ) => {
    clearHoldTimer()
    setActiveSnapGuides(null)
    if (draggingInsertionPin) {
      setDraggingInsertionPin(false)
      return
    }
    if (dragState && !dragState.hasMoved && dragState.toggleOffOnClickIds && !dragState.holdAdded) {
      const removeSet = new Set(dragState.toggleOffOnClickIds)
      const nextSelectedIds = selectedElements.filter((id) => !removeSet.has(id))
      setSelectedElements(nextSelectedIds)
      setSelectedElement(nextSelectedIds[nextSelectedIds.length - 1] ?? null)
      setCurrentView(nextSelectedIds.length > 0 ? 'style' : lastPaletteView)
    }
    setDragState(null)
    setResizeState(null)

    const isAdditive =
      Boolean(marqueeStart?.additive) ||
      multiSelectMode ||
      modifiers.ctrlKey ||
      modifiers.metaKey ||
      modifiers.shiftKey
    const isRealSweep =
      Boolean(marqueeStart && marquee && (marquee.w > 3 || marquee.h > 3) && Math.hypot(marquee.w, marquee.h) > 5)

    if (marqueeStart && marquee && isRealSweep && canvasRef.current) {
      const { hitIds: baseHits, newlyEnsured } = computeMarqueeHits(marquee, true)

      if (newlyEnsured.length > 0) {
        setCanvasElements((prev) => {
          const existing = new Set(prev.map((ce) => ce.id))
          return [...prev, ...newlyEnsured.filter((ne) => !existing.has(ne.id))]
        })
      }

      const finalIds = isAdditive
        ? Array.from(new Set([...selectedElements, ...baseHits]))
        : baseHits

      if (finalIds.length > 0) {
        setSelectedElements(finalIds)
        setSelectedElement(finalIds[finalIds.length - 1])
        if (currentView !== 'style') setLastPaletteView(currentView as 'elements' | 'editor' | 'sections' | 'templates' | 'setup')
        setCurrentView('style')
      } else if (!isAdditive) {
        setSelectedElements([])
        setSelectedElement(null)
        setCurrentView(lastPaletteView)
      }
    } else if (marqueeStart && !isAdditive) {
      const targetEl = target instanceof HTMLElement ? target : null
      if (!targetEl?.closest('[data-canvas-element]') && !targetEl?.closest('[data-element-id]') && !targetEl?.closest('[data-insertion-cursor]')) {
        setSelectedElements([])
        setSelectedElement(null)
        setCurrentView(lastPaletteView)
        if (marqueeStart.insideSheet) {
          const snapped = snapPointToCanvas(marqueeStart.x, marqueeStart.y, 0, 0, [], Boolean(modifiers.altKey))
          setInsertionPoint({ x: snapped.x, y: snapped.y })
        }
      }
    }
    setMarquee(null)
    setMarqueeStart(null)
    setMarqueePreviewIds([])
  }

  const pointerHandlersRef = useRef<{
    move: (clientX: number, clientY: number) => void
    up: (clientX: number, clientY: number, mods: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey?: boolean }, target: EventTarget | null) => void
  } | null>(null)
  pointerHandlersRef.current = {
    move: processPointerMove,
    up: processPointerUp,
  }

  const isPointerTracking = Boolean(dragState || resizeState || marqueeStart || draggingInsertionPin)
  useEffect(() => {
    if (!isPointerTracking) return
    const onWinMove = (ev: MouseEvent) => {
      pointerHandlersRef.current?.move(ev.clientX, ev.clientY)
    }
    const onWinUp = (ev: MouseEvent) => {
      pointerHandlersRef.current?.up(
        ev.clientX,
        ev.clientY,
        { ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, shiftKey: ev.shiftKey, altKey: ev.altKey },
        ev.target,
      )
    }
    const onWinBlur = () => {
      clearHoldTimer()
      setDragState(null)
      setResizeState(null)
      setDraggingInsertionPin(false)
      setActiveSnapGuides(null)
      setMarquee(null)
      setMarqueeStart(null)
      setMarqueePreviewIds([])
    }
    window.addEventListener('mousemove', onWinMove)
    window.addEventListener('mouseup', onWinUp)
    window.addEventListener('blur', onWinBlur)
    return () => {
      window.removeEventListener('mousemove', onWinMove)
      window.removeEventListener('mouseup', onWinUp)
      window.removeEventListener('blur', onWinBlur)
    }
  }, [isPointerTracking])

  const moveSelectionToInsertionPoint = (explicitPt?: { x: number; y: number }) => {
    const pt = explicitPt ?? insertionPoint
    if (!pt) {
      toast('Click a spot on the canvas first to set the insertion point', 'info')
      return
    }
    const targets = resolveActiveTargets()
    if (targets.length === 0) {
      toast('Select an element on the canvas first to move it to the cursor', 'info')
      return
    }
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    const measuredPositions = new Map<string, { left: number; top: number }>()
    let anchorLeft = Infinity
    let anchorTop = Infinity
    for (const t of targets) {
      if (t.id.startsWith('id_')) {
        measuredPositions.set(t.id, { left: t.x, top: t.y })
        anchorLeft = Math.min(anchorLeft, t.x)
        anchorTop = Math.min(anchorTop, t.y)
      } else if (canvasRef.current && canvasRect && zoom > 0) {
        const domNode = canvasRef.current.querySelector(`[data-element-id="${t.id}"]`) as HTMLElement | null
        if (domNode) {
          const r = domNode.getBoundingClientRect()
          const curLeft = (r.left - canvasRect.left) / zoom
          const curTop = (r.top - canvasRect.top) / zoom
          measuredPositions.set(t.id, { left: curLeft, top: curTop })
          anchorLeft = Math.min(anchorLeft, curLeft)
          anchorTop = Math.min(anchorTop, curTop)
        }
      }
    }
    if (!Number.isFinite(anchorLeft) || !Number.isFinite(anchorTop)) return
    const shiftX = pt.x - anchorLeft
    const shiftY = pt.y - anchorTop
    const idSet = new Set(targets.map((t) => t.id))

    setCanvasElements((prev) =>
      prev.map((el) => {
        if (!idSet.has(el.id) || el.locked) return el
        if (el.id.startsWith('id_')) {
          return {
            ...el,
            x: Math.max(0, Math.min(Math.round(el.x + shiftX), 560 - Math.min(el.width, 560))),
            y: Math.max(0, Math.min(Math.round(el.y + shiftY), 780 - Math.min(el.height, 780))),
          }
        }
        return {
          ...el,
          offsetX: Math.round((el.offsetX ?? 0) + shiftX),
          offsetY: Math.round((el.offsetY ?? 0) + shiftY),
        }
      }),
    )
    setCanvasContextMenu(null)
    toast(
      `Moved ${targets.length} element${targets.length > 1 ? 's' : ''} to cursor (${pt.x}, ${pt.y})`,
      'success',
    )
  }

  const deleteElement = (id: string) => {
    if (id.startsWith('id_')) {
      setCanvasElements((prev) => prev.filter((el) => el.id !== id))
    } else {
      setCanvasElements((prev) => prev.map((el) => (el.id === id ? { ...el, hidden: true } : el)))
    }
    setSelectedElements((prev) => prev.filter((sid) => sid !== id))
    if (selectedElement === id) setSelectedElement(null)
  }

  const restoreThemeElement = (id: string) => {
    setCanvasElements((prev) => prev.map((el) => (el.id === id ? { ...el, hidden: false } : el)))
    setSelectedElement(id)
    setSelectedElements([id])
    setCurrentView('style')
  }

  const resetThemeElement = (id: string) => {
    setCanvasElements((prev) =>
      prev.map((el) =>
        el.id === id
          ? {
              ...el,
              text: undefined,
              imageSrc: undefined,
              caption: undefined,
              hidden: false,
              offsetX: 0,
              offsetY: 0,
              style: {},
            }
          : el,
      ),
    )
    if (id === 'school-logo') {
      setCanvasSettings((s) => ({ ...s, schoolLogo: '' }))
    }
    if (id === 'subject-table') {
      setTableCellOverrides({})
    }
    toast('Element reset to theme default', 'info')
  }

  const resetAllThemeEdits = () => {
    const activeTheme = previewTheme || REPORTSHEET_THEMES[0]
    setCanvasElements((prev) => [
      ...getThemeElements(activeTheme),
      ...prev.filter((el) => el.id.startsWith('id_')),
    ])
    setTableCellOverrides({})
    toast('All theme elements reset to default', 'info')
  }

  const deleteSelectedElements = () => {
    if (selectedElements.length === 0) return
    setCanvasElements((prev) =>
      prev
        .filter((el) => !(selectedElements.includes(el.id) && el.id.startsWith('id_')))
        .map((el) => (selectedElements.includes(el.id) && !el.id.startsWith('id_') ? { ...el, hidden: true, groupId: undefined } : el)),
    )
    setSelectedElements([])
    setSelectedElement(null)
  }

  // Group / Ungroup / Duplicate / Batch Align helpers (EduMESS multi-select & group workflow)
  const selectedObjects = useMemo(
    () => canvasElements.filter((ce) => selectedElements.includes(ce.id) && !ce.hidden),
    [canvasElements, selectedElements],
  )
  const selectedGroupIds = useMemo(
    () => Array.from(new Set(selectedObjects.map((ce) => ce.groupId).filter((g): g is string => Boolean(g)))),
    [selectedObjects],
  )
  const hasGroupedSelection = selectedGroupIds.length > 0
  const isSingleCompleteGroup =
    selectedGroupIds.length === 1 &&
    selectedObjects.length >= 2 &&
    selectedObjects.every((ce) => ce.groupId === selectedGroupIds[0])
  const canGroupSelection = selectedObjects.length >= 2 && !isSingleCompleteGroup
  const canUngroupSelection = hasGroupedSelection

  const groupSelectedElements = () => {
    if (selectedObjects.length < 2) {
      toast('Select 2 or more elements on the canvas to group them', 'info')
      return
    }
    const newGroupId = `grp_${uid()}`
    const targetSet = new Set(selectedObjects.map((ce) => ce.id))
    setCanvasElements((prev) =>
      prev.map((el) => (targetSet.has(el.id) ? { ...el, groupId: newGroupId } : el)),
    )
    setMultiSelectMode(false)
    toast(`Grouped ${selectedObjects.length} elements — drag any item to move them together`, 'success')
  }

  const ungroupSelectedElements = () => {
    if (selectedGroupIds.length === 0) return
    const grpSet = new Set(selectedGroupIds)
    setCanvasElements((prev) =>
      prev.map((el) => (el.groupId && grpSet.has(el.groupId) ? { ...el, groupId: undefined } : el)),
    )
    toast('Ungrouped elements — you can now move each element individually', 'info')
  }

  const [themeClipboard, setThemeClipboard] = useState<ThemeClipboardPayload | null>(() => sharedReportThemeClipboard)
  const [copyToThemeMenuOpen, setCopyToThemeMenuOpen] = useState(false)
  const [floatingCopyToThemeOpen, setFloatingCopyToThemeOpen] = useState(false)
  const [canvasContextMenu, setCanvasContextMenu] = useState<{
    clientX: number
    clientY: number
    sheetX: number
    sheetY: number
    targetIds: string[]
  } | null>(null)
  const [copyFromThemeId, setCopyFromThemeId] = useState<string>('')
  const themeWorkspacesRef = useRef<Record<string, { elements: CanvasElement[]; tableCellOverrides: Record<string, ThemeElementOverride> }>>({})

  const resolveActiveTargets = (overrideIds?: string[]): CanvasElement[] => {
    const rawIds =
      Array.isArray(overrideIds) && overrideIds.length > 0
        ? overrideIds
        : selectedElements.length > 0
          ? selectedElements
          : selectedElement
            ? [selectedElement]
            : []
    const uniqueIds = Array.from(new Set(rawIds))
    const resolved: CanvasElement[] = []
    for (const id of uniqueIds) {
      const existing = canvasElements.find((ce) => ce.id === id)
      if (existing) {
        if (!existing.hidden) resolved.push(existing)
      } else if (!id.startsWith('id_') && canvasRef.current) {
        const domNode = canvasRef.current.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
        if (domNode) {
          resolved.push(ensureThemeElement(id, domNode))
        }
      }
    }
    return resolved
  }

  const snapshotElementsForCopy = (targets: CanvasElement[]): CanvasElement[] => {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    const groupIdRemap = new Map<string, string>()
    const snapshots: CanvasElement[] = []

    for (const src of targets) {
      let baseX = src.x
      let baseY = src.y
      let baseW = src.width
      let baseH = src.height
      let fallbackText = src.text
      let fallbackImageSrc = src.imageSrc
      let fallbackCaption = src.caption
      let fallbackField = src.field
      const clonedStyle: Record<string, unknown> = src.style ? { ...src.style } : {}
      delete clonedStyle.customSize

      if (!src.id.startsWith('id_') && canvasRef.current && canvasRect && zoom > 0) {
        const domNode = canvasRef.current.querySelector(`[data-element-id="${src.id}"]`) as HTMLElement | null
        if (domNode) {
          const r = domNode.getBoundingClientRect()
          baseX = Math.round((r.left - canvasRect.left) / zoom)
          baseY = Math.round((r.top - canvasRect.top) / zoom)
          baseW = Math.max(16, Math.round(r.width / zoom))
          baseH = Math.max(8, Math.round(r.height / zoom))

          if (src.type === 'line' || src.type === 'divider') {
            const domLineColor = domNode.getAttribute('data-default-color')
            const rawThick = parseFloat(domNode.getAttribute('data-default-thickness') || '')
            const domLineStyle = domNode.getAttribute('data-default-line-style')
            if (!clonedStyle.bg) {
              clonedStyle.bg =
                domLineColor ||
                (src.id === 'grading-scale-line' || src.id === 'footer-line'
                  ? '#e3e3dc'
                  : src.id === 'header-line'
                    ? (previewTheme?.id === 'theme-1' ? '#16325c' : previewTheme?.accentColor || '#16325c')
                    : '#1e293b')
            }
            if (clonedStyle.lineThickness === undefined && !Number.isNaN(rawThick) && rawThick > 0) {
              clonedStyle.lineThickness = rawThick
            }
            if (!clonedStyle.lineStyle && domLineStyle) {
              clonedStyle.lineStyle = domLineStyle
            }
          } else if (src.type === 'image' || src.type === 'logo') {
            if (!fallbackImageSrc && (src.id === 'school-logo' || src.field === 'school_logo') && canvasSettings.schoolLogo) {
              fallbackImageSrc = canvasSettings.schoolLogo
            }
            if (!fallbackField) {
              if (src.id === 'school-logo') fallbackField = 'school_logo'
              else if (src.id === 'student-photo') fallbackField = 'student_photo'
            }
          } else if (src.type === 'signature') {
            if (fallbackCaption === undefined) {
              fallbackCaption = (domNode.innerText || '').trim() || src.label
            }
            if (!clonedStyle.color) {
              clonedStyle.color = previewTheme?.accentColor || '#1e293b'
            }
            if (clonedStyle.bg === undefined) {
              const cs = window.getComputedStyle(domNode)
              clonedStyle.bg =
                cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
                  ? rgbToHexOrCss(cs.backgroundColor)
                  : 'transparent'
            }
          } else if (src.type === 'table') {
            if (!clonedStyle.headerBg) {
              clonedStyle.headerBg =
                previewTheme?.id === 'theme-4' || previewTheme?.id === 'theme-6'
                  ? previewTheme.accentColor
                  : '#f1f5f9'
            }
            if (!clonedStyle.headerColor) {
              clonedStyle.headerColor =
                previewTheme?.id === 'theme-4' || previewTheme?.id === 'theme-6'
                  ? '#ffffff'
                  : '#0f172a'
            }
          } else {
            if (fallbackText === undefined) {
              fallbackText = (domNode.innerText || '').trim() || src.label
            }
            const cs = window.getComputedStyle(domNode)
            if (clonedStyle.fontSize === undefined) {
              const fs = parseFloat(cs.fontSize)
              if (!Number.isNaN(fs) && fs > 0) clonedStyle.fontSize = Math.round(fs * 10) / 10
            }
            if (clonedStyle.bold === undefined) {
              const fw = parseInt(cs.fontWeight, 10)
              if ((!Number.isNaN(fw) && fw >= 600) || cs.fontWeight === 'bold') clonedStyle.bold = true
            }
            if (!clonedStyle.color && cs.color) {
              clonedStyle.color = rgbToHexOrCss(cs.color)
            }
            if (clonedStyle.bg === undefined) {
              clonedStyle.bg =
                cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
                  ? rgbToHexOrCss(cs.backgroundColor)
                  : 'transparent'
            }
            if (!clonedStyle.align) {
              if (cs.textAlign === 'center' || cs.textAlign === 'right' || cs.textAlign === 'left') {
                clonedStyle.align = cs.textAlign
              } else {
                clonedStyle.align = 'left'
              }
            }
            if (clonedStyle.padding === undefined) {
              clonedStyle.padding = clonedStyle.bg && clonedStyle.bg !== 'transparent' ? 4 : 0
            }
            if (clonedStyle.radius === undefined) {
              const rad = parseFloat(cs.borderRadius)
              if (!Number.isNaN(rad) && rad > 0) clonedStyle.radius = Math.round(rad)
            }
            if (!clonedStyle.letterSpacing && cs.letterSpacing && cs.letterSpacing !== 'normal') {
              clonedStyle.letterSpacing = cs.letterSpacing
            }
            if (!clonedStyle.textTransform && cs.textTransform && cs.textTransform !== 'none') {
              clonedStyle.textTransform = cs.textTransform
            }
            if (!clonedStyle.borderWidth) {
              const bw = parseFloat(cs.borderTopWidth)
              if (!Number.isNaN(bw) && bw >= 1 && cs.borderTopStyle && cs.borderTopStyle !== 'none') {
                clonedStyle.borderWidth = Math.round(bw * 10) / 10
                clonedStyle.borderStyle = cs.borderTopStyle
                clonedStyle.borderColor = rgbToHexOrCss(cs.borderTopColor)
              }
            }
          }
        }
      }

      let nextGroupId: string | undefined
      if (src.groupId) {
        if (!groupIdRemap.has(src.groupId)) groupIdRemap.set(src.groupId, `grp_${uid()}`)
        nextGroupId = groupIdRemap.get(src.groupId)
      }

      snapshots.push({
        ...src,
        id: uid(),
        label: src.label.replace(/\s+Copy$/, ''),
        x: Math.max(0, Math.min(baseX, 560 - Math.min(baseW, 560))),
        y: Math.max(0, Math.min(baseY, 780 - Math.min(baseH, 780))),
        width: baseW,
        height: baseH,
        offsetX: undefined,
        offsetY: undefined,
        hidden: false,
        text: fallbackText,
        imageSrc: fallbackImageSrc,
        caption: fallbackCaption,
        field: fallbackField,
        style: clonedStyle,
        groupId: nextGroupId,
      })
    }
    return snapshots
  }

  const copySelectedElements = (overrideIds?: string[]) => {
    const targets = resolveActiveTargets(overrideIds)
    if (targets.length === 0) {
      toast('Select one or more elements on the canvas first to copy', 'info')
      return
    }
    const items = snapshotElementsForCopy(targets)
    if (items.length === 0) return
    const srcTheme = previewTheme || REPORTSHEET_THEMES[0]
    const payload: ThemeClipboardPayload = {
      sourceThemeId: srcTheme.id,
      sourceThemeName: srcTheme.name,
      pasteCount: 0,
      items,
    }
    sharedReportThemeClipboard = payload
    setThemeClipboard(payload)
    setCanvasContextMenu(null)
    toast(
      `Copied ${items.length} element${items.length > 1 ? 's' : ''} from ${srcTheme.name} — switch to any theme and click Paste (Ctrl+V)`,
      'success',
    )
  }

  const pasteCopiedElements = (
    explicitClipboard?: ThemeClipboardPayload | null,
    atPoint?: { x: number; y: number },
  ) => {
    const clip = explicitClipboard ?? themeClipboard ?? sharedReportThemeClipboard
    if (!clip || clip.items.length === 0) {
      toast('Clipboard is empty — select element(s) on a theme and click Copy (Ctrl+C) first', 'info')
      return
    }
    const targetPoint = atPoint ?? insertionPoint
    const targetTheme = previewTheme || REPORTSHEET_THEMES[0]
    const sameTheme = clip.sourceThemeId === targetTheme.id
    const offsetStep = sameTheme ? clip.pasteCount + 1 : clip.pasteCount
    const shift = offsetStep * 14
    const anchorMinX = Math.min(...clip.items.map((it) => it.x))
    const anchorMinY = Math.min(...clip.items.map((it) => it.y))
    const anchorMaxBottom = Math.max(...clip.items.map((it) => it.y + it.height))
    const groupH = Math.max(18, anchorMaxBottom - anchorMinY)
    const groupIdRemap = new Map<string, string>()

    const pasted: CanvasElement[] = clip.items.map((item) => {
      let nextGroupId: string | undefined
      if (item.groupId) {
        if (!groupIdRemap.has(item.groupId)) groupIdRemap.set(item.groupId, `grp_${uid()}`)
        nextGroupId = groupIdRemap.get(item.groupId)
      }
      const maxW = Math.min(item.width, 560)
      const maxH = Math.min(item.height, 780)
      const targetX = targetPoint ? Math.round(targetPoint.x + (item.x - anchorMinX)) : item.x + shift
      const targetY = targetPoint ? Math.round(targetPoint.y + (item.y - anchorMinY)) : item.y + shift
      return {
        ...item,
        id: uid(),
        x: Math.max(0, Math.min(targetX, 560 - maxW)),
        y: Math.max(0, Math.min(targetY, 780 - maxH)),
        hidden: false,
        style: item.style ? { ...item.style } : {},
        groupId: nextGroupId,
      }
    })

    if (insertionPoint && !atPoint) {
      setInsertionPoint({
        x: insertionPoint.x,
        y: Math.min(752, insertionPoint.y + Math.min(groupH + 8, 48)),
      })
    }

    const updatedClip: ThemeClipboardPayload = {
      ...clip,
      pasteCount: targetPoint ? clip.pasteCount : clip.pasteCount + 1,
    }
    sharedReportThemeClipboard = updatedClip
    setThemeClipboard(updatedClip)
    setCanvasContextMenu(null)

    setCanvasElements((prev) => [...prev, ...pasted])
    const pastedIds = pasted.map((p) => p.id)
    setSelectedElements(pastedIds)
    setSelectedElement(pastedIds[pastedIds.length - 1])
    setMultiSelectMode(false)
    setEditMode(true)
    toast(
      sameTheme
        ? `Pasted ${pasted.length} element${pasted.length > 1 ? 's' : ''} on ${targetTheme.name}`
        : `Pasted ${pasted.length} element${pasted.length > 1 ? 's' : ''} from ${clip.sourceThemeName} onto ${targetTheme.name}`,
      'success',
    )
  }

  const duplicateSelectedElements = (overrideIds?: string[]) => {
    const targets = resolveActiveTargets(overrideIds)
    if (targets.length === 0) return
    const items = snapshotElementsForCopy(targets).map((item) => ({
      ...item,
      label: `${item.label} Copy`,
      x: Math.max(0, Math.min(item.x + 16, 560 - Math.min(item.width, 560))),
      y: Math.max(0, Math.min(item.y + 16, 780 - Math.min(item.height, 780))),
    }))
    if (items.length > 0) {
      setCanvasElements((prev) => [...prev, ...items])
      const cloneIds = items.map((c) => c.id)
      setSelectedElements(cloneIds)
      setSelectedElement(cloneIds[cloneIds.length - 1])
      setMultiSelectMode(false)
      setCanvasContextMenu(null)
      toast(`Duplicated ${items.length} element${items.length > 1 ? 's' : ''}`, 'success')
    }
  }

  const alignSelectedElements = (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const customSel = selectedObjects.filter((ce) => ce.id.startsWith('id_') && !ce.locked)
    if (customSel.length < 2) return
    const minX = Math.min(...customSel.map((c) => c.x))
    const maxRight = Math.max(...customSel.map((c) => c.x + c.width))
    const minY = Math.min(...customSel.map((c) => c.y))
    const maxBottom = Math.max(...customSel.map((c) => c.y + c.height))
    const centerX = (minX + maxRight) / 2
    const centerY = (minY + maxBottom) / 2
    const idSet = new Set(customSel.map((c) => c.id))
    setCanvasElements((prev) =>
      prev.map((el) => {
        if (!idSet.has(el.id)) return el
        if (mode === 'left') return { ...el, x: minX }
        if (mode === 'center') return { ...el, x: Math.round(centerX - el.width / 2) }
        if (mode === 'right') return { ...el, x: Math.round(maxRight - el.width) }
        if (mode === 'top') return { ...el, y: minY }
        if (mode === 'middle') return { ...el, y: Math.round(centerY - el.height / 2) }
        if (mode === 'bottom') return { ...el, y: Math.round(maxBottom - el.height) }
        return el
      }),
    )
  }

  // Update element properties
  const updateElement = (id: string, props: Partial<CanvasElement>) => {
    setCanvasElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...props } : el)))
  }

  // Update element style
  const updateStyle = (id: string, key: string, value: unknown) => {
    setCanvasElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, style: { ...el.style, [key]: value } } : el)),
    )
  }

  // Get selected element
  const selectedEl = canvasElements.find((el) => el.id === selectedElement) || null
  const hiddenThemeElements = useMemo(
    () => canvasElements.filter((el) => !el.id.startsWith('id_') && el.hidden),
    [canvasElements],
  )

  // Get table element for subject table settings
  const tableEl =
    canvasElements.find((el) => el.id === 'subject-table') ||
    canvasElements.find((el) => el.type === 'table' && el.field === 'subject_table') ||
    canvasElements.find((el) => el.type === 'table') ||
    null

  // Declarative overrides passed directly to ReportsheetSheetRenderer (100% React-safe)
  const elementOverrides = useMemo<Record<string, ThemeElementOverride>>(() => {
    const map: Record<string, ThemeElementOverride> = { ...tableCellOverrides }
    for (const el of canvasElements) {
      if (el.id.startsWith('id_')) continue
      map[el.id] = {
        text: el.text,
        imageSrc: el.imageSrc,
        caption: el.caption,
        hidden: el.hidden,
        offsetX: el.offsetX,
        offsetY: el.offsetY,
        width: el.width,
        height: el.height,
        style: el.style,
      }
    }
    return map
  }, [canvasElements, tableCellOverrides])

  // Canvas form fields (left panel)
  const [canvasSettings, setCanvasSettings] = useState(() => {
    const defaults = {
      schoolName: 'Airport City Flagship',
      schoolAddress: 'Accra, Greater Accra',
      schoolMotto: 'Excellence in Education',
      reportTitle: editing?.reportName ?? initialReportName ?? '',
      examName: editing?.examName ?? initialExamName ?? '',
      class: editing?.className ?? '',
      term: editing?.term ?? '',
      academicYear: editing?.academicYear ?? '',
      showStudentPhoto: true,
      showRegisterNo: true,
      showPosition: false,
      showGrade: false,
      showRemark: true,
      borderStyle: 'double',
      marginTop: 20,
      marginBottom: 20,
      marginLeft: 20,
      marginRight: 20,
      schoolLogo: '',
      blankForm: false,
      showRuler: false,
      showGrid: false,
    }
    if (typeof editing?.canvasSettingsJson === 'string' && editing.canvasSettingsJson.trim()) {
      try {
        const parsed = JSON.parse(editing.canvasSettingsJson)
        if (parsed && typeof parsed === 'object') return { ...defaults, ...parsed }
      } catch { /* ignore */ }
    }
    return defaults
  })

  const [zoom, setZoom] = useState(0.75)
  const [currentView, setCurrentView] = useState<'elements' | 'editor' | 'sections' | 'templates' | 'setup' | 'style'>(initialView ?? 'elements')
  const [lastPaletteView, setLastPaletteView] = useState<'elements' | 'editor' | 'sections' | 'templates' | 'setup'>('elements')

  // Drag-drop from palette to canvas
  const [draggingField, setDraggingField] = useState<{ key: string; w: number; h: number } | null>(null)
  const [previewTheme, setPreviewTheme] = useState<ReportsheetThemeDef | null>(initialResolvedTheme)
  const [editMode, setEditMode] = useState(true)

  // Measure the selected element's actual rendered position in the canvas + combined multi-selection/group bounding box
  useEffect(() => {
    if (!canvasRef.current) {
      setSelectedElRect(null)
      setMultiSelectRect(null)
      return
    }
    const canvasRect = canvasRef.current.getBoundingClientRect()

    if (!selectedElement || selectedElement.startsWith('id_')) {
      setSelectedElRect(null)
    } else {
      const el = canvasRef.current.querySelector(`[data-element-id="${selectedElement}"]`) as HTMLElement | null
      if (!el || el.style.display === 'none') {
        setSelectedElRect(null)
      } else {
        const elRect = el.getBoundingClientRect()
        setSelectedElRect({
          left: elRect.left - canvasRect.left,
          top: elRect.top - canvasRect.top,
          width: elRect.width,
          height: elRect.height,
        })
      }
    }

    if (selectedElements.length < 2) {
      setMultiSelectRect(null)
    } else {
      let minLeft = Infinity
      let minTop = Infinity
      let maxRight = -Infinity
      let maxBottom = -Infinity
      for (const id of selectedElements) {
        const selector = id.startsWith('id_') ? `[data-custom-id="${id}"]` : `[data-element-id="${id}"]`
        const domNode = canvasRef.current.querySelector(selector) as HTMLElement | null
        if (!domNode || domNode.style.display === 'none') continue
        const r = domNode.getBoundingClientRect()
        if (r.width <= 0 && r.height <= 0) continue
        const l = r.left - canvasRect.left
        const t = r.top - canvasRect.top
        minLeft = Math.min(minLeft, l)
        minTop = Math.min(minTop, t)
        maxRight = Math.max(maxRight, l + r.width)
        maxBottom = Math.max(maxBottom, t + r.height)
      }
      if (minLeft < maxRight && minTop < maxBottom) {
        setMultiSelectRect({
          left: minLeft - 4,
          top: minTop - 4,
          width: maxRight - minLeft + 8,
          height: maxBottom - minTop + 8,
        })
      } else {
        setMultiSelectRect(null)
      }
    }
  }, [selectedElement, selectedElements, zoom, canvasElements, previewTheme, step, pageOrientation])

  // Keyboard & native clipboard shortcuts for copying, pasting, grouping, duplicating, nudging, inline editing, and deleting selected elements
  useEffect(() => {
    if (step !== 1 && step !== 2) return
    const isTypingInControl = () => {
      if (inlineEdit) return true
      const active = document.activeElement as HTMLElement | null
      return Boolean(
        active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable),
      )
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (isTypingInControl()) return
      if (ev.key === 'Escape') {
        setCopyToThemeMenuOpen(false)
        setFloatingCopyToThemeOpen(false)
        setCanvasContextMenu(null)
        if (cursorMode) {
          setCursorMode(false)
          setHoverCursorPoint(null)
          return
        }
        if (multiSelectMode || selectedElements.length > 0 || selectedElement) {
          setMultiSelectMode(false)
          setSelectedElement(null)
          setSelectedElements([])
          return
        }
        if (insertionPoint) {
          setInsertionPoint(null)
        }
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c') {
        if (selectedElements.length > 0 || selectedElement) {
          ev.preventDefault()
          copySelectedElements()
        }
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'x') {
        if (selectedElements.length > 0 || selectedElement) {
          ev.preventDefault()
          copySelectedElements()
          if (selectedElements.length > 1) {
            deleteSelectedElements()
          } else if (selectedElement) {
            deleteElement(selectedElement)
          }
        }
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v') {
        if (themeClipboard || sharedReportThemeClipboard) {
          ev.preventDefault()
          pasteCopiedElements()
        }
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'g') {
        ev.preventDefault()
        if (ev.shiftKey) {
          ungroupSelectedElements()
        } else {
          groupSelectedElements()
        }
        return
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'd') {
        if (selectedElements.length > 0 || selectedElement) {
          ev.preventDefault()
          duplicateSelectedElements()
        }
        return
      }
      if (selectedElements.length === 0 && !selectedElement) {
        if (insertionPoint && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
          ev.preventDefault()
          const delta = ev.shiftKey ? 10 : 1
          const dx = ev.key === 'ArrowLeft' ? -delta : ev.key === 'ArrowRight' ? delta : 0
          const dy = ev.key === 'ArrowUp' ? -delta : ev.key === 'ArrowDown' ? delta : 0
          setInsertionPoint((cur) =>
            cur
              ? {
                  x: Math.max(0, Math.min(556, cur.x + dx)),
                  y: Math.max(0, Math.min(776, cur.y + dy)),
                }
              : null,
          )
        }
        return
      }
      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        ev.preventDefault()
        if (selectedElements.length > 1) {
          deleteSelectedElements()
        } else if (selectedElement) {
          deleteElement(selectedElement)
        }
        return
      }
      const el = selectedElement ? canvasElements.find((ce) => ce.id === selectedElement) : null
      if (ev.key === 'Enter' && el && selectedElements.length <= 1 && el.type !== 'table' && el.type !== 'divider' && el.type !== 'line' && el.type !== 'image' && el.type !== 'logo') {
        ev.preventDefault()
        const domEl = canvasRef.current?.querySelector(
          el.id.startsWith('id_') ? `[data-custom-id="${el.id}"]` : `[data-element-id="${el.id}"]`,
        ) as HTMLElement | null
        if (domEl) {
          const cur = el.type === 'signature' ? (el.caption ?? (domEl.innerText || '').trim()) : (el.text ?? (domEl.innerText || '').trim())
          openInlineEditorForDomElement('element', el.id, el.label, domEl, cur)
        }
        return
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
        ev.preventDefault()
        const delta = ev.shiftKey ? 10 : 1
        const dx = ev.key === 'ArrowLeft' ? -delta : ev.key === 'ArrowRight' ? delta : 0
        const dy = ev.key === 'ArrowUp' ? -delta : ev.key === 'ArrowDown' ? delta : 0
        const targetIds = selectedElements.length > 0 ? selectedElements : (selectedElement ? [selectedElement] : [])
        const targetSet = new Set(targetIds)
        setCanvasElements((prev) =>
          prev.map((item) => {
            if (!targetSet.has(item.id) || item.locked) return item
            if (item.id.startsWith('id_')) {
              return { ...item, x: Math.max(0, item.x + dx), y: Math.max(0, item.y + dy) }
            }
            return { ...item, offsetX: (item.offsetX ?? 0) + dx, offsetY: (item.offsetY ?? 0) + dy }
          }),
        )
      }
    }
    const onNativeCopy = (ev: ClipboardEvent) => {
      if (isTypingInControl()) return
      const selText = window.getSelection()?.toString() || ''
      if (selText.trim().length > 0) return
      if (selectedElements.length > 0 || selectedElement) {
        ev.preventDefault()
        copySelectedElements()
      }
    }
    const onNativeCut = (ev: ClipboardEvent) => {
      if (isTypingInControl()) return
      const selText = window.getSelection()?.toString() || ''
      if (selText.trim().length > 0) return
      if (selectedElements.length > 0 || selectedElement) {
        ev.preventDefault()
        copySelectedElements()
        if (selectedElements.length > 1) {
          deleteSelectedElements()
        } else if (selectedElement) {
          deleteElement(selectedElement)
        }
      }
    }
    const onNativePaste = (ev: ClipboardEvent) => {
      if (isTypingInControl()) return
      if (themeClipboard || sharedReportThemeClipboard) {
        ev.preventDefault()
        pasteCopiedElements()
      }
    }
    const onDocMouseDown = (ev: MouseEvent) => {
      const tgt = ev.target as HTMLElement | null
      if (tgt?.closest('[data-report-popup]')) return
      setCanvasContextMenu(null)
      setFloatingCopyToThemeOpen(false)
      setCopyToThemeMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('copy', onNativeCopy)
    window.addEventListener('cut', onNativeCut)
    window.addEventListener('paste', onNativePaste)
    window.addEventListener('mousedown', onDocMouseDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('copy', onNativeCopy)
      window.removeEventListener('cut', onNativeCut)
      window.removeEventListener('paste', onNativePaste)
      window.removeEventListener('mousedown', onDocMouseDown)
    }
  }, [step, selectedElement, selectedElements, multiSelectMode, canvasElements, inlineEdit, themeClipboard, previewTheme, cursorMode, insertionPoint])

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const target = e.target as HTMLElement
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    const sheetX = canvasRect ? Math.max(0, Math.min(540, Math.round((e.clientX - canvasRect.left) / zoom))) : 60
    const sheetY = canvasRect ? Math.max(0, Math.min(760, Math.round((e.clientY - canvasRect.top) / zoom))) : 80

    const customEl = target.closest('[data-custom-id]') as HTMLElement | null
    const themeDomEl = target.closest('[data-element-id]') as HTMLElement | null
    let hitId: string | null = null
    if (customEl) {
      hitId = customEl.getAttribute('data-custom-id')
    } else if (themeDomEl) {
      const elId = themeDomEl.getAttribute('data-element-id')
      if (elId) {
        ensureThemeElement(elId, themeDomEl)
        hitId = elId
      }
    }

    let nextTargetIds: string[] = []
    if (hitId) {
      if (selectedElements.includes(hitId)) {
        nextTargetIds = selectedElements
        setSelectedElement(hitId)
      } else {
        const hitObj = canvasElements.find((c) => c.id === hitId)
        if (hitObj?.groupId) {
          nextTargetIds = canvasElements.filter((c) => c.groupId === hitObj.groupId && !c.hidden).map((c) => c.id)
        } else {
          nextTargetIds = [hitId]
        }
        if (currentView !== 'style') setLastPaletteView(currentView)
        setSelectedElements(nextTargetIds)
        setSelectedElement(hitId)
        if (step === 1) setCurrentView('style')
      }
    } else {
      nextTargetIds = selectedElements.length > 0 ? selectedElements : selectedElement ? [selectedElement] : []
    }

    setFloatingCopyToThemeOpen(false)
    setCopyToThemeMenuOpen(false)
    setCanvasContextMenu({
      clientX: e.clientX,
      clientY: e.clientY,
      sheetX,
      sheetY,
      targetIds: nextTargetIds,
    })
  }

  const handlePaletteDragStart = (e: React.DragEvent, key: string, w: number, h: number) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', key)
    setDraggingField({ key, w, h })
  }

  const handleEditorDragStart = (e: React.DragEvent, item: typeof EDITOR_ELEMENTS[0]) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', `editor:${item.key}`)
    setDraggingField({ key: `editor:${item.key}`, w: item.w, h: item.h })
  }

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (draggingField && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect()
      const rawX = (e.clientX - rect.left) / zoom - draggingField.w / 2
      const rawY = (e.clientY - rect.top) / zoom - draggingField.h / 2
      const snapped = snapPointToCanvas(rawX, rawY, draggingField.w, draggingField.h, [], e.altKey)
      const isEditor = draggingField.key.startsWith('editor:')
      const cleanKey = isEditor ? draggingField.key.slice(7) : draggingField.key
      const label =
        (isEditor
          ? EDITOR_ELEMENTS.find((ed) => ed.key === cleanKey)?.label
          : FIELD_REGISTRY[cleanKey]?.label) || cleanKey
      setPaletteDropPreview({
        x: snapped.x,
        y: snapped.y,
        w: draggingField.w,
        h: draggingField.h,
        label,
      })
      setActiveSnapGuides({
        vertical: snapped.vertical,
        horizontal: snapped.horizontal,
        readout: { x: snapped.x, y: snapped.y },
      })
    }
  }

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (related && canvasRef.current?.contains(related)) return
    setPaletteDropPreview(null)
    setActiveSnapGuides(null)
  }

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setPaletteDropPreview(null)
    setActiveSnapGuides(null)
    const raw = e.dataTransfer.getData('text/plain')
    let key: string
    let isEditor = false

    if (raw.startsWith('editor:')) {
      isEditor = true
      key = raw.slice(7)
    } else {
      key = raw
    }

    const fieldDef = FIELD_REGISTRY[key]
    const editorItem = EDITOR_ELEMENTS.find((ed) => ed.key === key)

    if ((!fieldDef && !editorItem) || !canvasRef.current) return

    const w = fieldDef?.w ?? editorItem!.w
    const h = fieldDef?.h ?? editorItem!.h
    const rect = canvasRef.current.getBoundingClientRect()
    const rawX = (e.clientX - rect.left) / zoom - w / 2
    const rawY = (e.clientY - rect.top) / zoom - h / 2
    const snapped = snapPointToCanvas(rawX, rawY, w, h, [], e.altKey)

    const typeMap: Record<string, CanvasElement['type']> = {
      image: 'image',
      text_field: 'text',
      subject_table: 'table',
      grading_key: 'table',
      custom_text: 'custom_text',
      custom_heading: 'custom_heading',
      line: 'line',
      divider: 'divider',
      custom_shape: 'text',
    }

    const typeKey = fieldDef?.type ?? editorItem!.key
    const resolvedType = typeMap[typeKey] ?? 'text'
    const newId = uid()
    const defaultStyle: Record<string, unknown> | undefined =
      resolvedType === 'line'
        ? { bg: '#1e293b', lineThickness: 2, lineStyle: 'solid', orientation: 'horizontal', rotation: 0 }
        : resolvedType === 'divider'
          ? { bg: '#94a3b8', lineThickness: 2, lineStyle: 'solid', orientation: 'horizontal', rotation: 0 }
          : undefined

    setCanvasElements(prev => [...prev, {
      id: newId,
      type: resolvedType,
      label: fieldDef?.label ?? editorItem!.label,
      x: snapped.x,
      y: snapped.y,
      width: w,
      height: h,
      text: resolvedType === 'line' || resolvedType === 'divider' ? undefined : (fieldDef?.label ?? editorItem!.label),
      style: defaultStyle,
      field: isEditor ? undefined : key,
    }])
    setInsertionPoint({
      x: snapped.x,
      y: Math.min(752, snapped.y + h + 8),
    })
    if (currentView !== 'style') setLastPaletteView(currentView)
    setSelectedElements([newId])
    setSelectedElement(newId)
    setCurrentView('style')
    setDraggingField(null)
  }

  // Add editor element — places right at Insertion Point cursor if set, and advances cursor cleanly
  const addEditorElement = (item: typeof EDITOR_ELEMENTS[0], explicitAt?: { x: number; y: number }) => {
    const typeMap: Record<string, CanvasElement['type']> = {
      custom_text: 'custom_text',
      custom_heading: 'custom_heading',
      line: 'line',
      divider: 'divider',
      custom_shape: 'text',
    }
    const resolvedType = typeMap[item.key] ?? 'custom_text'
    const newId = uid()
    const defaultStyle: Record<string, unknown> | undefined =
      resolvedType === 'line'
        ? { bg: '#1e293b', lineThickness: 2, lineStyle: 'solid', orientation: 'horizontal', rotation: 0 }
        : resolvedType === 'divider'
          ? { bg: '#94a3b8', lineThickness: 2, lineStyle: 'solid', orientation: 'horizontal', rotation: 0 }
          : undefined

    const anchor = explicitAt ?? insertionPoint
    let placedX: number
    let placedY: number
    if (anchor) {
      placedX = Math.max(0, Math.min(Math.round(anchor.x), Math.max(0, 560 - item.w)))
      placedY = Math.max(0, Math.min(Math.round(anchor.y), Math.max(0, 780 - item.h)))
    } else {
      placedX = item.w >= 400 ? Math.round((560 - item.w) / 2) : 40
      placedY = fallbackInsertYRef.current
      fallbackInsertYRef.current = fallbackInsertYRef.current + item.h + 10 > 700 ? 120 : fallbackInsertYRef.current + item.h + 10
    }

    setCanvasElements(prev => [...prev, {
      id: newId,
      type: resolvedType,
      label: item.label,
      x: placedX,
      y: placedY,
      width: item.w,
      height: item.h,
      text: resolvedType === 'line' || resolvedType === 'divider' ? undefined : item.label,
      style: defaultStyle,
    }])
    if (anchor) {
      setInsertionPoint({
        x: anchor.x,
        y: Math.min(752, placedY + item.h + 8),
      })
    }
    if (currentView !== 'style') setLastPaletteView(currentView)
    setSelectedElements([newId])
    setSelectedElement(newId)
    setCurrentView('style')
  }

  // Add data element by click — places right at Insertion Point cursor if set, and advances cursor cleanly
  const addDataElement = (key: string) => {
    const fieldDef = FIELD_REGISTRY[key]
    if (!fieldDef) return
    const typeMap: Record<string, CanvasElement['type']> = {
      image: 'image',
      text_field: 'text',
      subject_table: 'table',
      grading_key: 'table',
    }
    const newId = uid()
    let placedX: number
    let placedY: number
    if (insertionPoint) {
      placedX = Math.max(0, Math.min(Math.round(insertionPoint.x), Math.max(0, 560 - fieldDef.w)))
      placedY = Math.max(0, Math.min(Math.round(insertionPoint.y), Math.max(0, 780 - fieldDef.h)))
    } else {
      placedX = fieldDef.w >= 400 ? Math.round((560 - fieldDef.w) / 2) : 40
      placedY = fallbackInsertYRef.current
      fallbackInsertYRef.current = fallbackInsertYRef.current + fieldDef.h + 8 > 700 ? 120 : fallbackInsertYRef.current + fieldDef.h + 8
    }

    setCanvasElements(prev => [...prev, {
      id: newId,
      type: typeMap[fieldDef.type] ?? 'text',
      label: fieldDef.label,
      x: placedX,
      y: placedY,
      width: fieldDef.w,
      height: fieldDef.h,
      text: fieldDef.label,
      field: key,
    }])
    if (insertionPoint) {
      setInsertionPoint({
        x: insertionPoint.x,
        y: Math.min(752, placedY + fieldDef.h + 8),
      })
    }
    if (currentView !== 'style') setLastPaletteView(currentView)
    setSelectedElements([newId])
    setSelectedElement(newId)
    setCurrentView('style')
  }

  // Add section block (grouped by default so the whole block moves together; anchors at insertionPoint when set)
  const addSectionBlock = (block: typeof SECTION_BLOCKS[0]) => {
    const blockGroupId = block.elements.length > 1 ? `grp_${uid()}` : undefined
    const minBlockX = Math.min(...block.elements.map((e) => e.dx))
    const minBlockY = Math.min(...block.elements.map((e) => e.dy))
    const maxBlockRight = Math.max(...block.elements.map((e) => e.dx + e.w))
    const maxBlockBottom = Math.max(...block.elements.map((e) => e.dy + e.h))
    const blockW = Math.max(20, maxBlockRight - minBlockX)
    const blockH = Math.max(20, maxBlockBottom - minBlockY)
    const shiftX = insertionPoint
      ? Math.max(0, Math.min(insertionPoint.x, Math.max(0, 560 - blockW))) - minBlockX
      : 0
    const shiftY = insertionPoint
      ? Math.max(0, Math.min(insertionPoint.y, Math.max(0, 780 - blockH))) - minBlockY
      : 0

    const newElements: CanvasElement[] = block.elements.map((el) => {
      const fieldDef = FIELD_REGISTRY[el.field]
      return {
        id: uid(),
        type: fieldDef?.type === 'image' ? 'image' : fieldDef?.type === 'subject_table' ? 'table' : 'text',
        label: fieldDef?.label ?? el.field,
        x: Math.max(0, Math.min(Math.round(el.dx + shiftX), Math.max(0, 560 - el.w))),
        y: Math.max(0, Math.min(Math.round(el.dy + shiftY), Math.max(0, 780 - el.h))),
        width: el.w,
        height: el.h,
        text: fieldDef?.label,
        field: el.field,
        groupId: blockGroupId,
      }
    })
    setCanvasElements(prev => [...prev, ...newElements])
    if (insertionPoint) {
      setInsertionPoint({
        x: insertionPoint.x,
        y: Math.min(752, Math.round(minBlockY + shiftY + blockH + 10)),
      })
    }
    const newIds = newElements.map((ne) => ne.id)
    if (newIds.length > 0) {
      if (currentView !== 'style') setLastPaletteView(currentView)
      setSelectedElements(newIds)
      setSelectedElement(newIds[0])
      setCurrentView('style')
      toast(`Added "${block.label}" (${newIds.length} grouped elements)`, 'success')
    }
  }

  // Load a Reportsheet Theme onto the canvas as editable elements.
  // Saves each theme's workspace in session memory so switching themes never loses edits,
  // while allowing explicit Copy / Paste / Copy-to-Theme across themes.
  const buildFreshThemeElements = (theme: ReportsheetThemeDef, fromElements: CanvasElement[]): CanvasElement[] => {
    const prevById = new Map(fromElements.map((el) => [el.id, el]))
    return getThemeElements(theme).map((el) => {
      const old = prevById.get(el.id)
      if (!old) return el
      const nextStyle = { ...(old.style || {}) }
      delete nextStyle.customSize
      return {
        ...el,
        text: old.text,
        imageSrc: old.imageSrc,
        caption: old.caption,
        style: el.type === 'table' ? nextStyle : {},
      }
    })
  }

  const loadTheme = (theme: ReportsheetThemeDef) => {
    if (theme.id.toLowerCase() === 'theme-7' || (records.reportsheetTheme ?? []).some(r => r.sampleKey === 'semester-result-pdf-v1' && String(r.themeId ?? '').toLowerCase() === theme.id.toLowerCase())) setReportType('CGPA')
    const curThemeId = (previewTheme || REPORTSHEET_THEMES[0]).id
    setInlineEdit(null)
    setCopyToThemeMenuOpen(false)
    setFloatingCopyToThemeOpen(false)
    setCanvasContextMenu(null)
    if (curThemeId !== theme.id || canvasSettings.blankForm) {
      if (curThemeId !== theme.id && !canvasSettings.blankForm) {
        themeWorkspacesRef.current[curThemeId] = { elements: canvasElements, tableCellOverrides }
      }
      setCanvasSettings((prev) => ({ ...prev, blankForm: false }))
      const savedTarget = canvasSettings.blankForm && curThemeId === theme.id ? undefined : themeWorkspacesRef.current[theme.id]
      if (savedTarget) {
        setCanvasElements(savedTarget.elements)
        setTableCellOverrides(savedTarget.tableCellOverrides)
      } else if (theme.isCustom) {
        setCanvasElements(getThemeElements(theme))
        if (theme.tableCellOverridesJson) {
          try {
            const parsedCells = JSON.parse(theme.tableCellOverridesJson)
            if (parsedCells && typeof parsedCells === 'object') {
              setTableCellOverrides(parsedCells as Record<string, ThemeElementOverride>)
            } else {
              setTableCellOverrides({})
            }
          } catch {
            setTableCellOverrides({})
          }
        } else {
          setTableCellOverrides({})
        }
        if (theme.canvasSettingsJson) {
          try {
            const parsedSettings = JSON.parse(theme.canvasSettingsJson)
            if (parsedSettings && typeof parsedSettings === 'object') {
              setCanvasSettings((prev) => ({ ...prev, ...parsedSettings }))
            }
          } catch { /* ignore */ }
        }
      } else {
        setCanvasElements((prev) => buildFreshThemeElements(theme, prev))
      }
    }
    setPreviewTheme(theme)
    setSelectedElement(null)
    setSelectedElements([])
    setEditMode(true)
    const clip = themeClipboard ?? sharedReportThemeClipboard
    toast(
      clip && clip.items.length > 0
        ? `Loaded ${theme.name} — click Paste (Ctrl+V) to drop ${clip.items.length} copied element${clip.items.length > 1 ? 's' : ''}`
        : `Loaded ${theme.name} — click or double-click any element on canvas to edit`,
      'info',
    )
  }

  const copySelectionToTheme = (targetTheme: ReportsheetThemeDef, overrideIds?: string[]) => {
    const targets = resolveActiveTargets(overrideIds)
    if (targets.length === 0) {
      toast('Select one or more elements on the canvas first', 'info')
      return
    }
    const items = snapshotElementsForCopy(targets)
    if (items.length === 0) return
    const srcTheme = previewTheme || REPORTSHEET_THEMES[0]
    const payload: ThemeClipboardPayload = {
      sourceThemeId: srcTheme.id,
      sourceThemeName: srcTheme.name,
      pasteCount: 1,
      items,
    }
    sharedReportThemeClipboard = payload
    setThemeClipboard(payload)
    setCopyToThemeMenuOpen(false)
    setFloatingCopyToThemeOpen(false)
    setCanvasContextMenu(null)
    setInlineEdit(null)

    if (srcTheme.id === targetTheme.id) {
      duplicateSelectedElements(overrideIds)
      return
    }

    themeWorkspacesRef.current[srcTheme.id] = {
      elements: canvasElements,
      tableCellOverrides,
    }
    const savedTarget = themeWorkspacesRef.current[targetTheme.id]
    const targetBase = savedTarget ? savedTarget.elements : buildFreshThemeElements(targetTheme, canvasElements)
    if (savedTarget) {
      setTableCellOverrides(savedTarget.tableCellOverrides)
    }

    const groupIdRemap = new Map<string, string>()
    const clones: CanvasElement[] = items.map((item) => {
      let nextGroupId: string | undefined
      if (item.groupId) {
        if (!groupIdRemap.has(item.groupId)) groupIdRemap.set(item.groupId, `grp_${uid()}`)
        nextGroupId = groupIdRemap.get(item.groupId)
      }
      return {
        ...item,
        id: uid(),
        style: item.style ? { ...item.style } : {},
        groupId: nextGroupId,
      }
    })

    const merged = [...targetBase, ...clones]
    themeWorkspacesRef.current[targetTheme.id] = {
      elements: merged,
      tableCellOverrides: savedTarget ? savedTarget.tableCellOverrides : tableCellOverrides,
    }
    setPreviewTheme(targetTheme)
    setCanvasElements(merged)
    const cloneIds = clones.map((c) => c.id)
    setSelectedElements(cloneIds)
    setSelectedElement(cloneIds[cloneIds.length - 1])
    setMultiSelectMode(false)
    setEditMode(true)
    toast(
      `Copied ${clones.length} element${clones.length > 1 ? 's' : ''} from ${srcTheme.name} to ${targetTheme.name}`,
      'success',
    )
  }

  const copyAllFromTheme = (sourceThemeId: string) => {
    const activeTheme = previewTheme || REPORTSHEET_THEMES[0]
    if (!sourceThemeId || sourceThemeId === activeTheme.id) {
      toast('Choose a different source theme to copy from', 'info')
      return
    }
    const sourceTheme = allThemes.find((t) => t.id === sourceThemeId)
    if (!sourceTheme) return
    const savedSource = themeWorkspacesRef.current[sourceThemeId]
    const sourceElements = savedSource ? savedSource.elements : getThemeElements(sourceTheme)
    const sourceById = new Map(sourceElements.map((el) => [el.id, el]))

    const groupIdRemap = new Map<string, string>()
    const copiedCustoms: CanvasElement[] = sourceElements
      .filter((el) => el.id.startsWith('id_') && !el.hidden)
      .map((el) => {
        let nextGroupId: string | undefined
        if (el.groupId) {
          if (!groupIdRemap.has(el.groupId)) groupIdRemap.set(el.groupId, `grp_${uid()}`)
          nextGroupId = groupIdRemap.get(el.groupId)
        }
        return {
          ...el,
          id: uid(),
          style: el.style ? { ...el.style } : {},
          groupId: nextGroupId,
        }
      })

    setCanvasElements((prev) => {
      const updatedSlots = prev.map((el) => {
        if (el.id.startsWith('id_')) return el
        const srcEl = sourceById.get(el.id)
        if (!srcEl) return el
        const nextStyle = { ...(el.style || {}), ...(srcEl.style || {}) }
        delete nextStyle.customSize
        return {
          ...el,
          text: srcEl.text !== undefined ? srcEl.text : el.text,
          imageSrc: srcEl.imageSrc !== undefined ? srcEl.imageSrc : el.imageSrc,
          caption: srcEl.caption !== undefined ? srcEl.caption : el.caption,
          style: nextStyle,
        }
      })
      return [...updatedSlots, ...copiedCustoms]
    })

    if (savedSource?.tableCellOverrides && Object.keys(savedSource.tableCellOverrides).length > 0) {
      setTableCellOverrides((prev) => ({ ...prev, ...savedSource.tableCellOverrides }))
    }
    if (copiedCustoms.length > 0) {
      const ids = copiedCustoms.map((c) => c.id)
      setSelectedElements(ids)
      setSelectedElement(ids[ids.length - 1])
    }
    toast(
      copiedCustoms.length > 0
        ? `Copied edits & ${copiedCustoms.length} custom element${copiedCustoms.length > 1 ? 's' : ''} from ${sourceTheme.name} into ${activeTheme.name}`
        : `Copied theme edits & styles from ${sourceTheme.name} into ${activeTheme.name}`,
      'success',
    )
  }

  const REPORT_OPTIONS = [
    'Class Average', 'Subject Average', 'Position', 'Grading Scale',
    'Attendance Percentage', 'Cumulative Average', 'Remark', 'Result',
  ]

  const has = (name: string) => reportOptions.map((o) => o.toLowerCase()).includes(name.toLowerCase())

  const toggleOption = (opt: string) => {
    setReportOptions(reportOptions.includes(opt) ? reportOptions.filter((o) => o !== opt) : [...reportOptions, opt])
  }

  const toggleSubject = (name: string) => {
    setIncludeSubjects(includeSubjects.includes(name) ? includeSubjects.filter((s) => s !== name) : [...includeSubjects, name])
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '')
      setCanvasSettings((s) => ({ ...s, schoolLogo: dataUrl }))
      setCanvasElements((prev) =>
        prev.map((el) => (el.id === 'school-logo' ? { ...el, imageSrc: dataUrl } : el)),
      )
    }
    reader.readAsDataURL(file)
  }

  const handleExamNameChange = (nextExam: string) => {
    setExamName(nextExam)
    const matchedExam = examOptions.find(
      (row) => String(row.examName ?? row.name ?? '').trim() === nextExam,
    )
    const matchedTerm = matchedExam ? String(matchedExam.term ?? '').trim() : ''
    if (matchedTerm && !term) {
      setTerm(matchedTerm)
    }
    setCanvasSettings((s) => ({
      ...s,
      examName: nextExam,
      ...(matchedTerm && !s.term ? { term: matchedTerm } : {}),
    }))
    // Clear stale score-column header/cell overrides so the newly selected exam's Mark Distribution columns display cleanly
    setTableCellOverrides((prev) => {
      const next: Record<string, ThemeElementOverride> = {}
      for (const [key, val] of Object.entries(prev)) {
        if (
          key.startsWith('th-comp-') ||
          key === 'th-total' ||
          /^td-\d+-sc-\d+$/.test(key) ||
          /^td-\d+-total$/.test(key)
        ) {
          continue
        }
        next[key] = val
      }
      return next
    })
    // Reset custom per-part score overrides when switching exams so sample/subject scores scale to the new Mark Distribution max marks
    setCanvasElements((prev) =>
      prev.map((el) => {
        if (el.type !== 'table' || !Array.isArray(el.style?.customSubjects)) return el
        const cleaned = (el.style.customSubjects as CustomSubjectEntry[]).map((row) => ({
          ...row,
          partScores: undefined,
        }))
        return { ...el, style: { ...el.style, customSubjects: cleaned } }
      }),
    )
  }

  // Navigation
  const prev = () => {
    const minStep = initialStep ?? 0
    if (step <= minStep) {
      onClose()
      return
    }
    setStep(Math.max(step - 1, minStep))
  }

  const nextPublishedThemeName = useMemo(() => {
    let maxNum = 0
    for (const th of allThemes) {
      const m1 = /^theme[-\s]*(\d+)$/i.exec(String(th.id ?? '').trim())
      const m2 = /^theme[-\s]*(\d+)$/i.exec(String(th.name ?? '').trim())
      if (m1) maxNum = Math.max(maxNum, parseInt(m1[1], 10))
      if (m2) maxNum = Math.max(maxNum, parseInt(m2[1], 10))
    }
    if (maxNum <= 0) maxNum = REPORTSHEET_THEMES.length
    return `Theme ${maxNum + 1}`
  }, [allThemes])

  const handlePublishTheme = () => {
    if (inlineEdit) {
      commitInlineEdit()
    }
    if (hasPublishedThemeOnCurrentIdRef.current && !editing) {
      wizardReportIdRef.current = uid()
    }
    hasPublishedThemeOnCurrentIdRef.current = true
    const activeTheme = previewTheme || allThemes[0] || REPORTSHEET_THEMES[0]
    const resolvedBaseThemeId = activeTheme.baseThemeId || activeTheme.id
    const effectiveExamName = examName.trim() || canvasSettings.examName || examNameList[0] || ''
    const tagline =
      reportName.trim() ||
      effectiveExamName ||
      (activeTheme.isCustom ? activeTheme.tagline : `Custom ${activeTheme.tagline}`)
    const accentColor =
      (tableEl?.style?.headerBg as string) ||
      activeTheme.accentColor ||
      '#16325c'
    const serializedElements = JSON.stringify(canvasElements)
    const serializedCellOverrides = JSON.stringify(tableCellOverrides)
    const serializedSettings = JSON.stringify({
      ...canvasSettings,
      ...(effectiveExamName ? { examName: effectiveExamName } : {}),
    })
    const published = onPublishTheme(
      {
        tagline,
        description: `Custom reportsheet theme (${tagline}) published from Report Builder.`,
        accentColor,
        baseThemeId: resolvedBaseThemeId,
        canvasElementsJson: serializedElements,
        tableCellOverridesJson: serializedCellOverrides,
        canvasSettingsJson: serializedSettings,
        reportOptionsJson: JSON.stringify(reportOptions),
        examName: effectiveExamName,
        certificateColor: certificateColor || '',
      },
      (publishedTheme) => ({
        id: wizardReportIdRef.current,
        branch: branchName,
        reportName: reportName.trim() || publishedTheme.name,
        reportType,
        examName: effectiveExamName,
        className: className || '',
        term: term || '',
        academicYear: academicYear || '',
        fromDate: fromDate || '',
        toDate: toDate || '',
        includeSubjects: includeSubjects.length ? JSON.stringify(includeSubjects) : '',
        reportOptions: reportOptions.length ? JSON.stringify(reportOptions) : '',
        reportsheetTheme: publishedTheme.name,
        reportsheetThemeId: publishedTheme.id,
        publishedThemeId: publishedTheme.id,
        canvasElementsJson: serializedElements,
        tableCellOverridesJson: serializedCellOverrides,
        canvasSettingsJson: serializedSettings,
        pageOrientation,
        format: pageOrientation === 'landscape' ? 'Landscape' : 'Portrait',
        status: 'Published',
        createdAt: editing?.createdAt ?? new Date().toISOString().slice(0, 10),
      }),
    )
    themeWorkspacesRef.current[published.id] = {
      elements: canvasElements,
      tableCellOverrides,
    }
    if (!reportName.trim()) {
      setReportName(published.name)
    }
    if (!examName.trim() && effectiveExamName) {
      setExamName(effectiveExamName)
    }
    setStatus('Published')
    setPreviewTheme(published)
    toast(`${published.name} published to Reportsheet Theme & Report Builder`, 'success')
  }

  const handleSave = () => {
    if (!examName.trim()) {
      toast('Exam Name is required', 'error')
      if (step === 1) setCurrentView('setup')
      return
    }
    if (!reportName.trim()) {
      toast('Report name is required', 'error')
      return
    }
    const row: EduRow = {
      id: wizardReportIdRef.current,
      branch: branchName,
      reportName: reportName.trim(),
      reportType,
      examName: examName || '',
      className: className || '',
      term: term || '',
      academicYear: academicYear || '',
      fromDate: fromDate || '',
      toDate: toDate || '',
      includeSubjects: includeSubjects.length ? JSON.stringify(includeSubjects) : '',
      reportOptions: reportOptions.length ? JSON.stringify(reportOptions) : '',
      reportsheetTheme: previewTheme?.name || REPORTSHEET_THEMES[0].name,
      reportsheetThemeId: previewTheme?.id || REPORTSHEET_THEMES[0].id,
      ...(editing?.publishedThemeId ? { publishedThemeId: previewTheme?.id || REPORTSHEET_THEMES[0].id } : {}),
      canvasElementsJson: JSON.stringify(canvasElements),
      tableCellOverridesJson: JSON.stringify(tableCellOverrides),
      canvasSettingsJson: JSON.stringify(canvasSettings),
      pageOrientation,
      format,
      status,
      createdAt: editing?.createdAt ?? new Date().toISOString().slice(0, 10),
    }
    onSave(row)
    onClose()
  }

  // Preview data
  const classAvg = Math.round(SAMPLE_SUBJECTS.reduce((s, r) => s + r.total, 0) / SAMPLE_SUBJECTS.length)
  const showPos = has('position') || canvasSettings.showPosition
  const showGrade = has('grading scale') || canvasSettings.showGrade
  const showRemark = has('remark') || canvasSettings.showRemark

  const baseWidths = [24, 10, 10, 10]
  if (showPos) baseWidths.push(10)
  if (showGrade) baseWidths.push(10)
  if (showRemark) baseWidths.push(18)
  const totalW = baseWidths.reduce((s, w) => s + w, 0)
  const colPcts = baseWidths.map((w) => `${(w / totalW * 100).toFixed(2)}%`)

  const renderSidebarInsertionBar = () => (
    <div
      className="bg-emerald-500/5 dark:bg-emerald-500/10"
      style={{
        border: `1px solid ${insertionPoint ? 'rgba(16, 185, 129, 0.45)' : 'var(--line)'}`,
        borderRadius: 8,
        padding: '8px 10px',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: insertionPoint ? '#059669' : 'var(--foreground)' }}>
          <Crosshair className="size-3.5" />
          {insertionPoint ? `Insertion Point (${insertionPoint.x}, ${insertionPoint.y})` : 'Canvas Insertion Point'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            onClick={() => setCursorMode((m) => !m)}
            title="Click anywhere on the canvas to place the insertion cursor"
            className={`rounded px-2 py-0.5 text-[10px] font-bold transition ${
              cursorMode
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
            }`}
          >
            {cursorMode ? 'Click Sheet…' : 'Pick Spot'}
          </button>
          {insertionPoint && (
            <button
              type="button"
              onClick={() => {
                setInsertionPoint(null)
                setCursorMode(false)
              }}
              title="Clear insertion point"
              className="rounded px-1.5 py-0.5 text-[10px] font-bold text-mist hover:bg-slate-200/70 dark:hover:bg-zinc-800"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {insertionPoint ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <div>
              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Cursor X (px)</label>
              <Input
                type="number"
                value={insertionPoint.x}
                onChange={(e) =>
                  setInsertionPoint((cur) => ({
                    x: Math.max(0, Math.min(556, Math.round(Number(e.target.value) || 0))),
                    y: cur?.y ?? 120,
                  }))
                }
                style={{ fontSize: 11, height: 26 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Cursor Y (px)</label>
              <Input
                type="number"
                value={insertionPoint.y}
                onChange={(e) =>
                  setInsertionPoint((cur) => ({
                    x: cur?.x ?? 40,
                    y: Math.max(0, Math.min(776, Math.round(Number(e.target.value) || 0))),
                  }))
                }
                style={{ fontSize: 11, height: 26 }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9.5, color: 'var(--mist)', marginRight: 2 }}>Quick X:</span>
            {[
              { label: 'Left (20)', x: 20 },
              { label: 'Center (200)', x: 200 },
              { label: 'Right (380)', x: 380 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setInsertionPoint((cur) => ({ x: preset.x, y: cur?.y ?? 120 }))}
                className="rounded border border-line px-1.5 py-0.5 text-[9.5px] font-semibold text-mist hover:border-emerald-500 hover:text-emerald-600"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p style={{ fontSize: 9.5, color: 'var(--mist)', marginTop: 5, lineHeight: 1.35 }}>
            Click any item below to insert right at <strong>({insertionPoint.x}, {insertionPoint.y})</strong>; cursor steps down automatically.
          </p>
        </>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <p style={{ fontSize: 10, color: 'var(--mist)', lineHeight: 1.35, margin: 0 }}>
            Click anywhere on the sheet (or <strong>Pick Spot</strong>) to position new elements accurately.
          </p>
          <button
            type="button"
            onClick={() => setInsertionPoint({ x: 40, y: 120 })}
            className="shrink-0 rounded border border-line px-2 py-0.5 text-[10px] font-semibold text-mist hover:border-emerald-500 hover:text-emerald-600"
          >
            Set (40, 120)
          </button>
        </div>
      )}
    </div>
  )

  const renderCanvasPositioningOverlays = () => {
    const activeClip = themeClipboard ?? sharedReportThemeClipboard
    const textItem = EDITOR_ELEMENTS.find((ed) => ed.key === 'custom_text')
    const lineItem = EDITOR_ELEMENTS.find((ed) => ed.key === 'line')
    const hasSelection = selectedObjects.length > 0 || !!selectedElement

    return (
      <>
        <style>{`
          @keyframes rtbCursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
        `}</style>

        {/* Smart Alignment Snap Guides (Page Center, Margins, Insertion Point, Neighboring Elements) */}
        {activeSnapGuides && (
          <>
            {activeSnapGuides.vertical.map((vg, idx) => (
              <div
                key={`vg-${idx}-${vg.pos}`}
                style={{
                  position: 'absolute',
                  left: vg.pos * zoom,
                  top: 0,
                  width: 0,
                  height: 780 * zoom,
                  borderLeft: '1.5px dashed #ec4899',
                  pointerEvents: 'none',
                  zIndex: 33,
                }}
              >
                {vg.label && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 4,
                      background: '#db2777',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    }}
                  >
                    {vg.label}
                  </span>
                )}
              </div>
            ))}
            {activeSnapGuides.horizontal.map((hg, idx) => (
              <div
                key={`hg-${idx}-${hg.pos}`}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: hg.pos * zoom,
                  width: 560 * zoom,
                  height: 0,
                  borderTop: '1.5px dashed #ec4899',
                  pointerEvents: 'none',
                  zIndex: 33,
                }}
              >
                {hg.label && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 6,
                      top: 3,
                      background: '#db2777',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                    }}
                  >
                    {hg.label}
                  </span>
                )}
              </div>
            ))}
            {activeSnapGuides.readout && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.max(4, Math.min(activeSnapGuides.readout.x * zoom, 560 * zoom - 96)),
                  top: Math.max(4, activeSnapGuides.readout.y * zoom - 22),
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 4,
                  pointerEvents: 'none',
                  zIndex: 36,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.3)',
                }}
              >
                X: {activeSnapGuides.readout.x} · Y: {activeSnapGuides.readout.y}
              </div>
            )}
          </>
        )}

        {/* Live Drag-from-Palette Ghost Drop Preview */}
        {paletteDropPreview && (
          <div
            style={{
              position: 'absolute',
              left: paletteDropPreview.x * zoom,
              top: paletteDropPreview.y * zoom,
              width: paletteDropPreview.w * zoom,
              height: Math.max(14, paletteDropPreview.h * zoom),
              border: '2px dashed #10b981',
              background: 'rgba(16, 185, 129, 0.12)',
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
            }}
          >
            <span
              style={{
                background: '#059669',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              }}
            >
              {paletteDropPreview.label} · ({paletteDropPreview.x}, {paletteDropPreview.y})
            </span>
          </div>
        )}

        {/* Live Crosshair Hover Preview when Cursor Placement Mode is active */}
        {cursorMode && hoverCursorPoint && (
          <>
            <div
              style={{
                position: 'absolute',
                left: hoverCursorPoint.x * zoom,
                top: 0,
                width: 0,
                height: 780 * zoom,
                borderLeft: '1px dashed rgba(5, 150, 105, 0.55)',
                pointerEvents: 'none',
                zIndex: 31,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: hoverCursorPoint.y * zoom,
                width: 560 * zoom,
                height: 0,
                borderTop: '1px dashed rgba(5, 150, 105, 0.55)',
                pointerEvents: 'none',
                zIndex: 31,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: Math.min(hoverCursorPoint.x * zoom + 10, 560 * zoom - 138),
                top: Math.max(6, hoverCursorPoint.y * zoom - 24),
                background: '#059669',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 999,
                pointerEvents: 'none',
                zIndex: 36,
                whiteSpace: 'nowrap',
                boxShadow: '0 3px 10px rgba(5, 150, 105, 0.35)',
              }}
            >
              Click to place ({hoverCursorPoint.x}, {hoverCursorPoint.y})
            </div>
          </>
        )}

        {/* Active Canvas Insertion Point / Cursor */}
        {insertionPoint && (
          <>
            {/* Subtle full-sheet X / Y alignment hairlines */}
            <div
              style={{
                position: 'absolute',
                left: insertionPoint.x * zoom,
                top: 0,
                width: 0,
                height: 780 * zoom,
                borderLeft: '1px dashed rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 24,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 3,
                  background: 'rgba(5, 150, 105, 0.9)',
                  color: '#fff',
                  fontSize: 8.5,
                  fontWeight: 700,
                  padding: '0px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                X:{insertionPoint.x}
              </span>
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: insertionPoint.y * zoom,
                width: 560 * zoom,
                height: 0,
                borderTop: '1px dashed rgba(16, 185, 129, 0.5)',
                pointerEvents: 'none',
                zIndex: 24,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: 2,
                  top: 2,
                  background: 'rgba(5, 150, 105, 0.9)',
                  color: '#fff',
                  fontSize: 8.5,
                  fontWeight: 700,
                  padding: '0px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                Y:{insertionPoint.y}
              </span>
            </div>

            {/* Blinking Caret + Draggable Insertion Pin Handle */}
            <div
              data-insertion-cursor="1"
              onMouseDown={(ev) => {
                ev.preventDefault()
                ev.stopPropagation()
                setDraggingInsertionPin(true)
              }}
              onClick={(ev) => ev.stopPropagation()}
              title={`Insertion Cursor (${insertionPoint.x}, ${insertionPoint.y}) — drag to reposition, or use Arrow keys when no element is selected`}
              style={{
                position: 'absolute',
                left: insertionPoint.x * zoom - 9,
                top: insertionPoint.y * zoom - 9,
                width: 18,
                height: 18,
                cursor: 'grab',
                zIndex: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '2px solid #059669',
                  background: 'rgba(16, 185, 129, 0.22)',
                  boxShadow: '0 0 0 2px rgba(255,255,255,0.85)',
                }}
              />
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#059669',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 9,
                  width: 2.5,
                  height: Math.max(16, Math.round(20 * zoom)),
                  background: '#059669',
                  borderRadius: 2,
                  animation: 'rtbCursorBlink 1.05s ease-in-out infinite',
                  pointerEvents: 'none',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: 9,
                  top: 8,
                  width: Math.max(14, Math.round(18 * zoom)),
                  height: 2,
                  background: '#059669',
                  borderRadius: 2,
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Compact Quick-Action Pill beside the Insertion Cursor */}
            <div
              data-insertion-cursor="1"
              onMouseDown={(ev) => ev.stopPropagation()}
              onClick={(ev) => ev.stopPropagation()}
              style={{
                position: 'absolute',
                left: Math.max(4, Math.min(insertionPoint.x * zoom + 12, 560 * zoom - 252)),
                top: insertionPoint.y * zoom > 34 ? insertionPoint.y * zoom - 28 : insertionPoint.y * zoom + 14,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: '#064e3b',
                color: '#ecfdf5',
                padding: '2.5px 6px',
                borderRadius: 999,
                fontSize: 9.5,
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(6, 78, 59, 0.35)',
                zIndex: 32,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                onMouseDown={(ev) => {
                  ev.preventDefault()
                  ev.stopPropagation()
                  setDraggingInsertionPin(true)
                }}
                title="Drag to move insertion cursor"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'grab', paddingRight: 3 }}
              >
                <MapPin className="size-3 text-emerald-300" />
                {insertionPoint.x}, {insertionPoint.y}
              </span>
              {textItem && (
                <button
                  type="button"
                  onClick={() => addEditorElement(textItem, insertionPoint)}
                  title="Insert Text Block at cursor"
                  style={{
                    background: '#059669',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '1px 6px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Text
                </button>
              )}
              {lineItem && (
                <button
                  type="button"
                  onClick={() => addEditorElement(lineItem, insertionPoint)}
                  title="Insert Horizontal Line at cursor"
                  style={{
                    background: '#0d9488',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '1px 6px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Line
                </button>
              )}
              {activeClip && activeClip.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => pasteCopiedElements(activeClip, insertionPoint)}
                  title={`Paste ${activeClip.items.length} copied item(s) at cursor`}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '1px 6px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Paste
                </button>
              )}
              {hasSelection && (
                <button
                  type="button"
                  onClick={() => moveSelectionToInsertionPoint(insertionPoint)}
                  title="Snap selected element(s) to this cursor point"
                  style={{
                    background: '#7c3aed',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 999,
                    padding: '1px 6px',
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Move Here
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setInsertionPoint(null)
                  setCursorMode(false)
                }}
                title="Hide insertion cursor (Esc)"
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  color: '#ecfdf5',
                  border: 'none',
                  borderRadius: 999,
                  padding: '0px 5px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div
      style={isFullPage ? {
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'var(--bg)',
        display: 'flex', flexDirection: 'column',
      } : {
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'rgba(15,23,42,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'modalOverlayIn 0.15s ease',
      }}
      onClick={isFullPage ? undefined : onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900"
        style={isFullPage ? {
          position: 'absolute', inset: 0,
          width: '100%', maxHeight: '100vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        } : {
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(1280px, 100%)', maxHeight: 'calc(100vh - 40px)',
          borderRadius: 14,
          boxShadow: '0 40px 120px -20px rgb(9 9 11 / 0.7)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalIn 0.18s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with step indicators */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 28px',
          background: 'linear-gradient(135deg, #136ee5 0%, #0d5fc9 100%)',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              title="Back to Report Builder"
              aria-label="Back to Report Builder"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              style={{ marginRight: 4 }}
            >
              <ArrowLeft className="size-5" />
            </button>
            <FileText className="size-5" />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{editing ? 'Edit Report' : 'New Report'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {WIZARD_STEPS.map((s, i) => {
              const Icon = s.icon
              const isActive = i === step
              const isComplete = i < step
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive || isComplete ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: `2px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                    fontSize: 14, fontWeight: 700,
                  }}>
                    {isComplete ? <Check className="size-4" /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 700 : 500,
                    opacity: isActive ? 1 : 0.7,
                  }}>{s.label}</span>
                  {i < WIZARD_STEPS.length - 1 && <div style={{ width: 20, height: 2, background: 'rgba(255,255,255,0.3)', margin: '0 4px' }} />}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>Step {step + 1} of {WIZARD_STEPS.length}</span>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/80 hover:bg-white/10">
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {/* Step 0: Template Type */}
          {step === 0 && (
            <div style={{ padding: '32px 28px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Choose a Template</h3>
              <p style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 24 }}>Select a starting point for your report</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                {TEMPLATE_TYPES.map((tpl) => {
                  const Icon = tpl.icon
                  const selected = templateType === tpl.id
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplateType(tpl.id)}
                      className={selected ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-white dark:bg-zinc-800'}
                      style={{
                        border: `2px solid ${selected ? '#136ee5' : '#52525b'}`,
                        borderRadius: 12, padding: 20, textAlign: 'left',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: selected ? '#136ee5' : '#3f3f46',
                        marginBottom: 12,
                      }}>
                        <Icon className="size-5" style={{ color: selected ? '#fff' : '#136ee5' }} />
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>{tpl.label}</p>
                      <p style={{ fontSize: 12, color: 'var(--mist)' }}>{tpl.desc}</p>
                      {selected && (
                        <div style={{
                          position: 'absolute', top: 12, right: 12,
                          width: 24, height: 24, borderRadius: '50%',
                          background: '#136ee5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Check className="size-4 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <input
            ref={elImageInputRef}
            type="file"
            accept="image/*"
            onChange={handleElementImageFileChange}
            style={{ display: 'none' }}
          />

          {/* Step 1: Canvas — EduMESS-style single-page builder */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
              {/* Top bar */}
              <div className="bg-white dark:bg-zinc-900" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--line)' }}>
                <button
                  type="button"
                  onClick={onClose}
                  title="Back to Report Builder"
                  className="rounded-lg border border-line px-2 py-1 text-xs text-mist hover:bg-slate-50 dark:hover:bg-zinc-800"
                >
                  <ArrowLeft className="size-3 inline mr-1" /> Back
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                    <Input
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="Untitled Report"
                      style={{ fontWeight: 700, fontSize: 15 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 230, flex: '0 1 280px' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', whiteSpace: 'nowrap' }}>
                      Exam Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <Select
                      value={examName}
                      onChange={(e) => handleExamNameChange(e.target.value)}
                      placeholder="Select…"
                      aria-label="Exam Name"
                    >
                      <option value="">Select exam…</option>
                      {examNameList.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  </div>
                  {examMarkParts.length > 0 && (
                    <span
                      title={`Subject Table columns from Exam Setup Mark Distribution: ${examMarkParts.map((p) => `${p.name} (/${p.max})`).join(', ')}`}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      {examMarkParts.map((p) => `${p.name} (/${p.max})`).join(' · ')}
                    </span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 190, flex: '0 1 220px' }}>
                    <label htmlFor="builder-report-type" style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', whiteSpace: 'nowrap' }}>Report Type</label>
                    <Select id="builder-report-type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                      <option value="Standard">Standard</option>
                      <option value="CGPA">CGPA</option>
                      {editing && reportType !== 'Standard' && reportType !== 'CGPA' && <option value={reportType}>{reportType} (existing)</option>}
                    </Select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handlePublishTheme}
                  title={`Publish current canvas design as ${nextPublishedThemeName} in Reportsheet Theme and add as Published in Report Builder`}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Palette className="size-3 inline mr-1" /> Publish Theme
                </button>
                <button type="button" onClick={() => setStep(2)} className="rounded-lg border border-line px-3 py-1 text-xs text-mist hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <Eye className="size-3 inline mr-1" /> Preview
                </button>
                <button type="button" onClick={handleSave} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
                  <Save className="size-3 inline mr-1" /> Save
                </button>
              </div>

              {/* Main area: icon rail + panel + canvas */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                {/* Icon rail */}
                <div className="bg-slate-50 dark:bg-zinc-800" style={{ width: 104, flexShrink: 0, borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', padding: '8px 0' }}>
                  {[
                    { id: 'elements', label: 'Data Element', icon: LayoutGrid },
                    { id: 'editor', label: 'Editor', icon: Type },
                    { id: 'sections', label: 'Sections', icon: Layers },
                    { id: 'templates', label: 'Templates', icon: FileText },
                    { id: 'setup', label: 'Page Setup', icon: Settings },
                  ].map((v) => {
                    const Icon = v.icon
                    const active = currentView === v.id
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (currentView !== 'style') setLastPaletteView(v.id as typeof lastPaletteView)
                          if (v.id !== 'templates') {
                            setSelectedElement(null)
                            setSelectedElements([])
                          }
                          setCurrentView(v.id as typeof currentView)
                        }}
                        className="mx-2 rounded-lg"
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '10px 4px', marginBottom: 4, cursor: 'pointer',
                          background: active ? '#fff' : 'transparent',
                          border: active ? '1px solid var(--line)' : '1px solid transparent',
                          color: active ? '#136ee5' : 'var(--mist)',
                          boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        }}
                      >
                        <Icon className="size-5" />
                        <span style={{ fontSize: 9, fontWeight: 600 }}>{v.label}</span>
                      </button>
                    )
                  })}
                  <button type="button" className="mx-2 rounded-lg text-mist hover:bg-white dark:hover:bg-zinc-700" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 4px', marginBottom: 4, border: '1px solid transparent' }} onClick={async () => {
                    const result = await Swal.fire({
                      title: 'Start a blank form?',
                      text: 'This clears the current canvas. Save your work first if you want to keep it.',
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'Start Blank Form',
                      cancelButtonText: 'Cancel',
                      confirmButtonColor: '#4f46e5',
                      cancelButtonColor: '#64748b',
                      reverseButtons: true,
                      focusCancel: true,
                    })
                    if (!result.isConfirmed) return
                    setCanvasElements([])
                    setTableCellOverrides({})
                    setCanvasSettings(prev => ({ ...prev, blankForm: true }))
                    setSelectedElements([])
                    setSelectedElement(null)
                    setInlineEdit(null)
                    setInsertionPoint(null)
                    setCurrentView('elements')
                    setLastPaletteView('elements')
                    setEditMode(true)
                    setStep(1)
                    toast('Blank form ready — add elements to design your report', 'info')
                  }} title="Start a fresh blank report">
                    <FileText className="size-5" />
                    <span style={{ fontSize: 9, fontWeight: 600 }}>Blank Form</span>
                  </button>
                </div>

                {/* Contextual panel */}
                <div className="bg-white dark:bg-zinc-900" style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
                  {/* View: Data Elements */}
                  {currentView === 'elements' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Data Elements</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 8 }}>Drag to canvas or click to insert at cursor</p>
                      {renderSidebarInsertionBar()}
                      <div style={{ marginBottom: 8 }}>
                        <SearchInput value={search} onChange={setSearch} placeholder="Search elements…" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Object.entries(FIELD_REGISTRY)
                          .filter(([key, def]) => {
                            if (!search) return true
                            const q = search.toLowerCase()
                            return def.label.toLowerCase().includes(q) || key.toLowerCase().includes(q)
                          })
                          .map(([key, def]) => (
                          <div
                            key={key}
                            draggable
                            onDragStart={(e) => { handlePaletteDragStart(e, key, def.w, def.h); e.currentTarget.onclick = null }}
                            onClick={() => addDataElement(key)}
                            className="rtb-el-chip"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', borderRadius: 8, cursor: 'grab',
                              border: '1px solid var(--line)', fontSize: 12,
                              transition: 'all 0.15s',
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{def.icon}</span>
                            <span style={{ fontWeight: 500 }}>{def.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View: Editor Elements */}
                  {currentView === 'editor' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Editor Elements</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 8 }}>Drag to canvas or click to insert at cursor</p>
                      {renderSidebarInsertionBar()}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {EDITOR_ELEMENTS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            draggable
                            onDragStart={(e) => { handleEditorDragStart(e, item); e.currentTarget.onclick = null }}
                            onClick={() => addEditorElement(item)}
                            className="rtb-block-card"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: 12, borderRadius: 8, cursor: 'pointer',
                              border: '1px solid var(--line)', textAlign: 'left',
                              background: 'transparent', transition: 'all 0.15s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 6,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(13,110,253,0.1)', fontSize: 14, fontWeight: 700,
                              color: '#136ee5', flexShrink: 0,
                            }}>
                              {item.icon}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--mist)' }}>
                                {item.key === 'line'
                                  ? 'Horizontal / vertical line · 200px'
                                  : item.key === 'divider'
                                    ? 'Section divider · 500px'
                                    : `${item.w} × ${item.h}px`}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View: Sections */}
                  {currentView === 'sections' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Section Blocks</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 8 }}>Add a pre-arranged block at cursor or default position</p>
                      {renderSidebarInsertionBar()}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {SECTION_BLOCKS.map((block) => (
                          <button
                            key={block.key}
                            type="button"
                            onClick={() => addSectionBlock(block)}
                            className="rtb-block-card"
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: 12, borderRadius: 8, cursor: 'pointer',
                              border: '1px solid var(--line)', textAlign: 'left',
                              background: 'transparent', transition: 'all 0.15s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(13,110,253,0.1)', fontSize: 14,
                              color: '#136ee5',
                            }}>
                              <Layers className="size-4" />
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{block.label}</div>
                              <div style={{ fontSize: 10, color: 'var(--mist)', marginTop: 2 }}>{block.desc}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View: Templates — Reportsheet Themes */}
                  {currentView === 'templates' && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Reportsheet Themes</h3>
                        <button
                          type="button"
                          onClick={resetAllThemeEdits}
                          title="Reset all theme element edits back to default"
                          className="rounded border border-line px-2 py-0.5 text-[10px] font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                        >
                          <RotateCcw className="size-3 inline mr-1" /> Reset Edits
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>
                        Click a theme to load it. Select any element(s) on canvas and click <strong>Copy</strong> (<code>Ctrl+C</code>), switch themes, and click <strong>Paste</strong> (<code>Ctrl+V</code>) — or send directly with <strong>Copy to Theme</strong>.
                      </p>

                      {themeClipboard && themeClipboard.items.length > 0 && (
                        <div
                          className="bg-blue-50/80 dark:bg-blue-950/40"
                          style={{
                            marginBottom: 12,
                            padding: '8px 10px',
                            borderRadius: 8,
                            border: '1px solid rgba(59, 130, 246, 0.45)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
                              {themeClipboard.items.length} copied from {themeClipboard.sourceThemeName}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--mist)' }}>
                              Ready to paste onto {(previewTheme || REPORTSHEET_THEMES[0]).name}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => pasteCopiedElements()}
                              style={{
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Paste
                            </button>
                            <button
                              type="button"
                              title="Clear clipboard"
                              onClick={() => {
                                sharedReportThemeClipboard = null
                                setThemeClipboard(null)
                              }}
                              className="rounded border border-line px-1.5 py-0.5 text-[11px] text-mist hover:bg-slate-200 dark:hover:bg-zinc-800"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}

                      <div
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5"
                        style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
                            Save Canvas as {nextPublishedThemeName}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--mist)' }}>
                            Adds to Reportsheet Theme
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handlePublishTheme}
                          className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700 shrink-0"
                        >
                          <Palette className="size-3 inline mr-1" /> Publish Theme
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {allThemes.map((theme) => {
                          const isActive = (previewTheme?.id || 'theme-1') === theme.id
                          const activeSelCount = selectedObjects.length > 0 ? selectedObjects.length : selectedElement ? 1 : 0
                          return (
                            <div
                              key={theme.id}
                              onClick={() => loadTheme(theme)}
                              className="rtb-block-card"
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: 12, borderRadius: 8, cursor: 'pointer',
                                border: isActive ? '2px solid #3b82f6' : '1px solid var(--line)',
                                textAlign: 'left',
                                background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'rgba(148, 163, 184, 0.05)',
                                transition: 'all 0.15s',
                              }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: theme.accentColor,
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.24)',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                                fontSize: 12, fontWeight: 700,
                              }}>
                                {theme.name.replace('Theme ', 'T')}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>{theme.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--mist)' }}>{theme.tagline}</div>
                              </div>
                              {!isActive && activeSelCount > 0 && (
                                <button
                                  type="button"
                                  title={`Copy ${activeSelCount} selected element${activeSelCount > 1 ? 's' : ''} onto ${theme.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    copySelectionToTheme(theme)
                                  }}
                                  className="rounded-md border border-blue-500/40 bg-blue-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-700 shrink-0"
                                >
                                  <Copy className="size-2.5 inline mr-1" />
                                  {activeSelCount > 1 ? `Copy (${activeSelCount}) Here` : 'Copy Element'}
                                </button>
                              )}
                              {isActive && (
                                <Check className="size-4 shrink-0" style={{ color: '#3b82f6' }} />
                              )}
                              {allThemes.length > 1 && (
                                <button
                                  type="button"
                                  title={`Delete ${theme.name}`}
                                  aria-label={`Delete ${theme.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!window.confirm(`Delete ${theme.name} (${theme.tagline}) from Reportsheet Theme?`)) {
                                      return
                                    }
                                    const fallback = onDeleteTheme(theme.id)
                                    if (fallback && isActive) {
                                      delete themeWorkspacesRef.current[theme.id]
                                      loadTheme(fallback)
                                    } else if (fallback) {
                                      delete themeWorkspacesRef.current[theme.id]
                                    }
                                  }}
                                  className="rounded p-1 text-mist transition hover:bg-red-500/10 hover:text-red-500 shrink-0"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          Copy Edits &amp; Custom Elements From Theme
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Select
                            value={copyFromThemeId}
                            onChange={(e) => setCopyFromThemeId(e.target.value)}
                            style={{ fontSize: 12, flex: 1 }}
                          >
                            <option value="">Select source theme…</option>
                            {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                              <option key={th.id} value={th.id}>
                                {th.name} — {th.tagline}
                              </option>
                            ))}
                          </Select>
                          <button
                            type="button"
                            disabled={!copyFromThemeId || copyFromThemeId === (previewTheme?.id || 'theme-1')}
                            onClick={() => copyAllFromTheme(copyFromThemeId)}
                            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            <Copy className="size-3 inline mr-1" /> Copy In
                          </button>
                        </div>
                      </div>

                      {hiddenThemeElements.length > 0 && (
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                            Hidden Theme Elements ({hiddenThemeElements.length})
                          </label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {hiddenThemeElements.map((hel) => (
                              <button
                                key={hel.id}
                                type="button"
                                onClick={() => restoreThemeElement(hel.id)}
                                className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-mist hover:border-indigo-500 hover:text-indigo-600"
                              >
                                + Restore {hel.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* View: Page Setup — Report Configuration */}
                  {currentView === 'setup' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Report Configuration</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>Set up the basic parameters for your report</p>
                      <div className="rounded-lg border border-line p-3" style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Canvas guides</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginBottom: 6 }}><input type="checkbox" checked={Boolean(canvasSettings.showRuler)} onChange={e => setCanvasSettings(prev => ({ ...prev, showRuler: e.target.checked }))} /> Show ruler</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}><input type="checkbox" checked={Boolean(canvasSettings.showGrid)} onChange={e => setCanvasSettings(prev => ({ ...prev, showGrid: e.target.checked }))} /> Show grid lines</label>
                        <p style={{ fontSize: 10, color: 'var(--mist)', marginTop: 6 }}>Guides use canvas pixels and are not printed.</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Field label="Exam Name" required>
                          <Select
                            value={examName}
                            onChange={(e) => handleExamNameChange(e.target.value)}
                            placeholder="Select…"
                          >
                            <option value="">Select exam…</option>
                            {examNameList.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </Select>
                          {examMarkParts.length > 0 && (
                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)' }}>Mark Distribution:</span>
                              {examMarkParts.map((part) => (
                                <span
                                  key={part.name}
                                  className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                                >
                                  {part.name} (/{part.max})
                                </span>
                              ))}
                            </div>
                          )}
                        </Field>
                        <Field label="Report Name" required>
                          <Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. First Term Examination Results" />
                        </Field>
                        <Field label="Report Type" required>
                          <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                            <option value="Standard">Standard</option>
                            <option value="CGPA">CGPA</option>
                            {editing && reportType !== 'Standard' && reportType !== 'CGPA' && <option value={reportType}>{reportType} (existing)</option>}
                          </Select>
                        </Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <Field label="Page Orientation">
                            <Select value={pageOrientation} onChange={(e) => setPageOrientation(e.target.value as 'portrait' | 'landscape')}>
                              <option value="portrait">Portrait</option>
                              <option value="landscape">Landscape</option>
                            </Select>
                          </Field>
                          <Field label="Status">
                            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                              <option value="Draft">Draft</option>
                              <option value="Published">Published</option>
                            </Select>
                          </Field>
                        </div>
                        <Field label="School Logo" hint="Upload your school logo (PNG/JPG)">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {canvasSettings.schoolLogo ? (
                              <img
                                src={canvasSettings.schoolLogo}
                                alt="School Logo Preview"
                                style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 4, border: '1px solid #e2e8f0' }}
                              />
                            ) : (
                              <div style={{
                                width: 40, height: 40, borderRadius: 4,
                                border: '1px dashed #cbd5e1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--mist)', fontSize: 18,
                              }}>🖼</div>
                            )}
                            <label style={{
                              cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#136ee5',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}>
                              <Upload className="size-3.5" />
                              {canvasSettings.schoolLogo ? 'Change' : 'Upload'}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                onChange={handleLogoUpload}
                                style={{ display: 'none' }}
                              />
                            </label>
                            {canvasSettings.schoolLogo && (
                              <button
                                type="button"
                                onClick={() => setCanvasSettings((s) => ({ ...s, schoolLogo: '' }))}
                                style={{
                                  fontSize: 11, color: '#ef4444', cursor: 'pointer',
                                  background: 'none', border: 'none', padding: 0,
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </Field>
                        <Field label="Include Subjects" hint="Leave empty for all subjects">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {subjectOptions.slice(0, 12).map((s) => {
                              const name = String(s.name ?? '')
                              const checked = includeSubjects.includes(name)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleSubject(name)}
                                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
                                    checked
                                      ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                      : 'border-line text-mist hover:border-indigo-400/60'
                                  }`}
                                >
                                  {checked && <Check className="size-3 inline mr-1" />}
                                  {name}
                                </button>
                              )
                            })}
                          </div>
                        </Field>
                        <Field label="Page Margins" hint="Adjust the page margins in points (pt)">
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Top (pt)</label>
                              <Input
                                type="number"
                                value={canvasSettings.marginTop}
                                onChange={(e) => setCanvasSettings((s) => ({ ...s, marginTop: Number(e.target.value) || 0 }))}
                                style={{ fontSize: 12 }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Bottom (pt)</label>
                              <Input
                                type="number"
                                value={canvasSettings.marginBottom}
                                onChange={(e) => setCanvasSettings((s) => ({ ...s, marginBottom: Number(e.target.value) || 0 }))}
                                style={{ fontSize: 12 }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Left (pt)</label>
                              <Input
                                type="number"
                                value={canvasSettings.marginLeft}
                                onChange={(e) => setCanvasSettings((s) => ({ ...s, marginLeft: Number(e.target.value) || 0 }))}
                                style={{ fontSize: 12 }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>Right (pt)</label>
                              <Input
                                type="number"
                                value={canvasSettings.marginRight}
                                onChange={(e) => setCanvasSettings((s) => ({ ...s, marginRight: Number(e.target.value) || 0 }))}
                                style={{ fontSize: 12 }}
                              />
                            </div>
                          </div>
                        </Field>
                      </div>
                    </div>
                  )}

                  {/* View: Style — shown when element is selected */}
                  {currentView === 'style' && (selectedEl || selectedObjects.length > 0) && (
                    <div style={{ padding: 16 }}>
                      {/* Multi-Selection & Group Controls (EduMESS workflow: Select Multiple -> Group / Ungroup -> Move Together) */}
                      <div
                        className="bg-slate-50 dark:bg-zinc-800/70"
                        style={{
                          marginBottom: 12,
                          padding: 10,
                          borderRadius: 8,
                          border: isSingleCompleteGroup ? '1.5px solid #7c3aed' : '1px solid var(--line)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: isSingleCompleteGroup ? '#7c3aed' : 'var(--foreground)' }}>
                            {isSingleCompleteGroup
                              ? `Group (${selectedObjects.length} elements)`
                              : selectedObjects.length > 1
                                ? `${selectedObjects.length} Elements Selected`
                                : 'Selection & Grouping'}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMultiSelectMode((m) => !m)}
                            className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition ${
                              multiSelectMode
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-line text-mist hover:border-blue-500 hover:text-blue-600'
                            }`}
                          >
                            {multiSelectMode ? `Select Multiple: ON (${selectedObjects.length})` : 'Select Multiple'}
                          </button>
                        </div>

                        <p style={{ fontSize: 10, color: 'var(--mist)', marginBottom: 8, lineHeight: 1.35 }}>
                          {isSingleCompleteGroup
                            ? 'Grouped: drag any item on the canvas to move the whole group together, or click Ungroup to move one item individually.'
                            : multiSelectMode
                              ? 'Click elements on the canvas to add/remove them, then click Group.'
                              : 'Turn on Select Multiple (or Shift/Ctrl+Click or drag a box on canvas) to select multiple items and group them.'}
                        </p>

                        {selectedObjects.length > 1 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {selectedObjects.map((item) => (
                              <span
                                key={item.id}
                                onClick={() => setSelectedElement(item.id)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 10,
                                  fontWeight: selectedElement === item.id ? 700 : 500,
                                  padding: '2px 6px',
                                  borderRadius: 999,
                                  cursor: 'pointer',
                                  background: selectedElement === item.id ? 'rgba(19,110,229,0.14)' : 'rgba(148,163,184,0.16)',
                                  color: selectedElement === item.id ? '#136ee5' : 'var(--foreground)',
                                  border: item.groupId ? '1px solid rgba(124,58,237,0.45)' : '1px solid transparent',
                                }}
                              >
                                {item.label}
                                <button
                                  type="button"
                                  title="Remove from selection"
                                  onClick={(ev) => {
                                    ev.stopPropagation()
                                    const rem = selectedElements.filter((sid) => sid !== item.id)
                                    setSelectedElements(rem)
                                    if (selectedElement === item.id) setSelectedElement(rem[rem.length - 1] ?? null)
                                  }}
                                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, lineHeight: 1, opacity: 0.7 }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {canGroupSelection && (
                            <button
                              type="button"
                              onClick={groupSelectedElements}
                              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                              <Layers className="size-3 inline mr-1" /> Group ({selectedObjects.length})
                            </button>
                          )}
                          {canUngroupSelection && (
                            <button
                              type="button"
                              onClick={ungroupSelectedElements}
                              className="rounded-md border border-purple-500/50 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
                            >
                              Ungroup
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copySelectedElements()}
                            title="Copy selected element(s) to clipboard so you can paste onto any theme (Ctrl+C)"
                            className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                          >
                            <Copy className="size-3 inline mr-1" /> Copy Element{selectedObjects.length > 1 ? `s (${selectedObjects.length})` : ''}
                          </button>
                          {themeClipboard && themeClipboard.items.length > 0 && (
                            <button
                              type="button"
                              onClick={() => pasteCopiedElements()}
                              title={`Paste ${themeClipboard.items.length} copied element(s) from ${themeClipboard.sourceThemeName} (Ctrl+V)`}
                              className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                            >
                              <ClipboardPaste className="size-3 inline mr-1" /> Paste ({themeClipboard.items.length})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => duplicateSelectedElements()}
                            className="rounded-md border border-line px-2 py-1 text-[11px] font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                          >
                            <Copy className="size-3 inline mr-1" /> Duplicate
                          </button>
                          {selectedObjects.length > 1 && (
                            <button
                              type="button"
                              onClick={deleteSelectedElements}
                              className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10"
                            >
                              <Trash2 className="size-3 inline mr-1" /> Delete ({selectedObjects.length})
                            </button>
                          )}
                        </div>

                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                          <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                            Copy Element{selectedObjects.length > 1 ? `s (${selectedObjects.length})` : ''} to Another Theme
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                            {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                              <button
                                key={th.id}
                                type="button"
                                title={`Copy selected element${selectedObjects.length > 1 ? 's' : ''} onto ${th.name} (${th.tagline})`}
                                onClick={() => copySelectionToTheme(th)}
                                className="rounded border border-line bg-white px-1.5 py-1 text-[10px] font-semibold text-foreground hover:border-blue-500 hover:text-blue-600 dark:bg-zinc-900 dark:hover:border-blue-400 dark:hover:text-blue-300"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                              >
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: th.accentColor, flexShrink: 0 }} />
                                <span>→ {th.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {selectedObjects.filter((ce) => ce.id.startsWith('id_')).length >= 2 && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                            <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                              Align Selected Items
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                              {([
                                ['left', 'Left'],
                                ['center', 'Center'],
                                ['right', 'Right'],
                                ['top', 'Top'],
                                ['middle', 'Middle'],
                                ['bottom', 'Bottom'],
                              ] as const).map(([k, lbl]) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => alignSelectedElements(k)}
                                  className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                                >
                                  {lbl}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedEl && (
                      <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#136ee5' }}>Edit {selectedEl?.label}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {!selectedEl.id.startsWith('id_') && (
                            <button
                              type="button"
                              onClick={() => resetThemeElement(selectedEl.id)}
                              title="Reset this element to theme default"
                              className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                            >
                              <RotateCcw className="size-3 inline mr-0.5" /> Reset
                            </button>
                          )}
                          <button type="button" onClick={() => { setSelectedElement(null); setCurrentView(lastPaletteView) }} className="rounded p-1 text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                            <X className="size-4" />
                          </button>
                        </div>
                      </div>

                      {/* Image / Logo / Signature Controls */}
                      {(selectedEl?.type === 'image' || selectedEl?.type === 'logo' || selectedEl?.type === 'signature') && (
                        <div style={{ marginBottom: 12, border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                            {selectedEl.type === 'signature' ? 'Signature Image & Caption' : `${selectedEl.label} Image`}
                          </label>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: selectedEl.type === 'signature' ? 8 : 0 }}>
                            {(selectedEl.imageSrc || (selectedEl.id === 'school-logo' && canvasSettings.schoolLogo)) ? (
                              <img
                                src={selectedEl.imageSrc || canvasSettings.schoolLogo}
                                alt={selectedEl.label}
                                style={{ width: 48, height: 40, objectFit: 'contain', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
                              />
                            ) : (
                              <div style={{
                                width: 48, height: 40, borderRadius: 4,
                                border: '1px dashed #cbd5e1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--mist)', fontSize: 10,
                              }}>
                                Default
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => triggerElementImageUpload(selectedEl.id)}
                                className="rounded bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
                              >
                                <Upload className="size-3 inline mr-1" />
                                {selectedEl.imageSrc ? 'Replace Image' : 'Upload Image'}
                              </button>
                              {(selectedEl.imageSrc || (selectedEl.id === 'school-logo' && canvasSettings.schoolLogo)) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateElement(selectedEl.id, { imageSrc: undefined })
                                    if (selectedEl.id === 'school-logo') setCanvasSettings((s) => ({ ...s, schoolLogo: '' }))
                                  }}
                                  className="text-left text-[10px] font-medium text-red-500 hover:underline"
                                >
                                  Clear uploaded image
                                </button>
                              )}
                            </div>
                          </div>

                          {selectedEl.type === 'signature' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Signature Caption</label>
                                <Input
                                  value={selectedEl.caption ?? liveSelectedText}
                                  onChange={(e) => updateElement(selectedEl.id, { caption: e.target.value })}
                                  placeholder="e.g. Class Teacher"
                                  style={{ fontSize: 12 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 2 }}>Signature / Caption Color</label>
                                <ColorPicker
                                  value={(selectedEl.style?.color as string) || '#16325c'}
                                  onChange={(v) => updateStyle(selectedEl.id, 'color', v)}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Subject Table Settings */}
                      {selectedEl?.type === 'table' && (() => {
                        const isClassic = (previewTheme?.id || 'theme-1') === 'theme-1'
                        const defaultRows = isClassic ? DEFAULT_THEME1_SUBJECTS : DEFAULT_TERMINAL_SUBJECTS
                        const activeRows: CustomSubjectEntry[] =
                          (selectedEl.style?.customSubjects as CustomSubjectEntry[] | undefined) ||
                          ((selectedEl.style?.subjects as string[] | undefined)?.length
                            ? (selectedEl.style?.subjects as string[]).map((name, i) => ({
                                subject: name,
                                classScore: defaultRows[i % defaultRows.length]?.classScore ?? 25,
                                examScore: defaultRows[i % defaultRows.length]?.examScore ?? 60,
                              }))
                            : defaultRows)
                        const setCustomRows = (rows: CustomSubjectEntry[]) => {
                          updateStyle(selectedEl.id, 'customSubjects', rows)
                        }
                        const hasDynamicParts = examMarkParts.length > 0
                        const defaultPartScoreFor = (rowIdx: number, partIdx: number, max: number) => {
                          const ratios = [0.88, 0.84, 0.79, 0.80, 0.90, 0.83, 0.76, 0.87]
                          const wobble = partIdx % 2 === 0 ? 0.01 : -0.02
                          return Math.round(max * Math.min(0.98, Math.max(0.45, ratios[rowIdx % ratios.length] + wobble)))
                        }
                        return (
                          <div className="bg-slate-50 dark:bg-zinc-800/60" style={{ marginBottom: 10, border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase' }}>Subject Table Settings</label>
                              <span style={{ fontSize: 9, color: 'var(--mist)' }}>Double-click cells on canvas</span>
                            </div>

                            <div className="rounded border border-line p-2" style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Customize column headings</div>
                              <p style={{ fontSize: 10, color: 'var(--mist)', marginBottom: 6 }}>Change headings, reorder or add columns, and choose the data shown in each. Unmapped columns stay blank.</p>
                              {!Array.isArray(selectedEl.style?.customColumns) ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => updateStyle(selectedEl.id, 'customColumns', [
                                  { label: 'Subject', source: 'subject' }, ...((examMarkParts.length ? examMarkParts : [{ name: 'Class Score' }, { name: 'Exam' }]).map((p, i) => ({ label: p.name, source: `score:${i}` }))),
                                  { label: 'Total', source: 'total' }, { label: 'Position', source: 'position' }, { label: 'Remark', source: 'remark' },
                                ])}>Customize headings</button>
                                <button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => updateStyle(selectedEl.id, 'customColumns', [
                                  { label: 'Course Code', source: 'blank' }, { label: 'Course Title', source: 'subject' }, { label: 'Level', source: 'blank' }, { label: 'Credit', source: 'blank' }, { label: 'Grade Point', source: 'blank' }, { label: 'GPA', source: 'blank' }, { label: 'Grade', source: 'grade' }, { label: 'Remark', source: 'remark' },
                                ])}>Use course headings example</button>
                              </div> : (() => {
                                const columns = selectedEl.style.customColumns as SubjectColumn[]
                                const setColumns = (next: SubjectColumn[]) => updateStyle(selectedEl.id, 'customColumns', next)
                                return <>
                                  {columns.map((column, i) => <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto auto auto', gap: 3, marginBottom: 4 }}>
                                    <input aria-label={`Heading ${i + 1}`} className="min-w-0 rounded border border-line bg-white px-1 py-1 text-xs dark:bg-zinc-900" value={column.label} onChange={e => setColumns(columns.map((c, n) => n === i ? { ...c, label: e.target.value } : c))} />
                                    <select aria-label={`Data for heading ${i + 1}`} className="min-w-0 rounded border border-line bg-white px-1 py-1 text-xs dark:bg-zinc-900" value={column.source} onChange={e => setColumns(columns.map((c, n) => n === i ? { ...c, source: e.target.value } : c))}>
                                      <option value="blank">Blank</option><option value="subject">Subject</option><option value="subjectCode">Subject short name</option>
                                      {(examMarkParts.length ? examMarkParts : [{ name: 'Class Score' }, { name: 'Exam' }]).map((p, n) => <option key={n} value={`score:${n}`}>{p.name}</option>)}
                                      <option value="total">Total</option><option value="position">Position</option><option value="grade">Grade</option><option value="remark">Remark</option>
                                      {column.source.startsWith('score:') && Number(column.source.slice(6)) >= (examMarkParts.length || 2) && <option value={column.source}>Unavailable score component</option>}
                                    </select>
                                    <button type="button" title="Move column left" disabled={i === 0} onClick={() => { const a = [...columns]; [a[i-1], a[i]] = [a[i], a[i-1]]; setColumns(a) }}>←</button>
                                    <button type="button" title="Move column right" disabled={i === columns.length - 1} onClick={() => { const a = [...columns]; [a[i+1], a[i]] = [a[i], a[i+1]]; setColumns(a) }}>→</button>
                                    <button type="button" title="Remove column" disabled={columns.length <= 1} onClick={() => setColumns(columns.filter((_, n) => n !== i))}><X className="size-3" /></button>
                                  </div>)}
                                  <div style={{ display: 'flex', gap: 6, marginTop: 5 }}><button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => setColumns([...columns, { label: 'New heading', source: 'blank' }])}>Add column</button><button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => updateStyle(selectedEl.id, 'customColumns', undefined)}>Reset to default</button></div>
                                </>
                              })()}
                            </div>

                            {hasDynamicParts ? (
                              <div className="rounded border border-indigo-500/25 bg-indigo-500/5 p-2" style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', marginBottom: 4 }}>
                                  Mark Distribution — {examName}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {examMarkParts.map((part) => (
                                    <span
                                      key={part.name}
                                      className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300"
                                    >
                                      {part.name} (/{part.max})
                                    </span>
                                  ))}
                                  <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-zinc-700 dark:text-zinc-200">
                                    Total /{examMarkParts.reduce((s, p) => s + p.max, 0)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                                <div>
                                  <label style={{ fontSize: 9, color: 'var(--mist)' }}>CA Weight (%)</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={(selectedEl.style?.caWeight as number) ?? 30}
                                    onChange={(e) => updateStyle(selectedEl!.id, 'caWeight', Number(e.target.value) || 0)}
                                    style={{ fontSize: 12 }}
                                  />
                                </div>
                                <div>
                                  <label style={{ fontSize: 9, color: 'var(--mist)' }}>Exam Weight (%)</label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={(selectedEl.style?.examWeight as number) ?? 70}
                                    onChange={(e) => updateStyle(selectedEl!.id, 'examWeight', Number(e.target.value) || 0)}
                                    style={{ fontSize: 12 }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Editable Subject Rows & Scores */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 4 }}>
                              <label style={{ fontSize: 9, fontWeight: 600, color: 'var(--mist)' }}>
                                Subjects &amp; Scores ({hasDynamicParts ? ['Subject', ...examMarkParts.map((p) => p.name)].join(' / ') : 'Subject / CA / Exam'})
                              </label>
                              <button
                                type="button"
                                onClick={() =>
                                  setCustomRows([
                                    ...activeRows,
                                    hasDynamicParts
                                      ? {
                                          subject: `Subject ${activeRows.length + 1}`,
                                          partScores: examMarkParts.map((p, pi) => defaultPartScoreFor(activeRows.length, pi, p.max)),
                                        }
                                      : { subject: `Subject ${activeRows.length + 1}`, classScore: 25, examScore: 60 },
                                  ])
                                }
                                className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-indigo-700"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                + Add Row
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 170, overflowY: 'auto', marginBottom: 8 }}>
                              {activeRows.map((row, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: hasDynamicParts
                                      ? `minmax(80px, 1fr) ${examMarkParts.map(() => '40px').join(' ')} 20px`
                                      : '1fr 44px 44px 20px',
                                    gap: 3,
                                    alignItems: 'center',
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={row.subject}
                                    onChange={(e) => {
                                      const nextRows = activeRows.map((r, i) => (i === idx ? { ...r, subject: e.target.value } : r))
                                      setCustomRows(nextRows)
                                    }}
                                    className="rounded border border-line bg-white px-1.5 py-1 text-[11px] dark:bg-zinc-900"
                                  />
                                  {hasDynamicParts ? (
                                    examMarkParts.map((part, pi) => {
                                      const currentVal =
                                        row.partScores?.[pi] !== undefined
                                          ? row.partScores[pi]
                                          : defaultPartScoreFor(idx, pi, part.max)
                                      return (
                                        <input
                                          key={part.name}
                                          type="number"
                                          min={0}
                                          max={part.max}
                                          value={currentVal}
                                          onChange={(e) => {
                                            const baseScores = examMarkParts.map((p, j) =>
                                              row.partScores?.[j] !== undefined
                                                ? row.partScores[j]
                                                : defaultPartScoreFor(idx, j, p.max),
                                            )
                                            baseScores[pi] = Number(e.target.value)
                                            const nextRows = activeRows.map((r, i) =>
                                              i === idx ? { ...r, partScores: baseScores } : r,
                                            )
                                            setCustomRows(nextRows)
                                          }}
                                          title={`${part.name} (max ${part.max})`}
                                          className="rounded border border-line bg-white px-1 py-1 text-center text-[11px] dark:bg-zinc-900"
                                        />
                                      )
                                    })
                                  ) : (
                                    <>
                                      <input
                                        type="number"
                                        value={row.classScore ?? 25}
                                        onChange={(e) => {
                                          const nextRows = activeRows.map((r, i) => (i === idx ? { ...r, classScore: Number(e.target.value) } : r))
                                          setCustomRows(nextRows)
                                        }}
                                        title="CA Score"
                                        className="rounded border border-line bg-white px-1 py-1 text-center text-[11px] dark:bg-zinc-900"
                                      />
                                      <input
                                        type="number"
                                        value={row.examScore ?? 60}
                                        onChange={(e) => {
                                          const nextRows = activeRows.map((r, i) => (i === idx ? { ...r, examScore: Number(e.target.value) } : r))
                                          setCustomRows(nextRows)
                                        }}
                                        title="Exam Score"
                                        className="rounded border border-line bg-white px-1 py-1 text-center text-[11px] dark:bg-zinc-900"
                                      />
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setCustomRows(activeRows.filter((_, i) => i !== idx))}
                                    title="Remove row"
                                    className="rounded p-0.5 text-mist hover:text-red-500"
                                  >
                                    <X className="size-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Quick Toggle Branch Subjects */}
                            {subjectOptions.length > 0 && (
                              <>
                                <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 4 }}>Branch Subjects</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 90, overflowY: 'auto', padding: 2 }}>
                                  {subjectOptions.map((s) => {
                                    const name = String(s.name ?? '')
                                    const checked = activeRows.some((r) => r.subject === name)
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                          if (checked) {
                                            setCustomRows(activeRows.filter((r) => r.subject !== name))
                                          } else {
                                            setCustomRows([...activeRows, { subject: name, classScore: 25, examScore: 60 }])
                                          }
                                        }}
                                        className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
                                          checked
                                            ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                            : 'border-line text-mist hover:border-indigo-400/60'
                                        }`}
                                      >
                                        {checked && <Check className="size-3 inline mr-1" />}
                                        {name}
                                      </button>
                                    )
                                  })}
                                </div>
                              </>
                            )}

                            {/* Column Toggles */}
                            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {[
                                { key: 'showPosition', label: 'Position' },
                                { key: 'showGrade', label: 'Grade' },
                                { key: 'showRemark', label: 'Remark' },
                                { key: 'showClassAvg', label: 'Class Avg' },
                                { key: 'showSubjectAvg', label: 'Subject Avg' },
                              ].map((col) => {
                                const enabled = selectedEl.style?.[col.key] !== false
                                return (
                                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}>
                                    <input
                                      type="checkbox"
                                      checked={enabled}
                                      onChange={(e) => updateStyle(selectedEl!.id, col.key, e.target.checked)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span>{col.label}</span>
                                  </label>
                                )
                              })}
                            </div>

                            {Array.isArray(selectedEl.style?.sampleTableRows) && (() => {
                              const sampleRows = selectedEl.style.sampleTableRows as string[][]
                              const columns = (selectedEl.style?.customColumns as SubjectColumn[] | undefined) ?? []
                              return <div className="rounded border border-line p-2" style={{ marginTop: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 700 }}>Illustrative table data</div>
                                <p style={{ fontSize: 10, color: 'var(--mist)', margin: '4px 0' }}>Course title and code use the subject name and short name. Other cells are sample values, not live results or GPA calculations.</p>
                                <div style={{ overflowX: 'auto' }}><table style={{ minWidth: 620, fontSize: 10 }}><thead><tr>{columns.map((c, i) => <th key={i} style={{ padding: 2 }}>{c.label}</th>)}</tr></thead><tbody>{sampleRows.map((row, ri) => <tr key={ri}>{columns.map((c, ci) => <td key={ci}><input aria-label={`${c.label} sample row ${ri + 1}`} className="w-full rounded border border-line bg-white px-1 py-1 dark:bg-zinc-900" value={selectedEl.style?.useSubjectCatalog && (c.source === 'subject' || c.source === 'subjectCode') ? (c.source === 'subject' ? String(subjectOptions[ri]?.name ?? '') : String(subjectOptions[ri]?.short ?? '')) : (row[ci] ?? '')} readOnly={Boolean(selectedEl.style?.useSubjectCatalog && (c.source === 'subject' || c.source === 'subjectCode'))} onChange={e => { const next = sampleRows.map(r => [...r]); next[ri][ci] = e.target.value; updateStyle(selectedEl.id, 'sampleTableRows', next) }} /></td>)}</tr>)}</tbody></table></div>
                              </div>
                            })()}

                            {/* Table Header Colors */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Header Fill</label>
                                <ColorPicker
                                  value={(selectedEl.style?.headerBg as string) || '#f1f1ec'}
                                  onChange={(v) => updateStyle(selectedEl.id, 'headerBg', v)}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Header Text</label>
                                <ColorPicker
                                  value={(selectedEl.style?.headerColor as string) || '#16325c'}
                                  onChange={(v) => updateStyle(selectedEl.id, 'headerColor', v)}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Text Content */}
                      {(selectedEl?.type === 'header' || selectedEl?.type === 'text' || selectedEl?.type === 'custom_text' || selectedEl?.type === 'custom_heading') && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Text Content</label>
                            {selectedEl.text !== undefined && !selectedEl.id.startsWith('id_') && (
                              <button
                                type="button"
                                onClick={() => updateElement(selectedEl.id, { text: undefined })}
                                className="text-[10px] font-medium text-indigo-600 hover:underline"
                              >
                                Reset text
                              </button>
                            )}
                          </div>
                          <textarea
                            rows={2}
                            value={selectedEl.text !== undefined ? selectedEl.text : liveSelectedText}
                            onChange={(e) => updateElement(selectedEl!.id, { text: e.target.value })}
                            placeholder={selectedEl.label || 'Enter custom text…'}
                            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none dark:bg-zinc-900"
                          />
                        </div>
                      )}

                      {/* Font controls */}
                      {(selectedEl?.type === 'header' || selectedEl?.type === 'text' || selectedEl?.type === 'custom_text' || selectedEl?.type === 'custom_heading') && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Font</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 3 }}>
                            <Select
                              value={(selectedEl.style?.fontFamily as string) || 'Inter'}
                              onChange={(e) => updateStyle(selectedEl!.id, 'fontFamily', e.target.value)}
                              style={{ fontSize: 12 }}
                            >
                              <option value="Inter">Inter</option>
                              <option value="Arial">Arial</option>
                              <option value="Verdana">Verdana</option>
                              <option value="Georgia">Georgia</option>
                              <option value="Times New Roman">Times New Roman</option>
                              <option value="Courier New">Courier New</option>
                            </Select>
                            <div style={{ display: 'flex', gap: 2 }}>
                              <button type="button" onClick={() => updateStyle(selectedEl!.id, 'bold', !selectedEl.style?.bold)} className={`rounded border px-1.5 py-0.5 text-[11px] ${selectedEl.style?.bold ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`} style={{ fontWeight: 700 }}>B</button>
                              <button type="button" onClick={() => updateStyle(selectedEl!.id, 'italic', !selectedEl.style?.italic)} className={`rounded border px-1.5 py-0.5 text-[11px] ${selectedEl.style?.italic ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`} style={{ fontStyle: 'italic' }}>I</button>
                              <button type="button" onClick={() => updateStyle(selectedEl!.id, 'underline', !selectedEl.style?.underline)} className={`rounded border px-1.5 py-0.5 text-[11px] ${selectedEl.style?.underline ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`} style={{ textDecoration: 'underline' }}>U</button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Size (px)</label>
                              <Input type="number" min={6} max={72} value={(selectedEl.style?.fontSize as number) ?? 11} onChange={(e) => updateStyle(selectedEl!.id, 'fontSize', Number(e.target.value))} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Color</label>
                              <ColorPicker value={(selectedEl.style?.color as string) || '#0f172a'} onChange={(v) => updateStyle(selectedEl!.id, 'color', v)} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Align</label>
                              <Select value={(selectedEl.style?.align as string) || 'left'} onChange={(e) => updateStyle(selectedEl!.id, 'align', e.target.value)} style={{ fontSize: 12 }}>
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </Select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Line spacing</label>
                              <Input type="number" min={0.8} max={3} step={0.1} value={(selectedEl.style?.lineHeight as number) ?? 1.2} onChange={(e) => updateStyle(selectedEl!.id, 'lineHeight', Number(e.target.value))} style={{ fontSize: 12 }} />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Line & Divider Settings */}
                      {(selectedEl?.type === 'line' || selectedEl?.type === 'divider') && (() => {
                        const isThemeLine = !selectedEl.id.startsWith('id_')
                        const domLineNode = isThemeLine ? canvasRef.current?.querySelector(`[data-element-id="${selectedEl.id}"]`) : null
                        const parsedThick = parseFloat(domLineNode?.getAttribute('data-default-thickness') || '')
                        const defaultThickness =
                          !Number.isNaN(parsedThick) && parsedThick > 0
                            ? parsedThick
                            : (selectedEl.id === 'grading-scale-line' || selectedEl.id === 'footer-line' || (selectedEl.id === 'header-line' && previewTheme?.id === 'theme-4') ? 1 : 2)
                        const defaultColor =
                          domLineNode?.getAttribute('data-default-color') ||
                          (selectedEl.id === 'grading-scale-line' || selectedEl.id === 'footer-line'
                            ? '#e3e3dc'
                            : selectedEl.id === 'header-line'
                              ? (previewTheme?.id === 'theme-1' ? '#16325c' : previewTheme?.id === 'theme-4' ? '#475569' : previewTheme?.accentColor || '#16325c')
                              : '#1e293b')
                        const defaultLineStyle = domLineNode?.getAttribute('data-default-line-style') || 'solid'
                        const isVert = (selectedEl.style?.orientation as string) === 'vertical'
                        const thickness = (selectedEl.style?.lineThickness as number) ?? defaultThickness
                        const lineStyle = (selectedEl.style?.lineStyle as string) || defaultLineStyle
                        const rotation = (selectedEl.style?.rotation as number) ?? 0
                        const lengthVal =
                          isThemeLine && !selectedEl.style?.customSize && selectedElRect && zoom > 0
                            ? Math.round((isVert ? selectedElRect.height : selectedElRect.width) / zoom)
                            : (isVert ? selectedEl.height : selectedEl.width)
                        return (
                          <div className="bg-slate-50 dark:bg-zinc-800/60" style={{ marginBottom: 10, border: '1px solid var(--line)', borderRadius: 8, padding: 10 }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                              Line Settings
                            </label>

                            {/* Orientation toggle */}
                            <div style={{ marginBottom: 8 }}>
                              <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 3 }}>Orientation</label>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                {[
                                  { key: 'horizontal', label: '─ Horizontal' },
                                  { key: 'vertical', label: '│ Vertical' },
                                ].map((opt) => {
                                  const active = (isVert ? 'vertical' : 'horizontal') === opt.key
                                  return (
                                    <button
                                      key={opt.key}
                                      type="button"
                                      onClick={() => {
                                        if (active) return
                                        const curLen = Math.max(lengthVal, 40)
                                        const curCross = Math.max(12, Math.min(selectedEl.width, selectedEl.height, 24))
                                        updateElement(selectedEl.id, {
                                          width: opt.key === 'vertical' ? curCross : curLen,
                                          height: opt.key === 'vertical' ? curLen : curCross,
                                          style: { ...selectedEl.style, orientation: opt.key, ...(isThemeLine ? { customSize: true } : {}) },
                                        })
                                      }}
                                      className={`rounded border px-2 py-1 text-[11px] font-medium transition ${
                                        active
                                          ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                          : 'border-line text-mist hover:border-indigo-400/60'
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Line Style</label>
                                <Select
                                  value={lineStyle}
                                  onChange={(e) => updateStyle(selectedEl.id, 'lineStyle', e.target.value)}
                                  style={{ fontSize: 12 }}
                                >
                                  <option value="solid">Solid</option>
                                  <option value="dashed">Dashed</option>
                                  <option value="dotted">Dotted</option>
                                  <option value="double">Double</option>
                                </Select>
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Thickness (px)</label>
                                <Input
                                  type="number"
                                  min={0.5}
                                  max={20}
                                  step={0.5}
                                  value={thickness}
                                  onChange={(e) => updateStyle(selectedEl.id, 'lineThickness', Math.max(0.5, Math.min(20, Number(e.target.value) || 1)))}
                                  style={{ fontSize: 12 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Length (px)</label>
                                <Input
                                  type="number"
                                  min={10}
                                  max={780}
                                  value={lengthVal}
                                  onChange={(e) => {
                                    const nextLen = Math.max(10, Number(e.target.value) || 10)
                                    updateElement(selectedEl.id, {
                                      ...(isVert ? { height: nextLen } : { width: nextLen }),
                                      ...(isThemeLine ? { style: { ...selectedEl.style, customSize: true } } : {}),
                                    })
                                  }}
                                  style={{ fontSize: 12 }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: 9, color: 'var(--mist)' }}>Angle (°)</label>
                                <Input
                                  type="number"
                                  min={-180}
                                  max={180}
                                  value={rotation}
                                  onChange={(e) => updateStyle(selectedEl.id, 'rotation', Number(e.target.value) || 0)}
                                  style={{ fontSize: 12 }}
                                />
                              </div>
                            </div>

                            <div style={{ marginBottom: 6 }}>
                              <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 3 }}>Line Color</label>
                              <ColorPicker
                                value={(selectedEl.style?.bg as string) || defaultColor}
                                onChange={(v) => updateStyle(selectedEl.id, 'bg', v)}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Fill color */}
                      {selectedEl?.type !== 'line' && selectedEl?.type !== 'divider' && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Fill color</label>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                            <div style={{ flex: 1 }}>
                              <ColorPicker value={(selectedEl?.style?.bg as string) || '#ffffff'} onChange={(v) => updateStyle(selectedEl!.id, 'bg', v)} />
                            </div>
                            <button type="button" onClick={() => updateStyle(selectedEl!.id, 'bg', 'transparent')} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-mist hover:bg-slate-100 dark:hover:bg-zinc-800" style={{ height: 32, flexShrink: 0 }}>Transparent</button>
                          </div>
                        </div>
                      )}

                      {/* Border & spacing */}
                      {selectedEl?.type !== 'divider' && selectedEl?.type !== 'line' && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Border</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 3 }}>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Width</label>
                              <Input type="number" min={0} max={20} value={(selectedEl.style?.borderWidth as number) ?? 0} onChange={(e) => updateStyle(selectedEl!.id, 'borderWidth', Number(e.target.value))} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Style</label>
                              <Select value={(selectedEl.style?.borderStyle as string) || 'solid'} onChange={(e) => updateStyle(selectedEl!.id, 'borderStyle', e.target.value)} style={{ fontSize: 12 }}>
                                <option value="solid">Solid</option>
                                <option value="dashed">Dashed</option>
                                <option value="dotted">Dotted</option>
                                <option value="none">None</option>
                              </Select>
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Color</label>
                              <ColorPicker value={(selectedEl.style?.borderColor as string) || '#a9b1bd'} onChange={(v) => updateStyle(selectedEl!.id, 'borderColor', v)} />
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Radius</label>
                              <Input type="number" min={0} max={500} value={(selectedEl.style?.radius as number) ?? 0} onChange={(e) => updateStyle(selectedEl!.id, 'radius', Number(e.target.value))} style={{ fontSize: 12 }} />
                            </div>
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>Inner spacing (px)</label>
                            <Input type="number" min={0} max={80} value={(selectedEl.style?.padding as number) ?? 0} onChange={(e) => updateStyle(selectedEl!.id, 'padding', Number(e.target.value))} style={{ fontSize: 12 }} />
                          </div>
                        </div>
                      )}

                      {/* Lock & Position */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                            <input type="checkbox" checked={!!selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { locked: e.target.checked })} style={{ cursor: 'pointer' }} />
                            Lock position &amp; size
                          </label>
                          {!selectedEl.id.startsWith('id_') && ((selectedEl.offsetX ?? 0) !== 0 || (selectedEl.offsetY ?? 0) !== 0 || selectedEl.style?.customSize) && (
                            <button
                              type="button"
                              onClick={() => updateElement(selectedEl.id, { offsetX: 0, offsetY: 0, style: { ...selectedEl.style, customSize: false } })}
                              className="text-[10px] font-medium text-indigo-600 hover:underline"
                            >
                              Reset pos/size
                            </button>
                          )}
                        </div>

                        {/* Quick Align & Insertion Cursor Actions */}
                        {!selectedEl?.locked && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            {selectedEl.id.startsWith('id_') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateElement(selectedEl.id, { x: 20 })}
                                  title="Snap left edge to page margin (X = 20)"
                                  className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist hover:border-blue-500 hover:text-blue-600"
                                >
                                  Left
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateElement(selectedEl.id, { x: Math.max(0, Math.round((560 - selectedEl.width) / 2)) })}
                                  title="Center horizontally on page"
                                  className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist hover:border-blue-500 hover:text-blue-600"
                                >
                                  Center H
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateElement(selectedEl.id, { x: Math.max(0, 540 - selectedEl.width) })}
                                  title="Snap right edge to page margin (540)"
                                  className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist hover:border-blue-500 hover:text-blue-600"
                                >
                                  Right
                                </button>
                              </>
                            )}
                            {insertionPoint && (
                              <button
                                type="button"
                                onClick={() => moveSelectionToInsertionPoint(insertionPoint)}
                                title={`Move selected element to Insertion Cursor (${insertionPoint.x}, ${insertionPoint.y})`}
                                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                              >
                                <MapPin className="size-2.5 inline mr-0.5" /> Move to Cursor
                              </button>
                            )}
                            {selectedEl.id.startsWith('id_') && (
                              <button
                                type="button"
                                onClick={() =>
                                  setInsertionPoint({
                                    x: selectedEl.x,
                                    y: Math.min(756, selectedEl.y + selectedEl.height + 8),
                                  })
                                }
                                title="Place Insertion Cursor directly below this element so the next added item stacks underneath"
                                className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mist hover:border-emerald-500 hover:text-emerald-600"
                              >
                                <Crosshair className="size-2.5 inline mr-0.5" /> Cursor Below
                              </button>
                            )}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>{selectedEl.id.startsWith('id_') ? 'X' : 'Offset X'}</label>
                            <Input
                              type="number"
                              value={selectedEl.id.startsWith('id_') ? selectedEl.x : (selectedEl.offsetX ?? 0)}
                              disabled={selectedEl?.locked}
                              onChange={(e) =>
                                selectedEl.id.startsWith('id_')
                                  ? updateElement(selectedEl.id, { x: Math.max(0, Number(e.target.value)) })
                                  : updateElement(selectedEl.id, { offsetX: Number(e.target.value) || 0 })
                              }
                              style={{ fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>{selectedEl.id.startsWith('id_') ? 'Y' : 'Offset Y'}</label>
                            <Input
                              type="number"
                              value={selectedEl.id.startsWith('id_') ? selectedEl.y : (selectedEl.offsetY ?? 0)}
                              disabled={selectedEl?.locked}
                              onChange={(e) =>
                                selectedEl.id.startsWith('id_')
                                  ? updateElement(selectedEl.id, { y: Math.max(0, Number(e.target.value)) })
                                  : updateElement(selectedEl.id, { offsetY: Number(e.target.value) || 0 })
                              }
                              style={{ fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>W (px)</label>
                            <Input
                              type="number"
                              value={selectedEl?.width}
                              disabled={selectedEl?.locked}
                              onChange={(e) =>
                                updateElement(selectedEl!.id, {
                                  width: Math.max(20, Number(e.target.value)),
                                  style: selectedEl.id.startsWith('id_') ? selectedEl.style : { ...selectedEl.style, customSize: true },
                                })
                              }
                              style={{ fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>H (px)</label>
                            <Input
                              type="number"
                              value={selectedEl?.height}
                              disabled={selectedEl?.locked}
                              onChange={(e) =>
                                updateElement(selectedEl!.id, {
                                  height: Math.max(14, Number(e.target.value)),
                                  style: selectedEl.id.startsWith('id_') ? selectedEl.style : { ...selectedEl.style, customSize: true },
                                })
                              }
                              style={{ fontSize: 12 }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Delete / Hide button */}
                      <button type="button" onClick={() => deleteElement(selectedEl!.id)} className="w-full rounded border border-red-500/30 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10">
                        <Trash2 className="size-3 inline mr-1" /> {selectedEl.id.startsWith('id_') ? 'Delete Element' : 'Hide Element from Sheet'}
                      </button>
                      </>
                      )}
                    </div>
                  )}
                </div>

                {/* Canvas area */}
                <div
                  className="bg-slate-200 dark:bg-zinc-700"
                  onMouseDown={handleWorkspaceMouseDown}
                  onClick={handleWorkspaceClick}
                  style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 24, display: 'block', userSelect: 'none' }}
                >
                  {/* Canvas toolbar */}
                  <div
                    data-canvas-toolbar="1"
                    className="bg-white dark:bg-zinc-800"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', borderRadius: 8, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: 8 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{previewTheme ? previewTheme.name : 'Canvas'}</span>
                      <span style={{ fontSize: 10, color: 'var(--mist)' }}>A4 · {pageOrientation === 'portrait' ? '794×1123' : '1123×794'}</span>
                      {cursorMode ? (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Click anywhere on the sheet to place Insertion Cursor (Esc to cancel)
                        </span>
                      ) : editMode ? (
                        <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          {multiSelectMode
                            ? `Multi-Select ON (${selectedObjects.length} selected) — click, hold, or drag box across elements`
                            : isSingleCompleteGroup
                              ? `Group selected (${selectedObjects.length} items) — drag to move together`
                              : insertionPoint
                                ? `Insertion Cursor at (${insertionPoint.x}, ${insertionPoint.y}) — click palette items to insert or drag pin to move`
                                : 'Click empty canvas to set cursor · Drag & hold to select multiple · Double-click to edit'}
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCursorMode((m) => !m)
                          setHoverCursorPoint(null)
                        }}
                        title="Place or reposition the Insertion Cursor anywhere on the canvas — even over theme elements"
                        className={`rounded border px-2 py-0.5 text-xs font-semibold transition ${
                          cursorMode
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                            : insertionPoint
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                              : 'border-line text-mist hover:border-emerald-500 hover:text-emerald-600'
                        }`}
                      >
                        <Crosshair className="size-3 inline mr-1" />
                        {cursorMode
                          ? 'Click Canvas…'
                          : insertionPoint
                            ? `Cursor (${insertionPoint.x}, ${insertionPoint.y})`
                            : 'Insert Cursor'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSnapEnabled((s) => !s)}
                        title="Toggle smart alignment guides & 4px grid snapping (hold Alt while dragging to bypass temporarily)"
                        className={`rounded border px-2 py-0.5 text-xs font-semibold transition ${
                          snapEnabled
                            ? 'border-pink-500/40 bg-pink-500/10 text-pink-700 hover:bg-pink-500/20 dark:text-pink-300'
                            : 'border-line text-mist hover:border-pink-400'
                        }`}
                      >
                        Snap: {snapEnabled ? 'ON' : 'OFF'}
                      </button>
                      {(selectedObjects.length > 0 || selectedElement) && insertionPoint && (
                        <button
                          type="button"
                          onClick={() => moveSelectionToInsertionPoint(insertionPoint)}
                          title={`Move selected element(s) to Insertion Cursor (${insertionPoint.x}, ${insertionPoint.y})`}
                          className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                        >
                          <MapPin className="size-3 inline mr-1" /> Move to Cursor
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMultiSelectMode((m) => !m)
                          if (!editMode) setEditMode(true)
                        }}
                        title="Click multiple elements on the canvas to select and group them"
                        className={`rounded border px-2 py-0.5 text-xs font-semibold transition ${
                          multiSelectMode
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-line text-mist hover:border-blue-500 hover:text-blue-600'
                        }`}
                      >
                        <Check className="size-3 inline mr-1" />
                        {multiSelectMode ? `Select Multiple (${selectedObjects.length})` : 'Select Multiple'}
                      </button>
                      {canGroupSelection && (
                        <button
                          type="button"
                          onClick={groupSelectedElements}
                          title="Group selected elements (Ctrl+G)"
                          style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <Layers className="size-3 inline mr-1" /> Group ({selectedObjects.length})
                        </button>
                      )}
                      {canUngroupSelection && (
                        <button
                          type="button"
                          onClick={ungroupSelectedElements}
                          title="Ungroup selected group (Ctrl+Shift+G)"
                          className="rounded border border-purple-500/50 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
                        >
                          Ungroup
                        </button>
                      )}
                      {(selectedObjects.length > 0 || selectedElement) && (
                        <button
                          type="button"
                          onClick={() => copySelectedElements()}
                          title="Copy selected element(s) to clipboard (Ctrl+C) — switch themes and Paste"
                          className="rounded border border-blue-500/40 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                        >
                          <Copy className="size-3 inline mr-1" /> Copy
                        </button>
                      )}
                      {themeClipboard && themeClipboard.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => pasteCopiedElements()}
                          title={`Paste ${themeClipboard.items.length} copied element(s) from ${themeClipboard.sourceThemeName} (Ctrl+V)`}
                          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          <ClipboardPaste className="size-3 inline mr-1" /> Paste ({themeClipboard.items.length})
                        </button>
                      )}
                      {(selectedObjects.length > 0 || selectedElement) && (
                        <div data-report-popup="true" style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => setCopyToThemeMenuOpen((o) => !o)}
                            title="Copy selected element(s) directly onto another Reportsheet Theme"
                            className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300"
                          >
                            Copy to Theme ▾
                          </button>
                          {copyToThemeMenuOpen && (
                            <div
                              data-report-popup="true"
                              className="bg-white dark:bg-zinc-900"
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                minWidth: 196,
                                borderRadius: 8,
                                border: '1px solid var(--line)',
                                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.22)',
                                padding: 4,
                                zIndex: 60,
                              }}
                            >
                              <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase' }}>
                                Send Selection To
                              </div>
                              {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                                <button
                                  key={th.id}
                                  type="button"
                                  onClick={() => copySelectionToTheme(th)}
                                  className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    border: 'none',
                                    background: 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 10,
                                      height: 10,
                                      borderRadius: 999,
                                      background: th.accentColor,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>
                                    {th.name}
                                  </span>
                                  <ArrowRight className="size-3 text-mist" />
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {(selectedObjects.length > 0 || selectedElement) && (
                        <button
                          type="button"
                          onClick={() => duplicateSelectedElements()}
                          title="Duplicate selected element(s) in place (Ctrl+D)"
                          className="rounded border border-line px-2 py-0.5 text-xs font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-700"
                        >
                          Duplicate
                        </button>
                      )}
                      {(selectedObjects.length > 0 || selectedElement) && (
                        <button
                          type="button"
                          onClick={() => (selectedElements.length > 1 ? deleteSelectedElements() : selectedElement && deleteElement(selectedElement))}
                          className="rounded border border-red-500/30 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/10"
                        >
                          <Trash2 className="size-3 inline mr-1" />
                          {selectedElements.length > 1 ? `Delete (${selectedElements.length})` : selectedElement?.startsWith('id_') ? 'Delete' : 'Hide'}
                        </button>
                      )}
                      {previewTheme && (
                        <button type="button" onClick={() => { setEditMode(!editMode); if (editMode) setInlineEdit(null) }} className={`rounded border px-2 py-0.5 text-xs font-medium transition ${editMode ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-line text-mist hover:border-indigo-400/60'}`}>
                          <Pencil className="size-3 inline mr-1" /> {editMode ? 'Editing ON' : 'Edit Theme'}
                        </button>
                      )}
                      <button type="button" onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="rounded border border-line px-2 py-0.5 text-xs text-mist">–</button>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                      <button type="button" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="rounded border border-line px-2 py-0.5 text-xs text-mist">+</button>
                      <button type="button" onClick={() => setZoom(0.75)} className="rounded border border-line px-2 py-0.5 text-xs text-mist">Fit</button>
                    </div>
                  </div>

                  {/* Selection + hover + live marquee highlight styles for theme elements */}
                  <style>{`
                    [data-element-id] { cursor: ${cursorMode ? 'crosshair' : 'pointer'}; transition: outline-color 0.1s ease; user-select: none; }
                    ${editMode ? `[data-element-id]:hover { outline: 1px dashed rgba(19, 110, 229, 0.65); outline-offset: 2px; border-radius: 2px; }` : ''}
                    ${editMode ? `[data-table-cell-key]:hover { background-color: rgba(19, 110, 229, 0.06); }` : ''}
                    ${editMode ? selectedObjects.filter((ce) => !ce.id.startsWith('id_')).map((ce) => `[data-element-id="${ce.id}"] { outline: 2px solid ${ce.groupId ? '#7c3aed' : '#136ee5'} !important; outline-offset: 2px; border-radius: 2px; }`).join('\n') : ''}
                    ${marqueePreviewIds.filter((id) => !id.startsWith('id_')).map((id) => `[data-element-id="${id}"] { outline: 2px solid #2563eb !important; outline-offset: 2px; background-color: rgba(37, 99, 235, 0.07); border-radius: 2px; }`).join('\n')}
                  `}</style>
                  <div style={{ position: 'relative', width: 560 * zoom, height: 780 * zoom, margin: canvasSettings.showRuler ? '24px auto 0' : '0 auto', userSelect: 'none' }}>
                    {canvasSettings.showRuler && <CanvasRulers zoom={zoom} />}
                    <div
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      onDoubleClick={handleCanvasDoubleClick}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseLeave={() => setHoverCursorPoint(null)}
                      onContextMenu={handleCanvasContextMenu}
                      onDragStart={(e) => { if (!draggingField) e.preventDefault() }}
                      onDragOver={handleCanvasDragOver}
                      onDragLeave={handleCanvasDragLeave}
                      onDrop={handleCanvasDrop}
                      style={{
                        background: certificateColor || '#fff', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        width: 560 * zoom, height: 780 * zoom,
                        position: 'relative', overflow: 'hidden',
                        border: '1px solid #d1d5db',
                        userSelect: 'none',
                        cursor: cursorMode ? 'crosshair' : undefined,
                      }}
                    >
                      {canvasSettings.showGrid && <CanvasGrid zoom={zoom} />}
                      {/* Render the actual theme renderer — handles all 6 themes declaratively */}
                      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 560, height: 780, position: 'relative' }}
                        onDragOver={handleCanvasDragOver}
                        onDrop={handleCanvasDrop}
                      >
                        {!canvasSettings.blankForm && <ReportsheetSheetRenderer
                          key={previewTheme?.id || 'theme-1'}
                          themeId={previewTheme?.id || 'theme-1'}
                          schoolName={canvasSettings.schoolName}
                          schoolAddress={canvasSettings.schoolAddress}
                          examName={examName || canvasSettings.examName || canvasSettings.reportTitle || reportName || 'First Term Examination'}
                          academicYear={canvasSettings.academicYear || '2026/2027'}
                          termLabel={canvasSettings.term || '1'}
                          reportOptions={JSON.stringify(reportOptions)}
                          topSpace={String(canvasSettings.marginTop)}
                          bottomSpace={String(canvasSettings.marginBottom)}
                          leftSpace={String(canvasSettings.marginLeft)}
                          rightSpace={String(canvasSettings.marginRight)}
                          logoDataUrl={canvasSettings.schoolLogo || undefined}
                          parts={examMarkParts.length > 0 ? examMarkParts : undefined}
                          subjects={tableEl?.style?.subjects as string[] | undefined}
                          customSubjects={tableEl?.style?.customSubjects as CustomSubjectEntry[] | undefined}
                          subjectCatalog={subjectOptions}
                          elementOverrides={elementOverrides}
                          caWeight={(tableEl?.style?.caWeight as number) ?? 30}
                          examWeight={(tableEl?.style?.examWeight as number) ?? 70}
                          showPosition={tableEl?.style?.showPosition !== false}
                          showGrade={tableEl?.style?.showGrade !== false}
                          showRemark={tableEl?.style?.showRemark !== false}
                          showClassAvg={tableEl?.style?.showClassAvg !== false}
                          showSubjectAvg={tableEl?.style?.showSubjectAvg !== false}
                          renderPublishedOverlays={false}
                        />}

                        {/* Render drag-added elements as absolutely positioned boxes */}
                        {canvasElements.filter(el => el.id.startsWith('id_')).map(el => {
                          const isInSelection = selectedElements.includes(el.id) || selectedElement === el.id
                          const isInMarquee = marqueePreviewIds.includes(el.id)
                          const isSingleSel = isInSelection && selectedElements.length <= 1
                          const selBorderColor = isInMarquee ? '#2563eb' : (el.groupId ? '#7c3aed' : '#136ee5')
                          const s = el.style || {}
                          const isLineLike = el.type === 'line' || el.type === 'divider'
                          const isVertLine = (s.orientation as string) === 'vertical'
                          const customBw = Number(s.borderWidth) || 0
                          const customBs = (s.borderStyle as string) || 'solid'
                          const customBc = (s.borderColor as string) || '#94a3b8'
                          const hasCustomBorder = !isLineLike && customBw > 0 && customBs !== 'none'
                          const baseStyle: React.CSSProperties = {
                            position: 'absolute',
                            left: el.x,
                            top: el.y,
                            width: el.width,
                            height: el.height,
                            cursor: cursorMode ? 'crosshair' : el.locked ? 'default' : 'move',
                            userSelect: 'none',
                            border: isLineLike
                              ? ((isInSelection || isInMarquee) ? `1px dashed ${selBorderColor}` : 'none')
                              : hasCustomBorder
                                ? `${customBw}px ${customBs} ${customBc}`
                                : ((isInSelection || isInMarquee) ? `2px solid ${selBorderColor}` : editMode ? '1px dashed #94a3b8' : 'none'),
                            outline: hasCustomBorder && (isInSelection || isInMarquee) ? `2px solid ${selBorderColor}` : undefined,
                            outlineOffset: hasCustomBorder && (isInSelection || isInMarquee) ? 2 : undefined,
                            boxShadow: isInMarquee ? '0 0 0 3px rgba(37, 99, 235, 0.16)' : undefined,
                          borderRadius: isLineLike ? 2 : ((s.radius as number) ?? 4),
                          background: isLineLike ? 'transparent' : (s.bg === 'transparent' ? 'transparent' : ((s.bg as string) || 'rgba(255,255,255,0.92)')),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: isLineLike
                            ? 'center'
                            : (s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'),
                          textAlign: (s.align as React.CSSProperties['textAlign']) || 'center',
                          fontFamily: (s.fontFamily as string) || undefined,
                          fontSize: (s.fontSize as number) ?? 12,
                          fontWeight: s.bold ? 700 : undefined,
                          fontStyle: s.italic ? 'italic' : undefined,
                          textDecoration: s.underline ? 'underline' : undefined,
                          letterSpacing: (s.letterSpacing as string) || undefined,
                          textTransform: (s.textTransform as React.CSSProperties['textTransform']) || undefined,
                          color: (s.color as string) || '#1e293b',
                          padding: isLineLike ? 0 : ((s.padding as number) ?? 4),
                          overflow: isLineLike || isSingleSel ? 'visible' : 'hidden',
                          transform: isLineLike && (s.rotation as number) ? `rotate(${s.rotation}deg)` : undefined,
                          zIndex: 10,
                        }
                        const handles = isSingleSel && editMode && !el.locked ? (
                          isLineLike
                            ? (isVertLine
                                ? [
                                    { c: 'n', l: 'calc(50% - 4px)', t: -4, cur: 'ns-resize' },
                                    { c: 's', l: 'calc(50% - 4px)', t: el.height - 4, cur: 'ns-resize' },
                                  ]
                                : [
                                    { c: 'w', l: -4, t: 'calc(50% - 4px)', cur: 'ew-resize' },
                                    { c: 'e', l: el.width - 4, t: 'calc(50% - 4px)', cur: 'ew-resize' },
                                  ])
                            : [
                                { c: 'nw', l: 0, t: 0, cur: 'nwse-resize' },
                                { c: 'n', l: 'calc(50% - 4px)', t: -4, cur: 'ns-resize' },
                                { c: 'ne', l: el.width - 8, t: 0, cur: 'nesw-resize' },
                                { c: 'e', l: el.width - 4, t: 'calc(50% - 4px)', cur: 'ew-resize' },
                                { c: 'se', l: el.width - 8, t: el.height - 8, cur: 'nwse-resize' },
                                { c: 's', l: 'calc(50% - 4px)', t: el.height - 4, cur: 'ns-resize' },
                                { c: 'sw', l: 0, t: el.height - 8, cur: 'nesw-resize' },
                                { c: 'w', l: -4, t: 'calc(50% - 4px)', cur: 'ew-resize' },
                              ]
                        ) : null
                        const handleEls = handles ? handles.map(h => (
                          <div key={h.c} data-resize-handle="1" style={{ left: h.l, top: h.t, width: 8, height: 8, cursor: h.cur, border: '1.5px solid #136ee5', background: '#fff', borderRadius: isLineLike ? '50%' : 2, zIndex: 11, position: 'absolute' }} onMouseDown={(ev) => { ev.stopPropagation(); handleResizeMouseDown(ev, el, h.c as any) }} />
                        )) : null
                        const deleteBtn = isSingleSel && editMode ? (
                          <div
                            data-resize-handle="1"
                            data-report-popup="true"
                            onMouseDown={(ev) => ev.stopPropagation()}
                            onClick={(ev) => ev.stopPropagation()}
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: -26,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              background: '#0f172a',
                              color: '#fff',
                              padding: '2px 5px',
                              borderRadius: 6,
                              boxShadow: '0 4px 12px rgba(15,23,42,0.28)',
                              zIndex: 14,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setMultiSelectMode((m) => !m)}
                              style={{
                                background: multiSelectMode ? '#2563eb' : '#334155',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 4,
                                padding: '1px 6px',
                                fontSize: 9.5,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Select Multiple
                            </button>
                            <button
                              type="button"
                              onClick={() => copySelectedElements([el.id])}
                              title="Copy to clipboard (Ctrl+C) — paste onto any theme"
                              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Copy
                            </button>
                            <div data-report-popup="true" style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => setFloatingCopyToThemeOpen((o) => !o)}
                                title="Copy this element directly to another theme"
                                style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                              >
                                → Theme ▾
                              </button>
                              {floatingCopyToThemeOpen && (
                                <div
                                  data-report-popup="true"
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 'calc(100% + 4px)',
                                    minWidth: 132,
                                    background: '#0f172a',
                                    border: '1px solid #334155',
                                    borderRadius: 6,
                                    padding: 3,
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                                    zIndex: 40,
                                  }}
                                >
                                  {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                                    <button
                                      key={th.id}
                                      type="button"
                                      onClick={() => copySelectionToTheme(th, [el.id])}
                                      style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 6px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 4,
                                        color: '#f8fafc',
                                        fontSize: 10,
                                        fontWeight: 600,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: th.accentColor, flexShrink: 0 }} />
                                      <span>{th.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => duplicateSelectedElements([el.id])}
                              title="Duplicate in place (Ctrl+D)"
                              style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Dup
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteElement(el.id)}
                              title="Delete element"
                              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700, cursor: 'pointer' }}
                            >
                              ×
                            </button>
                          </div>
                        ) : null
                        if (isLineLike) {
                          const lineThickness = (s.lineThickness as number) ?? 2
                          const lineStyle = (s.lineStyle as string) || 'solid'
                          const lineColor = (s.bg as string) || (el.type === 'line' ? '#1e293b' : '#94a3b8')
                          return (
                            <div
                              key={el.id}
                              data-canvas-element="1"
                              data-custom-id={el.id}
                              style={baseStyle}
                              onMouseDown={(e) => handleElementMouseDown(e, el)}
                            >
                              <div
                                style={
                                  isVertLine
                                    ? {
                                        width: 0,
                                        height: '100%',
                                        borderLeft: `${lineThickness}px ${lineStyle} ${lineColor}`,
                                        pointerEvents: 'none',
                                      }
                                    : {
                                        width: '100%',
                                        height: 0,
                                        borderTop: `${lineThickness}px ${lineStyle} ${lineColor}`,
                                        pointerEvents: 'none',
                                      }
                                }
                              />
                              {handleEls}
                              {deleteBtn}
                            </div>
                          )
                        }
                        if (el.type === 'custom_heading') {
                          return <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, fontSize: (s.fontSize as number) ?? 16, fontWeight: 700 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                        }
                        if (el.type === 'image' || el.type === 'logo') {
                          const resolvedImgSrc = el.imageSrc || (el.field === 'school_logo' ? canvasSettings.schoolLogo : undefined)
                          return (
                            <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, background: resolvedImgSrc ? 'transparent' : '#f1f5f9', border: resolvedImgSrc ? baseStyle.border : ((isInSelection || isInMarquee) ? `2px solid ${selBorderColor}` : '1px dashed #94a3b8'), color: '#64748b', fontSize: 10 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                              {resolvedImgSrc ? <img src={resolvedImgSrc} alt={el.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : el.label}
                              {handleEls}{deleteBtn}
                            </div>
                          )
                        }
                        if (el.type === 'signature') {
                          const sigColor = (s.color as string) || '#1e293b'
                          const sigCaption = el.caption ?? el.text ?? el.label
                          return (
                            <div
                              key={el.id}
                              data-canvas-element="1"
                              data-custom-id={el.id}
                              style={{ ...baseStyle, flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                              onMouseDown={(e) => handleElementMouseDown(e, el)}
                            >
                              {el.imageSrc ? (
                                <img src={el.imageSrc} alt={sigCaption} draggable={false} style={{ maxHeight: Math.max(16, el.height - 16), objectFit: 'contain' }} />
                              ) : (
                                <svg width="78" height="22" viewBox="0 0 96 28" fill="none" style={{ pointerEvents: 'none', flexShrink: 0 }}>
                                  <path d="M8 22C16 9 22 6 24 14C26 21 31 8 38 12C44 16 48 9 56 15C63 20 74 11 88 13" stroke={sigColor} strokeWidth="1.6" strokeLinecap="round" />
                                </svg>
                              )}
                              <div style={{ width: '82%', borderTop: '1px solid #64748b', paddingTop: 2, textAlign: 'center', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em', color: sigColor }}>
                                {sigCaption}
                              </div>
                              {handleEls}
                              {deleteBtn}
                            </div>
                          )
                        }
                        if (el.type === 'table') {
                          const caW = (el.style?.caWeight as number) ?? 30
                          const exW = (el.style?.examWeight as number) ?? 70
                          const scoreCols: MarkPart[] =
                            examMarkParts.length > 0
                              ? examMarkParts
                              : [
                                  { name: 'Class Score', max: caW },
                                  { name: 'Exam', max: exW },
                                ]
                          const totalMax = scoreCols.reduce((sum, c) => sum + c.max, 0) || 100
                          const showPos = el.style?.showPosition !== false
                          const showRem = el.style?.showRemark !== false
                          const showAvg = el.style?.showClassAvg !== false
                          const hdrBg = (el.style?.headerBg as string) || '#f1f5f9'
                          const hdrColor = (el.style?.headerColor as string) || '#0f172a'
                          const tblBorder = (el.style?.borderColor as string) || '#cbd5e1'
                          const customRows = el.style?.customSubjects as CustomSubjectEntry[] | undefined
                          const subjList =
                            customRows && customRows.length > 0
                              ? customRows.map((r) => r.subject)
                              : ((el.style?.subjects as string[]) || SAMPLE_SUBJECTS.map((s) => s.name))
                          const renderedRows = subjList.slice(0, 8).map((subj, i) => {
                            const base = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]
                            const customRow = customRows?.[i]
                            const colScores = scoreCols.map((col, ci) => {
                              if (customRow?.partScores?.[ci] !== undefined) return Number(customRow.partScores[ci])
                              if (examMarkParts.length === 0) {
                                if (ci === 0 && customRow?.classScore !== undefined) return Number(customRow.classScore)
                                if (ci === 1 && customRow?.examScore !== undefined) return Number(customRow.examScore)
                              }
                              const ratio = ci === scoreCols.length - 1 ? base.exam / 70 : base.ca / 30
                              return Math.round(col.max * Math.min(0.98, Math.max(0.45, ratio)) * 10) / 10
                            })
                            const total = Math.round(colScores.reduce((sum, v) => sum + v, 0) * 10) / 10
                            const pct = Math.round((total / totalMax) * 100)
                            return { subj, colScores, total, pct }
                          })
                          return <div key={el.id} className="reportsheet-paper" data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, background: '#fff', color: '#0f172a', fontSize: 9, flexDirection: 'column', gap: 0, padding: 0, overflow: isSingleSel ? 'visible' : 'hidden' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                            {Array.isArray(el.style?.customColumns) && el.style.customColumns.length > 0 ? <CustomSubjectTable columns={el.style.customColumns as SubjectColumn[]} rows={renderedRows.map((r, i) => ({ subject: r.subj, colScores: r.colScores, total: r.total, position: String(i + 1), remarks: remarkOf(r.pct) }))} headerBg={hdrBg} headerColor={hdrColor} borderColor={tblBorder} sampleRows={el.style?.sampleTableRows as string[][] | undefined} sampleFooter={el.style?.sampleTableFooter as string[] | undefined} subjectCatalog={subjectOptions} useSubjectCatalog={el.style?.useSubjectCatalog === true} style={{ marginTop: 0 }} /> : (
<table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: hdrBg, color: hdrColor }}>
                                  <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: scoreCols.length >= 3 ? '26%' : '30%' }}>Subject</th>
                                  {scoreCols.map((col, ci) => (
                                    <th key={`${col.name}-${ci}`} style={{ textAlign: 'center', padding: '3px 4px', fontSize: 7.5, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}` }}>
                                      {examMarkParts.length > 0 ? `${col.name} (/${col.max})` : `${col.name} (${col.max}%)`}
                                    </th>
                                  ))}
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '14%' }}>
                                    {examMarkParts.length > 0 ? `Total (/${totalMax})` : 'Total'}
                                  </th>
                                  {showPos && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '8%' }}>Pos</th>}
                                  {showRem && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '15%' }}>Remark</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {renderedRows.map((r, i) => (
                                  <tr key={`${r.subj}-${i}`} style={{ background: '#ffffff', color: '#0f172a' }}>
                                    <td style={{ padding: '3px 4px', fontSize: 8, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{r.subj}</td>
                                    {r.colScores.map((sc, ci) => (
                                      <td key={ci} style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, background: '#ffffff', color: '#1e293b', border: `1px solid ${tblBorder}` }}>{sc}</td>
                                    ))}
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{r.total}</td>
                                    {showPos && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, background: '#ffffff', color: '#1e293b', border: `1px solid ${tblBorder}` }}>{i + 1}</td>}
                                    {showRem && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 600, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{remarkOf(r.pct)}</td>}
                                  </tr>
                                ))}
                                {showAvg && (
                                  <tr style={{ background: '#e8eef4', color: '#0f172a' }}>
                                    <td style={{ padding: '3px 4px', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>Class Avg</td>
                                    {scoreCols.map((_, ci) => (
                                      <td key={ci} style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>
                                        {renderedRows.length > 0 ? (renderedRows.reduce((s, r) => s + (r.colScores[ci] ?? 0), 0) / renderedRows.length).toFixed(1) : '—'}
                                      </td>
                                    ))}
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>
                                      {renderedRows.length > 0 ? (renderedRows.reduce((s, r) => s + r.total, 0) / renderedRows.length).toFixed(1) : '—'}
                                    </td>
                                    {showPos && <td style={{ padding: '3px 4px', background: '#e8eef4', border: `1px solid ${tblBorder}` }} />}
                                    {showRem && <td style={{ padding: '3px 4px', background: '#e8eef4', border: `1px solid ${tblBorder}` }} />}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            )}
                            {handleEls}{deleteBtn}
                          </div>
                        }
                        return <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={baseStyle} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                      })}
                      </div>
                    </div>

                    {/* Resize handles + Floating Quick-Edit Action Bar for selected single theme element */}
                    {editMode && selectedEl && selectedElements.length <= 1 && !selectedEl.id.startsWith('id_') && selectedElRect && !inlineEdit && (
                      <>
                        {!selectedEl.locked && (
                          (selectedEl.type === 'line' || selectedEl.type === 'divider'
                            ? ((selectedEl.style?.orientation as string) === 'vertical'
                                ? [
                                    { c: 'n', l: selectedElRect.left + selectedElRect.width / 2 - 5, t: selectedElRect.top - 5, cur: 'ns-resize', round: true },
                                    { c: 's', l: selectedElRect.left + selectedElRect.width / 2 - 5, t: selectedElRect.top + selectedElRect.height - 5, cur: 'ns-resize', round: true },
                                  ]
                                : [
                                    { c: 'w', l: selectedElRect.left - 5, t: selectedElRect.top + selectedElRect.height / 2 - 5, cur: 'ew-resize', round: true },
                                    { c: 'e', l: selectedElRect.left + selectedElRect.width - 5, t: selectedElRect.top + selectedElRect.height / 2 - 5, cur: 'ew-resize', round: true },
                                  ])
                            : [
                                { c: 'nw', l: selectedElRect.left - 4, t: selectedElRect.top - 4, cur: 'nwse-resize', round: false },
                                { c: 'n', l: selectedElRect.left + selectedElRect.width / 2 - 4, t: selectedElRect.top - 4, cur: 'ns-resize', round: false },
                                { c: 'ne', l: selectedElRect.left + selectedElRect.width - 4, t: selectedElRect.top - 4, cur: 'nesw-resize', round: false },
                                { c: 'e', l: selectedElRect.left + selectedElRect.width - 4, t: selectedElRect.top + selectedElRect.height / 2 - 4, cur: 'ew-resize', round: false },
                                { c: 'se', l: selectedElRect.left + selectedElRect.width - 4, t: selectedElRect.top + selectedElRect.height - 4, cur: 'nwse-resize', round: false },
                                { c: 's', l: selectedElRect.left + selectedElRect.width / 2 - 4, t: selectedElRect.top + selectedElRect.height - 4, cur: 'ns-resize', round: false },
                                { c: 'sw', l: selectedElRect.left - 4, t: selectedElRect.top + selectedElRect.height - 4, cur: 'nesw-resize', round: false },
                                { c: 'w', l: selectedElRect.left - 4, t: selectedElRect.top + selectedElRect.height / 2 - 4, cur: 'ew-resize', round: false },
                              ]
                          ).map((h) => (
                            <div
                              key={h.c}
                              data-resize-handle="1"
                              onMouseDown={(ev) => handleResizeMouseDown(ev, selectedEl, h.c as any)}
                              style={{
                                position: 'absolute',
                                left: h.l,
                                top: h.t,
                                width: h.round ? 10 : 8,
                                height: h.round ? 10 : 8,
                                background: '#ffffff',
                                border: h.round ? '2px solid #136ee5' : '1.5px solid #136ee5',
                                borderRadius: h.round ? '50%' : 2,
                                boxShadow: h.round ? '0 1px 4px rgba(15,23,42,0.22)' : undefined,
                                cursor: h.cur,
                                zIndex: 22,
                              }}
                            />
                          ))
                        )}
                        <div
                          data-resize-handle="1"
                          data-report-popup="true"
                          onMouseDown={(ev) => ev.stopPropagation()}
                          onClick={(ev) => ev.stopPropagation()}
                          style={{
                            position: 'absolute',
                            left: Math.max(4, Math.min(selectedElRect.left, 560 * zoom - 320)),
                            top: selectedElRect.top > 30 ? selectedElRect.top - 28 : selectedElRect.top + selectedElRect.height + 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '2px 6px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(15,23,42,0.28)',
                            zIndex: 25,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ opacity: 0.85, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedEl.label}</span>
                          <button
                            type="button"
                            onClick={() => setMultiSelectMode((m) => !m)}
                            style={{ background: multiSelectMode ? '#2563eb' : '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            Select Multiple
                          </button>
                          <button
                            type="button"
                            onClick={() => copySelectedElements([selectedEl.id])}
                            title="Copy element to clipboard (Ctrl+C) — switch theme and Paste"
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            Copy
                          </button>
                          <div data-report-popup="true" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setFloatingCopyToThemeOpen((o) => !o)}
                              title="Copy this element directly to another Reportsheet Theme"
                              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            >
                              → Theme ▾
                            </button>
                            {floatingCopyToThemeOpen && (
                              <div
                                data-report-popup="true"
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 'calc(100% + 4px)',
                                  minWidth: 132,
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: 6,
                                  padding: 3,
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                                  zIndex: 40,
                                }}
                              >
                                {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                                  <button
                                    key={th.id}
                                    type="button"
                                    onClick={() => copySelectionToTheme(th, [selectedEl.id])}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 6px',
                                      background: 'transparent',
                                      border: 'none',
                                      borderRadius: 4,
                                      color: '#f8fafc',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: th.accentColor, flexShrink: 0 }} />
                                    <span>{th.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {(selectedEl.type === 'line' || selectedEl.type === 'divider') && (
                            <button
                              type="button"
                              onClick={() => setCurrentView('style')}
                              style={{ background: '#136ee5', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            >
                              Line Style
                            </button>
                          )}
                          {(selectedEl.type === 'text' || selectedEl.type === 'header' || selectedEl.type === 'signature') && (
                            <button
                              type="button"
                              onClick={() => {
                                const domEl = canvasRef.current?.querySelector(`[data-element-id="${selectedEl.id}"]`) as HTMLElement | null
                                if (domEl) {
                                  const cur = selectedEl.type === 'signature'
                                    ? (selectedEl.caption ?? (domEl.innerText || '').trim())
                                    : (selectedEl.text !== undefined ? selectedEl.text : (domEl.innerText || '').trim())
                                  openInlineEditorForDomElement('element', selectedEl.id, selectedEl.label, domEl, cur)
                                }
                              }}
                              style={{ background: '#136ee5', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            >
                              Edit
                            </button>
                          )}
                          {(selectedEl.type === 'image' || selectedEl.type === 'logo' || selectedEl.type === 'signature') && (
                            <button
                              type="button"
                              onClick={() => triggerElementImageUpload(selectedEl.id)}
                              style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            >
                              Upload
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteElement(selectedEl.id)}
                            title="Hide element"
                            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}

                    {/* Unified Multi-Selection / Group Bounding Box + Floating Group/Ungroup Action Bar */}
                    {editMode && selectedElements.length >= 2 && multiSelectRect && !inlineEdit && (
                      <>
                        <div
                          style={{
                            position: 'absolute',
                            left: multiSelectRect.left,
                            top: multiSelectRect.top,
                            width: multiSelectRect.width,
                            height: multiSelectRect.height,
                            border: isSingleCompleteGroup ? '2px dashed #7c3aed' : '1.5px dashed #136ee5',
                            background: isSingleCompleteGroup ? 'rgba(124, 58, 237, 0.04)' : 'rgba(19, 110, 229, 0.04)',
                            borderRadius: 6,
                            pointerEvents: 'none',
                            zIndex: 21,
                          }}
                        />
                        <div
                          data-resize-handle="1"
                          onMouseDown={handleMultiSelectionBarMouseDown}
                          onClick={(ev) => ev.stopPropagation()}
                          title="Drag bar or any selected element to move together"
                          style={{
                            position: 'absolute',
                            left: Math.max(4, Math.min(multiSelectRect.left, 560 * zoom - 290)),
                            top: multiSelectRect.top > 32 ? multiSelectRect.top - 30 : multiSelectRect.top + multiSelectRect.height + 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            boxShadow: '0 4px 14px rgba(15,23,42,0.32)',
                            zIndex: 26,
                            whiteSpace: 'nowrap',
                            cursor: 'move',
                          }}
                        >
                          <span
                            style={{
                              background: isSingleCompleteGroup ? '#7c3aed' : '#2563eb',
                              padding: '1px 6px',
                              borderRadius: 999,
                              fontSize: 9.5,
                              fontWeight: 700,
                            }}
                          >
                            {isSingleCompleteGroup ? `Group · ${selectedObjects.length}` : `${selectedObjects.length} Selected`}
                          </span>
                          {canGroupSelection && (
                            <button
                              type="button"
                              onClick={groupSelectedElements}
                              style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                            >
                              Group
                            </button>
                          )}
                          {canUngroupSelection && (
                            <button
                              type="button"
                              onClick={ungroupSelectedElements}
                              style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                            >
                              Ungroup
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => copySelectedElements()}
                            title="Copy selected elements to clipboard (Ctrl+C) — switch theme and Paste"
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            Copy
                          </button>
                          <div data-report-popup="true" style={{ position: 'relative' }}>
                            <button
                              type="button"
                              onClick={() => setFloatingCopyToThemeOpen((o) => !o)}
                              title="Copy selected elements directly to another theme"
                              style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                            >
                              → Theme ▾
                            </button>
                            {floatingCopyToThemeOpen && (
                              <div
                                data-report-popup="true"
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 'calc(100% + 4px)',
                                  minWidth: 132,
                                  background: '#0f172a',
                                  border: '1px solid #334155',
                                  borderRadius: 6,
                                  padding: 3,
                                  boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                                  zIndex: 40,
                                }}
                              >
                                {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                                  <button
                                    key={th.id}
                                    type="button"
                                    onClick={() => copySelectionToTheme(th)}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '4px 6px',
                                      background: 'transparent',
                                      border: 'none',
                                      borderRadius: 4,
                                      color: '#f8fafc',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: th.accentColor, flexShrink: 0 }} />
                                    <span>{th.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => duplicateSelectedElements()}
                            style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            onClick={deleteSelectedElements}
                            title="Delete / Hide selected"
                            style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}

                    {/* Marquee selection box + live count badge */}
                    {marquee && (marquee.w > 2 || marquee.h > 2) && (
                      <div
                        style={{
                          position: 'absolute',
                          left: marquee.x * zoom,
                          top: marquee.y * zoom,
                          width: marquee.w * zoom,
                          height: marquee.h * zoom,
                          border: '1.5px dashed #2563eb',
                          background: 'rgba(37, 99, 235, 0.10)',
                          borderRadius: 3,
                          boxShadow: '0 0 0 1px rgba(255,255,255,0.45)',
                          pointerEvents: 'none',
                          zIndex: 35,
                        }}
                      >
                        {(marquee.w * zoom > 28 || marquee.h * zoom > 24) && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: marquee.y * zoom > 24 ? -22 : marquee.h * zoom + 4,
                              background: marqueePreviewIds.length > 0 ? '#2563eb' : '#334155',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.25)',
                            }}
                          >
                            {marqueePreviewIds.length > 0
                              ? `${marqueePreviewIds.length} element${marqueePreviewIds.length === 1 ? '' : 's'}`
                              : 'Drag across elements'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Insertion Cursor, Hover Crosshair, Palette Drop Preview & Smart Snap Guides */}
                    {renderCanvasPositioningOverlays()}

                    {/* Inline On-Canvas Text / Table-Cell Editor */}
                    {inlineEdit && (
                      <div
                        data-inline-editor="1"
                        onMouseDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => ev.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: inlineEdit.rect.left,
                          top: inlineEdit.rect.top,
                          width: Math.min(inlineEdit.rect.width, 560 * zoom - inlineEdit.rect.left - 4),
                          minHeight: inlineEdit.rect.height,
                          zIndex: 40,
                        }}
                      >
                        {inlineEdit.multiline ? (
                          <textarea
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(ev) => setInlineEdit((cur) => (cur ? { ...cur, value: ev.target.value } : null))}
                            onBlur={commitInlineEdit}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Escape') {
                                ev.preventDefault()
                                setInlineEdit(null)
                              } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
                                ev.preventDefault()
                                commitInlineEdit()
                              }
                            }}
                            style={{
                              width: '100%',
                              minHeight: Math.max(44, inlineEdit.rect.height),
                              padding: '3px 6px',
                              fontSize: Math.max(11, Math.round(11 * zoom)),
                              fontFamily: 'Inter, sans-serif',
                              color: '#0f172a',
                              background: '#ffffff',
                              border: '2px solid #136ee5',
                              borderRadius: 4,
                              boxShadow: '0 6px 20px rgba(19,110,229,0.25)',
                              outline: 'none',
                              resize: 'both',
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(ev) => setInlineEdit((cur) => (cur ? { ...cur, value: ev.target.value } : null))}
                            onBlur={commitInlineEdit}
                            onKeyDown={(ev) => {
                              if (ev.key === 'Escape') {
                                ev.preventDefault()
                                setInlineEdit(null)
                              } else if (ev.key === 'Enter') {
                                ev.preventDefault()
                                commitInlineEdit()
                              }
                            }}
                            style={{
                              width: '100%',
                              height: Math.max(24, inlineEdit.rect.height),
                              padding: '2px 6px',
                              fontSize: Math.max(11, Math.round(11 * zoom)),
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: 600,
                              color: '#0f172a',
                              background: '#ffffff',
                              border: '2px solid #136ee5',
                              borderRadius: 4,
                              boxShadow: '0 6px 20px rgba(19,110,229,0.25)',
                              outline: 'none',
                            }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview (interactive canvas) */}
          {step === 2 && (
            <div className="bg-slate-50 dark:bg-zinc-800" style={{ padding: '32px 28px' }}>
              {reportType === 'CGPA' && (
                <div data-canvas-toolbar="1" style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>CGPA calculation preview</h3>
                  <p style={{ fontSize: 12, color: 'var(--mist)', marginBottom: 10 }}>Select a student and academic period to calculate real results. This preview is separate from the editable report canvas and does not automatically populate or print its sample fields.</p>
                  <GpaEnginePage records={records} />
                </div>
              )}
              <div data-canvas-toolbar="1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Back to Report Builder"
                    className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-mist hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-700"
                  >
                    <ArrowLeft className="size-3 inline mr-1" /> Back
                  </button>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Live Preview</h3>
                    <p style={{ fontSize: 13, color: 'var(--mist)' }}>
                      Drag &amp; hold on canvas to select multiple · Hold an element to add · Group &amp; move together · Double-click text/cells to edit
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 220 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--mist)', whiteSpace: 'nowrap' }}>
                      Exam Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <Select
                      value={examName}
                      onChange={(e) => handleExamNameChange(e.target.value)}
                      placeholder="Select…"
                      aria-label="Exam Name"
                    >
                      <option value="">Select exam…</option>
                      {examNameList.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </Select>
                  </div>
                  {examMarkParts.length > 0 && (
                    <span
                      title={`Subject Table columns from Exam Setup Mark Distribution: ${examMarkParts.map((p) => `${p.name} (/${p.max})`).join(', ')}`}
                      className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                    >
                      {examMarkParts.map((p) => `${p.name} (/${p.max})`).join(' · ')}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handlePublishTheme}
                    title={`Publish current canvas design as ${nextPublishedThemeName} in Reportsheet Theme and add as Published in Report Builder`}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    <Palette className="size-3 inline mr-1" /> Publish Theme
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCursorMode((m) => !m)
                      setHoverCursorPoint(null)
                    }}
                    title="Place or reposition the Insertion Cursor anywhere on the canvas"
                    className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                      cursorMode
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                        : insertionPoint
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                          : 'border-line bg-white text-mist hover:border-emerald-500 hover:text-emerald-600 dark:bg-zinc-900'
                    }`}
                  >
                    <Crosshair className="size-3 inline mr-1" />
                    {cursorMode
                      ? 'Click Canvas…'
                      : insertionPoint
                        ? `Cursor (${insertionPoint.x}, ${insertionPoint.y})`
                        : 'Insert Cursor'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnapEnabled((s) => !s)}
                    title="Toggle smart alignment guides & 4px grid snapping"
                    className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                      snapEnabled
                        ? 'border-pink-500/40 bg-pink-500/10 text-pink-700 hover:bg-pink-500/20 dark:text-pink-300'
                        : 'border-line bg-white text-mist hover:border-pink-400 dark:bg-zinc-900'
                    }`}
                  >
                    Snap: {snapEnabled ? 'ON' : 'OFF'}
                  </button>
                  {(selectedObjects.length > 0 || selectedElement) && insertionPoint && (
                    <button
                      type="button"
                      onClick={() => moveSelectionToInsertionPoint(insertionPoint)}
                      title={`Move selected element(s) to Insertion Cursor (${insertionPoint.x}, ${insertionPoint.y})`}
                      className="rounded border border-emerald-500/50 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      <MapPin className="size-3 inline mr-1" /> Move to Cursor
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMultiSelectMode((m) => !m)}
                    className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${
                      multiSelectMode
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                        : 'border-line bg-white text-mist hover:border-blue-500 hover:text-blue-600 dark:bg-zinc-900'
                    }`}
                  >
                    <Check className="size-3 inline mr-1" />
                    {multiSelectMode ? `Select Multiple (${selectedObjects.length})` : 'Select Multiple'}
                  </button>
                  {canGroupSelection && (
                    <button
                      type="button"
                      onClick={groupSelectedElements}
                      style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <Layers className="size-3 inline mr-1" /> Group ({selectedObjects.length})
                    </button>
                  )}
                  {canUngroupSelection && (
                    <button
                      type="button"
                      onClick={ungroupSelectedElements}
                      className="rounded border border-purple-500/50 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300"
                    >
                      Ungroup
                    </button>
                  )}
                  {(selectedObjects.length > 0 || selectedElement) && (
                    <button
                      type="button"
                      onClick={() => copySelectedElements()}
                      title="Copy selected element(s) to clipboard (Ctrl+C)"
                      className="rounded border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                    >
                      <Copy className="size-3 inline mr-1" /> Copy
                    </button>
                  )}
                  {themeClipboard && themeClipboard.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => pasteCopiedElements()}
                      title={`Paste ${themeClipboard.items.length} copied element(s) from ${themeClipboard.sourceThemeName} (Ctrl+V)`}
                      style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    >
                      <ClipboardPaste className="size-3 inline mr-1" /> Paste ({themeClipboard.items.length})
                    </button>
                  )}
                  {(selectedObjects.length > 0 || selectedElement) && (
                    <div data-report-popup="true" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setCopyToThemeMenuOpen((o) => !o)}
                        title="Copy selected element(s) directly onto another Reportsheet Theme"
                        className="rounded border border-indigo-500/40 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300"
                      >
                        Copy to Theme ▾
                      </button>
                      {copyToThemeMenuOpen && (
                        <div
                          data-report-popup="true"
                          className="bg-white dark:bg-zinc-900"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            minWidth: 196,
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            boxShadow: '0 10px 24px rgba(15, 23, 42, 0.22)',
                            padding: 4,
                            zIndex: 60,
                          }}
                        >
                          <div style={{ padding: '4px 8px', fontSize: 10, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase' }}>
                            Send Selection To
                          </div>
                          {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                            <button
                              key={th.id}
                              type="button"
                              onClick={() => copySelectionToTheme(th)}
                              className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: th.accentColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)', flex: 1 }}>{th.name}</span>
                              <ArrowRight className="size-3 text-mist" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {(selectedObjects.length > 0 || selectedElement) && (
                    <button
                      type="button"
                      onClick={() => duplicateSelectedElements()}
                      className="rounded border border-line bg-white px-2.5 py-1 text-xs font-medium text-mist hover:bg-slate-100 dark:bg-zinc-900 dark:hover:bg-zinc-700"
                    >
                      Duplicate
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive canvas */}
              <div style={{ display: 'flex', gap: 24 }}>
                {/* Canvas */}
                <div
                  onMouseDown={handleWorkspaceMouseDown}
                  onClick={handleWorkspaceClick}
                  style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'auto', padding: '12px 16px', userSelect: 'none' }}
                >
                  <style>{`
                    [data-element-id] { cursor: ${cursorMode ? 'crosshair' : 'pointer'}; user-select: none; }
                    ${selectedObjects.filter((ce) => !ce.id.startsWith('id_')).map((ce) => `[data-element-id="${ce.id}"] { outline: 2px solid ${ce.groupId ? '#7c3aed' : '#136ee5'} !important; outline-offset: 1px; }`).join('\n')}
                    ${marqueePreviewIds.filter((id) => !id.startsWith('id_')).map((id) => `[data-element-id="${id}"] { outline: 2px solid #2563eb !important; outline-offset: 2px; background-color: rgba(37, 99, 235, 0.07); border-radius: 2px; }`).join('\n')}
                  `}</style>
                  <div style={{ position: 'relative', width: 560 * zoom, height: 780 * zoom, margin: canvasSettings.showRuler ? '24px auto 0' : '0 auto', userSelect: 'none' }}>
                    {canvasSettings.showRuler && <CanvasRulers zoom={zoom} />}
                    <div
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      onDoubleClick={handleCanvasDoubleClick}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseLeave={() => setHoverCursorPoint(null)}
                      onContextMenu={handleCanvasContextMenu}
                      onDragStart={(e) => { if (!draggingField) e.preventDefault() }}
                      onDragOver={handleCanvasDragOver}
                      onDragLeave={handleCanvasDragLeave}
                      onDrop={handleCanvasDrop}
                      style={{
                        background: certificateColor || '#fff', borderRadius: 8,
                        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                        width: 560 * zoom, height: 780 * zoom,
                        position: 'relative', overflow: 'hidden',
                        border: '1px solid #d1d5db',
                        userSelect: 'none',
                        cursor: cursorMode ? 'crosshair' : undefined,
                      }}
                    >
                      {canvasSettings.showGrid && <CanvasGrid zoom={zoom} />}
                      {/* Render the actual theme renderer — handles all 6 themes declaratively */}
                      <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 560, height: 780, position: 'relative' }}
                        onDragOver={handleCanvasDragOver}
                        onDrop={handleCanvasDrop}
                      >
                        {!canvasSettings.blankForm && <ReportsheetSheetRenderer
                          key={previewTheme?.id || 'theme-1'}
                          themeId={previewTheme?.id || 'theme-1'}
                          schoolName={canvasSettings.schoolName}
                          schoolAddress={canvasSettings.schoolAddress}
                          examName={examName || canvasSettings.examName || canvasSettings.reportTitle || reportName || 'First Term Examination'}
                          academicYear={canvasSettings.academicYear || '2026/2027'}
                          termLabel={canvasSettings.term || '1'}
                          reportOptions={JSON.stringify(reportOptions)}
                          topSpace={String(canvasSettings.marginTop)}
                          bottomSpace={String(canvasSettings.marginBottom)}
                          leftSpace={String(canvasSettings.marginLeft)}
                          rightSpace={String(canvasSettings.marginRight)}
                          logoDataUrl={canvasSettings.schoolLogo || undefined}
                          parts={examMarkParts.length > 0 ? examMarkParts : undefined}
                          subjects={tableEl?.style?.subjects as string[] | undefined}
                          customSubjects={tableEl?.style?.customSubjects as CustomSubjectEntry[] | undefined}
                          subjectCatalog={subjectOptions}
                          elementOverrides={elementOverrides}
                          caWeight={(tableEl?.style?.caWeight as number) ?? 30}
                          examWeight={(tableEl?.style?.examWeight as number) ?? 70}
                          showPosition={tableEl?.style?.showPosition !== false}
                          showGrade={tableEl?.style?.showGrade !== false}
                          showRemark={tableEl?.style?.showRemark !== false}
                          showClassAvg={tableEl?.style?.showClassAvg !== false}
                          showSubjectAvg={tableEl?.style?.showSubjectAvg !== false}
                          renderPublishedOverlays={false}
                        />}

                        {/* Render drag-added elements as absolutely positioned boxes */}
                        {canvasElements.filter(el => el.id.startsWith('id_')).map(el => {
                          const isSel = selectedElements.includes(el.id) || selectedElement === el.id
                          const isInMarquee = marqueePreviewIds.includes(el.id)
                          const selBorderColor = isInMarquee ? '#2563eb' : (el.groupId ? '#7c3aed' : '#136ee5')
                          const s = el.style || {}
                          const isLineLike = el.type === 'line' || el.type === 'divider'
                          const isVertLine = (s.orientation as string) === 'vertical'
                          const customBw = Number(s.borderWidth) || 0
                          const customBs = (s.borderStyle as string) || 'solid'
                          const customBc = (s.borderColor as string) || '#94a3b8'
                          const hasCustomBorder = !isLineLike && customBw > 0 && customBs !== 'none'
                          const baseStyle: React.CSSProperties = {
                            position: 'absolute',
                            left: el.x,
                            top: el.y,
                            width: el.width,
                            height: el.height,
                            cursor: cursorMode ? 'crosshair' : el.locked ? 'default' : 'move',
                            userSelect: 'none',
                            border: isLineLike
                              ? ((isSel || isInMarquee) ? `1px dashed ${selBorderColor}` : 'none')
                              : hasCustomBorder
                                ? `${customBw}px ${customBs} ${customBc}`
                                : ((isSel || isInMarquee) ? `2px solid ${selBorderColor}` : 'none'),
                            outline: hasCustomBorder && (isSel || isInMarquee) ? `2px solid ${selBorderColor}` : undefined,
                            outlineOffset: hasCustomBorder && (isSel || isInMarquee) ? 2 : undefined,
                            boxShadow: isInMarquee ? '0 0 0 3px rgba(37, 99, 235, 0.16)' : undefined,
                            borderRadius: isLineLike ? 2 : ((s.radius as number) ?? 4),
                            background: isLineLike ? 'transparent' : (s.bg === 'transparent' ? 'transparent' : ((s.bg as string) || 'rgba(255,255,255,0.92)')),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isLineLike
                              ? 'center'
                              : (s.align === 'left' ? 'flex-start' : s.align === 'right' ? 'flex-end' : 'center'),
                            textAlign: (s.align as React.CSSProperties['textAlign']) || 'center',
                            fontFamily: (s.fontFamily as string) || undefined,
                            fontSize: (s.fontSize as number) ?? 12,
                            fontWeight: s.bold ? 700 : undefined,
                            fontStyle: s.italic ? 'italic' : undefined,
                            textDecoration: s.underline ? 'underline' : undefined,
                            letterSpacing: (s.letterSpacing as string) || undefined,
                            textTransform: (s.textTransform as React.CSSProperties['textTransform']) || undefined,
                            color: (s.color as string) || '#1e293b',
                            padding: isLineLike ? 0 : ((s.padding as number) ?? 4),
                            overflow: isLineLike ? 'visible' : 'hidden',
                            transform: isLineLike && (s.rotation as number) ? `rotate(${s.rotation}deg)` : undefined,
                            zIndex: 10,
                          }
                          if (isLineLike) {
                            const lineThickness = (s.lineThickness as number) ?? 2
                            const lineStyle = (s.lineStyle as string) || 'solid'
                            const lineColor = (s.bg as string) || (el.type === 'line' ? '#1e293b' : '#94a3b8')
                            return (
                              <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={baseStyle} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                                <div
                                  style={
                                    isVertLine
                                      ? { width: 0, height: '100%', borderLeft: `${lineThickness}px ${lineStyle} ${lineColor}`, pointerEvents: 'none' }
                                      : { width: '100%', height: 0, borderTop: `${lineThickness}px ${lineStyle} ${lineColor}`, pointerEvents: 'none' }
                                  }
                                />
                              </div>
                            )
                          }
                          if (el.type === 'custom_heading') {
                            return <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, fontSize: (s.fontSize as number) ?? 16, fontWeight: 700 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}</div>
                          }
                          if (el.type === 'image' || el.type === 'logo') {
                            const resolvedImgSrc = el.imageSrc || (el.field === 'school_logo' ? canvasSettings.schoolLogo : undefined)
                            return (
                              <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, background: resolvedImgSrc ? 'transparent' : '#f1f5f9', border: resolvedImgSrc ? baseStyle.border : ((isSel || isInMarquee) ? `2px solid ${selBorderColor}` : '1px dashed #94a3b8'), color: '#64748b', fontSize: 10 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                                {resolvedImgSrc ? <img src={resolvedImgSrc} alt={el.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : el.label}
                              </div>
                            )
                          }
                          if (el.type === 'signature') {
                            const sigColor = (s.color as string) || '#1e293b'
                            const sigCaption = el.caption ?? el.text ?? el.label
                            return (
                              <div
                                key={el.id}
                                data-canvas-element="1"
                                data-custom-id={el.id}
                                style={{ ...baseStyle, flexDirection: 'column', justifyContent: 'center', gap: 2 }}
                                onMouseDown={(e) => handleElementMouseDown(e, el)}
                              >
                                {el.imageSrc ? (
                                  <img src={el.imageSrc} alt={sigCaption} draggable={false} style={{ maxHeight: Math.max(16, el.height - 16), objectFit: 'contain' }} />
                                ) : (
                                  <svg width="78" height="22" viewBox="0 0 96 28" fill="none" style={{ pointerEvents: 'none', flexShrink: 0 }}>
                                    <path d="M8 22C16 9 22 6 24 14C26 21 31 8 38 12C44 16 48 9 56 15C63 20 74 11 88 13" stroke={sigColor} strokeWidth="1.6" strokeLinecap="round" />
                                  </svg>
                                )}
                                <div style={{ width: '82%', borderTop: '1px solid #64748b', paddingTop: 2, textAlign: 'center', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em', color: sigColor }}>
                                  {sigCaption}
                                </div>
                              </div>
                            )
                          }
                          if (el.type === 'table') {
                            const caW = (el.style?.caWeight as number) ?? 30
                            const exW = (el.style?.examWeight as number) ?? 70
                            const scoreCols: MarkPart[] =
                              examMarkParts.length > 0
                                ? examMarkParts
                                : [
                                    { name: 'Class Score', max: caW },
                                    { name: 'Exam', max: exW },
                                  ]
                            const totalMax = scoreCols.reduce((sum, c) => sum + c.max, 0) || 100
                            const showPos = el.style?.showPosition !== false
                            const showRem = el.style?.showRemark !== false
                            const showAvg = el.style?.showClassAvg !== false
                            const hdrBg = (el.style?.headerBg as string) || '#f1f5f9'
                            const hdrColor = (el.style?.headerColor as string) || '#0f172a'
                            const tblBorder = (el.style?.borderColor as string) || '#cbd5e1'
                            const customRows = el.style?.customSubjects as CustomSubjectEntry[] | undefined
                            const subjList =
                              customRows && customRows.length > 0
                                ? customRows.map((r) => r.subject)
                                : ((el.style?.subjects as string[]) || SAMPLE_SUBJECTS.map((sub) => sub.name))
                            const renderedRows = subjList.slice(0, 8).map((subj, i) => {
                              const base = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]
                              const customRow = customRows?.[i]
                              const colScores = scoreCols.map((col, ci) => {
                                if (customRow?.partScores?.[ci] !== undefined) return Number(customRow.partScores[ci])
                                if (examMarkParts.length === 0) {
                                  if (ci === 0 && customRow?.classScore !== undefined) return Number(customRow.classScore)
                                  if (ci === 1 && customRow?.examScore !== undefined) return Number(customRow.examScore)
                                }
                                const ratio = ci === scoreCols.length - 1 ? base.exam / 70 : base.ca / 30
                                return Math.round(col.max * Math.min(0.98, Math.max(0.45, ratio)) * 10) / 10
                              })
                              const total = Math.round(colScores.reduce((sum, v) => sum + v, 0) * 10) / 10
                              const pct = Math.round((total / totalMax) * 100)
                              return { subj, colScores, total, pct }
                            })
                            return (
                              <div key={el.id} className="reportsheet-paper" data-canvas-element="1" data-custom-id={el.id} style={{ ...baseStyle, background: '#fff', color: '#0f172a', fontSize: 9, flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                                {Array.isArray(el.style?.customColumns) && el.style.customColumns.length > 0 ? <CustomSubjectTable columns={el.style.customColumns as SubjectColumn[]} rows={renderedRows.map((r, i) => ({ subject: r.subj, colScores: r.colScores, total: r.total, position: String(i + 1), remarks: remarkOf(r.pct) }))} headerBg={hdrBg} headerColor={hdrColor} borderColor={tblBorder} sampleRows={el.style?.sampleTableRows as string[][] | undefined} sampleFooter={el.style?.sampleTableFooter as string[] | undefined} subjectCatalog={subjectOptions} useSubjectCatalog={el.style?.useSubjectCatalog === true} style={{ marginTop: 0 }} /> : (
<table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ background: hdrBg, color: hdrColor }}>
                                      <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: scoreCols.length >= 3 ? '26%' : '30%' }}>Subject</th>
                                      {scoreCols.map((col, ci) => (
                                        <th key={`${col.name}-${ci}`} style={{ textAlign: 'center', padding: '3px 4px', fontSize: 7.5, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}` }}>
                                          {examMarkParts.length > 0 ? `${col.name} (/${col.max})` : `${col.name} (${col.max}%)`}
                                        </th>
                                      ))}
                                      <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '14%' }}>
                                        {examMarkParts.length > 0 ? `Total (/${totalMax})` : 'Total'}
                                      </th>
                                      {showPos && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '8%' }}>Pos</th>}
                                      {showRem && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, background: hdrBg, color: hdrColor, border: `1px solid ${tblBorder}`, width: '15%' }}>Remark</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {renderedRows.map((r, i) => (
                                      <tr key={`${r.subj}-${i}`} style={{ background: '#ffffff', color: '#0f172a' }}>
                                        <td style={{ padding: '3px 4px', fontSize: 8, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{r.subj}</td>
                                        {r.colScores.map((sc, ci) => (
                                          <td key={ci} style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, background: '#ffffff', color: '#1e293b', border: `1px solid ${tblBorder}` }}>{sc}</td>
                                        ))}
                                        <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{r.total}</td>
                                        {showPos && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, background: '#ffffff', color: '#1e293b', border: `1px solid ${tblBorder}` }}>{i + 1}</td>}
                                        {showRem && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 600, background: '#ffffff', color: '#0f172a', border: `1px solid ${tblBorder}` }}>{remarkOf(r.pct)}</td>}
                                      </tr>
                                    ))}
                                    {showAvg && (
                                      <tr style={{ background: '#e8eef4', color: '#0f172a' }}>
                                        <td style={{ padding: '3px 4px', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>Class Avg</td>
                                        {scoreCols.map((_, ci) => (
                                          <td key={ci} style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>
                                            {renderedRows.length > 0 ? (renderedRows.reduce((acc, r) => acc + (r.colScores[ci] ?? 0), 0) / renderedRows.length).toFixed(1) : '—'}
                                          </td>
                                        ))}
                                        <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, background: '#e8eef4', color: '#0f172a', border: `1px solid ${tblBorder}` }}>
                                          {renderedRows.length > 0 ? (renderedRows.reduce((acc, r) => acc + r.total, 0) / renderedRows.length).toFixed(1) : '—'}
                                        </td>
                                        {showPos && <td style={{ padding: '3px 4px', background: '#e8eef4', border: `1px solid ${tblBorder}` }} />}
                                        {showRem && <td style={{ padding: '3px 4px', background: '#e8eef4', border: `1px solid ${tblBorder}` }} />}
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                            )}
                              </div>
                            )
                          }
                          return <div key={el.id} data-canvas-element="1" data-custom-id={el.id} style={baseStyle} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}</div>
                        })}
                      </div>
                    </div>

                    {/* Multi-Selection / Group Bounding Box + Floating Action Bar in Step 2 */}
                    {selectedElements.length >= 2 && multiSelectRect && !inlineEdit && (
                      <>
                        <div
                          style={{
                            position: 'absolute',
                            left: multiSelectRect.left,
                            top: multiSelectRect.top,
                            width: multiSelectRect.width,
                            height: multiSelectRect.height,
                            border: isSingleCompleteGroup ? '2px dashed #7c3aed' : '1.5px dashed #136ee5',
                            background: isSingleCompleteGroup ? 'rgba(124, 58, 237, 0.04)' : 'rgba(19, 110, 229, 0.04)',
                            borderRadius: 6,
                            pointerEvents: 'none',
                            zIndex: 21,
                          }}
                        />
                        <div
                          data-resize-handle="1"
                          onMouseDown={handleMultiSelectionBarMouseDown}
                          onClick={(ev) => ev.stopPropagation()}
                          style={{
                            position: 'absolute',
                            left: Math.max(4, Math.min(multiSelectRect.left, 560 * zoom - 290)),
                            top: multiSelectRect.top > 32 ? multiSelectRect.top - 30 : multiSelectRect.top + multiSelectRect.height + 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: 10,
                            fontWeight: 600,
                            boxShadow: '0 4px 14px rgba(15,23,42,0.32)',
                            zIndex: 26,
                            whiteSpace: 'nowrap',
                            cursor: 'move',
                          }}
                        >
                          <span style={{ background: isSingleCompleteGroup ? '#7c3aed' : '#2563eb', padding: '1px 6px', borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>
                            {isSingleCompleteGroup ? `Group · ${selectedObjects.length}` : `${selectedObjects.length} Selected`}
                          </span>
                          {canGroupSelection && (
                            <button type="button" onClick={groupSelectedElements} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                              Group
                            </button>
                          )}
                          {canUngroupSelection && (
                            <button type="button" onClick={ungroupSelectedElements} style={{ background: '#475569', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                              Ungroup
                            </button>
                          )}
                          <button type="button" onClick={copySelectedElements} title="Copy selected elements to clipboard (Ctrl+C)" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                            Copy
                          </button>
                          <button type="button" onClick={duplicateSelectedElements} style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 600 }}>
                            Duplicate
                          </button>
                          <button type="button" onClick={deleteSelectedElements} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>
                            ×
                          </button>
                        </div>
                      </>
                    )}

                    {/* Marquee selection box in Step 2 */}
                    {marquee && (marquee.w > 2 || marquee.h > 2) && (
                      <div
                        style={{
                          position: 'absolute',
                          left: marquee.x * zoom,
                          top: marquee.y * zoom,
                          width: marquee.w * zoom,
                          height: marquee.h * zoom,
                          border: '1.5px dashed #2563eb',
                          background: 'rgba(37, 99, 235, 0.10)',
                          borderRadius: 3,
                          pointerEvents: 'none',
                          zIndex: 35,
                        }}
                      >
                        {(marquee.w * zoom > 28 || marquee.h * zoom > 24) && (
                          <span
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: marquee.y * zoom > 24 ? -22 : marquee.h * zoom + 4,
                              background: marqueePreviewIds.length > 0 ? '#2563eb' : '#334155',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 8px rgba(15,23,42,0.25)',
                            }}
                          >
                            {marqueePreviewIds.length > 0
                              ? `${marqueePreviewIds.length} element${marqueePreviewIds.length === 1 ? '' : 's'}`
                              : 'Drag across elements'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Insertion Cursor, Hover Crosshair, Palette Drop Preview & Smart Snap Guides */}
                    {renderCanvasPositioningOverlays()}

                    {/* Inline On-Canvas Editor in Step 2 Preview */}
                    {inlineEdit && (
                      <div
                        data-inline-editor="1"
                        onMouseDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => ev.stopPropagation()}
                        style={{
                          position: 'absolute',
                          left: inlineEdit.rect.left,
                          top: inlineEdit.rect.top,
                          width: Math.min(inlineEdit.rect.width, 560 * zoom - inlineEdit.rect.left - 4),
                          minHeight: inlineEdit.rect.height,
                          zIndex: 40,
                        }}
                      >
                        <input
                          type="text"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(ev) => setInlineEdit((cur) => (cur ? { ...cur, value: ev.target.value } : null))}
                          onBlur={commitInlineEdit}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Escape') {
                              ev.preventDefault()
                              setInlineEdit(null)
                            } else if (ev.key === 'Enter') {
                              ev.preventDefault()
                              commitInlineEdit()
                            }
                          }}
                          style={{
                            width: '100%',
                            height: Math.max(24, inlineEdit.rect.height),
                            padding: '2px 6px',
                            fontSize: Math.max(11, Math.round(11 * zoom)),
                            fontWeight: 600,
                            color: '#0f172a',
                            background: '#ffffff',
                            border: '2px solid #136ee5',
                            borderRadius: 4,
                            boxShadow: '0 6px 20px rgba(19,110,229,0.25)',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}
                  </div>

                    {/* Zoom controls for preview */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 40 }}>
                      <span style={{ fontSize: 12, color: 'var(--mist)' }}>Zoom</span>
                      <button type="button" onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="rounded border border-line px-2 py-1 text-sm text-mist">–</button>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(zoom * 100)}%</span>
                      <button type="button" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="rounded border border-line px-2 py-1 text-sm text-mist">+</button>
                  </div>
              </div>
            </div>

              {/* Properties panel — shown when element is selected */}
              {selectedEl && (
                <div
                  className="bg-white dark:bg-zinc-900"
                  style={{
                    borderRadius: 8, padding: 20,
                    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                    maxWidth: 800, margin: '16px auto 0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#136ee5' }}>Edit {selectedEl.label}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!selectedEl.id.startsWith('id_') && (
                        <button
                          type="button"
                          onClick={() => resetThemeElement(selectedEl.id)}
                          className="rounded border border-line px-2 py-1 text-xs font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                        >
                          <RotateCcw className="size-3.5 inline mr-1" /> Reset
                        </button>
                      )}
                      <button type="button" onClick={() => setSelectedElement(null)} className="rounded p-1 text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Image / Signature upload in Step 2 */}
                  {(selectedEl.type === 'image' || selectedEl.type === 'logo' || selectedEl.type === 'signature') && (
                    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => triggerElementImageUpload(selectedEl.id)}
                        className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        <Upload className="size-3.5 inline mr-1" />
                        {selectedEl.imageSrc ? 'Replace Image' : 'Upload Image'}
                      </button>
                      {selectedEl.type === 'signature' && (
                        <Input
                          value={selectedEl.caption ?? liveSelectedText}
                          onChange={(e) => updateElement(selectedEl.id, { caption: e.target.value })}
                          placeholder="Signature caption…"
                        />
                      )}
                    </div>
                  )}

                  {/* Text Content */}
                  {(selectedEl.type === 'header' || selectedEl.type === 'text' || selectedEl.type === 'custom_text' || selectedEl.type === 'custom_heading') && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Text Content</label>
                      <Input
                        value={selectedEl.text !== undefined ? selectedEl.text : liveSelectedText}
                        onChange={(e) => updateElement(selectedEl.id, { text: e.target.value })}
                        placeholder="Enter text…"
                      />
                    </div>
                  )}

                  {/* Font controls */}
                  {(selectedEl.type === 'header' || selectedEl.type === 'text' || selectedEl.type === 'custom_text' || selectedEl.type === 'custom_heading') && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Font</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                        <Select
                          value={(selectedEl.style?.fontFamily as string) || 'Arial'}
                          onChange={(e) => updateStyle(selectedEl.id, 'fontFamily', e.target.value)}
                        >
                          <option value="Arial">Arial</option>
                          <option value="Verdana">Verdana</option>
                          <option value="Georgia">Georgia</option>
                          <option value="Times New Roman">Times New Roman</option>
                          <option value="Courier New">Courier New</option>
                        </Select>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            onClick={() => updateStyle(selectedEl.id, 'bold', !selectedEl.style?.bold)}
                            className={`rounded border px-2 py-1 text-xs ${selectedEl.style?.bold ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`}
                            style={{ fontWeight: 700 }}
                          >B</button>
                          <button
                            type="button"
                            onClick={() => updateStyle(selectedEl.id, 'italic', !selectedEl.style?.italic)}
                            className={`rounded border px-2 py-1 text-xs ${selectedEl.style?.italic ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`}
                            style={{ fontStyle: 'italic' }}
                          >I</button>
                          <button
                            type="button"
                            onClick={() => updateStyle(selectedEl.id, 'underline', !selectedEl.style?.underline)}
                            className={`rounded border px-2 py-1 text-xs ${selectedEl.style?.underline ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600' : 'border-line text-mist'}`}
                            style={{ textDecoration: 'underline' }}
                          >U</button>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Size</label>
                          <Input
                            type="number"
                            min={6}
                            max={72}
                            value={(selectedEl.style?.fontSize as number) ?? 12}
                            onChange={(e) => {
                              updateStyle(selectedEl.id, 'fontSize', Number(e.target.value))
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Color</label>
                          <ColorPicker value={(selectedEl.style?.color as string) || '#000000'} onChange={(v) => updateStyle(selectedEl.id, 'color', v)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Align</label>
                          <Select
                            value={(selectedEl.style?.align as string) || 'left'}
                            onChange={(e) => updateStyle(selectedEl.id, 'align', e.target.value)}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Line spacing</label>
                          <Input
                            type="number"
                            min={0.8}
                            max={3}
                            step={0.1}
                            value={(selectedEl.style?.lineHeight as number) ?? 1.2}
                            onChange={(e) => updateStyle(selectedEl.id, 'lineHeight', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Line & Divider Settings in Step 2 */}
                  {(selectedEl.type === 'line' || selectedEl.type === 'divider') && (() => {
                    const isThemeLine = !selectedEl.id.startsWith('id_')
                    const domLineNode = isThemeLine ? canvasRef.current?.querySelector(`[data-element-id="${selectedEl.id}"]`) : null
                    const parsedThick = parseFloat(domLineNode?.getAttribute('data-default-thickness') || '')
                    const defaultThickness =
                      !Number.isNaN(parsedThick) && parsedThick > 0
                        ? parsedThick
                        : (selectedEl.id === 'grading-scale-line' || selectedEl.id === 'footer-line' || (selectedEl.id === 'header-line' && previewTheme?.id === 'theme-4') ? 1 : 2)
                    const defaultColor =
                      domLineNode?.getAttribute('data-default-color') ||
                      (selectedEl.id === 'grading-scale-line' || selectedEl.id === 'footer-line'
                        ? '#e3e3dc'
                        : selectedEl.id === 'header-line'
                          ? (previewTheme?.id === 'theme-1' ? '#16325c' : previewTheme?.id === 'theme-4' ? '#475569' : previewTheme?.accentColor || '#16325c')
                          : '#1e293b')
                    const defaultLineStyle = domLineNode?.getAttribute('data-default-line-style') || 'solid'
                    const isVert = (selectedEl.style?.orientation as string) === 'vertical'
                    const thickness = (selectedEl.style?.lineThickness as number) ?? defaultThickness
                    const lineStyle = (selectedEl.style?.lineStyle as string) || defaultLineStyle
                    const rotation = (selectedEl.style?.rotation as number) ?? 0
                    const lengthVal =
                      isThemeLine && !selectedEl.style?.customSize && selectedElRect && zoom > 0
                        ? Math.round((isVert ? selectedElRect.height : selectedElRect.width) / zoom)
                        : (isVert ? selectedEl.height : selectedEl.width)
                    return (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          Line Settings
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Orientation</label>
                            <Select
                              value={isVert ? 'vertical' : 'horizontal'}
                              onChange={(e) => {
                                const nextOrient = e.target.value
                                const curLen = Math.max(lengthVal, 40)
                                const curCross = Math.max(12, Math.min(selectedEl.width, selectedEl.height, 24))
                                updateElement(selectedEl.id, {
                                  width: nextOrient === 'vertical' ? curCross : curLen,
                                  height: nextOrient === 'vertical' ? curLen : curCross,
                                  style: { ...selectedEl.style, orientation: nextOrient, ...(isThemeLine ? { customSize: true } : {}) },
                                })
                              }}
                            >
                              <option value="horizontal">Horizontal</option>
                              <option value="vertical">Vertical</option>
                            </Select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Line Style</label>
                            <Select value={lineStyle} onChange={(e) => updateStyle(selectedEl.id, 'lineStyle', e.target.value)}>
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                              <option value="double">Double</option>
                            </Select>
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Thickness (px)</label>
                            <Input
                              type="number"
                              min={0.5}
                              max={20}
                              step={0.5}
                              value={thickness}
                              onChange={(e) => updateStyle(selectedEl.id, 'lineThickness', Math.max(0.5, Math.min(20, Number(e.target.value) || 1)))}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Length (px)</label>
                            <Input
                              type="number"
                              min={10}
                              max={780}
                              value={lengthVal}
                              onChange={(e) => {
                                const nextLen = Math.max(10, Number(e.target.value) || 10)
                                updateElement(selectedEl.id, {
                                  ...(isVert ? { height: nextLen } : { width: nextLen }),
                                  ...(isThemeLine ? { style: { ...selectedEl.style, customSize: true } } : {}),
                                })
                              }}
                            />
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Line Color</label>
                            <ColorPicker value={(selectedEl.style?.bg as string) || defaultColor} onChange={(v) => updateStyle(selectedEl.id, 'bg', v)} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: 'var(--mist)' }}>Angle (°)</label>
                            <Input
                              type="number"
                              min={-180}
                              max={180}
                              value={rotation}
                              onChange={(e) => updateStyle(selectedEl.id, 'rotation', Number(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Fill color */}
                  {selectedEl.type !== 'line' && selectedEl.type !== 'divider' && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Fill color</label>
                      <div style={{ marginTop: 4 }}>
                        <ColorPicker value={(selectedEl.style?.bg as string) || '#ffffff'} onChange={(v) => updateStyle(selectedEl.id, 'bg', v)} />
                        <button
                          type="button"
                          onClick={() => updateStyle(selectedEl.id, 'bg', 'transparent')}
                          className="rounded border border-line px-2 py-1 text-xs text-mist hover:bg-slate-100 dark:hover:bg-zinc-800"
                          style={{ marginTop: 6 }}
                        >Transparent</button>
                      </div>
                    </div>
                  )}

                  {/* Border & spacing */}
                  {selectedEl.type !== 'divider' && selectedEl.type !== 'line' && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Border &amp; spacing</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Width (px)</label>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            value={(selectedEl.style?.borderWidth as number) ?? 0}
                            onChange={(e) => updateStyle(selectedEl.id, 'borderWidth', Number(e.target.value))}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Style</label>
                          <Select
                            value={(selectedEl.style?.borderStyle as string) || 'solid'}
                            onChange={(e) => updateStyle(selectedEl.id, 'borderStyle', e.target.value)}
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                            <option value="none">None</option>
                          </Select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Color</label>
                          <ColorPicker value={(selectedEl.style?.borderColor as string) || '#a9b1bd'} onChange={(v) => updateStyle(selectedEl.id, 'borderColor', v)} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Radius (px)</label>
                          <Input
                            type="number"
                            min={0}
                            max={500}
                            value={(selectedEl.style?.radius as number) ?? 0}
                            onChange={(e) => updateStyle(selectedEl.id, 'radius', Number(e.target.value))}
                          />
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <label style={{ fontSize: 10, color: 'var(--mist)' }}>Inner spacing (px)</label>
                          <Input
                            type="number"
                            min={0}
                            max={80}
                            value={(selectedEl.style?.padding as number) ?? 0}
                            onChange={(e) => updateStyle(selectedEl.id, 'padding', Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Align to page */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Align to page</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 4 }}>
                      {[['left', 'Left'], ['center', 'Center'], ['right', 'Right'], ['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']].map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          disabled={selectedEl.locked}
                          onClick={() => {
                            const A4_W = pageSize.w, A4_H = pageSize.h
                            let x = selectedEl.x, y = selectedEl.y
                            if (key === 'left') x = 0
                            if (key === 'center') x = Math.max(0, (A4_W - selectedEl.width) / 2)
                            if (key === 'right') x = Math.max(0, A4_W - selectedEl.width)
                            if (key === 'top') y = 0
                            if (key === 'middle') y = Math.max(0, (A4_H - selectedEl.height) / 2)
                            if (key === 'bottom') y = Math.max(0, A4_H - selectedEl.height)
                            updateElement(selectedEl.id, { x, y })
                          }}
                          className="rounded border border-line px-2 py-1 text-xs text-mist hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40"
                        >{label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Lock & Position */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 8 }}>
                      <input
                        type="checkbox"
                        checked={!!selectedEl.locked}
                        onChange={(e) => updateElement(selectedEl.id, { locked: e.target.checked })}
                        style={{ cursor: 'pointer' }}
                      />
                      Lock position and size
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>{selectedEl.id.startsWith('id_') ? 'Position X' : 'Offset X'}</label>
                        <Input
                          type="number"
                          value={selectedEl.id.startsWith('id_') ? selectedEl.x : (selectedEl.offsetX ?? 0)}
                          disabled={selectedEl.locked}
                          onChange={(e) =>
                            selectedEl.id.startsWith('id_')
                              ? updateElement(selectedEl.id, { x: Math.max(0, Number(e.target.value)) })
                              : updateElement(selectedEl.id, { offsetX: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>{selectedEl.id.startsWith('id_') ? 'Position Y' : 'Offset Y'}</label>
                        <Input
                          type="number"
                          value={selectedEl.id.startsWith('id_') ? selectedEl.y : (selectedEl.offsetY ?? 0)}
                          disabled={selectedEl.locked}
                          onChange={(e) =>
                            selectedEl.id.startsWith('id_')
                              ? updateElement(selectedEl.id, { y: Math.max(0, Number(e.target.value)) })
                              : updateElement(selectedEl.id, { offsetY: Number(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Width (px)</label>
                        <Input
                          type="number"
                          value={selectedEl.width}
                          disabled={selectedEl.locked}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              width: Math.max(20, Number(e.target.value)),
                              style: selectedEl.id.startsWith('id_') ? selectedEl.style : { ...selectedEl.style, customSize: true },
                            })
                          }
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Height (px)</label>
                        <Input
                          type="number"
                          value={selectedEl.height}
                          disabled={selectedEl.locked}
                          onChange={(e) =>
                            updateElement(selectedEl.id, {
                              height: Math.max(14, Number(e.target.value)),
                              style: selectedEl.id.startsWith('id_') ? selectedEl.style : { ...selectedEl.style, customSize: true },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => deleteElement(selectedEl.id)}
                    className="w-full rounded border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10"
                  >
                    <Trash2 className="size-3 inline mr-1" /> Remove Element
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table Configure Modal */}
        {configElement && configElement.type === 'table' && (
          <div
            onClick={() => setConfigElement(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#fff', borderRadius: 8, padding: 24,
                width: 420, maxHeight: '80vh', overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#16325c', margin: 0 }}>Configure Table</h3>
                <button
                  type="button"
                  onClick={() => setConfigElement(null)}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#8aa0b5', padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
              {(() => {
                const el = configElement
                const cfg = (el.style?.tableConfig as Record<string, unknown>) || {}
                const cfgColumns = (cfg.columns ?? {}) as Record<string, boolean>
                const cols = ['ca', 'exam', 'total', 'position', 'grade', 'remark'] as const
                const colLabels: Record<string, string> = { ca: 'Class Score (CA)', exam: 'Exam Score', total: 'Total', position: 'Position', grade: 'Grade', remark: 'Remark' }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Table title */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#16325c', display: 'block', marginBottom: 4 }}>Table Title</label>
                      <input
                        type="text"
                        defaultValue={(cfg.title as string) || ''}
                        onChange={(e) => updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, title: e.target.value } } })}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                        placeholder="e.g. Result Sheet"
                      />
                    </div>
                    {/* Class name */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#16325c', display: 'block', marginBottom: 4 }}>Class</label>
                      <input
                        type="text"
                        defaultValue={(cfg.className as string) || ''}
                        onChange={(e) => updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, className: e.target.value } } })}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                        placeholder="e.g. Class 1"
                      />
                    </div>
                    {/* Term / Year */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#16325c', display: 'block', marginBottom: 4 }}>Term / Academic Year</label>
                      <input
                        type="text"
                        defaultValue={(cfg.term as string) || ''}
                        onChange={(e) => updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, term: e.target.value } } })}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13 }}
                        placeholder="e.g. Term 1, 2025/2026"
                      />
                    </div>
                    {/* Column visibility */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#16325c', display: 'block', marginBottom: 6 }}>Columns to Show</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {cols.map((c) => {
                          const checked = !cfg.columns || cfgColumns[c] !== false
                          return (
                            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333' }}>
                              <input
                                type="checkbox"
                                defaultChecked={checked}
                                onChange={(e) => {
                                  const nextCols = { ...cfgColumns }
                                  nextCols[c] = e.target.checked
                                  updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, columns: nextCols } } })
                                }}
                              />
                              {colLabels[c]}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    {/* Options */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#16325c', display: 'block', marginBottom: 6 }}>Options</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333' }}>
                          <input
                            type="checkbox"
                            defaultChecked={cfg.showClassAverage !== false}
                            onChange={(e) => updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, showClassAverage: e.target.checked } } })}
                          />
                          Show Class Average
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333' }}>
                          <input
                            type="checkbox"
                            defaultChecked={cfg.showGradingScale !== false}
                            onChange={(e) => updateElement(el.id, { style: { ...el.style, tableConfig: { ...cfg, showGradingScale: e.target.checked } } })}
                          />
                          Show Grading Scale
                        </label>
                      </div>
                    </div>
                    {/* Footer buttons */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button
                        type="button"
                        onClick={() => setConfigElement(null)}
                        style={{ padding: '6px 16px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', fontSize: 13, cursor: 'pointer' }}
                      >Done</button>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Right-Click Canvas Context Menu (Copy / Cut / Paste / Copy Element to Theme) */}
        {canvasContextMenu && (
          <div
            data-report-popup="true"
            onContextMenu={(e) => e.preventDefault()}
            className="bg-white dark:bg-zinc-900"
            style={{
              position: 'fixed',
              left: Math.max(8, Math.min(canvasContextMenu.clientX, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 248)),
              top: Math.max(8, Math.min(canvasContextMenu.clientY, (typeof window !== 'undefined' ? window.innerHeight : 800) - 310)),
              width: 236,
              borderRadius: 10,
              border: '1px solid var(--line)',
              boxShadow: '0 14px 36px rgba(15, 23, 42, 0.28)',
              padding: 6,
              zIndex: 140,
            }}
          >
            {canvasContextMenu.targetIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => copySelectedElements(canvasContextMenu.targetIds)}
                  className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Copy className="size-3.5 text-blue-600" />
                    Copy Element{canvasContextMenu.targetIds.length > 1 ? `s (${canvasContextMenu.targetIds.length})` : ''}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--mist)' }}>Ctrl+C</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ids = canvasContextMenu.targetIds
                    copySelectedElements(ids)
                    if (ids.length > 1) {
                      deleteSelectedElements()
                    } else if (ids[0]) {
                      deleteElement(ids[0])
                    }
                    setCanvasContextMenu(null)
                  }}
                  className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Scissors className="size-3.5 text-mist" />
                    Cut Element{canvasContextMenu.targetIds.length > 1 ? `s (${canvasContextMenu.targetIds.length})` : ''}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--mist)' }}>Ctrl+X</span>
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSelectedElements(canvasContextMenu.targetIds)}
                  className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus className="size-3.5 text-mist" />
                    Duplicate
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--mist)' }}>Ctrl+D</span>
                </button>

                <div style={{ margin: '5px 0', borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                  <div style={{ padding: '2px 8px 4px', fontSize: 9.5, fontWeight: 700, color: 'var(--mist)', textTransform: 'uppercase' }}>
                    Copy Element to Theme
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, padding: '0 4px' }}>
                    {allThemes.filter((th) => th.id !== (previewTheme?.id || 'theme-1')).map((th) => (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => copySelectionToTheme(th, canvasContextMenu.targetIds)}
                        className="rounded border border-line hover:border-blue-500 hover:bg-blue-500/10"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 7px',
                          background: 'transparent',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 600,
                          color: 'var(--foreground)',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: th.accentColor, flexShrink: 0 }} />
                        <span>{th.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Insertion Cursor & Quick Placement Actions at Right-Clicked Spot */}
            <div
              style={{
                borderTop: canvasContextMenu.targetIds.length > 0 ? '1px solid var(--line)' : 'none',
                marginTop: canvasContextMenu.targetIds.length > 0 ? 5 : 0,
                paddingTop: canvasContextMenu.targetIds.length > 0 ? 5 : 0,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const snapped = snapPointToCanvas(canvasContextMenu.sheetX, canvasContextMenu.sheetY, 0, 0, [])
                  setInsertionPoint({ x: snapped.x, y: snapped.y })
                  setCursorMode(false)
                  setCanvasContextMenu(null)
                }}
                className="hover:bg-emerald-500/10"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#059669',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Crosshair className="size-3.5 shrink-0" />
                  Set Insertion Cursor Here
                </span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>
                  ({canvasContextMenu.sheetX}, {canvasContextMenu.sheetY})
                </span>
              </button>
              {(selectedObjects.length > 0 || selectedElement) && (
                <button
                  type="button"
                  onClick={() => {
                    const snapped = snapPointToCanvas(canvasContextMenu.sheetX, canvasContextMenu.sheetY, 0, 0, [])
                    moveSelectionToInsertionPoint({ x: snapped.x, y: snapped.y })
                    setCanvasContextMenu(null)
                  }}
                  className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  <MapPin className="size-3.5 text-purple-600 shrink-0" />
                  <span>Move Selected Here</span>
                </button>
              )}
            </div>

            {(themeClipboard?.items.length || sharedReportThemeClipboard?.items.length) ? (() => {
              const clip = themeClipboard ?? sharedReportThemeClipboard!
              return (
                <div style={{ borderTop: '1px solid var(--line)', marginTop: 5, paddingTop: 5 }}>
                  <button
                    type="button"
                    onClick={() => pasteCopiedElements(clip, { x: canvasContextMenu.sheetX, y: canvasContextMenu.sheetY })}
                    className="hover:bg-blue-500/10"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#2563eb',
                      textAlign: 'left',
                    }}
                  >
                    <ClipboardPaste className="size-3.5 shrink-0" />
                    <span>Paste {clip.items.length} Element{clip.items.length > 1 ? 's' : ''} Here</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => pasteCopiedElements(clip)}
                    className="hover:bg-slate-100 dark:hover:bg-zinc-800"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    <span>{insertionPoint ? `Paste at Cursor (${insertionPoint.x}, ${insertionPoint.y})` : 'Paste at Original Position'}</span>
                    <span style={{ fontSize: 10, color: 'var(--mist)' }}>Ctrl+V</span>
                  </button>
                </div>
              )
            })() : null}

            {canvasContextMenu.targetIds.length > 0 && (
              <div style={{ marginTop: 5, borderTop: '1px solid var(--line)', paddingTop: 5 }}>
                <button
                  type="button"
                  onClick={() => {
                    const ids = canvasContextMenu.targetIds
                    if (ids.length > 1) {
                      deleteSelectedElements()
                    } else if (ids[0]) {
                      deleteElement(ids[0])
                    }
                    setCanvasContextMenu(null)
                  }}
                  className="hover:bg-red-500/10"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#dc2626',
                  }}
                >
                  <Trash2 className="size-3.5" />
                  {canvasContextMenu.targetIds.length > 1
                    ? `Delete / Hide (${canvasContextMenu.targetIds.length})`
                    : canvasContextMenu.targetIds[0]?.startsWith('id_')
                      ? 'Delete Element'
                      : 'Hide Element'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer with navigation */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 28px', borderTop: '1px solid var(--line)',
            background: 'transparent',
          }}
        >
          <div>
            <Button variant="ghost" size="sm" onClick={step <= (initialStep ?? 0) ? onClose : prev}>
              <ArrowLeft className="size-4" /> {step <= (initialStep ?? 0) ? 'Back' : 'Previous'}
            </Button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handlePublishTheme}
              title={`Publish current canvas design as ${nextPublishedThemeName} in Reportsheet Theme and add as Published in Report Builder`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <Palette className="size-3.5" /> Publish Theme
            </button>
            {step === WIZARD_STEPS.length - 1 && (
              <>
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSave}>
                  <Save className="size-4" /> {editing ? 'Save Changes' : 'Create Report'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
