import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, List, LayoutGrid, Eye, SquarePen, Trash2, CalendarDays, Wrench,
  CheckCircle2, XCircle, ArrowUpDown, ChevronLeft, ChevronRight, X, Filter, Tag, Layers,
} from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, uid } from '../../../lib/utils'
import type { Asset } from '../../../types'

type MaintStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
type MaintType = 'Preventive' | 'Corrective' | 'Emergency'
type MaintPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export type MaintRec = {
  id: string
  title: string
  type: MaintType
  assetId: string
  scheduledDate: string // YYYY-MM-DD
  status: MaintStatus
  priority: MaintPriority
  cost: number
  technician?: string
  nextDate?: string
  notes?: string
}

const KEY = 'fitpro_asset_maintenance_v1'
const iso = (d: Date) => d.toISOString().slice(0, 10)
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }

const STATUSES: { id: MaintStatus; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]
const TYPES: MaintType[] = ['Preventive', 'Corrective', 'Emergency']
const PRIORITIES: MaintPriority[] = ['Low', 'Medium', 'High', 'Critical']

const statusTone = (s: MaintStatus): 'sky' | 'amber' | 'lime' | 'zinc' =>
  s === 'scheduled' ? 'sky' : s === 'in_progress' ? 'amber' : s === 'completed' ? 'lime' : 'zinc'
const typeTone = (t: MaintType): 'rose' | 'orange' | 'amber' =>
  t === 'Corrective' ? 'rose' : t === 'Emergency' ? 'amber' : 'orange'
const priorityTone = (p: MaintPriority): 'lime' | 'sky' | 'orange' | 'rose' =>
  p === 'Low' ? 'lime' : p === 'Medium' ? 'sky' : p === 'High' ? 'orange' : 'rose'

function seed(): MaintRec[] {
  return [
    { id: 'mnt_1', title: 'Cooling Fan Replacement', type: 'Corrective', assetId: 'ast_5', scheduledDate: daysFromNow(10), status: 'scheduled', priority: 'Medium', cost: 95, technician: 'Kofi Mensah' },
    { id: 'mnt_2', title: 'Quarterly System Check', type: 'Preventive', assetId: 'ast_6', scheduledDate: daysFromNow(27), status: 'scheduled', priority: 'Medium', cost: 150, technician: 'Efua Hammond' },
    { id: 'mnt_3', title: 'Screen Replacement', type: 'Corrective', assetId: 'ast_1', scheduledDate: daysFromNow(-8), status: 'completed', priority: 'High', cost: 350, technician: 'Yaw Darko' },
    { id: 'mnt_4', title: 'Annual Service', type: 'Preventive', assetId: 'ast_3', scheduledDate: daysFromNow(43), status: 'scheduled', priority: 'Low', cost: 500, technician: 'Kofi Mensah' },
    { id: 'mnt_5', title: 'System Crash Recovery', type: 'Emergency', assetId: 'ast_6', scheduledDate: daysFromNow(-18), status: 'completed', priority: 'Critical', cost: 800, technician: 'Efua Hammond' },
    { id: 'mnt_6', title: 'Battery Replacement', type: 'Preventive', assetId: 'ast_2', scheduledDate: daysFromNow(-3), status: 'in_progress', priority: 'Medium', cost: 120, technician: 'Abena Sarpong' },
    { id: 'mnt_7', title: 'Network Port Repair', type: 'Corrective', assetId: 'ast_6', scheduledDate: daysFromNow(-13), status: 'completed', priority: 'Medium', cost: 75, technician: 'Yaw Darko' },
    { id: 'mnt_8', title: 'Software Updates', type: 'Preventive', assetId: 'ast_6', scheduledDate: daysFromNow(22), status: 'scheduled', priority: 'High', cost: 0, technician: 'Efua Hammond' },
  ]
}

export function loadMaintenance(): MaintRec[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as MaintRec[]
    }
  } catch { /* fall through to seed */ }
  return seed()
}

const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

function AssetTile({ asset }: { asset?: Asset }) {
  const hue = hueOf(asset?.category || '?')
  return (
    <span
      className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-line text-sm font-bold"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 55% 74%))`, color: `hsl(${hue} 50% 25%)` }}
      title={asset?.category}
    >
      {asset ? asset.name.slice(0, 1).toUpperCase() : '?'}
    </span>
  )
}

type FormState = { id?: string; title: string; type: MaintType; assetId: string; scheduledDate: string; nextDate: string; status: MaintStatus; priority: MaintPriority; cost: string; technician: string; notes: string }
const blankForm = (): FormState => ({ title: '', type: 'Preventive', assetId: '', scheduledDate: daysFromNow(7), nextDate: '', status: 'scheduled', priority: 'Medium', cost: '', technician: '', notes: '' })

export function AssetMaintenance() {
  const app = useApp()
  const { assets, users } = app
  const { hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [items, setItems] = useState<MaintRec[]>(() => loadMaintenance())
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage may be unavailable */ } }, [items])

  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [perPage, setPerPage] = useState(10)
  const [statusTab, setStatusTab] = useState<'all' | MaintStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<FormState | null>(null)
  const [viewing, setViewing] = useState<MaintRec | null>(null)

  const assetOf = (m: MaintRec) => assets.find((x) => x.id === m.assetId)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items
      .filter((m) => {
        const asset = assetOf(m)
        if (ql && !`${m.title} ${asset?.name || ''} ${asset?.tag || ''} ${m.technician || ''}`.toLowerCase().includes(ql)) return false
        if (statusTab !== 'all' && m.status !== statusTab) return false
        if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false
        return true
      })
      .sort((a, b) => (sortAsc ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)))
  }, [items, assets, q, statusTab, priorityFilter, sortAsc])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)
  useEffect(() => { setPage(1) }, [q, statusTab, priorityFilter, perPage])

  const statusCount = (s: 'all' | MaintStatus) => (s === 'all' ? items.length : items.filter((m) => m.status === s).length)

  const saveForm = () => {
    if (!form) return
    if (!form.title.trim()) { toast.error('Enter a maintenance title.'); return }
    if (!form.assetId) { toast.error('Pick the asset being serviced.'); return }
    if (!form.scheduledDate) { toast.error('Pick a scheduled date.'); return }
    const cost = Number(form.cost) || 0
    if (form.id) {
      setItems((p) => p.map((m) => m.id === form.id ? { ...m, title: form.title.trim(), type: form.type, assetId: form.assetId, scheduledDate: form.scheduledDate, nextDate: form.nextDate || undefined, status: form.status, priority: form.priority, cost, technician: form.technician || undefined, notes: form.notes || undefined } : m))
      toast.success('Maintenance updated', form.title)
    } else {
      setItems((p) => [{ id: uid('mnt'), title: form.title.trim(), type: form.type, assetId: form.assetId, scheduledDate: form.scheduledDate, nextDate: form.nextDate || undefined, status: form.status, priority: form.priority, cost, technician: form.technician || undefined, notes: form.notes || undefined }, ...p])
      toast.success('Maintenance scheduled', form.title)
    }
    setForm(null)
  }

  const remove = (m: MaintRec) => {
    if (!window.confirm(`Delete “${m.title}”? This cannot be undone.`)) return
    setItems((p) => p.filter((x) => x.id !== m.id))
    toast.success('Maintenance deleted')
  }

  const openEdit = (m: MaintRec) => setForm({ id: m.id, title: m.title, type: m.type, assetId: m.assetId, scheduledDate: m.scheduledDate, nextDate: m.nextDate || '', status: m.status, priority: m.priority, cost: m.cost ? String(m.cost) : '', technician: m.technician || '', notes: m.notes || '' })

  const actions = (m: MaintRec) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="View" onClick={() => setViewing(m)} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><Eye className="size-4" /></button>
      {canManage && <button type="button" title="Edit" onClick={() => openEdit(m)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>}
      {canManage && <button type="button" title="Delete" onClick={() => remove(m)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Manage Maintenance"
        desc="Track and manage maintenance schedules, costs, technicians, status and priorities for all company assets."
        actions={canManage ? <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setForm(blankForm())} aria-label="New maintenance"><Plus className="size-4" /></Button> : undefined}
      />

      {/* ---- Toolbar ---- */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          <Input value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setQ(e.target.value) }} placeholder="Search maintenance..." className="max-w-xs" />
          <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setQ(searchInput)}><Search className="size-4" /> Search</Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-line">
            <button type="button" title="List view" onClick={() => setView('list')} className={`cursor-pointer p-2 transition ${view === 'list' ? 'bg-orange-500 text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}><List className="size-4" /></button>
            <button type="button" title="Grid view" onClick={() => setView('grid')} className={`cursor-pointer p-2 transition ${view === 'grid' ? 'bg-orange-500 text-white' : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}><LayoutGrid className="size-4" /></button>
          </div>
          <Select value={String(perPage)} onChange={(e) => setPerPage(Number(e.target.value))} className="w-28">
            <option value={10}>10 per page</option>
            <option value={20}>20 per page</option>
            <option value={50}>50 per page</option>
          </Select>
          <div className="relative">
            <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
              <Filter className="size-4" /> Filters
            </button>
            {filtersOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFiltersOpen(false)} />
                <div className="card absolute right-0 z-20 mt-1 w-44 rounded-lg p-1">
                  <p className="px-3 py-1 text-xs font-bold uppercase text-mist">Priority</p>
                  {[{ id: 'all', label: 'All priorities' }, ...PRIORITIES.map((p) => ({ id: p, label: p }))].map((s) => (
                    <button key={s.id} type="button" onClick={() => { setPriorityFilter(s.id); setFiltersOpen(false) }} className={`flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${priorityFilter === s.id ? 'font-bold text-orange-500' : ''}`}>{s.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- List / grid card ---- */}
      <div className="card overflow-hidden rounded-xl">
      {/* ---- Status tabs (card header) ---- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 pt-1">
        {(['all', ...STATUSES.map((s) => s.id)] as const).map((s) => {
          const on = statusTab === s
          const Icon = s === 'all' ? Layers : s === 'scheduled' ? CalendarDays : s === 'in_progress' ? Wrench : s === 'completed' ? CheckCircle2 : XCircle
          return (
            <button key={s} type="button" onClick={() => setStatusTab(s)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${on ? 'border-orange-500 text-orange-500' : 'border-transparent text-mist hover:text-inherit'}`}>
              <Icon className="size-4" /> {s === 'all' ? 'All' : STATUSES.find((x) => x.id === s)?.label}
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? 'bg-orange-500/15' : 'bg-black/[0.06] dark:bg-white/10'}`}>{statusCount(s)}</span>
            </button>
          )
        })}
      </div>
        {slice.length === 0 && <Empty title="No maintenance records" desc="No maintenance matches your search or filters." />}

        {view === 'list' && slice.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => setSortAsc((v) => !v)} className="flex cursor-pointer items-center gap-1 uppercase tracking-wide"><ArrowUpDown className="size-3.5" /> Title</button>
                  </th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Scheduled Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((m) => {
                  const asset = assetOf(m)
                  return (
                    <tr key={m.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{m.title}</p>
                        <Badge tone={typeTone(m.type)} className="mt-1">{m.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AssetTile asset={asset} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{asset?.name || 'Unknown asset'}</p>
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {asset?.tag || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-mist"><CalendarDays className="size-4 opacity-60" /> {m.scheduledDate}</span></td>
                      <td className="px-4 py-3"><Badge tone={statusTone(m.status)}>{STATUSES.find((s) => s.id === m.status)?.label}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={priorityTone(m.priority)}>{m.priority}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold">{formatGhs(m.cost)}</td>
                      <td className="px-4 py-3">{actions(m)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && slice.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((m) => {
              const asset = assetOf(m)
              return (
                <div key={m.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.title}</p>
                      <Badge tone={typeTone(m.type)} className="mt-1">{m.type}</Badge>
                    </div>
                    <span className="text-sm font-bold">{formatGhs(m.cost)}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <AssetTile asset={asset} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{asset?.name || 'Unknown asset'}</p>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {asset?.tag || '—'}</span>
                    </div>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-mist"><CalendarDays className="size-3.5" /> Scheduled {m.scheduledDate}{m.technician && ` · ${m.technician}`}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Badge tone={statusTone(m.status)}>{STATUSES.find((s) => s.id === m.status)?.label}</Badge>
                      <Badge tone={priorityTone(m.priority)}>{m.priority}</Badge>
                    </div>
                    {actions(m)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ---- Footer / pagination ---- */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm text-mist">
          <span>Showing {filtered.length === 0 ? 0 : (cur - 1) * perPage + 1} to {Math.min(cur * perPage, filtered.length)} of {filtered.length} results</span>
          <div className="flex items-center gap-1.5">
            <button type="button" disabled={cur === 1} onClick={() => setPage(cur - 1)} className="flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"><ChevronLeft className="size-3.5" /> Previous</button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} type="button" onClick={() => setPage(p)} className={`h-8 w-8 cursor-pointer rounded-md text-sm font-medium transition ${p === cur ? 'bg-orange-500 text-white' : 'border border-line hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>{p}</button>
            ))}
            <button type="button" disabled={cur === pages} onClick={() => setPage(cur + 1)} className="flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]">Next <ChevronRight className="size-3.5" /></button>
          </div>
        </div>
      </div>

      {/* ---- New / edit maintenance form ---- */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">{form.id ? 'Edit Maintenance' : 'New Maintenance'}</h2>
                <p className="mt-1 text-sm text-mist">Schedule a maintenance job against an asset.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Title *</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Quarterly System Check" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Asset *</label>
                <Select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                  <option value="">Select asset…</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Type</label>
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as MaintType })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Priority</label>
                  <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as MaintPriority })}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Scheduled Date *</label>
                  <Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Next Maintenance Date</label>
                  <Input type="date" value={form.nextDate} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Status</label>
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as MaintStatus })}>
                    {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Cost (GHS)</label>
                  <Input type="number" min="0" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Technician</label>
                <Select value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-orange-500" placeholder="Optional notes…" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveForm}>{form.id ? 'Save Changes' : 'Schedule Maintenance'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- View maintenance ---- */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setViewing(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <h2 className="text-base font-bold sm:text-lg">Maintenance Details</h2>
              <button type="button" aria-label="Close" onClick={() => setViewing(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="font-semibold">{viewing.title}</p>
                <Badge tone={typeTone(viewing.type)} className="mt-1">{viewing.type}</Badge>
              </div>
              <div className="flex items-center gap-3">
                <AssetTile asset={assetOf(viewing)} />
                <div>
                  <p className="font-semibold">{assetOf(viewing)?.name || 'Unknown asset'}</p>
                  <p className="text-xs text-mist">{assetOf(viewing)?.tag}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-mist">Scheduled Date</p><p className="mt-0.5 font-semibold">{viewing.scheduledDate}</p></div>
                <div><p className="text-xs text-mist">Next Maintenance Date</p><p className="mt-0.5 font-semibold">{viewing.nextDate || '—'}</p></div>
                <div><p className="text-xs text-mist">Status</p><Badge tone={statusTone(viewing.status)}>{STATUSES.find((s) => s.id === viewing.status)?.label}</Badge></div>
                <div><p className="text-xs text-mist">Priority</p><Badge tone={priorityTone(viewing.priority)}>{viewing.priority}</Badge></div>
                <div><p className="text-xs text-mist">Cost</p><p className="mt-0.5 font-semibold">{formatGhs(viewing.cost)}</p></div>
                <div><p className="text-xs text-mist">Technician</p><p className="mt-0.5 font-semibold">{viewing.technician || 'Unassigned'}</p></div>
              </div>
              {viewing.notes && <p className="rounded-md bg-black/[0.04] p-3 text-xs text-mist dark:bg-white/[0.05]">{viewing.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
