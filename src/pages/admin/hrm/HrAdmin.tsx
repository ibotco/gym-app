import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Settings2, GraduationCap, ChevronDown, Download, FileText, FileSpreadsheet,
  Printer, Pencil, List, ChevronsUpDown, Loader2, AlertCircle, Check,
} from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, DatePicker, TimePicker } from '../../../components/ui'
import {
  useState, useRef, useEffect, useMemo, type ReactNode, type ComponentType,
} from 'react'
import { cn } from '../../../lib/utils'
import { exportExcel } from '../../../lib/export'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Status = 'Active' | 'Inactive'
type Row = Record<string, any> & { status: Status }

type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'date' | 'time' | 'radio'

type FieldDef = {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  /** Custom validation - returns error string or null */
  validate?: (v: any, all: Record<string, any>) => string | null
  /** How to render this value in a table cell (defaults to plain text) */
  renderCell?: (v: any, row: Row) => ReactNode
  colWidth?: string
  /** Hide this field from the form (e.g. auto-managed) */
  formHidden?: boolean
  /** Hide this field from the table */
  tableHidden?: boolean
}

type ColumnDef = {
  key: string
  label: string
  render?: (row: Row, idx: number) => ReactNode
  width?: string
  align?: 'left' | 'right' | 'center'
}

type PageConfig = {
  key: string
  title: string
  singular: string
  fields: FieldDef[]
  columns: ColumnDef[]
  initial: Row[]
  /** Show the "No." sequential number column */
  showNumberCol?: boolean
  /** Include Set Order field */
  showOrder?: boolean
}

type AdminItem = { key: string; label: string; to: string; dividerAfter?: boolean }

// Slugify a page title into a safe filename (for exports).
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'export'
}

// ---------------------------------------------------------------------------
// Menu definitions
// ---------------------------------------------------------------------------
const JOB_SETTINGS: AdminItem[] = [
  { key: 'designation',        label: 'Designation',        to: '/admin/hrm/admin' },
  { key: 'job-title',          label: 'Job Title',          to: '/admin/hrm/admin/job-title' },
  { key: 'employment-status',  label: 'Employment Status',  to: '/admin/hrm/admin/employment-status', dividerAfter: true },
  { key: 'leave-period',       label: 'Leave Period',       to: '/admin/hrm/admin/leave-period' },
  { key: 'leave-type',         label: 'Leave Type',         to: '/admin/hrm/admin/leave-type' },
  { key: 'holidays',           label: 'Holidays',           to: '/admin/hrm/admin/holidays' },
  { key: 'work-week',          label: 'Work Week',          to: '/admin/hrm/admin/work-week', dividerAfter: true },
  { key: 'recruitment-status', label: 'Recruitment Status', to: '/admin/hrm/admin/recruitment-status' },
  { key: 'job-categories',     label: 'Job Categories',     to: '/admin/hrm/admin/job-categories' },
  { key: 'work-shifts',        label: 'Work Shifts',        to: '/admin/hrm/admin/work-shifts' },
]

const QUALIFICATIONS: AdminItem[] = [
  { key: 'skills',     label: 'Skills',     to: '/admin/hrm/admin/skills' },
  { key: 'education',  label: 'Education',  to: '/admin/hrm/admin/education' },
  { key: 'license',    label: 'License',    to: '/admin/hrm/admin/license' },
  { key: 'languages',  label: 'Languages',  to: '/admin/hrm/admin/languages' },
  { key: 'membership', label: 'Membership', to: '/admin/hrm/admin/membership' },
]

// ---------------------------------------------------------------------------
// Page configurations (form fields + table columns + seed data)
// ---------------------------------------------------------------------------
const NAME_FIELD = (label: string): FieldDef => ({
  name: 'name', label, type: 'text', required: true, placeholder: label,
})
const STATUS_FIELD: FieldDef = {
  name: 'status', label: 'Status', type: 'select', required: true,
  options: [{ value: 'Active', label: 'ACTIVE' }, { value: 'Inactive', label: 'INACTIVE' }],
}
const ORDER_FIELD: FieldDef = {
  name: '_order', label: 'Set Order', type: 'select', required: true, formHidden: false, tableHidden: true,
  placeholder: 'Please Select...',
  options: Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
}
const NAME_COL = (label: string): ColumnDef => ({ key: 'name', label })
const STATUS_COL: ColumnDef = {
  key: 'status', label: 'Status', width: 'w-28',
  render: (row) => (
    <span className={cn(
      'inline-block rounded-full px-3 py-0.5 text-xs font-bold',
      row.status === 'Active'
        ? 'bg-emerald-500/15 text-emerald-600'
        : 'bg-zinc-500/15 text-zinc-500',
    )}>{row.status}</span>
  ),
}

/** Build a simple "name-only" page (Designation, Employment Status, etc.) */
function simplePage(key: string, title: string, initial: Row[], showOrder = true): PageConfig {
  return {
    key, title, singular: title,
    fields: [NAME_FIELD(title), ...(showOrder ? [ORDER_FIELD] : []), STATUS_FIELD],
    columns: [NAME_COL(title), STATUS_COL],
    initial,
    showNumberCol: false,
    showOrder,
  }
}

const PAGES: Record<string, PageConfig> = {
  // ---- Job Settings ----
  designation: simplePage('designation', 'Designation', [
    { name: 'General User',  status: 'Active' },
    { name: 'Account Officer', status: 'Active' },
    { name: 'Administrator', status: 'Active' },
    { name: 'District Clerk', status: 'Active' },
    { name: 'Area Head',     status: 'Active' },
    { name: 'Manager',       status: 'Active' },
    { name: 'Receptionist',  status: 'Active' },
    { name: 'Trainer',       status: 'Active' },
  ]),

  'job-title': {
    key: 'job-title', title: 'Job Title', singular: 'Job Title',
    fields: [
      NAME_FIELD('Job Title'),
      {
        name: 'description', label: 'Description', type: 'textarea', required: true,
        validate: (v) => (!v || !String(v).trim() ? 'please provide description' : null),
      },
      ORDER_FIELD, STATUS_FIELD,
    ],
    columns: [
      NAME_COL('Job Title'),
      { key: 'description', label: 'Description', render: (r) => r.description || '—' },
      STATUS_COL,
    ],
    initial: [
      { name: 'HR Manager',               description: 'HR Manager',               status: 'Active' },
      { name: 'Account Officer',          description: 'Account Officer',          status: 'Active' },
      { name: 'Administrator',            description: 'Administrator',            status: 'Active' },
      { name: 'IT Manager',               description: 'IT Manager',               status: 'Active' },
      { name: 'Social Media Marketer',    description: 'Social Media Marketer',    status: 'Active' },
      { name: 'Trainer',                  description: 'Trainer',                  status: 'Active' },
      { name: 'Receptionist',             description: 'Receptionist',             status: 'Active' },
      { name: 'Branch Manager',           description: 'Branch Manager',           status: 'Active' },
    ],
    showNumberCol: true, showOrder: true,
  },

  'employment-status': simplePage('employment-status', 'Employment Status', [
    { name: 'Permanent',   status: 'Active' },
    { name: 'Probation',   status: 'Active' },
    { name: 'Contract',    status: 'Active' },
    { name: 'Temporary',   status: 'Active' },
    { name: 'Part Time',   status: 'Active' },
    { name: 'Intern',      status: 'Active' },
  ]),

  'leave-period': {
    key: 'leave-period', title: 'Leave Period', singular: 'Leave Period',
    fields: [
      { name: 'startDate', label: 'Start Date', type: 'date' as FieldType, required: true },
      { name: 'endDate',   label: 'End Date',   type: 'date' as FieldType, required: true },
      STATUS_FIELD,
    ],
    columns: [
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate',   label: 'End Date' },
      {
        key: 'status', label: 'Status', width: 'w-28',
        render: (row) => (
          <span className={cn(
            'inline-block rounded-full px-3 py-0.5 text-xs font-bold',
            row.status === 'Active'
              ? 'bg-emerald-500/15 text-emerald-600'
              : 'bg-amber-400/20 text-amber-700',
          )}>{row.status === 'Active' ? 'Active' : 'Inactive'}</span>
        ),
      },
    ],
    initial: [
      { startDate: '2024-01-01', endDate: '2024-12-31', status: 'Active' },
      { startDate: '2025-01-01', endDate: '2025-12-31', status: 'Inactive' },
    ],
    showNumberCol: true, showOrder: false,
  },

  'leave-type': {
    key: 'leave-type', title: 'Leave Type', singular: 'Leave Type',
    fields: [
      NAME_FIELD('Leave Type'),
      {
        name: 'days', label: 'Number Of Days', type: 'number', required: false,
        placeholder: '', min: 0, max: 365,
        renderCell: (v) => (v == null || v === '' ? '' : String(v)),
      },
      STATUS_FIELD,
    ],
    columns: [
      NAME_COL('Leave Type'),
      { key: 'days', label: 'Number Of Days', align: 'left', render: (r) => (r.days == null || r.days === '' ? '' : String(r.days)) },
      STATUS_COL,
    ],
    initial: [
      { name: 'Bereavement',              days: 8,  status: 'Active' },
      { name: 'Leave Without Pay',       days: '', status: 'Active' },
      { name: 'Maternity Leave',         days: 90, status: 'Active' },
      { name: 'Paternal Leave',          days: 7,  status: 'Active' },
      { name: 'Personal (Casual Leave)', days: 21, status: 'Active' },
      { name: 'Sick Leave',              days: 10, status: 'Active' },
      { name: 'Annual Leave',            days: 20, status: 'Active' },
    ],
    showNumberCol: true, showOrder: false,
  },

  holidays: {
    key: 'holidays', title: 'Holidays', singular: 'Holiday',
    fields: [
      { name: 'name', label: 'Holiday Name', type: 'text', required: true, placeholder: 'e.g. Independence Day' },
      { name: 'startDate', label: 'Start Date', type: 'date' as FieldType, required: true },
      { name: 'endDate',   label: 'End Date',   type: 'date' as FieldType, required: false },
      {
        name: 'repeatAnnually', label: 'Repeat Annually', type: 'radio' as FieldType, required: true,
        options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }],
      },
      STATUS_FIELD,
    ],
    columns: [
      { key: 'name', label: 'Holiday Name' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate',   label: 'End Date', render: (r) => r.endDate || '—' },
      STATUS_COL,
    ],
    initial: [
      { name: 'New Year\'s Day',     startDate: '2026-01-01', endDate: '',           repeatAnnually: '1', status: 'Active' },
      { name: 'Independence Day',    startDate: '2026-03-06', endDate: '',           repeatAnnually: '1', status: 'Active' },
      { name: 'Good Friday',         startDate: '2026-04-03', endDate: '',           repeatAnnually: '1', status: 'Active' },
      { name: 'Easter Monday',       startDate: '2026-04-06', endDate: '',           repeatAnnually: '1', status: 'Active' },
      { name: 'Christmas Day',       startDate: '2026-12-25', endDate: '2026-12-26', repeatAnnually: '1', status: 'Active' },
    ],
    showNumberCol: true, showOrder: false,
  },

  'work-week': {
    key: 'work-week', title: 'Work Week', singular: 'Work Week',
    fields: [NAME_FIELD('Work Week'), STATUS_FIELD],
    columns: [NAME_COL('Work Week'), STATUS_COL],
    initial: [
      { name: 'Monday - Friday',  status: 'Active' },
      { name: 'Monday - Saturday', status: 'Active' },
    ],
    showNumberCol: true, showOrder: false,
  },

  'recruitment-status': simplePage('recruitment-status', 'Recruitment Status', [
    { name: 'Applied',    status: 'Active' },
    { name: 'Shortlisted', status: 'Active' },
    { name: 'Interviewed', status: 'Active' },
    { name: 'Offered',    status: 'Active' },
    { name: 'Hired',      status: 'Active' },
    { name: 'Rejected',   status: 'Inactive' },
  ]),

  'job-categories': simplePage('job-categories', 'Job Categories', [
    { name: 'Management',    status: 'Active' },
    { name: 'Technical',     status: 'Active' },
    { name: 'Administrative', status: 'Active' },
    { name: 'Operations',    status: 'Active' },
    { name: 'Sales',         status: 'Active' },
  ]),

  'work-shifts': {
    key: 'work-shifts', title: 'Work Shifts', singular: 'Work Shift',
    fields: [
      NAME_FIELD('Work Shift'),
      { name: 'startTime', label: 'Start Time', type: 'time' as FieldType, required: true },
      { name: 'endTime',   label: 'End Time',   type: 'time' as FieldType, required: true },
      STATUS_FIELD,
    ],
    columns: [
      NAME_COL('Work Shift'),
      { key: 'startTime', label: 'Start Time' },
      { key: 'endTime',   label: 'End Time' },
      STATUS_COL,
    ],
    initial: [
      { name: 'Morning Shift', startTime: '06:00', endTime: '14:00', status: 'Active' },
      { name: 'Day Shift',     startTime: '08:00', endTime: '17:00', status: 'Active' },
      { name: 'Afternoon Shift', startTime: '14:00', endTime: '22:00', status: 'Active' },
      { name: 'Night Shift',   startTime: '22:00', endTime: '06:00', status: 'Active' },
    ],
    showNumberCol: true, showOrder: false,
  },

  // ---- Qualifications ----
  skills:     simplePage('skills',     'Skills',     [
    { name: 'Communication', status: 'Active' },
    { name: 'Leadership',    status: 'Active' },
    { name: 'Teamwork',      status: 'Active' },
  ]),
  education:  simplePage('education',  'Education',  [
    { name: 'High School',     status: 'Active' },
    { name: 'Diploma',         status: 'Active' },
    { name: 'Bachelor Degree', status: 'Active' },
    { name: 'Master Degree',   status: 'Active' },
    { name: 'PhD',             status: 'Active' },
  ]),
  license:    simplePage('license',    'License',    [
    { name: 'Driver License',   status: 'Active' },
    { name: 'First Aid / CPR',  status: 'Active' },
    { name: 'Professional Cert', status: 'Active' },
  ]),
  languages:  simplePage('languages',  'Languages',  [
    { name: 'English', status: 'Active' },
    { name: 'French',  status: 'Active' },
    { name: 'Twi',     status: 'Active' },
  ]),
  membership: simplePage('membership', 'Membership', [
    { name: 'Chartered Institute of HR', status: 'Active' },
    { name: 'Gym Instructors Assoc.',    status: 'Active' },
  ]),
}

// ---------------------------------------------------------------------------
// Toolbar dropdown (Job Settings / Qualifications)
// ---------------------------------------------------------------------------
function AdminDropdown({
  icon: Icon, label, items, activeKey, open, isActive, onToggle, onClose,
  externalRefs,
}: {
  icon: typeof Settings2; label: string; items: AdminItem[]; activeKey: string | null
  open: boolean; isActive: boolean; onToggle: () => void; onClose: () => void
  /** Optional refs of sibling dropdowns so click-outside doesn't prematurely
   *  close this dropdown when the user clicks a sibling's trigger/menu. */
  externalRefs?: React.RefObject<HTMLElement | null>[]
}) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return
      const tgt = e.target as Node
      if (ref.current.contains(tgt)) return
      if (externalRefs?.some((r) => r.current?.contains(tgt))) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose, externalRefs])

  // Trigger label/icon/chevron color:
  //  - ORANGE (#ff8a00) when this group's dropdown is open OR one of its
  //    sub-items is the currently active page.
  //  - WHITE (#ffffff) otherwise (idle state when the sibling group is active).
  const triggerColor = (open || isActive) ? '#ff8a00' : '#ffffff'

  return (
    <div ref={ref} className="relative z-[9999] inline-block">
      <button
        type="button" onClick={onToggle}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'hr-admin-toolbar-btn',
          open && 'is-open',
          (open || isActive) && 'is-active',
        )}
        aria-expanded={open}
      >
        <Icon className="size-[18px]" strokeWidth={2} />
        <span>{label}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-[9999] mt-0 w-64 overflow-hidden rounded-b-md border border-[#b8c0c8] border-t-transparent bg-white shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: '#ffffff' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {items.map((it) => {
            const active = activeKey === it.key
            return (
              <div key={it.key}>
                <button
                  type="button"
                  // Use onMouseDown + stopPropagation so the navigation
                  // fires BEFORE the document-level click-outside listener
                  // of sibling dropdowns can tear this panel out of the DOM
                  // (which was preventing the onClick/navigation from firing).
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const to = it.to
                    onClose()
                    requestAnimationFrame(() => navigate(to))
                  }}
                  style={{ backgroundColor: active ? '#337ab7' : '#ffffff', color: active ? '#ffffff' : '#2d353c' }}
                  className={cn(
                    'block w-full px-4 py-2.5 text-left text-[15px] leading-snug transition hover:!bg-[#e8eef5]',
                    active ? '!bg-[#337ab7] !text-white font-semibold hover:!bg-[#286090]' : '!bg-white !text-[#2d353c] font-normal',
                  )}
                >{it.label}</button>
                {it.dividerAfter && <div className="m-0 !border-t !border-[#e0e4e8]" style={{ borderTop: '1px solid #e0e4e8' }} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout wrapper — renders breadcrumbs, page title, two dropdowns, <Outlet/>
// ---------------------------------------------------------------------------
export function HrAdminLayout() {
  const loc = useLocation()
  const [openMenu, setOpenMenu] = useState<null | 'job' | 'qual'>(null)
  const [pageLoading, setPageLoading] = useState(false)
  const [lastPath, setLastPath] = useState(loc.pathname)

  const activeJob  = JOB_SETTINGS.find((j) => loc.pathname === j.to)?.key || null
  const activeQual = QUALIFICATIONS.find((q) => loc.pathname === q.to)?.key || null
  const activeKey  = activeJob ?? activeQual ?? 'designation'
  const allItems   = [...JOB_SETTINGS, ...QUALIFICATIONS]
  const title      = allItems.find((i) => i.key === activeKey)?.label || 'Designation'

  // Brief fade transition when switching sub-pages (simulates AJAX load)
  useEffect(() => {
    if (loc.pathname === lastPath) return
    setPageLoading(true)
    setLastPath(loc.pathname)
    const t = window.setTimeout(() => setPageLoading(false), 180)
    return () => window.clearTimeout(t)
  }, [loc.pathname, lastPath])

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <Link to="/admin/staff" className="hover:text-lime">Human Resource</Link>
        <span className="text-mist">/</span>
        <span className="font-semibold text-inherit">HR Admin</span>
      </div>

      <PageHeader title={title} desc="Configure HR job settings and employee qualifications." />

      <div className="relative z-[9998] mb-4 flex flex-wrap items-start gap-1">
        <AdminDropdown
          icon={Settings2} label="Job Settings" items={JOB_SETTINGS}
          activeKey={activeJob ?? 'designation'}
          isActive={!!activeJob}
          open={openMenu === 'job'}
          onToggle={() => setOpenMenu((o) => (o === 'job' ? null : 'job'))}
          onClose={() => setOpenMenu(null)}
        />
        <AdminDropdown
          icon={GraduationCap} label="Qualifications" items={QUALIFICATIONS}
          activeKey={activeQual}
          isActive={!!activeQual}
          open={openMenu === 'qual'}
          onToggle={() => setOpenMenu((o) => (o === 'qual' ? null : 'qual'))}
          onClose={() => setOpenMenu(null)}
        />
      </div>

      <div
        className={cn(
          'transition-all duration-200',
          pageLoading ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0',
        )}
      >
        <Outlet />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared CRUD list/form — driven by PageConfig
// ---------------------------------------------------------------------------
function SortIcon() { return <ChevronsUpDown className="ml-1 inline size-3 text-mist" strokeWidth={2} /> }

type CrudListProps = { config: PageConfig }

function CrudList({ config }: CrudListProps) {
  const { title, singular, fields, columns, initial, showNumberCol, showOrder } = config

  // --- State ---
  const [items, setItems] = useState<Row[]>(() => initial.map((r, i) => ({ ...r, _order: i + 1 })))
  const [q, setQ] = useState('')
  const [form, setForm] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [showEntries, setShowEntries] = useState(5)
  const [page, setPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [busy, setBusy] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const [done, setDone] = useState<'' | 'print' | 'pdf' | 'excel'>('')
  const printFrameRef = useRef<HTMLDivElement | null>(null)

  // Simulate AJAX load (keeps hook points for real API integration)
  useEffect(() => {
    setDataLoading(true)
    setLoadError(null)
    const t = window.setTimeout(() => {
      try {
        // In real integration: fetch(url).then(r => r.json()).then(setItems)
        setDataLoading(false)
      } catch (e: any) {
        setLoadError(e?.message || 'Failed to load data')
        setDataLoading(false)
      }
    }, 120)
    return () => window.clearTimeout(t)
  }, [config.key])

  // Reset pagination/search when switching pages
  useEffect(() => { setPage(1); setQ(''); resetForm() }, [config.key])

  // Editable fields (exclude auto-managed)
  const editableFields = fields.filter((f) => !f.formHidden)

  const resetForm = () => {
    const empty: Record<string, any> = { status: 'Active' }
    editableFields.forEach((f) => {
      if (f.name === 'status') return
      if (f.name === 'repeatAnnually') { empty[f.name] = '1'; return }
      empty[f.name] = ''
    })
    if (showOrder) empty._order = ''
    setForm(empty)
    setErrors({})
    setEditingIdx(null)
  }

  // --- Search / pagination ---
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return items
    return items.filter((it) =>
      editableFields.some((f) => String(it[f.name] ?? '').toLowerCase().includes(ql)),
    )
  }, [items, q, editableFields])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  const paged       = filtered.slice((page - 1) * showEntries, page * showEntries)
  const startIdx    = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1

  // --- CRUD handlers ---
  const validate = (data: Record<string, any>) => {
    const errs: Record<string, string> = {}
    editableFields.forEach((f) => {
      const v = data[f.name]
      if (f.required && (v == null || v === '')) {
        errs[f.name] = `${f.label} is required`
        return
      }
      if (f.type === 'number' && v !== '' && v != null) {
        const n = Number(v)
        if (Number.isNaN(n)) { errs[f.name] = 'Must be a number'; return }
        if (f.min != null && n < f.min) { errs[f.name] = `Minimum ${f.min}`; return }
        if (f.max != null && n > f.max) { errs[f.name] = `Maximum ${f.max}`; return }
      }
      if (f.validate) {
        const msg = f.validate(v, data)
        if (msg) errs[f.name] = msg
      }
    })
    return errs
  }

  const save = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    // Simulate AJAX save
    await new Promise((r) => setTimeout(r, 250))
    const clean: Row = { status: form.status || 'Active' }
    editableFields.forEach((f) => {
      if (f.name === 'status') return
      let v = form[f.name]
      if (f.type === 'number' && v !== '' && v != null) v = Number(v)
      clean[f.name] = v
    })
    if (editingIdx !== null) {
      const real = items.indexOf(paged[editingIdx])
      const copy = [...items]
      copy[real] = { ...copy[real], ...clean }
      setItems(copy)
    } else {
      const nextOrder = clean._order || Math.min(30, items.length + 1)
      setItems((prev) => [...prev, { ...clean, _order: nextOrder }])
    }
    setSaving(false)
    resetForm()
  }

  const edit = (pagedIdx: number) => {
    const real = items.indexOf(paged[pagedIdx])
    const it = items[real]
    const next: Record<string, any> = { status: it.status }
    editableFields.forEach((f) => { if (f.name !== 'status') next[f.name] = it[f.name] ?? '' })
    setForm(next)
    setErrors({})
    setEditingIdx(pagedIdx)
  }

  // --- Export helpers ---
  // Plain-text value for a cell — used for Print / PDF / Excel export so that
  // custom badge renders (Active/Inactive, etc.) become readable strings.
  const cellText = (row: Row, col: ColumnDef): string => {
    if (col.render) {
      // Try to extract from known badge patterns; fall back to raw key.
      const v = (row as any)[col.key]
      if (col.key === 'status') return String(v ?? '')
      return String(v ?? '')
    }
    const v = (row as any)[col.key]
    if (v == null) return ''
    if (Array.isArray(v)) return v.join(', ')
    return String(v)
  }

  const buildExportRows = (source: Row[]) => {
    const headers: string[] = []
    if (showNumberCol) headers.push('No.')
    columns.forEach((c) => headers.push(c.label))
    const rows = source.map((r, i) => {
      const obj: Record<string, unknown> = {}
      let col = 0
      if (showNumberCol) obj[headers[col++]] = i + 1
      columns.forEach((c) => { obj[headers[col++]] = cellText(r, c) })
      return obj
    })
    return rows
  }

  const flashDone = (which: 'print' | 'pdf' | 'excel') => {
    setDone(which)
    window.setTimeout(() => setDone(''), 1500)
  }

  const handlePrint = () => {
    setBusy('print')
    // Allow the hidden print block to render, then trigger print.
    window.setTimeout(() => {
      window.print()
      setBusy('')
      flashDone('print')
    }, 120)
  }

  const handlePdf = () => {
    // Same print stylesheet — user picks "Save as PDF" in the print dialog.
    setBusy('pdf')
    window.setTimeout(() => {
      window.print()
      setBusy('')
      flashDone('pdf')
    }, 120)
  }

  const handleExcel = async () => {
    setBusy('excel')
    const rows = buildExportRows(items)
    const ok = await exportExcel(slugify(config.title), rows)
    setBusy('')
    if (ok) flashDone('excel')
  }

  // --- Render ---
  const totalCols = (showNumberCol ? 1 : 0) + columns.length + 1 // +1 for Action

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* LEFT: Form card */}
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
          <Pencil className="size-5 text-[#337ab7]" />
          <h3 className="text-base font-semibold">{editingIdx !== null ? 'Edit ' : ''}{singular}</h3>
        </div>

        <div className="space-y-4">
          {editableFields.map((f) => {
            const val = form[f.name] ?? ''
            const err = errors[f.name]
            const commonFieldCls = 'field w-full'
            const isDirty = form[f.name] !== undefined && form[f.name] !== ''
            return (
              <div key={f.name}>
                <label className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
                  {f.label}{f.required && <span className="ml-1 text-[#d9534f]">*</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    value={val}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    placeholder={f.placeholder || ''}
                    className={cn(commonFieldCls, 'min-h-[100px] resize-y')}
                  />
                ) : f.type === 'select' ? (
                  <Select
                    value={val}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    placeholder={f.placeholder || 'Select...'}
                  >
                    {f.placeholder !== undefined && <option value="">{f.placeholder}</option>}
                    {(!f.placeholder && f.options && f.options.length > 2) && <option value="">Please Select...</option>}
                    {(f.options || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                ) : f.type === 'date' ? (
                  <DatePicker
                    value={val}
                    onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))}
                    placeholder="select date"
                    className="hr-date-field"
                  />
                ) : f.type === 'time' ? (
                  <TimePicker
                    value={val}
                    onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))}
                    placeholder="select time"
                    className="hr-date-field"
                  />
                ) : f.type === 'radio' ? (
                  <div className="flex items-center gap-5 pt-1.5">
                    {(f.options || []).map((o) => (
                      <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-medium text-[#16325c] dark:text-zinc-200">
                        <input
                          type="radio"
                          name={`${config.key}-${f.name}`}
                          value={o.value}
                          checked={String(val) === String(o.value)}
                          onChange={() => setForm((s) => ({ ...s, [f.name]: o.value }))}
                          className="size-[15px] accent-[#284a72]"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : (
                  <Input
                    type={f.type === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                    placeholder={f.placeholder || ''}
                    min={f.min}
                    max={f.max}
                  />
                )}
                {err && (
                  <p className="mt-1 text-xs italic text-[#d9534f]">{err}</p>
                )}
              </div>
            )
          })}

          <div className="pt-2">
            <Button
              onClick={save}
              disabled={saving}
              className="w-full py-3 text-base font-semibold hr-admin-save-btn"
            >
              {saving ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : (editingIdx !== null ? 'Update' : 'Save')}
            </Button>
          </div>
        </div>
      </div>

      {/* RIGHT: List card */}
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <List className="size-5 text-[#337ab7]" />
            {title} List
          </h3>
          <div className="flex items-center gap-2">
            <button
              title="Print"
              onClick={handlePrint}
              disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#337ab7] bg-[#337ab7] text-white transition hover:bg-[#286090] disabled:cursor-wait disabled:opacity-70"
            >
              {done === 'print' ? <Check className="size-4" strokeWidth={3} /> : <Printer className="size-4" />}
              {busy === 'print' && <span className="absolute -bottom-1 -right-1 size-2.5 animate-pulse rounded-full bg-white" />}
            </button>
            <button
              title="Save as PDF"
              onClick={handlePdf}
              disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#e48aa5] bg-[#f4a6bc] text-white transition hover:bg-[#ea8fa9] disabled:cursor-wait disabled:opacity-70"
            >
              {done === 'pdf' ? <Check className="size-4" strokeWidth={3} /> : <FileText className="size-4" />}
              {busy === 'pdf' && <span className="absolute -bottom-1 -right-1 size-2.5 animate-pulse rounded-full bg-white" />}
            </button>
            <button
              title="Export as Excel (.xlsx)"
              onClick={() => void handleExcel()}
              disabled={busy !== ''}
              className="relative grid size-9 place-items-center rounded-full border-2 border-[#4cae4c] bg-[#5cb85c] text-white transition hover:bg-[#449d44] disabled:cursor-wait disabled:opacity-70"
            >
              {done === 'excel' ? <Check className="size-4" strokeWidth={3} /> : <FileSpreadsheet className="size-4" />}
              {busy === 'excel' && <span className="absolute -bottom-1 -right-1 size-2.5 animate-pulse rounded-full bg-white" />}
            </button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <Select
              value={String(showEntries)}
              onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }}
              className="w-20"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </Select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Search:</span>
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="w-48 py-1 text-sm" />
          </div>
        </div>

        {loadError && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="size-4" /> {loadError}
            <button className="ml-auto text-xs font-semibold underline" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        <div className="overflow-x-auto relative">
          {dataLoading && (
            <div className="absolute inset-0 z-10 grid place-items-center bg-white/70 dark:bg-black/30">
              <Loader2 className="size-6 animate-spin text-[#337ab7]" />
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-line bg-[#f5f5f6] text-left dark:bg-white/5">
                {showNumberCol && <th className="w-14 px-3 py-2.5 font-semibold text-[#48525c] dark:text-zinc-200">No.<SortIcon /></th>}
                {columns.map((c) => (
                  <th key={c.key} className={cn('px-3 py-2.5 font-semibold text-[#48525c] dark:text-zinc-200', c.width)}>
                    {c.label}<SortIcon />
                  </th>
                ))}
                <th className="w-24 px-3 py-2.5 font-semibold text-[#48525c] dark:text-zinc-200">Action<SortIcon /></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((it, idx) => {
                const globalIdx = (page - 1) * showEntries + idx + 1
                const zebra = idx % 2 === 0
                return (
                  <tr
                    key={`${config.key}-${startIdx + idx}`}
                    className={cn(
                      'border-b border-line transition-colors',
                      zebra ? 'bg-[#f5f7fa]/60 dark:bg-white/[0.02]' : 'bg-white dark:bg-transparent',
                      'hover:bg-[#e8eef5] dark:hover:bg-white/5',
                    )}
                  >
                    {showNumberCol && <td className="px-3 py-2.5 font-medium">{globalIdx}</td>}
                    {columns.map((c) => (
                      <td key={c.key} className="px-3 py-2.5">
                        {c.render ? c.render(it, idx) : <span className="font-medium">{it[c.key] as any}</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => edit(idx)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#337ab7] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#286090]"
                      >
                        <Pencil className="size-3" /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
              {paged.length === 0 && !dataLoading && (
                <tr>
                  <td colSpan={totalCols} className="px-3 py-8 text-center text-sm text-mist">
                    No entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {filtered.length === 0
              ? 'No entries'
              : `Showing ${(page - 1) * showEntries + 1} to ${Math.min(page * showEntries, filtered.length)} of ${filtered.length} entries`}
          </span>
          <div className={cn('flex items-center gap-1', totalPages <= 1 && 'opacity-50 pointer-events-none')}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded border border-line bg-[#f6f6f6] px-3 py-1 text-[#337ab7] hover:bg-[#eaeaea] disabled:opacity-50 dark:bg-white/5 dark:text-zinc-300"
            >Previous</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n} onClick={() => setPage(n)}
                className={cn(
                  'rounded px-3 py-1',
                  n === page
                    ? 'border border-[#284a72] bg-[#284a72] text-white'
                    : 'border border-line bg-[#f6f6f6] text-[#337ab7] hover:bg-[#eaeaea] dark:bg-white/5 dark:text-zinc-300',
                )}
              >{n}</button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded border border-line bg-[#f6f6f6] px-3 py-1 text-[#337ab7] hover:bg-[#eaeaea] disabled:opacity-50 dark:bg-white/5 dark:text-zinc-300"
            >Next</button>
          </div>
        </div>
      </div>

      {/* Hidden print-only report for Print/PDF buttons */}
      <div
        data-hr-print-block
        aria-hidden
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <style>{`
          @media print {
            html, body { background: #fff !important; color: #000 !important; }
            body * { visibility: hidden !important; }
            [data-hr-print-block], [data-hr-print-block] * { visibility: visible !important; }
            [data-hr-print-block] {
              position: absolute !important;
              left: 0 !important; top: 0 !important;
              width: auto !important; height: auto !important;
              overflow: visible !important;
              display: block !important;
              padding: 24px !important;
              color: #000 !important;
              background: #fff !important;
            }
            [data-hr-print-block] * { color: #000 !important; background: transparent !important; }
            [data-hr-print-block] table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            [data-hr-print-block] th, [data-hr-print-block] td { border: 1px solid #666; padding: 6px 10px; font-size: 12px; text-align: left; }
            [data-hr-print-block] th { background: #dde3ec !important; color: #000 !important; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-hr-print-block] tr:nth-child(even) td { background: #f3f5f8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            [data-hr-print-block] h1 { font-size: 20px; margin: 0 0 4px; color: #000 !important; }
            [data-hr-print-block] .hr-print-sub { font-size: 12px; color: #333 !important; margin-bottom: 8px; }
          }
        `}</style>
        <h1>{title} List</h1>
        <div className="hr-print-sub">Printed {new Date().toLocaleString()} · FitPro Gym App</div>
        <table>
          <thead>
            <tr>
              {showNumberCol && <th>No.</th>}
              {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((r, i) => (
              <tr key={i}>
                {showNumberCol && <td>{i + 1}</td>}
                {columns.map((c) => <td key={c.key}>{cellText(r, c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page exports — one per route, each rendering <CrudList config={...}/>
// Work Week uses a custom layout (hours + 7 day dropdown grid) rather than
// the generic CRUD form.
// ---------------------------------------------------------------------------
function pageFor(key: string) {
  return function Page() {
    const cfg = PAGES[key]
    if (!cfg) return <div className="text-mist">Page not configured.</div>
    return <CrudList config={cfg} />
  }
}

// ----- Work Week (custom layout) ------------------------------------------
const DAY_OPTIONS = [
  { value: 'full',  label: 'FULL DAY' },
  { value: 'half',  label: 'HALF DAY' },
  { value: 'none',  label: 'NON-WORKING DAY' },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

function WorkWeekPageImpl() {
  const [hours, setHours] = useState<string>('8')
  const [days, setDays] = useState<Record<string, string>>({
    Monday: 'full', Tuesday: 'full', Wednesday: 'full', Thursday: 'full',
    Friday: 'full', Saturday: 'half', Sunday: 'none',
  })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const setDay = (d: string, v: string) => setDays((s) => ({ ...s, [d]: v }))

  const save = async () => {
    const e: Record<string, string> = {}
    const n = Number(hours)
    if (!hours || Number.isNaN(n) || n <= 0) e.hours = 'Full Day Duration Per Hours is required'
    DAYS.forEach((d) => { if (!days[d]) e[d] = `${d} is required` })
    setErrs(e)
    if (Object.keys(e).length) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 300))
    setSaving(false)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="card p-5 max-w-4xl">
      <div className="mb-4 flex items-center gap-2 border-b border-line pb-3">
        <Pencil className="size-5 text-[#337ab7]" />
        <h3 className="text-base font-semibold">Work Week</h3>
      </div>

      <div className="space-y-4">
        {/* Full Day Hours */}
        <div className="max-w-xs">
          <label className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
            Full Day Duration Per Hours<span className="ml-1 text-[#d9534f]">*</span>
          </label>
          <Input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min={1}
            max={24}
          />
          {errs.hours && <p className="mt-1 text-xs italic text-[#d9534f]">{errs.hours}</p>}
        </div>

        {/* Days grid: 4 columns then 3 columns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS.slice(0, 4).map((d) => (
            <div key={d}>
              <label className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
                {d}<span className="ml-1 text-[#d9534f]">*</span>
              </label>
              <Select
                value={days[d]}
                onChange={(e) => setDay(d, e.target.value)}
                className="w-full"
                placeholder="Please Select..."
              >
                <option value="">Please Select...</option>
                {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DAYS.slice(4, 7).map((d) => (
            <div key={d}>
              <label className="mb-1.5 block text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
                {d}<span className="ml-1 text-[#d9534f]">*</span>
              </label>
              <Select
                value={days[d]}
                onChange={(e) => setDay(d, e.target.value)}
                className="w-full"
                placeholder="Please Select..."
              >
                <option value="">Please Select...</option>
                {DAY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
          ))}

          {/* Save button — occupies the last cell on lg screens, full width below on small. */}
          <div className="lg:col-start-4">
            <Button
              onClick={save}
              disabled={saving}
              className="w-full py-3 text-base font-semibold hr-admin-save-btn"
            >
              {saving ? <><Loader2 className="size-4 animate-spin" /> Saving...</> : saved ? '✓ Saved' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const DesignationPage        = pageFor('designation')
export const JobTitlePage           = pageFor('job-title')
export const EmploymentStatusPage   = pageFor('employment-status')
export const LeavePeriodPage        = pageFor('leave-period')
export const LeaveTypePage          = pageFor('leave-type')
export const HolidaysPage           = pageFor('holidays')
export const WorkWeekPage           = WorkWeekPageImpl
export const RecruitmentStatusPage  = pageFor('recruitment-status')
export const JobCategoriesPage      = pageFor('job-categories')
export const WorkShiftsPage         = pageFor('work-shifts')
export const SkillsPage             = pageFor('skills')
export const EducationPage          = pageFor('education')
export const LicensePage            = pageFor('license')
export const LanguagesPage          = pageFor('languages')
export const MembershipPage         = pageFor('membership')

export function HrAdmin() { return <HrAdminLayout /> }
