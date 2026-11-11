import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, FileText, Plus, Pencil, Trash2,
  Search, X, Printer, LayoutGrid, Type, Image as ImageIcon,
  Palette, Layers, Settings, Eye, Save, ArrowLeft, ArrowRight, Award, Upload,
} from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Empty, SearchInput } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useI18n } from '../../../context/I18nContext'
import { useToast } from '../../../context/ToastContext'
import { loadEduRecords, saveEduRecords, type EduRecords, type EduRow } from '../../../lib/eduRecords'
import { REPORTSHEET_THEMES, type ReportsheetThemeDef } from '../../../lib/reportsheetThemes'
import { ReportsheetSheetRenderer } from './ReportsheetThemePage'
import { AddMarksheetTemplateModal } from './AddMarksheetTemplateModal'
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

export default function ReportBuilderPage() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { activeBranchId, branches } = useApp()
  const navigate = useNavigate()

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId),
    [branches, activeBranchId],
  )

  const [records, setRecords] = useState<EduRecords>(() =>
    loadEduRecords(activeBranchId, activeBranch?.name),
  )

  useEffect(() => {
    setRecords(loadEduRecords(activeBranchId, activeBranch?.name))
  }, [activeBranchId, activeBranch?.name])

  const reportRecords = (records.reportBuilder ?? []) as EduRow[]
  const marksheetRecords = (records.marksheetTemplate ?? []) as EduRow[]

  // Merge marksheet template records into the report builder list
  const mergedRecords = useMemo(() => {
    const reportRows = reportRecords.map((r) => ({
      ...r,
      format: r.pageOrientation === 'landscape' ? 'Landscape' : 'Portrait',
      __source: 'report' as const,
    }))
    const marksheetRows = marksheetRecords.map((m) => ({
      ...m,
      reportName: m.templateName,
      reportType: 'Marksheet Template',
      className: '',
      format: m.pageLayout ?? 'Portrait',
      status: 'Published',
      __source: 'marksheet' as const,
    }))
    return [...reportRows, ...marksheetRows]
  }, [reportRecords, marksheetRecords])
  const [search, setSearch] = useState('')
  const [wizardOpen, setWizardOpen] = useState(false)
  const [newReportModalOpen, setNewReportModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('blank')
  const [certificateBgColor, setCertificateBgColor] = useState('#fff8e7')
  const [editing, setEditing] = useState<EduRow | null>(null)
  const [modalTemplateName, setModalTemplateName] = useState('')
  const [modalReportType, setModalReportType] = useState('Standard')
  const [modalStartFrom, setModalStartFrom] = useState<'blank' | 'ready'>('ready')
  const [marksheetModalOpen, setMarksheetModalOpen] = useState(false)
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
      String(r.examName ?? '').toLowerCase().includes(q)
    )
  }, [mergedRecords, search])

  const openNew = () => {
    setEditing(null)
    setSelectedTemplate('blank')
    setNewReportModalOpen(true)
  }

  const openEdit = (row: EduRow) => {
    setEditing(row)
    setWizardOpen(true)
    setViewMode('wizard')
    collapseSidebar(true)
  }

  const save = (data: EduRow) => {
    const next = editing?.id ? reportRecords.filter((r) => r.id !== editing.id) : reportRecords
    const updated = [data, ...next]
    const nextRecords = { ...records, reportBuilder: updated }
    saveEduRecords(activeBranchId, nextRecords)
    setRecords(nextRecords)
    toast(editing ? 'Report updated' : 'Report created', 'success')
    setWizardOpen(false)
  }

  const remove = (id: string) => {
    const next = reportRecords.filter((r) => r.id !== id)
    const nextRecords = { ...records, reportBuilder: next }
    saveEduRecords(activeBranchId, nextRecords)
    setRecords(nextRecords)
    toast('Report deleted', 'info')
  }

  const removeMarksheet = (id: string) => {
    const next = marksheetRecords.filter((r) => r.id !== id)
    const nextRecords = { ...records, marksheetTemplate: next }
    saveEduRecords(activeBranchId, nextRecords)
    setRecords(nextRecords)
    toast('Marksheet template deleted', 'info')
  }

  // Data sources for wizard selects
  const examSetupRecords = (records.examSetup ?? []) as EduRow[]
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search reports & marksheet templates…" />
        </div>

        {filtered.length === 0 ? (
          <Empty
            title="No reports or marksheet templates yet"
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
                    <td className="px-4 py-3 font-medium">{String(r.reportName ?? '')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${r.__source === 'marksheet' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                        {r.__source === 'marksheet' ? 'Marksheet' : 'Report'}
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
                        {r.__source === 'report' && (
                          <button type="button" onClick={() => openEdit(r)} className="rounded-md p-1.5 text-mist hover:bg-muted hover:text-foreground" title="Edit">
                            <Pencil className="size-4" />
                          </button>
                        )}
                        {r.__source === 'marksheet' && (
                          <button type="button" onClick={() => navigate('/admin/education-management/examinations/marksheet-template')} className="rounded-md p-1.5 text-mist hover:bg-muted hover:text-foreground" title="Open Marksheet Template">
                            <Eye className="size-4" />
                          </button>
                        )}
                        <button type="button" onClick={() => r.__source === 'report' ? remove(r.id) : removeMarksheet(r.id)} className="rounded-md p-1.5 text-mist hover:bg-red-500/10 hover:text-red-500" title="Delete">
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

      {/* Wizard modal */}
      {newReportModalOpen && (
        <div
          onClick={() => setNewReportModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(15,23,42,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900"
            style={{
              borderRadius: 12, width: 520, maxWidth: '90vw', maxHeight: '85vh',
              overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 0' }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>Create New Report</h2>
                <p style={{ fontSize: 13, color: 'var(--mist)', marginTop: 2 }}>Choose a template to start designing</p>
              </div>
              <button type="button" onClick={() => setNewReportModalOpen(false)} className="rounded p-1 text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-5" />
              </button>
            </div>

            {/* Template Name field */}
            <div style={{ padding: '20px 24px 0' }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Template Name</label>
              <Input
                value={modalTemplateName}
                onChange={(e) => setModalTemplateName(e.target.value)}
                placeholder="e.g. Our New Result Design"
                style={{ width: '100%' }}
              />
            </div>

            {/* Report Type field */}
            <div style={{ padding: '16px 24px 0' }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 6 }}>Report Type</label>
              <Select value={modalReportType} onChange={(e) => setModalReportType(e.target.value)}>
                <option value="Standard">Standard</option>
                <option value="CGPA">CGPA</option>
                <option value="Numeric / Alphabetic / Credit/Point/GPA columns">Numeric / Alphabetic / Credit/Point/GPA columns</option>
                <option value="AlphaNumeric">AlphaNumeric</option>
              </Select>
            </div>

            {/* Start from section */}
            <div style={{ padding: '16px 24px 0' }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 10 }}>Start from</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalStartFrom('blank')}
                  className="rtb-block-card"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: 14, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: modalStartFrom === 'blank' ? '2px solid #136ee5' : '1px solid var(--line)',
                    background: modalStartFrom === 'blank' ? 'rgba(13,110,253,0.04)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: modalStartFrom === 'blank' ? 'rgba(13,110,253,0.1)' : 'var(--slate-100)',
                    color: modalStartFrom === 'blank' ? '#136ee5' : 'var(--mist)',
                  }}>
                    <LayoutGrid className="size-5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Blank canvas</div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>Start with nothing and design freely.</div>
                  </div>
                  {modalStartFrom === 'blank' && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#136ee5', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>
                      ✓
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setModalStartFrom('ready')}
                  className="rtb-block-card"
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: 14, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: modalStartFrom === 'ready' ? '2px solid #136ee5' : '1px solid var(--line)',
                    background: modalStartFrom === 'ready' ? 'rgba(13,110,253,0.04)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: modalStartFrom === 'ready' ? 'rgba(13,110,253,0.1)' : 'var(--slate-100)',
                    color: modalStartFrom === 'ready' ? '#136ee5' : 'var(--mist)',
                  }}>
                    <FileText className="size-5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
                      Marksheet Template <span style={{ fontSize: 11, fontWeight: 500, color: '#136ee5', marginLeft: 4 }}>(recommended)</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--mist)', marginTop: 2 }}>Use a pre-built marksheet layout and customize it for your needs.</div>
                  </div>
                  {modalStartFrom === 'ready' && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: '#136ee5', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>
                      ✓
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12,
              padding: '20px 24px', borderTop: '1px solid var(--line)', marginTop: '20px',
            }}>
              <button type="button" onClick={() => setNewReportModalOpen(false)} className="rounded border border-line px-4 py-2 text-sm font-medium text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewReportModalOpen(false)
                  if (modalStartFrom === 'ready') {
                    setMarksheetModalOpen(true)
                  } else {
                    setWizardOpen(true)
                    setViewMode('wizard')
                    collapseSidebar(true)
                  }
                }}
                className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <ReportBuilderWizard
          editing={editing}
          branchName={activeBranch?.name ?? ''}
          examOptions={examSetupRecords}
          classOptions={classListRecords}
          subjectOptions={subjectListRecords}
          termOptions={termRecords}
          initialStep={1}
          initialTemplateType={!editing ? selectedTemplate : undefined}
          initialReportName={!editing ? modalTemplateName : undefined}
          initialView={!editing ? 'templates' : undefined}
          certificateColor={selectedTemplate === 'certificate' ? certificateBgColor : undefined}
          onSave={save}
          onClose={() => {
            setWizardOpen(false)
            setViewMode('list')
            collapseSidebar(false)
          }}
          isFullPage={viewMode === 'wizard'}
        />
      )}

      <AddMarksheetTemplateModal
        key={marksheetModalOpen ? 'open' : 'closed'}
        open={marksheetModalOpen}
        onClose={() => setMarksheetModalOpen(false)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportBuilderWizard
// ---------------------------------------------------------------------------

interface CanvasElement {
  id: string
  type: 'header' | 'text' | 'table' | 'image' | 'logo' | 'custom_text' | 'custom_heading' | 'divider' | 'signature'
  label: string
  x: number
  y: number
  width: number
  height: number
  style?: Record<string, unknown>
  text?: string
  showOn?: string[]
  locked?: boolean
  field?: string
}

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
  { key: 'custom_heading', label: 'Custom Heading', icon: 'H', w: 500, h: 48 },
  { key: 'divider', label: 'Divider', icon: '➖', w: 700, h: 4 },
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
function getThemeElements(theme: ReportsheetThemeDef): CanvasElement[] {
  const accent = theme.accentColor
  const elements: CanvasElement[] = []
  // Positions are approximate (794px canvas space, scaled to 560px renderer space)
  // Used only for properties panel metadata — actual click detection uses data-element-id
  const M = 34
  const CW = 725

  // ── Header (Theme 1: Classic Marksheet Template) ──
  elements.push({ id: 'school-logo', type: 'image', label: 'School Logo', x: M, y: 20, width: 46, height: 32, text: 'Logo', field: 'school_logo', style: {} })
  elements.push({ id: 'school-name', type: 'text', label: 'School Name', x: M, y: 56, width: 512, height: 13, text: 'School Name', style: { color: '#16325c', fontSize: 10 } })
  elements.push({ id: 'school-address', type: 'text', label: 'School Address', x: M, y: 69, width: 512, height: 13, text: 'Address · Phone · Email', style: { color: '#16325c', fontSize: 10 } })
  elements.push({ id: 'school-phone', type: 'text', label: 'School Phone', x: M, y: 82, width: 300, height: 13, text: 'Tel: +233 24 000 0000', style: { color: '#64748b', fontSize: 8 } })
  elements.push({ id: 'exam-name', type: 'text', label: 'Exam Name', x: M, y: 95, width: 512, height: 13, text: 'Exam Name', style: { color: '#16325c', fontSize: 10 } })
  elements.push({ id: 'exam-title', type: 'text', label: 'Exam Title', x: M, y: 95, width: 512, height: 13, text: '[ TERMINAL REPORT SHEET ]', style: { color: '#16325c', fontSize: 10 } })

  // ── Student Details (5-col grid: Name, Admission No, Class, Term, Exam) ──
  elements.push({ id: 'student-name', type: 'text', label: 'Student Name', x: M, y: 100, width: 90, height: 22, text: 'Student Name', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'admission-no', type: 'text', label: 'Admission No', x: 130, y: 100, width: 90, height: 22, text: 'ADM-001', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'student-class', type: 'text', label: 'Class', x: 230, y: 100, width: 90, height: 22, text: 'Basic 7 A', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'term-label', type: 'text', label: 'Term', x: 330, y: 100, width: 90, height: 22, text: 'Term 1', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'exam-name-field', type: 'text', label: 'Exam (Student Details)', x: 430, y: 100, width: 90, height: 22, text: 'Exam', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'student-photo', type: 'image', label: 'Student Photo', x: 530, y: 100, width: 38, height: 38, text: 'Photo', field: 'student_photo', style: {} })

  // ── Subject Table ──
  elements.push({ id: 'subject-table', type: 'table', label: 'Subject Table', x: M, y: 140, width: 512, height: 200, text: 'Subject Table', style: { fontSize: 9.5 } })

  // ── Summary Metrics ──
  elements.push({ id: 'attendance-field', type: 'text', label: 'Attendance', x: M, y: 350, width: 160, height: 22, text: '96%', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'position-field', type: 'text', label: 'Position', x: 200, y: 350, width: 160, height: 22, text: '3rd of 32', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })
  elements.push({ id: 'class-average', type: 'text', label: 'Class Average', x: 380, y: 350, width: 160, height: 22, text: '74.1', style: { color: '#16325c', fontSize: 11.5, fontWeight: 600 } })

  // ── Grading Scale ──
  elements.push({ id: 'grading-scale', type: 'text', label: 'Grading Scale', x: M, y: 385, width: CW, height: 14, text: 'Grading scale · A+ 90–100 · ...', style: { color: '#6b7280', fontSize: 8.5 } })

  // ── Class Teacher's Remark ──
  elements.push({ id: 'class-teacher-remarks', type: 'text', label: "Class Teacher's Remark", x: M, y: 405, width: CW, height: 14, text: 'A very promising term.', style: { color: '#16325c', fontSize: 10.5, fontWeight: 600 } })

  // ── Signatures ──
  elements.push({ id: 'class-teacher-signature', type: 'signature', label: 'Class Teacher Signature', x: M, y: 450, width: 150, height: 40, text: 'Class Teacher', field: 'class_teacher_signature', style: {} })
  elements.push({ id: 'head-of-school-signature', type: 'signature', label: 'Head of School Signature', x: 200, y: 450, width: 150, height: 40, text: 'Head of School', field: 'head_of_school_signature', style: {} })
  elements.push({ id: 'principal-signature', type: 'signature', label: 'Principal Signature', x: 380, y: 450, width: 150, height: 40, text: 'Principal', field: 'principal_signature', style: {} })

  // ── Printed Line + Template Caption ──
  elements.push({ id: 'printed-line', type: 'text', label: 'Printed Line', x: M, y: 500, width: 200, height: 13, text: 'Printed —', style: { color: '#16325c', fontSize: 9.5 } })
  elements.push({ id: 'template-caption', type: 'text', label: 'Template Caption', x: M, y: 515, width: 300, height: 12, text: 'Sample(A4 Portrait) 1', style: { color: '#9ca3af', fontSize: 8 } })

  return elements
}

function ReportBuilderWizard({
  editing,
  branchName,
  examOptions,
  classOptions,
  subjectOptions,
  termOptions,
  initialStep,
  initialTemplateType,
  initialReportName,
  initialView,
  certificateColor,
  onSave,
  onClose,
  isFullPage,
}: {
  editing: EduRow | null
  branchName: string
  examOptions: EduRow[]
  classOptions: EduRow[]
  subjectOptions: EduRow[]
  termOptions: EduRow[]
  initialStep?: number
  initialTemplateType?: string
  initialReportName?: string
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
  const [reportName, setReportName] = useState(editing?.reportName ?? initialReportName ?? '')
  const [reportType, setReportType] = useState(editing?.reportType ?? 'Results')
  const [examName, setExamName] = useState(editing?.examName ?? '')
  const [className, setClassName] = useState(editing?.className ?? '')
  const [term, setTerm] = useState(editing?.term ?? '')
  const [academicYear, setAcademicYear] = useState(editing?.academicYear ?? '')
  const [fromDate, setFromDate] = useState(editing?.fromDate ?? '')
  const [toDate, setToDate] = useState(editing?.toDate ?? '')
  const [includeSubjects, setIncludeSubjects] = useState<string[]>(multiSelectValues(editing?.includeSubjects))
  const [reportOptions, setReportOptions] = useState<string[]>(
    editing ? multiSelectValues(editing.reportOptions) : ['Class Average', 'Subject Average', 'Remark']
  )
  const [format, setFormat] = useState(editing?.format ?? 'PDF')
  const [status, setStatus] = useState(editing?.status ?? 'Draft')
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>(editing?.pageOrientation ?? 'portrait')
  const pageSize = pageOrientation === 'portrait' ? { w: 794, h: 1123 } : { w: 1123, h: 794 }

  // Canvas elements
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>([
    { id: uid(), type: 'header', label: 'Report Title', x: 20, y: 20, width: 300, height: 40 },
    { id: uid(), type: 'text', label: 'School Name', x: 20, y: 70, width: 200, height: 24 },
    { id: uid(), type: 'text', label: 'Exam Name', x: 20, y: 100, width: 200, height: 24 },
    { id: uid(), type: 'table', label: 'Subject Table', x: 20, y: 140, width: 600, height: 200 },
    { id: uid(), type: 'image', label: 'Logo', x: 700, y: 20, width: 80, height: 80 },
  ])
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [dragState, setDragState] = useState<{ ids: string[]; centerOffsetX: number; centerOffsetY: number; startMouseX: number; startMouseY: number; startPos: Record<string, { x: number; y: number }> } | null>(null)
  const [resizeState, setResizeState] = useState<{ id: string; corner: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w'; startX: number; startY: number; startW: number; startH: number } | null>(null)
  const [configElement, setConfigElement] = useState<CanvasElement | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selectedElRect, setSelectedElRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  // Canvas element drag handlers
  const handleElementMouseDown = (e: React.MouseEvent, el: CanvasElement) => {
    e.stopPropagation()
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedElements(prev =>
        prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]
      )
      setSelectedElement(el.id)
    } else if (selectedElements.includes(el.id)) {
      // Element already selected — drag all selected elements together
      setSelectedElement(el.id)
    } else {
      setSelectedElements([el.id])
      setSelectedElement(el.id)
    }
    setCurrentView('style')

    // Calculate mouse position relative to canvas (not element)
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    const startMouseX = canvasRect ? (e.clientX - canvasRect.left) / zoom : 0
    const startMouseY = canvasRect ? (e.clientY - canvasRect.top) / zoom : 0

    // Build drag state for all currently selected elements
    const selIds = selectedElements.includes(el.id) ? selectedElements : [el.id]
    const startPos: Record<string, { x: number; y: number }> = {}
    selIds.forEach(id => {
      const selEl = canvasElements.find(ce => ce.id === id)
      if (selEl) {
        startPos[id] = { x: selEl.x, y: selEl.y }
      }
    })

    // Calculate center offset — element should be centered under mouse
    const clickedEl = canvasElements.find(ce => ce.id === el.id)
    const centerOffsetX = clickedEl ? (clickedEl.x + clickedEl.width / 2) - startMouseX : 0
    const centerOffsetY = clickedEl ? (clickedEl.y + clickedEl.height / 2) - startMouseY : 0

    // Apply center offset to start positions (jump to center on drag start)
    const centeredStartPos: Record<string, { x: number; y: number }> = {}
    selIds.forEach(id => {
      const sp = startPos[id]
      if (sp) {
        centeredStartPos[id] = { x: sp.x + centerOffsetX, y: sp.y + centerOffsetY }
      }
    })

    setDragState({ ids: selIds, centerOffsetX, centerOffsetY, startMouseX, startMouseY, startPos: centeredStartPos })
  }

  // Canvas click handler — uses event delegation to read data-element-id from renderer elements
  const handleCanvasClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    const elId = target.closest('[data-element-id]')?.getAttribute('data-element-id')
    if (elId) {
      e.stopPropagation()
      // If the element doesn't exist in canvasElements, add a minimal entry for it
      const existing = canvasElements.find(ce => ce.id === elId)
      if (!existing) {
        const elType = target.closest('[data-element-type]')?.getAttribute('data-element-type') || 'text'
        const elLabel = target.closest('[data-element-label]')?.getAttribute('data-element-label') || elId
        const newEl: CanvasElement = {
          id: elId,
          type: elType as CanvasElement['type'],
          label: elLabel,
          x: 0,
          y: 0,
          width: 200,
          height: 30,
          style: {},
          text: elLabel,
        }
        setCanvasElements(prev => [...prev, newEl])
      }
      setSelectedElements([elId])
      setSelectedElement(elId)
      setCurrentView('style')
    }
  }

  // Mouse down on canvas — handles element drag start and marquee selection
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // If clicking on a drag-added element (has onMouseDown handler), let it handle
    if (target.closest('[data-canvas-element]')) return
    if (target.closest('[data-resize-handle]')) return
    // If clicking on a renderer element (data-element-id), start drag
    const elIdEl = target.closest('[data-element-id]')
    if (elIdEl) {
      const elId = elIdEl.getAttribute('data-element-id')!
      let el = canvasElements.find(ce => ce.id === elId)
      if (!el) {
        // Element not in state yet — create minimal entry
        const elType = elIdEl.getAttribute('data-element-type') || 'text'
        const elLabel = elIdEl.getAttribute('data-element-label') || elId
        el = {
          id: elId,
          type: elType as CanvasElement['type'],
          label: elLabel,
          x: 0, y: 0, width: 200, height: 30,
          style: {}, text: elLabel,
        }
        setCanvasElements(prev => [...prev, el!])
      }
      // Use the element from state (with correct position)
      const stateEl = canvasElements.find(ce => ce.id === elId) || el
      handleElementMouseDown(e, stateEl)
      return
    }
    // Empty canvas area — start marquee selection
    if (target !== e.currentTarget && !(e.currentTarget as HTMLElement).contains(target)) return
    const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - canvasRect.left) / zoom
    const y = (e.clientY - canvasRect.top) / zoom
    setMarqueeStart({ x, y })
    setMarquee({ x, y, w: 0, h: 0 })
  }

  // Resize handle mouse down
  const handleResizeMouseDown = (e: React.MouseEvent, el: CanvasElement, corner: 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w') => {
    e.stopPropagation()
    e.preventDefault()
    setResizeState({
      id: el.id,
      corner,
      startX: e.clientX,
      startY: e.clientY,
      startW: el.width,
      startH: el.height,
    })
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (resizeState) {
      if (!canvasRef.current) return
      const dx = (e.clientX - resizeState.startX) / zoom
      const dy = (e.clientY - resizeState.startY) / zoom
      setCanvasElements(prev => prev.map(el => {
        if (el.id !== resizeState.id) return el
        let newW = resizeState.startW
        let newH = resizeState.startH
        let newX = el.x
        let newY = el.y
        if (resizeState.corner === 'se') {
          newW = Math.max(20, resizeState.startW + dx)
          newH = Math.max(20, resizeState.startH + dy)
        } else if (resizeState.corner === 'nw') {
          newW = Math.max(20, resizeState.startW - dx)
          newH = Math.max(20, resizeState.startH - dy)
          newX = el.x + (resizeState.startW - newW)
          newY = el.y + (resizeState.startH - newH)
        } else if (resizeState.corner === 'ne') {
          newW = Math.max(20, resizeState.startW + dx)
          newH = Math.max(20, resizeState.startH - dy)
          newY = el.y + (resizeState.startH - newH)
        } else if (resizeState.corner === 'sw') {
          newW = Math.max(20, resizeState.startW - dx)
          newH = Math.max(20, resizeState.startH + dy)
          newX = el.x + (resizeState.startW - newW)
        } else if (resizeState.corner === 'n') {
          newH = Math.max(20, resizeState.startH - dy)
          newY = el.y + (resizeState.startH - newH)
        } else if (resizeState.corner === 's') {
          newH = Math.max(20, resizeState.startH + dy)
        } else if (resizeState.corner === 'e') {
          newW = Math.max(20, resizeState.startW + dx)
        } else if (resizeState.corner === 'w') {
          newW = Math.max(20, resizeState.startW - dx)
          newX = el.x + (resizeState.startW - newW)
        }
        return { ...el, width: newW, height: newH, x: newX, y: newY }
      }))
      return
    }
    if (!dragState || !canvasRef.current) {
      // Marquee drawing
      if (marqueeStart) {
        const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const cx = (e.clientX - canvasRect.left) / zoom
        const cy = (e.clientY - canvasRect.top) / zoom
        setMarquee({
          x: Math.min(marqueeStart.x, cx),
          y: Math.min(marqueeStart.y, cy),
          w: Math.abs(cx - marqueeStart.x),
          h: Math.abs(cy - marqueeStart.y),
        })
      }
      return
    }
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const mouseX = (e.clientX - canvasRect.left) / zoom
    const mouseY = (e.clientY - canvasRect.top) / zoom
    const deltaX = mouseX - dragState.startMouseX
    const deltaY = mouseY - dragState.startMouseY
    setCanvasElements(prev => prev.map(el => {
      if (!dragState.ids.includes(el.id)) return el
      const start = dragState.startPos[el.id]
      const newX = Math.max(0, Math.min(start.x + deltaX, 560 - el.width))
      const newY = Math.max(0, Math.min(start.y + deltaY, 780 - el.height))
      return { ...el, x: newX, y: newY }
    }))
  }

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragState(null)
    setResizeState(null)

    // Marquee selection finalize
    if (marqueeStart && marquee && marquee.w > 5 && marquee.h > 5) {
      const intersecting = canvasElements.filter(el => {
        const elRight = el.x + el.width
        const elBottom = el.y + el.height
        return el.x < marquee.x + marquee.w && elRight > marquee.x &&
               el.y < marquee.y + marquee.h && elBottom > marquee.y
      })
      if (intersecting.length > 0) {
        setSelectedElements(intersecting.map(el => el.id))
        setSelectedElement(intersecting[0].id)
        setCurrentView('style')
      } else {
        setSelectedElements([])
        setSelectedElement(null)
        setCurrentView(lastPaletteView)
      }
    } else if (marqueeStart && !e.ctrlKey && !e.metaKey) {
      // Clicked on empty canvas without drag — clear selection
      const target = e.target as HTMLElement
      if (!target.closest('[data-canvas-element]')) {
        setSelectedElements([])
        setSelectedElement(null)
        setCurrentView(lastPaletteView)
      }
    }
    setMarquee(null)
    setMarqueeStart(null)
  }

  const deleteElement = (id: string) => {
    setCanvasElements(prev => prev.filter(el => el.id !== id))
    setSelectedElements(prev => prev.filter(sid => sid !== id))
    if (selectedElement === id) setSelectedElement(null)
    // Immediately hide the element in the DOM
    if (canvasRef.current) {
      const el = canvasRef.current.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
      if (el) el.style.display = 'none'
    }
  }

  const deleteSelectedElements = () => {
    setCanvasElements(prev => prev.filter(el => !selectedElements.includes(el.id)))
    setSelectedElements([])
    setSelectedElement(null)
  }

  // Update element properties
  const updateElement = (id: string, props: Partial<CanvasElement>) => {
    setCanvasElements(prev => prev.map(el => el.id === id ? { ...el, ...props } : el))
  }

  // Update element style
  const updateStyle = (id: string, key: string, value: unknown) => {
    setCanvasElements(prev => prev.map(el =>
      el.id === id ? { ...el, style: { ...el.style, [key]: value } } : el
    ))
  }

  // Get selected element
  const selectedEl = canvasElements.find((el) => el.id === selectedElement) || null

  // Get table element for subject table settings
  const tableEl = canvasElements.find((el) => el.type === 'table' && el.field === 'subject_table') || canvasElements.find((el) => el.type === 'table') || null

  // Canvas form fields (left panel)
  const [canvasSettings, setCanvasSettings] = useState({
    schoolName: 'Airport City Flagship',
    schoolAddress: 'Accra, Greater Accra',
    schoolMotto: 'Excellence in Education',
    reportTitle: editing?.reportName ?? '',
    examName: editing?.examName ?? '',
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
  })

  const [zoom, setZoom] = useState(0.75)
  const [currentView, setCurrentView] = useState<'elements' | 'editor' | 'sections' | 'templates' | 'setup' | 'style'>(initialView ?? 'elements')
  const [lastPaletteView, setLastPaletteView] = useState<'elements' | 'editor' | 'sections' | 'templates' | 'setup'>('elements')

  // Drag-drop from palette to canvas
  const [draggingField, setDraggingField] = useState<{ key: string; w: number; h: number } | null>(null)
  const [previewTheme, setPreviewTheme] = useState<ReportsheetThemeDef | null>(null)
  const [editMode, setEditMode] = useState(false)

  // Measure the selected element's actual rendered position in the canvas
  useEffect(() => {
    if (!selectedElement || !canvasRef.current) {
      setSelectedElRect(null)
      return
    }
    const el = canvasRef.current.querySelector(`[data-element-id="${selectedElement}"]`) as HTMLElement | null
    if (!el) {
      setSelectedElRect(null)
      return
    }
    const canvasRect = canvasRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    setSelectedElRect({
      left: elRect.left - canvasRect.left,
      top: elRect.top - canvasRect.top,
      width: elRect.width,
      height: elRect.height,
    })
  }, [selectedElement, zoom])

  // Apply element styles from canvasElements to the rendered DOM elements
  useEffect(() => {
    if (!canvasRef.current) return
    canvasElements.forEach(el => {
      const domEl = canvasRef.current!.querySelector(`[data-element-id="${el.id}"]`) as HTMLElement | null
      if (!domEl || !el.style) return
      // Apply text content if set
      if (el.text !== undefined && el.type !== 'image' && el.type !== 'table') {
        domEl.textContent = el.text
      }
      // Apply style properties
      const s = el.style
      if (s.fontFamily) domEl.style.fontFamily = s.fontFamily as string
      if (s.fontSize !== undefined) domEl.style.fontSize = `${s.fontSize}px`
      if (s.color) domEl.style.color = s.color as string
      if (s.align) domEl.style.textAlign = s.align as string
      if (s.lineHeight !== undefined) domEl.style.lineHeight = String(s.lineHeight)
      if (s.bold) domEl.style.fontWeight = 'bold'
      if (s.italic) domEl.style.fontStyle = 'italic'
      if (s.underline) domEl.style.textDecoration = 'underline'
      if (s.bg) domEl.style.background = s.bg as string
      if (s.borderWidth !== undefined && (s.borderWidth as number) > 0) {
        domEl.style.borderWidth = `${s.borderWidth}px`
        domEl.style.borderStyle = (s.borderStyle as string) || 'solid'
        if (s.borderColor) domEl.style.borderColor = s.borderColor as string
      } else if (s.borderWidth === 0) {
        domEl.style.borderWidth = '0'
      }
      if (s.radius !== undefined && (s.radius as number) > 0) {
        domEl.style.borderRadius = `${s.radius}px`
      }
      if (s.padding !== undefined && (s.padding as number) > 0) {
        domEl.style.padding = `${s.padding}px`
      }
    })
    // Hide elements that are not in canvasElements (deleted elements), show elements that are in canvasElements
    if (canvasRef.current) {
      const allEls = canvasRef.current.querySelectorAll('[data-element-id]')
      const idsInState = new Set(canvasElements.map(el => el.id))
      allEls.forEach(el => {
        const id = el.getAttribute('data-element-id')
        if (id && !idsInState.has(id)) {
          ;(el as HTMLElement).style.display = 'none'
        } else if (id) {
          ;(el as HTMLElement).style.display = ''
        }
      })
    }
  }, [canvasElements, zoom, previewTheme])

  const handlePaletteDragStart = (e: React.DragEvent, key: string, w: number, h: number) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', key)
    setDraggingField({ key, w, h })
  }

  const handleEditorDragStart = (e: React.DragEvent, item: typeof EDITOR_ELEMENTS[0]) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', `editor:${item.key}`)
  }

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault()
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
    const x = (e.clientX - rect.left) / zoom - w / 2
    const y = (e.clientY - rect.top) / zoom - h / 2

    const typeMap: Record<string, CanvasElement['type']> = {
      image: 'image',
      text_field: 'text',
      subject_table: 'table',
      grading_key: 'table',
      custom_text: 'custom_text',
      custom_heading: 'custom_heading',
      divider: 'divider',
      custom_shape: 'text',
    }

    const typeKey = fieldDef?.type ?? editorItem!.key
    setCanvasElements(prev => [...prev, {
      id: uid(),
      type: typeMap[typeKey] ?? 'text',
      label: fieldDef?.label ?? editorItem!.label,
      x: Math.max(0, Math.min(x, 560 - w)),
      y: Math.max(0, Math.min(y, 780 - h)),
      width: w,
      height: h,
      text: fieldDef?.label ?? editorItem!.label,
      field: isEditor ? undefined : key,
    }])
    setDraggingField(null)
  }

  // Add editor element
  const addEditorElement = (item: typeof EDITOR_ELEMENTS[0]) => {
    const typeMap: Record<string, CanvasElement['type']> = {
      custom_text: 'custom_text',
      custom_heading: 'custom_heading',
      divider: 'divider',
      custom_shape: 'text',
    }
    setCanvasElements(prev => [...prev, {
      id: uid(),
      type: typeMap[item.key] ?? 'custom_text',
      label: item.label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: item.w,
      height: item.h,
      text: item.label,
    }])
  }

  // Add data element by click
  const addDataElement = (key: string) => {
    const fieldDef = FIELD_REGISTRY[key]
    if (!fieldDef) return
    const typeMap: Record<string, CanvasElement['type']> = {
      image: 'image',
      text_field: 'text',
      subject_table: 'table',
      grading_key: 'table',
    }
    setCanvasElements(prev => [...prev, {
      id: uid(),
      type: typeMap[fieldDef.type] ?? 'text',
      label: fieldDef.label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: fieldDef.w,
      height: fieldDef.h,
      text: fieldDef.label,
      field: key,
    }])
  }

  // Add section block
  const addSectionBlock = (block: typeof SECTION_BLOCKS[0]) => {
    const newElements: CanvasElement[] = block.elements.map((el) => {
      const fieldDef = FIELD_REGISTRY[el.field]
      return {
        id: uid(),
        type: fieldDef?.type === 'image' ? 'image' : fieldDef?.type === 'subject_table' ? 'table' : 'text',
        label: fieldDef?.label ?? el.field,
        x: el.dx,
        y: el.dy,
        width: el.w,
        height: el.h,
        text: fieldDef?.label,
        field: el.field,
      }
    })
    setCanvasElements(prev => [...prev, ...newElements])
  }

  // Load a Reportsheet Theme onto the canvas as editable elements.
  // The theme's layout elements are placed on the canvas and can be
  // dragged, resized, and configured — effectively editing the theme
  // to create a new one. Clicking an element opens the properties panel.
  const loadTheme = (theme: ReportsheetThemeDef) => {
    setPreviewTheme(theme)
    setCanvasElements(getThemeElements(theme))
    setSelectedElement(null)
    setEditMode(true)
    toast(`Loaded ${theme.name} — ${theme.tagline}`, 'info')
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
      setCanvasSettings((s) => ({ ...s, schoolLogo: String(ev.target?.result) }))
    }
    reader.readAsDataURL(file)
  }

  // Navigation
  const canProceed = () => {
    if (step === 1) return reportName.trim() !== ''
    return true
  }

  const next = () => {
    if (!canProceed()) {
      toast(step === 1 ? 'Report name is required' : 'Please complete this step', 'error')
      return
    }
    setStep(Math.min(step + 1, WIZARD_STEPS.length - 1))
  }

  const prev = () => setStep(Math.max(step - 1, 0))

  const handleSave = () => {
    if (!reportName.trim()) {
      toast('Report name is required', 'error')
      return
    }
    const row: EduRow = {
      id: editing?.id ?? uid(),
      branch: branchName,
      reportName: reportName.trim(),
      reportType,
      examName: examName || null,
      className: className || null,
      term: term || null,
      academicYear: academicYear || null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      includeSubjects: includeSubjects.length ? JSON.stringify(includeSubjects) : '',
      reportOptions: reportOptions.length ? JSON.stringify(reportOptions) : '',
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
            {isFullPage && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
                style={{ marginRight: 4 }}
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
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

          {/* Step 1: Canvas — EduMESS-style single-page builder */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 400 }}>
              {/* Top bar */}
              <div className="bg-white dark:bg-zinc-900" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', borderBottom: '1px solid var(--line)' }}>
                <button type="button" onClick={prev} className="rounded-lg border border-line px-2 py-1 text-xs text-mist hover:bg-slate-50 dark:hover:bg-zinc-800">
                  <ArrowLeft className="size-3 inline mr-1" /> Back
                </button>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="Untitled Report"
                    style={{ fontWeight: 700, fontSize: 15 }}
                  />
                  <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {reportType}
                  </span>
                </div>
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
                          setSelectedElement(null)
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
                </div>

                {/* Contextual panel */}
                <div className="bg-white dark:bg-zinc-900" style={{ width: 300, flexShrink: 0, borderRight: '1px solid var(--line)', overflowY: 'auto' }}>
                  {/* View: Data Elements */}
                  {currentView === 'elements' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Data Elements</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 8 }}>Drag or click a field to add to canvas</p>
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
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>Drag to canvas or click to add</p>
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
                              <div style={{ fontSize: 10, color: 'var(--mist)' }}>{item.w} × {item.h}px</div>
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
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>Add a pre-arranged block of elements</p>
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
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Reportsheet Themes</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>Click a theme to load its layout onto the canvas</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {REPORTSHEET_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => loadTheme(theme)}
                            className="rtb-block-card"
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: 12, borderRadius: 8, cursor: 'pointer',
                              border: '1px solid var(--line)', textAlign: 'left',
                              background: 'transparent', transition: 'all 0.15s',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `${theme.accentColor}15`,
                              color: theme.accentColor,
                              fontSize: 12, fontWeight: 700,
                            }}>
                              {theme.name.replace('Theme ', 'T')}
                            </div>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{theme.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--mist)' }}>{theme.tagline}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View: Page Setup — Report Configuration */}
                  {currentView === 'setup' && (
                    <div style={{ padding: 16 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Report Configuration</h3>
                      <p style={{ fontSize: 11, color: 'var(--mist)', marginBottom: 12 }}>Set up the basic parameters for your report</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Field label="Report Name" required>
                          <Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. First Term Examination Results" />
                        </Field>
                        <Field label="Report Type" required>
                          <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                            <option value="Results">Results</option>
                            <option value="Attendance">Attendance</option>
                            <option value="Summary">Summary</option>
                            <option value="Performance">Performance</option>
                            <option value="Comparison">Comparison</option>
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
                        <Field label="Report Options" hint="Select sections to include in the report">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {REPORT_OPTIONS.map((opt) => {
                              const checked = reportOptions.includes(opt)
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleOption(opt)}
                                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition ${
                                    checked
                                      ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                                      : 'border-line text-mist hover:border-indigo-400/60'
                                  }`}
                                >
                                  {checked && <Check className="size-3 inline mr-1" />}
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                        </Field>
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
                  {currentView === 'style' && selectedEl && (
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#136ee5' }}>Edit {selectedEl?.label}</h3>
                        <button type="button" onClick={() => { setSelectedElement(null); setCurrentView(lastPaletteView) }} className="rounded p-1 text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                          <X className="size-4" />
                        </button>
                      </div>

                      {/* Show On */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Show on</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 3 }}>
                          {['termly', 'mid-term', 'cummulative'].map((view) => {
                            const views = ['termly', 'mid-term', 'cummulative']
                            const showOn = selectedEl?.showOn || views
                            const checked = showOn.includes(view)
                            return (
                              <label key={view} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const newShowOn = e.target.checked
                                      ? [...new Set([...showOn, view])]
                                      : showOn.filter((v: string) => v !== view)
                                    updateElement(selectedEl!.id, { showOn: newShowOn })
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                                <span style={{ textTransform: 'capitalize' }}>{view === 'termly' ? 'Term' : view === 'mid-term' ? 'Mid-term' : 'Cumulative'}</span>
                              </label>
                            )
                          })}
                        </div>
                      </div>

                      {/* Subject Table Settings */}
                      {selectedEl?.type === 'table' && (
                        <div style={{ marginBottom: 10, border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#f8fafc' }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Subject Table Settings</label>

                          {/* CA / Exam Weights */}
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

                          {/* Subject Selection */}
                          <label style={{ fontSize: 9, color: 'var(--mist)', display: 'block', marginBottom: 4 }}>Subjects</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 120, overflowY: 'auto', padding: 2 }}>
                            {subjectOptions.map((s) => {
                              const name = String(s.name ?? '')
                              const selectedSubjects = (selectedEl.style?.subjects as string[]) || []
                              const checked = selectedSubjects.includes(name)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    const newSubjects = checked
                                      ? selectedSubjects.filter((sub: string) => sub !== name)
                                      : [...selectedSubjects, name]
                                    updateStyle(selectedEl!.id, 'subjects', newSubjects)
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
                        </div>
                      )}

                      {/* Text Content */}
                      {(selectedEl?.type === 'header' || selectedEl?.type === 'text' || selectedEl?.type === 'custom_text' || selectedEl?.type === 'custom_heading') && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Text</label>
                          <Input
                            value={selectedEl.text || selectedEl.label}
                            onChange={(e) => updateElement(selectedEl!.id, { text: e.target.value })}
                            placeholder="Enter text…"
                            style={{ fontSize: 12 }}
                          />
                        </div>
                      )}

                      {/* Font controls */}
                      {(selectedEl?.type === 'header' || selectedEl?.type === 'text' || selectedEl?.type === 'custom_text' || selectedEl?.type === 'custom_heading') && (
                        <div style={{ marginBottom: 10 }}>
                          <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Font</label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 3 }}>
                            <Select
                              value={(selectedEl.style?.fontFamily as string) || 'Arial'}
                              onChange={(e) => updateStyle(selectedEl!.id, 'fontFamily', e.target.value)}
                              style={{ fontSize: 12 }}
                            >
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
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Size</label>
                              <Input type="number" min={6} max={72} value={(selectedEl.style?.fontSize as number) ?? 12} onChange={(e) => updateStyle(selectedEl!.id, 'fontSize', Number(e.target.value))} style={{ fontSize: 12 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 9, color: 'var(--mist)' }}>Color</label>
                              <ColorPicker value={(selectedEl.style?.color as string) || '#000000'} onChange={(v) => updateStyle(selectedEl!.id, 'color', v)} />
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

                      {/* Fill color */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>{selectedEl?.type === 'divider' ? 'Line color' : 'Fill color'}</label>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                          <div style={{ flex: 1 }}>
                            <ColorPicker value={(selectedEl?.style?.bg as string) || '#ffffff'} onChange={(v) => updateStyle(selectedEl!.id, 'bg', v)} />
                          </div>
                          <button type="button" onClick={() => updateStyle(selectedEl!.id, 'bg', 'transparent')} className="rounded border border-line px-1.5 py-0.5 text-[11px] text-mist hover:bg-slate-100 dark:hover:bg-zinc-800" style={{ height: 32, flexShrink: 0 }}>Transparent</button>
                        </div>
                      </div>

                      {/* Border & spacing */}
                      {selectedEl?.type !== 'divider' && (
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

                      {/* Align to page */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Align to page</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 3 }}>
                          {[['left', 'Left'], ['center', 'C'], ['right', 'Right'], ['top', 'Top'], ['middle', 'Mid'], ['bottom', 'Bottom']].map(([key, label]) => (
                            <button key={key} type="button" disabled={selectedEl?.locked} onClick={() => {
                              const A4_W = pageSize.w, A4_H = pageSize.h
                              let x = selectedEl!.x, y = selectedEl!.y
                              if (key === 'left') x = 0
                              if (key === 'center') x = Math.max(0, (A4_W - selectedEl!.width) / 2)
                              if (key === 'right') x = Math.max(0, A4_W - selectedEl!.width)
                              if (key === 'top') y = 0
                              if (key === 'middle') y = Math.max(0, (A4_H - selectedEl!.height) / 2)
                              if (key === 'bottom') y = Math.max(0, A4_H - selectedEl!.height)
                              updateElement(selectedEl!.id, { x, y })
                            }} className="rounded border border-line px-1 py-0.5 text-[10px] text-mist hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-40">{label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Lock & Position */}
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginBottom: 6 }}>
                          <input type="checkbox" checked={!!selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { locked: e.target.checked })} style={{ cursor: 'pointer' }} />
                          Lock position and size
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>X</label>
                            <Input type="number" value={selectedEl?.x} disabled={selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { x: Math.max(0, Number(e.target.value)) })} style={{ fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>Y</label>
                            <Input type="number" value={selectedEl?.y} disabled={selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { y: Math.max(0, Number(e.target.value)) })} style={{ fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>W</label>
                            <Input type="number" value={selectedEl?.width} disabled={selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { width: Math.max(20, Number(e.target.value)) })} style={{ fontSize: 12 }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 9, color: 'var(--mist)' }}>H</label>
                            <Input type="number" value={selectedEl?.height} disabled={selectedEl?.locked} onChange={(e) => updateElement(selectedEl!.id, { height: Math.max(20, Number(e.target.value)) })} style={{ fontSize: 12 }} />
                          </div>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button type="button" onClick={() => deleteElement(selectedEl!.id)} className="w-full rounded border border-red-500/30 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/10">
                        <Trash2 className="size-3 inline mr-1" /> Remove Element
                      </button>
                    </div>
                  )}
                </div>

                {/* Canvas area */}
                <div className="bg-slate-200 dark:bg-zinc-700" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: 24, display: 'block' }}>
                  {/* Canvas toolbar */}
                  <div className="bg-white dark:bg-zinc-800" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', borderRadius: 8, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{previewTheme ? previewTheme.name : 'Canvas'}</span>
                      <span style={{ fontSize: 10, color: 'var(--mist)' }}>A4 · {pageOrientation === 'portrait' ? '794×1123' : '1123×794'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {selectedElement && (
                        <button type="button" onClick={() => deleteElement(selectedElement)} className="rounded border border-red-500/30 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/10">
                          <Trash2 className="size-3 inline mr-1" /> Delete
                        </button>
                      )}
                      {previewTheme && (
                        <button type="button" onClick={() => setEditMode(!editMode)} className={`rounded border px-2 py-0.5 text-xs font-medium transition ${editMode ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'border-line text-mist hover:border-indigo-400/60'}`}>
                          <Pencil className="size-3 inline mr-1" /> {editMode ? 'Preview' : 'Edit'}
                        </button>
                      )}
                      <button type="button" onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="rounded border border-line px-2 py-0.5 text-xs text-mist">–</button>
                      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                      <button type="button" onClick={() => setZoom(Math.min(1.5, zoom + 0.1))} className="rounded border border-line px-2 py-0.5 text-xs text-mist">+</button>
                      <button type="button" onClick={() => setZoom(0.75)} className="rounded border border-line px-2 py-0.5 text-xs text-mist">Fit</button>
                    </div>
                  </div>

                  {/* A4 Canvas — always renders ReportsheetSheetRenderer for all 6 themes */}
                  {/* Selection outline + cursor style for renderer elements */}
                  <style>{`
                    [data-element-id] { cursor: pointer; }
                    ${selectedElement ? `[data-element-id="${selectedElement}"] { outline: 2px solid #136ee5 !important; outline-offset: 1px; }` : ''}
                  `}</style>
                  <div
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    style={{
                      background: certificateColor || '#fff', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      width: 560 * zoom, height: 780 * zoom,
                      position: 'relative', overflow: 'hidden',
                      border: '1px solid #d1d5db',
                      margin: '0 auto',
                    }}
                  >
                    {/* Render the actual theme renderer — handles all 6 themes perfectly */}
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 560, height: 780, position: 'relative' }}
                      onDragOver={handleCanvasDragOver}
                      onDrop={handleCanvasDrop}
                    >
                      <ReportsheetSheetRenderer
                        themeId={previewTheme?.id || 'theme-1'}
                        schoolName={canvasSettings.schoolName}
                        schoolAddress={canvasSettings.schoolAddress}
                        examName={canvasSettings.reportTitle || reportName || 'First Term Examination'}
                        academicYear={canvasSettings.academicYear || '2026/2027'}
                        termLabel={canvasSettings.term || '1'}
                        topSpace={String(canvasSettings.marginTop)}
                        bottomSpace={String(canvasSettings.marginBottom)}
                        leftSpace={String(canvasSettings.marginLeft)}
                        rightSpace={String(canvasSettings.marginRight)}
                        logoDataUrl={canvasSettings.schoolLogo || undefined}
                        subjects={tableEl?.style?.subjects as string[] | undefined}
                        caWeight={(tableEl?.style?.caWeight as number) ?? 30}
                        examWeight={(tableEl?.style?.examWeight as number) ?? 70}
                        showPosition={tableEl?.style?.showPosition !== false}
                        showGrade={tableEl?.style?.showGrade !== false}
                        showRemark={tableEl?.style?.showRemark !== false}
                        showClassAvg={tableEl?.style?.showClassAvg !== false}
                        showSubjectAvg={tableEl?.style?.showSubjectAvg !== false}
                      />

                      {/* Render drag-added elements as absolutely positioned boxes */}
                      {canvasElements.filter(el => el.id.startsWith('id_')).map(el => {
                        const isSel = selectedElement === el.id
                        const baseStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: el.x,
                          top: el.y,
                          width: el.width,
                          height: el.height,
                          cursor: 'move',
                          userSelect: 'none',
                          border: isSel ? '2px solid #136ee5' : '1px dashed #94a3b8',
                          borderRadius: 4,
                          background: el.type === 'divider' ? 'transparent' : 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          color: '#475569',
                          padding: 4,
                          overflow: 'hidden',
                          zIndex: 10,
                        }
                        // 8 resize handles: 4 corners + 4 edges
                        const handles = isSel && el.type !== 'divider' ? (() => {
                          const hs = { width: 8, height: 8, background: '#fff', border: '1px solid #136ee5', borderRadius: 2, zIndex: 11, position: 'absolute' as const }
                          return [
                            { c: 'nw', l: 0, t: 0, cur: 'nwse-resize', hw: 8, hh: 8 },
                            { c: 'n', l: 'calc(50% - 4px)', t: -4, cur: 'ns-resize', hw: 8, hh: 8 },
                            { c: 'ne', l: el.width - 8, t: 0, cur: 'nesw-resize', hw: 8, hh: 8 },
                            { c: 'e', l: el.width - 4, t: 'calc(50% - 4px)', cur: 'ew-resize', hw: 8, hh: 8 },
                            { c: 'se', l: el.width - 8, t: el.height - 8, cur: 'nwse-resize', hw: 8, hh: 8 },
                            { c: 's', l: 'calc(50% - 4px)', t: el.height - 4, cur: 'ns-resize', hw: 8, hh: 8 },
                            { c: 'sw', l: 0, t: el.height - 8, cur: 'nesw-resize', hw: 8, hh: 8 },
                            { c: 'w', l: -4, t: 'calc(50% - 4px)', cur: 'ew-resize', hw: 8, hh: 8 },
                          ]
                        })() : null
                        const handleEls = handles ? handles.map(h => (
                          <div key={h.c} data-resize-handle="1" style={{ ...baseStyle, ...{ left: 0, top: 0, width: h.hw, height: h.hh, cursor: h.cur, border: '1px solid #136ee5', background: '#fff', borderRadius: 2, zIndex: 11 }, left: h.l, top: h.t, width: 8, height: 8, position: 'absolute' }} onMouseDown={(ev) => { ev.stopPropagation(); handleResizeMouseDown(ev, el, h.c as any) }} />
                        )) : null
                        const deleteBtn = isSel ? (
                          <button type="button" data-resize-handle="1" onClick={(ev) => { ev.stopPropagation(); deleteElement(el.id) }} onMouseDown={(ev) => ev.stopPropagation()} style={{ position: 'absolute', left: el.width - 14, top: -14, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', zIndex: 12, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(239,68,68,0.4)', lineHeight: 1 }}>
                            <Trash2 className="size-3" />
                          </button>
                        ) : null
                        if (el.type === 'divider') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, borderTop: '2px solid #94a3b8', border: 'none', height: el.height, background: 'transparent' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{deleteBtn}</div>
                        }
                        if (el.type === 'custom_heading') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, fontSize: 16, fontWeight: 700, color: '#1e293b' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                        }
                        if (el.type === 'image') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, background: '#f1f5f9', color: '#94a3b8', fontSize: 10 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.label}{handleEls}{deleteBtn}</div>
                        }
                        if (el.type === 'table') {
                          const caW = (el.style?.caWeight as number) ?? 30
                          const exW = (el.style?.examWeight as number) ?? 70
                          const showPos = el.style?.showPosition !== false
                          const showRem = el.style?.showRemark !== false
                          const showAvg = el.style?.showClassAvg !== false
                          const subjList = (el.style?.subjects as string[]) || SAMPLE_SUBJECTS.map(s => s.subject)
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, background: '#fff', color: '#1e293b', fontSize: 9, flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '30%' }}>Subject</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>CA ({caW}%)</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>Exam ({exW}%)</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>Total</th>
                                  {showPos && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '8%' }}>Pos</th>}
                                  {showRem && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '16%' }}>Remark</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {subjList.slice(0, 6).map((subj, i) => {
                                  const base = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]
                                  const caScore = Math.round(base.ca * caW / 100 * 10) / 10
                                  const exScore = Math.round(base.exam * exW / 100 * 10) / 10
                                  const total = Math.round((caScore + exScore) * 10) / 10
                                  return (
                                    <tr key={subj}>
                                      <td style={{ padding: '3px 4px', fontSize: 8, border: '1px solid #e2e8f0' }}>{subj}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{caScore}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{exScore}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>{total}</td>
                                      {showPos && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{i + 1}</td>}
                                      {showRem && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 600, border: '1px solid #e2e8f0' }}>{remarkOf(total)}</td>}
                                    </tr>
                                  )
                                })}
                                {showAvg && (
                                  <tr style={{ background: '#e8eef4' }}>
                                    <td style={{ padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>Class Avg</td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => s + Math.round(SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length].ca * caW / 100 * 10) / 10, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => s + Math.round(SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length].exam * exW / 100 * 10) / 10, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => { const b = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]; return s + Math.round((Math.round(b.ca * caW / 100 * 10) / 10 + Math.round(b.exam * exW / 100 * 10) / 10) * 10) / 10 }, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    {showPos && <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0' }} />}
                                    {showRem && <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0' }} />}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {handleEls}{deleteBtn}
                          </div>
                        }
                        return <div key={el.id} data-canvas-element="1" style={baseStyle} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                      })}
                    </div>

                    {/* Delete button for selected element — red corner button, positioned via DOM measurement */}
                    {selectedElement && selectedElRect && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteElement(selectedElement) }}
                        style={{
                          position: 'absolute',
                          left: selectedElRect.left + selectedElRect.width - 14,
                          top: selectedElRect.top - 14,
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#ef4444', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700,
                          cursor: 'pointer', zIndex: 20,
                          border: '2px solid #fff',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                          lineHeight: 1,
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview (interactive canvas) */}
          {step === 2 && (
            <div className="bg-slate-50 dark:bg-zinc-800" style={{ padding: '32px 28px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)', marginBottom: 4 }}>Live Preview</h3>
              <p style={{ fontSize: 13, color: 'var(--mist)', marginBottom: 24 }}>
                Click an element to select · Use zoom controls on the left
              </p>

              {/* Interactive canvas */}
              <div style={{ display: 'flex', gap: 24 }}>
                {/* Canvas */}
                <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'auto' }}>
                  <style>{`
                    [data-element-id] { cursor: pointer; }
                    ${selectedElement ? `[data-element-id="${selectedElement}"] { outline: 2px solid #136ee5 !important; outline-offset: 1px; }` : ''}
                  `}</style>
                  <div
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onDragOver={handleCanvasDragOver}
                    onDrop={handleCanvasDrop}
                    style={{
                      background: certificateColor || '#fff', borderRadius: 8,
                      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                      width: 560 * zoom, height: 780 * zoom,
                      position: 'relative', overflow: 'hidden',
                      border: '1px solid #d1d5db',
                      margin: '0 auto',
                    }}
                  >
                    {/* Render the actual theme renderer — handles all 6 themes perfectly */}
                    <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 560, height: 780, position: 'relative' }}
                      onDragOver={handleCanvasDragOver}
                      onDrop={handleCanvasDrop}
                    >
                      <ReportsheetSheetRenderer
                        themeId={previewTheme?.id || 'theme-1'}
                        schoolName={canvasSettings.schoolName}
                        schoolAddress={canvasSettings.schoolAddress}
                        examName={canvasSettings.reportTitle || reportName || 'First Term Examination'}
                        academicYear={canvasSettings.academicYear || '2026/2027'}
                        termLabel={canvasSettings.term || '1'}
                        topSpace={String(canvasSettings.marginTop)}
                        bottomSpace={String(canvasSettings.marginBottom)}
                        leftSpace={String(canvasSettings.marginLeft)}
                        rightSpace={String(canvasSettings.marginRight)}
                        logoDataUrl={canvasSettings.schoolLogo || undefined}
                        subjects={tableEl?.style?.subjects as string[] | undefined}
                        caWeight={(tableEl?.style?.caWeight as number) ?? 30}
                        examWeight={(tableEl?.style?.examWeight as number) ?? 70}
                        showPosition={tableEl?.style?.showPosition !== false}
                        showGrade={tableEl?.style?.showGrade !== false}
                        showRemark={tableEl?.style?.showRemark !== false}
                        showClassAvg={tableEl?.style?.showClassAvg !== false}
                        showSubjectAvg={tableEl?.style?.showSubjectAvg !== false}
                      />

                      {/* Render drag-added elements as absolutely positioned boxes */}
                      {canvasElements.filter(el => el.id.startsWith('id_')).map(el => {
                        const isSel = selectedElement === el.id
                        const baseStyle: React.CSSProperties = {
                          position: 'absolute',
                          left: el.x,
                          top: el.y,
                          width: el.width,
                          height: el.height,
                          cursor: 'move',
                          userSelect: 'none',
                          border: isSel ? '2px solid #136ee5' : '1px dashed #94a3b8',
                          borderRadius: 4,
                          background: el.type === 'divider' ? 'transparent' : 'rgba(255,255,255,0.9)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          color: '#475569',
                          padding: 4,
                          overflow: 'hidden',
                          zIndex: 10,
                        }
                        // 8 resize handles: 4 corners + 4 edges
                        const handles = isSel && el.type !== 'divider' ? (() => {
                          const hs = { width: 8, height: 8, background: '#fff', border: '1px solid #136ee5', borderRadius: 2, zIndex: 11, position: 'absolute' as const }
                          return [
                            { c: 'nw', l: 0, t: 0, cur: 'nwse-resize', hw: 8, hh: 8 },
                            { c: 'n', l: 'calc(50% - 4px)', t: -4, cur: 'ns-resize', hw: 8, hh: 8 },
                            { c: 'ne', l: el.width - 8, t: 0, cur: 'nesw-resize', hw: 8, hh: 8 },
                            { c: 'e', l: el.width - 4, t: 'calc(50% - 4px)', cur: 'ew-resize', hw: 8, hh: 8 },
                            { c: 'se', l: el.width - 8, t: el.height - 8, cur: 'nwse-resize', hw: 8, hh: 8 },
                            { c: 's', l: 'calc(50% - 4px)', t: el.height - 4, cur: 'ns-resize', hw: 8, hh: 8 },
                            { c: 'sw', l: 0, t: el.height - 8, cur: 'nesw-resize', hw: 8, hh: 8 },
                            { c: 'w', l: -4, t: 'calc(50% - 4px)', cur: 'ew-resize', hw: 8, hh: 8 },
                          ]
                        })() : null
                        const handleEls = handles ? handles.map(h => (
                          <div key={h.c} data-resize-handle="1" style={{ ...baseStyle, ...{ left: 0, top: 0, width: h.hw, height: h.hh, cursor: h.cur, border: '1px solid #136ee5', background: '#fff', borderRadius: 2, zIndex: 11 }, left: h.l, top: h.t, width: 8, height: 8, position: 'absolute' }} onMouseDown={(ev) => { ev.stopPropagation(); handleResizeMouseDown(ev, el, h.c as any) }} />
                        )) : null
                        const deleteBtn = isSel ? (
                          <button type="button" data-resize-handle="1" onClick={(ev) => { ev.stopPropagation(); deleteElement(el.id) }} onMouseDown={(ev) => ev.stopPropagation()} style={{ position: 'absolute', left: el.width - 14, top: -14, width: 24, height: 24, borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer', zIndex: 12, border: '2px solid #fff', boxShadow: '0 2px 6px rgba(239,68,68,0.4)', lineHeight: 1 }}>
                            <Trash2 className="size-3" />
                          </button>
                        ) : null
                        if (el.type === 'divider') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, borderTop: '2px solid #94a3b8', border: 'none', height: el.height, background: 'transparent' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{deleteBtn}</div>
                        }
                        if (el.type === 'custom_heading') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, fontSize: 16, fontWeight: 700, color: '#1e293b' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                        }
                        if (el.type === 'image') {
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, background: '#f1f5f9', color: '#94a3b8', fontSize: 10 }} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.label}{handleEls}{deleteBtn}</div>
                        }
                        if (el.type === 'table') {
                          const caW = (el.style?.caWeight as number) ?? 30
                          const exW = (el.style?.examWeight as number) ?? 70
                          const showPos = el.style?.showPosition !== false
                          const showRem = el.style?.showRemark !== false
                          const showAvg = el.style?.showClassAvg !== false
                          const subjList = (el.style?.subjects as string[]) || SAMPLE_SUBJECTS.map(s => s.subject)
                          return <div key={el.id} data-canvas-element="1" style={{ ...baseStyle, background: '#fff', color: '#1e293b', fontSize: 9, flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' }} onMouseDown={(e) => handleElementMouseDown(e, el)}>
                            <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ background: '#f1f5f9' }}>
                                  <th style={{ textAlign: 'left', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '30%' }}>Subject</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>CA ({caW}%)</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>Exam ({exW}%)</th>
                                  <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '18%' }}>Total</th>
                                  {showPos && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '8%' }}>Pos</th>}
                                  {showRem && <th style={{ textAlign: 'center', padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0', width: '16%' }}>Remark</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {subjList.slice(0, 6).map((subj, i) => {
                                  const base = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]
                                  const caScore = Math.round(base.ca * caW / 100 * 10) / 10
                                  const exScore = Math.round(base.exam * exW / 100 * 10) / 10
                                  const total = Math.round((caScore + exScore) * 10) / 10
                                  return (
                                    <tr key={subj}>
                                      <td style={{ padding: '3px 4px', fontSize: 8, border: '1px solid #e2e8f0' }}>{subj}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{caScore}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{exScore}</td>
                                      <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>{total}</td>
                                      {showPos && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, border: '1px solid #e2e8f0' }}>{i + 1}</td>}
                                      {showRem && <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 600, border: '1px solid #e2e8f0' }}>{remarkOf(total)}</td>}
                                    </tr>
                                  )
                                })}
                                {showAvg && (
                                  <tr style={{ background: '#e8eef4' }}>
                                    <td style={{ padding: '3px 4px', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>Class Avg</td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => s + Math.round(SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length].ca * caW / 100 * 10) / 10, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => s + Math.round(SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length].exam * exW / 100 * 10) / 10, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    <td style={{ padding: '3px 4px', textAlign: 'center', fontSize: 8, fontWeight: 700, border: '1px solid #e2e8f0' }}>
                                      {subjList.slice(0, 6).length > 0 ? (subjList.slice(0, 6).reduce((s, _, i) => { const b = SAMPLE_SUBJECTS[i % SAMPLE_SUBJECTS.length]; return s + Math.round((Math.round(b.ca * caW / 100 * 10) / 10 + Math.round(b.exam * exW / 100 * 10) / 10) * 10) / 10 }, 0) / subjList.slice(0, 6).length).toFixed(1) : '—'}
                                    </td>
                                    {showPos && <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0' }} />}
                                    {showRem && <td style={{ padding: '3px 4px', border: '1px solid #e2e8f0' }} />}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {handleEls}{deleteBtn}
                          </div>
                        }
                        return <div key={el.id} data-canvas-element="1" style={baseStyle} onMouseDown={(e) => handleElementMouseDown(e, el)}>{el.text || el.label}{handleEls}{deleteBtn}</div>
                      })}
                    </div>

                    {/* Delete button for selected element — red corner button, positioned via DOM measurement */}
                    {selectedElement && selectedElRect && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteElement(selectedElement) }}
                        style={{
                          position: 'absolute',
                          left: selectedElRect.left + selectedElRect.width - 14,
                          top: selectedElRect.top - 14,
                          width: 28, height: 28, borderRadius: '50%',
                          background: '#ef4444', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18, fontWeight: 700,
                          cursor: 'pointer', zIndex: 20,
                          border: '2px solid #fff',
                          boxShadow: '0 2px 8px rgba(239,68,68,0.4)',
                          lineHeight: 1,
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
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
                    <button type="button" onClick={() => setSelectedElement(null)} className="rounded p-1 text-mist hover:bg-slate-100 dark:hover:bg-zinc-800">
                      <X className="size-4" />
                    </button>
                  </div>

                  {/* Show On */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Show on</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {['termly', 'mid-term', 'cummulative'].map((view) => {
                        const views = ['termly', 'mid-term', 'cummulative']
                        const showOn = selectedEl.showOn || views
                        const checked = showOn.includes(view)
                        return (
                          <label key={view} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const newShowOn = e.target.checked
                                  ? [...new Set([...showOn, view])]
                                  : showOn.filter((v: string) => v !== view)
                                updateElement(selectedEl.id, { showOn: newShowOn })
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span style={{ textTransform: 'capitalize' }}>{view === 'termly' ? 'Term result' : view === 'mid-term' ? 'Mid-term result' : 'Cumulative result'}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Text Content */}
                  {(selectedEl.type === 'header' || selectedEl.type === 'text' || selectedEl.type === 'custom_text' || selectedEl.type === 'custom_heading') && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>Text Content</label>
                      <Input
                        value={selectedEl.text || selectedEl.label}
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

                  {/* Fill color */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--mist)', textTransform: 'uppercase' }}>
                      {selectedEl.type === 'divider' ? 'Line color' : 'Fill color'}
                    </label>
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

                  {/* Border & spacing */}
                  {selectedEl.type !== 'divider' && (
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
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Position X</label>
                        <Input
                          type="number"
                          value={selectedEl.x}
                          disabled={selectedEl.locked}
                          onChange={(e) => updateElement(selectedEl.id, { x: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Position Y</label>
                        <Input
                          type="number"
                          value={selectedEl.y}
                          disabled={selectedEl.locked}
                          onChange={(e) => updateElement(selectedEl.id, { y: Math.max(0, Number(e.target.value)) })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Width (px)</label>
                        <Input
                          type="number"
                          value={selectedEl.width}
                          disabled={selectedEl.locked}
                          onChange={(e) => updateElement(selectedEl.id, { width: Math.max(20, Number(e.target.value)) })}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: 'var(--mist)' }}>Height (px)</label>
                        <Input
                          type="number"
                          value={selectedEl.height}
                          disabled={selectedEl.locked}
                          onChange={(e) => updateElement(selectedEl.id, { height: Math.max(20, Number(e.target.value)) })}
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
                          const checked = !cfg.columns || cfg.columns[c] !== false
                          return (
                            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#333' }}>
                              <input
                                type="checkbox"
                                defaultChecked={checked}
                                onChange={(e) => {
                                  const nextCols = { ...cfg.columns }
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

        {/* Footer with navigation */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 28px', borderTop: '1px solid var(--line)',
            background: 'transparent',
          }}
        >
          <div>
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={prev}>
                <ArrowLeft className="size-4" /> Previous
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step < WIZARD_STEPS.length - 1 ? (
              <Button variant="primary" size="sm" onClick={next}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
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
