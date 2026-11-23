import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Church, Users, HandCoins, CalendarDays, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Modal, PageHeader } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, uid } from '../../../lib/utils'
import {
  loadChurchRecords,
  saveChurchRecords,
  type ChurchBranchRecords,
  type ChurchRow,
  type ChurchTabKey,
} from '../../../lib/churchRecords'
import { subscribeDbHydrated } from '../../../lib/mysqlBridge'

const TABS: { key: ChurchTabKey; label: string; icon: typeof Users; singular: string }[] = [
  { key: 'congregation', label: 'Congregation Directory', icon: Users, singular: 'Member' },
  { key: 'services', label: 'Services & Events', icon: CalendarDays, singular: 'Service / Event' },
  { key: 'giving', label: 'Tithes & Offerings', icon: HandCoins, singular: 'Contribution' },
  { key: 'ministries', label: 'Groups & Follow-up', icon: Church, singular: 'Group / Follow-up' },
]

export function ChurchManagement() {
  const { activeBranchId } = useApp()
  const { show } = useToast()
  const branchKey = activeBranchId || 'br_airport'

  const [searchParams] = useSearchParams()
  const [records, setRecords] = useState<ChurchBranchRecords>(() => loadChurchRecords(branchKey))
  const [tab, setTab] = useState<ChurchTabKey>(() => {
    const t = searchParams.get('tab') as ChurchTabKey | null
    return t && ['congregation', 'services', 'giving', 'ministries'].includes(t) ? t : 'congregation'
  })
  useEffect(() => {
    const t = searchParams.get('tab') as ChurchTabKey | null
    if (t && ['congregation', 'services', 'giving', 'ministries'].includes(t)) {
      setTab(t)
    }
  }, [searchParams])
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ChurchRow | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    const refresh = () => setRecords(loadChurchRecords(branchKey))
    refresh()
    return subscribeDbHydrated(refresh)
  }, [branchKey])

  const updateTabRows = (targetTab: ChurchTabKey, nextRows: ChurchRow[]) => {
    setRecords((prev) => {
      const updated = { ...prev, [targetTab]: nextRows }
      saveChurchRecords(branchKey, updated)
      return updated
    })
  }

  const activeMeta = TABS.find((t) => t.key === tab) || TABS[0]
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = records[tab] || []
    if (!q) return list
    return list.filter((r) =>
      [r.name, r.category, r.status, r.phone, r.email, r.notes].some((v) => String(v || '').toLowerCase().includes(q)),
    )
  }, [query, records, tab])

  const totalGiving = useMemo(
    () => (records.giving || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
    [records.giving],
  )

  const openCreate = () => {
    setEditing({
      id: '',
      name: '',
      category: tab === 'giving' ? 'Tithe' : tab === 'services' ? 'Main Service' : tab === 'ministries' ? 'Cell Group' : 'General',
      phone: '',
      email: '',
      date: new Date().toISOString().slice(0, 10),
      amount: tab === 'giving' || tab === 'services' ? 0 : undefined,
      status: tab === 'giving' ? 'Posted' : tab === 'services' ? 'Scheduled' : 'Active',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEdit = (row: ChurchRow) => {
    setEditing({ ...row })
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!editing || !editing.name.trim()) {
      show('Name or title is required.', 'error')
      return
    }
    const list = records[tab] || []
    const isNew = !editing.id
    const saved: ChurchRow = {
      ...editing,
      id: editing.id || uid('ch'),
      name: editing.name.trim(),
    }
    const next = isNew ? [saved, ...list] : list.map((r) => (r.id === saved.id ? saved : r))
    updateTabRows(tab, next)
    setModalOpen(false)
    setEditing(null)
    show(`${activeMeta.singular} ${isNew ? 'added' : 'updated'} and saved to MySQL.`, 'success')
  }

  const handleDelete = (id: string) => {
    updateTabRows(
      tab,
      (records[tab] || []).filter((r) => r.id !== id),
    )
    show('Record deleted from MySQL.', 'info')
  }

  return (
    <div className="space-y-5">
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span>
        <span>/</span>
        <span className="font-semibold text-inherit">Church Management</span>
      </div>

      <PageHeader
        title="Church Management"
        desc="Manage congregation directory, services, tithes & offerings, and ministry groups (persisted in MySQL church_records)."
        actions={
          <button type="button" onClick={openCreate} className="btn-lime inline-flex items-center gap-2">
            <Plus className="size-4" /> Add {activeMeta.singular}
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">Congregation</span>
            <Users className="size-4 text-green-700 dark:text-lime" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{records.congregation.length}</p>
          <p className="mt-1 text-xs text-mist">Registered members & visitors</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">Services & Events</span>
            <CalendarDays className="size-4 text-green-700 dark:text-lime" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{records.services.length}</p>
          <p className="mt-1 text-xs text-mist">Scheduled & recorded gatherings</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">Tithes & Offerings</span>
            <HandCoins className="size-4 text-green-700 dark:text-lime" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{formatGhs(totalGiving)}</p>
          <p className="mt-1 text-xs text-mist">{records.giving.length} contribution entries</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-mist">Ministries & Cells</span>
            <Church className="size-4 text-green-700 dark:text-lime" />
          </div>
          <p className="mt-2 text-2xl font-extrabold">{records.ministries.length}</p>
          <p className="mt-1 text-xs text-mist">Active fellowships & home cells</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    active
                      ? 'bg-lime text-obsidian shadow-sm'
                      : 'bg-black/5 text-mist hover:text-inherit dark:bg-white/5'
                  }`}
                >
                  <Icon className="size-4" />
                  {t.label}
                  <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] dark:bg-white/10">
                    {(records[t.key] || []).length}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="relative min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${activeMeta.label.toLowerCase()}...`}
              className="input pl-9 text-xs"
            />
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-black/10 text-xs uppercase text-mist dark:border-white/10">
                <th className="px-3 py-2.5">Name / Title</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">{tab === 'ministries' ? 'Meeting Schedule' : 'Date'}</th>
                {(tab === 'giving' || tab === 'services') && (
                  <th className="px-3 py-2.5">{tab === 'giving' ? 'Amount' : 'Attendance'}</th>
                )}
                {(tab === 'congregation' || tab === 'ministries') && <th className="px-3 py-2.5">Contact</th>}
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-mist">
                    No records found in {activeMeta.label}.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                    <td className="px-3 py-3 font-semibold">{r.name}</td>
                    <td className="px-3 py-3 text-xs">{r.category}</td>
                    <td className="px-3 py-3 text-xs text-mist">{r.date || '—'}</td>
                    {(tab === 'giving' || tab === 'services') && (
                      <td className="px-3 py-3 font-semibold">
                        {tab === 'giving' ? formatGhs(Number(r.amount) || 0) : r.amount || 0}
                      </td>
                    )}
                    {(tab === 'congregation' || tab === 'ministries') && (
                      <td className="px-3 py-3 text-xs text-mist">{r.phone || r.email || '—'}</td>
                    )}
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-lime/15 px-2.5 py-0.5 text-[11px] font-bold text-green-700 dark:text-lime">
                        {r.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-3 py-3 text-xs text-mist">{r.notes || '—'}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-lg p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10"
                          title="Edit"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="rounded-lg p-1.5 text-mist hover:bg-red-500/10 hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${editing?.id ? 'Edit' : 'Add'} ${activeMeta.singular}`}
      >
        {editing && (
          <div className="space-y-3">
            <div>
              <label className="label">Name / Title *</label>
              <input
                className="input"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Enter name or title"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Category</label>
                <input
                  className="input"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Posted">Posted</option>
                  <option value="Pledged">Pledged</option>
                  <option value="First-Timer">First-Timer</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">{tab === 'ministries' ? 'Meeting Day / Time' : 'Date'}</label>
                <input
                  type={tab === 'ministries' ? 'text' : 'date'}
                  className="input"
                  value={editing.date || ''}
                  onChange={(e) => setEditing({ ...editing, date: e.target.value })}
                />
              </div>
              {(tab === 'giving' || tab === 'services') && (
                <div>
                  <label className="label">{tab === 'giving' ? 'Amount (GHS)' : 'Attendance Count'}</label>
                  <input
                    type="number"
                    className="input"
                    value={editing.amount ?? 0}
                    onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })}
                  />
                </div>
              )}
              {(tab === 'congregation' || tab === 'ministries') && (
                <div>
                  <label className="label">Phone</label>
                  <input
                    className="input"
                    value={editing.phone || ''}
                    onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  />
                </div>
              )}
            </div>
            {tab === 'congregation' && (
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  value={editing.email || ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <textarea
                rows={2}
                className="input"
                value={editing.notes || ''}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">
                Cancel
              </button>
              <button type="button" onClick={handleSave} className="btn-lime">
                Save {activeMeta.singular}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
