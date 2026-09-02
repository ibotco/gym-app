import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, PackageCheck, Check,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { AttachmentField } from '../accounting/AttachmentField'
import { exportExcel } from '../../../lib/export'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextGrnNumber, receivedQty, canReceive, statusLabel, GRN_STATUSES } from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import type { AttachmentFile, GoodsReceipt, GoodsReceiptLine, ProcPurchaseOrder } from '../../../types'

/** One editable receipt row, pre-loaded with the outstanding balance. */
type LineDraft = {
  itemId: string
  ordered: number
  previously: number
  receiving: string
  rejected: string
  unitCost: string
  warehouseLocation: string
  binLocation: string
  batchNumber: string
  serialNumber: string
  expiryDate: string
}

type SortKey = 'number' | 'date' | 'supplier' | 'po' | 'warehouse' | 'qty' | 'value' | 'status'
type ColId = SortKey | 'action'

export function GoodsReceipts() {
  const {
    goodsReceipts, procPurchaseOrders, inventory, suppliers, branches, company,
    upsertGoodsReceipt, deleteGoodsReceipt, postGoodsReceipt, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<GoodsReceipt | null>(null)
  const [posting, setPosting] = useState<GoodsReceipt | null>(null)
  const [editing, setEditing] = useState<
    | {
        id?: string; number: string; date: string; purchaseOrderId: string; supplierId: string
        warehouseId: string; deliveryNoteNumber: string; receivedBy: string; remarks: string
        attachments: AttachmentFile[]; lines: LineDraft[]
      }
    | null
  >(null)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const itemSku = (id: string) => inventory.find((i) => i.id === id)?.sku || ''
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name || '—'
  const poOf = (id: string) => procPurchaseOrders.find((o) => o.id === id)

  /** Orders that may still be received against. */
  const receivablePos = useMemo(
    () => procPurchaseOrders.filter((o) => canReceive(o.status)),
    [procPurchaseOrders],
  )

  /** Build receipt rows from a PO, defaulting each line to its outstanding balance. */
  const linesForPo = (po: ProcPurchaseOrder, excludeGrnId?: string): LineDraft[] =>
    po.lines.map((l) => {
      const previously = receivedQty(goodsReceipts, po.id, l.itemId, excludeGrnId)
      const remaining = Math.max(0, l.quantity - previously)
      return {
        itemId: l.itemId, ordered: l.quantity, previously,
        receiving: String(remaining), rejected: '0', unitCost: String(l.unitCost),
        warehouseLocation: '', binLocation: '', batchNumber: '', serialNumber: '', expiryDate: '',
      }
    })

  const startForPo = (po: ProcPurchaseOrder) => setEditing({
    number: nextGrnNumber(goodsReceipts),
    date: new Date().toISOString().slice(0, 10),
    purchaseOrderId: po.id, supplierId: po.supplierId,
    warehouseId: po.warehouseId || branches[0]?.id || '',
    deliveryNoteNumber: '', receivedBy: user?.name || '', remarks: '',
    attachments: [], lines: linesForPo(po),
  })

  // Deep link from the PO screen: /admin/goods-receipts?po=<id>
  useEffect(() => {
    const poId = params.get('po')
    if (!poId) return
    const po = procPurchaseOrders.find((o) => o.id === poId)
    if (po && canReceive(po.status)) startForPo(po)
    else if (po) toast.error('Cannot receive', `${po.number} is ${statusLabel(po.status).toLowerCase()}.`)
    params.delete('po')
    setParams(params, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(
    ['action', 'number', 'date', 'supplier', 'po', 'warehouse', 'qty', 'value', 'status'],
  ))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const qtyOf = (g: GoodsReceipt) => g.lines.reduce((sum, l) => sum + l.quantityReceiving, 0)

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...goodsReceipts]
      .filter((g) => (statusFilter === 'all' ? true : g.status === statusFilter))
      .filter((g) => !ql || g.number.toLowerCase().includes(ql)
        || supplierName(g.supplierId).toLowerCase().includes(ql)
        || (poOf(g.purchaseOrderId)?.number || '').toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (g: GoodsReceipt): string | number => {
      switch (sortKey) {
        case 'number': return g.number.toLowerCase()
        case 'supplier': return supplierName(g.supplierId).toLowerCase()
        case 'po': return (poOf(g.purchaseOrderId)?.number || '').toLowerCase()
        case 'warehouse': return branchName(g.warehouseId).toLowerCase()
        case 'qty': return qtyOf(g)
        case 'value': return g.total
        case 'status': return statusLabel(g.status).toLowerCase()
        default: return g.date
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }, [goodsReceipts, q, statusFilter, suppliers, procPurchaseOrders, sortKey, sortDir, branches])

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
  const exportRows = (): Record<string, string | number>[] => rows.map((g) => ({
    GRN: g.number,
    Date: g.date,
    Supplier: supplierName(g.supplierId),
    'PO Reference': poOf(g.purchaseOrderId)?.number || '',
    Warehouse: branchName(g.warehouseId),
    'Qty Received': qtyOf(g),
    Value: g.total,
    Status: statusLabel(g.status),
  }))

  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || { GRN: '', Date: '' })
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const v = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'goods-receipts.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('goods-receipts', exportRows())
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
    { id: 'number', label: 'GRN', sort: 'number' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'po', label: 'PO reference', sort: 'po' },
    { id: 'warehouse', label: 'Warehouse', sort: 'warehouse' },
    { id: 'qty', label: 'Qty received', sort: 'qty' },
    { id: 'value', label: 'Value', sort: 'value' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const open = goodsReceipts.find((g) => g.id === openId) || null

  const openNew = () => {
    if (!receivablePos.length) {
      toast.error('Nothing to receive', 'Approve and send a purchase order first.')
      return
    }
    startForPo(receivablePos[0])
  }

  const openEdit = (g: GoodsReceipt) => {
    const po = poOf(g.purchaseOrderId)
    setEditing({
      id: g.id, number: g.number, date: g.date, purchaseOrderId: g.purchaseOrderId,
      supplierId: g.supplierId, warehouseId: g.warehouseId || '',
      deliveryNoteNumber: g.deliveryNoteNumber || '', receivedBy: g.receivedBy || '',
      remarks: g.remarks || '', attachments: g.attachments || [],
      lines: g.lines.map((l) => ({
        itemId: l.itemId,
        ordered: l.quantityOrdered,
        previously: po ? receivedQty(goodsReceipts, po.id, l.itemId, g.id) : 0,
        receiving: String(l.quantityReceiving), rejected: String(l.quantityRejected ?? 0),
        unitCost: String(l.unitCost),
        warehouseLocation: l.warehouseLocation || '', binLocation: l.binLocation || '',
        batchNumber: l.batchNumber || '', serialNumber: l.serialNumber || '',
        expiryDate: l.expiryDate || '',
      })),
    })
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : e)

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return editing.lines.reduce((s, l) => s + (Number(l.receiving) || 0) * (Number(l.unitCost) || 0), 0)
  }, [editing])

  /** Client-side over-receipt check so the user sees the error inline. */
  const lineError = (l: LineDraft): string => {
    const rec = Number(l.receiving) || 0
    if (rec < 0) return 'Negative'
    const remaining = Math.max(0, l.ordered - l.previously)
    if (rec > remaining) return `Max ${remaining}`
    return ''
  }

  const buildRecord = (): GoodsReceipt | null => {
    if (!editing) return null
    if (!editing.number.trim()) { toast.error('GRN number is required.'); return null }
    if (!editing.purchaseOrderId) { toast.error('Select a purchase order.'); return null }

    for (const l of editing.lines) {
      const err = lineError(l)
      if (err) {
        toast.error('Cannot receive more than ordered', `${itemName(l.itemId)} — only ${Math.max(0, l.ordered - l.previously)} outstanding.`)
        return null
      }
    }
    const lines: GoodsReceiptLine[] = editing.lines
      .filter((l) => (Number(l.receiving) || 0) > 0 || (Number(l.rejected) || 0) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantityOrdered: l.ordered,
        quantityReceiving: Number(l.receiving) || 0,
        quantityRejected: Number(l.rejected) || 0,
        unitCost: Number(l.unitCost) || 0,
        warehouseLocation: l.warehouseLocation.trim() || undefined,
        binLocation: l.binLocation.trim() || undefined,
        batchNumber: l.batchNumber.trim() || undefined,
        serialNumber: l.serialNumber.trim() || undefined,
        expiryDate: l.expiryDate || undefined,
      }))
    if (!lines.length) { toast.error('Enter a quantity on at least one line.'); return null }

    const existing = goodsReceipts.find((g) => g.id === editing.id)
    return {
      ...(existing || {} as GoodsReceipt),
      id: editing.id || uid('grn'),
      number: editing.number.trim(),
      date: editing.date,
      supplierId: editing.supplierId,
      purchaseOrderId: editing.purchaseOrderId,
      warehouseId: editing.warehouseId || undefined,
      deliveryNoteNumber: editing.deliveryNoteNumber.trim() || undefined,
      receivedBy: editing.receivedBy.trim() || undefined,
      remarks: editing.remarks.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      status: existing?.status === 'posted' ? 'posted' : 'draft',
      lines,
      total: lines.reduce((s, l) => s + l.quantityReceiving * l.unitCost, 0),
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
  }

  const saveDraft = () => {
    const rec = buildRecord()
    if (!rec) return
    const isNew = !editing?.id
    upsertGoodsReceipt(rec)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Goods Receipt', `${isNew ? 'Created' : 'Updated'} ${rec.number} (draft)`)
    toast.success('Goods receipt saved as draft', rec.number)
    setEditing(null)
  }

  /** Save then immediately post: this is the only action that moves stock. */
  const saveAndPost = () => {
    const rec = buildRecord()
    if (!rec) return
    // Validate and post FIRST, passing the record directly. Posting is rejected
    // for anything invalid, so nothing is saved unless the post succeeds.
    const res = postGoodsReceipt(rec.id, user?.name, rec)
    if (!res.ok) { toast.error('Could not post receipt', res.error); return }
    const po = poOf(rec.purchaseOrderId)
    log(user?.id || 'system', 'POST', 'Goods Receipt',
      `Posted ${rec.number} against ${po?.number || rec.purchaseOrderId} — stock increased by ${rec.lines.reduce((s, l) => s + l.quantityReceiving, 0)} unit(s)`)
    toast.success('Goods receipt posted', `${rec.number} — inventory updated`)
    setEditing(null)
  }

  const doPost = () => {
    if (!posting) return
    const res = postGoodsReceipt(posting.id, user?.name)
    if (!res.ok) { toast.error('Could not post receipt', res.error); setPosting(null); return }
    log(user?.id || 'system', 'POST', 'Goods Receipt', `Posted ${posting.number} — inventory updated`)
    toast.success('Goods receipt posted', `${posting.number} — inventory updated`)
    setPosting(null)
  }

  const doDelete = () => {
    if (!deleting) return
    if (deleting.status === 'posted') {
      toast.error('Cannot delete', 'Posted receipts are part of the audit trail. Raise a purchase return instead.')
      setDeleting(null); return
    }
    deleteGoodsReceipt(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Goods Receipt', `Deleted draft ${deleting.number}`)
    toast.success('Draft receipt deleted', deleting.number)
    setDeleting(null)
  }

  const selectedPo = editing ? poOf(editing.purchaseOrderId) : undefined

  return (
    <div>
      <PageHeader
        title="Goods receipts (GRN)"
        desc="Record what physically arrived. Inventory is updated only when a receipt is posted — never by the purchase order."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New goods receipt</Button> : undefined}
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
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[11rem]">
              <option value="all">All statuses</option>
              {GRN_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search GRN, PO or supplier…"
              aria-label="Search goods receipts"
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
              {pageRows.map((g, idx) => (
                <tr key={g.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(g.id)}><FileText className="size-4" /></button>
                      {canManage && g.status === 'draft' && (
                        <>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(g)}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Post receipt" onClick={() => setPosting(g)}><PackageCheck className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(g)}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{g.number}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(g.date)}</td>}
                  {visibleCols.has('supplier') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{supplierName(g.supplierId)}</td>}
                  {visibleCols.has('po') && <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{poOf(g.purchaseOrderId)?.number || '—'}</td>}
                  {visibleCols.has('warehouse') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{branchName(g.warehouseId)}</td>}
                  {visibleCols.has('qty') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{qtyOf(g)}</td>}
                  {visibleCols.has('value') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(g.total)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={g.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No goods receipts found.
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
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Goods receipt'} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ProcStatus status={open.status} />
              {open.status === 'posted' && <span className="text-xs text-mist">Inventory was updated when this receipt was posted.</span>}
              {open.status === 'draft' && <span className="text-xs text-mist">Draft — stock has not been updated yet.</span>}
            </div>

            <div id="grn-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Goods Receipt Note</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                <p><span className="font-semibold">PO reference:</span> {poOf(open.purchaseOrderId)?.number || '—'}</p>
                <p><span className="font-semibold">Warehouse:</span> {branchName(open.warehouseId)}</p>
                <p><span className="font-semibold">Delivery note:</span> {open.deliveryNoteNumber || '—'}</p>
                <p><span className="font-semibold">Received by:</span> {open.receivedBy || '—'}</p>
                <p><span className="font-semibold">Posted:</span> {open.postedAt ? formatDate(open.postedAt.slice(0, 10)) : '—'}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2 text-right">Ordered</th>
                      <th className="px-2 py-2 text-right">Received</th>
                      <th className="px-2 py-2 text-right">Rejected</th>
                      <th className="px-2 py-2 text-right">Unit cost</th>
                      <th className="px-2 py-2">Bin</th>
                      <th className="px-2 py-2">Batch</th>
                      <th className="px-2 py-2">Expiry</th>
                      <th className="px-2 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-2 py-2">{itemName(l.itemId)}</td>
                        <td className="px-2 py-2 text-right">{l.quantityOrdered}</td>
                        <td className="px-2 py-2 text-right font-semibold">{l.quantityReceiving}</td>
                        <td className="px-2 py-2 text-right">{l.quantityRejected || 0}</td>
                        <td className="px-2 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                        <td className="px-2 py-2">{l.binLocation || '—'}</td>
                        <td className="px-2 py-2">{l.batchNumber || '—'}</td>
                        <td className="px-2 py-2">{l.expiryDate ? formatDate(l.expiryDate) : '—'}</td>
                        <td className="px-2 py-2 text-right">{formatGhsExact(l.quantityReceiving * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.remarks ? <p className="max-w-sm text-xs text-zinc-500">{open.remarks}</p> : <span />}
                <div className="flex w-48 justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                  <span>Received value</span><span>{formatGhsExact(open.total)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Receipt created', at: open.createdAt, by: open.receivedBy, tone: 'zinc' },
                  { label: 'Posted — inventory updated', at: open.postedAt, by: open.postedBy },
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  <DocChip label={poOf(open.purchaseOrderId)?.number || 'Purchase order'} />
                  {open.deliveryNoteNumber && <DocChip label={`DN ${open.deliveryNoteNumber}`} />}
                </RelatedDocs>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print GRN</Button>
              {canManage && open.status === 'draft' && (
                <Button onClick={() => { setPosting(open); setOpenId(null) }}><PackageCheck className="size-4" /> Post receipt</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit goods receipt' : 'New goods receipt'} xl>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="GRN number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Receipt date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Purchase order" required>
                <Select
                  value={editing.purchaseOrderId}
                  onChange={(e) => {
                    const po = poOf(e.target.value)
                    if (!po) return
                    setEditing({
                      ...editing, purchaseOrderId: po.id, supplierId: po.supplierId,
                      warehouseId: po.warehouseId || editing.warehouseId,
                      lines: linesForPo(po, editing.id),
                    })
                  }}
                >
                  <option value="">Please Select…</option>
                  {receivablePos.map((o) => <option key={o.id} value={o.id}>{o.number} — {supplierName(o.supplierId)}</option>)}
                  {/* Keep the current PO selectable when editing a saved receipt. */}
                  {editing.purchaseOrderId && !receivablePos.some((o) => o.id === editing.purchaseOrderId) && (
                    <option value={editing.purchaseOrderId}>{poOf(editing.purchaseOrderId)?.number || 'Current order'}</option>
                  )}
                </Select>
              </Field>
              <Field label="Supplier">
                <Input value={supplierName(editing.supplierId)} readOnly className="opacity-70" />
              </Field>
              <Field label="Warehouse">
                <Select value={editing.warehouseId} onChange={(e) => setEditing({ ...editing, warehouseId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Delivery note number"><Input value={editing.deliveryNoteNumber} onChange={(e) => setEditing({ ...editing, deliveryNoteNumber: e.target.value })} placeholder="Supplier's DN" /></Field>
              <Field label="Received by"><Input value={editing.receivedBy} onChange={(e) => setEditing({ ...editing, receivedBy: e.target.value })} /></Field>
            </div>

            {selectedPo && (
              <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-3 text-xs text-mist">
                Receiving against <span className="font-mono font-semibold text-inherit">{selectedPo.number}</span>
                {' '}· ordered {formatGhsExact(selectedPo.total)} · status {statusLabel(selectedPo.status)}.
                Quantities default to the outstanding balance; you cannot receive more than was ordered.
              </div>
            )}

            <div>
              <SubHead>Items received</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="w-20 text-right">Ordered</th>
                      <th className="w-24 text-right">Prev. recd</th>
                      <th className="w-24">Receiving</th>
                      <th className="w-24">Rejected</th>
                      <th className="w-24 text-right">Remaining</th>
                      <th className="w-28">Unit cost</th>
                      <th className="w-28">Bin</th>
                      <th className="w-28">Batch</th>
                      <th className="w-28">Serial</th>
                      <th className="w-36">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.lines.map((l, i) => {
                      const err = lineError(l)
                      const remainingAfter = Math.max(0, l.ordered - l.previously - (Number(l.receiving) || 0))
                      return (
                        <tr key={i}>
                          <td>
                            <p className="text-sm font-medium">{itemName(l.itemId)}</p>
                            {itemSku(l.itemId) && <p className="font-mono text-[11px] text-mist">{itemSku(l.itemId)}</p>}
                          </td>
                          <td className="text-right">{l.ordered}</td>
                          <td className="text-right text-mist">{l.previously}</td>
                          <td>
                            <Input value={l.receiving} onChange={(e) => setLine(i, { receiving: e.target.value })} inputMode="decimal" aria-invalid={!!err} />
                            {err && <p className="mt-1 text-[11px] font-semibold text-rose-500">{err}</p>}
                          </td>
                          <td><Input value={l.rejected} onChange={(e) => setLine(i, { rejected: e.target.value })} inputMode="decimal" /></td>
                          <td className="text-right text-mist">{remainingAfter}</td>
                          <td><Input value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.binLocation} onChange={(e) => setLine(i, { binLocation: e.target.value })} placeholder="A-01" /></td>
                          <td><Input value={l.batchNumber} onChange={(e) => setLine(i, { batchNumber: e.target.value })} /></td>
                          <td><Input value={l.serialNumber} onChange={(e) => setLine(i, { serialNumber: e.target.value })} /></td>
                          <td><DatePicker value={l.expiryDate} onChange={(v) => setLine(i, { expiryDate: v })} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-mist">
                Rejected units are recorded for the audit trail but are never added to stock.
              </p>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <Field label="Remarks">
                <Textarea rows={2} value={editing.remarks} onChange={(e) => setEditing({ ...editing, remarks: e.target.value })} className="min-w-[18rem]" />
              </Field>
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold">
                  <span>Received value</span><span>{formatGhsExact(draftTotal)}</span>
                </div>
              </div>
            </div>

            <div>
              <SubHead>Supporting documents</SubHead>
              <AttachmentField files={editing.attachments} onChange={(next) => setEditing({ ...editing, attachments: next })} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                <Button variant="ghost" onClick={saveDraft}>Save draft</Button>
                <Button onClick={saveAndPost}><PackageCheck className="size-4" /> Post receipt</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Post confirm ───────────────────────────────────────────────── */}
      <Modal open={!!posting} onClose={() => setPosting(null)} title="Post goods receipt">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Posting <span className="font-mono font-semibold">{posting?.number}</span> will increase inventory by{' '}
            <span className="font-semibold">{posting?.lines.reduce((s, l) => s + l.quantityReceiving, 0)}</span> unit(s)
            and advance the purchase order. This cannot be undone — reverse it with a purchase return.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPosting(null)}>Cancel</Button>
            <Button onClick={doPost}><PackageCheck className="size-4" /> Post receipt</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete draft receipt">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? Only unposted drafts can be deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
