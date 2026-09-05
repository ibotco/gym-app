import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Pencil, Trash2, Percent, Tag, Printer, Check,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { DISCOUNT_TYPES, DISCOUNT_APPLIES, computeDiscount, discountGroupLabel } from '../../lib/discounts'
import type { Discount, DiscountStatus, DiscountType } from '../../types'

type SortKey = 'name' | 'type' | 'value' | 'group' | 'applies' | 'usage' | 'expires' | 'status'
type ColId = SortKey | 'action'

type FormState = {
  id?: string
  name: string
  type: DiscountType
  value: string
  minSpend: string
  maxDiscount: string
  usageLimit: string
  perCustomerLimit: string
  startsAt: string
  expiresAt: string
  status: DiscountStatus
  appliesTo: 'all' | 'members' | 'plans' | 'products'
  group: 'general' | 'specific_product'
  productId: string
}

const blank = (): FormState => ({
  name: '', type: 'percentage', value: '', minSpend: '', maxDiscount: '',
  usageLimit: '', perCustomerLimit: '', startsAt: '', expiresAt: '', status: 'active', appliesTo: 'all',
  group: 'general', productId: '',
})

function tone(status: DiscountStatus): 'lime' | 'zinc' | 'rose' {
  if (status === 'active') return 'lime'
  if (status === 'inactive') return 'zinc'
  return 'rose'
}

export function Discounts() {
  const app = useApp()
  const { discounts, upsertDiscount, deleteDiscount, log, inventory } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<Discount | null>(null)

  // Theme tokens — mirror the Supplier payments list so both pages match in either theme.
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const PANEL_BD = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const ROW_ALT = isDark ? '#1f242b' : '#f1f5f9'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BD = isDark ? '#49515c' : '#cbd5e1'

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  /** Id of the discount just saved, briefly highlighted in the list. */
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(null), 2600)
    return () => window.clearTimeout(t)
  }, [justSaved])

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'name', 'type', 'value', 'group', 'applies', 'usage', 'expires', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const groupLabel = (d: Discount) => discountGroupLabel(d, (id) => inventory.find((item) => item.id === id)?.name)
  const appliesLabel = (d: Discount) => DISCOUNT_APPLIES.find((a) => a.id === d.appliesTo)?.label || d.appliesTo || ''
  const valueLabel = (d: Discount) => (d.type === 'percentage' ? `${d.value}%` : formatGhs(d.value))

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...discounts]
      .filter((d) => (statusFilter === 'all' ? true : d.status === statusFilter))
      .filter((d) => !ql || d.name.toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (d: Discount): string | number => {
      switch (sortKey) {
        case 'type': return d.type.toLowerCase()
        case 'value': return d.value
        case 'group': return groupLabel(d).toLowerCase()
        case 'applies': return appliesLabel(d).toLowerCase()
        case 'usage': return d.used
        case 'expires': return d.expiresAt || ''
        case 'status': return d.status.toLowerCase()
        default: return d.name.toLowerCase()
      }
    }
    const recency = (d: Discount) => d.createdAt || ''
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      if (cmp !== 0) return cmp
      // Always newest-created first, whichever direction the column is sorted.
      return recency(b).localeCompare(recency(a))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discounts, q, statusFilter, sortKey, sortDir, inventory])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, statusFilter, showEntries])
  const totalPages = Math.max(1, Math.ceil(rows.length / showEntries))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * showEntries, safePage * showEntries),
    [rows, safePage, showEntries],
  )

  // ---- Toolbar actions (identical behaviour to Supplier payments) ----
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  /** Every filtered record — exports ignore pagination, matching Supplier payments. */
  const exportRows = (): Record<string, string | number>[] => rows.map((d) => ({
    Name: d.name,
    Type: d.type === 'percentage' ? 'Percentage' : 'Fixed',
    Value: valueLabel(d),
    Group: groupLabel(d),
    'Applies to': appliesLabel(d),
    Usage: d.used,
    'Usage limit': d.usageLimit || 0,
    'Valid until': d.expiresAt || '',
    Status: d.status,
  }))

  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || {})
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const val = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(val) ? `"${val}"` : val
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'discounts.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('discounts', exportRows())
    setBusy(''); if (ok) flashDone('excel')
  }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }

  const ToolbarBtn = ({ label, icon, onClick, busyKey, doneKey }:
    { label: string; icon: React.ReactNode; onClick: () => void; busyKey: typeof busy; doneKey: typeof done }) => (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={busy !== ''}
        aria-label={label}
        data-bs-toggle="tooltip"
        data-bs-placement="top"
        data-bs-title={label}
        className="btn grid size-10 place-items-center disabled:cursor-wait disabled:opacity-60" style={{ padding: 0 }}
      >
        {done === doneKey ? <Check className="size-5 text-emerald-500" strokeWidth={3} style={{ width: 20, height: 20 }} /> : icon}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-[0.375rem] bg-[#212529] px-2 py-1.5 text-sm font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {label}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#212529]" aria-hidden="true" />
      </span>
    </span>
  )

  const HEAD: { id: ColId; label: string; sort?: SortKey }[] = [
    { id: 'action', label: 'Action' },
    { id: 'name', label: 'Name', sort: 'name' },
    { id: 'type', label: 'Type', sort: 'type' },
    { id: 'value', label: 'Value', sort: 'value' },
    { id: 'group', label: 'Group', sort: 'group' },
    { id: 'applies', label: 'Applies to', sort: 'applies' },
    { id: 'usage', label: 'Usage', sort: 'usage' },
    { id: 'expires', label: 'Valid until', sort: 'expires' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const openNew = () => setEditing(blank())
  const openEdit = (d: Discount) => setEditing({
    id: d.id, name: d.name, type: d.type, value: String(d.value),
    minSpend: d.minSpend != null ? String(d.minSpend) : '',
    maxDiscount: d.maxDiscount != null ? String(d.maxDiscount) : '',
    usageLimit: d.usageLimit != null ? String(d.usageLimit) : '',
    perCustomerLimit: d.perCustomerLimit != null ? String(d.perCustomerLimit) : '',
    startsAt: d.startsAt || '', expiresAt: d.expiresAt || '', status: d.status, appliesTo: d.appliesTo || 'all',
    group: d.group || 'general', productId: d.productId || '',
  })

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter a discount name.'); return }
    const value = Number(editing.value)
    if (!Number.isFinite(value) || value <= 0) { toast.error('Enter a valid discount value.'); return }
    if (editing.type === 'percentage' && value > 100) { toast.error('Percentage must be 100 or less.'); return }
    if (editing.group === 'specific_product' && !editing.productId) { toast.error('Assign a product to this discount, or switch the group back to General.'); return }

    // The code is no longer an input — derive it from the name and suffix
    // duplicates so stored records (POS labels, sale references) stay valid.
    const base = editing.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'DISCOUNT'
    let code = base
    let n = 2
    while (discounts.some((d) => d.code.toLowerCase() === code.toLowerCase() && d.id !== editing.id)) {
      code = `${base}-${n++}`
    }

    const isNew = !editing.id
    const rec: Discount = {
      id: editing.id || uid('dc'),
      code,
      name: editing.name.trim(),
      type: editing.type,
      value,
      minSpend: editing.minSpend ? Number(editing.minSpend) : undefined,
      maxDiscount: editing.type === 'percentage' && editing.maxDiscount ? Number(editing.maxDiscount) : undefined,
      usageLimit: editing.usageLimit ? Number(editing.usageLimit) : 0,
      perCustomerLimit: editing.perCustomerLimit ? Number(editing.perCustomerLimit) : undefined,
      startsAt: editing.startsAt || undefined,
      expiresAt: editing.expiresAt || undefined,
      status: editing.status,
      appliesTo: editing.appliesTo,
      group: editing.group,
      productId: editing.group === 'specific_product' ? editing.productId : undefined,
      used: isNew ? 0 : (discounts.find((d) => d.id === editing.id)?.used || 0),
      createdAt: isNew ? new Date().toISOString() : (discounts.find((d) => d.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertDiscount(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Discount', `${isNew ? 'Created' : 'Updated'} ${rec.name}`)
    toast.success(isNew ? 'Discount created' : 'Discount updated', rec.name)
    // Surface the record just saved: reset to the default name-asc sort and
    // page 1 so the row is visible, then flash it.
    setSortKey('name'); setSortDir('asc'); setPage(1)
    setJustSaved(rec.id)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteDiscount(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Discount', `Deleted ${deleting.name}`)
    toast.success('Discount deleted', deleting.name)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Discounts"
        desc="Create and manage discounts and promos for sales."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New discount</Button> : undefined}
      />

      <section className="mt-4 rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm" style={{ color: TEXT_MUTED }}>
              <span>Show</span>
              <Select value={String(showEntries)} onChange={(e) => { setShowEntries(Number(e.target.value)); setPage(1) }} className="w-20">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </Select>
              <span>entries</span>
            </div>
            <ToolbarBtn label="Export CSV" icon={<Download className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handleCsv} busyKey="csv" doneKey="csv" />
            <ToolbarBtn label="Export Excel" icon={<FileSpreadsheet className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={() => void handleExcel()} busyKey="excel" doneKey="excel" />
            <ToolbarBtn label="Print" icon={<Printer className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePrint} busyKey="print" doneKey="print" />
            <div className="relative" ref={colsRef}>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={() => setColsOpen((v) => !v)}
                  aria-expanded={colsOpen}
                  aria-label="Column visibility"
                  data-bs-toggle="tooltip"
                  data-bs-placement="top"
                  data-bs-title="Column visibility"
                  className="btn grid size-10 place-items-center" style={{ padding: 0 }}
                >
                  <Columns3 className="size-5" aria-hidden style={{ width: 20, height: 20 }} />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-2 -translate-x-1/2 whitespace-nowrap rounded-[0.375rem] bg-[#212529] px-2 py-1.5 text-sm font-normal leading-5 text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                >
                  Column visibility
                  <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-[#212529]" aria-hidden="true" />
                </span>
              </span>
              {colsOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border py-2 shadow-xl" style={{ background: CARD_BG, borderColor: INPUT_BD }} onClick={(e) => e.stopPropagation()}>
                  {HEAD.filter((h) => h.id !== 'action').map((h) => {
                    const on = visibleCols.has(h.id)
                    return (
                      <label key={h.id} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm" style={{ color: TEXT }}>
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setVisibleCols((cur) => {
                            const next = new Set(cur)
                            if (next.has(h.id)) next.delete(h.id)
                            else next.add(h.id)
                            return next
                          })}
                          className="size-4 accent-indigo-600"
                        />
                        {h.label}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
            <ToolbarBtn label="Export PDF" icon={<Tag className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePdf} busyKey="pdf" doneKey="pdf" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[13rem]">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search discounts…"
              aria-label="Search discounts"
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ background: INPUT_BG, borderColor: INPUT_BD, color: TEXT }}
            />
          </span>
        </div>

        <div className="mt-3 overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr style={{ background: TABLE_HEAD_BG }}>
                {shownHead.map((h) => (
                  <th
                    key={h.id}
                    scope="col"
                    onClick={h.sort ? () => toggleSort(h.sort as SortKey) : undefined}
                    className={'whitespace-nowrap px-3 py-3 text-left font-semibold ' + (h.sort ? 'cursor-pointer select-none' : '')}
                    style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}
                  >
                    {h.label}
                    {h.sort && <SortIcon col={h.sort} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((d, idx) => (
                <tr
                  key={d.id}
                  style={{
                    background: d.id === justSaved
                      ? (isDark ? 'rgba(132,204,22,0.16)' : 'rgba(132,204,22,0.18)')
                      : idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      {canManage && (
                        <>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit discount" onClick={() => openEdit(d)}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete discount" onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  )}
                  {visibleCols.has('name') && <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{d.name}</td>}
                  {visibleCols.has('type') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{d.type === 'percentage' ? 'Percentage' : 'Fixed'}</td>}
                  {visibleCols.has('value') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{valueLabel(d)}</td>}
                  {visibleCols.has('group') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{groupLabel(d)}</td>}
                  {visibleCols.has('applies') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{appliesLabel(d)}</td>}
                  {visibleCols.has('usage') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{d.used}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>}
                  {visibleCols.has('expires') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{d.expiresAt ? formatDate(d.expiresAt) : '—'}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><Badge tone={tone(d.status)}>{d.status}</Badge></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No discounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-5" style={{ color: TEXT_MUTED }}>
          <span className="text-sm">
            {rows.length === 0
              ? 'Showing 0 to 0 of 0 entries'
              : `Showing ${(safePage - 1) * showEntries + 1} to ${Math.min(safePage * showEntries, rows.length)} of ${rows.length} entries`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm disabled:opacity-40"
              style={{ borderColor: INPUT_BD, color: TEXT }}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </button>
            <span className="px-2 text-sm">{safePage} / {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm disabled:opacity-40"
              style={{ borderColor: INPUT_BD, color: TEXT }}
            >
              Next <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit discount' : 'New discount'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. New member welcome" /></Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as DiscountType })}>
                  {DISCOUNT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label={editing.type === 'percentage' ? 'Value (%)' : 'Value (GHS)'} required>
                <Input type="number" min={0} value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
              </Field>
              <Field label="Applies to">
                <Select value={editing.appliesTo} onChange={(e) => setEditing({ ...editing, appliesTo: e.target.value as FormState['appliesTo'] })}>
                  {DISCOUNT_APPLIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                </Select>
              </Field>
              <Field label="Discount group">
                <Select value={editing.group} onChange={(e) => setEditing({ ...editing, group: e.target.value as FormState['group'], productId: e.target.value === 'specific_product' ? editing.productId : '' })}>
                  <option value="general">General (all products)</option>
                  <option value="specific_product">Specific product</option>
                </Select>
              </Field>
              {editing.group === 'specific_product' && (
                <Field label="Assign product / program" required>
                  <Select value={editing.productId} onChange={(e) => setEditing({ ...editing, productId: e.target.value })}>
                    <option value="">Select a product…</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {item.sku} ({formatGhs(item.sellPrice)})</option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as DiscountStatus })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="expired">expired</option>
                </Select>
              </Field>
              <Field label="Minimum spend (optional)"><Input type="number" min={0} value={editing.minSpend} onChange={(e) => setEditing({ ...editing, minSpend: e.target.value })} /></Field>
              {editing.type === 'percentage' && (
                <Field label="Max discount (optional)"><Input type="number" min={0} value={editing.maxDiscount} onChange={(e) => setEditing({ ...editing, maxDiscount: e.target.value })} /></Field>
              )}
              <Field label="Usage limit (0 = unlimited)"><Input type="number" min={0} value={editing.usageLimit} onChange={(e) => setEditing({ ...editing, usageLimit: e.target.value })} /></Field>
              <Field label="Per-customer limit (optional)"><Input type="number" min={0} value={editing.perCustomerLimit} onChange={(e) => setEditing({ ...editing, perCustomerLimit: e.target.value })} /></Field>
              <Field label="Starts on (optional)"><DatePicker value={editing.startsAt} onChange={(v) => setEditing({ ...editing, startsAt: v })} /></Field>
              <Field label="Expires on (optional)"><DatePicker value={editing.expiresAt} onChange={(v) => setEditing({ ...editing, expiresAt: v })} /></Field>
            </div>

            {editing.value && Number(editing.value) > 0 && (
              <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm">
                <p className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-lime" /> Preview</p>
                <p className="mt-1 text-mist">
                  {editing.group === 'specific_product' ? 'A GHS 1000 order containing the assigned product would get ' : 'A GHS 1000 order would get '}
                  <span className="font-semibold text-inherit">
                    {formatGhs(computeDiscount(
                      { ...(editing as unknown as Discount), status: 'active', used: 0 },
                      1000,
                      editing.productId ? [editing.productId] : undefined,
                    ))}
                  </span>{' '}
                  off.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}><Percent className="size-4" /> {editing.id ? 'Save discount' : 'Create discount'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete discount?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete discount <span className="font-semibold text-inherit">{deleting.name}</span>? This cannot be undone.
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
