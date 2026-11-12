import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Check, X, Send, ShoppingCart, Printer,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { exportExcel } from '../../../lib/export'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextRequisitionNumber, nextProcPoNumber, poTotals, statusLabel, REQUISITION_STATUSES } from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import { costCenterOnLineItems } from '../../../lib/costCenters'
import { CostCenterSelect } from '../../../components/CostCenterSelect'
import type { ProcPurchaseOrder, PurchaseRequisition, RequisitionLine } from '../../../types'

type LineDraft = { itemId: string; qty: string; estCost: string; costCenterId?: string }

type SortKey = 'number' | 'requestedBy' | 'department' | 'date' | 'required' | 'warehouse' | 'value' | 'status'
type ColId = SortKey | 'action'

export function PurchaseRequisitions() {
  const {
    requisitions, procPurchaseOrders, inventory, branches, suppliers, company,
    upsertRequisition, deleteRequisition, upsertProcPurchaseOrder, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const showCostCenter = costCenterOnLineItems(company)
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')
  const canApprove = hasRole('super_admin', 'gym_manager', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<PurchaseRequisition | null>(null)
  const [rejecting, setRejecting] = useState<PurchaseRequisition | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [converting, setConverting] = useState<PurchaseRequisition | null>(null)
  const [convertSupplier, setConvertSupplier] = useState('')
  const [editing, setEditing] = useState<
    | { id?: string; number: string; department: string; warehouseId: string; requestedBy: string
        date: string; requiredDate: string; notes: string; lines: LineDraft[] }
    | null
  >(null)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name || '—'

  /** Estimated value of a requisition — used by the table, sorting and exports. */
  const estValue = (r: PurchaseRequisition) => r.lines.reduce((s, l) => s + l.quantity * (l.estimatedCost || 0), 0)

  // Theme tokens — mirror the All Purchases list so both pages match in either theme.
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

  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'requestedBy', 'department', 'date', 'required', 'warehouse', 'value', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...requisitions]
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => !ql || r.number.toLowerCase().includes(ql) || (r.department || '').toLowerCase().includes(ql) || r.requestedBy.toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (r: PurchaseRequisition): string | number => {
      switch (sortKey) {
        case 'number': return r.number.toLowerCase()
        case 'requestedBy': return r.requestedBy.toLowerCase()
        case 'department': return (r.department || '').toLowerCase()
        case 'required': return r.requiredDate || ''
        case 'warehouse': return branchName(r.warehouseId).toLowerCase()
        case 'value': return estValue(r)
        case 'status': return statusLabel(r.status).toLowerCase()
        default: return r.date
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }, [requisitions, q, statusFilter, sortKey, sortDir, branches])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, statusFilter, showEntries])
  const totalPages = Math.max(1, Math.ceil(rows.length / showEntries))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * showEntries, safePage * showEntries),
    [rows, safePage, showEntries],
  )

  // ---- Toolbar actions (identical behaviour to All Purchases) ----
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  /** Every filtered record — exports ignore pagination, matching All Purchases. */
  const exportRows = (): Record<string, string | number>[] => rows.map((r) => ({
    Number: r.number,
    'Requested By': r.requestedBy,
    Department: r.department || '',
    Date: r.date,
    Required: r.requiredDate || '',
    Warehouse: branchName(r.warehouseId),
    'Est. Value': estValue(r),
    Status: statusLabel(r.status),
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
    const a = document.createElement('a'); a.href = url; a.download = 'purchase-requisitions.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('purchase-requisitions', exportRows())
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
    { id: 'number', label: 'Number', sort: 'number' },
    { id: 'requestedBy', label: 'Requested by', sort: 'requestedBy' },
    { id: 'department', label: 'Department', sort: 'department' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'required', label: 'Required', sort: 'required' },
    { id: 'warehouse', label: 'Warehouse', sort: 'warehouse' },
    { id: 'value', label: 'Est. value', sort: 'value' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120


  const open = requisitions.find((r) => r.id === openId) || null

  const openNew = () => setEditing({
    number: nextRequisitionNumber(requisitions), department: '', warehouseId: branches[0]?.id || '',
    requestedBy: user?.name || '', date: new Date().toISOString().slice(0, 10), requiredDate: '',
    notes: '', lines: [{ itemId: '', qty: '1', estCost: '' }],
  })

  const openEdit = (r: PurchaseRequisition) => setEditing({
    id: r.id, number: r.number, department: r.department || '', warehouseId: r.warehouseId || '',
    requestedBy: r.requestedBy, date: r.date, requiredDate: r.requiredDate || '', notes: r.notes || '',
    lines: r.lines.map((l) => ({ itemId: l.itemId, qty: String(l.quantity), estCost: String(l.estimatedCost ?? ''), costCenterId: l.costCenterId })),
  })

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : e)

  const save = (submit: boolean) => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Requisition number is required.'); return }
    if (!editing.requestedBy.trim()) { toast.error('Requested by is required.'); return }

    const lines: RequisitionLine[] = editing.lines
      .map((l): RequisitionLine | null => {
        const quantity = Number(l.qty)
        if (!l.itemId || !Number.isFinite(quantity) || quantity <= 0) return null
        return { itemId: l.itemId, quantity, estimatedCost: Number(l.estCost) || undefined, costCenterId: l.costCenterId || undefined }
      })
      .filter((l): l is RequisitionLine => l != null)
    if (!lines.length) { toast.error('Add at least one item with a quantity.'); return }

    const existing = requisitions.find((r) => r.id === editing.id)
    const isNew = !editing.id
    const rec: PurchaseRequisition = {
      ...(existing || {} as PurchaseRequisition),
      id: editing.id || uid('pr'),
      number: editing.number.trim(),
      department: editing.department.trim() || undefined,
      warehouseId: editing.warehouseId || undefined,
      requestedBy: editing.requestedBy.trim(),
      date: editing.date,
      requiredDate: editing.requiredDate || undefined,
      notes: editing.notes.trim() || undefined,
      lines,
      status: submit ? 'pending_approval' : (existing?.status || 'draft'),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    upsertRequisition(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Purchase Requisition',
      `${submit ? 'Submitted' : isNew ? 'Created' : 'Updated'} ${rec.number}`)
    toast.success(submit ? 'Submitted for approval' : isNew ? 'Requisition created' : 'Requisition updated', rec.number)
    setEditing(null)
  }

  const approve = (r: PurchaseRequisition) => {
    upsertRequisition({ ...r, status: 'approved', approvedBy: user?.name || 'system', approvedAt: new Date().toISOString(), rejectedReason: undefined })
    log(user?.id || 'system', 'APPROVE', 'Purchase Requisition', `Approved ${r.number}`)
    toast.success('Requisition approved', r.number)
  }

  const doReject = () => {
    if (!rejecting) return
    upsertRequisition({ ...rejecting, status: 'rejected', rejectedReason: rejectReason.trim() || 'No reason given.' })
    log(user?.id || 'system', 'REJECT', 'Purchase Requisition', `Rejected ${rejecting.number}`)
    toast.success('Requisition rejected', rejecting.number)
    setRejecting(null); setRejectReason('')
  }

  /** Convert an approved requisition into a draft purchase order. */
  const doConvert = () => {
    if (!converting) return
    if (!convertSupplier) { toast.error('Select a supplier for the purchase order.'); return }
    const lines = converting.lines.map((l) => ({
      itemId: l.itemId,
      quantity: l.quantity,
      unitCost: l.estimatedCost ?? inventory.find((i) => i.id === l.itemId)?.costPrice ?? 0,
      discountPercent: 0,
      taxRate: 0,
      costCenterId: l.costCenterId || undefined,
    }))
    const t = poTotals(lines)
    const po: ProcPurchaseOrder = {
      id: uid('ppo'),
      number: nextProcPoNumber(procPurchaseOrders),
      supplierId: convertSupplier,
      date: new Date().toISOString().slice(0, 10),
      requiredDate: converting.requiredDate,
      warehouseId: converting.warehouseId,
      department: converting.department,
      currency: 'GHS',
      requestedBy: converting.requestedBy,
      status: 'draft',
      lines,
      subtotal: t.subtotal, discountTotal: t.discountTotal, taxTotal: t.taxTotal, total: t.total,
      notes: `Raised from requisition ${converting.number}.`,
      requisitionId: converting.id,
      createdAt: new Date().toISOString(),
    }
    upsertProcPurchaseOrder(po)
    upsertRequisition({ ...converting, status: 'converted', purchaseOrderId: po.id })
    log(user?.id || 'system', 'CREATE', 'Purchase Order', `Created ${po.number} from requisition ${converting.number}`)
    toast.success('Purchase order created', `${po.number} from ${converting.number}`)
    setConverting(null); setConvertSupplier('')
    navigate('/admin/procurement-orders')
  }

  const doDelete = () => {
    if (!deleting) return
    deleteRequisition(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Requisition', `Deleted ${deleting.number}`)
    toast.success('Requisition deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Purchase requisitions"
        desc="Internal requests for goods. Once approved, a requisition can be turned into a purchase order."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New requisition</Button> : undefined}
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
            <ToolbarBtn label="Export PDF" icon={<FileText className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePdf} busyKey="pdf" doneKey="pdf" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[13rem]">
              <option value="all">All statuses</option>
              {REQUISITION_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search number, department or requester…"
              aria-label="Search purchase requisitions"
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
              {pageRows.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(r.id)}><FileText className="size-4" /></button>
                      {canManage && (r.status === 'draft' || r.status === 'rejected') && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                      )}
                      {canApprove && r.status === 'pending_approval' && (
                        <>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Approve" onClick={() => approve(r)}><Check className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Reject" onClick={() => { setRejecting(r); setRejectReason('') }}><X className="size-4" /></button>
                        </>
                      )}
                      {canManage && r.status === 'approved' && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Convert to purchase order" onClick={() => { setConverting(r); setConvertSupplier(suppliers[0]?.id || '') }}><ShoppingCart className="size-4" /></button>
                      )}
                      {canManage && (r.status === 'draft' || r.status === 'rejected') && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{r.number}</td>}
                  {visibleCols.has('requestedBy') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{r.requestedBy}</td>}
                  {visibleCols.has('department') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{r.department || '—'}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(r.date)}</td>}
                  {visibleCols.has('required') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{r.requiredDate ? formatDate(r.requiredDate) : '—'}</td>}
                  {visibleCols.has('warehouse') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{branchName(r.warehouseId)}</td>}
                  {visibleCols.has('value') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(estValue(r))}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={r.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No requisitions found.
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

      {/* ── View ───────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Requisition'} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ProcStatus status={open.status} />
              {open.status === 'approved' && <span className="text-xs text-mist">Ready to convert into a purchase order.</span>}
            </div>

            {open.status === 'rejected' && open.rejectedReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
                <span className="font-semibold">Rejected:</span> {open.rejectedReason}
              </div>
            )}

            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p><span className="text-mist">Requested by:</span> {open.requestedBy}</p>
              <p><span className="text-mist">Department:</span> {open.department || '—'}</p>
              <p><span className="text-mist">Date:</span> {formatDate(open.date)}</p>
              <p><span className="text-mist">Required:</span> {open.requiredDate ? formatDate(open.requiredDate) : '—'}</p>
              <p><span className="text-mist">Warehouse:</span> {branchName(open.warehouseId)}</p>
              <p><span className="text-mist">Approved by:</span> {open.approvedBy || '—'}</p>
            </div>

            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Item</th><th className="text-right">Quantity</th><th className="text-right">Est. unit cost</th><th className="text-right">Est. total</th></tr></thead>
                <tbody>
                  {open.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{itemName(l.itemId)}</td>
                      <td className="text-right">{l.quantity}</td>
                      <td className="text-right">{l.estimatedCost ? formatGhsExact(l.estimatedCost) : '—'}</td>
                      <td className="text-right">{formatGhsExact(l.quantity * (l.estimatedCost || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {open.notes && <p className="text-sm text-mist">{open.notes}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Requisition raised', at: open.createdAt, by: open.requestedBy, tone: 'zinc' },
                  { label: 'Approved', at: open.approvedAt, by: open.approvedBy },
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  {open.purchaseOrderId
                    ? <DocChip label={procPurchaseOrders.find((o) => o.id === open.purchaseOrderId)?.number || 'Purchase order'} onClick={() => navigate('/admin/procurement-orders')} />
                    : <p className="text-xs text-mist">Not yet converted to a purchase order.</p>}
                </RelatedDocs>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              {canApprove && open.status === 'pending_approval' && (
                <>
                  <Button variant="ghost" onClick={() => { setRejecting(open); setRejectReason(''); setOpenId(null) }}>Reject</Button>
                  <Button onClick={() => { approve(open); setOpenId(null) }}><Check className="size-4" /> Approve</Button>
                </>
              )}
              {canManage && open.status === 'approved' && (
                <Button onClick={() => { setConverting(open); setConvertSupplier(suppliers[0]?.id || ''); setOpenId(null) }}>
                  <ShoppingCart className="size-4" /> Convert to purchase order
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit requisition' : 'New requisition'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Requisition number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Requested by" required><Input value={editing.requestedBy} onChange={(e) => setEditing({ ...editing, requestedBy: e.target.value })} /></Field>
              <Field label="Department"><Input value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="e.g. Operations" /></Field>
              <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Required date"><DatePicker value={editing.requiredDate} onChange={(v) => setEditing({ ...editing, requiredDate: v })} /></Field>
              <Field label="Warehouse">
                <Select value={editing.warehouseId} onChange={(e) => setEditing({ ...editing, warehouseId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
            </div>

            <div>
              <SubHead>Items requested</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Item</th><th className="w-28">Quantity</th><th className="w-36">Est. unit cost</th>{showCostCenter && <th className="w-52">Cost center</th>}<th className="w-32 text-right">Est. total</th><th /></tr></thead>
                  <tbody>
                    {editing.lines.map((l, i) => (
                      <tr key={i}>
                        <td>
                          <Select value={l.itemId} onChange={(e) => {
                            const v = e.target.value
                            const inv = inventory.find((x) => x.id === v)
                            setLine(i, { itemId: v, estCost: l.estCost || String(inv?.costPrice ?? '') })
                          }}>
                            <option value="">Please Select…</option>
                            {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}{it.sku ? ` — ${it.sku}` : ''}</option>)}
                          </Select>
                        </td>
                        <td><Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" /></td>
                        <td><Input value={l.estCost} onChange={(e) => setLine(i, { estCost: e.target.value })} inputMode="decimal" /></td>
                        {showCostCenter && <td><CostCenterSelect value={l.costCenterId} onChange={(id) => setLine(i, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${i + 1}`} /></td>}
                        <td className="text-right text-sm">{formatGhsExact((Number(l.qty) || 0) * (Number(l.estCost) || 0))}</td>
                        <td>
                          {editing.lines.length > 1 && (
                            <button className="rounded-lg p-2 text-mist hover:text-ember" title="Remove line"
                              onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, idx) => idx !== i) })}>
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="ghost" className="mt-2" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { itemId: '', qty: '1', estCost: '' }] })}>
                <Plus className="size-4" /> Add line
              </Button>
            </div>

            <Field label="Notes"><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="ghost" onClick={() => save(false)}>Save draft</Button>
              <Button onClick={() => save(true)}><Send className="size-4" /> Submit for approval</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Convert ────────────────────────────────────────────────────── */}
      <Modal open={!!converting} onClose={() => setConverting(null)} title="Convert to purchase order">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Creates a draft purchase order from <span className="font-mono font-semibold">{converting?.number}</span>.
            The order still needs approval before goods can be received.
          </p>
          <Field label="Supplier" required>
            <Select value={convertSupplier} onChange={(e) => setConvertSupplier(e.target.value)}>
              <option value="">Please Select…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConverting(null)}>Cancel</Button>
            <Button onClick={doConvert}><ShoppingCart className="size-4" /> Create purchase order</Button>
          </div>
        </div>
      </Modal>

      {/* ── Reject ─────────────────────────────────────────────────────── */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject requisition">
        <div className="space-y-3">
          <Field label="Reason" required><Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={doReject}>Reject</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete requisition">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
