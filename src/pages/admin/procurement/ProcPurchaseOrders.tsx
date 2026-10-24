import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Send, Check, X, PackagePlus,
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
import {
  nextProcPoNumber, poTotals, isEditable, isDeletable, canReceive, statusLabel,
  PROC_PO_STATUSES, receivedQty,
} from '../../../lib/procurement'
import { ProcStatus, DocProgress, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import { costCenterOnLineItems } from '../../../lib/costCenters'
import { CostCenterSelect } from '../../../components/CostCenterSelect'
import type { ProcPOLine, ProcPurchaseOrder } from '../../../types'

type LineDraft = { itemId: string; qty: string; unitCost: string; discount: string; tax: string; costCenterId?: string }

const blankLine: LineDraft = { itemId: '', qty: '1', unitCost: '', discount: '0', tax: '0' }

type SortKey = 'number' | 'supplier' | 'date' | 'required' | 'warehouse' | 'total' | 'status'
type ColId = SortKey | 'action'

export function ProcPurchaseOrders() {
  const {
    procPurchaseOrders, goodsReceipts, inventory, suppliers, branches, company,
    upsertProcPurchaseOrder, deleteProcPurchaseOrder, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')
  const showCostCenter = costCenterOnLineItems(company)
  // Approving your own request is a segregation-of-duties break, so approval is
  // limited to managers rather than all staff.
  const canApprove = hasRole('super_admin', 'gym_manager', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<
    | {
        id?: string; number: string; supplierId: string; date: string; requiredDate: string
        warehouseId: string; department: string; currency: string; paymentTerms: string
        requestedBy: string; notes: string; lines: LineDraft[]
      }
    | null
  >(null)
  const [deleting, setDeleting] = useState<ProcPurchaseOrder | null>(null)
  const [rejecting, setRejecting] = useState<ProcPurchaseOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name || '—'

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
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'supplier', 'date', 'required', 'warehouse', 'total', 'status']))

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
    const list = [...procPurchaseOrders]
      .filter((o) => (statusFilter === 'all' ? true : o.status === statusFilter))
      .filter((o) => !ql || o.number.toLowerCase().includes(ql) || supplierName(o.supplierId).toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (o: ProcPurchaseOrder): string | number => {
      switch (sortKey) {
        case 'number': return o.number.toLowerCase()
        case 'supplier': return supplierName(o.supplierId).toLowerCase()
        case 'required': return o.requiredDate || ''
        case 'warehouse': return branchName(o.warehouseId).toLowerCase()
        case 'total': return o.total
        case 'status': return statusLabel(o.status).toLowerCase()
        default: return o.date
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }, [procPurchaseOrders, q, statusFilter, suppliers, sortKey, sortDir, branches])

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
  const exportRows = (): Record<string, string | number>[] => rows.map((o) => ({
    Number: o.number,
    Supplier: supplierName(o.supplierId),
    Date: o.date,
    Required: o.requiredDate || '',
    Warehouse: branchName(o.warehouseId),
    Total: o.total,
    Status: statusLabel(o.status),
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
    const a = document.createElement('a'); a.href = url; a.download = 'purchase-orders.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('purchase-orders', exportRows())
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
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'required', label: 'Required', sort: 'required' },
    { id: 'warehouse', label: 'Warehouse', sort: 'warehouse' },
    { id: 'total', label: 'Total', sort: 'total' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120


  const open = procPurchaseOrders.find((o) => o.id === openId) || null
  const openReceipts = open ? goodsReceipts.filter((g) => g.purchaseOrderId === open.id) : []

  const openNew = () => setEditing({
    number: nextProcPoNumber(procPurchaseOrders),
    supplierId: suppliers[0]?.id || '',
    date: new Date().toISOString().slice(0, 10), requiredDate: '',
    warehouseId: branches[0]?.id || '', department: '', currency: 'GHS', paymentTerms: 'Net 30',
    requestedBy: user?.name || '', notes: '', lines: [{ ...blankLine }],
  })

  const openEdit = (o: ProcPurchaseOrder) => setEditing({
    id: o.id, number: o.number, supplierId: o.supplierId, date: o.date,
    requiredDate: o.requiredDate || '', warehouseId: o.warehouseId || '',
    department: o.department || '', currency: o.currency || 'GHS',
    paymentTerms: o.paymentTerms || '', requestedBy: o.requestedBy || '', notes: o.notes || '',
    lines: o.lines.map((l) => ({
      itemId: l.itemId, qty: String(l.quantity), unitCost: String(l.unitCost),
      discount: String(l.discountPercent ?? 0), tax: String(l.taxRate ?? 0),
      costCenterId: l.costCenterId,
    })),
  })

  const draftTotals = useMemo(() => {
    if (!editing) return { subtotal: 0, discountTotal: 0, taxTotal: 0, total: 0 }
    return poTotals(editing.lines.map((l) => ({
      quantity: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0,
      discountPercent: Number(l.discount) || 0, taxRate: Number(l.tax) || 0,
    })))
  }, [editing])

  /** Persist the draft. `submit` sends it straight into the approval queue. */
  const save = (submit: boolean) => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Order number is required.'); return }
    if (!editing.supplierId) { toast.error('Select a supplier.'); return }

    const lines: ProcPOLine[] = editing.lines
      .map((l): ProcPOLine | null => {
        const quantity = Number(l.qty)
        const unitCost = Number(l.unitCost)
        if (!l.itemId || !Number.isFinite(unitCost) || !Number.isFinite(quantity) || quantity <= 0) return null
        return {
          itemId: l.itemId, quantity, unitCost,
          discountPercent: Number(l.discount) || 0,
          taxRate: Number(l.tax) || 0,
          costCenterId: l.costCenterId || undefined,
        }
      })
      .filter((l): l is ProcPOLine => l != null)
    if (!lines.length) { toast.error('Add at least one line with an item, quantity and cost.'); return }

    const t = poTotals(lines)
    const existing = procPurchaseOrders.find((o) => o.id === editing.id)
    const isNew = !editing.id
    const rec: ProcPurchaseOrder = {
      ...(existing || {} as ProcPurchaseOrder),
      id: editing.id || uid('ppo'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      date: editing.date,
      requiredDate: editing.requiredDate || undefined,
      warehouseId: editing.warehouseId || undefined,
      department: editing.department.trim() || undefined,
      currency: editing.currency || undefined,
      paymentTerms: editing.paymentTerms.trim() || undefined,
      requestedBy: editing.requestedBy.trim() || undefined,
      notes: editing.notes.trim() || undefined,
      lines,
      subtotal: t.subtotal, discountTotal: t.discountTotal, taxTotal: t.taxTotal, total: t.total,
      status: submit ? 'pending_approval' : (existing?.status || 'draft'),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    upsertProcPurchaseOrder(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Purchase Order',
      `${submit ? 'Submitted for approval' : isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(rec.total)}`)
    toast.success(submit ? 'Submitted for approval' : isNew ? 'Purchase order created' : 'Purchase order updated', rec.number)
    setEditing(null)
  }

  /** Workflow transition helper — records who acted and when. */
  const transition = (o: ProcPurchaseOrder, patch: Partial<ProcPurchaseOrder>, action: string, msg: string) => {
    upsertProcPurchaseOrder({ ...o, ...patch })
    log(user?.id || 'system', action, 'Purchase Order', `${msg} ${o.number}`)
    toast.success(msg, o.number)
  }

  const approve = (o: ProcPurchaseOrder) => transition(
    o, { status: 'approved', approvedBy: user?.name || 'system', approvedAt: new Date().toISOString(), rejectedReason: undefined },
    'APPROVE', 'Purchase order approved',
  )

  const doReject = () => {
    if (!rejecting) return
    transition(rejecting, { status: 'rejected', rejectedReason: rejectReason.trim() || 'No reason given.' }, 'REJECT', 'Purchase order rejected')
    setRejecting(null); setRejectReason('')
  }

  const sendToSupplier = (o: ProcPurchaseOrder) => transition(
    o, { status: 'sent', sentAt: new Date().toISOString() }, 'SEND', 'Purchase order sent to supplier',
  )

  const closeOrder = (o: ProcPurchaseOrder) => transition(o, { status: 'closed' }, 'UPDATE', 'Purchase order closed')
  const cancelOrder = (o: ProcPurchaseOrder) => transition(o, { status: 'cancelled' }, 'UPDATE', 'Purchase order cancelled')

  const doDelete = () => {
    if (!deleting) return
    if (goodsReceipts.some((g) => g.purchaseOrderId === deleting.id)) {
      toast.error('Cannot delete', 'This order already has goods receipts against it.')
      setDeleting(null); return
    }
    deleteProcPurchaseOrder(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Order', `Deleted ${deleting.number}`)
    toast.success('Purchase order deleted', deleting.number)
    setDeleting(null)
  }

  const emailPo = (o: ProcPurchaseOrder) => {
    const sup = suppliers.find((s) => s.id === o.supplierId)
    const body = `Dear ${sup?.name || 'Supplier'},%0D%0A%0D%0APlease find our purchase order ${o.number} dated ${formatDate(o.date)} for a total of ${formatGhsExact(o.total)}.%0D%0A%0D%0ARegards,%0D%0A${company.name}`
    window.location.href = `mailto:${sup?.email || ''}?subject=Purchase Order ${o.number}&body=${body}`
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : e)

  return (
    <div>
      <PageHeader
        title="Purchase orders"
        desc="Orders raised with suppliers. Approving or sending an order never moves stock — only a posted goods receipt does."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New purchase order</Button> : undefined}
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
              {PROC_PO_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search number or supplier…"
              aria-label="Search purchase orders"
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
              {pageRows.map((o, idx) => (
                <tr key={o.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(o.id)}><FileText className="size-4" /></button>
                      {canManage && isEditable(o.status) && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(o)}><Pencil className="size-4" /></button>
                      )}
                      {canApprove && o.status === 'pending_approval' && (
                        <>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Approve" onClick={() => approve(o)}><Check className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Reject" onClick={() => { setRejecting(o); setRejectReason('') }}><X className="size-4" /></button>
                        </>
                      )}
                      {canManage && o.status === 'approved' && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Send to supplier" onClick={() => sendToSupplier(o)}><Send className="size-4" /></button>
                      )}
                      {canManage && canReceive(o.status) && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Receive goods (GRN)" onClick={() => navigate(`/admin/goods-receipts?po=${o.id}`)}><PackagePlus className="size-4" /></button>
                      )}
                      {canManage && isDeletable(o.status) && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(o)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{o.number}</td>}
                  {visibleCols.has('supplier') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{supplierName(o.supplierId)}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(o.date)}</td>}
                  {visibleCols.has('required') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{o.requiredDate ? formatDate(o.requiredDate) : '—'}</td>}
                  {visibleCols.has('warehouse') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{branchName(o.warehouseId)}</td>}
                  {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(o.total)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={o.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No purchase orders found.
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
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase order'} wide>
        {open && (
          <div className="space-y-4">
            <DocProgress status={open.status} />

            {open.status === 'rejected' && open.rejectedReason && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm">
                <span className="font-semibold">Rejected:</span> {open.rejectedReason}
              </div>
            )}

            <div id="po-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Purchase Order</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {open.requiredDate && <p className="text-xs text-zinc-500">Required {formatDate(open.requiredDate)}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                <p><span className="font-semibold">Warehouse:</span> {branchName(open.warehouseId)}</p>
                <p><span className="font-semibold">Department:</span> {open.department || '—'}</p>
                <p><span className="font-semibold">Payment terms:</span> {open.paymentTerms || '—'}</p>
                <p><span className="font-semibold">Requested by:</span> {open.requestedBy || '—'}</p>
                <p><span className="font-semibold">Approved by:</span> {open.approvedBy || '—'}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Unit cost</th>
                      <th className="px-3 py-2 text-right">Disc %</th>
                      <th className="px-3 py-2 text-right">Tax %</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, idx) => {
                      const gross = l.quantity * l.unitCost
                      const net = gross - gross * ((l.discountPercent || 0) / 100)
                      const total = net + net * ((l.taxRate || 0) / 100)
                      const got = receivedQty(goodsReceipts, open.id, l.itemId)
                      return (
                        <tr key={idx} className="border-t border-zinc-100">
                          <td className="px-3 py-2">{itemName(l.itemId)}</td>
                          <td className="px-3 py-2 text-right">{l.quantity}</td>
                          <td className="px-3 py-2 text-right">{got}{got < l.quantity ? ` / ${l.quantity}` : ''}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                          <td className="px-3 py-2 text-right">{l.discountPercent || 0}</td>
                          <td className="px-3 py-2 text-right">{l.taxRate || 0}</td>
                          <td className="px-3 py-2 text-right">{formatGhsExact(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <div className="w-56 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatGhsExact(open.subtotal)}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>−{formatGhsExact(open.discountTotal)}</span></div>
                  <div className="flex justify-between"><span>Tax</span><span>{formatGhsExact(open.taxTotal)}</span></div>
                  <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                    <span>Total</span><span>{formatGhsExact(open.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Created', at: open.createdAt, by: open.requestedBy },
                  { label: 'Approved', at: open.approvedAt, by: open.approvedBy },
                  { label: 'Sent to supplier', at: open.sentAt },
                  ...openReceipts.filter((g) => g.status === 'posted').map((g) => ({
                    label: `Goods received — ${g.number}`, at: g.postedAt, by: g.receivedBy,
                  })),
                  ...(open.status === 'rejected' ? [{ label: 'Rejected', at: open.createdAt, tone: 'rose' as const }] : []),
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  {open.requisitionId && <DocChip label="From requisition" />}
                  {openReceipts.length
                    ? openReceipts.map((g) => (
                        <DocChip key={g.id} label={`${g.number} · ${statusLabel(g.status)}`} onClick={() => navigate('/admin/goods-receipts')} />
                      ))
                    : <p className="text-xs text-mist">No goods receipts yet.</p>}
                </RelatedDocs>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print PO</Button>
              <Button variant="ghost" onClick={() => emailPo(open)}><Send className="size-4" /> Email PO</Button>
              {canApprove && open.status === 'pending_approval' && (
                <>
                  <Button variant="ghost" onClick={() => { setRejecting(open); setRejectReason(''); setOpenId(null) }}>Reject</Button>
                  <Button onClick={() => { approve(open); setOpenId(null) }}><Check className="size-4" /> Approve</Button>
                </>
              )}
              {canManage && open.status === 'approved' && (
                <Button onClick={() => { sendToSupplier(open); setOpenId(null) }}><Send className="size-4" /> Send to supplier</Button>
              )}
              {canManage && canReceive(open.status) && (
                <Button onClick={() => navigate(`/admin/goods-receipts?po=${open.id}`)}><PackagePlus className="size-4" /> Receive goods</Button>
              )}
              {canManage && open.status === 'fully_received' && (
                <Button variant="ghost" onClick={() => { closeOrder(open); setOpenId(null) }}>Close order</Button>
              )}
              {canManage && (open.status === 'approved' || open.status === 'sent') && (
                <Button variant="ghost" onClick={() => { cancelOrder(open); setOpenId(null) }}>Cancel order</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit purchase order' : 'New purchase order'} xl>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="PO number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Supplier" required>
                <Select value={editing.supplierId} onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Order date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Required date"><DatePicker value={editing.requiredDate} onChange={(v) => setEditing({ ...editing, requiredDate: v })} /></Field>
              <Field label="Warehouse">
                <Select value={editing.warehouseId} onChange={(e) => setEditing({ ...editing, warehouseId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Department"><Input value={editing.department} onChange={(e) => setEditing({ ...editing, department: e.target.value })} placeholder="e.g. Operations" /></Field>
              <Field label="Currency">
                <Select value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                  {['GHS', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Payment terms"><Input value={editing.paymentTerms} onChange={(e) => setEditing({ ...editing, paymentTerms: e.target.value })} placeholder="e.g. Net 30" /></Field>
              <Field label="Requested by"><Input value={editing.requestedBy} onChange={(e) => setEditing({ ...editing, requestedBy: e.target.value })} /></Field>
            </div>

            <div>
              <SubHead>Items</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Item</th><th className="w-24">Qty</th><th className="w-32">Unit cost</th><th className="w-24">Disc %</th><th className="w-24">Tax %</th>{showCostCenter && <th className="w-52">Cost center</th>}<th className="w-32 text-right">Total</th><th /></tr>
                  </thead>
                  <tbody>
                    {editing.lines.map((l, i) => {
                      const gross = (Number(l.qty) || 0) * (Number(l.unitCost) || 0)
                      const net = gross - gross * ((Number(l.discount) || 0) / 100)
                      const total = net + net * ((Number(l.tax) || 0) / 100)
                      return (
                        <tr key={i}>
                          <td>
                            <Select value={l.itemId} onChange={(e) => {
                              const v = e.target.value
                              const inv = inventory.find((x) => x.id === v)
                              setLine(i, { itemId: v, unitCost: l.unitCost || String(inv?.costPrice ?? '') })
                            }}>
                              <option value="">Please Select…</option>
                              {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}{it.sku ? ` — ${it.sku}` : ''}</option>)}
                            </Select>
                          </td>
                          <td><Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.tax} onChange={(e) => setLine(i, { tax: e.target.value })} inputMode="decimal" /></td>
                          {showCostCenter && <td><CostCenterSelect value={l.costCenterId} onChange={(id) => setLine(i, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${i + 1}`} /></td>}
                          <td className="text-right text-sm">{formatGhsExact(total)}</td>
                          <td>
                            {editing.lines.length > 1 && (
                              <button className="rounded-lg p-2 text-mist hover:text-ember" title="Remove line"
                                onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, idx) => idx !== i) })}>
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Button variant="ghost" className="mt-2" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { ...blankLine }] })}>
                <Plus className="size-4" /> Add line
              </Button>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between text-mist"><span>Subtotal</span><span>{formatGhsExact(draftTotals.subtotal)}</span></div>
                <div className="flex justify-between text-mist"><span>Discount</span><span>−{formatGhsExact(draftTotals.discountTotal)}</span></div>
                <div className="flex justify-between text-mist"><span>Tax</span><span>{formatGhsExact(draftTotals.taxTotal)}</span></div>
                <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold"><span>Total</span><span>{formatGhsExact(draftTotals.total)}</span></div>
              </div>
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

      {/* ── Reject ─────────────────────────────────────────────────────── */}
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Reject purchase order">
        <div className="space-y-3">
          <p className="text-sm text-mist">Rejecting <span className="font-mono font-semibold">{rejecting?.number}</span> returns it to the requester for amendment.</p>
          <Field label="Reason" required><Textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Why is this being rejected?" /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="danger" onClick={doReject}>Reject order</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete purchase order">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? This cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
