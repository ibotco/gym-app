import { useEffect, useMemo, useState } from 'react'
import {
  List as ListIcon, Plus, Printer, Search, MoreVertical, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import { Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import { TASK_STATUSES, TASK_PRIORITY_META, taskStatusMeta, isTaskOverdue, taskCounts } from '../../../lib/tasks'
import type { ProjectTask, TaskStatus, ProjectPriority } from '../../../types'

type SortKey = 'task' | 'start' | 'due'

interface Person { id: string; name: string; avatar?: string }

const initials = (n: string) => n.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()

function AvatarCircle({ person, size = 'size-9' }: { person?: Person; size?: string }) {
  if (!person) return <span className="text-xs text-mist">—</span>
  return (
    <span className={`block ${size} overflow-hidden rounded-full border-2 border-white shadow-sm`} title={person.name}>
      {person.avatar
        ? <img src={person.avatar} alt={person.name} className={`${size} rounded-full object-cover`} />
        : <span className={`grid ${size} place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-white`}>{initials(person.name)}</span>}
    </span>
  )
}

function Collaborators({ ids, users }: { ids: string[]; users: Person[] }) {
  const people = ids.map((id) => users.find((u) => u.id === id)).filter(Boolean) as Person[]
  const shown = people.slice(0, 3)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i ? -10 : 0, zIndex: 10 - i }}>
          <AvatarCircle person={p} size="size-8" />
        </span>
      ))}
      {extra > 0 && (
        <span className="grid size-8 place-items-center rounded-full border-2 border-white bg-[#1f3a5f] text-[10px] font-bold text-white" style={{ marginLeft: -10 }}>+{extra}</span>
      )}
      {people.length === 0 && <span className="text-xs text-mist">—</span>}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value))
  const stripe = 'repeating-linear-gradient(45deg, #9333ea 0 8px, #a855f7 8px 16px)'
  return (
    <div className="relative h-4 w-32 overflow-hidden rounded-full bg-slate-200/70">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundImage: stripe }} />
      <span className="absolute top-0 flex h-4 -translate-x-1/2 items-center rounded-full bg-white/90 px-1.5 text-[10px] font-bold text-slate-800 shadow" style={{ left: `${Math.max(pct, 14)}%` }}>{pct} %</span>
    </div>
  )
}

function SortHeader({ label, k, sortBy, sortDir, onSort }: {
  label: string; k: SortKey; sortBy: SortKey; sortDir: 'asc' | 'desc'; onSort: (k: SortKey) => void
}) {
  const active = sortBy === k
  return (
    <button onClick={() => onSort(k)} className="flex items-center gap-1 font-bold">
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />) : <ChevronsUpDown className="size-3.5 opacity-50" />}
    </button>
  )
}

interface Form {
  id?: string
  name: string
  priority: ProjectPriority
  projectId: string
  startDate: string
  dueDate: string
  assigneeId: string
  collaboratorIds: string[]
  status: TaskStatus
  progress: string
  description: string
}

const blank = (): Form => ({
  name: '', priority: 'medium', projectId: '', startDate: new Date().toISOString().slice(0, 10),
  dueDate: '', assigneeId: '', collaboratorIds: [], status: 'to_do', progress: '0', description: '',
})

export function TasksAssign() {
  const app = useApp()
  const toast = useToast()
  const { tasks, upsertTask, deleteTask, projects, users } = app

  const [projectFilter, setProjectFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [statusSelect, setStatusSelect] = useState('')
  const [prioritySelect, setPrioritySelect] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('task')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<ProjectTask | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const counts = useMemo(() => {
    let list = tasks
    if (projectFilter) list = list.filter((t) => t.projectId === projectFilter)
    if (userFilter) list = list.filter((t) => t.assigneeId === userFilter || t.collaboratorIds.includes(userFilter))
    return taskCounts(list)
  }, [tasks, projectFilter, userFilter])

  // Users associated with the selected project (assignees + collaborators on its
  // tasks). With no project chosen, every user is offered.
  const userOptions = useMemo(() => {
    if (!projectFilter) return users
    const related = new Set<string>()
    for (const t of tasks) {
      if (t.projectId !== projectFilter) continue
      if (t.assigneeId) related.add(t.assigneeId)
      t.collaboratorIds.forEach((id) => related.add(id))
    }
    return users.filter((u) => related.has(u.id))
  }, [users, tasks, projectFilter])

  // Drop a user selection that no longer belongs to the chosen project.
  useEffect(() => {
    if (userFilter && !userOptions.some((u) => u.id === userFilter)) setUserFilter('')
  }, [userOptions, userFilter])

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    let list = [...tasks]
    if (projectFilter) list = list.filter((t) => t.projectId === projectFilter)
    if (userFilter) list = list.filter((t) => t.assigneeId === userFilter || t.collaboratorIds.includes(userFilter))
    if (statusSelect) list = list.filter((t) => t.status === statusSelect)
    if (prioritySelect) list = list.filter((t) => t.priority === prioritySelect)
    if (statusFilter === 'overdue') list = list.filter((t) => isTaskOverdue(t))
    else if (statusFilter) list = list.filter((t) => t.status === statusFilter)
    if (q) list = list.filter((t) => `${t.name} ${t.projectName}`.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'start') return a.startDate.localeCompare(b.startDate) * dir
      if (sortBy === 'due') return a.dueDate.localeCompare(b.dueDate) * dir
      return a.name.localeCompare(b.name) * dir
    })
    return list
  }, [tasks, projectFilter, userFilter, statusSelect, prioritySelect, statusFilter, applied, sortBy, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(k); setSortDir('asc') }
  }

  const openEdit = (t: ProjectTask) => setEditing({
    id: t.id, name: t.name, priority: t.priority, projectId: t.projectId || '', startDate: t.startDate,
    dueDate: t.dueDate, assigneeId: t.assigneeId || '', collaboratorIds: [...t.collaboratorIds],
    status: t.status, progress: String(t.progress), description: t.description || '',
  })

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter the task name.'); return }
    const project = projects.find((p) => p.id === editing.projectId)
    const isNew = !editing.id
    upsertTask({
      id: editing.id || uid('tk'),
      name: editing.name.trim(),
      priority: editing.priority,
      projectId: editing.projectId || undefined,
      projectName: project?.name || '',
      startDate: editing.startDate,
      dueDate: editing.dueDate,
      assigneeId: editing.assigneeId || undefined,
      collaboratorIds: editing.collaboratorIds,
      status: editing.status,
      progress: Math.max(0, Math.min(100, Number(editing.progress) || 0)),
      description: editing.description.trim() || undefined,
    })
    toast.success(isNew ? 'Task created' : 'Task updated')
    setEditing(null)
  }

  const exportRows = filtered.map((t) => ({
    Task: t.name, Project: t.projectName, Start_Date: t.startDate, Due_Date: t.dueDate,
    Status: taskStatusMeta(t.status).label, Progress: t.progress,
  }))

  const summaryCards = [
    ...TASK_STATUSES.map((s) => ({ key: s.id, label: s.id === 'completed' ? 'Completed' : s.label, color: s.card })),
    { key: 'overdue', label: 'Overdue', color: '#e40000' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span className="font-semibold text-inherit">Tasks Assign</span>
      </div>

      <div className="card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ListIcon className="size-5" /> Tasks Assign List</h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEditing(blank())} className="rounded-full"><Plus className="size-4" /> Add</Button>
            <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white" title="Print" aria-label="Print"><Printer className="size-4" /></button>
            <ExportButtons filename="tasks" rows={exportRows} compact />
          </div>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-stretch gap-3 px-5 py-4">
          <FilterSelect label="Project" className="min-w-[220px] flex-1" value={projectFilter} onChange={(v) => { setProjectFilter(v); setPage(1) }}
            options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" />
          <FilterSelect label="User" className="min-w-[220px] flex-1" value={userFilter} onChange={(v) => { setUserFilter(v); setPage(1) }}
            options={userOptions.map((u) => ({ value: u.id, label: u.name }))} placeholder="All Users" />
          <Select value={statusSelect} onChange={(e) => { setStatusSelect(e.target.value); setPage(1) }} className="w-40">
            <option value="">All Status</option>
            {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.id === 'completed' ? 'Completed' : s.label}</option>)}
          </Select>
          <Select value={prioritySelect} onChange={(e) => { setPrioritySelect(e.target.value); setPage(1) }} className="w-40">
            <option value="">All Priority</option>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </Select>
          <Button variant="outline" onClick={() => { setApplied(search); setPage(1) }} className="shrink-0 border-sky-300 text-sky-600"><Search className="size-4" /></Button>
        </div>

        {/* Status summary cards */}
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {summaryCards.map((c) => (
            <button key={c.key} onClick={() => { setStatusFilter(statusFilter === c.key ? '' : c.key); setPage(1) }}
              className={`flex items-stretch overflow-hidden rounded-md text-white shadow-sm ${statusFilter === c.key ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
              style={{ backgroundColor: c.color }}>
              <span className="px-4 py-2.5 text-sm font-semibold">{c.label}</span>
              <span className="grid min-w-10 place-items-center bg-white px-2 font-bold text-slate-800 [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]">{counts[c.key] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Show
            <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="w-20">
              <option value="10">10</option><option value="25">25</option><option value="50">50</option>
            </Select>
            entries
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Search:</span>
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setApplied(e.target.value); setPage(1) }} className="w-48" />
          </div>
        </div>

        {/* Table — All Sales format */}
        <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full min-w-[960px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                <th className="w-8 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Task" k="task" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Start Date" k="start" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Due Date" k="due" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Assigned To</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Collaborators</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status / Progress</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((t, i) => (
                <tr key={t.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                  <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{t.name}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500">
                      Priority:
                      <span className={`rounded px-2 py-0.5 font-semibold ${TASK_PRIORITY_META[t.priority].badge}`}>{TASK_PRIORITY_META[t.priority].label}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 align-top">{t.startDate}</td>
                  <td className="px-2 py-2.5 align-top">
                    {t.dueDate}
                    {isTaskOverdue(t) && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">Overdue</span>}
                  </td>
                  <td className="px-2 py-2.5 align-top"><AvatarCircle person={users.find((u) => u.id === t.assigneeId)} /></td>
                  <td className="px-2 py-2.5 align-top"><Collaborators ids={t.collaboratorIds} users={users} /></td>
                  <td className="px-2 py-2.5 align-top">
                    <select value={t.status} onChange={(e) => { upsertTask({ ...t, status: e.target.value as TaskStatus }); toast.success('Status updated') }}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold ${taskStatusMeta(t.status).badge}`}>
                      {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                    <div className="mt-1.5"><ProgressBar value={t.progress} /></div>
                  </td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="flex items-center gap-1">
                      <div className="relative inline-block">
                        <button onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions"><MoreVertical className="size-4" /></button>
                        {menuFor === t.id && (
                          <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                            <button onClick={() => { setMenuFor(null); openEdit(t) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm">Edit</button>
                          </div>
                        )}
                      </div>
                      <button onClick={() => setDeleting(t)} className="grid size-8 place-items-center rounded border border-rose-200 text-rose-600 hover:bg-rose-50" aria-label="Delete"><Trash2 className="size-4" /></button>
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

        {/* Footer — same format as All Sales */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm text-zinc-700 dark:text-zinc-300">
          <span>
            Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to{' '}
            {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button type="button" className="btn" disabled={safePage <= 1} onClick={() => setPage((v) => Math.max(1, v - 1))}>Previous</button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, idx) => {
              const n = idx + 1
              return (
                <button key={n} type="button" className="btn min-w-9" aria-current={safePage === n ? 'page' : undefined}
                  style={safePage === n ? { background: '#337ab7', color: '#fff', borderColor: '#337ab7' } : undefined}
                  onClick={() => setPage(n)}>{n}</button>
              )
            })}
            <button type="button" className="btn" disabled={safePage >= pageCount} onClick={() => setPage((v) => Math.min(pageCount, v + 1))}>Next</button>
          </div>
        </div>
      </div>

      {/* Add / edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Task' : 'Add Task'} wide>
        {editing && (
          <div className="space-y-4">
            <Field label="Task name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project">
                <Select value={editing.projectId} onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}>
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as ProjectPriority })}>
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Start date"><DatePicker value={editing.startDate} onChange={(v) => setEditing({ ...editing, startDate: v })} /></Field>
              <Field label="Due date"><DatePicker value={editing.dueDate} onChange={(v) => setEditing({ ...editing, dueDate: v })} /></Field>
              <Field label="Progress %"><Input type="number" min={0} max={100} value={editing.progress} onChange={(e) => setEditing({ ...editing, progress: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Assigned to">
                <Select value={editing.assigneeId} onChange={(e) => setEditing({ ...editing, assigneeId: e.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as TaskStatus })}>
                  {TASK_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Collaborators">
              <div className="flex flex-wrap gap-2">
                {users.slice(0, 12).map((u) => {
                  const on = editing.collaboratorIds.includes(u.id)
                  return (
                    <button key={u.id} onClick={() => setEditing({ ...editing, collaboratorIds: on ? editing.collaboratorIds.filter((x) => x !== u.id) : [...editing.collaboratorIds, u.id] })}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? 'border-lime/50 bg-lime/15 text-lime' : 'border-line text-mist hover:text-slate-800'}`}>
                      {u.name}
                    </button>
                  )
                })}
              </div>
            </Field>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save changes' : 'Create task'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete task">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteTask(deleting.id); toast.success('Task deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder, className }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string; className?: string
}) {
  return (
    <div className={`flex items-stretch overflow-hidden rounded-md border border-line ${className || ''}`}>
      <span className="grid place-items-center bg-[#1f4e79] px-3 text-sm font-semibold text-white">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full flex-1 rounded-none border-0">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  )
}
