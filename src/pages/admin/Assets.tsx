import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Printer, Boxes, Wrench, Tag, MapPin, User, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty, DatePicker, StatCard, SearchField } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import { visibleBranches } from '../../lib/accessScope'
import { ASSET_STATUSES, nextAssetTag, depreciatedValue } from '../../lib/assets'
import { DataTable, type Column } from '../../components/DataTable'
import type { Asset, AssetStatus } from '../../types'

type FormState = {
  id?: string
  tag: string
  name: string
  category: string
  serialNumber: string
  status: AssetStatus
  condition: string
  location: string
  assignedTo: string
  purchaseDate: string
  purchaseCost: string
  currentValue: string
  warrantyExpiry: string
  notes: string
}

const blank = (tag: string, category = ''): FormState => ({
  tag, name: '', category, serialNumber: '', status: 'in_use',
  condition: '', location: '', assignedTo: '', purchaseDate: '', purchaseCost: '',
  currentValue: '', warrantyExpiry: '', notes: '',
})

function statusTone(s: AssetStatus): 'lime' | 'sky' | 'amber' | 'zinc' {
  if (s === 'in_use') return 'lime'
  if (s === 'available') return 'sky'
  if (s === 'maintenance') return 'amber'
  return 'zinc'
}

function conditionTone(c: string): 'lime' | 'sky' | 'amber' | 'rose' {
  const v = c.toLowerCase()
  if (v === 'excellent') return 'lime'
  if (v === 'good') return 'sky'
  if (v === 'fair') return 'amber'
  return 'rose'
}

export function Assets() {
  const app = useApp()
  const { assets, upsertAsset, deleteAsset, log, company, branches, assetCategories, assetConditions, depreciationPolicy } = app
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

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...assets]
      .filter((a) => {
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
        <span>
          <span className="block font-semibold">{a.name}</span>
          {a.serialNumber && <span className="block text-xs text-mist">S/N {a.serialNumber}</span>}
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

  const openNew = () => setEditing(blank(nextAssetTag(assets), assetCategories[0] || ''))
  const openEdit = (a: Asset) => setEditing({
    id: a.id, tag: a.tag, name: a.name, category: a.category,
    serialNumber: a.serialNumber || '', status: a.status, condition: a.condition,
    location: a.location, assignedTo: a.assignedTo || '',
    purchaseDate: a.purchaseDate || '', purchaseCost: a.purchaseCost != null ? String(a.purchaseCost) : '',
    currentValue: a.currentValue != null ? String(a.currentValue) : '',
    warrantyExpiry: a.warrantyExpiry || '', notes: a.notes || '',
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
    const purchaseCost = editing.purchaseCost ? Number(editing.purchaseCost) : undefined
    const rec: Asset = {
      id: editing.id || uid('ast'),
      companyId: selectedBranch?.companyId || prev?.companyId,
      branchId: selectedBranch?.id || prev?.branchId,
      tag: editing.tag.trim().toUpperCase(),
      name: editing.name.trim(),
      category: editing.category,
      serialNumber: editing.serialNumber.trim() || undefined,
      status: editing.status,
      condition: editing.condition,
      location: editing.location.trim() || '—',
      assignedTo: editing.assignedTo.trim() || undefined,
      purchaseDate: editing.purchaseDate || undefined,
      purchaseCost,
      currentValue: editing.currentValue ? Number(editing.currentValue) : undefined,
      warrantyExpiry: editing.warrantyExpiry || undefined,
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

  return (
    <div>
      <PageHeader
        title="Assets"
        desc="Track gym equipment, furniture, and fixed assets across your clubs — status, condition, value, and custodian."
        actions={
          <>
            <ExportButtons filename="assets" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked', 'Use a different browser or check downloads.')} />
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New asset</Button>}
          </>
        }
      />

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
              <Field label="Category">
                <Select value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                  {assetCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
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
              <Field label="Purchase cost (GHS)">
                <Input type="number" min={0} value={editing.purchaseCost} onChange={(e) => setEditing({ ...editing, purchaseCost: e.target.value })} />
              </Field>
              <Field label="Current value (GHS)">
                <Input type="number" min={0} value={editing.currentValue} onChange={(e) => setEditing({ ...editing, currentValue: e.target.value })} />
              </Field>
            </div>

            {editing.purchaseCost && Number(editing.purchaseCost) > 0 && !editing.currentValue && editing.purchaseDate && (
              <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-lime" /> Estimated value</p>
                <p className="mt-1 text-mist">
                  Straight-line depreciation suggests a current value of{' '}
                  <span className="font-semibold text-inherit">{formatGhs(depreciatedValue(Number(editing.purchaseCost), editing.purchaseDate, depreciationPolicy.usefulLifeYears, depreciationPolicy.residualPercent))}</span>.
                </p>
              </div>
            )}

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
    </div>
  )
}
