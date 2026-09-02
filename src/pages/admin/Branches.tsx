import { useEffect, useMemo, useState } from 'react'
import { Eye, LayoutGrid, Pencil, Plus, Table2, Trash2 } from 'lucide-react'
import { PageHeader, Badge, Button, Modal, Field, Input, Select, SearchField } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { REVENUE_SERIES } from '../../data/seed'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { cn as cn2, uid } from '../../lib/utils'
import { isPhone } from '../../lib/validate'
import { branchClosure, branchDepth, branchesTreeOrder, userCompanyId, visibleBranches } from '../../lib/accessScope'
import type { Branch } from '../../types'

type BranchForm = {
  name: string
  parentId: string
  address: string
  city: string
  phone: string
  hours: string
  capacity: string
  members: string
  managerId: string
  lat: string
  lng: string
}

const blank = (): BranchForm => ({
  name: '', parentId: '', address: '', city: 'Accra', phone: '+233 ', hours: '06:00 – 22:00',
  capacity: '600', members: '0', managerId: 'u_manager', lat: '5.6037', lng: '-0.1870',
})

type BranchTab = 'kanban' | 'table'

const TAB_KEY = 'fitpro.branches.view'

const TABS: { id: BranchTab; label: string; Icon: typeof LayoutGrid }[] = [
  { id: 'kanban', label: 'Kanban View', Icon: LayoutGrid },
  { id: 'table', label: 'Tabular View', Icon: Table2 },
]

/** Tabular view — search, filter, sort and row actions over all branches. */
function BranchTable({
  branches,
  onView,
  onEdit,
  onDelete,
  canEdit,
}: {
  branches: Branch[]
  onView: (b: Branch) => void
  onEdit: (b: Branch) => void
  onDelete: (b: Branch) => void
  canEdit: boolean
}) {
  const { users, classes } = useApp()
  const [q, setQ] = useState('')
  const [city, setCity] = useState('all')
  const [manager, setManager] = useState('all')
  const [util, setUtil] = useState('all')

  const cities = useMemo(
    () => Array.from(new Set(branches.map((b) => b.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [branches],
  )
  const managerOptions = useMemo(() => {
    const ids = Array.from(new Set(branches.map((b) => b.managerId).filter(Boolean)))
    return ids
      .map((id) => ({ id, name: users.find((u) => u.id === id)?.name || 'Unassigned' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [branches, users])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return branchesTreeOrder(branches).filter((b) => {
      const managerName = users.find((u) => u.id === b.managerId)?.name || ''
      if (term) {
        const haystack = [b.name, b.address, b.city, b.phone, b.hours, managerName].join(' ').toLowerCase()
        if (!haystack.includes(term)) return false
      }
      if (city !== 'all' && b.city !== city) return false
      if (manager !== 'all' && b.managerId !== manager) return false
      if (util !== 'all') {
        const pct = Math.round((b.members / Math.max(b.capacity, 1)) * 100)
        if (util === 'high' && pct <= 85) return false
        if (util === 'healthy' && (pct < 50 || pct > 85)) return false
        if (util === 'low' && pct >= 50) return false
      }
      return true
    })
  }, [branches, users, q, city, manager, util])

  const activeFilters = (city !== 'all' ? 1 : 0) + (manager !== 'all' ? 1 : 0) + (util !== 'all' ? 1 : 0)

  const columns: Column<Branch>[] = [
    { key: 'name', header: 'BRANCH', sortValue: (b) => b.name, render: (b) => {
      const depth = branchDepth(branches, b.id)
      const parent = branches.find((x) => x.id === b.parentId)
      return (
        <div style={depth > 0 ? { paddingLeft: `${depth * 16}px` } : undefined}>
          <p className="font-semibold">{depth > 0 ? '↳ ' : ''}{b.name}</p>
          <p className="text-xs text-mist">{b.address}</p>
          {parent && <p className="text-[11px] font-semibold text-lime">Part of {parent.name}</p>}
        </div>
      )
    } },
    { key: 'city', header: 'CITY', sortValue: (b) => b.city, render: (b) => <span className="text-sm">{b.city}</span> },
    { key: 'manager', header: 'MANAGER', sortValue: (b) => users.find((u) => u.id === b.managerId)?.name || '', render: (b) => <span className="text-sm">{users.find((u) => u.id === b.managerId)?.name || '—'}</span> },
    { key: 'members', header: 'MEMBERS', align: 'right', sortValue: (b) => b.members, render: (b) => <span className="text-sm tabular-nums">{b.members}</span> },
    { key: 'capacity', header: 'CAPACITY', align: 'right', sortValue: (b) => b.capacity, render: (b) => <span className="text-sm tabular-nums">{b.capacity}</span> },
    { key: 'util', header: 'UTILISATION', sortValue: (b) => b.members / Math.max(b.capacity, 1), render: (b) => {
      const pct = Math.round((b.members / Math.max(b.capacity, 1)) * 100)
      return <Badge tone={pct > 85 ? 'rose' : 'lime'}>{pct}% full</Badge>
    } },
    { key: 'classes', header: 'CLASSES', align: 'right', sortValue: (b) => classes.filter((c) => c.branchId === b.id).length, render: (b) => <span className="text-sm tabular-nums">{classes.filter((c) => c.branchId === b.id).length}</span> },
    { key: 'hours', header: 'HOURS', render: (b) => <span className="text-xs text-mist">{b.hours}</span> },
    { key: 'actions', header: 'ACTIONS', align: 'right', render: (b: Branch) => (
      <div className="flex items-center justify-end gap-1">
        <button className="rounded-lg p-2 text-mist transition hover:text-lime" onClick={() => onView(b)} aria-label={`View ${b.name}`} title="View">
          <Eye className="size-4" />
        </button>
        {canEdit && (
          <>
            <button className="rounded-lg p-2 text-mist transition hover:text-lime" onClick={() => onEdit(b)} aria-label={`Edit ${b.name}`} title="Edit">
              <Pencil className="size-4" />
            </button>
            <button className="rounded-lg p-2 text-mist transition hover:text-ember" onClick={() => onDelete(b)} aria-label={`Delete ${b.name}`} title="Delete">
              <Trash2 className="size-4" />
            </button>
          </>
        )}
      </div>
    ) },
  ]

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search branch, address, city, manager…"
          className="w-full lg:max-w-sm"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:items-center">
          <Select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Filter by city">
            <option value="all">All cities</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={manager} onChange={(e) => setManager(e.target.value)} aria-label="Filter by manager">
            <option value="all">All managers</option>
            {managerOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={util} onChange={(e) => setUtil(e.target.value)} aria-label="Filter by utilisation">
            <option value="all">Any utilisation</option>
            <option value="high">Over 85% (at risk)</option>
            <option value="healthy">50 – 85%</option>
            <option value="low">Under 50%</option>
          </Select>
          {(activeFilters > 0 || q) && (
            <button
              type="button"
              onClick={() => { setQ(''); setCity('all'); setManager('all'); setUtil('all') }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-mist transition hover:text-lime"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <p className="mb-2 text-xs text-mist">
        Showing {rows.length} of {branches.length} branch{branches.length === 1 ? '' : 'es'}
        {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters === 1 ? '' : 's'} active`}
      </p>
      <DataTable
        columns={columns}
        data={rows}
        rowKey={(b) => b.id}
        emptyTitle="No branches found"
        emptyDesc="Adjust your search or filters, or create a new branch."
      />
    </div>
  )
}

export function Branches() {
  const { branches, users, classes, activeCompanyId, upsertBranch, deleteBranch, log } = useApp()
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'company_admin')
  const accessibleBranches = user?.role === 'super_admin' ? branches : visibleBranches(user, branches, activeCompanyId)
  const scopedCompanyId = user && (user.role === 'company_admin' || user.role === 'head_office' || user.role === 'branch_admin')
    ? userCompanyId(user, branches)
    : activeCompanyId
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BranchForm>(blank())
  const [err, setErr] = useState('')
  const [viewing, setViewing] = useState<Branch | null>(null)
  const [tab, setTab] = useState<BranchTab>(() => {
    if (typeof window === 'undefined') return 'kanban'
    const saved = window.localStorage.getItem(TAB_KEY)
    return saved === 'table' ? 'table' : 'kanban'
  })

  useEffect(() => {
    try { window.localStorage.setItem(TAB_KEY, tab) } catch { /* storage unavailable */ }
  }, [tab])

  const managers = users.filter((u) => u.role === 'gym_manager' || u.role === 'super_admin')

  const openCreate = () => {
    setEditingId(null)
    setForm(blank())
    setErr('')
    setOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditingId(b.id)
    setForm({
      name: b.name,
      parentId: b.parentId || '',
      address: b.address,
      city: b.city,
      phone: b.phone,
      hours: b.hours,
      capacity: String(b.capacity),
      members: String(b.members),
      managerId: b.managerId,
      lat: String(b.lat),
      lng: String(b.lng),
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 3) return 'Branch name must be at least 3 characters.'
    if (form.address.trim().length < 4) return 'Address is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!isPhone(form.phone)) return 'Enter a valid phone number.'
    if (!form.hours.trim()) return 'Opening hours are required.'
    const capacity = Number(form.capacity)
    const members = Number(form.members)
    if (!capacity || capacity < 1) return 'Capacity must be at least 1.'
    if (Number.isNaN(members) || members < 0) return 'Member count cannot be negative.'
    if (members > capacity) return 'Reported members cannot exceed capacity.'
    if (!form.managerId) return 'Select a manager.'
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.'
    const dup = branches.some((b) => b.name.toLowerCase() === form.name.trim().toLowerCase() && b.id !== editingId)
    if (dup) return 'A branch with that name already exists.'
    if (editingId && form.parentId) {
      if (form.parentId === editingId) return 'A branch cannot be its own parent.'
      if (branchClosure(branches, editingId).includes(form.parentId)) return 'Cannot nest a branch under one of its own child branches.'
    }
    return ''
  }

  const save = () => {
    if (!canEdit) { toast.error('Only managers and super admins can change branches.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const record: Branch = {
      id: editingId || uid('br'),
      companyId: branches.find((branch) => branch.id === editingId)?.companyId || scopedCompanyId,
      parentId: form.parentId || undefined,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      hours: form.hours.trim(),
      capacity: Number(form.capacity),
      members: Number(form.members),
      managerId: form.managerId,
      lat: Number(form.lat),
      lng: Number(form.lng),
    }
    upsertBranch(record)
    log(user?.id || 'admin', editingId ? 'UPDATE' : 'CREATE', 'Branch', `${editingId ? 'Edited' : 'Created'} ${record.name}`)
    toast.success(editingId ? 'Branch updated' : 'Branch created')
    setOpen(false)
  }

  const remove = (b: Branch) => {
    if (!canEdit) { toast.error('Only managers and super admins can change branches.'); return }
    const children = branches.filter((x) => x.parentId === b.id)
    if (children.length > 0) {
      toast.error(`Reassign the ${children.length} child branch${children.length > 1 ? 'es' : ''} before deleting ${b.name}.`)
      return
    }
    if (!window.confirm(`Delete “${b.name}”? This cannot be undone.`)) return
    deleteBranch(b.id)
    log(user?.id || 'admin', 'DELETE', 'Branch', `Deleted ${b.name}`)
    toast.success('Branch deleted')
    if (viewing?.id === b.id) setViewing(null)
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        desc="Multi-club performance and allocation."
        actions={canEdit ? <Button onClick={openCreate}><Plus className="size-4" /> Create branch</Button> : undefined}
      />
      <div
        role="tablist"
        aria-label="Branches view"
        className="mb-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-line p-1"
        style={{ width: 'fit-content', maxWidth: '100%' }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            role="tab"
            id={`branches-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`branches-panel-${id}`}
            onClick={() => setTab(id)}
            className={cn2(
              'flex shrink-0 items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition',
              tab === id ? 'bg-lime text-black' : 'text-mist hover:bg-black/5 dark:hover:bg-white/5',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === 'table' && (
        <div role="tabpanel" id="branches-panel-table" aria-labelledby="branches-tab-table">
          <BranchTable
            branches={accessibleBranches}
            onView={setViewing}
            onEdit={openEdit}
            onDelete={remove}
            canEdit={canEdit}
          />
        </div>
      )}

      <div
        role="tabpanel"
        id="branches-panel-kanban"
        aria-labelledby="branches-tab-kanban"
        className={cn2('grid gap-4 md:grid-cols-2', tab !== 'kanban' && 'hidden')}
      >
        {branchesTreeOrder(accessibleBranches).map((b) => {
          const headcount = users.filter((u) => u.branchId === b.id && u.role === 'member').length
          const cls = classes.filter((c) => c.branchId === b.id).length
          const util = Math.round((b.members / Math.max(b.capacity, 1)) * 100)
          const depth = branchDepth(accessibleBranches, b.id)
          const parent = accessibleBranches.find((x) => x.id === b.parentId)
          const children = accessibleBranches.filter((x) => x.parentId === b.id)
          return (
            <article
              key={b.id}
              className="card p-5"
              style={depth > 0 ? { marginLeft: `${Math.min(depth, 3) * 20}px`, borderLeft: '3px solid #C8F542' } : undefined}
            >
              <div className="flex items-start justify-between">
                <div>
                  {depth > 0 && parent && <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-lime">↳ Part of {parent.name}</p>}
                  <h2 className="font-display text-xl">{b.name}</h2>
                  <p className="text-sm text-mist">{b.address} · {b.city}</p>
                  {children.length > 0 && <p className="mt-1 text-[11px] font-semibold text-mist">{children.length} child branch{children.length > 1 ? 'es' : ''}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={util > 85 ? 'rose' : 'lime'}>{util}% full</Badge>
                  {canEdit && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(b)} aria-label="Edit branch">
                      <Pencil className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-mist">Members</p><p className="stat-num text-2xl">{b.members}</p></div>
                <div><p className="text-mist">Capacity</p><p className="stat-num text-2xl">{b.capacity}</p></div>
                <div><p className="text-mist">Classes</p><p className="stat-num text-2xl">{cls}</p></div>
              </div>
              <div className="mt-4 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE_SERIES}>
                    <XAxis dataKey="month" hide />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#C8F542" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-mist">{b.hours} · {b.phone} · sample roster {headcount}</p>
            </article>
          )
        })}
      </div>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name || 'Branch'}>
        {viewing && (() => {
          const pct = Math.round((viewing.members / Math.max(viewing.capacity, 1)) * 100)
          const parent = branches.find((x) => x.id === viewing.parentId)
          const children = branches.filter((x) => x.parentId === viewing.id)
          const rows: [string, string][] = [
            ['Address', `${viewing.address} · ${viewing.city}`],
            ['Phone', viewing.phone],
            ['Hours', viewing.hours],
            ['Manager', users.find((u) => u.id === viewing.managerId)?.name || '—'],
            ['Parent branch', parent ? parent.name : 'Top-level branch'],
            ['Child branches', children.length ? children.map((c) => c.name).join(', ') : 'None'],
            ['Classes', String(classes.filter((c) => c.branchId === viewing.id).length)],
            ['Coordinates', `${viewing.lat}, ${viewing.lng}`],
          ]
          return (
            <div>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <div><p className="text-sm text-mist">Members</p><p className="stat-num text-2xl">{viewing.members}</p></div>
                <div><p className="text-sm text-mist">Capacity</p><p className="stat-num text-2xl">{viewing.capacity}</p></div>
                <div><p className="text-sm text-mist">Utilisation</p><Badge tone={pct > 85 ? 'rose' : 'lime'}>{pct}% full</Badge></div>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                {rows.map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line p-3">
                    <dt className="text-xs uppercase tracking-wide text-mist">{label}</dt>
                    <dd className="mt-0.5 text-sm font-medium break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              {canEdit && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => { const b = viewing; setViewing(null); openEdit(b) }}><Pencil className="size-4" /> Edit branch</Button>
                  <Button variant="danger" onClick={() => remove(viewing)}><Trash2 className="size-4" /> Delete</Button>
                </div>
              )}
            </div>
          )
        })()}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit branch' : 'Create branch'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Branch name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Parent branch (optional)">
            <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
              <option value="">— No parent (top-level branch) —</option>
              {branches
                .filter((b) => b.companyId === (branches.find((x) => x.id === editingId)?.companyId || scopedCompanyId))
                .filter((b) => b.id !== editingId && !(editingId && branchClosure(branches, editingId).includes(b.id)))
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchDepth(branches, b.id) > 0 ? '↳ ' : ''}{b.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Hours"><Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Current members"><Input type="number" value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} /></Field>
          <Field label="Manager">
            <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Latitude"><Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create branch'}</Button>
      </Modal>
    </div>
  )
}
