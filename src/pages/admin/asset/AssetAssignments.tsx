import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, List, LayoutGrid, Eye, RotateCcw, SquarePen, Trash2, CalendarDays,
  ClipboardList, Play, CheckCircle2, AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight,
  X, Filter, Tag, Layers, CircleCheck, CircleAlert, Clock3,
} from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, Empty } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import type { Asset } from '../../../types'

type Assignment = {
  id: string
  assetId: string
  assignedToName: string
  assignedToEmail: string
  assignedDate: string // YYYY-MM-DD
  expectedReturn: string // YYYY-MM-DD
  status: 'active' | 'returned'
  returnedDate?: string
  condition: string
  notes?: string
}

const KEY = 'fitpro_asset_assignments_v1'
const iso = (d: Date) => d.toISOString().slice(0, 10)
const today = () => iso(new Date())
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) }
const isOverdue = (a: Assignment) => a.status === 'active' && a.expectedReturn < today()

function seed(): Assignment[] {
  return [
    { id: 'asg_1', assetId: 'ast_1', assignedToName: 'Ama Owusu', assignedToEmail: 'ama.owusu@fitpro.gym', assignedDate: daysFromNow(-620), expectedReturn: daysFromNow(-300), status: 'active', condition: 'Excellent' },
    { id: 'asg_2', assetId: 'ast_2', assignedToName: 'Kofi Mensah', assignedToEmail: 'kofi.mensah@fitpro.gym', assignedDate: daysFromNow(-590), expectedReturn: daysFromNow(-320), status: 'active', condition: 'Good' },
    { id: 'asg_3', assetId: 'ast_3', assignedToName: 'Efua Hammond', assignedToEmail: 'efua.hammond@fitpro.gym', assignedDate: daysFromNow(-610), expectedReturn: daysFromNow(-350), status: 'active', condition: 'Excellent' },
    { id: 'asg_4', assetId: 'ast_4', assignedToName: 'Yaw Darko', assignedToEmail: 'yaw.darko@fitpro.gym', assignedDate: daysFromNow(-570), expectedReturn: daysFromNow(-340), status: 'active', condition: 'Good' },
    { id: 'asg_5', assetId: 'ast_5', assignedToName: 'Abena Sarpong', assignedToEmail: 'abena.sarpong@fitpro.gym', assignedDate: daysFromNow(-580), expectedReturn: daysFromNow(-400), status: 'active', condition: 'Fair' },
    { id: 'asg_6', assetId: 'ast_6', assignedToName: 'Kwesi Appiah', assignedToEmail: 'kwesi.appiah@fitpro.gym', assignedDate: daysFromNow(-700), expectedReturn: daysFromNow(-500), status: 'returned', returnedDate: daysFromNow(-500), condition: 'Good' },
    { id: 'asg_7', assetId: 'ast_6', assignedToName: 'Ama Owusu', assignedToEmail: 'ama.owusu@fitpro.gym', assignedDate: daysFromNow(-200), expectedReturn: daysFromNow(-60), status: 'active', condition: 'Excellent' },
    { id: 'asg_8', assetId: 'ast_3', assignedToName: 'Kofi Mensah', assignedToEmail: 'kofi.mensah@fitpro.gym', assignedDate: daysFromNow(-150), expectedReturn: daysFromNow(-45), status: 'active', condition: 'Excellent' },
  ]
}

function loadAssignments(): Assignment[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as Assignment[]
    }
  } catch { /* fall through to seed */ }
  return seed()
}

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()
const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

function AssetTile({ asset }: { asset?: Asset }) {
  const hue = hueOf(asset?.category || '?')
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-line text-sm font-bold"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 55% 74%))`, color: `hsl(${hue} 50% 25%)` }}
      title={asset?.category}
    >
      {asset ? asset.name.slice(0, 1).toUpperCase() : '?'}
    </div>
  )
}

function Ring({ pct, className }: { pct: number; className: string }) {
  const r = 15.5
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-11 w-11">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-current opacity-20" />
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(c * Math.min(100, pct)) / 100} ${c}`} className={className} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[9px] font-bold">{pct}%</span>
    </div>
  )
}

const conditionTone = (c: string): 'lime' | 'sky' | 'amber' | 'rose' | 'zinc' =>
  c === 'Excellent' ? 'lime' : c === 'Good' ? 'sky' : c === 'Fair' ? 'amber' : c === 'Poor' ? 'rose' : 'zinc'

type FormState = { id?: string; assetId: string; assignedToName: string; assignedToEmail: string; assignedDate: string; expectedReturn: string; status: 'active' | 'returned'; condition: string; notes: string }
const blankForm = (): FormState => ({ assetId: '', assignedToName: '', assignedToEmail: '', assignedDate: today(), expectedReturn: daysFromNow(30), status: 'active', condition: 'Excellent', notes: '' })

export function AssetAssignments() {
  const app = useApp()
  const { assets, users, assetConditions } = app
  const { hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [items, setItems] = useState<Assignment[]>(() => loadAssignments())
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* storage may be unavailable */ } }, [items])

  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [perPage, setPerPage] = useState(10)
  const [statusFilter, setStatusFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [condTab, setCondTab] = useState('all')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<FormState | null>(null)
  const [viewing, setViewing] = useState<Assignment | null>(null)

  const assetOf = (a: Assignment) => assets.find((x) => x.id === a.assetId)

  // ---- Stats ----
  const total = items.length
  const active = items.filter((a) => a.status === 'active').length
  const returned = items.filter((a) => a.status === 'returned').length
  const overdue = items.filter(isOverdue).length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)

  // ---- Filtering ----
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items
      .filter((a) => {
        const asset = assets.find((x) => x.id === a.assetId)
        if (ql && !`${asset?.name || ''} ${asset?.tag || ''}`.toLowerCase().includes(ql)) return false
        if (statusFilter === 'active' && a.status !== 'active') return false
        if (statusFilter === 'returned' && a.status !== 'returned') return false
        if (statusFilter === 'overdue' && !isOverdue(a)) return false
        if (condTab !== 'all' && a.condition !== condTab) return false
        return true
      })
      .sort((a, b) => {
        const an = assets.find((x) => x.id === a.assetId)?.name || ''
        const bn = assets.find((x) => x.id === b.assetId)?.name || ''
        return sortAsc ? an.localeCompare(bn) : bn.localeCompare(an)
      })
  }, [items, assets, q, statusFilter, condTab, sortAsc])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)
  useEffect(() => { setPage(1) }, [q, statusFilter, condTab, perPage])

  const condTabs = ['all', ...assetConditions]
  const condCount = (c: string) => (c === 'all' ? items.length : items.filter((a) => a.condition === c).length)

  // ---- Mutations ----
  const saveForm = () => {
    if (!form) return
    if (!form.assetId) { toast.error('Pick an asset to assign.'); return }
    if (!form.assignedToName.trim()) { toast.error('Pick who the asset is assigned to.'); return }
    if (!form.assignedDate || !form.expectedReturn) { toast.error('Assigned and expected return dates are required.'); return }
    if (form.id) {
      setItems((p) => p.map((a) => a.id === form.id ? {
        ...a, assetId: form.assetId, assignedToName: form.assignedToName.trim(), assignedToEmail: form.assignedToEmail.trim(),
        assignedDate: form.assignedDate, expectedReturn: form.expectedReturn, status: form.status,
        returnedDate: form.status === 'returned' ? (a.returnedDate || today()) : undefined,
        condition: form.condition, notes: form.notes || undefined,
      } : a))
      toast.success('Assignment updated', assets.find((x) => x.id === form.assetId)?.name)
    } else {
      setItems((p) => [{ id: uid('asg'), assetId: form.assetId, assignedToName: form.assignedToName.trim(), assignedToEmail: form.assignedToEmail.trim(), assignedDate: form.assignedDate, expectedReturn: form.expectedReturn, status: 'active', condition: form.condition, notes: form.notes || undefined }, ...p])
      toast.success('Asset assigned', assets.find((x) => x.id === form.assetId)?.name)
    }
    setForm(null)
  }

  const returnAsset = (a: Assignment) => {
    setItems((p) => p.map((x) => x.id === a.id ? { ...x, status: 'returned', returnedDate: today() } : x))
    toast.success('Asset marked as returned', assetOf(a)?.name)
  }

  const remove = (a: Assignment) => {
    if (!window.confirm(`Delete this assignment of ${assetOf(a)?.name || 'asset'} to ${a.assignedToName}? This cannot be undone.`)) return
    setItems((p) => p.filter((x) => x.id !== a.id))
    toast.success('Assignment deleted')
  }

  const openEdit = (a: Assignment) => setForm({ id: a.id, assetId: a.assetId, assignedToName: a.assignedToName, assignedToEmail: a.assignedToEmail, assignedDate: a.assignedDate, expectedReturn: a.expectedReturn, status: a.status, condition: a.condition, notes: a.notes || '' })

  const actions = (a: Assignment) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="View" onClick={() => setViewing(a)} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><Eye className="size-4" /></button>
      {a.status === 'active' && (
        <>
          <button type="button" title="Mark returned" onClick={() => returnAsset(a)} className="cursor-pointer rounded-md p-1.5 text-orange-500 transition hover:bg-orange-500/10"><RotateCcw className="size-4" /></button>
          {canManage && <button type="button" title="Edit" onClick={() => openEdit(a)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>}
        </>
      )}
      {canManage && <button type="button" title="Delete" onClick={() => remove(a)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Manage Assignments"
        desc="Track and manage assets assigned to employees, log expected return dates, record asset condition states, and process returned assets."
        actions={canManage ? <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setForm(blankForm())} aria-label="New assignment"><Plus className="size-4" /></Button> : undefined}
      />

      {/* ---- Stat cards ---- */}
      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-start justify-between rounded-xl border-sky-500/40 bg-sky-500/10 p-4">
          <div>
            <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">Total Assignments</p>
            <p className="mt-2 text-2xl font-bold">{total}</p>
            <p className="mt-1 text-xs text-mist">All time assignments</p>
          </div>
          <ClipboardList className="size-6 text-sky-600 dark:text-sky-400" />
        </div>
        <div className="card flex items-start justify-between rounded-xl border-emerald-500/40 bg-emerald-500/10 p-4">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Active Assignments</p>
            <p className="mt-2 text-2xl font-bold">{active}</p>
            <p className="mt-1 text-xs text-mist">Currently active</p>
            <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">↑ {pct(active)}% of total</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-emerald-600 dark:text-emerald-400">
            <Play className="size-6" />
            <Ring pct={pct(active)} className="stroke-emerald-500" />
          </div>
        </div>
        <div className="card flex items-start justify-between rounded-xl border-violet-500/40 bg-violet-500/10 p-4">
          <div>
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Returned Assets</p>
            <p className="mt-2 text-2xl font-bold">{returned}</p>
            <p className="mt-1 text-xs text-mist">Successfully returned</p>
            <p className="mt-1 text-xs font-semibold text-violet-600 dark:text-violet-400">↑ {pct(returned)}% of total</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-violet-600 dark:text-violet-400">
            <CheckCircle2 className="size-6" />
            <Ring pct={pct(returned)} className="stroke-violet-500" />
          </div>
        </div>
        <div className="card flex items-start justify-between rounded-xl border-amber-500/40 bg-amber-500/10 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Overdue Assignments</p>
            <p className="mt-2 text-2xl font-bold">{overdue}</p>
            <p className="mt-1 text-xs text-mist">Require attention</p>
            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">↑ {pct(overdue)}% of total</p>
          </div>
          <div className="flex flex-col items-end gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-6" />
            <Ring pct={pct(overdue)} className="stroke-amber-500" />
          </div>
        </div>
      </div>

      {/* ---- Toolbar ---- */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          <Input value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setQ(e.target.value) }} placeholder="Search by asset name..." className="max-w-xs" />
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
                  {[{ id: 'all', label: 'All statuses' }, { id: 'active', label: 'Active' }, { id: 'returned', label: 'Returned' }, { id: 'overdue', label: 'Overdue' }].map((s) => (
                    <button key={s.id} type="button" onClick={() => { setStatusFilter(s.id); setFiltersOpen(false) }} className={`flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${statusFilter === s.id ? 'font-bold text-orange-500' : ''}`}>{s.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- List / grid card ---- */}
      <div className="card overflow-hidden rounded-xl">
      {/* ---- Condition tabs (card header) ---- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 pt-1">
        {condTabs.map((c) => {
          const Icon = c === 'all' ? Layers : c === 'Excellent' ? CircleCheck : c === 'Good' ? CheckCircle2 : c === 'Fair' ? Clock3 : CircleAlert
          const on = condTab === c
          return (
            <button key={c} type="button" onClick={() => setCondTab(c)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${on ? 'border-orange-500 text-orange-500' : 'border-transparent text-mist hover:text-inherit'}`}>
              <Icon className="size-4" /> {c === 'all' ? 'All' : c}
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? 'bg-orange-500/15' : 'bg-black/[0.06] dark:bg-white/10'}`}>{condCount(c)}</span>
            </button>
          )
        })}
      </div>
        {slice.length === 0 && <Empty title="No assignments" desc="No assignments match your search or filters." />}

        {view === 'list' && slice.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => setSortAsc((s) => !s)} className="flex cursor-pointer items-center gap-1 uppercase tracking-wide"><ArrowUpDown className="size-3.5" /> Asset</button>
                  </th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Assigned Date</th>
                  <th className="px-4 py-3">Expected Return</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((a) => {
                  const asset = assetOf(a)
                  const overdueRow = isOverdue(a)
                  return (
                    <tr key={a.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <AssetTile asset={asset} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{asset?.name || 'Unknown asset'}</p>
                            <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {asset?.tag || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-zinc-400/30 text-[10px] font-bold">{initials(a.assignedToName)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{a.assignedToName}</p>
                            <p className="truncate text-xs text-mist">{a.assignedToEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-mist"><CalendarDays className="size-4 opacity-60" /> {a.assignedDate}</span></td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 ${overdueRow ? 'font-semibold text-rose-500' : 'text-mist'}`}><CalendarDays className="size-4 opacity-60" /> {a.expectedReturn}</span>
                        {overdueRow && <span className="ml-5.5 text-xs font-medium text-rose-500">Overdue</span>}
                      </td>
                      <td className="px-4 py-3"><Badge tone={a.status === 'active' ? 'sky' : 'lime'}>{a.status === 'active' ? 'Active' : 'Returned'}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={conditionTone(a.condition)}>{a.condition}</Badge></td>
                      <td className="px-4 py-3">{actions(a)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && slice.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((a) => {
              const asset = assetOf(a)
              const overdueRow = isOverdue(a)
              return (
                <div key={a.id} className="rounded-xl border border-line p-4">
                  <div className="flex items-center gap-3">
                    <AssetTile asset={asset} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{asset?.name || 'Unknown asset'}</p>
                      <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {asset?.tag || '—'}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-zinc-400/30 text-[10px] font-bold">{initials(a.assignedToName)}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.assignedToName}</p>
                      <p className="truncate text-xs text-mist">{a.assignedToEmail}</p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-mist">
                    <p className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Assigned {a.assignedDate}</p>
                    <p className={`flex items-center gap-1.5 ${overdueRow ? 'font-semibold text-rose-500' : ''}`}><CalendarDays className="size-3.5" /> Return {a.expectedReturn}{overdueRow && ' · Overdue'}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Badge tone={a.status === 'active' ? 'sky' : 'lime'}>{a.status === 'active' ? 'Active' : 'Returned'}</Badge>
                      <Badge tone={conditionTone(a.condition)}>{a.condition}</Badge>
                    </div>
                    {actions(a)}
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

      {/* ---- New / edit assignment form ---- */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">{form.id ? 'Edit Assignment' : 'New Assignment'}</h2>
                <p className="mt-1 text-sm text-mist">Assign an asset to a person and set the expected return date.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Asset *</label>
                <Select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })}>
                  <option value="">Select asset…</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Assigned To *</label>
                <Select
                  value={users.find((u) => u.name === form.assignedToName)?.id || ''}
                  onChange={(e) => {
                    const u = users.find((x) => x.id === e.target.value)
                    setForm({ ...form, assignedToName: u?.name || '', assignedToEmail: u?.email || '' })
                  }}
                >
                  <option value="">Select person…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Assigned Date *</label>
                  <Input type="date" value={form.assignedDate} onChange={(e) => setForm({ ...form, assignedDate: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Expected Return *</label>
                  <Input type="date" value={form.expectedReturn} onChange={(e) => setForm({ ...form, expectedReturn: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Condition</label>
                  <Select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                    {assetConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                {form.id && (
                  <div>
                    <label className="mb-1 block text-xs font-bold">Status</label>
                    <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'returned' })}>
                      <option value="active">Active</option>
                      <option value="returned">Returned</option>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-orange-500" placeholder="Optional notes…" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveForm}>{form.id ? 'Save Changes' : 'Assign Asset'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- View assignment ---- */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setViewing(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <h2 className="text-base font-bold sm:text-lg">Assignment Details</h2>
              <button type="button" aria-label="Close" onClick={() => setViewing(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <AssetTile asset={assetOf(viewing)} />
                <div>
                  <p className="font-semibold">{assetOf(viewing)?.name || 'Unknown asset'}</p>
                  <p className="text-xs text-mist">{assetOf(viewing)?.tag}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-mist">Assigned To</p><p className="mt-0.5 font-semibold">{viewing.assignedToName}</p><p className="text-xs text-mist">{viewing.assignedToEmail}</p></div>
                <div><p className="text-xs text-mist">Status</p><Badge tone={viewing.status === 'active' ? 'sky' : 'lime'}>{viewing.status === 'active' ? 'Active' : 'Returned'}</Badge></div>
                <div><p className="text-xs text-mist">Assigned Date</p><p className="mt-0.5 font-semibold">{viewing.assignedDate}</p></div>
                <div><p className="text-xs text-mist">Expected Return</p><p className={`mt-0.5 font-semibold ${isOverdue(viewing) ? 'text-rose-500' : ''}`}>{viewing.expectedReturn}{isOverdue(viewing) && ' · Overdue'}</p></div>
                {viewing.returnedDate && <div><p className="text-xs text-mist">Returned On</p><p className="mt-0.5 font-semibold">{viewing.returnedDate}</p></div>}
                <div><p className="text-xs text-mist">Condition</p><Badge tone={conditionTone(viewing.condition)}>{viewing.condition}</Badge></div>
              </div>
              {viewing.notes && <p className="rounded-md bg-black/[0.04] p-3 text-xs text-mist dark:bg-white/[0.05]">{viewing.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
