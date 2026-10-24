import { useMemo, useState } from 'react'
import {
  List as ListIcon, Plus, Printer, Search, MoreVertical, Pencil, Trash2,
  ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react'
import { Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { uid, formatGhsExact } from '../../../lib/utils'
import { CONTRACT_STATUSES, contractStatusMeta, isContractOverdue, contractCounts } from '../../../lib/contracts'
import type { ProjectContract, ContractStatus } from '../../../types'

type SortKey = 'client' | 'project' | 'value'

interface Form {
  id?: string
  subject: string
  clientName: string
  projectId: string
  value: string
  startDate: string
  endDate: string
  status: ContractStatus
  description: string
}

const blank = (): Form => ({
  subject: '', clientName: '', projectId: '', value: '0',
  startDate: new Date().toISOString().slice(0, 10), endDate: '', status: 'open', description: '',
})

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

export function Contracts() {
  const app = useApp()
  const toast = useToast()
  const { contracts, upsertContract, deleteContract, projects } = app

  const [clientFilter, setClientFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusSelect, setStatusSelect] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState<SortKey>('client')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<ProjectContract | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const clientOptions = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => p.clientName && set.add(p.clientName))
    contracts.forEach((c) => c.clientName && set.add(c.clientName))
    return Array.from(set).sort()
  }, [projects, contracts])

  const counts = useMemo(() => {
    let list = contracts
    if (clientFilter) list = list.filter((c) => c.clientName === clientFilter)
    if (projectFilter) list = list.filter((c) => c.projectId === projectFilter)
    return contractCounts(list)
  }, [contracts, clientFilter, projectFilter])

  const filtered = useMemo(() => {
    const q = applied.trim().toLowerCase()
    let list = [...contracts]
    if (clientFilter) list = list.filter((c) => c.clientName === clientFilter)
    if (projectFilter) list = list.filter((c) => c.projectId === projectFilter)
    if (statusSelect) list = list.filter((c) => c.status === statusSelect)
    if (statusFilter === 'overdue') list = list.filter((c) => isContractOverdue(c))
    else if (statusFilter) list = list.filter((c) => c.status === statusFilter)
    if (q) list = list.filter((c) => `${c.subject} ${c.clientName} ${c.projectName}`.toLowerCase().includes(q))
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'value') return (a.value - b.value) * dir
      if (sortBy === 'project') return a.projectName.localeCompare(b.projectName) * dir
      return a.clientName.localeCompare(b.clientName) * dir
    })
    return list
  }, [contracts, clientFilter, projectFilter, statusSelect, statusFilter, applied, sortBy, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const onSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(k); setSortDir('asc') }
  }

  const openEdit = (c: ProjectContract) => setEditing({
    id: c.id, subject: c.subject, clientName: c.clientName, projectId: c.projectId || '',
    value: String(c.value), startDate: c.startDate, endDate: c.endDate, status: c.status, description: c.description || '',
  })

  const save = () => {
    if (!editing) return
    if (!editing.subject.trim()) { toast.error('Enter the contract subject.'); return }
    const project = projects.find((p) => p.id === editing.projectId)
    const isNew = !editing.id
    upsertContract({
      id: editing.id || uid('ct'),
      subject: editing.subject.trim(),
      clientName: editing.clientName.trim() || project?.clientName || '',
      projectId: editing.projectId || undefined,
      projectName: project?.name || '',
      value: Math.max(0, Number(editing.value) || 0),
      startDate: editing.startDate,
      endDate: editing.endDate,
      status: editing.status,
      description: editing.description.trim() || undefined,
    })
    toast.success(isNew ? 'Contract created' : 'Contract updated')
    setEditing(null)
  }

  const exportRows = filtered.map((c) => ({
    Subject: c.subject, Client: c.clientName, Project: c.projectName,
    Value: c.value, Start_Date: c.startDate, End_Date: c.endDate, Status: contractStatusMeta(c.status).label,
  }))

  const summaryCards = [
    ...CONTRACT_STATUSES.map((s) => ({ key: s.id, label: s.label, color: s.card })),
    { key: 'overdue', label: 'Overdue', color: '#e40000' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Project Management</span><span>/</span><span className="font-semibold text-inherit">Contracts</span>
      </div>

      <div className="card">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ListIcon className="size-5" /> Contract List</h2>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEditing(blank())} className="rounded-full"><Plus className="size-4" /> Add</Button>
            <button onClick={() => window.print()} className="grid size-9 place-items-center rounded-full bg-slate-800 text-white" title="Print" aria-label="Print"><Printer className="size-4" /></button>
            <ExportButtons filename="contracts" rows={exportRows} compact />
          </div>
        </div>

        {/* Filter row */}
        <div className="grid gap-3 px-5 py-4 lg:grid-cols-[1fr_1fr_auto_auto]">
          <FilterSelect label="Client" value={clientFilter} onChange={(v) => { setClientFilter(v); setPage(1) }}
            options={clientOptions.map((c) => ({ value: c, label: c }))} placeholder="All clients" />
          <FilterSelect label="Project" value={projectFilter} onChange={(v) => { setProjectFilter(v); setPage(1) }}
            options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="All projects" />
          <Select value={statusSelect} onChange={(e) => { setStatusSelect(e.target.value); setPage(1) }} className="w-40">
            <option value="">All statuses</option>
            {CONTRACT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
          <Button variant="outline" onClick={() => { setApplied(search); setPage(1) }} className="border-sky-300 text-sky-600">
            <Search className="size-4" /> Search
          </Button>
        </div>

        {/* Status summary cards */}
        <div className="flex flex-wrap gap-2 px-5 pb-4">
          {summaryCards.map((c) => (
            <button
              key={c.key}
              onClick={() => { setStatusFilter(statusFilter === c.key ? '' : c.key); setPage(1) }}
              className={`flex items-stretch overflow-hidden rounded-md text-white shadow-sm ${statusFilter === c.key ? 'ring-2 ring-slate-400 ring-offset-1' : ''}`}
              style={{ backgroundColor: c.color }}
            >
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

        {/* Table — formatted like the All Sales table */}
        <div className="overflow-x-auto px-5 pt-3">
          <table className="w-full min-w-[900px] border-collapse text-[12px] text-zinc-800 dark:text-zinc-200">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-800/80">
                <th className="w-8 border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">#</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Action</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Subject</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Client" k="client" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Project" k="project" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700"><SortHeader label="Value" k="value" sortBy={sortBy} sortDir={sortDir} onSort={onSort} /></th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Start_Date</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">End_Date</th>
                <th className="border-b border-zinc-200 px-2 py-3 text-left font-bold dark:border-zinc-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr key={c.id} className="border-b border-zinc-100 hover:bg-sky-50/40 dark:border-zinc-800 dark:hover:bg-white/[0.03]">
                  <td className="px-2 py-2.5 align-top text-zinc-500">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="px-2 py-2.5 align-top">
                    <div className="relative inline-block">
                      <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} className="grid size-8 place-items-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="Row actions"><MoreVertical className="size-4" /></button>
                      {menuFor === c.id && (
                        <div className="menu-pop absolute left-0 z-20 mt-1 w-32 rounded-xl p-1">
                          <button onClick={() => { setMenuFor(null); openEdit(c) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm"><Pencil className="size-3.5" /> Edit</button>
                          <button onClick={() => { setMenuFor(null); setDeleting(c) }} className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-rose-600"><Trash2 className="size-3.5" /> Delete</button>
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
                    <select value={c.status} onChange={(e) => { upsertContract({ ...c, status: e.target.value as ContractStatus }); toast.success('Status updated') }}
                      className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] font-semibold ${contractStatusMeta(c.status).badge}`}>
                      {CONTRACT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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

        {/* Footer — same format as All Sales */}
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
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Contract' : 'Add Contract'} wide>
        {editing && (
          <div className="space-y-4">
            <Field label="Subject" required><Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client">
                <Select value={editing.clientName} onChange={(e) => setEditing({ ...editing, clientName: e.target.value })}>
                  <option value="">Select client…</option>
                  {clientOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Project">
                <Select value={editing.projectId} onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}>
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Value"><Input type="number" min={0} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} /></Field>
              <Field label="Start date"><DatePicker value={editing.startDate} onChange={(v) => setEditing({ ...editing, startDate: v })} /></Field>
              <Field label="End date"><DatePicker value={editing.endDate} onChange={(v) => setEditing({ ...editing, endDate: v })} /></Field>
            </div>
            <Field label="Status">
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ContractStatus })}>
                {CONTRACT_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
            <Field label="Description"><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save changes' : 'Create contract'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete contract">
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Delete <span className="font-semibold">{deleting.subject}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { deleteContract(deleting.id); toast.success('Contract deleted'); setDeleting(null) }}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-line">
      <span className="grid place-items-center bg-[#1f4e79] px-3 text-sm font-semibold text-white">{label}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full flex-1 rounded-none border-0">
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  )
}
