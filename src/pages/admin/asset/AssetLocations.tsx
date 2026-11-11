import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Search, List, LayoutGrid, Eye, SquarePen, Trash2, MapPin, Building2, Layers,
  DoorOpen, Warehouse, Globe, ArrowUpDown, ChevronLeft, ChevronRight, X, Tag,
} from 'lucide-react'
import { PageHeader, Button, Badge, Select, Input, Empty } from '../../../components/ui'
import { useToast } from '../../../context/ToastContext'
import { uid } from '../../../lib/utils'
import {
  ASSET_LOCATIONS_KEY, LOCATION_TYPES as TYPES, loadAssetLocations,
  type AssetLocationRec as LocationRec, type LocationType,
} from '../../../lib/assetLocations'

const TYPE_META: Record<LocationType, { Icon: typeof Building2; tone: 'violet' | 'rose' | 'sky' }> = {
  Building: { Icon: Building2, tone: 'violet' },
  Floor: { Icon: Layers, tone: 'violet' },
  Room: { Icon: DoorOpen, tone: 'violet' },
  Warehouse: { Icon: Warehouse, tone: 'rose' },
  Site: { Icon: Globe, tone: 'sky' },
}

type FormState = { id?: string; name: string; code: string; type: LocationType; parentId: string; status: 'active' | 'inactive' }
const blankForm = (): FormState => ({ name: '', code: '', type: 'Building', parentId: '', status: 'active' })

export function AssetLocations() {
  const toast = useToast()
  const [items, setItems] = useState<LocationRec[]>(() => loadAssetLocations())
  useEffect(() => { try { localStorage.setItem(ASSET_LOCATIONS_KEY, JSON.stringify(items)) } catch { /* storage may be unavailable */ } }, [items])

  const [searchInput, setSearchInput] = useState('')
  const [q, setQ] = useState('')
  const [view, setView] = useState<'list' | 'grid'>('list')
  const [perPage, setPerPage] = useState(10)
  const [typeTab, setTypeTab] = useState<'all' | LocationType>('all')
  const [sortKey, setSortKey] = useState<'name' | 'type'>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState<FormState | null>(null)
  const [viewing, setViewing] = useState<LocationRec | null>(null)

  const parentOf = (l: LocationRec) => items.find((x) => x.id === l.parentId)

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items
      .filter((l) => (!ql || `${l.name} ${l.code}`.toLowerCase().includes(ql)) && (typeTab === 'all' || l.type === typeTab))
      .sort((a, b) => {
        const av = sortKey === 'name' ? a.name : a.type
        const bv = sortKey === 'name' ? b.name : b.type
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      })
  }, [items, q, typeTab, sortKey, sortAsc])

  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const cur = Math.min(page, pages)
  const slice = filtered.slice((cur - 1) * perPage, cur * perPage)
  useEffect(() => { setPage(1) }, [q, typeTab, perPage])

  const toggleSort = (k: 'name' | 'type') => {
    if (sortKey === k) setSortAsc((s) => !s)
    else { setSortKey(k); setSortAsc(true) }
  }

  const saveForm = () => {
    if (!form) return
    if (!form.name.trim()) { toast.error('Enter a location name.'); return }
    if (!form.code.trim()) { toast.error('Enter a location code.'); return }
    if (form.id) {
      setItems((p) => p.map((l) => l.id === form.id ? { ...l, name: form.name.trim(), code: form.code.trim(), type: form.type, parentId: form.parentId || undefined, status: form.status } : l))
      toast.success('Location updated', form.name)
    } else {
      setItems((p) => [...p, { id: uid('loc'), name: form.name.trim(), code: form.code.trim(), type: form.type, parentId: form.parentId || undefined, status: form.status }])
      toast.success('Location added', form.name)
    }
    setForm(null)
  }

  const remove = (l: LocationRec) => {
    const children = items.filter((x) => x.parentId === l.id)
    if (children.length) { toast.error(`Reassign or delete the ${children.length} child location${children.length > 1 ? 's' : ''} first.`); return }
    if (!window.confirm(`Delete “${l.name}” (${l.code})? This cannot be undone.`)) return
    setItems((p) => p.filter((x) => x.id !== l.id))
    toast.success('Location deleted')
  }

  const openEdit = (l: LocationRec) => setForm({ id: l.id, name: l.name, code: l.code, type: l.type, parentId: l.parentId || '', status: l.status })

  const actions = (l: LocationRec) => (
    <div className="flex items-center justify-end gap-1">
      <button type="button" title="View" onClick={() => setViewing(l)} className="cursor-pointer rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-500/10 dark:text-emerald-400"><Eye className="size-4" /></button>
      <button type="button" title="Edit" onClick={() => openEdit(l)} className="cursor-pointer rounded-md p-1.5 text-sky-600 transition hover:bg-sky-500/10 dark:text-sky-400"><SquarePen className="size-4" /></button>
      <button type="button" title="Delete" onClick={() => remove(l)} className="cursor-pointer rounded-md p-1.5 text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-400"><Trash2 className="size-4" /></button>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Manage Asset Location"
        desc="Organize different asset locations within your company, from buildings and floors to individual rooms."
        actions={<Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={() => setForm(blankForm())} aria-label="New location"><Plus className="size-4" /></Button>}
      />

      {/* ---- Toolbar ---- */}
      <div className="card mb-4 flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
          <Input value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setQ(e.target.value) }} placeholder="Search locations..." className="max-w-xs" />
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
        </div>
      </div>

      {/* ---- List / grid ---- */}
      <div className="card overflow-hidden rounded-xl">
        {/* ---- Type tabs ---- */}
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-3 pt-2">
          {(['all', ...TYPES] as const).map((t) => {
            const on = typeTab === t
            const count = t === 'all' ? items.length : items.filter((l) => l.type === t).length
            const Icon = t === 'all' ? LayoutGrid : TYPE_META[t].Icon
            return (
              <button key={t} type="button" onClick={() => setTypeTab(t)} className={`-mb-px flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${on ? 'border-orange-500 text-orange-500' : 'border-transparent text-mist hover:text-inherit'}`}>
                <Icon className="size-4" /> {t === 'all' ? 'All' : t}
                <span className={`rounded-full px-1.5 text-xs font-bold ${on ? 'bg-orange-500/15' : 'bg-black/[0.06] dark:bg-white/10'}`}>{count}</span>
              </button>
            )
          })}
        </div>
        {slice.length === 0 && <Empty title="No locations" desc="No locations match your search or filters." />}

        {view === 'list' && slice.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-black/[0.04] text-xs font-bold uppercase tracking-wide text-mist dark:bg-white/[0.05]">
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('name')} className="flex cursor-pointer items-center gap-1 uppercase tracking-wide"><ArrowUpDown className="size-3.5" /> Name</button>
                  </th>
                  <th className="px-4 py-3">
                    <button type="button" onClick={() => toggleSort('type')} className="flex cursor-pointer items-center gap-1 uppercase tracking-wide"><ArrowUpDown className="size-3.5" /> Type</button>
                  </th>
                  <th className="px-4 py-3">Parent Location</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {slice.map((l) => (
                  <tr key={l.id} className="transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-orange-500/30 bg-orange-500/15 text-orange-500"><MapPin className="size-5" /></span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{l.name}</p>
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {l.code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge tone={TYPE_META[l.type].tone}>{l.type}</Badge></td>
                    <td className="px-4 py-3 text-mist">{parentOf(l)?.name || '-'}</td>
                    <td className="px-4 py-3"><Badge tone={l.status === 'active' ? 'lime' : 'zinc'}>{l.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-4 py-3">{actions(l)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === 'grid' && slice.length > 0 && (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((l) => (
              <div key={l.id} className="rounded-xl border border-line p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-orange-500/30 bg-orange-500/15 text-orange-500"><MapPin className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{l.name}</p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"><Tag className="size-3" /> {l.code}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <Badge tone={TYPE_META[l.type].tone}>{l.type}</Badge>
                  <Badge tone={l.status === 'active' ? 'lime' : 'zinc'}>{l.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="mt-3 text-xs text-mist">Parent: {parentOf(l)?.name || '-'}</p>
                <div className="mt-3 flex justify-end">{actions(l)}</div>
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

      {/* ---- New / edit location form ---- */}
      {form && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setForm(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-lg sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <div>
                <h2 className="text-base font-bold sm:text-lg">{form.id ? 'Edit Location' : 'New Location'}</h2>
                <p className="mt-1 text-sm text-mist">Add a building, floor, room, warehouse or site.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setForm(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="mb-1 block text-xs font-bold">Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Floor 2 - Administration" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Code *</label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. FL2-ADM-001" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold">Type</label>
                  <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LocationType })}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold">Status</label>
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </Select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold">Parent Location</label>
                <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                  <option value="">None (top level)</option>
                  {items.filter((l) => l.id !== form.id).map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </Select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button className="bg-orange-500 text-white hover:bg-orange-600" onClick={saveForm}>{form.id ? 'Save Changes' : 'Add Location'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- View location ---- */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setViewing(null)}>
          <div className="card max-h-[92vh] w-full overflow-y-auto rounded-t-2xl p-4 sm:max-w-md sm:rounded-xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-line pb-4">
              <h2 className="text-base font-bold sm:text-lg">Location Details</h2>
              <button type="button" aria-label="Close" onClick={() => setViewing(null)} className="-mr-1 cursor-pointer rounded-md p-1.5 transition hover:bg-black/[0.05] dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-orange-500/30 bg-orange-500/15 text-orange-500"><MapPin className="size-5" /></span>
                <div>
                  <p className="font-semibold">{viewing.name}</p>
                  <p className="text-xs text-mist">{viewing.code}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-mist">Type</p><Badge tone={TYPE_META[viewing.type].tone}>{viewing.type}</Badge></div>
                <div><p className="text-xs text-mist">Status</p><Badge tone={viewing.status === 'active' ? 'lime' : 'zinc'}>{viewing.status === 'active' ? 'Active' : 'Inactive'}</Badge></div>
                <div><p className="text-xs text-mist">Parent Location</p><p className="mt-0.5 font-semibold">{parentOf(viewing)?.name || '-'}</p></div>
                <div><p className="text-xs text-mist">Child Locations</p><p className="mt-0.5 font-semibold">{items.filter((x) => x.parentId === viewing.id).length}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
