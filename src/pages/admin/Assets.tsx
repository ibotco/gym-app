import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, Boxes, Wrench, Tag, MapPin, User, SlidersHorizontal, Info, ArrowRight, ArrowLeft, ChevronLeft, ChevronRight, Save, Mail, HelpCircle } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty, DatePicker, StatCard, SearchField, Switch } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import { visibleBranches } from '../../lib/accessScope'
import { ASSET_STATUSES, nextAssetTag, estimatedCurrentValue } from '../../lib/assets'
import { assetLocationPath, loadAssetLocations } from '../../lib/assetLocations'
import { DEPRECIATION_METHODS } from '../../lib/depreciation'
import { DataTable, type Column } from '../../components/DataTable'
import type { Asset, AssetKind, AssetStatus, DepreciationMethod } from '../../types'

type FormState = {
  id?: string
  tag: string
  name: string
  category: string
  assetType: AssetKind
  qty: string
  orderNumber: string
  serialNumber: string
  status: AssetStatus
  condition: string
  location: string
  assignedTo: string
  purchaseDate: string
  purchaseCost: string
  currentValue: string
  salvageValue: string
  depreciationStart: string
  depreciationMethod: DepreciationMethod
  usefulLifeYears: string
  assetAccountId: string
  depreciationExpenseAccountId: string
  accumulatedDepreciationAccountId: string
  warrantyExpiry: string
  warrantyProvider: string
  billingInterval: string
  renewalDate: string
  autoRenew: boolean
  notes: string
}

const BILLING_INTERVALS: { id: NonNullable<Asset['billingInterval']>; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annually', label: 'Annually' },
  { id: 'one_time', label: 'One-time' },
]

const blank = (tag: string, category = '', assetType: AssetKind = 'asset'): FormState => ({
  tag, name: '', category, assetType, qty: '1', orderNumber: '', serialNumber: '', status: 'in_use',
  condition: '', location: '', assignedTo: '', purchaseDate: '', purchaseCost: '',
  currentValue: '', salvageValue: '', depreciationStart: '', depreciationMethod: 'straight_line',
  usefulLifeYears: '', assetAccountId: 'ac_59', depreciationExpenseAccountId: 'ac_100',
  accumulatedDepreciationAccountId: 'ac_5', warrantyExpiry: '', warrantyProvider: '', billingInterval: 'annually', renewalDate: '', autoRenew: false, notes: '',
})

function statusTone(s: AssetStatus): 'lime' | 'sky' | 'amber' | 'rose' | 'zinc' {
  if (s === 'in_use') return 'lime'
  if (s === 'available') return 'sky'
  if (s === 'maintenance') return 'amber'
  if (s === 'disposed' || s === 'written_off') return 'rose'
  return 'zinc'
}

const hueOf = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

/** Category-tinted tile carrying the asset's initial (image stand-in for the register list). */
function AssetGlyph({ a }: { a: Asset }) {
  const hue = hueOf(a.category)
  return (
    <span
      className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-line text-sm font-bold"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 88%), hsl(${(hue + 40) % 360} 55% 74%))`, color: `hsl(${hue} 50% 25%)` }}
      title={a.category}
    >
      {a.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

const REG_TABS: { id: AssetKind; label: string }[] = [
  { id: 'asset', label: 'Assets' },
  { id: 'component', label: 'Components' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'consumable', label: 'Consumables' },
  { id: 'license', label: 'Licenses' },
]
const kindOf = (a: Asset): AssetKind => a.assetType ?? 'asset'

function conditionTone(c: string): 'lime' | 'sky' | 'amber' | 'rose' {
  const v = c.toLowerCase()
  if (v === 'excellent') return 'lime'
  if (v === 'good') return 'sky'
  if (v === 'fair') return 'amber'
  return 'rose'
}

export function Assets() {
  const app = useApp()
  const { assets, upsertAsset, deleteAsset, log, company, branches, assetCategories, assetKindCategories, assetConditions, accounts, users } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')
  const branchOptions = visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Asset | null>(null)
  const [viewing, setViewing] = useState<Asset | null>(null)

  // ---- Kind registers (components / accessories / consumables / licenses) ----
  const [regTab, setRegTab] = useState<AssetKind>('asset')
  const [stockQ, setStockQ] = useState('')
  const [stockPerPage, setStockPerPage] = useState(5)
  const [stockPage, setStockPage] = useState(1)
  const [stockSel, setStockSel] = useState<Set<string>>(new Set())
  const [checkoutFor, setCheckoutFor] = useState<Asset | null>(null)
  const [coForm, setCoForm] = useState({ kind: 'employee' as 'employee' | 'location', employeeId: '', locationPath: '', qty: '1', date: new Date().toISOString().slice(0, 10), expectedReturn: '', notes: '', emailNotes: '', skipEmail: false })
  const [emailPreview, setEmailPreview] = useState(false)
  const [checkinFor, setCheckinFor] = useState<Asset | null>(null)
  const [ciForm, setCiForm] = useState({ qty: '1', date: new Date().toISOString().slice(0, 10), location: '', condition: '', notes: '', emailNotes: '', skipEmail: false })
  const [ciEmailPreview, setCiEmailPreview] = useState(false)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...assets]
      .filter((a) => {
        if (kindOf(a) !== 'asset') return false
        if (statusFilter && a.status !== statusFilter) return false
        if (categoryFilter && a.category !== categoryFilter) return false
        if (!ql) return true
        return (
          a.tag.toLowerCase().includes(ql) ||
          a.name.toLowerCase().includes(ql) ||
          a.category.toLowerCase().includes(ql) ||
          a.location.toLowerCase().includes(ql) ||
          (a.assignedTo || '').toLowerCase().includes(ql) ||
          (a.serialNumber || '').toLowerCase().includes(ql)
        )
      })
      .sort((a, b) => a.tag.localeCompare(b.tag))
  }, [assets, q, statusFilter, categoryFilter])

  const totalValue = assets.reduce((s, a) => s + (a.currentValue ?? a.purchaseCost ?? 0), 0)
  const inMaintenance = assets.filter((a) => a.status === 'maintenance').length
  const available = assets.filter((a) => a.status === 'available').length
  const inUse = assets.filter((a) => a.status === 'in_use').length

  const assetColumns: Column<Asset>[] = [
    { key: 'tag', header: 'Tag', sortValue: (a) => a.tag, render: (a) => <span className="font-mono text-sm font-bold">{a.tag}</span> },
    {
      key: 'name', header: 'Asset', sortValue: (a) => a.name,
      render: (a) => (
        <span className="flex items-center gap-3">
          <AssetGlyph a={a} />
          <span>
            <span className="block font-semibold">{a.name}</span>
            {a.serialNumber && <span className="block text-xs text-mist">S/N {a.serialNumber}</span>}
          </span>
        </span>
      ),
    },
    { key: 'category', header: 'Category', sortValue: (a) => a.category, render: (a) => <span className="text-mist">{a.category}</span> },
    { key: 'location', header: 'Location', sortValue: (a) => a.location, render: (a) => <span className="text-mist">{a.location}</span> },
    { key: 'assigned', header: 'Assigned to', sortValue: (a) => a.assignedTo || '', render: (a) => <span className="text-mist">{a.assignedTo || '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (a) => a.status, render: (a) => <Badge tone={statusTone(a.status)}>{ASSET_STATUSES.find((s) => s.id === a.status)?.label || a.status}</Badge> },
    { key: 'condition', header: 'Condition', sortValue: (a) => a.condition, render: (a) => <Badge tone={conditionTone(a.condition)}>{a.condition}</Badge> },
    { key: 'value', header: 'Value', sortValue: (a) => a.currentValue ?? a.purchaseCost ?? 0, align: 'right', render: (a) => <span className="font-semibold">{formatGhs(a.currentValue ?? a.purchaseCost ?? 0)}</span> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (a) => (
        <span className="whitespace-nowrap">
          <button className="rounded-lg p-2 text-mist hover:text-lime" title="View asset" onClick={() => setViewing(a)}><Printer className="size-4" /></button>
          {canManage && (
            <>
              <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit asset" onClick={() => openEdit(a)}><Pencil className="size-4" /></button>
              <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete asset" onClick={() => setDeleting(a)}><Trash2 className="size-4" /></button>
            </>
          )}
        </span>
      ),
    },
  ]

  /** Categories are scoped per asset type: fixed assets use Asset Categories, the other kinds use their own lists. */
  const categoryOptionsFor = (kind: AssetKind): string[] => kind === 'asset' ? assetCategories : assetKindCategories[kind]

  const openNew = () => setEditing(blank(nextAssetTag(assets), categoryOptionsFor(regTab)[0] || '', regTab))
  const openEdit = (a: Asset) => setEditing({
    id: a.id, tag: a.tag, name: a.name, category: a.category,
    assetType: kindOf(a), qty: String(a.qty ?? 1), orderNumber: a.orderNumber || '',
    billingInterval: a.billingInterval || 'annually', renewalDate: a.renewalDate || '', autoRenew: !!a.autoRenew,
    serialNumber: a.serialNumber || '', status: a.status, condition: a.condition,
    location: a.location, assignedTo: a.assignedTo || '',
    purchaseDate: a.purchaseDate || '', purchaseCost: a.purchaseCost != null ? String(a.purchaseCost) : '',
    currentValue: a.currentValue != null ? String(a.currentValue) : '',
    salvageValue: a.salvageValue != null ? String(a.salvageValue) : '',
    depreciationStart: a.depreciationStart || '',
    depreciationMethod: a.depreciationMethod || 'straight_line',
    usefulLifeYears: a.usefulLifeYears != null ? String(a.usefulLifeYears) : '',
    assetAccountId: a.assetAccountId || '',
    depreciationExpenseAccountId: a.depreciationExpenseAccountId || '',
    accumulatedDepreciationAccountId: a.accumulatedDepreciationAccountId || '',
    warrantyExpiry: a.warrantyExpiry || '', warrantyProvider: a.warrantyProvider || '', notes: a.notes || '',
  })

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter an asset name.'); return }
    if (!editing.tag.trim()) { toast.error('Enter an asset tag.'); return }
    const clash = assets.some((a) => a.tag.toLowerCase() === editing.tag.trim().toLowerCase() && a.id !== editing.id)
    if (clash) { toast.error('That asset tag already exists.'); return }

    const isNew = !editing.id
    const prev = assets.find((a) => a.id === editing.id)
    const selectedBranch = branchOptions.find((branch) => editing.location === `${branch.city} — ${branch.name}`)
    // Fixed-asset (type "asset") records require the full capitalisation detail;
    // components / accessories / consumables / licenses only need the basics.
    const isFixed = editing.assetType === 'asset'
    const purchaseCost = editing.purchaseCost ? Number(editing.purchaseCost) : undefined
    const usefulLife = editing.usefulLifeYears ? Number(editing.usefulLifeYears) : 0
    const salvageValue = editing.salvageValue !== '' ? Number(editing.salvageValue) : 0
    if (isFixed) {
      if (!purchaseCost || purchaseCost <= 0) { toast.error('Enter the purchase price.'); return }
      if (!editing.depreciationStart) { toast.error('Select the depreciation start date.'); return }
      if (!usefulLife || usefulLife <= 0) { toast.error('Enter the useful life in years.'); return }
      if (!editing.assetAccountId) { toast.error('Select the asset account.'); return }
      if (!editing.depreciationExpenseAccountId) { toast.error('Select the depreciation expense account.'); return }
      if (!editing.accumulatedDepreciationAccountId) { toast.error('Select the accumulated depreciation account.'); return }
      if (salvageValue < 0 || (purchaseCost && salvageValue >= purchaseCost)) { toast.error('Salvage value must be between 0 and the purchase price.'); return }
    }
    const rec: Asset = {
      id: editing.id || uid('ast'),
      companyId: selectedBranch?.companyId || prev?.companyId,
      branchId: selectedBranch?.id || prev?.branchId,
      tag: editing.tag.trim().toUpperCase(),
      name: editing.name.trim(),
      category: editing.category,
      assetType: editing.assetType,
      qty: isFixed ? undefined : Math.max(1, Number(editing.qty) || 1),
      checkedOut: prev?.checkedOut,
      orderNumber: editing.orderNumber.trim() || undefined,
      billingInterval: editing.assetType === 'license' ? (editing.billingInterval as Asset['billingInterval']) : undefined,
      renewalDate: editing.assetType === 'license' ? (editing.renewalDate || undefined) : undefined,
      autoRenew: editing.assetType === 'license' ? editing.autoRenew : undefined,
      serialNumber: editing.serialNumber.trim() || undefined,
      status: editing.status,
      condition: editing.condition,
      location: editing.location.trim() || '—',
      assignedTo: editing.assignedTo.trim() || undefined,
      purchaseDate: editing.purchaseDate || undefined,
      purchaseCost,
      currentValue: editing.currentValue ? Number(editing.currentValue) : undefined,
      salvageValue: editing.salvageValue !== '' ? Number(editing.salvageValue) : undefined,
      depreciationStart: editing.depreciationStart || undefined,
      depreciationMethod: editing.depreciationMethod,
      usefulLifeYears: usefulLife || undefined,
      assetAccountId: editing.assetAccountId || undefined,
      depreciationExpenseAccountId: editing.depreciationExpenseAccountId || undefined,
      accumulatedDepreciationAccountId: editing.accumulatedDepreciationAccountId || undefined,
      warrantyExpiry: editing.warrantyExpiry || undefined,
      warrantyProvider: editing.warrantyProvider || undefined,
      notes: editing.notes.trim() || undefined,
      createdAt: prev?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    upsertAsset(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Asset', `${isNew ? 'Created' : 'Updated'} ${rec.tag} — ${rec.name}`)
    toast.success(isNew ? 'Asset created' : 'Asset updated', rec.tag)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteAsset(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Asset', `Deleted ${deleting.tag} — ${deleting.name}`)
    toast.success('Asset deleted', deleting.tag)
    setDeleting(null)
  }

  const exportRows = rows.map((a) => ({
    tag: a.tag, name: a.name, category: a.category, serialNumber: a.serialNumber || '',
    status: a.status, condition: a.condition, location: a.location, assignedTo: a.assignedTo || '',
    purchaseDate: a.purchaseDate || '', purchaseCost: a.purchaseCost ?? '', currentValue: a.currentValue ?? '',
    warrantyExpiry: a.warrantyExpiry || '',
  }))

  // ---- Kind register handlers (same store as Assets; tabs filter by asset type) ----
  const activeTabLabel = REG_TABS.find((t) => t.id === regTab)?.label || ''
  const stockRows = useMemo(() => {
    const ql = stockQ.trim().toLowerCase()
    return assets.filter((a) => kindOf(a) === regTab && (!ql || `${a.name} ${a.tag} ${a.assignedTo || ''} ${a.orderNumber || ''} ${a.serialNumber || ''} ${a.category}`.toLowerCase().includes(ql)))
  }, [assets, regTab, stockQ])
  const stockPages = Math.max(1, Math.ceil(stockRows.length / stockPerPage))
  const stockCur = Math.min(stockPage, stockPages)
  const stockSlice = stockRows.slice((stockCur - 1) * stockPerPage, stockCur * stockPerPage)

  // ---- Canonical locations (Asset setup → Asset location) ----
  const setupLocations = useMemo(() => loadAssetLocations(), [])
  const setupLocationOptions = useMemo(() => setupLocations.filter((l) => l.status === 'active')
    .map((l) => { const p = assetLocationPath(l, setupLocations); return { value: p, label: `${p} · ${l.type}` } })
    .sort((a, b) => a.value.localeCompare(b.value)), [setupLocations])

  const openCheckout = (a: Asset) => {
    setCheckoutFor(a)
    setCoForm({ kind: 'employee', employeeId: '', locationPath: '', qty: '1', date: new Date().toISOString().slice(0, 10), expectedReturn: '', notes: '', emailNotes: '', skipEmail: false })
  }

  const coTarget = () => {
    if (coForm.kind === 'employee') {
      const u = users.find((x) => x.id === coForm.employeeId)
      return u ? { name: u.name, email: u.email } : null
    }
    return coForm.locationPath ? { name: coForm.locationPath, email: '' } : null
  }

  const doCheckout = () => {
    if (!checkoutFor) return
    const remaining = (checkoutFor.qty ?? 1) - (checkoutFor.checkedOut ?? 0)
    const n = Number(coForm.qty)
    if (!Number.isInteger(n) || n < 1) { toast.error('Enter a quantity of at least 1.'); return }
    if (n > remaining) { toast.error(`Only ${remaining} unit(s) available to check out.`); return }
    if (!coForm.date) { toast.error('Select a checkout date.'); return }
    const target = coTarget()
    if (!target) { toast.error(coForm.kind === 'employee' ? 'Select an employee.' : 'Select a location.'); return }

    upsertAsset({
      ...checkoutFor,
      checkedOut: (checkoutFor.checkedOut ?? 0) + n,
      assignedTo: target.name,
      status: 'in_use',
      checkoutDate: coForm.date,
      expectedReturn: coForm.expectedReturn || undefined,
      checkoutNotes: coForm.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    })
    if (!coForm.skipEmail) {
      log(user?.id || 'system', 'UPDATE', 'Asset', `Checkout confirmation emailed to ${target.name}${target.email ? ` (${target.email})` : ''} — ${checkoutFor.name} ×${n}`)
      toast.success('Checked out', `Confirmation email sent to ${target.name}`)
    } else {
      toast.success('Checked out', `${checkoutFor.name} ×${n} → ${target.name}`)
    }
    setCheckoutFor(null)
  }

  const openCheckin = (a: Asset) => {
    if (kindOf(a) !== 'component' && kindOf(a) !== 'accessory') { toast.error('Only components and accessories are checked back in.'); return }
    setCheckinFor(a)
    setCiForm({ qty: '1', date: new Date().toISOString().slice(0, 10), location: a.location || '', condition: a.condition || '', notes: '', emailNotes: '', skipEmail: false })
  }

  const ciCustodian = () => {
    if (!checkinFor?.assignedTo) return null
    const u = users.find((x) => x.name === checkinFor.assignedTo)
    return { name: checkinFor.assignedTo, email: u?.email || '' }
  }

  const doCheckin = () => {
    if (!checkinFor) return
    const out = checkinFor.checkedOut ?? 0
    const n = Number(ciForm.qty)
    if (!Number.isInteger(n) || n < 1) { toast.error('Enter a quantity of at least 1.'); return }
    if (n > out) { toast.error(`Only ${out} unit(s) are checked out.`); return }
    if (!ciForm.date) { toast.error('Select a checkin date.'); return }
    const newOut = Math.max(0, out - n)
    const custodian = checkinFor.assignedTo

    upsertAsset({
      ...checkinFor,
      checkedOut: newOut,
      location: ciForm.location.trim() || checkinFor.location,
      condition: ciForm.condition || checkinFor.condition,
      status: newOut === 0 ? 'available' : checkinFor.status,
      assignedTo: newOut === 0 ? undefined : checkinFor.assignedTo,
      checkoutDate: newOut === 0 ? undefined : checkinFor.checkoutDate,
      expectedReturn: newOut === 0 ? undefined : checkinFor.expectedReturn,
      checkoutNotes: newOut === 0 ? undefined : checkinFor.checkoutNotes,
      checkinDate: ciForm.date,
      checkinNotes: ciForm.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    })
    if (!ciForm.skipEmail) {
      const c = ciCustodian()
      log(user?.id || 'system', 'UPDATE', 'Asset', `Checkin confirmation emailed to ${c?.name || 'custodian'}${c?.email ? ` (${c.email})` : ''} — ${checkinFor.name} ×${n}`)
      toast.success('Checked in', `Confirmation email sent to ${c?.name || custodian || 'custodian'}`)
    } else {
      toast.success('Checked in', `${checkinFor.name} ×${n} returned`)
    }
    setCheckinFor(null)
  }

  const toggleStockSel = (id: string) => setStockSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div>
      <PageHeader
        title="Assets"
        desc="Track gym equipment, furniture, and fixed assets across your clubs — status, condition, value, and custodian."
      />

      {/* ---- Register tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {REG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRegTab(t.id)}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition ${regTab === t.id ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#2c4a77] hover:bg-[#243d63]'}`}
          >
            {t.label}
          </button>
        ))}
        <ExportButtons
          filename="assets"
          rows={exportRows}
          compact
          className="ml-auto self-center"
          onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked', 'Use a different browser or check downloads.')}
        />
      </div>

      {regTab === 'asset' && (<>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total assets" value={String(assets.length)} icon={<Boxes className="size-4" />} hint={`${inUse} in use`} />
        <StatCard label="Book value" value={formatGhs(totalValue)} icon={<Tag className="size-4" />} hint="current value" />
        <StatCard label="Available" value={String(available)} icon={<User className="size-4" />} hint="ready to assign" />
        <StatCard label="Maintenance" value={String(inMaintenance)} icon={<Wrench className="size-4" />} hint="needs attention" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search tag, name, location…" className="w-full max-w-sm" />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All statuses</option>
          {ASSET_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All categories</option>
          {assetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {canManage && (
          <Button className="ml-auto bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}>
            <Plus className="size-4" /> New Asset
          </Button>
        )}
      </div>

      <div className="card">
        <DataTable
          columns={assetColumns}
          data={rows}
          rowKey={(a) => a.id}
          emptyTitle="No assets found"
          emptyDesc={assets.length ? 'Adjust your search or filters.' : 'Create your first asset with the New button.'}
        />
      </div>
      </>)}

      {/* ---- Stock registers (components / accessories / consumables / licenses) ---- */}
      {regTab !== 'asset' && (
        <div className="card rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold"><SlidersHorizontal className="size-5" /> Asset Register - {activeTabLabel}</h2>
            {canManage && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}>
                <Plus className="size-4" /> Add
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-mist">
              Show
              <Select value={String(stockPerPage)} onChange={(e) => { setStockPerPage(Number(e.target.value)); setStockPage(1) }} className="w-20">
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </Select>
              entries
            </label>
            <div className="ml-auto flex items-center gap-2 text-sm text-mist">
              Search:
              <Input value={stockQ} onChange={(e) => { setStockQ(e.target.value); setStockPage(1) }} className="w-48" />
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="px-3 py-3">No.</th>
                  <th className="px-3 py-3">Name of Asset</th>
                  <th className="px-3 py-3">Available</th>
                  <th className="px-3 py-3">Checkout</th>
                  {regTab === 'component' && <th className="px-3 py-3">Checkin</th>}
                  {regTab === 'accessory' && <th className="px-3 py-3">Checkin</th>}
                  {regTab === 'license' && (
                    <>
                      <th className="px-3 py-3">Billing Interval</th>
                      <th className="px-3 py-3">Renewal Date</th>
                      <th className="px-3 py-3">Auto-renew</th>
                    </>
                  )}
                  <th className="px-3 py-3">PurDate</th>
                  <th className="px-3 py-3 text-right">Cost</th>
                  <th className="w-10 px-3 py-3"><input type="checkbox" title="Select all" className="size-4 cursor-pointer accent-blue-600" checked={stockSlice.length > 0 && stockSlice.every((r) => stockSel.has(r.id))} onChange={() => setStockSel((s) => { const n = new Set(s); const all = stockSlice.every((r) => n.has(r.id)); stockSlice.forEach((r) => { if (all) n.delete(r.id); else n.add(r.id) }); return n })} /></th>
                  <th className="px-3 py-3">Order Number</th>
                  <th className="px-3 py-3">Model</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stockSlice.map((r, i) => (
                  <tr key={r.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2">
                        <button type="button" title="Details" onClick={() => setCheckoutFor(r)} className="grid size-6 cursor-pointer place-items-center rounded-full border border-blue-500/50 bg-blue-500/15 text-blue-600 dark:text-blue-400"><Plus className="size-3.5" /></button>
                        {(stockCur - 1) * stockPerPage + i + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <AssetGlyph a={r} />
                        <div className="min-w-0">
                          <p className="truncate font-bold">{r.name}</p>
                          <p className="truncate text-xs text-mist">{r.assignedTo ? `${r.assignedTo} · ${users.find((u) => u.name === r.assignedTo)?.email || ''}` : r.tag}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex items-center gap-2 text-xs font-semibold">
                        {r.checkedOut ?? 0}/{r.qty ?? 1}
                        <span className="h-2 w-16 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                          <span className="block h-full rounded-full bg-purple-600" style={{ width: `${r.qty ? Math.round(((r.checkedOut ?? 0) / r.qty) * 100) : 0}%` }} />
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" title="Checkout" disabled={(r.checkedOut ?? 0) >= (r.qty ?? 1)} onClick={() => openCheckout(r)} className="cursor-pointer rounded-md bg-green-700 p-2 text-white transition enabled:hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="size-4" /></button>
                    </td>
                    {regTab === 'component' && (
                      <td className="px-3 py-3">
                        <button type="button" title="Checkin" disabled={(r.checkedOut ?? 0) <= 0} onClick={() => openCheckin(r)} className="cursor-pointer rounded-md bg-cyan-500 p-2 text-white transition enabled:hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="size-4" /></button>
                      </td>
                    )}
                    {regTab === 'accessory' && (
                      <td className="px-3 py-3">
                        <button type="button" title="Checkin" disabled={(r.checkedOut ?? 0) <= 0} onClick={() => openCheckin(r)} className="cursor-pointer rounded-md bg-cyan-500 p-2 text-white transition enabled:hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="size-4" /></button>
                      </td>
                    )}
                    {regTab === 'license' && (
                      <>
                        <td className="px-3 py-3 text-mist">{BILLING_INTERVALS.find((b) => b.id === r.billingInterval)?.label || '—'}</td>
                        <td className="px-3 py-3 text-mist">{r.renewalDate ? formatDate(r.renewalDate) : '—'}</td>
                        <td className="px-3 py-3">{r.autoRenew ? <Badge tone="lime">On</Badge> : <Badge tone="zinc">Off</Badge>}</td>
                      </>
                    )}
                    <td className="px-3 py-3 text-mist">{r.purchaseDate || '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold">{r.purchaseCost ? formatGhs(r.purchaseCost) : ''}</td>
                    <td className="px-3 py-3"><input type="checkbox" title="Select" className="size-4 cursor-pointer accent-blue-600" checked={stockSel.has(r.id)} onChange={() => toggleStockSel(r.id)} /></td>
                    <td className="px-3 py-3 text-mist">{r.orderNumber || '—'}</td>
                    <td className="px-3 py-3 text-mist">{r.serialNumber || '—'}</td>
                    <td className="px-3 py-3 text-mist">{REG_TABS.find((t) => t.id === kindOf(r))?.label || kindOf(r)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage && <button type="button" title="Edit" onClick={() => openEdit(r)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><Pencil className="size-4" /></button>}
                        {canManage && <button type="button" title="Delete" onClick={() => setDeleting(r)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!stockSlice.length && (
                  <tr><td colSpan={12} className="px-3 py-8 text-center text-sm text-mist">No {activeTabLabel.toLowerCase()} found. Use Add to create one.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-mist">
            <span>Showing {stockRows.length === 0 ? 0 : (stockCur - 1) * stockPerPage + 1} to {Math.min(stockCur * stockPerPage, stockRows.length)} of {stockRows.length} entries</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={stockCur === 1} onClick={() => setStockPage(stockCur - 1)} className="cursor-pointer rounded-md border border-line p-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"><ChevronLeft className="size-4" /></button>
              {Array.from({ length: stockPages }, (_, i) => i + 1).map((p) => (
                <button key={p} type="button" onClick={() => setStockPage(p)} className={`h-8 w-8 cursor-pointer rounded-md text-sm font-medium transition ${p === stockCur ? 'bg-[#2c4a77] text-white' : 'border border-line hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'}`}>{p}</button>
              ))}
              <button type="button" disabled={stockCur === stockPages} onClick={() => setStockPage(stockCur + 1)} className="cursor-pointer rounded-md border border-line p-1.5 transition enabled:hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50 dark:enabled:hover:bg-white/[0.06]"><ChevronRight className="size-4" /></button>
            </div>
          </div>
        </div>
      )}

      {/* View / print */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.tag || 'Asset'} wide>
        {viewing && (
          <div className="space-y-3">
            <div id="asset-print" className="rounded-xl bg-white p-6 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Asset record</p>
                  <p className="font-mono text-xs text-zinc-500">{viewing.tag}</p>
                  <p className="mt-1 text-xs text-zinc-500">Updated {formatDate(viewing.updatedAt)}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3">
                {[
                  ['Name', viewing.name],
                  ['Category', viewing.category],
                  ['Serial number', viewing.serialNumber || '—'],
                  ['Location', viewing.location],
                  ['Assigned to', viewing.assignedTo || '—'],
                  ['Status', ASSET_STATUSES.find((s) => s.id === viewing.status)?.label || viewing.status],
                  ['Condition', viewing.condition],
                  ['Purchase date', viewing.purchaseDate ? formatDate(viewing.purchaseDate) : '—'],
                  ['Purchase cost', viewing.purchaseCost != null ? formatGhsExact(viewing.purchaseCost) : '—'],
                  ['Current value', viewing.currentValue != null ? formatGhsExact(viewing.currentValue) : '—'],
                  ['Warranty until', viewing.warrantyExpiry ? formatDate(viewing.warrantyExpiry) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-zinc-100 py-1.5">
                    <span className="text-xs uppercase tracking-wide text-zinc-400">{k}</span>
                    <span className="text-xs font-semibold">{v}</span>
                  </div>
                ))}
              </div>

              {viewing.notes && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Notes</p>
                  <p className="mt-1 text-xs text-zinc-600">{viewing.notes}</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-3">
                <p className="text-[10px] text-zinc-400">Generated by {company.name} asset register</p>
                <MapPin className="size-4 text-zinc-300" />
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit asset' : 'New asset'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Asset tag" required>
                <Input value={editing.tag} onChange={(e) => setEditing({ ...editing, tag: e.target.value.toUpperCase() })} className="font-mono" />
              </Field>
              <Field label="Name" required>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Treadmill — Life Fitness T3" />
              </Field>
              <Field label={editing.assetType === 'asset' ? 'Asset Category' : 'Category'}>
                <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {editing.category && !categoryOptionsFor(editing.assetType ?? 'asset').includes(editing.category) && (
                    <option value={editing.category}>{editing.category}</option>
                  )}
                  {categoryOptionsFor(editing.assetType ?? 'asset').map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Asset type">
                <Select value={editing.assetType} onChange={(e) => setEditing({ ...editing, assetType: e.target.value as AssetKind })}>
                  {REG_TABS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              {editing.assetType !== 'asset' && (
                <>
                  <Field label="Quantity">
                    <Input type="number" min={1} value={editing.qty} onChange={(e) => setEditing({ ...editing, qty: e.target.value })} />
                  </Field>
                  <Field label="Order number">
                    <Input value={editing.orderNumber} onChange={(e) => setEditing({ ...editing, orderNumber: e.target.value })} placeholder="e.g. ORD-1103" className="font-mono" />
                  </Field>
                </>
              )}
              {editing.assetType === 'license' && (
                <>
                  <Field label="Billing Interval">
                    <Select value={editing.billingInterval} onChange={(e) => setEditing({ ...editing, billingInterval: e.target.value })}>
                      {BILLING_INTERVALS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Renewal Date"><DatePicker value={editing.renewalDate} onChange={(v) => setEditing({ ...editing, renewalDate: v })} /></Field>
                  <label className="flex items-center gap-2 self-center text-sm font-medium">
                    <Switch checked={editing.autoRenew} onChange={(v) => setEditing({ ...editing, autoRenew: v })} aria-label="Auto-renew" />
                    Auto-renew
                  </label>
                </>
              )}
              <Field label="Serial number">
                <Input value={editing.serialNumber} onChange={(e) => setEditing({ ...editing, serialNumber: e.target.value })} placeholder="Optional" className="font-mono" />
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as AssetStatus })}>
                  {ASSET_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Condition">
                <Select value={editing.condition} onChange={(e) => setEditing({ ...editing, condition: e.target.value })}>
                  <option value="">Select condition…</option>
                  {assetConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Location" required>
                <Select value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })}>
                  <option value="">Select location…</option>
                  {branchOptions.map((b) => <option key={b.id} value={`${b.city} — ${b.name}`}>{b.city} — {b.name}</option>)}
                </Select>
              </Field>
              <Field label="Assigned to">
                <Input value={editing.assignedTo} onChange={(e) => setEditing({ ...editing, assignedTo: e.target.value })} placeholder="Custodian or desk" />
              </Field>
              <Field label="Purchase date"><DatePicker value={editing.purchaseDate} onChange={(v) => setEditing({ ...editing, purchaseDate: v })} /></Field>
              <Field label="Warranty expiry"><DatePicker value={editing.warrantyExpiry} onChange={(v) => setEditing({ ...editing, warrantyExpiry: v })} /></Field>
              <Field label="Warranty provider"><Input value={editing.warrantyProvider} onChange={(e) => setEditing({ ...editing, warrantyProvider: e.target.value })} placeholder="Manufacturer / service agent" /></Field>
              <Field label="Current value (GHS)">
                <Input type="number" min={0} value={editing.currentValue} onChange={(e) => setEditing({ ...editing, currentValue: e.target.value })} />
              </Field>
            </div>

            <div className="border-t border-line pt-3">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                Depreciation details
                <Info className="size-3.5 text-mist" aria-hidden />
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <Field label="Purchase price" required>
                  <Input type="number" min={0} step={0.01} className="text-right" value={editing.purchaseCost} onChange={(e) => setEditing({ ...editing, purchaseCost: e.target.value })} placeholder="0.00" />
                </Field>
                <Field label="Salvage value">
                  <Input type="number" min={0} step={0.01} className="text-right" value={editing.salvageValue} onChange={(e) => setEditing({ ...editing, salvageValue: e.target.value })} placeholder="0.00" />
                </Field>
                <Field label="Depreciation start date" required>
                  <DatePicker value={editing.depreciationStart} onChange={(v) => setEditing({ ...editing, depreciationStart: v })} />
                </Field>
                <Field label="Depreciation method" required>
                  <Select value={editing.depreciationMethod} onChange={(e) => setEditing({ ...editing, depreciationMethod: e.target.value as DepreciationMethod })}>
                    {DEPRECIATION_METHODS.filter((m) => m.id !== 'manual').map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </Select>
                </Field>
                <Field label="Useful life (years)" required>
                  <Input type="number" min={1} step={1} value={editing.usefulLifeYears} onChange={(e) => setEditing({ ...editing, usefulLifeYears: e.target.value })} placeholder="e.g. 5" />
                </Field>
              </div>
              <p className="mt-3 text-xs font-bold text-mist">Accounts details</p>
              <div className="mt-2 space-y-3">
                <Field label={<span className="inline-flex items-center gap-1">Asset account<Info className="size-3.5 text-mist" aria-hidden /></span>} required>
                  <Select value={editing.assetAccountId} onChange={(e) => setEditing({ ...editing, assetAccountId: e.target.value })}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>)}
                  </Select>
                </Field>
                <Field label={<span className="inline-flex items-center gap-1">Depreciation expense account<Info className="size-3.5 text-mist" aria-hidden /></span>} required>
                  <Select value={editing.depreciationExpenseAccountId} onChange={(e) => setEditing({ ...editing, depreciationExpenseAccountId: e.target.value })}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>)}
                  </Select>
                </Field>
                <Field label={<span className="inline-flex items-center gap-1">Accumulated depreciation account<Info className="size-3.5 text-mist" aria-hidden /></span>} required>
                  <Select value={editing.accumulatedDepreciationAccountId} onChange={(e) => setEditing({ ...editing, accumulatedDepreciationAccountId: e.target.value })}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>)}
                  </Select>
                </Field>
              </div>
            </div>

            {(() => {
              const cost = Number(editing.purchaseCost)
              const start = editing.depreciationStart || editing.purchaseDate
              const est = cost > 0 && start && Number(editing.usefulLifeYears) > 0
                ? estimatedCurrentValue({ cost, startDate: start, lifeYears: Number(editing.usefulLifeYears), salvage: Number(editing.salvageValue) || 0, method: editing.depreciationMethod })
                : null
              if (est == null || editing.currentValue) return null
              const methodLabel = DEPRECIATION_METHODS.find((m) => m.id === editing.depreciationMethod)?.label || 'Straight-line'
              return (
                <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-lime" /> Estimated current value</p>
                  <p className="mt-1 text-mist">
                    {methodLabel} depreciation over {editing.usefulLifeYears} years (salvage {formatGhs(Number(editing.salvageValue) || 0)}) suggests a current value of{' '}
                    <span className="font-semibold text-inherit">{formatGhs(est)}</span>.
                  </p>
                </div>
              )
            })()}

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Maintenance history, remarks…" /></Field>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save asset' : 'Create asset'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete asset?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete asset <span className="font-mono font-semibold text-inherit">{deleting.tag}</span> ({deleting.name})? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Checkout */}
      <Modal open={!!checkoutFor} onClose={() => setCheckoutFor(null)} title={`Checkout — ${checkoutFor?.name || ''}`} wide>
        {checkoutFor && (
          <div className="space-y-4">
            {/* Checkout to */}
            <div>
              <p className="mb-1.5 text-sm font-semibold">Checkout to <span className="text-rose-500">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                {(['employee', 'location'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCoForm({ ...coForm, kind: k })}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${coForm.kind === k ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-line hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}
                  >
                    <span className={`grid size-4 flex-shrink-0 place-items-center rounded-full border-2 ${coForm.kind === k ? 'border-blue-600' : 'border-zinc-400'}`}>
                      {coForm.kind === k && <span className="size-1.5 rounded-full bg-blue-600" />}
                    </span>
                    {k === 'employee' ? <User className="size-4" /> : <MapPin className="size-4" />} {k === 'employee' ? 'Employee' : 'Location'}
                  </button>
                ))}
              </div>
            </div>

            {coForm.kind === 'employee' ? (
              <Field label="Employee" required>
                <Select value={coForm.employeeId} onChange={(e) => setCoForm({ ...coForm, employeeId: e.target.value })}>
                  <option value="">Select employee…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Location" required>
                <Select value={coForm.locationPath} onChange={(e) => setCoForm({ ...coForm, locationPath: e.target.value })}>
                  <option value="">Select location…</option>
                  {setupLocationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            )}

            <Field label={<span>Quantity <span className="ml-1 font-normal text-mist">(Remaining: {(checkoutFor.qty ?? 1) - (checkoutFor.checkedOut ?? 0)})</span></span>} required>
              <Input type="number" min={1} max={(checkoutFor.qty ?? 1) - (checkoutFor.checkedOut ?? 0)} value={coForm.qty} onChange={(e) => setCoForm({ ...coForm, qty: e.target.value })} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Checkout Date" required><DatePicker value={coForm.date} onChange={(v) => setCoForm({ ...coForm, date: v })} /></Field>
              <Field label="Expected Return Date"><DatePicker value={coForm.expectedReturn} onChange={(v) => setCoForm({ ...coForm, expectedReturn: v })} /></Field>
            </div>

            <Field label="Notes"><Textarea value={coForm.notes} onChange={(e) => setCoForm({ ...coForm, notes: e.target.value })} rows={2} placeholder="Notes" /></Field>

            <p className="flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-500/25 px-3 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              <Mail className="size-4 flex-shrink-0" />
              <span>The {coForm.kind === 'employee' ? 'employee' : 'location'} will be emailed a confirmation of the checkout, please <button type="button" className="cursor-pointer font-bold underline" onClick={() => setEmailPreview(true)}>click here to preview</button>.</span>
            </p>

            <Field label={<span className="inline-flex items-center gap-1">Confirmation Email Notes<HelpCircle className="size-3.5 text-mist" aria-hidden /></span>}>
              <Textarea value={coForm.emailNotes} onChange={(e) => setCoForm({ ...coForm, emailNotes: e.target.value })} rows={2} placeholder="Confirmation Email Notes" />
            </Field>

            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={coForm.skipEmail} onChange={(v) => setCoForm({ ...coForm, skipEmail: v })} aria-label="Skip checkout confirmation email" />
              <span className="inline-flex items-center gap-1">Skip Checkout Confirmation Email <HelpCircle className="size-3.5 text-mist" aria-hidden /></span>
            </label>

            <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={doCheckout}><Save className="size-4" /> Save</Button>
          </div>
        )}
      </Modal>

      {/* Checkout confirmation email preview */}
      <Modal open={emailPreview} onClose={() => setEmailPreview(false)} title="Checkout confirmation email — preview" wide>
        {checkoutFor && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-line p-3 text-xs text-mist">
              <p><span className="font-bold">To:</span> {coTarget()?.name || '—'}{coTarget()?.email ? ` <${coTarget()?.email}>` : coTarget() ? ' (location)' : ''}</p>
              <p><span className="font-bold">Subject:</span> Checkout confirmation — {checkoutFor.name}</p>
            </div>
            <div className="rounded-lg border border-line p-4 leading-relaxed">
              <p>Hello {coTarget()?.name || '—'},</p>
              <p className="mt-2">The following item has been checked out to you:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><span className="font-semibold">Asset:</span> {checkoutFor.tag} — {checkoutFor.name}</li>
                <li><span className="font-semibold">Quantity:</span> {coForm.qty || 1}</li>
                <li><span className="font-semibold">Checkout date:</span> {formatDate(coForm.date)}</li>
                {coForm.expectedReturn && <li><span className="font-semibold">Expected return:</span> {formatDate(coForm.expectedReturn)}</li>}
                {coForm.notes.trim() && <li><span className="font-semibold">Notes:</span> {coForm.notes.trim()}</li>}
              </ul>
              {coForm.emailNotes.trim() && <p className="mt-3 rounded-md bg-black/[0.04] px-3 py-2 dark:bg-white/[0.06]">{coForm.emailNotes.trim()}</p>}
              <p className="mt-3">Please return this item in good condition. Contact the asset manager with any questions.</p>
              <p className="mt-2">— {company?.name || 'FitPro'} Asset Management</p>
            </div>
            {coForm.skipEmail && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">This email will NOT be sent — “Skip Checkout Confirmation Email” is on.</p>}
          </div>
        )}
      </Modal>

      {/* Checkin (components) */}
      <Modal open={!!checkinFor} onClose={() => setCheckinFor(null)} title={`Checkin — ${checkinFor?.name || ''}`} wide>
        {checkinFor && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {checkinFor.tag}</span>
              <span className="font-semibold">{checkinFor.name}</span>
              <span className="ml-auto text-xs text-mist">
                {checkinFor.checkedOut ?? 0}/{checkinFor.qty ?? 1} checked out{checkinFor.assignedTo ? ` · held by ${checkinFor.assignedTo}` : ''}
              </span>
            </div>

            <Field label={<span>Quantity <span className="ml-1 font-normal text-mist">(Out: {checkinFor.checkedOut ?? 0})</span></span>} required>
              <Input type="number" min={1} max={checkinFor.checkedOut ?? 0} value={ciForm.qty} onChange={(e) => setCiForm({ ...ciForm, qty: e.target.value })} />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Checkin Date" required><DatePicker value={ciForm.date} onChange={(v) => setCiForm({ ...ciForm, date: v })} /></Field>
              <Field label="Condition on return">
                <Select value={ciForm.condition} onChange={(e) => setCiForm({ ...ciForm, condition: e.target.value })}>
                  <option value="">Not assessed</option>
                  {assetConditions.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            </div>

            <Field label="Restock to location">
              <Select value={ciForm.location} onChange={(e) => setCiForm({ ...ciForm, location: e.target.value })}>
                <option value="">Keep current location</option>
                {ciForm.location && !setupLocationOptions.some((o) => o.value === ciForm.location) && <option value={ciForm.location}>{ciForm.location} (current)</option>}
                {setupLocationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>

            <Field label="Notes"><Textarea value={ciForm.notes} onChange={(e) => setCiForm({ ...ciForm, notes: e.target.value })} rows={2} placeholder="Return condition, missing parts, etc." /></Field>

            <p className="flex flex-wrap items-center gap-1.5 rounded-lg bg-amber-500/25 px-3 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              <Mail className="size-4 flex-shrink-0" />
              <span>The custodian will be emailed a confirmation of the checkin, please <button type="button" className="cursor-pointer font-bold underline" onClick={() => setCiEmailPreview(true)}>click here to preview</button>.</span>
            </p>

            <Field label={<span className="inline-flex items-center gap-1">Confirmation Email Notes<HelpCircle className="size-3.5 text-mist" aria-hidden /></span>}>
              <Textarea value={ciForm.emailNotes} onChange={(e) => setCiForm({ ...ciForm, emailNotes: e.target.value })} rows={2} placeholder="Confirmation Email Notes" />
            </Field>

            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch checked={ciForm.skipEmail} onChange={(v) => setCiForm({ ...ciForm, skipEmail: v })} aria-label="Skip checkin confirmation email" />
              <span className="inline-flex items-center gap-1">Skip Checkin Confirmation Email <HelpCircle className="size-3.5 text-mist" aria-hidden /></span>
            </label>

            <Button className="w-full bg-cyan-600 text-white hover:bg-cyan-700" onClick={doCheckin}><Save className="size-4" /> Save</Button>
          </div>
        )}
      </Modal>

      {/* Checkin confirmation email preview */}
      <Modal open={ciEmailPreview} onClose={() => setCiEmailPreview(false)} title="Checkin confirmation email — preview" wide>
        {checkinFor && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-line p-3 text-xs text-mist">
              <p><span className="font-bold">To:</span> {ciCustodian()?.name || checkinFor.assignedTo || '—'}{ciCustodian()?.email ? ` <${ciCustodian()?.email}>` : ''}</p>
              <p><span className="font-bold">Subject:</span> Checkin confirmation — {checkinFor.name}</p>
            </div>
            <div className="rounded-lg border border-line p-4 leading-relaxed">
              <p>Hello {ciCustodian()?.name || checkinFor.assignedTo || '—'},</p>
              <p className="mt-2">This confirms the following item has been checked in:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><span className="font-semibold">Asset:</span> {checkinFor.tag} — {checkinFor.name}</li>
                <li><span className="font-semibold">Quantity returned:</span> {ciForm.qty || 1}</li>
                <li><span className="font-semibold">Checkin date:</span> {formatDate(ciForm.date)}</li>
                {ciForm.location && <li><span className="font-semibold">Restocked to:</span> {ciForm.location}</li>}
                {ciForm.condition && <li><span className="font-semibold">Condition on return:</span> {ciForm.condition}</li>}
                {ciForm.notes.trim() && <li><span className="font-semibold">Notes:</span> {ciForm.notes.trim()}</li>}
              </ul>
              {ciForm.emailNotes.trim() && <p className="mt-3 rounded-md bg-black/[0.04] px-3 py-2 dark:bg-white/[0.06]">{ciForm.emailNotes.trim()}</p>}
              <p className="mt-3">Thank you for returning this item on time.</p>
              <p className="mt-2">— {company?.name || 'FitPro'} Asset Management</p>
            </div>
            {ciForm.skipEmail && <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">This email will NOT be sent — “Skip Checkin Confirmation Email” is on.</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
