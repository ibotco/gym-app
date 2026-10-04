import { useEffect, useMemo, useState } from 'react'
import {
  Printer, TrendingDown, Wallet, Boxes, CalendarDays, Sigma, AlertTriangle, Trash2,
  Search, List, LayoutGrid, Filter, SquarePen, PenLine, ChevronLeft, ChevronRight, X, Tag, Layers, Sparkles, Save,
} from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Empty } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import { residualValue, depreciationSchedule } from '../../lib/assets'
import { DEPRECIATION_METHODS } from '../../lib/depreciation'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import type { Asset, DepreciationMethod } from '../../types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
const METHOD_LABEL: Record<DepreciationMethod, string> = { straight_line: 'Straight Line', reducing_balance: 'Declining Balance', sum_of_years: 'Sum of Years', manual: 'Manual' }
const METHOD_TONE = (m: DepreciationMethod): 'lime' | 'sky' | 'amber' | 'violet' => (m === 'straight_line' ? 'lime' : m === 'reducing_balance' ? 'sky' : m === 'sum_of_years' ? 'violet' : 'amber')
const MS_YEAR = 365.25 * 24 * 3600 * 1000

type ParamForm = { assetId: string; method: DepreciationMethod; life: string; salvage: string; start: string }
type ManualForm = { id?: string; assetId: string; date: string; method: DepreciationMethod; amount: string; notes: string }

const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }
function AssetTile({ asset }: { asset?: Asset }) {
  const hue = hueOf(asset?.category || '?')
  return (
    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-line text-sm font-bold" style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 55% 74%))`, color: `hsl(${hue} 50% 25%)` }} title={asset?.category}>
      {asset ? asset.name.slice(0, 1).toUpperCase() : '?'}
    </span>
  )
}

export function AssetDepreciation() {
  const app = useApp()
  const { assets, depreciation, upsertDepreciation, upsertAsset, company, log, depreciationPolicy, depreciationPolicies } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  // ---- Per-asset depreciation parameters (asset override → policy fallback) ----
  const methodOf = (a: Asset): DepreciationMethod => a.depreciationMethod ?? depreciationPolicy.method
  const lifeOf = (a: Asset) =>
    a.usefulLifeYears ??
    (depreciationPolicies.find((p) => p.status === 'active' && p.period > 0 && p.name.toLowerCase() === a.category.toLowerCase())?.period ??
      depreciationPolicy.usefulLifeYears)
  const salvageOf = (a: Asset) => a.salvageValue ?? residualValue(a.purchaseCost || 0, depreciationPolicy.residualPercent)
  const startOf = (a: Asset) => a.depreciationStart ?? a.purchaseDate ?? ''
  const annualOf = (a: Asset) => Math.max(0, Math.round(((a.purchaseCost || 0) - salvageOf(a)) / (lifeOf(a) || 1)))
  const accumulatedAt = (a: Asset, atMs: number) => {
    const dep = (a.purchaseCost || 0) - salvageOf(a)
    const t = new Date(startOf(a)).getTime()
    if (!Number.isFinite(t) || dep <= 0) return 0
    const age = Math.max(0, (atMs - t) / MS_YEAR)
    return Math.round(dep * Math.min(1, age / (lifeOf(a) || 1)))
  }
  const accumulatedOf = (a: Asset) => accumulatedAt(a, Date.now())
  const bookOf = (a: Asset) => Math.max(salvageOf(a), (a.purchaseCost || 0) - accumulatedOf(a))
  const isFully = (a: Asset) => (a.purchaseCost || 0) > 0 && (a.purchaseCost || 0) - salvageOf(a) > 0 && accumulatedOf(a) >= (a.purchaseCost || 0) - salvageOf(a)

  /** Method-aware monthly depreciation charge for a period ending at `atMs`. */
  const monthlyCharge = (a: Asset, atMs: number, mOverride?: DepreciationMethod) => {
    const cost = a.purchaseCost || 0
    const sal = salvageOf(a)
    const life = lifeOf(a) || 1
    const start = new Date(startOf(a)).getTime()
    if (cost <= 0 || sal >= cost || !Number.isFinite(start)) return 0
    const age = Math.max(0, (atMs - start) / MS_YEAR)
    if (age >= life) return 0 // fully depreciated by period end
    const m = mOverride ?? methodOf(a)
    if (m === 'reducing_balance') {
      const rate = 1 - Math.pow(sal / cost, 1 / life)
      const book = cost * Math.pow(1 - rate, age)
      return Math.round((book * rate) / 12)
    }
    if (m === 'sum_of_years') { // sum-of-years-digits
      const y = Math.floor(age) + 1
      const sumY = (life * (life + 1)) / 2
      return Math.round(((cost - sal) * (life - y + 1)) / sumY / 12)
    }
    if (m === 'manual') return 0 // manual adjustments never auto-accrue
    return Math.round((cost - sal) / life / 12)
  }

  /** Method-aware depreciation accrued up to `dateStr` minus what is already recorded. */
  const dueDepreciation = (a: Asset, dateStr: string, m: DepreciationMethod) => {
    const cost = a.purchaseCost || 0
    const sal = salvageOf(a)
    const start = new Date(startOf(a)).getTime()
    const end = new Date(dateStr).getTime()
    if (cost <= 0 || sal >= cost || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
    const MS_MO = MS_YEAR / 12
    let accrued = 0
    for (let t = start + MS_MO; t <= end; t += MS_MO) {
      accrued += monthlyCharge(a, t, m)
      if (accrued >= cost - sal) { accrued = cost - sal; break }
    }
    const recorded = depreciation
      .filter((e) => e.assetId === a.id && new Date(e.date).getTime() <= end)
      .reduce((sum, e) => sum + (e.amount || 0), 0)
    return Math.max(0, Math.round(accrued - recorded))
  }

  const [q, setQ] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [perPage, setPerPage] = useState(10)
  const [methodTab, setMethodTab] = useState<'all' | DepreciationMethod>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)

  const [params, setParams] = useState<ParamForm | null>(null)
  const [removing, setRemoving] = useState<Asset | null>(null)
  const [viewing, setViewing] = useState<Asset | null>(null)
  const [genOpen, setGenOpen] = useState(false)
  const [genMonth, setGenMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [manual, setManual] = useState<ManualForm | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const depreciable = useMemo(() => assets.filter((a) => a.purchaseCost != null && a.purchaseCost > 0), [assets])

  // ---- Stats ----
  const totalBook = depreciable.reduce((s, a) => s + bookOf(a), 0)
  const totalAnnual = depreciable.reduce((s, a) => s + annualOf(a), 0)
  const avgLife = depreciable.length ? Math.round(depreciable.reduce((s, a) => s + (lifeOf(a) || 0), 0) / depreciable.length) : 0
  const fullyCount = depreciable.filter(isFully).length

  // ---- Depreciation trend (current year, month by month) ----
  const trend = useMemo(() => {
    const year = new Date().getFullYear()
    return MONTHS.map((m, i) => {
      const end = new Date(year, i + 1, 0).getTime()
      let acc = 0, monthly = 0
      for (const a of depreciable) { acc += accumulatedAt(a, end); monthly += annualOf(a) / 12 }
      return { m, accumulated: acc, monthly: Math.round(monthly) }
    })
  }, [depreciable])

  const donut = [
    { name: 'Partially', value: depreciable.length - fullyCount },
    { name: 'Fully', value: fullyCount },
  ]
  const DONUT_COLORS = ['#10b981', '#ef4444']

  const methodDist = (Object.keys(METHOD_LABEL) as DepreciationMethod[]).map((id) => {
    const count = depreciable.filter((a) => methodOf(a) === id).length
    return { id, label: METHOD_LABEL[id], count, pct: depreciable.length ? Math.round((count / depreciable.length) * 100) : 0 }
  })

  // ---- Filtering / paging ----
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return depreciable
      .filter((a) => {
        if (ql && !`${a.name} ${a.tag}`.toLowerCase().includes(ql)) return false
        if (methodTab !== 'all' && methodOf(a) !== methodTab) return false
        if (statusFilter === 'active' && isFully(a)) return false
        if (statusFilter === 'fully' && !isFully(a)) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [depreciable, q, methodTab, statusFilter])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)

  const methodCount = (m: 'all' | DepreciationMethod) => (m === 'all' ? depreciable.length : depreciable.filter((a) => methodOf(a) === m).length)

  // ---- Selection for auto-generation ----
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id))
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allSelected) filtered.forEach((a) => n.delete(a.id)); else filtered.forEach((a) => n.add(a.id)); return n })

  // ---- Automatic generation of monthly depreciation entries ----
  const AUTO_PREFIX = 'Auto-generated'
  const hasAutoEntry = (assetId: string, ym: string) =>
    depreciation.some((d) => d.assetId === assetId && d.date.slice(0, 7) === ym && (d.notes || '').startsWith(AUTO_PREFIX))

  const pendingGen = useMemo(() => {
    const [y, m] = genMonth.split('-').map(Number)
    if (!y || !m) return [] as { asset: Asset; amount: number; date: string }[]
    const last = new Date(y, m, 0)
    const dateIso = `${y}-${String(m).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    const endMs = last.getTime()
    const scope = selected.size ? depreciable.filter((a) => selected.has(a.id)) : depreciable
    return scope
      .filter((a) => !hasAutoEntry(a.id, genMonth))
      .map((a) => ({ asset: a, amount: monthlyCharge(a, endMs), date: dateIso }))
      .filter((x) => x.amount > 0)
  }, [depreciable, depreciation, genMonth, selected])
  const pendingTotal = pendingGen.reduce((s, p) => s + p.amount, 0)

  const doGenerate = () => {
    if (!pendingGen.length) { toast.error('Nothing to generate — every asset already has an entry for this period.'); return }
    for (const p of pendingGen) {
      upsertDepreciation({ id: uid('dep'), assetId: p.asset.id, amount: p.amount, date: p.date, method: methodOf(p.asset), notes: `${AUTO_PREFIX} — ${genMonth}`, createdAt: new Date().toISOString() })
    }
    log(user?.id || 'system', 'CREATE', 'Depreciation', `Auto-generated ${pendingGen.length} depreciation entries for ${genMonth}`)
    toast.success(`Generated ${pendingGen.length} depreciation entr${pendingGen.length === 1 ? 'y' : 'ies'}`, `${genMonth} · ${formatGhs(pendingTotal)}`)
    setGenOpen(false)
  }

  // ---- Manual saving of a depreciation entry ----
  const saveManual = () => {
    if (!manual) return
    if (!manual.assetId) { toast.error('Select an asset.'); return }
    const amount = Number(manual.amount)
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Enter a valid amount.'); return }
    if (!manual.date) { toast.error('Select a date.'); return }
    const tag = assets.find((a) => a.id === manual.assetId)?.tag || manual.assetId
    upsertDepreciation({ id: manual.id || uid('dep'), assetId: manual.assetId, amount, date: manual.date, method: manual.method, notes: manual.notes.trim() || undefined, createdAt: new Date().toISOString() })
    log(user?.id || 'system', manual.id ? 'UPDATE' : 'CREATE', 'Depreciation', `${manual.id ? 'Edited' : 'Manually saved'} ${formatGhs(amount)} for ${tag}`)
    toast.success('Depreciation saved', formatGhs(amount))
    setManual(null)
  }

  // Auto-calculate the due depreciation whenever asset + non-manual method + date are chosen.
  useEffect(() => {
    if (!manual || manual.id || manual.method === 'manual' || !manual.assetId || !manual.date) return
    const a = assets.find((x) => x.id === manual.assetId)
    if (!a) return
    const due = dueDepreciation(a, manual.date, manual.method)
    setManual((m) => (m && m.assetId === a.id ? { ...m, amount: String(due) } : m))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual?.assetId, manual?.method, manual?.date, assets, depreciation])

  // ---- Per-asset parameters ----
  const openParams = (a: Asset) => setParams({ assetId: a.id, method: methodOf(a), life: String(lifeOf(a)), salvage: String(salvageOf(a)), start: startOf(a) })
  const saveParams = () => {
    if (!params) return
    const a = assets.find((x) => x.id === params.assetId)
    if (!a) return
    const life = Number(params.life)
    if (!Number.isFinite(life) || life <= 0) { toast.error('Enter a useful life greater than zero.'); return }
    upsertAsset({ ...a, depreciationMethod: params.method, usefulLifeYears: life, salvageValue: Number(params.salvage) || 0, depreciationStart: params.start || undefined, updatedAt: new Date().toISOString() })
    log(user?.id || 'system', 'UPDATE', 'Depreciation', `Updated depreciation parameters for ${a.tag}`)
    toast.success('Depreciation parameters updated', a.name)
    setParams(null)
  }

  const doRemove = () => {
    if (!removing) return
    upsertAsset({ ...removing, purchaseCost: undefined, currentValue: undefined, depreciationMethod: undefined, usefulLifeYears: undefined, salvageValue: undefined, depreciationStart: undefined, updatedAt: new Date().toISOString() })
    log(user?.id || 'system', 'DELETE', 'Depreciation', `Removed depreciation tracking for ${removing.tag}`)
    toast.success('Removed from depreciation tracking', removing.name)
    setRemoving(null)
  }

  const exportRows = filtered.map((a) => ({
    tag: a.tag, name: a.name, method: METHOD_LABEL[methodOf(a)], usefulLifeYears: lifeOf(a), salvageValue: salvageOf(a),
    annualDepreciation: annualOf(a), accumulated: accumulatedOf(a), bookValue: bookOf(a), startDate: startOf(a),
    status: isFully(a) ? 'Fully depreciated' : 'Active',
  }))

  const openEditEntry = (a: Asset) => {
    const last = depreciation.filter((e) => e.assetId === a.id).sort((x, y) => x.date.localeCompare(y.date)).at(-1)
    setManual({
      id: last?.id,
      assetId: a.id,
      date: last?.date || new Date().toISOString().slice(0, 10),
      method: last?.method || methodOf(a),
      amount: last ? String(last.amount) : '',
      notes: last?.notes || '',
    })
  }

  const actions = (a: Asset) => (
    <div className="flex items-center justify-end gap-1">
      {canManage && <button type="button" title="Edit depreciation" onClick={() => openEditEntry(a)} className="cursor-pointer rounded-md p-1.5 text-orange-600 transition hover:bg-orange-500/10 dark:text-orange-400"><PenLine className="size-4" /></button>}
      {canManage && <button type="button" title="Edit depreciation parameters" onClick={() => openParams(a)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>}
      {canManage && <button type="button" title="Remove from depreciation tracking" onClick={() => setRemoving(a)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>}
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Manage Depreciation"
        desc="Track and manage depreciation methods, salvage values, annual depreciation, accumulated depreciation and book values for company assets."
        actions={<ExportButtons filename="asset-depreciation" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />}
      />

      {/* ---- Stat cards ---- */}
      <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="card rounded-xl border-sky-500/40 bg-sky-500/10 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-sky-600 dark:text-sky-400">Total Assets</p>
            <Boxes className="size-5 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{depreciable.length}</p>
          <p className="mt-1 text-xs text-mist">Registered depreciable assets</p>
        </div>
        <div className="card rounded-xl border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Current Book Value</p>
            <Wallet className="size-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatGhsExact(totalBook)}</p>
          <p className="mt-1 text-xs text-mist">Net remaining value</p>
        </div>
        <div className="card rounded-xl border-rose-500/40 bg-rose-500/10 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Annual Depreciation</p>
            <TrendingDown className="size-5 text-rose-600 dark:text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-700 dark:text-rose-400">{formatGhsExact(totalAnnual)}</p>
          <p className="mt-1 text-xs text-mist">Current fiscal year</p>
        </div>
        <div className="card rounded-xl border-violet-500/40 bg-violet-500/10 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Average Useful Life</p>
            <CalendarDays className="size-5 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-violet-700 dark:text-violet-400">{avgLife} yrs</p>
          <p className="mt-1 text-xs text-mist">Across all active assets</p>
        </div>
        <div className="card rounded-xl border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Fully Depreciated</p>
            <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{fullyCount}</p>
          <p className="mt-1 text-xs text-mist">Assets reaching end of life</p>
        </div>
      </div>

      {/* ---- Charts ---- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[2fr_1fr_1fr]">
        <div className="card rounded-xl p-4">
          <p className="font-semibold">Depreciation Trend</p>
          <p className="text-xs text-mist">Monthly depreciation vs accumulated depreciation</p>
          <div className="mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="#888" />
                <YAxis tick={{ fontSize: 11 }} stroke="#888" />
                <Tooltip formatter={(v) => formatGhsExact(Number(v))} />
                <Line type="monotone" dataKey="accumulated" name="Accumulated" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="monthly" name="Monthly" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card rounded-xl p-4">
          <p className="font-semibold">Assets by Status</p>
          <p className="text-xs text-mist">Status distribution</p>
          <div className="relative mt-3 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                  {donut.map((d, i) => <Cell key={d.name} fill={DONUT_COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-bold">{depreciable.length}</p>
                <p className="text-[10px] uppercase text-mist">Assets</p>
              </div>
            </div>
          </div>
          <div className="mt-2 space-y-1 text-xs">
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Partially · {depreciable.length ? Math.round(((depreciable.length - fullyCount) / depreciable.length) * 100) : 0}%</p>
            <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Fully · {depreciable.length ? Math.round((fullyCount / depreciable.length) * 100) : 0}%</p>
          </div>
        </div>
        <div className="card rounded-xl p-4">
          <p className="font-semibold">Depreciation Methods</p>
          <p className="text-xs text-mist">Active methods distribution</p>
          <div className="mt-4 space-y-4">
            {methodDist.map((m, i) => (
              <div key={m.id}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-mist">{m.count} assets · <span className={m.pct === 100 ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-bold text-orange-500'}>{m.pct}%</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: ['#10b981', '#3b82f6', '#f59e0b'][i] }} />
                </div>
              </div>
            ))}
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
                <div className="card absolute right-0 z-20 mt-1 w-48 rounded-lg p-1">
                  {[{ id: 'all', label: 'All statuses' }, { id: 'active', label: 'Active' }, { id: 'fully', label: 'Fully depreciated' }].map((s) => (
                    <button key={s.id} type="button" onClick={() => { setStatusFilter(s.id); setFiltersOpen(false) }} className={`flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-left text-sm transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06] ${statusFilter === s.id ? 'font-bold text-orange-500' : ''}`}>{s.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
          {canManage && (
            <Button onClick={() => setManual({ assetId: '', date: new Date().toISOString().slice(0, 10), method: 'straight_line', amount: '', notes: '' })}>
              <Save className="size-4" /> Save Depreciation
            </Button>
          )}
          {canManage && (
            <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setGenOpen(true)}>
              <Sparkles className="size-4" /> Auto-generate{selected.size ? ` (${selected.size} selected)` : ''}
            </Button>
          )}
        </div>
      </div>

      {/* ---- List / grid card ---- */}
      <div className="card overflow-hidden rounded-xl">
      {/* ---- Method tabs (card header) ---- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 pt-1">
        {(['all', 'straight_line', 'reducing_balance', 'sum_of_years', 'manual'] as const).map((m) => {
          const on = methodTab === m
          const Icon = m === 'all' ? Layers : m === 'straight_line' ? TrendingDown : m === 'reducing_balance' ? TrendingDown : m === 'sum_of_years' ? Sigma : CalendarDays
          return (
            <button key={m} type="button" onClick={() => setMethodTab(m)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${on ? 'border-orange-500 text-orange-500' : 'border-transparent text-mist hover:text-inherit'}`}>
              <Icon className="size-4" /> {m === 'all' ? 'All' : METHOD_LABEL[m]}
              <span className={`rounded-full px-1.5 text-xs font-bold ${on ? 'bg-orange-500/15' : 'bg-black/[0.06] dark:bg-white/10'}`}>{methodCount(m)}</span>
            </button>
          )
        })}
      </div>
        {slice.length === 0 && <Empty title="No depreciable assets" desc={depreciable.length ? 'Adjust your search or filters.' : 'Assets need a purchase cost to appear here.'} />}

        {view === 'list' && slice.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" title="Select all" checked={allSelected} onChange={toggleAll} className="size-4 cursor-pointer accent-orange-500" />
                  </th>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Useful Life</th>
                  <th className="px-4 py-3 text-right">Salvage Value</th>
                  <th className="px-4 py-3 text-right">Annual Depreciation</th>
                  <th className="px-4 py-3 text-right">Accumulated</th>
                  <th className="px-4 py-3 text-right">Book Value</th>
                  <th className="px-4 py-3">Start Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((a) => (
                  <tr key={a.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="w-10 px-4 py-3">
                      <input type="checkbox" title="Select for auto-generation" checked={selected.has(a.id)} onChange={() => toggleSel(a.id)} className="size-4 cursor-pointer accent-orange-500" />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" title="Open depreciation schedule" onClick={() => setViewing(a)} className="flex cursor-pointer items-center gap-3 text-left">
                        <AssetTile asset={a} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{a.name}</span>
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {a.tag}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3"><Badge tone={METHOD_TONE(methodOf(a))}>{METHOD_LABEL[methodOf(a)]}</Badge></td>
                    <td className="px-4 py-3 text-mist">{lifeOf(a)} years</td>
                    <td className="px-4 py-3 text-right text-mist">{formatGhsExact(salvageOf(a))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-rose-500">{formatGhsExact(annualOf(a))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-orange-500">{formatGhsExact(accumulatedOf(a))}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatGhsExact(bookOf(a))}</td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1.5 text-mist"><CalendarDays className="size-4 opacity-60" /> {startOf(a) || '—'}</span></td>
                    <td className="px-4 py-3"><Badge tone={isFully(a) ? 'amber' : 'lime'}>{isFully(a) ? 'Fully Dep.' : 'Active'}</Badge></td>
                    <td className="px-4 py-3">{actions(a)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && slice.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((a) => (
              <div key={a.id} className={`rounded-xl border p-4 transition ${selected.has(a.id) ? 'border-orange-500/60 bg-orange-500/[0.06]' : 'border-line'}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" title="Select for auto-generation" checked={selected.has(a.id)} onChange={() => toggleSel(a.id)} className="size-4 cursor-pointer accent-orange-500" />
                  <AssetTile asset={a} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{a.name}</p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {a.tag}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <Badge tone={METHOD_TONE(methodOf(a))}>{METHOD_LABEL[methodOf(a)]}</Badge>
                  <Badge tone={isFully(a) ? 'amber' : 'lime'}>{isFully(a) ? 'Fully Dep.' : 'Active'}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-mist">Annual</p><p className="font-semibold text-rose-500">{formatGhsExact(annualOf(a))}</p></div>
                  <div><p className="text-mist">Accum.</p><p className="font-semibold text-orange-500">{formatGhsExact(accumulatedOf(a))}</p></div>
                  <div><p className="text-mist">Book</p><p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatGhsExact(bookOf(a))}</p></div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-mist">{lifeOf(a)} yrs · start {startOf(a) || '—'}</span>
                  {actions(a)}
                </div>
              </div>
            ))}
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

      {/* ---- Auto-generate entries ---- */}
      <Modal open={genOpen} onClose={() => setGenOpen(false)} title="Auto-generate depreciation entries">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Posts one monthly depreciation entry per asset for the chosen period, using each asset's
            method (Straight Line, Declining Balance or Sum of Years). Assets that already have an auto entry for
            the period — or a zero charge — are skipped.
          </p>
          <p className="rounded-md bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
            Scope: {selected.size ? `${selected.size} selected asset${selected.size > 1 ? 's' : ''} (tick assets in the list to change)` : `all ${depreciable.length} depreciable assets — tick assets in the list to limit the run`}
          </p>
          <Field label="Period">
            <Input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
          </Field>
          {pendingGen.length ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-black/[0.04] text-left uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2 text-right">Charge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {pendingGen.map((p) => (
                    <tr key={p.asset.id}>
                      <td className="px-3 py-2 font-semibold">{p.asset.tag} — {p.asset.name}</td>
                      <td className="px-3 py-2 text-mist">{METHOD_LABEL[methodOf(p.asset)]}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatGhsExact(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg bg-black/[0.04] p-3 text-sm text-mist dark:bg-white/[0.05]">Nothing to generate for {genMonth} — every depreciable asset already has an entry or a zero charge.</p>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-mist">{pendingGen.length} entr{pendingGen.length === 1 ? 'y' : 'ies'}</span>
            <span className="font-bold">{formatGhsExact(pendingTotal)}</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={doGenerate} disabled={!pendingGen.length}><Sparkles className="size-4" /> Generate</Button>
          </div>
        </div>
      </Modal>

      {/* ---- Manual save depreciation ---- */}
      <Modal open={!!manual} onClose={() => setManual(null)} title={manual?.id ? 'Edit Depreciation' : 'Save Depreciation'}>
        {manual && (
          <div className="space-y-3">
            <p className="text-sm text-mist">{manual.id ? 'Update this recorded depreciation entry.' : 'Record a depreciation charge manually against an asset.'}</p>
            <Field label="Asset" required>
              <Select value={manual.assetId} onChange={(e) => setManual({ ...manual, assetId: e.target.value })}>
                <option value="">Select asset…</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" required>
                <Input type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
              </Field>
              <Field label="Method">
                <Select value={manual.method} onChange={(e) => setManual({ ...manual, method: e.target.value as DepreciationMethod })}>
                  {DEPRECIATION_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Amount (GHS)" required
              hint={manual.method !== 'manual' && manual.assetId ? `Auto-calculated due depreciation (${METHOD_LABEL[manual.method]}) as of ${manual.date} — you can edit it.` : undefined}>
              <Input type="number" min={0} step="0.01" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} placeholder="0.00" />
            </Field>
            <Field label="Notes">
              <textarea value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} rows={2} className="w-full rounded-md border border-line bg-transparent px-3 py-2 text-sm outline-none transition focus:border-orange-500" placeholder="Reason for the charge or adjustment…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setManual(null)}>Cancel</Button>
              <Button onClick={saveManual}><Save className="size-4" /> Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Edit per-asset depreciation parameters ---- */}
      {params && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setParams(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">Depreciation Parameters</h2>
                <p className="mt-1 text-sm text-mist">{assets.find((x) => x.id === params.assetId)?.name}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setParams(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Method</label>
                <Select value={params.method} onChange={(e) => setParams({ ...params, method: e.target.value as DepreciationMethod })}>
                  {(Object.keys(METHOD_LABEL) as DepreciationMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Useful Life (years)</label>
                  <Input type="number" min={1} value={params.life} onChange={(e) => setParams({ ...params, life: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Salvage Value (GHS)</label>
                  <Input type="number" min={0} value={params.salvage} onChange={(e) => setParams({ ...params, salvage: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Start Date</label>
                <Input type="date" value={params.start} onChange={(e) => setParams({ ...params, start: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setParams(null)}>Cancel</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveParams}>Save Changes</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Remove from tracking ---- */}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove from depreciation tracking?">
        {removing && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Stop tracking depreciation for <span className="font-semibold text-inherit">{removing.tag} — {removing.name}</span>? Its purchase cost and depreciation parameters will be cleared, and it will leave this page. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
              <Button variant="danger" onClick={doRemove}>Remove</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- Printable schedule ---- */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? `${viewing.tag} — depreciation schedule` : 'Schedule'} wide>
        {viewing && (() => {
          const c = viewing.purchaseCost || 0
          const schedule = depreciationSchedule(c, viewing.purchaseDate || '', lifeOf(viewing), c ? Math.round((salvageOf(viewing) / c) * 100) : 0, methodOf(viewing))
          return (
            <div className="space-y-3">
              <div id="dep-print" className="rounded-xl bg-white p-6 text-sm text-zinc-900">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold">{company.name}</p>
                    <p className="text-xs text-zinc-500">{company.address}</p>
                    <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold uppercase tracking-wide">Depreciation schedule</p>
                    <p className="font-mono text-xs text-zinc-500">{viewing.tag}</p>
                    <p className="mt-1 text-xs text-zinc-500">{viewing.name}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-4">
                  {[
                    ['Category', viewing.category],
                    ['Start', startOf(viewing) ? formatDate(startOf(viewing)) : '—'],
                    ['Cost', formatGhsExact(c)],
                    ['Method', METHOD_LABEL[methodOf(viewing)]],
                    ['Useful life', `${lifeOf(viewing)} years`],
                    ['Salvage value', formatGhsExact(salvageOf(viewing))],
                    ['Annual charge', formatGhsExact(annualOf(viewing))],
                    ['Book value', formatGhsExact(bookOf(viewing))],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{k}</p>
                      <p className="font-semibold">{v}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2 text-right">Opening value</th>
                        <th className="px-3 py-2 text-right">Depreciation</th>
                        <th className="px-3 py-2 text-right">Closing value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedule.map((r) => (
                        <tr key={r.year} className="border-t border-zinc-100">
                          <td className="px-3 py-2 font-semibold">{r.year}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.openingValue)}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.depreciation)}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(r.closingValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="no-print flex gap-2">
                <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
