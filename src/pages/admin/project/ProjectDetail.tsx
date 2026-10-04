import { Fragment, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, LayoutDashboard, CheckCircle2, Clock, Flag, Paperclip,
  MessagesSquare, ChartNoAxesGantt, Ticket, FileSignature, Zap, ShoppingCart, StickyNote, Plus,
  ReceiptText, Download, List as ListIcon, CalendarDays, LayoutGrid,
  Upload, Trash2, ArrowDown, ArrowUp, ChevronDown, Search as SearchIcon, EyeOff as EyeOffIcon,
  RefreshCw, MessagesSquare as MsgIcon, Send,
  Printer, MoreVertical, Pencil, ChevronUp, ChevronsUpDown,
} from 'lucide-react'
import { Button, Badge, Empty, Modal, Field, Input, Textarea, Select, DatePicker } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { exportExcel } from '../../../lib/export'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { GanttView } from '../../../components/project/GanttView'
import { loadMilestones, saveMilestones } from '../../../lib/milestones'
import { loadProjectFiles, saveProjectFiles } from '../../../lib/projectFiles'
import { loadProjectDiscussions, saveProjectDiscussions } from '../../../lib/projectDiscussions'
import { loadProjectTickets, saveProjectTickets } from '../../../lib/projectTickets'
import { loadProjectPurchases, saveProjectPurchases } from '../../../lib/projectPurchases'
import { loadProjectNotes, saveProjectNotes } from '../../../lib/projectNotes'
import { CONTRACT_STATUSES, contractStatusMeta, isContractOverdue, contractCounts } from '../../../lib/contracts'
import { computeHours } from '../../../lib/timesheets'
import type { ContractStatus, ProjectContract, ProjectDiscussion, ProjectFile, ProjectMilestone, ProjectNote, ProjectPurchase, ProjectStatus, ProjectTicket, TimesheetEntry } from '../../../types'

type TabId =
  | 'overview' | 'tasks' | 'timesheets' | 'milestones' | 'files' | 'discussions'
  | 'gantt' | 'tickets' | 'contracts' | 'sales' | 'purchase' | 'notes'

const TABS: { id: TabId; label: string; icon: typeof Clock }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
  { id: 'timesheets', label: 'Timesheets', icon: Clock },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'discussions', label: 'Discussions', icon: MessagesSquare },
  { id: 'gantt', label: 'Gantt', icon: ChartNoAxesGantt },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'contracts', label: 'Contracts', icon: FileSignature },
  { id: 'sales', label: 'Sales', icon: Zap },
  { id: 'purchase', label: 'Purchase', icon: ShoppingCart },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

const STATUS_COLORS: Record<string, string> = {
  not_started: '#64748b', in_progress: '#0ea5e9', review: '#8b5cf6',
  completed: '#84cc16', on_hold: '#f59e0b', cancelled: '#ef4444',
}

const fmtHours = (h: number) => {
  const whole = Math.floor(h)
  const mins = Math.round((h - whole) * 60)
  return `${String(whole).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const app = useApp()
  const { projects, tasks, timesheets, contracts, projectInvoices, users } = app
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'company_admin', 'branch_admin')

  const project = projects.find((p) => p.id === id) || null
  const [tab, setTab] = useState<TabId>('overview')
  const [hoursRange, setHoursRange] = useState<'week' | 'month'>('week')
  const [milestones, setMilestones] = useState(() => loadMilestones())
  const [msOpen, setMsOpen] = useState(false)
  const [msName, setMsName] = useState('')
  const [msNotes, setMsNotes] = useState('')
  const [msBoard, setMsBoard] = useState(true)
  const [excludeDone, setExcludeDone] = useState(true)
  const [msVisible, setMsVisible] = useState<Record<string, number>>({})
  const [msColor, setMsColor] = useState('#6366f1')
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>(() => loadProjectFiles())
  const [filesSel, setFilesSel] = useState<Set<string>>(new Set())
  const [filesSearch, setFilesSearch] = useState('')
  const [filesPageSize, setFilesPageSize] = useState(25)
  const [filesPage, setFilesPage] = useState(1)
  const [filesSortDesc, setFilesSortDesc] = useState(true)
  const [filesVisibleDefault, setFilesVisibleDefault] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [dropActive, setDropActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fileBlobs = useRef<Map<string, Blob>>(new Map())
  const [discussions, setDiscussions] = useState<ProjectDiscussion[]>(() => loadProjectDiscussions())
  const [discSearch, setDiscSearch] = useState('')
  const [discPageSize, setDiscPageSize] = useState(25)
  const [discPage, setDiscPage] = useState(1)
  const [discSortDesc, setDiscSortDesc] = useState(true)
  const [discOpen, setDiscOpen] = useState(false)
  const [dSubject, setDSubject] = useState('')
  const [dDesc, setDDesc] = useState('')
  const [dVisible, setDVisible] = useState(false)
  const [discExpanded, setDiscExpanded] = useState<string | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [tickets, setTickets] = useState<ProjectTicket[]>(() => loadProjectTickets())
  const [ticketSearch, setTicketSearch] = useState('')
  const [ticketPageSize, setTicketPageSize] = useState(25)
  const [ticketPage, setTicketPage] = useState(1)
  const [ticketSortDesc, setTicketSortDesc] = useState(true)
  const [ticketOpen, setTicketOpen] = useState(false)
  const [tSubject, setTSubject] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [tTags, setTTags] = useState('')
  const [tDept, setTDept] = useState('Projects')
  const [tService, setTService] = useState('Site Works')
  const [tPriority, setTPriority] = useState<ProjectTicket['priority']>('medium')
  const [tContact, setTContact] = useState('')
  const [ticketExpanded, setTicketExpanded] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [purchases, setPurchases] = useState<ProjectPurchase[]>(() => loadProjectPurchases())
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchasePageSize, setPurchasePageSize] = useState(25)
  const [purchasePage, setPurchasePage] = useState(1)
  const [purchaseSortDesc, setPurchaseSortDesc] = useState(true)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [pItem, setPItem] = useState('')
  const [pSupplier, setPSupplier] = useState('')
  const [pQty, setPQty] = useState('1')
  const [pCost, setPCost] = useState('')
  const [pStatus, setPStatus] = useState<ProjectPurchase['status']>('ordered')
  const [pNotes, setPNotes] = useState('')
  const [notes, setNotes] = useState<ProjectNote[]>(() => loadProjectNotes())
  const [noteSearch, setNoteSearch] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [nTitle, setNTitle] = useState('')
  const [nBody, setNBody] = useState('')
  const [ctStatusFilter, setCtStatusFilter] = useState('')
  const [ctStatusSelect, setCtStatusSelect] = useState('')
  const [ctSearch, setCtSearch] = useState('')
  const [ctPageSize, setCtPageSize] = useState(10)
  const [ctPage, setCtPage] = useState(1)
  const [ctSortBy, setCtSortBy] = useState<'client' | 'project' | 'value'>('client')
  const [ctSortDir, setCtSortDir] = useState<'asc' | 'desc'>('asc')
  const [ctEditing, setCtEditing] = useState<{ id?: string; subject: string; clientName: string; value: string; startDate: string; endDate: string; status: ContractStatus; description: string } | null>(null)
  const [ctDeleting, setCtDeleting] = useState<ProjectContract | null>(null)
  const [ctMenuFor, setCtMenuFor] = useState<string | null>(null)
  const [tsSearch, setTsSearch] = useState('')
  const [tsPageSize, setTsPageSize] = useState(10)
  const [tsPage, setTsPage] = useState(1)
  const [tsSortBy, setTsSortBy] = useState<'assignee' | 'hours' | 'earnings'>('assignee')
  const [tsSortDir, setTsSortDir] = useState<'asc' | 'desc'>('asc')
  const [tsMenuFor, setTsMenuFor] = useState<string | null>(null)
  const [tsEditing, setTsEditing] = useState<{ id?: string; userId: string; task: string; date: string; start: string; end: string; rate: string } | null>(null)
  const [tsDeleting, setTsDeleting] = useState<TimesheetEntry | null>(null)
  const saveContract = () => {
    if (!ctEditing || !project) return
    if (!ctEditing.subject.trim()) { toast.error('Enter the contract subject.'); return }
    const isNew = !ctEditing.id
    app.upsertContract({
      id: ctEditing.id || uid('ct'),
      subject: ctEditing.subject.trim(),
      clientName: ctEditing.clientName.trim() || project.clientName || '',
      projectId: project.id,
      projectName: project.name,
      value: Math.max(0, Number(ctEditing.value) || 0),
      startDate: ctEditing.startDate,
      endDate: ctEditing.endDate,
      status: ctEditing.status,
      description: ctEditing.description.trim() || undefined,
    })
    toast.success(isNew ? 'Contract created' : 'Contract updated')
    setCtEditing(null)
  }
  const saveTimesheet = () => {
    if (!tsEditing || !project) return
    if (!tsEditing.userId) { toast.error('Select a user.'); return }
    if (!tsEditing.task.trim()) { toast.error('Enter the task performed.'); return }
    const user = users.find((u) => u.id === tsEditing.userId)
    const hours = computeHours(tsEditing.start, tsEditing.end)
    const rate = Number(tsEditing.rate) || 0
    app.upsertTimesheet({
      id: tsEditing.id || uid('ts'),
      projectId: project.id,
      projectName: project.name,
      userId: tsEditing.userId,
      userName: user?.name || '',
      userEmail: user?.email || '',
      userAvatar: user?.avatar,
      task: tsEditing.task.trim(),
      refNo: tsEditing.id ? (timesheets.find((x) => x.id === tsEditing.id)?.refNo || '') : `TS-${1000 + timesheets.length + 1}`,
      date: tsEditing.date,
      startTime: `${tsEditing.start}:00`,
      endTime: `${tsEditing.end}:00`,
      hours,
      rate,
      earnings: Math.round(hours * rate * 100) / 100,
    })
    toast.success(tsEditing.id ? 'Timesheet updated' : 'Timesheet saved')
    setTsEditing(null)
  }
  const tabStripRef = useRef<HTMLDivElement>(null)

  const projectTasks = useMemo(() => tasks.filter((t) => t.projectId === id), [tasks, id])
  const projectTimes = useMemo(() => timesheets.filter((t) => t.projectId === id), [timesheets, id])
  const projectContracts = useMemo(() => contracts.filter((c) => c.projectId === id), [contracts, id])
  const projectInvs = useMemo(() => projectInvoices.filter((i) => i.projectId === id), [projectInvoices, id])

  const totalHours = projectTimes.reduce((s, t) => s + (t.hours || 0), 0)
  const openTasks = projectTasks.filter((t) => t.status !== 'completed')
  const projectNumber = Math.max(0, projects.findIndex((p) => p.id === id)) + 1

  // Hours per day for the chart (week = last 7 days incl. today; month = last 30).
  const hourBars = useMemo(() => {
    const days = hoursRange === 'week' ? 7 : 30
    const out: { label: string; hours: number }[] = []
    const today = new Date()
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today.getTime() - i * 86400000)
      const iso = d.toISOString().slice(0, 10)
      const hours = projectTimes.filter((t) => t.date === iso).reduce((s, t) => s + (t.hours || 0), 0)
      out.push({ label: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' }), hours })
    }
    return out
  }, [projectTimes, hoursRange])
  const maxBar = Math.max(1, ...hourBars.map((b) => b.hours))

  const scrollTabs = (dir: 1 | -1) => tabStripRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })

  const exportData = () => {
    if (!project) return
    exportExcel(`project-${project.name.toLowerCase().replace(/\s+/g, '-')}`, [
      { Section: 'Project', Field: 'Name', Value: project.name },
      { Section: 'Project', Field: 'Customer', Value: project.clientName },
      { Section: 'Project', Field: 'Status', Value: project.status },
      { Section: 'Project', Field: 'Start date', Value: project.startDate },
      { Section: 'Project', Field: 'End date', Value: project.endDate },
      { Section: 'Project', Field: 'Total rate', Value: String(project.estimatedValue || 0) },
      ...projectTasks.map((t) => ({ Section: 'Task', Field: t.name, Value: `${t.status} · due ${t.dueDate}` })),
      ...projectTimes.map((t) => ({ Section: 'Timesheet', Field: `${t.userName} — ${t.task}`, Value: `${fmtHours(t.hours)} (${t.date})` })),
      ...projectContracts.map((c) => ({ Section: 'Contract', Field: c.subject, Value: c.clientName })),
      ...projectInvs.map((i) => ({ Section: 'Invoice', Field: i.number, Value: `${formatGhsExact(i.total)} · ${i.status}` })),
    ])
    toast.success('Export ready', 'Project data exported.')
  }

  if (!project) {
    return (
      <div className="card">
        <Empty title="Project not found" desc="The project you are looking for does not exist or was deleted." />
        <div className="flex justify-center pb-6"><Button variant="ghost" onClick={() => navigate('/admin/projects')}><ArrowLeft className="size-4" /> Back to projects</Button></div>
      </div>
    )
  }

  const statusColor = STATUS_COLORS[project.status] || '#0ea5e9'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/projects')} aria-label="Back to projects"><ArrowLeft className="size-4" /></Button>
          <h1 className="font-display text-xl font-bold">
            {project.name} <span className="text-sm font-semibold text-mist">- {project.clientName}</span>
          </h1>
          <span
            className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
            style={{ borderColor: `${statusColor}66`, color: statusColor, background: `${statusColor}14` }}
          >
            {(project.status as ProjectStatus)?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Button variant="primary" onClick={() => navigate('/admin/projects/tasks/assign')}><Plus className="size-4" /> New Task</Button>
              <Button onClick={() => navigate('/admin/projects/invoices')}><ReceiptText className="size-4" /> Invoice Project</Button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-xl border border-line bg-zinc-50 p-1.5 dark:bg-white/[0.03]">
        <button type="button" aria-label="Scroll tabs left" className="grid size-8 shrink-0 place-items-center rounded-lg text-mist transition hover:text-white" onClick={() => scrollTabs(-1)}>
          <ChevronLeft className="size-4" />
        </button>
        <div ref={tabStripRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? 'bg-white shadow-sm dark:bg-zinc-800' : 'text-mist hover:text-white'}`}
              >
                <Icon className="size-4" /> {t.label}
              </button>
            )
          })}
        </div>
        <button type="button" aria-label="Scroll tabs right" className="grid size-8 shrink-0 place-items-center rounded-lg text-mist transition hover:text-white" onClick={() => scrollTabs(1)}>
          <ChevronRight className="size-4" />
        </button>
      </div>

      <p className="text-sm font-semibold">Project Progress <span className="font-normal text-mist">{(project.progress || 0).toFixed(2)}%</span></p>

      {/* ── Overview ─ */}
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold">Overview</h2>
              <button type="button" onClick={exportData} className="flex items-center gap-1.5 text-sm font-semibold text-mist transition hover:text-white">
                <Download className="size-4" /> Export Project Data
              </button>
            </div>
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ['Project #', String(projectNumber)],
                ['Customer', project.clientName],
                ['Billing Type', project.projectType || 'Fixed Rate'],
                ['Total Rate', `${formatGhsExact(project.estimatedValue || 0)}`],
                ['Status', (project.status || '').replace(/_/g, ' ')],
                ['Date Created', formatDate(project.startDate)],
                ['Start Date', formatDate(project.startDate)],
                ['Total Logged Hours', fmtHours(totalHours)],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-mist">{k}</p>
                  <p className="mt-0.5 text-sm font-semibold">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <p className="text-xs text-mist">Description</p>
              <p className="mt-0.5 text-sm">{project.description || <span className="text-mist">No description for this project</span>}</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-bold">{project.name}</h2>

            <div className="mt-4 rounded-xl border border-line p-4">
              <p className="text-sm font-semibold">{openTasks.length} / {projectTasks.length} Open Tasks</p>
              <p className="mt-0.5 text-xs text-mist">{project.progress || 0}%</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div className="h-full rounded-full" style={{ width: `${project.progress || 0}%`, background: statusColor }} />
              </div>
            </div>

            <h3 className="mt-5 flex items-center gap-1.5 text-sm font-semibold"><Paperclip className="size-4 text-mist" /> Expenses</h3>
            <div className="mt-2 grid gap-2 rounded-xl border border-line p-4 sm:grid-cols-4">
              {[
                ['Total Expenses', '0.00', 'text-inherit'],
                ['Billable Expenses', '0.00', 'text-sky-600 dark:text-sky-400'],
                ['Billed Expenses', '0.00', 'text-lime-700 dark:text-lime'],
                ['Unbilled Expenses', '0.00', 'text-rose-600 dark:text-rose-400'],
              ].map(([k, v, c]) => (
                <div key={k}>
                  <p className={`text-xs font-semibold ${c}`}>{k}</p>
                  <p className="mt-0.5 text-sm font-bold">{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Clock className="size-4 text-mist" /> Total Logged Hours</h3>
              <select
                className="field"
                style={{ width: 120 }}
                value={hoursRange}
                onChange={(e) => setHoursRange(e.target.value as 'week' | 'month')}
                aria-label="Logged hours range"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
            <div className="mt-3 flex h-36 items-end gap-1.5">
              {hourBars.map((b, i) => (
                <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="w-full rounded-t bg-sky-500 transition group-hover:bg-sky-400"
                    style={{ height: `${Math.max(b.hours > 0 ? 6 : 2, (b.hours / maxBar) * 100)}%` }}
                    title={`${b.label} — ${fmtHours(b.hours)}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5">
              {hourBars.map((b, i) => (
                <p key={i} className="flex-1 truncate text-center text-[9px] text-mist">{b.label}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tasks ── */}
      {tab === 'tasks' && (
        <div className="card overflow-x-auto">
          {projectTasks.length ? (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Assigned to</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {projectTasks.map((t) => (
                  <tr key={t.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-semibold">{t.name}</td>
                    <td className="px-4 py-3 capitalize">{t.priority.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">{users.find((u) => u.id === t.assigneeId)?.name || '—'}</td>
                    <td className="px-4 py-3 text-mist">{formatDate(t.dueDate)}</td>
                    <td className="px-4 py-3"><Badge tone={t.status === 'completed' ? 'lime' : t.status === 'in_progress' ? 'sky' : t.status === 'review' ? 'violet' : 'zinc'}>{t.status.replace(/_/g, ' ')}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No tasks yet" desc="Create the first task for this project with the New Task button." />
          )}
        </div>
      )}

      {/* ── Timesheets ── */}
      {tab === 'timesheets' && (() => {
        const needle = tsSearch.trim().toLowerCase()
        const dir = tsSortDir === 'asc' ? 1 : -1
        const filtered = projectTimes
          .filter((t) => !needle || t.task.toLowerCase().includes(needle) || t.userName.toLowerCase().includes(needle) || t.refNo.toLowerCase().includes(needle))
          .sort((a, b) => {
            if (tsSortBy === 'hours') return (a.hours - b.hours) * dir
            if (tsSortBy === 'earnings') return (a.earnings - b.earnings) * dir
            return a.userName.localeCompare(b.userName) * dir
          })
        const pageCount = Math.max(1, Math.ceil(filtered.length / tsPageSize))
        const safePage = Math.min(tsPage, pageCount)
        const paged = filtered.slice((safePage - 1) * tsPageSize, safePage * tsPageSize)
        const onSort = (k: 'assignee' | 'hours' | 'earnings') => {
          if (tsSortBy === k) setTsSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          else { setTsSortBy(k); setTsSortDir('asc') }
        }
        const SortTh = ({ label, k }: { label: string; k: 'assignee' | 'hours' | 'earnings' }) => (
          <button type="button" onClick={() => onSort(k)} className="flex items-center gap-1 font-bold">
            {label}
            {tsSortBy === k ? (tsSortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
          </button>
        )
        const exportRows = filtered.map((t) => ({
          Task: t.task, Reference: t.refNo, Assigned_To: t.userName, Project: t.projectName,
          Date: t.date, Start_Time: t.startTime, End_Time: t.endTime, Total_Hours: t.hours, Earnings: t.earnings,
        }))
        return (
          <div className="card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
              <h2 className="mr-auto flex items-center gap-2 text-lg font-semibold"><Clock className="size-5" /> Timesheet List</h2>
              {canManage && (
                <button type="button" onClick={() => setTsEditing({ userId: '', task: '', date: new Date().toISOString().slice(0, 10), start: '08:00', end: '17:00', rate: '20' })} className="flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700">
                  <Plus className="size-4" /> Add
                </button>
              )}
              <button type="button" onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white hover:bg-slate-700" title="Print" aria-label="Print timesheets">
                <Printer className="size-4" />
              </button>
              <ExportButtons filename={`${project.name}-timesheet`} rows={exportRows} compact />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="flex items-center gap-2">
                Show
                <Select value={String(tsPageSize)} onChange={(e) => { setTsPageSize(Number(e.target.value)); setTsPage(1) }} className="w-20">
                  <option value="10">10</option><option value="25">25</option><option value="50">50</option>
                </Select>
                entries
              </span>
              <span className="flex items-center gap-2">
                Search:
                <Input value={tsSearch} onChange={(e) => { setTsSearch(e.target.value); setTsPage(1) }} className="w-48" />
              </span>
            </div>

            <div className="overflow-x-auto px-5 pt-1">
              <table className="w-full min-w-[860px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="w-10 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Task</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left dark:border-zinc-700"><SortTh label="Assigned To" k="assignee" /></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Start Time</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">End Time</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left dark:border-zinc-700"><SortTh label="Total Hours" k="hours" /></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-right dark:border-zinc-700"><span className="ml-auto flex justify-end"><SortTh label="Earnings" k="earnings" /></span></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t, i) => (
                    <tr key={t.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * tsPageSize + i + 1}</td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.task}</div>
                        <div className="text-[11px] text-zinc-500">{t.refNo} · {formatDate(t.date)}</div>
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="flex items-center gap-2">
                          <TsAvatar name={t.userName} photo={t.userAvatar} />
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-100">{t.userName}</div>
                            <div className="text-[11px] text-zinc-500">{t.userEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 align-top">{t.startTime}</td>
                      <td className="px-2 py-2.5 align-top">{t.endTime}</td>
                      <td className="px-2 py-2.5 align-top">{t.hours}</td>
                      <td className="px-2 py-2.5 text-right align-top">{t.earnings.toFixed(2)}</td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="relative inline-block">
                          <button type="button" onClick={() => setTsMenuFor(tsMenuFor === t.id ? null : t.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions">
                            <MoreVertical className="size-4" />
                          </button>
                          {tsMenuFor === t.id && (
                            <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                              <button type="button" onClick={() => { setTsMenuFor(null); setTsEditing({ id: t.id, userId: t.userId, task: t.task, date: t.date, start: t.startTime.slice(0, 5), end: t.endTime.slice(0, 5), rate: String(t.rate) }) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm">
                                <Pencil className="size-3.5" /> Edit
                              </button>
                              <button type="button" onClick={() => { setTsMenuFor(null); setTsDeleting(t) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600">
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!paged.length && (
                    <tr><td colSpan={8} className="bg-zinc-100 px-4 py-4 text-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No data available in table</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
              <span>
                Showing {filtered.length === 0 ? 0 : (safePage - 1) * tsPageSize + 1} to{' '}
                {Math.min(safePage * tsPageSize, filtered.length)} of {filtered.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setTsPage((v) => Math.max(1, v - 1))}>Previous</button>
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                  const n = i + 1
                  return (
                    <button key={n} type="button" className="btn min-w-9" aria-current={safePage === n ? 'page' : undefined}
                      style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                      onClick={() => setTsPage(n)}>{n}</button>
                  )
                })}
                <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setTsPage((v) => Math.min(pageCount, v + 1))}>Next</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Milestones / Files / Discussions / Tickets / Purchase / Notes ── */}
      {tab === 'milestones' && (() => {
        const TASK_STATUS_LABEL: Record<string, string> = { to_do: 'Not Started', in_progress: 'In Progress', review: 'Review', completed: 'Completed' }
        const STATUS_COLOR: Record<string, string> = { to_do: '#f43f5e', in_progress: '#0ea5e9', review: '#8b5cf6', completed: '#22c55e' }
        const PRIORITY_META: Record<string, { label: string; color: string }> = {
          high: { label: 'High', color: '#ef4444' },
          medium: { label: 'Medium', color: '#f59e0b' },
          low: { label: 'Low', color: '#94a3b8' },
        }
        const MS_PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']
        const projMilestones = milestones.filter((m) => m.projectId === id)
        const colorOf = (m: ProjectMilestone, i: number) => m.color || MS_PALETTE[i % MS_PALETTE.length]
        const taskHours = (name: string) => projectTimes.filter((x) => x.task === name).reduce((sum, x) => sum + (x.hours || 0), 0)
        const boardTasks = projectTasks.filter((t) => !excludeDone || t.status !== 'completed')
        const todayIso = new Date().toISOString().slice(0, 10)
        const columns: { key: string; name: string; color: string; tasks: typeof boardTasks }[] = [
          { key: 'uncat', name: 'Uncategorized', color: '#94a3b8', tasks: boardTasks.filter((t) => !t.milestoneId || !projMilestones.some((m) => m.id === t.milestoneId)) },
          ...projMilestones.map((m, i) => ({ key: m.id, name: m.name, color: colorOf(m, i), tasks: boardTasks.filter((t) => t.milestoneId === m.id) })),
        ]
        const doneCount = projectTasks.filter((t) => t.status === 'completed').length
        const totalHours = columns.reduce((n, c) => n + c.tasks.reduce((s2, t) => s2 + taskHours(t.name), 0), 0)
        const shortDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—')
        const fullDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB') : '—')
        const createMilestone = () => {
          const name = msName.trim()
          if (!name) { toast.error('Milestone name required.', 'Milestones'); return }
          if (projMilestones.some((m) => m.name.toLowerCase() === name.toLowerCase())) { toast.error('That milestone already exists.', 'Milestones'); return }
          const next = [...milestones, { id: uid('pm'), projectId: project.id, name, notes: msNotes.trim() || undefined, color: msColor, createdAt: new Date().toISOString() }]
          setMilestones(next); saveMilestones(next)
          setMsOpen(false); setMsName(''); setMsNotes('')
          toast.success('Milestone created', name)
        }
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <Button variant="primary" onClick={() => { setMsColor(MS_PALETTE[projMilestones.length % MS_PALETTE.length]); setMsOpen(true) }}>
                    <Plus className="size-4" /> New Milestone
                  </Button>
                )}
                <div className="flex rounded-lg border border-line p-0.5">
                  <button type="button" onClick={() => setMsBoard(true)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition ${msBoard ? 'bg-[#18181b] text-white dark:bg-white dark:text-zinc-900' : 'text-mist hover:text-inherit'}`}>
                    <LayoutGrid className="size-3.5" /> Board
                  </button>
                  <button type="button" onClick={() => setMsBoard(false)} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-bold transition ${!msBoard ? 'bg-[#18181b] text-white dark:bg-white dark:text-zinc-900' : 'text-mist hover:text-inherit'}`}>
                    <ListIcon className="size-3.5" /> List
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <button type="button" role="switch" aria-checked={excludeDone} onClick={() => setExcludeDone((v) => !v)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${excludeDone ? 'bg-[#18181b] dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 size-4 rounded-full shadow transition-all ${excludeDone ? 'left-[18px] bg-white dark:bg-zinc-900' : 'left-0.5 bg-white'}`} />
                </button>
                <button type="button" onClick={() => setExcludeDone((v) => !v)} className="text-sm font-semibold">Exclude Completed Tasks</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { value: String(projMilestones.length), label: 'Milestones' },
                { value: String(boardTasks.length), label: excludeDone ? 'Active tasks' : 'Tasks' },
                { value: `${doneCount}/${projectTasks.length}`, label: 'Completed' },
                { value: fmtHours(totalHours), label: 'Logged' },
              ].map((st) => (
                <div key={st.label} className="flex items-baseline gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5">
                  <span className="text-sm font-bold tabular-nums">{st.value}</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-mist">{st.label}</span>
                </div>
              ))}
            </div>

            {msBoard ? (
              <div className="flex items-start gap-4 overflow-x-auto pb-3">
                {columns.map((col) => {
                  const visible = msVisible[col.key] ?? 6
                  const colHours = col.tasks.reduce((s2, t) => s2 + taskHours(t.name), 0)
                  return (
                    <div key={col.key} className="w-[290px] shrink-0">
                      <div className="rounded-t-xl border border-b-0 border-line bg-card px-3.5 py-3" style={{ boxShadow: `inset 0 3px 0 ${col.color}` }}>
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ background: col.color }} />
                          <p className="min-w-0 flex-1 truncate text-sm font-bold" title={col.name}>{col.name}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-mist dark:bg-white/10">{col.tasks.length}</span>
                        </div>
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-mist"><Clock className="size-3" /> Logged {fmtHours(colHours)}</p>
                      </div>
                      <div className="min-h-[340px] space-y-2.5 rounded-b-xl border border-line bg-slate-100/70 p-2.5 dark:bg-white/[0.03]">
                        {col.tasks.slice(0, visible).map((t) => {
                          const sc = STATUS_COLOR[t.status] || STATUS_COLOR.to_do
                          const pr = PRIORITY_META[t.priority]
                          const assignee = users.find((u) => u.id === t.assigneeId)
                          const overdue = t.status !== 'completed' && !!t.dueDate && t.dueDate < todayIso
                          return (
                            <div key={t.id} className="rounded-xl border border-line bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ borderLeft: `3px solid ${sc}` }}>
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${sc}1a`, color: sc }}>
                                  <span className="size-1.5 rounded-full" style={{ background: sc }} />
                                  {TASK_STATUS_LABEL[t.status] || t.status}
                                </span>
                                {pr && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold" style={{ color: pr.color }} title={`${pr.label} priority`}>
                                    <Flag className="size-3" /> {pr.label}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm font-semibold leading-snug">{t.name}</p>
                              <div className="mt-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-mist">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: col.color }}>
                                    {(assignee?.name || '?').split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}
                                  </span>
                                  <span className="truncate">{assignee?.name || 'Unassigned'}</span>
                                </span>
                                <span className={`flex shrink-0 items-center gap-1 ${overdue ? 'font-bold text-rose-500' : ''}`}>
                                  <CalendarDays className="size-3" /> {shortDate(t.dueDate)}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 border-t border-line/70 pt-2 text-[11px] font-semibold text-mist">
                                <span className="flex items-center gap-1"><Clock className="size-3" /> {fmtHours(taskHours(t.name))}</span>
                                <span className="truncate">{fullDate(t.startDate)} – {fullDate(t.dueDate)}</span>
                              </div>
                            </div>
                          )
                        })}
                        {col.tasks.length === 0 && (
                          <div className="grid place-items-center rounded-xl border border-dashed border-line/80 py-8 text-xs font-semibold text-mist">No tasks</div>
                        )}
                        {col.tasks.length > visible && (
                          <button type="button" onClick={() => setMsVisible((v) => ({ ...v, [col.key]: visible + 6 }))} className="w-full rounded-lg py-1.5 text-xs font-bold text-mist transition hover:bg-black/5 hover:text-inherit dark:hover:bg-white/5">
                            Load more ({col.tasks.length - visible} remaining)
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="card overflow-x-auto">
                {projMilestones.length ? (
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                        <th className="px-4 py-3 font-semibold">Milestone</th>
                        <th className="px-4 py-3 font-semibold">Progress</th>
                        <th className="px-4 py-3 text-right font-semibold">Tasks</th>
                        <th className="px-4 py-3 text-right font-semibold">Logged Time</th>
                        <th className="px-4 py-3 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projMilestones.map((m, i) => {
                        const mTasks = projectTasks.filter((t) => t.milestoneId === m.id)
                        const done = mTasks.filter((t) => t.status === 'completed').length
                        const pct = mTasks.length ? Math.round((done / mTasks.length) * 100) : 0
                        return (
                          <tr key={m.id} className="border-b border-line/60 last:border-0">
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-2 font-semibold"><span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(m, i) }} /> {m.name}</span>
                              {m.notes && <p className="mt-0.5 pl-4 text-xs text-mist">{m.notes}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorOf(m, i) }} />
                                </div>
                                <span className="text-xs font-bold tabular-nums text-mist">{pct}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{done}/{mTasks.length}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{fmtHours(mTasks.reduce((s2, t) => s2 + taskHours(t.name), 0))}</td>
                            <td className="px-4 py-3 text-mist">{formatDate(m.createdAt.slice(0, 10))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <Empty title="No milestones" desc="Create the first milestone with the New Milestone button." />
                )}
              </div>
            )}

            <Modal open={msOpen} onClose={() => setMsOpen(false)} title="New Milestone" narrow>
              <div className="space-y-3">
                <Field label="Milestone name" required>
                  <Input value={msName} onChange={(e) => setMsName(e.target.value)} placeholder="e.g. Site Preparation" />
                </Field>
                <Field label="Notes">
                  <Textarea value={msNotes} onChange={(e) => setMsNotes(e.target.value)} rows={2} placeholder="Optional note…" />
                </Field>
                <Field label="Color">
                  <div className="flex flex-wrap gap-2">
                    {MS_PALETTE.map((c) => (
                      <button key={c} type="button" onClick={() => setMsColor(c)} aria-label={`Color ${c}`} className={`size-6 rounded-full transition ${msColor === c ? 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-white dark:ring-white dark:ring-offset-zinc-900' : 'hover:scale-110'}`} style={{ background: c }} />
                    ))}
                  </div>
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setMsOpen(false)}>Cancel</Button>
                  <Button onClick={createMilestone}><Plus className="size-4" /> Create milestone</Button>
                </div>
              </div>
            </Modal>
          </div>
        )
      })()}
      {tab === 'files' && (() => {
        const q = filesSearch.trim().toLowerCase()
        const filtered = projectFiles
          .filter((f) => f.projectId === id)
          .filter((f) => !q || f.filename.toLowerCase().includes(q) || f.uploadedByName.toLowerCase().includes(q))
          .sort((a, b) => (filesSortDesc ? b.dateUploaded.localeCompare(a.dateUploaded) : a.dateUploaded.localeCompare(b.dateUploaded)))
        const pages = Math.max(1, Math.ceil(filtered.length / filesPageSize))
        const page = Math.min(filesPage, pages)
        const rows = filtered.slice((page - 1) * filesPageSize, page * filesPageSize)
        const allChecked = rows.length > 0 && rows.every((f) => filesSel.has(f.id))
        const fmtSize = (n?: number) => (n == null ? '' : n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
        const toggleAll = () =>
          setFilesSel((prev) => {
            const n = new Set(prev)
            if (allChecked) rows.forEach((f) => n.delete(f.id))
            else rows.forEach((f) => n.add(f.id))
            return n
          })
        const touch = (f: ProjectFile) => ({ ...f, lastActivity: new Date().toISOString() })
        const persist = (next: ProjectFile[]) => { setProjectFiles(next); saveProjectFiles(next) }
        const addFiles = (list: FileList | File[]) => {
          const arr = Array.from(list)
          if (!arr.length) return
          const now = new Date().toISOString()
          const recs: ProjectFile[] = arr.map((f) => {
            const fid = uid('pf')
            if (f.size <= 5_000_000) fileBlobs.current.set(fid, f)
            return {
              id: fid, projectId: project.id, filename: f.name,
              fileType: (f.name.includes('.') ? f.name.split('.').pop()! : f.type || 'file').toUpperCase().slice(0, 10),
              size: f.size, visibleToCustomer: filesVisibleDefault,
              uploadedByName: user?.name || 'You', dateUploaded: now, lastActivity: now, comments: 0,
            }
          })
          persist([...projectFiles, ...recs])
          toast.success(`${recs.length} file${recs.length > 1 ? 's' : ''} uploaded`, project.name)
        }
        const download = (f: ProjectFile) => {
          const blob = fileBlobs.current.get(f.id) || new Blob([`FitPro demo file\n\nProject: ${project.name}\nFile: ${f.filename}\nUploaded by: ${f.uploadedByName}\n`], { type: 'text/plain' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = f.filename; a.click()
          setTimeout(() => URL.revokeObjectURL(url), 2000)
          persist(projectFiles.map((x) => (x.id === f.id ? touch(x) : x)))
        }
        const removeFiles = (ids: string[]) => {
          ids.forEach((x) => fileBlobs.current.delete(x))
          persist(projectFiles.filter((f) => !ids.includes(f.id)))
          setFilesSel((prev) => { const n = new Set(prev); ids.forEach((x) => n.delete(x)); return n })
          toast.success(`${ids.length} file${ids.length > 1 ? 's' : ''} deleted`, project.name)
        }
        const setVis = (ids: string[], v: boolean) => persist(projectFiles.map((f) => (ids.includes(f.id) ? { ...touch(f), visibleToCustomer: v } : f)))
        const selIds = [...filesSel]
        return (
          <div className="space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDropActive(true) }}
              onDragLeave={() => setDropActive(false)}
              onDrop={(e) => { e.preventDefault(); setDropActive(false); if (canManage) addFiles(e.dataTransfer.files) }}
              onClick={() => canManage && fileInputRef.current?.click()}
              className={`grid min-h-[150px] cursor-pointer place-items-center rounded-xl border-2 border-dashed transition ${dropActive ? 'border-lime bg-lime/10' : 'border-line bg-slate-100/60 hover:border-lime/60 dark:bg-white/[0.03]'}`}
            >
              <div className="text-center">
                <Upload className="mx-auto size-6 text-mist" />
                <p className="mt-2 text-sm font-bold">Drop files here to upload</p>
                <p className="mt-1 text-xs text-mist">{canManage ? 'or click to browse from your computer' : 'Read-only access'}</p>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
            </div>

            <div className="flex items-center gap-2.5">
              <button type="button" role="switch" aria-checked={filesVisibleDefault} onClick={() => setFilesVisibleDefault((v) => !v)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${filesVisibleDefault ? 'bg-[#18181b] dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <span className={`absolute top-0.5 size-4 rounded-full shadow transition-all ${filesVisibleDefault ? 'left-[18px] bg-white dark:bg-zinc-900' : 'left-0.5 bg-white'}`} />
              </button>
              <span className="text-sm font-semibold">Visible to Customer</span>
              <span className="text-xs text-mist">— applied to new uploads</span>
            </div>

            <div className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <select value={filesPageSize} onChange={(e) => { setFilesPageSize(Number(e.target.value)); setFilesPage(1) }} className="h-9 rounded-lg border border-line bg-card px-2 text-sm font-semibold" aria-label="Rows per page">
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => { void exportExcel(`${project.name}-files`, filtered.map((f) => ({ Filename: f.filename, 'File type': f.fileType, Size: fmtSize(f.size), 'Last activity': formatDate(f.lastActivity.slice(0, 10)), 'Total comments': f.comments, 'Visible to customer': f.visibleToCustomer ? 'Yes' : 'No', 'Uploaded by': f.uploadedByName, 'Date uploaded': formatDate(f.dateUploaded.slice(0, 10)) }))) }}>
                  <Download className="size-3.5" /> Export
                </Button>
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setBulkOpen((v) => !v)}>
                    Bulk actions <ChevronDown className="size-3.5" />
                  </Button>
                  {bulkOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setBulkOpen(false)} />
                      <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-xl border border-line bg-card p-1 shadow-lg">
                        <button type="button" disabled={!selIds.length} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50" onClick={() => { filtered.filter((f) => filesSel.has(f.id)).forEach(download); setBulkOpen(false) }}>
                          <Download className="size-3.5" /> Download selected
                        </button>
                        <button type="button" disabled={!selIds.length} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50" onClick={() => { setVis(selIds, true); setBulkOpen(false) }}>
                          <CheckCircle2 className="size-3.5" /> Show to customer
                        </button>
                        <button type="button" disabled={!selIds.length} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm disabled:opacity-50" onClick={() => { setVis(selIds, false); setBulkOpen(false) }}>
                          <EyeOffIcon className="size-3.5" /> Hide from customer
                        </button>
                        <button type="button" disabled={!selIds.length} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ember disabled:opacity-50" onClick={() => { removeFiles(selIds); setBulkOpen(false) }}>
                          <Trash2 className="size-3.5" /> Delete selected
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => rows.forEach(download)}>
                  <Download className="size-3.5" /> Download All
                </Button>
                <div className="relative ml-auto">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
                  <input value={filesSearch} onChange={(e) => { setFilesSearch(e.target.value); setFilesPage(1) }} placeholder="Search..." className="h-9 w-56 rounded-lg border border-line bg-card pl-8 pr-3 text-sm" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-slate-100/70 text-left text-xs font-semibold text-mist dark:bg-white/[0.03]">
                      <th className="w-10 px-4 py-3"><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" /></th>
                      <th className="px-4 py-3">Filename</th>
                      <th className="px-4 py-3">File type</th>
                      <th className="px-4 py-3">Last Activity</th>
                      <th className="px-4 py-3">Total Comments</th>
                      <th className="px-4 py-3">Visible to Customer</th>
                      <th className="px-4 py-3">Uploaded by</th>
                      <th className="px-4 py-3">
                        <button type="button" onClick={() => setFilesSortDesc((v) => !v)} className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:text-inherit" title="Toggle sort direction">
                          Date uploaded {filesSortDesc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                        </button>
                      </th>
                      <th className="px-4 py-3">Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((f) => (
                      <tr key={f.id} className="border-b border-line/60 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="px-4 py-3"><input type="checkbox" checked={filesSel.has(f.id)} onChange={() => setFilesSel((prev) => { const n = new Set(prev); if (n.has(f.id)) n.delete(f.id); else n.add(f.id); return n })} aria-label={`Select ${f.filename}`} /></td>
                        <td className="px-4 py-3 font-semibold" title={fmtSize(f.size)}>{f.filename}</td>
                        <td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-mist dark:bg-white/10">{f.fileType}{f.size ? ` · ${fmtSize(f.size)}` : ''}</span></td>
                        <td className="px-4 py-3 text-mist">{formatDate(f.lastActivity.slice(0, 10))}</td>
                        <td className="px-4 py-3 tabular-nums">{f.comments}</td>
                        <td className="px-4 py-3">
                          <button type="button" role="switch" aria-checked={f.visibleToCustomer} disabled={!canManage} onClick={() => setVis([f.id], !f.visibleToCustomer)} className={`relative h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-50 ${f.visibleToCustomer ? 'bg-lime' : 'bg-slate-300 dark:bg-slate-600'}`} title={f.visibleToCustomer ? 'Visible to customer' : 'Hidden from customer'}>
                            <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${f.visibleToCustomer ? 'left-[14px]' : 'left-0.5'}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-mist">{f.uploadedByName}</td>
                        <td className="px-4 py-3 text-mist">{formatDate(f.dateUploaded.slice(0, 10))}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => download(f)} className="rounded-lg p-1.5 text-mist transition hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Download">
                              <Download className="size-4" />
                            </button>
                            {canManage && (
                              <button type="button" onClick={() => removeFiles([f.id])} className="rounded-lg p-1.5 text-mist transition hover:bg-ember/10 hover:text-ember" title="Delete">
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-sm text-mist">No entries found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs font-semibold text-mist">
                  <span>Showing {(page - 1) * filesPageSize + 1}–{Math.min(page * filesPageSize, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setFilesPage((p) => p - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setFilesPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
      {tab === 'discussions' && (() => {
        const q = discSearch.trim().toLowerCase()
        const filtered = discussions
          .filter((d) => d.projectId === id)
          .filter((d) => !q || d.subject.toLowerCase().includes(q) || d.createdBy.toLowerCase().includes(q))
          .sort((a, b) => (discSortDesc ? b.lastActivity.localeCompare(a.lastActivity) : a.lastActivity.localeCompare(b.lastActivity)))
        const pages = Math.max(1, Math.ceil(filtered.length / discPageSize))
        const page = Math.min(discPage, pages)
        const rows = filtered.slice((page - 1) * discPageSize, page * discPageSize)
        const persist = (next: ProjectDiscussion[]) => { setDiscussions(next); saveProjectDiscussions(next) }
        const fmtDT = (iso: string) => {
          const d = new Date(iso)
          return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        }
        const createDiscussion = () => {
          const subject = dSubject.trim()
          if (!subject) { toast.error('Discussion subject required.', 'Discussions'); return }
          const now = new Date().toISOString()
          persist([...discussions, {
            id: uid('pd'), projectId: project.id, subject,
            description: dDesc.trim() || undefined, visibleToCustomer: dVisible,
            createdBy: user?.name || 'You', createdAt: now, lastActivity: now, comments: [],
          }])
          setDiscOpen(false); setDSubject(''); setDDesc(''); setDVisible(false)
          toast.success('Discussion created', subject)
        }
        const addComment = (dId: string) => {
          const text = commentDraft.trim()
          if (!text) return
          const now = new Date().toISOString()
          persist(discussions.map((d) => d.id === dId ? {
            ...d, lastActivity: now,
            comments: [...d.comments, { id: uid('pdc'), author: user?.name || 'You', text, createdAt: now }],
          } : d))
          setCommentDraft('')
        }
        const setVis = (dId: string, v: boolean) => persist(discussions.map((d) => (d.id === dId ? { ...d, visibleToCustomer: v } : d)))
        return (
          <div className="space-y-4">
            {canManage && (
              <Button variant="primary" onClick={() => setDiscOpen(true)}><Plus className="size-4" /> Create Discussion</Button>
            )}

            <div className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <select value={discPageSize} onChange={(e) => { setDiscPageSize(Number(e.target.value)); setDiscPage(1) }} className="h-9 rounded-lg border border-line bg-card px-2 text-sm font-semibold" aria-label="Rows per page">
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => { void exportExcel(`${project.name}-discussions`, filtered.map((d) => ({ Subject: d.subject, 'Started by': d.createdBy, 'Total comments': d.comments.length, 'Visible to customer': d.visibleToCustomer ? 'Yes' : 'No', 'Last activity': fmtDT(d.lastActivity) }))) }}>
                  <Download className="size-3.5" /> Export
                </Button>
                <Button variant="outline" size="icon" className="!size-9" onClick={() => { setDiscussions(loadProjectDiscussions()); toast.success('Discussions refreshed', project.name) }} title="Refresh" aria-label="Refresh discussions">
                  <RefreshCw className="size-3.5" />
                </Button>
                <div className="relative ml-auto">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
                  <input value={discSearch} onChange={(e) => { setDiscSearch(e.target.value); setDiscPage(1) }} placeholder="Search..." className="h-9 w-56 rounded-lg border border-line bg-card pl-8 pr-3 text-sm" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-slate-100/70 text-left text-xs font-semibold text-mist dark:bg-white/[0.03]">
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">
                        <button type="button" onClick={() => setDiscSortDesc((v) => !v)} className="flex w-full items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:text-inherit" title="Toggle sort direction">
                          Last Activity {discSortDesc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                        </button>
                      </th>
                      <th className="px-4 py-3">Total Comments</th>
                      <th className="px-4 py-3">Visible to Customer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((d) => (
                      <Fragment key={d.id}>
                        <tr
                          className={`cursor-pointer border-b border-line/60 transition hover:bg-slate-50 dark:hover:bg-white/[0.02] ${discExpanded === d.id ? 'bg-slate-50 dark:bg-white/[0.02]' : ''}`}
                          onClick={() => { setDiscExpanded((v) => (v === d.id ? null : d.id)); setCommentDraft('') }}
                        >
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2 font-semibold"><MsgIcon className="size-4 shrink-0 text-mist" /> {d.subject}</span>
                            <span className="mt-0.5 block pl-6 text-xs text-mist">by {d.createdBy} · {fmtDT(d.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3 text-mist">{fmtDT(d.lastActivity)}</td>
                          <td className="px-4 py-3 tabular-nums">{d.comments.length}</td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button type="button" role="switch" aria-checked={d.visibleToCustomer} disabled={!canManage} onClick={() => setVis(d.id, !d.visibleToCustomer)} className={`relative h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-50 ${d.visibleToCustomer ? 'bg-lime' : 'bg-slate-300 dark:bg-slate-600'}`} title={d.visibleToCustomer ? 'Visible to customer' : 'Hidden from customer'}>
                              <span className={`absolute top-0.5 size-3 rounded-full bg-white shadow transition-all ${d.visibleToCustomer ? 'left-[14px]' : 'left-0.5'}`} />
                            </button>
                          </td>
                        </tr>
                        {discExpanded === d.id && (
                          <tr className="border-b border-line/60 bg-slate-50/60 dark:bg-white/[0.02]">
                            <td colSpan={4} className="px-6 py-4">
                              {d.description && <p className="mb-3 max-w-3xl text-sm text-mist">{d.description}</p>}
                              <div className="space-y-2.5">
                                {d.comments.map((c) => (
                                  <div key={c.id} className="flex items-start gap-2.5">
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#18181b] text-[9px] font-bold text-white dark:bg-white dark:text-zinc-900">
                                      {c.author.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}
                                    </span>
                                    <div className="min-w-0 rounded-lg border border-line bg-card px-3 py-2">
                                      <p className="text-xs font-bold">{c.author} <span className="ml-1 font-semibold text-mist">{fmtDT(c.createdAt)}</span></p>
                                      <p className="mt-0.5 text-sm">{c.text}</p>
                                    </div>
                                  </div>
                                ))}
                                {d.comments.length === 0 && <p className="text-xs font-semibold text-mist">No comments yet — start the thread below.</p>}
                              </div>
                              {canManage && (
                                <div className="mt-3 flex max-w-xl gap-2">
                                  <Input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="Write a comment…" onKeyDown={(e) => { if (e.key === 'Enter') addComment(d.id) }} />
                                  <Button variant="primary" size="sm" onClick={() => addComment(d.id)} disabled={!commentDraft.trim()}>
                                    <Send className="size-3.5" /> Comment
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-8 text-sm text-mist">No entries found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs font-semibold text-mist">
                  <span>Showing {(page - 1) * discPageSize + 1}–{Math.min(page * discPageSize, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setDiscPage((p) => p - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setDiscPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>

            <Modal open={discOpen} onClose={() => setDiscOpen(false)} title="Create Discussion" narrow>
              <div className="space-y-3">
                <Field label="Subject" required>
                  <Input value={dSubject} onChange={(e) => setDSubject(e.target.value)} placeholder="e.g. Delivery access for week 34" />
                </Field>
                <Field label="Description">
                  <Textarea value={dDesc} onChange={(e) => setDDesc(e.target.value)} rows={3} placeholder="What should the team discuss?" />
                </Field>
                <div className="flex items-center gap-2.5">
                  <button type="button" role="switch" aria-checked={dVisible} onClick={() => setDVisible((v) => !v)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${dVisible ? 'bg-[#18181b] dark:bg-white' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full shadow transition-all ${dVisible ? 'left-[18px] bg-white dark:bg-zinc-900' : 'left-0.5 bg-white'}`} />
                  </button>
                  <span className="text-sm font-semibold">Visible to Customer</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setDiscOpen(false)}>Cancel</Button>
                  <Button onClick={createDiscussion}><Plus className="size-4" /> Create</Button>
                </div>
              </div>
            </Modal>
          </div>
        )

      })()}

      {tab === 'tickets' && (() => {
        const q = ticketSearch.trim().toLowerCase()
        const projTickets = tickets.filter((t) => t.projectId === id)
        const filtered = projTickets
          .filter((t) => !q || t.subject.toLowerCase().includes(q) || t.contact.toLowerCase().includes(q) || t.tags.some((x) => x.toLowerCase().includes(q)))
          .sort((a, b) => (ticketSortDesc ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt)))
        const pages = Math.max(1, Math.ceil(filtered.length / ticketPageSize))
        const page = Math.min(ticketPage, pages)
        const rows = filtered.slice((page - 1) * ticketPageSize, page * ticketPageSize)
        const persist = (next: ProjectTicket[]) => { setTickets(next); saveProjectTickets(next) }
        const fmtDT = (iso?: string) => {
          if (!iso) return '—'
          const d = new Date(iso)
          return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        }
        const STATUS_META: Record<string, string> = { open: '#0ea5e9', answered: '#8b5cf6', closed: '#94a3b8' }
        const PRIORITY_META: Record<string, string> = { low: '#94a3b8', medium: '#f59e0b', high: '#f97316', urgent: '#ef4444' }
        const chip = (label: string, color: string) => (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${color}1a`, color }}>
            <span className="size-1.5 rounded-full" style={{ background: color }} /> {label}
          </span>
        )
        const createTicket = () => {
          const subject = tSubject.trim()
          if (!subject) { toast.error('Ticket subject required.', 'Tickets'); return }
          const now = new Date().toISOString()
          const num = projTickets.reduce((m, t) => Math.max(m, t.number), 1000) + 1
          persist([...tickets, {
            id: uid('ptk'), projectId: project.id, number: num, subject,
            description: tDesc.trim() || undefined,
            tags: tTags.split(',').map((x) => x.trim()).filter(Boolean),
            department: tDept, service: tService,
            contact: tContact.trim() || project.clientName || '—',
            status: 'open', priority: tPriority, createdAt: now, replies: [],
          }])
          setTicketOpen(false); setTSubject(''); setTDesc(''); setTTags(''); setTContact('')
          toast.success(`Ticket #${num} created`, subject)
        }
        const addReply = (tid: string) => {
          const text = replyDraft.trim()
          if (!text) return
          const now = new Date().toISOString()
          persist(tickets.map((t) => t.id === tid ? {
            ...t, lastReply: now, status: t.status === 'open' ? 'answered' : t.status,
            replies: [...t.replies, { id: uid('ptr'), author: user?.name || 'You', text, createdAt: now }],
          } : t))
          setReplyDraft('')
        }
        const closeTicket = (tid: string) => persist(tickets.map((t) => (t.id === tid ? { ...t, status: 'closed', lastReply: new Date().toISOString() } : t)))
        return (
          <div className="space-y-4">
            {canManage && (
              <Button variant="primary" onClick={() => setTicketOpen(true)}><Plus className="size-4" /> New Ticket</Button>
            )}

            <div className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <select value={ticketPageSize} onChange={(e) => { setTicketPageSize(Number(e.target.value)); setTicketPage(1) }} className="h-9 rounded-lg border border-line bg-card px-2 text-sm font-semibold" aria-label="Rows per page">
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => { void exportExcel(`${project.name}-tickets`, filtered.map((t) => ({ '#': t.number, Subject: t.subject, Tags: t.tags.join(', '), Department: t.department, Service: t.service, Contact: t.contact, Status: t.status, Priority: t.priority, 'Last reply': t.lastReply ? fmtDT(t.lastReply) : '—', Created: fmtDT(t.createdAt) }))) }}>
                  <Download className="size-3.5" /> Export
                </Button>
                <Button variant="outline" size="icon" className="!size-9" onClick={() => { setTickets(loadProjectTickets()); toast.success('Tickets refreshed', project.name) }} title="Refresh" aria-label="Refresh tickets">
                  <RefreshCw className="size-3.5" />
                </Button>
                <div className="relative ml-auto">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
                  <input value={ticketSearch} onChange={(e) => { setTicketSearch(e.target.value); setTicketPage(1) }} placeholder="Search..." className="h-9 w-56 rounded-lg border border-line bg-card pl-8 pr-3 text-sm" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-slate-100/70 text-left text-xs font-semibold text-mist dark:bg-white/[0.03]">
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Tags</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Last Reply</th>
                      <th className="px-4 py-3">
                        <button type="button" onClick={() => setTicketSortDesc((v) => !v)} className="flex w-full items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:text-inherit" title="Toggle sort direction">
                          Created {ticketSortDesc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <Fragment key={t.id}>
                        <tr
                          className={`cursor-pointer border-b border-line/60 transition hover:bg-slate-50 dark:hover:bg-white/[0.02] ${ticketExpanded === t.id ? 'bg-slate-50 dark:bg-white/[0.02]' : ''}`}
                          onClick={() => { setTicketExpanded((v) => (v === t.id ? null : t.id)); setReplyDraft('') }}
                        >
                          <td className="px-4 py-3 font-bold tabular-nums text-mist">{t.number}</td>
                          <td className="px-4 py-3 font-semibold">{t.subject}</td>
                          <td className="px-4 py-3">
                            {t.tags.length ? (
                              <span className="flex flex-wrap gap-1">{t.tags.map((x) => <span key={x} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-mist dark:bg-white/10">{x}</span>)}</span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3 text-mist">{t.department}</td>
                          <td className="px-4 py-3 text-mist">{t.service}</td>
                          <td className="px-4 py-3 text-mist">{t.contact}</td>
                          <td className="px-4 py-3">{chip(t.status, STATUS_META[t.status])}</td>
                          <td className="px-4 py-3">{chip(t.priority, PRIORITY_META[t.priority])}</td>
                          <td className="px-4 py-3 text-mist">{fmtDT(t.lastReply)}</td>
                          <td className="px-4 py-3 text-mist">{fmtDT(t.createdAt)}</td>
                        </tr>
                        {ticketExpanded === t.id && (
                          <tr className="border-b border-line/60 bg-slate-50/60 dark:bg-white/[0.02]">
                            <td colSpan={10} className="px-6 py-4">
                              {t.description && <p className="mb-3 max-w-3xl text-sm text-mist">{t.description}</p>}
                              <div className="space-y-2.5">
                                {t.replies.map((r) => (
                                  <div key={r.id} className="flex items-start gap-2.5">
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#18181b] text-[9px] font-bold text-white dark:bg-white dark:text-zinc-900">
                                      {r.author.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('')}
                                    </span>
                                    <div className="min-w-0 rounded-lg border border-line bg-card px-3 py-2">
                                      <p className="text-xs font-bold">{r.author} <span className="ml-1 font-semibold text-mist">{fmtDT(r.createdAt)}</span></p>
                                      <p className="mt-0.5 text-sm">{r.text}</p>
                                    </div>
                                  </div>
                                ))}
                                {t.replies.length === 0 && <p className="text-xs font-semibold text-mist">No replies yet.</p>}
                              </div>
                              {canManage && t.status !== 'closed' && (
                                <div className="mt-3 flex max-w-xl flex-wrap items-center gap-2">
                                  <Input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Write a reply…" onKeyDown={(e) => { if (e.key === 'Enter') addReply(t.id) }} />
                                  <Button variant="primary" size="sm" onClick={() => addReply(t.id)} disabled={!replyDraft.trim()}><Send className="size-3.5" /> Reply</Button>
                                  <Button variant="outline" size="sm" onClick={() => closeTicket(t.id)}>Close ticket</Button>
                                </div>
                              )}
                              {t.status === 'closed' && <p className="mt-3 text-xs font-bold uppercase tracking-wide text-mist">This ticket is closed.</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-sm text-mist">No entries found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs font-semibold text-mist">
                  <span>Showing {(page - 1) * ticketPageSize + 1}–{Math.min(page * ticketPageSize, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setTicketPage((p) => p - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setTicketPage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>

            <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title="New Ticket" narrow>
              <div className="space-y-3">
                <Field label="Subject" required>
                  <Input value={tSubject} onChange={(e) => setTSubject(e.target.value)} placeholder="Brief summary of the issue" />
                </Field>
                <Field label="Description">
                  <Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} rows={3} placeholder="What happened, and what is needed?" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Department">
                    <select value={tDept} onChange={(e) => setTDept(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-card px-2 text-sm font-semibold">
                      {['Projects', 'Technical', 'Billing', 'General'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </Field>
                  <Field label="Service">
                    <select value={tService} onChange={(e) => setTService(e.target.value)} className="h-10 w-full rounded-lg border border-line bg-card px-2 text-sm font-semibold">
                      {['Site Works', 'Installation', 'Maintenance', 'Supply'].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select value={tPriority} onChange={(e) => setTPriority(e.target.value as ProjectTicket['priority'])} className="h-10 w-full rounded-lg border border-line bg-card px-2 text-sm font-semibold">
                      {(['low', 'medium', 'high', 'urgent'] as const).map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
                    </select>
                  </Field>
                  <Field label="Contact">
                    <Input value={tContact} onChange={(e) => setTContact(e.target.value)} placeholder={project.clientName || 'Contact name'} />
                  </Field>
                </div>
                <Field label="Tags">
                  <Input value={tTags} onChange={(e) => setTTags(e.target.value)} placeholder="comma, separated, tags" />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setTicketOpen(false)}>Cancel</Button>
                  <Button onClick={createTicket}><Plus className="size-4" /> Create ticket</Button>
                </div>
              </div>
            </Modal>
          </div>
        )
      })()}

      {tab === 'purchase' && (() => {
        const q = purchaseSearch.trim().toLowerCase()
        const projPurchases = purchases.filter((x) => x.projectId === id)
        const filtered = projPurchases
          .filter((x) => !q || x.item.toLowerCase().includes(q) || x.supplier.toLowerCase().includes(q))
          .sort((a, b) => (purchaseSortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
        const pages = Math.max(1, Math.ceil(filtered.length / purchasePageSize))
        const page = Math.min(purchasePage, pages)
        const rows = filtered.slice((page - 1) * purchasePageSize, page * purchasePageSize)
        const total = projPurchases.filter((x) => x.status !== 'cancelled').reduce((n, x) => n + x.cost, 0)
        const persist = (next: ProjectPurchase[]) => { setPurchases(next); saveProjectPurchases(next) }
        const STATUS_META: Record<string, string> = { ordered: '#0ea5e9', received: '#22c55e', cancelled: '#94a3b8' }
        const createPurchase = () => {
          const item = pItem.trim()
          const cost = Number(pCost)
          if (!item) { toast.error('Item name required.', 'Purchase'); return }
          if (!pCost || Number.isNaN(cost) || cost < 0) { toast.error('Enter a valid cost.', 'Purchase'); return }
          persist([...purchases, {
            id: uid('pp'), projectId: project.id, item, supplier: pSupplier.trim() || '—',
            qty: Math.max(1, Number(pQty) || 1), cost, status: pStatus,
            purchasedBy: user?.name || 'You', date: new Date().toISOString().slice(0, 10),
            notes: pNotes.trim() || undefined,
          }])
          setPurchaseOpen(false); setPItem(''); setPSupplier(''); setPQty('1'); setPCost(''); setPNotes('')
          toast.success('Purchase recorded', item)
        }
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {canManage && <Button variant="primary" onClick={() => setPurchaseOpen(true)}><Plus className="size-4" /> New Purchase</Button>}
              <div className="flex items-baseline gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5">
                <span className="text-sm font-bold tabular-nums">{formatGhsExact(total)}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-mist">Total spend</span>
              </div>
            </div>

            <div className="card">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <select value={purchasePageSize} onChange={(e) => { setPurchasePageSize(Number(e.target.value)); setPurchasePage(1) }} className="h-9 rounded-lg border border-line bg-card px-2 text-sm font-semibold" aria-label="Rows per page">
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => { void exportExcel(`${project.name}-purchases`, filtered.map((x) => ({ Item: x.item, Supplier: x.supplier, Qty: x.qty, Cost: x.cost, Status: x.status, 'Purchased by': x.purchasedBy, Date: formatDate(x.date) }))) }}>
                  <Download className="size-3.5" /> Export
                </Button>
                <Button variant="outline" size="icon" className="!size-9" onClick={() => { setPurchases(loadProjectPurchases()); toast.success('Purchases refreshed', project.name) }} title="Refresh" aria-label="Refresh purchases">
                  <RefreshCw className="size-3.5" />
                </Button>
                <div className="relative ml-auto">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
                  <input value={purchaseSearch} onChange={(e) => { setPurchaseSearch(e.target.value); setPurchasePage(1) }} placeholder="Search..." className="h-9 w-56 rounded-lg border border-line bg-card pl-8 pr-3 text-sm" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-slate-100/70 text-left text-xs font-semibold text-mist dark:bg-white/[0.03]">
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Cost</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Purchased by</th>
                      <th className="px-4 py-3">
                        <button type="button" onClick={() => setPurchaseSortDesc((v) => !v)} className="flex w-full items-center justify-between gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:text-inherit" title="Toggle sort direction">
                          Date {purchaseSortDesc ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
                        </button>
                      </th>
                      {canManage && <th className="px-4 py-3">Options</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x) => (
                      <tr key={x.id} className="border-b border-line/60 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[0.02]" title={x.notes}>
                        <td className="px-4 py-3 font-semibold">{x.item}</td>
                        <td className="px-4 py-3 text-mist">{x.supplier}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{x.qty}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatGhsExact(x.cost)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${STATUS_META[x.status]}1a`, color: STATUS_META[x.status] }}>
                            <span className="size-1.5 rounded-full" style={{ background: STATUS_META[x.status] }} /> {x.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-mist">{x.purchasedBy}</td>
                        <td className="px-4 py-3 text-mist">{formatDate(x.date)}</td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => { persist(purchases.filter((y) => y.id !== x.id)); toast.success('Purchase deleted', x.item) }} className="rounded-lg p-1.5 text-mist transition hover:bg-ember/10 hover:text-ember" title="Delete">
                              <Trash2 className="size-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-sm text-mist">No entries found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs font-semibold text-mist">
                  <span>Showing {(page - 1) * purchasePageSize + 1}–{Math.min(page * purchasePageSize, filtered.length)} of {filtered.length}</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPurchasePage((p) => p - 1)}>Prev</Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPurchasePage((p) => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </div>

            <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="New Purchase" narrow>
              <div className="space-y-3">
                <Field label="Item" required>
                  <Input value={pItem} onChange={(e) => setPItem(e.target.value)} placeholder="What was purchased?" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Supplier">
                    <Input value={pSupplier} onChange={(e) => setPSupplier(e.target.value)} placeholder="Supplier name" />
                  </Field>
                  <Field label="Status">
                    <select value={pStatus} onChange={(e) => setPStatus(e.target.value as ProjectPurchase['status'])} className="h-10 w-full rounded-lg border border-line bg-card px-2 text-sm font-semibold">
                      {(['ordered', 'received', 'cancelled'] as const).map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
                    </select>
                  </Field>
                  <Field label="Qty">
                    <Input type="number" min={1} value={pQty} onChange={(e) => setPQty(e.target.value)} />
                  </Field>
                  <Field label="Cost (GH₵)" required>
                    <Input type="number" min={0} step="0.01" value={pCost} onChange={(e) => setPCost(e.target.value)} placeholder="0.00" />
                  </Field>
                </div>
                <Field label="Notes">
                  <Textarea value={pNotes} onChange={(e) => setPNotes(e.target.value)} rows={2} placeholder="Optional note…" />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setPurchaseOpen(false)}>Cancel</Button>
                  <Button onClick={createPurchase}><Plus className="size-4" /> Record purchase</Button>
                </div>
              </div>
            </Modal>
          </div>
        )
      })()}

      {tab === 'notes' && (() => {
        const q = noteSearch.trim().toLowerCase()
        const projNotes = notes
          .filter((n) => n.projectId === id)
          .filter((n) => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const persist = (next: ProjectNote[]) => { setNotes(next); saveProjectNotes(next) }
        const createNote = () => {
          const title = nTitle.trim()
          if (!title) { toast.error('Note title required.', 'Notes'); return }
          persist([...notes, { id: uid('pn'), projectId: project.id, title, body: nBody.trim(), createdBy: user?.name || 'You', createdAt: new Date().toISOString() }])
          setNoteOpen(false); setNTitle(''); setNBody('')
          toast.success('Note saved', title)
        }
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {canManage && <Button variant="primary" onClick={() => setNoteOpen(true)}><Plus className="size-4" /> New Note</Button>}
              <Button variant="outline" size="sm" onClick={() => { void exportExcel(`${project.name}-notes`, projNotes.map((n) => ({ Title: n.title, Note: n.body, 'Created by': n.createdBy, Created: formatDate(n.createdAt.slice(0, 10)) }))) }}>
                <Download className="size-3.5" /> Export
              </Button>
              <div className="relative ml-auto">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
                <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search..." className="h-9 w-56 rounded-lg border border-line bg-card pl-8 pr-3 text-sm" />
              </div>
            </div>

            {projNotes.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {projNotes.map((n) => (
                  <div key={n.id} className="card space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-2 font-bold"><StickyNote className="size-4 shrink-0 text-lime" /> {n.title}</p>
                      {canManage && (
                        <button type="button" onClick={() => { persist(notes.filter((x) => x.id !== n.id)); toast.success('Note deleted', n.title) }} className="rounded-lg p-1.5 text-mist transition hover:bg-ember/10 hover:text-ember" title="Delete note">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    {n.body && <p className="whitespace-pre-wrap text-sm text-mist">{n.body}</p>}
                    <p className="text-xs font-semibold text-mist">{n.createdBy} · {formatDate(n.createdAt.slice(0, 10))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card"><Empty title="No notes" desc={q ? 'No notes match your search.' : 'Create the first note with the New Note button.'} /></div>
            )}

            <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="New Note" narrow>
              <div className="space-y-3">
                <Field label="Title" required>
                  <Input value={nTitle} onChange={(e) => setNTitle(e.target.value)} placeholder="Note title" />
                </Field>
                <Field label="Note">
                  <Textarea value={nBody} onChange={(e) => setNBody(e.target.value)} rows={4} placeholder="Write the note…" />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setNoteOpen(false)}>Cancel</Button>
                  <Button onClick={createNote}><Plus className="size-4" /> Save note</Button>
                </div>
              </div>
            </Modal>
          </div>
        )
      })()}

      {tab === 'gantt' && (
        <div className="card p-5">
          {projectTasks.some((t) => t.startDate && t.dueDate)
            ? <GanttView project={project} tasks={tasks} />
            : <Empty title="Nothing to chart" desc="Tasks with start and due dates are drawn on the Gantt chart." />}
        </div>
      )}

      {/* ── Contracts ─ */}
      {tab === 'contracts' && (() => {
        const base = contracts.filter((c) => c.projectId === id)
        const counts = contractCounts(base)
        const q = ctSearch.trim().toLowerCase()
        let filtered = [...base]
        if (ctStatusSelect) filtered = filtered.filter((c) => c.status === ctStatusSelect)
        if (ctStatusFilter === 'overdue') filtered = filtered.filter((c) => isContractOverdue(c))
        else if (ctStatusFilter) filtered = filtered.filter((c) => c.status === ctStatusFilter)
        if (q) filtered = filtered.filter((c) => `${c.subject} ${c.clientName} ${c.projectName}`.toLowerCase().includes(q))
        const dir = ctSortDir === 'asc' ? 1 : -1
        filtered.sort((a, b) => {
          if (ctSortBy === 'value') return (a.value - b.value) * dir
          if (ctSortBy === 'project') return a.projectName.localeCompare(b.projectName) * dir
          return a.clientName.localeCompare(b.clientName) * dir
        })
        const pageCount = Math.max(1, Math.ceil(filtered.length / ctPageSize))
        const safePage = Math.min(ctPage, pageCount)
        const paged = filtered.slice((safePage - 1) * ctPageSize, safePage * ctPageSize)
        const onSort = (k: 'client' | 'project' | 'value') => {
          if (ctSortBy === k) setCtSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          else { setCtSortBy(k); setCtSortDir('asc') }
        }
        const SortTh = ({ label, k }: { label: string; k: 'client' | 'project' | 'value' }) => (
          <button type="button" onClick={() => onSort(k)} className="flex items-center gap-1 font-bold">
            {label}
            {ctSortBy === k ? (ctSortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
          </button>
        )
        const summaryCards = [
          ...CONTRACT_STATUSES.map((st) => ({ key: st.id as string, label: st.label, color: st.card })),
          { key: 'overdue', label: 'Overdue', color: '#e40000' },
        ]
        const exportRows = filtered.map((c) => ({
          Subject: c.subject, Client: c.clientName, Project: c.projectName,
          Value: c.value, Start_Date: c.startDate, End_Date: c.endDate, Status: contractStatusMeta(c.status).label,
        }))
        return (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold"><FileSignature className="size-5" /> Contract List</h2>
              <div className="flex items-center gap-2">
                {canManage && (
                  <Button onClick={() => setCtEditing({ subject: '', clientName: project.clientName || '', value: '0', startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'open', description: '' })} className="rounded-full">
                    <Plus className="size-4" /> Add
                  </Button>
                )}
                <button type="button" onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white" title="Print" aria-label="Print contracts">
                  <Printer className="size-4" />
                </button>
                <ExportButtons filename={`${project.name}-contracts`} rows={exportRows} compact />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Select value={ctStatusSelect} onChange={(e) => { setCtStatusSelect(e.target.value); setCtPage(1) }} className="w-40">
                <option value="">All statuses</option>
                {CONTRACT_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
              </Select>
              <div className="flex flex-wrap gap-2">
                {summaryCards.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => { setCtStatusFilter(ctStatusFilter === c.key ? '' : c.key); setCtPage(1) }}
                    className={`flex items-stretch overflow-hidden rounded-md text-white shadow-sm ${ctStatusFilter === c.key ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
                    style={{ backgroundColor: c.color }}
                  >
                    <span className="px-4 py-2.5 text-sm font-semibold">{c.label}</span>
                    <span className="grid min-w-10 place-items-center bg-white px-2 font-bold text-slate-800 [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">{counts[c.key] ?? 0}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                Show
                <Select value={String(ctPageSize)} onChange={(e) => { setCtPageSize(Number(e.target.value)); setCtPage(1) }} className="w-20">
                  <option value="10">10</option><option value="25">25</option><option value="50">50</option>
                </Select>
                entries
              </label>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">Search:</span>
                <Input value={ctSearch} onChange={(e) => { setCtSearch(e.target.value); setCtPage(1) }} className="w-48" />
              </div>
            </div>

            <div className="overflow-x-auto px-5 pt-3">
              <table className="w-full min-w-[900px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                    <th className="w-8 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Subject</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortTh label="Client" k="client" /></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortTh label="Project" k="project" /></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortTh label="Value" k="value" /></th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Start_Date</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">End_Date</th>
                    <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((c, i) => (
                    <tr key={c.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                      <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * ctPageSize + i + 1}</td>
                      <td className="px-2 py-2.5 align-top">
                        <div className="relative inline-block">
                          <button type="button" onClick={() => setCtMenuFor(ctMenuFor === c.id ? null : c.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions">
                            <MoreVertical className="size-4" />
                          </button>
                          {ctMenuFor === c.id && (
                            <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                              <button type="button" onClick={() => { setCtMenuFor(null); setCtEditing({ id: c.id, subject: c.subject, clientName: c.clientName, value: String(c.value), startDate: c.startDate, endDate: c.endDate, status: c.status, description: c.description || '' }) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm">
                                <Pencil className="size-3.5" /> Edit
                              </button>
                              <button type="button" onClick={() => { setCtMenuFor(null); setCtDeleting(c) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600">
                                <Trash2 className="size-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 align-top font-semibold text-zinc-900 dark:text-zinc-100">{c.subject}</td>
                      <td className="px-2 py-2.5 align-top">{c.clientName || '—'}</td>
                      <td className="px-2 py-2.5 align-top">{c.projectName || '—'}</td>
                      <td className="px-2 py-2.5 align-top font-semibold">{formatGhsExact(c.value)}</td>
                      <td className="px-2 py-2.5 align-top">{c.startDate}</td>
                      <td className="px-2 py-2.5 align-top">
                        {c.endDate}
                        {isContractOverdue(c) && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Overdue</span>}
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <select value={c.status} disabled={!canManage} onChange={(e) => { app.upsertContract({ ...c, status: e.target.value as ContractStatus }); toast.success('Status updated') }}
                          className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold ${contractStatusMeta(c.status).badge}`}>
                          {CONTRACT_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {!paged.length && (
                    <tr><td colSpan={9} className="bg-zinc-100 px-4 py-4 text-center text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">No data available in table</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
              <span>
                Showing {filtered.length === 0 ? 0 : (safePage - 1) * ctPageSize + 1} to{' '}
                {Math.min(safePage * ctPageSize, filtered.length)} of {filtered.length} entries
              </span>
              <div className="flex items-center gap-1">
                <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setCtPage((v) => Math.max(1, v - 1))}>Previous</button>
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                  const n = i + 1
                  return (
                    <button key={n} type="button" className="btn min-w-9" aria-current={safePage === n ? 'page' : undefined}
                      style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                      onClick={() => setCtPage(n)}>{n}</button>
                  )
                })}
                <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setCtPage((v) => Math.min(pageCount, v + 1))}>Next</button>
              </div>
            </div>
          </div>
        )
      })()}

      <Modal open={!!ctEditing} onClose={() => setCtEditing(null)} title={ctEditing?.id ? 'Edit Contract' : 'Add Contract'} wide>
        {ctEditing && (
          <div className="space-y-4">
            <Field label="Subject" required><Input value={ctEditing.subject} onChange={(e) => setCtEditing({ ...ctEditing, subject: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client">
                <Input value={ctEditing.clientName} onChange={(e) => setCtEditing({ ...ctEditing, clientName: e.target.value })} placeholder={project.clientName || 'Client name'} />
              </Field>
              <Field label="Project">
                <Input value={project.name} disabled />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Value"><Input type="number" min={0} value={ctEditing.value} onChange={(e) => setCtEditing({ ...ctEditing, value: e.target.value })} /></Field>
              <Field label="Start date"><DatePicker value={ctEditing.startDate} onChange={(v) => setCtEditing({ ...ctEditing, startDate: v })} /></Field>
              <Field label="End date"><DatePicker value={ctEditing.endDate} onChange={(v) => setCtEditing({ ...ctEditing, endDate: v })} /></Field>
            </div>
            <Field label="Status">
              <Select value={ctEditing.status} onChange={(e) => setCtEditing({ ...ctEditing, status: e.target.value as ContractStatus })}>
                {CONTRACT_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
              </Select>
            </Field>
            <Field label="Description"><Textarea value={ctEditing.description} onChange={(e) => setCtEditing({ ...ctEditing, description: e.target.value })} rows={3} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCtEditing(null)}>Cancel</Button>
              <Button onClick={saveContract}>{ctEditing.id ? 'Save changes' : 'Create contract'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!ctDeleting} onClose={() => setCtDeleting(null)} title="Delete contract">
        {ctDeleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{ctDeleting.subject}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCtDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { app.deleteContract(ctDeleting.id); toast.success('Contract deleted'); setCtDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!tsEditing} onClose={() => setTsEditing(null)} title={tsEditing?.id ? 'Edit timesheet' : 'Add timesheet'}>
        {tsEditing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="User" required className="sm:col-span-2">
              <Select value={tsEditing.userId} onChange={(e) => setTsEditing({ ...tsEditing, userId: e.target.value })}>
                <option value="">Please Select...</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <Field label="Task" required className="sm:col-span-2">
              <Input value={tsEditing.task} onChange={(e) => setTsEditing({ ...tsEditing, task: e.target.value })} placeholder="e.g. Site supervision" />
            </Field>
            <Field label="Date">
              <Input type="date" value={tsEditing.date} onChange={(e) => setTsEditing({ ...tsEditing, date: e.target.value })} />
            </Field>
            <Field label="Hourly Rate (GHS)">
              <Input type="number" min="0" step="0.5" value={tsEditing.rate} onChange={(e) => setTsEditing({ ...tsEditing, rate: e.target.value })} />
            </Field>
            <Field label="Start Time">
              <Input type="time" value={tsEditing.start} onChange={(e) => setTsEditing({ ...tsEditing, start: e.target.value })} />
            </Field>
            <Field label="End Time">
              <Input type="time" value={tsEditing.end} onChange={(e) => setTsEditing({ ...tsEditing, end: e.target.value })} />
            </Field>
            <div className="sm:col-span-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Total hours: <span className="font-semibold">{computeHours(tsEditing.start, tsEditing.end)}</span> · Earnings:{' '}
              <span className="font-semibold">{(computeHours(tsEditing.start, tsEditing.end) * (Number(tsEditing.rate) || 0)).toFixed(2)}</span>
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => setTsEditing(null)}>Cancel</Button>
              <Button onClick={saveTimesheet}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!tsDeleting} onClose={() => setTsDeleting(null)} title="Delete timesheet">
        {tsDeleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{tsDeleting.task}</span> for {tsDeleting.userName}? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTsDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { app.deleteTimesheet(tsDeleting.id); toast.success('Deleted'); setTsDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Sales ── */}
      {tab === 'sales' && (
        <div className="card overflow-x-auto">
          {projectInvs.length ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-mist">
                  <th className="px-4 py-3 font-semibold">Invoice</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {projectInvs.map((i) => (
                  <tr key={i.id} className="border-b border-line/60 last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold">{i.number}</td>
                    <td className="px-4 py-3">{i.clientName}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatGhsExact(i.total)}</td>
                    <td className="px-4 py-3"><Badge tone={i.status === 'paid' ? 'lime' : i.status === 'sent' ? 'amber' : i.status === 'cancelled' ? 'rose' : 'zinc'}>{i.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No invoices yet" desc="Raise the first invoice for this project with Invoice Project." />
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectDetail

function TsAvatar({ name, photo }: { name: string; photo?: string }) {
  const initials = name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return photo
    ? <img src={photo} alt={name} className="size-8 shrink-0 rounded-full object-cover" />
    : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1f4e79] text-[11px] font-semibold text-white">{initials}</span>
}
