import { useMemo, useState } from 'react'
import {
  LayoutGrid, List as ListIcon, Plus, MoreVertical, Pencil, Trash2, Search,
  ChevronUp, ChevronDown, ChevronsUpDown, FolderKanban, CalendarDays,
  X, Paperclip, Save as SaveIcon, Eye, ClipboardList,
  Copy, ChartGantt, Share2, Pin, Archive, SquarePen,
} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { isOverdue, projectCounts } from '../../../lib/projects'
import { PROJECT_TYPES } from '../../../lib/taskTemplates'
import { useNavigate } from 'react-router-dom'
import { GanttView } from '../../../components/project/GanttView'
import type { Project, ProjectPriority, ProjectStatus } from '../../../types'

type SortKey = 'name' | 'client' | 'progress' | 'status'

interface StageFlags { ongoing: boolean; completed: boolean; outstanding: boolean }
const noFlags = (): StageFlags => ({ ongoing: false, completed: false, outstanding: false })

interface Form {
  id?: string
  name: string
  projectTypeId: string
  managerId: string
  clientId: string
  estimatedValue: string
  projectAccount: string
  locationId: string
  categoryId: string
  idColor: string
  priority: ProjectPriority
  status: ProjectStatus
  startDate: string
  endDate: string
  assigneeIds: string[]
  description: string
  stageStates: Record<string, StageFlags>
  attachments: { name: string; size: number }[]
}

const blank = (): Form => ({
  name: '', projectTypeId: '', managerId: '', clientId: '', estimatedValue: '0',
  projectAccount: 'INITIAL', locationId: '', categoryId: '', idColor: '#000000', priority: 'high', status: 'open',
  startDate: new Date().toISOString().slice(0, 10), endDate: '',
  assigneeIds: [], description: '', stageStates: {}, attachments: [],
})

/** Striped purple progress bar with the % label riding on the fill, as in the mock. */
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const stripe = 'repeating-linear-gradient(45deg, #9333ea 0 8px, #a855f7 8px 16px)'
  return (
    <div className="relative h-4 w-36 overflow-hidden rounded-full bg-slate-200/70">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundImage: stripe }} />
      <span
        className="absolute top-0 flex h-4 -translate-x-1/2 items-center rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-slate-800 shadow"
        style={{ left: `${Math.max(pct, 12)}%` }}
      >
        {pct} %
      </span>
    </div>
  )
}

/** Overlapping assignee avatars — photo when the user has one, else short
 * initials — with a +N overflow chip, as in the reference. */
function Assignees({ ids, users }: { ids: string[]; users: { id: string; name: string; avatar?: string }[] }) {
  const people = ids
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean) as { id: string; name: string; avatar?: string }[]
  const shown = people.slice(0, 2)
  const extra = people.length - shown.length
  const initials = (n: string) => n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span
          key={p.id}
          data-tip={p.name}
          className="bs-tooltip block"
          style={{ marginLeft: i ? -10 : 0, zIndex: 10 - i }}
        >
          <span className="block size-8 overflow-hidden rounded-full border-2 border-white shadow-sm">
            {p.avatar ? (
              <img src={p.avatar} alt={p.name} className="size-8 rounded-full object-cover" />
            ) : (
              <span className="grid size-8 place-items-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                {initials(p.name)}
              </span>
            )}
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span
          data-tip={people.slice(2).map((p) => p.name).join(', ')}
          className="bs-tooltip grid size-8 place-items-center rounded-full border-2 border-white bg-slate-800 text-[10px] font-bold text-white"
          style={{ marginLeft: -10 }}
        >
          +{extra}
        </span>
      )}
      {people.length === 0 && <span className="text-xs text-mist">—</span>}
    </div>
  )
}

function SortHeader({ label, k, sortBy, sortDir, onSort, className }: {
  label: string; k: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void; className?: string
}) {
  const active = sortBy === k
  return (
    <button onClick={() => onSort(k)} className={`flex items-center gap-1 font-bold ${className || ''}`}>
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  )
}

export function Projects() {
  const navigate = useNavigate()
  const app = useApp()
  const toast = useToast()
  const { projects, upsertProject, deleteProject, users, customers, branches, workStages, projectTypes, tasks, projectStatuses, projectPriorities, projectCategories } = app

  const [view, setView] = useState<'graphic' | 'list'>('graphic')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [filter, setFilter] = useState('')
  const [applied, setApplied] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [viewing, setViewing] = useState<Project | null>(null)
  const [ganttFor, setGanttFor] = useState<Project | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelected = (id: string) => setSelected((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const counts = useMemo(() => projectCounts(projects), [projects])

  // Colour-coded definitions from Project Settings (with safe fallbacks).
  const statusDef = (id: string) => projectStatuses.find((x) => x.id === id) || { id, name: id, color: '#8d939b' }
  const priorityDef = (id: string) => projectPriorities.find((x) => x.id === id) || { id, name: id, color: '#64748b' }
  const categoryDef = (id?: string) => projectCategories.find((x) => x.id === id)

  const taskCountsByProject = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of tasks) if (t.projectId) m[t.projectId] = (m[t.projectId] || 0) + 1
    return m
  }, [tasks])

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    let list = [...projects].filter((p) => (showArchived ? true : !p.archived))
    if (statusFilter === 'overdue') list = list.filter((p) => isOverdue(p))
    else if (statusFilter !== 'all') list = list.filter((p) => p.status === statusFilter)
    if (q) list = list.filter((p) => `${p.name} ${p.clientName}`.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
      if (sortBy === 'progress') return (a.progress - b.progress) * dir
      if (sortBy === 'client') return a.clientName.localeCompare(b.clientName) * dir
      if (sortBy === 'status') return a.status.localeCompare(b.status) * dir
      return a.name.localeCompare(b.name) * dir
    })
    return list
  }, [projects, statusFilter, applied, sortBy, sortDir, showArchived])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(k); setSortDir('asc') }
  }

  const typeNames = useMemo(() => {
    const names = projectTypes.filter((t) => t.status === 'ACTIVE').map((t) => t.name)
    return names.length ? names : PROJECT_TYPES
  }, [projectTypes])

  const openEdit = (p: Project) => setEditing({
    id: p.id, name: p.name, projectTypeId: p.projectTypeId || '', managerId: p.managerId || '',
    clientId: p.clientId || '', categoryId: p.categoryId || '', estimatedValue: String(p.estimatedValue ?? 0),
    projectAccount: p.projectAccount || 'INITIAL', locationId: p.branchId || '', idColor: p.idColor || '#000000',
    priority: p.priority, status: p.status, startDate: p.startDate, endDate: p.endDate,
    assigneeIds: [...p.assigneeIds], description: p.description || '',
    stageStates: p.stageStates ? JSON.parse(JSON.stringify(p.stageStates)) : {},
    attachments: [...(p.attachments || [])],
  })

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter the project name.'); return }
    if (!editing.projectTypeId) { toast.error('Select a project type.'); return }
    if (!editing.managerId) { toast.error('Select a project manager.'); return }
    if (!editing.clientId) { toast.error('Select a client.'); return }
    const client = customers.find((c) => c.id === editing.clientId)
    const type = projectTypes.find((t) => t.id === editing.projectTypeId)
    const original = editing.id ? projects.find((x) => x.id === editing.id) : undefined
    const stageRows = workStages.filter((w) => w.projectType === (type?.name || ''))
    const done = stageRows.filter((w) => editing.stageStates[w.id]?.completed).length
    const progress = stageRows.length ? Math.round((done / stageRows.length) * 10000) / 100 : (original?.progress ?? 0)
    const isNew = !editing.id
    upsertProject({
      ...(original || {}),
      id: editing.id || uid('pr'),
      name: editing.name.trim(),
      projectTypeId: editing.projectTypeId,
      projectType: type?.name,
      managerId: editing.managerId,
      clientId: editing.clientId,
      clientName: client?.name || original?.clientName || '',
      clientPhone: client?.phone || original?.clientPhone || '',
      estimatedValue: Number(editing.estimatedValue) || 0,
      categoryId: editing.categoryId || undefined,
      projectAccount: editing.projectAccount,
      branchId: editing.locationId || undefined,
      idColor: editing.idColor,
      priority: editing.priority,
      status: editing.status,
      startDate: editing.startDate,
      endDate: editing.endDate,
      progress,
      assigneeIds: editing.assigneeIds,
      description: editing.description.trim() || undefined,
      stageStates: editing.stageStates,
      attachments: editing.attachments,
    })
    toast.success(isNew ? 'Project created' : 'Project updated')
    setEditing(null)
  }

  const changeStatus = (p: Project, status: ProjectStatus) => {
    upsertProject({ ...p, status })
    toast.success(`${p.name} → ${statusDef(status).name}`)
  }

  const duplicateProject = (p: Project) => {
    upsertProject({ ...p, id: uid('pr'), name: `${p.name} (Copy)`, progress: 0, pinned: false, archived: false })
    toast.success('Project duplicated', `${p.name} (Copy)`)
  }

  const togglePin = (p: Project) => {
    upsertProject({ ...p, pinned: !p.pinned })
    toast.success(p.pinned ? 'Project unpinned' : 'Project pinned', p.name)
  }

  const toggleArchive = (p: Project) => {
    upsertProject({ ...p, archived: !p.archived })
    toast.success(p.archived ? 'Project restored' : 'Project archived', p.name)
  }

  /** Copy the no-login share link for the public Gantt / task board page. */
  const copyPublicLink = (kind: 'gantt' | 'board', p: Project) => {
    const url = `${window.location.origin}/public/project-${kind}/${p.id}`
    const label = kind === 'gantt' ? 'Public Gantt Chart link' : 'Public Task Board link'
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(
          () => toast.success(`${label} copied`, url),
          () => toast.success(label, url),
        )
      } else toast.success(label, url)
    } catch { toast.success(label, url) }
  }

  const summaryCards: { key: string; label: string; color: string }[] = [
    { key: 'all', label: 'All Projects', color: '#0d6efd' },
    ...projectStatuses.map((st) => ({ key: st.id, label: st.name, color: st.color })),
    { key: 'overdue', label: 'Overdue', color: '#e40000' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span className="font-semibold text-inherit">Projects</span>
      </div>
      {/* One big card covering the whole page, like the Contracts menu. */}
      <div className="card">
        <div className="p-5 pb-4">
          <PageHeader title="Projects" desc="Track projects, milestones, budgets and delivery status." />

      {/* View tabs */}
      <div className="mb-4 flex gap-1 border-b border-line">
        <button
          onClick={() => setView('graphic')}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${view === 'graphic' ? 'bg-[#1f4e79] text-white' : 'border border-line bg-white text-slate-700'}`}
        >
          <LayoutGrid className="size-4" /> Project Graphic View
        </button>
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold ${view === 'list' ? 'bg-[#1f4e79] text-white' : 'border border-line bg-white text-slate-700'}`}
        >
          <ListIcon className="size-4" /> Project List View
        </button>
      </div>

      {/* Status summary cards */}
      <div className="mb-4 flex flex-wrap gap-2">
        {summaryCards.map((c) => (
          <button
            key={c.key}
            onClick={() => { setStatusFilter(c.key); setPage(1) }}
            className={`flex items-stretch overflow-hidden rounded-md text-white shadow-sm transition ${statusFilter === c.key ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
            style={{ backgroundColor: c.color }}
          >
            <span className="px-4 py-2.5 text-sm font-semibold">{c.label}</span>
            <span className="grid min-w-10 place-items-center bg-white px-2 font-bold text-slate-800 [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">
              {counts[c.key] ?? 0}
            </span>
          </button>
        ))}
        <button
          onClick={() => setEditing(blank())}
          className="flex items-center gap-2 rounded-md bg-[#1f3a5f] px-4 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          <Plus className="size-4" /> Add New Project
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Show:
          <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-20">
            <option value="10">10</option><option value="25">25</option><option value="50">50</option>
          </Select>
        </label>
        <div className="ml-auto flex items-center gap-2">
          <label className="mr-1 flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={showArchived} onChange={(e) => { setShowArchived(e.target.checked); setPage(1) }} className="size-4" />
            Show archived
          </label>
          <span className="text-sm text-slate-600">Filter:</span>
          <div className="relative">
            <Input
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setApplied(e.target.value); setPage(1) }}
              placeholder="type to filter..."
              className="w-56 pr-8 italic"
            />
            <Search className="absolute right-2 top-1/2 size-4 -translate-y-1/2 text-mist" />
          </div>
        </div>
      </div>

        </div>

      {view === 'list' ? (
        <div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
              <span><b>{selected.size}</b> project{selected.size === 1 ? '' : 's'} selected</span>
              <button type="button" className="btn" onClick={() => setSelected(new Set())}>Clear selection</button>
            </div>
          )}
          <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full min-w-[980px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                <th className="w-8 border-b border-zinc-200 px-2 py-3 dark:border-zinc-700">
                  <input
                    type="checkbox"
                    className="size-4 align-middle"
                    aria-label="Select all projects on this page"
                    disabled={!paged.length}
                    checked={paged.length > 0 && paged.every((pr) => selected.has(pr.id))}
                    ref={(el) => { if (el) el.indeterminate = paged.some((pr) => selected.has(pr.id)) && !paged.every((pr) => selected.has(pr.id)) }}
                    onChange={(e) => setSelected((cur) => {
                      const next = new Set(cur)
                      if (e.target.checked) paged.forEach((pr) => next.add(pr.id))
                      else paged.forEach((pr) => next.delete(pr.id))
                      return next
                    })}
                  />
                </th>
                <th className="w-8 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Project Name" k="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Client" k="client" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Duration</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Progress" k="progress" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Status" k="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Assigned To</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((p, i) => (
                <tr key={p.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                  <td className="px-2 py-2.5 align-top">
                    <input
                      type="checkbox"
                      className="size-4"
                      aria-label={`Select ${p.name}`}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                    />
                  </td>
                  <td className="px-2 py-2.5 align-top text-zinc-500 dark:text-zinc-400">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {p.pinned && <Pin className="mr-1 inline size-3.5 text-blue-600 dark:text-blue-400" aria-label="Pinned" />}
                      {p.name}
                    </div>
                    {p.archived && <span className="mt-1 inline-block rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">Archived</span>}
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
                      Priority:
                      <span className="rounded px-2 py-0.5 font-semibold" style={{ background: `${priorityDef(p.priority).color}22`, color: priorityDef(p.priority).color }}>{priorityDef(p.priority).name}</span>
                      {categoryDef(p.categoryId) && (
                        <span className="rounded px-2 py-0.5 font-semibold" style={{ background: `${categoryDef(p.categoryId)?.color}22`, color: categoryDef(p.categoryId)?.color }}>{categoryDef(p.categoryId)?.name}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="font-semibold text-zinc-800 dark:text-zinc-200">{p.clientName || '—'}</div>
                    <div className="text-[11px] text-zinc-500">{p.clientPhone}</div>
                  </td>
                  <td className="px-2 py-2.5 align-top text-[11px] text-zinc-600 dark:text-zinc-400">
                    <div>Start: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{p.startDate}</span></div>
                    <div>End: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{p.endDate || '—'}</span></div>
                    {isOverdue(p) && <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Overdue</span>}
                  </td>
                  <td className="px-2 py-2.5 align-top"><ProgressBar value={p.progress} /></td>
                  <td className="px-2 py-2.5 align-top">
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p, e.target.value as ProjectStatus)}
                      className="cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold"
                      style={{ color: statusDef(p.status).color, borderColor: statusDef(p.status).color, background: `${statusDef(p.status).color}14` }}
                    >
                      {projectStatuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2.5 align-top"><Assignees ids={p.assigneeIds} users={users} /></td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setMenuFor(menuFor === p.id ? null : p.id)}
                        className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        aria-label="Row actions"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {menuFor === p.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} aria-hidden="true" />
                          <div className="menu-pop absolute right-0 z-20 mt-1 w-52 rounded-xl p-1">
                            <button onClick={() => { setMenuFor(null); navigate(`/admin/projects/${p.id}`) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Eye className="size-3.5" /> View</button>
                            <button onClick={() => { setMenuFor(null); openEdit(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><SquarePen className="size-3.5" /> Edit</button>
                            <button onClick={() => { setMenuFor(null); duplicateProject(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Copy className="size-3.5" /> Duplicate</button>
                            <button onClick={() => { setMenuFor(null); setGanttFor(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><ChartGantt className="size-3.5" /> Gantt Chart</button>
                            <button onClick={() => { setMenuFor(null); copyPublicLink('gantt', p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Share2 className="size-3.5" /> Public Gantt Chart</button>
                            <button onClick={() => { setMenuFor(null); copyPublicLink('board', p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Share2 className="size-3.5" /> Public Task Board</button>
                            <button onClick={() => { setMenuFor(null); togglePin(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Pin className="size-3.5" /> Pin Project</button>
                            <button onClick={() => { setMenuFor(null); toggleArchive(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Archive className="size-3.5" /> Archive</button>
                            <button onClick={() => { setMenuFor(null); setDeleting(p) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600"><Trash2 className="size-3.5" /> Delete</button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!paged.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-zinc-500">No projects match. Use Add New Project to create one.</td></tr>
              )}
            </tbody>
          </table>
          </div>
          {/* Footer — sits after the horizontal scrollbar, like the All Sales table. */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
            <span>
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to{' '}
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</button>
              {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                const n = i + 1
                return (
                  <button
                    key={n}
                    type="button"
                    className="btn min-w-9"
                    aria-current={safePage === n ? 'page' : undefined}
                    style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </button>
                )
              })}
              <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>Next</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 p-5 pt-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="card hover-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: p.idColor || '#22c55e' }}
                    aria-hidden
                  >
                    {p.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <button onClick={() => openEdit(p)} className="flex max-w-full items-center gap-1.5 text-left" title={`Edit ${p.name}`}>
                      <h3 className="truncate font-bold text-blue-600 dark:text-blue-400">{p.name}</h3>
                    </button>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">{p.clientName}{p.clientPhone ? ` · ${p.clientPhone}` : ''}</p>
                  </div>
                </div>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${priorityDef(p.priority).color}22`, color: priorityDef(p.priority).color }}>{priorityDef(p.priority).name}</span>
              </div>
              <div className="mt-3"><ProgressBar value={p.progress} /></div>
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                <ClipboardList className="size-3.5" />
                {taskCountsByProject[p.id] || 0} task{(taskCountsByProject[p.id] || 0) === 1 ? '' : 's'} assigned
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{p.startDate} → {p.endDate || '—'}</span>
                <select
                  value={p.status}
                  onChange={(e) => changeStatus(p, e.target.value as ProjectStatus)}
                  aria-label={`Status of ${p.name}`}
                  className="cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                  style={{ color: statusDef(p.status).color, borderColor: statusDef(p.status).color, background: `${statusDef(p.status).color}14` }}
                >
                  {projectStatuses.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Assignees ids={p.assigneeIds} users={users} />
                <div className="flex gap-1">
                  <button onClick={() => navigate(`/admin/projects/${p.id}`)} className="grid size-7 place-items-center rounded border border-line text-blue-600 hover:bg-black/5 dark:text-blue-400" aria-label="View project" title="View project"><Eye className="size-3.5" /></button>
                  <button onClick={() => openEdit(p)} className="grid size-7 place-items-center rounded border border-line text-slate-600 hover:bg-black/5" aria-label="Edit"><Pencil className="size-3.5" /></button>
                  <button onClick={() => setDeleting(p)} className="grid size-7 place-items-center rounded border border-line text-rose-600 hover:bg-black/5" aria-label="Delete"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
          {!filtered.length && (
            <div className="card col-span-full p-10 text-center">
              <FolderKanban className="mx-auto size-10 text-mist" />
              <p className="mt-2 text-sm text-mist">No projects match the current filter.</p>
            </div>
          )}
        </div>
      )}
      </div>

      {/* Read-only view */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="View project" wide>
        {viewing && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${priorityDef(viewing.priority).color}22`, color: priorityDef(viewing.priority).color }}>{priorityDef(viewing.priority).name}</span>
              <span className="rounded px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${statusDef(viewing.status).color}22`, color: statusDef(viewing.status).color }}>{statusDef(viewing.status).name}</span>
              {viewing.pinned && <span className="flex items-center gap-1 text-xs text-blue-600"><Pin className="size-3.5" /> Pinned</span>}
              {viewing.archived && <span className="rounded bg-zinc-200 px-2 py-0.5 text-[11px] font-bold text-zinc-600">Archived</span>}
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <p><span className="font-bold">Project:</span> {viewing.name}</p>
              <p><span className="font-bold">Client:</span> {viewing.clientName || '—'}{viewing.clientPhone ? ` (${viewing.clientPhone})` : ''}</p>
              <p><span className="font-bold">Manager:</span> {users.find((u) => u.id === viewing.managerId)?.name || '—'}</p>
              <p><span className="font-bold">Type:</span> {viewing.projectType || '—'}</p>
              <p><span className="font-bold">Category:</span> {categoryDef(viewing.categoryId)?.name || '—'}</p>
              <p><span className="font-bold">Estimated value:</span> {viewing.estimatedValue ? Number(viewing.estimatedValue).toLocaleString() : '0'}</p>
              <p><span className="font-bold">Dates:</span> {viewing.startDate} → {viewing.endDate || '—'}</p>
              <p><span className="font-bold">Assigned to:</span> {viewing.assigneeIds.length ? viewing.assigneeIds.map((id) => users.find((u) => u.id === id)?.name || id).join(', ') : '—'}</p>
              <p><span className="font-bold">Progress:</span> {viewing.progress}%</p>
            </div>
            <ProgressBar value={viewing.progress} />
            {viewing.description && <p className="text-slate-600 dark:text-zinc-400">{viewing.description}</p>}
            {!!viewing.attachments?.length && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500"><Paperclip className="size-3.5" /> {viewing.attachments.map((a) => a.name).join(', ')}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setGanttFor(viewing); setViewing(null) }}><ChartGantt className="size-4" /> Gantt Chart</Button>
              <Button onClick={() => { openEdit(viewing); setViewing(null) }}><Pencil className="size-4" /> Edit</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Gantt chart */}
      <Modal open={!!ganttFor} onClose={() => setGanttFor(null)} title={ganttFor ? `Gantt Chart — ${ganttFor.name}` : 'Gantt Chart'} xl>
        {ganttFor && <GanttView project={ganttFor} tasks={tasks} />}
      </Modal>

      {/* Add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Project' : 'Add New Project'} wide>
        {editing && (() => {
          const activeTypes = projectTypes.filter((t) => t.status === 'ACTIVE')
          const typeName = projectTypes.find((t) => t.id === editing.projectTypeId)?.name || ''
          const stageRows = workStages.filter((w) => w.projectType === typeName)
          const setFlag = (stageId: string, flag: keyof StageFlags, on: boolean) =>
            setEditing({ ...editing, stageStates: { ...editing.stageStates, [stageId]: { ...(editing.stageStates[stageId] || noFlags()), [flag]: on } } })
          const toggleAll = (flag: keyof StageFlags) => {
            const all = stageRows.every((w) => editing.stageStates[w.id]?.[flag])
            const next = { ...editing.stageStates }
            stageRows.forEach((w) => { next[w.id] = { ...(next[w.id] || noFlags()), [flag]: !all } })
            setEditing({ ...editing, stageStates: next })
          }
          return (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Project Type" required>
                <Select value={editing.projectTypeId} onChange={(e) => setEditing({ ...editing, projectTypeId: e.target.value })}>
                  <option value="">{typeName || 'Please Select...'}</option>
                  {activeTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Project Manager" required>
                <Select value={editing.managerId} onChange={(e) => setEditing({ ...editing, managerId: e.target.value })}>
                  <option value="">Please Select...</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <Field label="Client" required>
                <Select value={editing.clientId} onChange={(e) => setEditing({ ...editing, clientId: e.target.value })}>
                  <option value="">Please Select...</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Field label="Project" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Estimated Value" required><Input type="number" min="0" value={editing.estimatedValue} onChange={(e) => setEditing({ ...editing, estimatedValue: e.target.value })} /></Field>
              <Field label="Project Account" required>
                <Select value={editing.projectAccount} onChange={(e) => setEditing({ ...editing, projectAccount: e.target.value })}>
                  <option value="INITIAL">INITIAL</option><option value="CAPEX">CAPEX</option><option value="OPEX">OPEX</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              <Field label="Location" required>
                <Select value={editing.locationId} onChange={(e) => setEditing({ ...editing, locationId: e.target.value })}>
                  <option value="">Please Select...</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Project ID Color" required>
                <div className="flex items-center gap-2 rounded-md border border-line bg-white px-2 py-1.5 dark:bg-zinc-900">
                  <input type="color" value={editing.idColor} onChange={(e) => setEditing({ ...editing, idColor: e.target.value })} className="size-7 cursor-pointer border-0 bg-transparent p-0" aria-label="Project ID color" />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">{editing.idColor}</span>
                </div>
              </Field>
              <Field label="Start Date" required><DatePicker value={editing.startDate} onChange={(v) => setEditing({ ...editing, startDate: v })} /></Field>
              <Field label="Due Date" required><DatePicker value={editing.endDate} onChange={(v) => setEditing({ ...editing, endDate: v })} /></Field>
              <Field label="Priority" required>
                <Select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as ProjectPriority })}>
                  {projectPriorities.map((pr) => <option key={pr.id} value={pr.id}>{pr.name.toUpperCase()}</option>)}
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <Field label="Team Members / Assign To" required>
                <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-md border border-line bg-white px-2 py-2 dark:bg-zinc-900">
                  {editing.assigneeIds.map((id) => {
                    const u = users.find((x) => x.id === id)
                    if (!u) return null
                    return (
                      <span key={id} className="flex items-center gap-2 rounded-md bg-[#1f3a5f] px-2 py-1 text-xs font-semibold text-white">
                        <button onClick={() => setEditing({ ...editing, assigneeIds: editing.assigneeIds.filter((x) => x !== id) })} aria-label={`Remove ${u.name}`} className="opacity-80 hover:opacity-100"><X className="size-3" /></button>
                        {u.avatar ? <img src={u.avatar} alt={u.name} className="size-5 rounded-full object-cover" /> : <span className="grid size-5 place-items-center rounded-full bg-white/20 text-[9px] font-bold">{u.name.split(' ').map((q) => q[0]).slice(0, 2).join('')}</span>}
                        {u.name}
                      </span>
                    )
                  })}
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value && !editing.assigneeIds.includes(e.target.value)) setEditing({ ...editing, assigneeIds: [...editing.assigneeIds, e.target.value] }) }}
                    className="min-w-32 flex-1 border-0 bg-transparent text-sm text-mist focus:outline-none"
                    aria-label="Add team member"
                  >
                    <option value="">+ Add member...</option>
                    {users.filter((u) => !editing.assigneeIds.includes(u.id)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </Field>
              <Field label="Status" required>
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProjectStatus })}>
                  {projectStatuses.map((st) => <option key={st.id} value={st.id}>{st.name.toUpperCase()}</option>)}
                </Select>
              </Field>
              <Field label="Category">
                <Select value={editing.categoryId} onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}>
                  <option value="">— NONE —</option>
                  {projectCategories.map((c) => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} /></Field>

            {/* Progress Stage */}
            <div>
              <div className="mb-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Progress Stage</div>
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full min-w-[640px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
                  <thead>
                    <tr className="bg-[#aebcd0]/60 dark:bg-zinc-800">
                      <th className="w-12 border-b border-zinc-300 px-2 py-2 text-left font-bold dark:border-zinc-700">No.</th>
                      <th className="border-b border-zinc-300 px-2 py-2 text-left font-bold dark:border-zinc-700">Work Stage</th>
                      <th className="w-32 border-b border-zinc-300 px-2 py-2 text-left font-bold dark:border-zinc-700"><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={stageRows.length > 0 && stageRows.every((w) => editing.stageStates[w.id]?.ongoing)} onChange={() => toggleAll('ongoing')} /> Ongoing</label></th>
                      <th className="w-32 border-b border-zinc-300 px-2 py-2 text-left font-bold dark:border-zinc-700"><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={stageRows.length > 0 && stageRows.every((w) => editing.stageStates[w.id]?.completed)} onChange={() => toggleAll('completed')} /> Completed</label></th>
                      <th className="w-32 border-b border-zinc-300 px-2 py-2 text-left font-bold dark:border-zinc-700"><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={stageRows.length > 0 && stageRows.every((w) => editing.stageStates[w.id]?.outstanding)} onChange={() => toggleAll('outstanding')} /> Outstanding</label></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageRows.map((w, i) => (
                      <tr key={w.id} className={i % 2 ? 'bg-white dark:bg-zinc-900' : 'bg-[#dfe3ea]/60 dark:bg-zinc-800/60'}>
                        <td className="px-2 py-2 text-zinc-600 dark:text-zinc-400">{i + 1}</td>
                        <td className="px-2 py-2">{w.name}</td>
                        <td className="px-2 py-2"><input type="checkbox" className="size-4" checked={!!editing.stageStates[w.id]?.ongoing} onChange={(e) => setFlag(w.id, 'ongoing', e.target.checked)} /></td>
                        <td className="px-2 py-2"><input type="checkbox" className="size-4" checked={!!editing.stageStates[w.id]?.completed} onChange={(e) => setFlag(w.id, 'completed', e.target.checked)} /></td>
                        <td className="px-2 py-2"><input type="checkbox" className="size-4" checked={!!editing.stageStates[w.id]?.outstanding} onChange={(e) => setFlag(w.id, 'outstanding', e.target.checked)} /></td>
                      </tr>
                    ))}
                    {!stageRows.length && (
                      <tr><td colSpan={5} className="px-4 py-4 text-center text-zinc-500">Select a project type to load its work stages.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Attachments */}
            <div className="border-t border-line pt-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                <Paperclip className="size-4" /> New Attachment ...
                <input
                  type="file" multiple className="ml-2 text-xs text-zinc-500 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-[#1f4e79] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: f.size }))
                    if (files.length) setEditing({ ...editing, attachments: [...editing.attachments, ...files] })
                    e.target.value = ''
                  }}
                />
              </label>
              {editing.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editing.attachments.map((a, i) => (
                    <span key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-md border border-line px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300">
                      <Paperclip className="size-3" /> {a.name}
                      <button onClick={() => setEditing({ ...editing, attachments: editing.attachments.filter((_, j) => j !== i) })} aria-label={`Remove ${a.name}`} className="text-rose-500"><X className="size-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={save} className="w-72 bg-[#1f4e79]"><SaveIcon className="size-4" /> Save</Button>
            </div>
          </div>
          )
        })()}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete project">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteProject(deleting.id); toast.success('Project deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
