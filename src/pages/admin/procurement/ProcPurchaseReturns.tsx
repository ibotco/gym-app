import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Check, Undo2,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { exportExcel } from '../../../lib/export'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { AttachmentField } from '../accounting/AttachmentField'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextReturnNumber, statusLabel, returnedQty, PROC_RETURN_STATUSES } from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import type { AttachmentFile, GoodsReceipt, ProcPurchaseReturn, ProcReturnLine } from '../../../types'

type LineDraft = { itemId: string; received: number; alreadyReturned: number; qty: string; unitCost: string; batchNumber: string }

const REASONS = ['Damaged in transit', 'Wrong item supplied', 'Quality below specification', 'Expired or near expiry', 'Over-supplied', 'Other']

type SortKey = 'number' | 'date' | 'supplier' | 'grn' | 'reason' | 'qty' | 'total' | 'status'
type ColId = SortKey | 'action'

export function ProcPurchaseReturns() {
  const {
    procReturns, goodsReceipts, procPurchaseOrders, inventory, suppliers, company,
    upsertProcReturn, deleteProcReturn, postProcReturn, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')
  const canApprove = hasRole('super_admin', 'gym_manager', 'company_admin')

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
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProcPurchaseReturn | null>(null)
  const [posting, setPosting] = useState<ProcPurchaseReturn | null>(null)
  const [editing, setEditing] = useState<
    | { id?: string; number: string; goodsReceiptId: string; supplierId: string; returnDate: string
        reason: string; notes: string; attachments: AttachmentFile[]; lines: LineDraft[] }
    | null
  >(null)

  /** Id of the return just saved, briefly highlighted in the list. */
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(null), 2600)
    return () => window.clearTimeout(t)
  }, [justSaved])

  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'date', 'supplier', 'grn', 'reason', 'qty', 'total', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const grnOf = (id: string) => goodsReceipts.find((g) => g.id === id)
  const poNumberFor = (grnId: string) => {
    const g = grnOf(grnId)
    return g ? procPurchaseOrders.find((o) => o.id === g.purchaseOrderId)?.number : undefined
  }

  /** Only posted receipts can be returned against. */
  const postedGrns = useMemo(() => goodsReceipts.filter((g) => g.status === 'posted'), [goodsReceipts])

  const linesForGrn = (g: GoodsReceipt, excludeId?: string): LineDraft[] =>
    g.lines.filter((l) => l.quantityReceiving > 0).map((l) => {
      const alreadyReturned = returnedQty(procReturns, g.id, l.itemId, excludeId)
      return {
        itemId: l.itemId,
        received: l.quantityReceiving,
        alreadyReturned,
        qty: '0',
        unitCost: String(l.unitCost),
        batchNumber: l.batchNumber || '',
      }
    })

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...procReturns]
      .filter((r) => (statusFilter === 'all' ? true : r.status === statusFilter))
      .filter((r) => !ql || r.number.toLowerCase().includes(ql)
        || supplierName(r.supplierId).toLowerCase().includes(ql)
        || (grnOf(r.goodsReceiptId)?.number || '').toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const qtyOf = (r: ProcPurchaseReturn) => r.lines.reduce((s, l) => s + l.quantityReturned, 0)
    const val = (r: ProcPurchaseReturn): string | number => {
      switch (sortKey) {
        case 'number': return r.number.toLowerCase()
        case 'supplier': return supplierName(r.supplierId).toLowerCase()
        case 'grn': return (grnOf(r.goodsReceiptId)?.number || '').toLowerCase()
        case 'reason': return r.reason.toLowerCase()
        case 'qty': return qtyOf(r)
        case 'total': return r.total
        case 'status': return statusLabel(r.status).toLowerCase()
        default: return r.returnDate
      }
    }
    const recency = (r: ProcPurchaseReturn) => r.createdAt || ''
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      if (cmp !== 0) return cmp
      // Always newest-created first, whichever direction the column is sorted.
      return recency(b).localeCompare(recency(a))
    })
  }, [procReturns, q, statusFilter, suppliers, goodsReceipts, sortKey, sortDir])

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
  const exportRows = (): Record<string, string | number>[] => rows.map((r) => ({
    Return: r.number,
    Date: r.returnDate,
    Supplier: supplierName(r.supplierId),
    GRN: grnOf(r.goodsReceiptId)?.number || '',
    Reason: r.reason,
    Qty: r.lines.reduce((s, l) => s + l.quantityReturned, 0),
    Value: r.total,
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
    const a = document.createElement('a'); a.href = url; a.download = 'purchase-returns.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('purchase-returns', exportRows())
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
    { id: 'number', label: 'Return', sort: 'number' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'grn', label: 'GRN ref', sort: 'grn' },
    { id: 'reason', label: 'Reason', sort: 'reason' },
    { id: 'qty', label: 'Qty', sort: 'qty' },
    { id: 'total', label: 'Value', sort: 'total' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const open = procReturns.find((r) => r.id === openId) || null

  const startFor = (g: GoodsReceipt) => setEditing({
    number: nextReturnNumber(procReturns),
    goodsReceiptId: g.id, supplierId: g.supplierId,
    returnDate: new Date().toISOString().slice(0, 10),
    reason: REASONS[0], notes: '', attachments: [],
    lines: linesForGrn(g),
  })

  const openNew = () => {
    if (!postedGrns.length) { toast.error('Nothing to return', 'Post a goods receipt first.'); return }
    startFor(postedGrns[0])
  }

  const openEdit = (r: ProcPurchaseReturn) => {
    const g = grnOf(r.goodsReceiptId)
    setEditing({
      id: r.id, number: r.number, goodsReceiptId: r.goodsReceiptId, supplierId: r.supplierId,
      returnDate: r.returnDate, reason: r.reason, notes: r.notes || '', attachments: r.attachments || [],
      lines: g
        ? linesForGrn(g, r.id).map((base) => {
            const saved = r.lines.find((l) => l.itemId === base.itemId)
            return saved ? { ...base, qty: String(saved.quantityReturned), unitCost: String(saved.unitCost) } : base
          })
        : [],
    })
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) } : e)

  /** Ceiling per line: what was accepted, less what has already gone back. */
  const lineError = (l: LineDraft): string => {
    const qty = Number(l.qty) || 0
    if (qty < 0) return 'Negative'
    const available = Math.max(0, l.received - l.alreadyReturned)
    if (qty > available) return `Max ${available}`
    const onHand = inventory.find((i) => i.id === l.itemId)?.quantity ?? 0
    if (qty > onHand) return `Only ${onHand} in stock`
    return ''
  }

  const draftTotal = useMemo(() => {
    if (!editing) return 0
    return editing.lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0)
  }, [editing])

  const buildRecord = (): ProcPurchaseReturn | null => {
    if (!editing) return null
    if (!editing.goodsReceiptId) { toast.error('Select a goods receipt.'); return null }
    if (!editing.reason.trim()) { toast.error('A return reason is required.'); return null }

    for (const l of editing.lines) {
      const err = lineError(l)
      if (err) { toast.error('Invalid return quantity', `${itemName(l.itemId)} — ${err}.`); return null }
    }
    const lines: ProcReturnLine[] = editing.lines
      .filter((l) => (Number(l.qty) || 0) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantityReceived: l.received,
        quantityReturned: Number(l.qty) || 0,
        unitCost: Number(l.unitCost) || 0,
        batchNumber: l.batchNumber.trim() || undefined,
      }))
    if (!lines.length) { toast.error('Enter a quantity to return on at least one line.'); return null }

    const existing = procReturns.find((r) => r.id === editing.id)
    return {
      ...(existing || {} as ProcPurchaseReturn),
      id: editing.id || uid('pret'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      goodsReceiptId: editing.goodsReceiptId,
      returnDate: editing.returnDate,
      reason: editing.reason.trim(),
      notes: editing.notes.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      lines,
      total: lines.reduce((s, l) => s + l.quantityReturned * l.unitCost, 0),
      status: existing && existing.status !== 'draft' ? existing.status : 'draft',
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
  }

  const save = (approve: boolean) => {
    const rec = buildRecord()
    if (!rec) return
    const final = approve ? { ...rec, status: 'approved' as const } : rec
    upsertProcReturn(final)
    log(user?.id || 'system', approve ? 'APPROVE' : 'CREATE', 'Purchase Return',
      `${approve ? 'Approved' : 'Saved'} ${final.number} — ${formatGhsExact(final.total)}`)
    toast.success(approve ? 'Return approved' : 'Return saved', final.number)
    // Surface the record just saved: default sort is newest-first, so reset any
    // custom sort and jump to page 1 — otherwise it can land off-screen.
    setSortKey('date'); setSortDir('desc'); setPage(1)
    setJustSaved(final.id)
    setEditing(null)
  }

  const doPost = () => {
    if (!posting) return
    const res = postProcReturn(posting.id, user?.name)
    if (!res.ok) { toast.error('Could not post return', res.error); setPosting(null); return }
    log(user?.id || 'system', 'POST', 'Purchase Return',
      `Posted ${posting.number} — stock reduced by ${posting.lines.reduce((s, l) => s + l.quantityReturned, 0)} unit(s)`)
    toast.success('Return posted', `${posting.number} — inventory reduced`)
    setPosting(null)
  }

  const closeReturn = (r: ProcPurchaseReturn) => {
    upsertProcReturn({ ...r, status: 'closed' })
    log(user?.id || 'system', 'UPDATE', 'Purchase Return', `Closed ${r.number}`)
    toast.success('Return closed', r.number)
  }

  const doDelete = () => {
    if (!deleting) return
    if (deleting.status === 'returned' || deleting.status === 'closed') {
      toast.error('Cannot delete', 'Posted returns are part of the audit trail.')
      setDeleting(null); return
    }
    deleteProcReturn(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Return', `Deleted ${deleting.number}`)
    toast.success('Return deleted', deleting.number)
    setDeleting(null)
  }

  const editingGrn = editing ? grnOf(editing.goodsReceiptId) : undefined

  return (
    <div>
      <PageHeader
        title="Purchase returns"
        desc="Send goods back to a supplier. Returns are raised against a posted goods receipt and reduce stock when posted."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New return</Button> : undefined}
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
              {PROC_RETURN_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search return, GRN or supplier…"
              aria-label="Search purchase returns"
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
                <tr
                  key={r.id}
                  style={{
                    background: r.id === justSaved
                      ? (isDark ? 'rgba(132,204,22,0.16)' : 'rgba(132,204,22,0.18)')
                      : idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(r.id)}><FileText className="size-4" /></button>
                      {canManage && (r.status === 'draft' || r.status === 'approved') && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>
                      )}
                      {canApprove && r.status === 'approved' && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Post return (reduces stock)" onClick={() => setPosting(r)}><Undo2 className="size-4" /></button>
                      )}
                      {canManage && r.status === 'returned' && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Close return" onClick={() => closeReturn(r)}><Check className="size-4" /></button>
                      )}
                      {canManage && (r.status === 'draft' || r.status === 'approved') && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{r.number}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(r.returnDate)}</td>}
                  {visibleCols.has('supplier') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{supplierName(r.supplierId)}</td>}
                  {visibleCols.has('grn') && (
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {grnOf(r.goodsReceiptId)?.number || '—'}
                    </td>
                  )}
                  {visibleCols.has('reason') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{r.reason}</td>}
                  {visibleCols.has('qty') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{r.lines.reduce((s, l) => s + l.quantityReturned, 0)}</td>}
                  {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(r.total)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={r.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No purchase returns found.
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
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase return'} wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <ProcStatus status={open.status} />
              {(open.status === 'draft' || open.status === 'approved') && <span className="text-xs text-mist">Stock has not been reduced yet.</span>}
              {(open.status === 'returned' || open.status === 'closed') && <span className="text-xs text-mist">Stock was reduced when this return was posted.</span>}
            </div>

            <div id="pret-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Purchase Return</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.returnDate)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                <p><span className="font-semibold">GRN reference:</span> {grnOf(open.goodsReceiptId)?.number || '—'}</p>
                <p><span className="font-semibold">PO reference:</span> {poNumberFor(open.goodsReceiptId) || '—'}</p>
                <p><span className="font-semibold">Reason:</span> {open.reason}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right">Returned</th>
                      <th className="px-3 py-2">Batch</th>
                      <th className="px-3 py-2 text-right">Unit cost</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{itemName(l.itemId)}</td>
                        <td className="px-3 py-2 text-right">{l.quantityReceived}</td>
                        <td className="px-3 py-2 text-right font-semibold">{l.quantityReturned}</td>
                        <td className="px-3 py-2">{l.batchNumber || '—'}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.quantityReturned * l.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <div className="flex w-56 justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                  <span>Credit due</span><span>{formatGhsExact(open.total)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Return raised', at: open.createdAt, tone: 'zinc' },
                  { label: 'Posted — stock reduced', at: open.postedAt, by: open.postedBy },
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  <DocChip label={grnOf(open.goodsReceiptId)?.number || 'GRN'} />
                  {poNumberFor(open.goodsReceiptId) && <DocChip label={poNumberFor(open.goodsReceiptId)!} />}
                </RelatedDocs>
                {open.attachments?.length ? (
                  <p className="mt-3 text-xs text-mist">{open.attachments.length} attachment(s): {open.attachments.map((a) => a.name).join(', ')}</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              {canApprove && open.status === 'approved' && (
                <Button onClick={() => { setPosting(open); setOpenId(null) }}><Undo2 className="size-4" /> Post return</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit purchase return' : 'New purchase return'} xl>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Return number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Goods receipt" required>
                <Select value={editing.goodsReceiptId} onChange={(e) => {
                  const g = grnOf(e.target.value)
                  if (!g) return
                  setEditing({ ...editing, goodsReceiptId: g.id, supplierId: g.supplierId, lines: linesForGrn(g, editing.id) })
                }}>
                  <option value="">Please Select…</option>
                  {postedGrns.map((g) => <option key={g.id} value={g.id}>{g.number} — {supplierName(g.supplierId)}</option>)}
                </Select>
              </Field>
              <Field label="Return date"><DatePicker value={editing.returnDate} onChange={(v) => setEditing({ ...editing, returnDate: v })} /></Field>
              <Field label="Supplier"><Input value={supplierName(editing.supplierId)} readOnly className="opacity-70" /></Field>
              <Field label="Return reason" required>
                <Select value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}>
                  {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
            </div>

            {editingGrn && (
              <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-3 text-xs text-mist">
                Returning against <span className="font-mono font-semibold text-inherit">{editingGrn.number}</span>
                {poNumberFor(editingGrn.id) && <> · order {poNumberFor(editingGrn.id)}</>}
                {' '}· you cannot return more than was accepted, or more than is currently in stock.
              </div>
            )}

            <div>
              <SubHead>Items to return</SubHead>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="w-24 text-right">Received</th>
                      <th className="w-28 text-right">Already returned</th>
                      <th className="w-24 text-right">In stock</th>
                      <th className="w-28">Returning</th>
                      <th className="w-28">Unit cost</th>
                      <th className="w-28">Batch</th>
                      <th className="w-28 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editing.lines.map((l, i) => {
                      const err = lineError(l)
                      const onHand = inventory.find((x) => x.id === l.itemId)?.quantity ?? 0
                      return (
                        <tr key={i}>
                          <td className="text-sm font-medium">{itemName(l.itemId)}</td>
                          <td className="text-right">{l.received}</td>
                          <td className="text-right text-mist">{l.alreadyReturned}</td>
                          <td className="text-right text-mist">{onHand}</td>
                          <td>
                            <Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" aria-invalid={!!err} />
                            {err && <p className="mt-1 text-[11px] font-semibold text-rose-500">{err}</p>}
                          </td>
                          <td><Input value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} inputMode="decimal" /></td>
                          <td><Input value={l.batchNumber} onChange={(e) => setLine(i, { batchNumber: e.target.value })} /></td>
                          <td className="text-right text-sm">{formatGhsExact((Number(l.qty) || 0) * (Number(l.unitCost) || 0))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[18rem] flex-1 space-y-3">
                <Field label="Notes"><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
                <div>
                  <SubHead>Supporting documents</SubHead>
                  <AttachmentField files={editing.attachments} onChange={(next) => setEditing({ ...editing, attachments: next })} />
                </div>
              </div>
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold">
                  <span>Credit due</span><span>{formatGhsExact(draftTotal)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="ghost" onClick={() => save(false)}>Save draft</Button>
              {canApprove && <Button onClick={() => save(true)}><Check className="size-4" /> Save &amp; approve</Button>}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Post confirm ───────────────────────────────────────────────── */}
      <Modal open={!!posting} onClose={() => setPosting(null)} title="Post purchase return">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Posting <span className="font-mono font-semibold">{posting?.number}</span> will reduce inventory by{' '}
            <span className="font-semibold">{posting?.lines.reduce((s, l) => s + l.quantityReturned, 0)}</span> unit(s)
            and raise a supplier credit of <span className="font-semibold">{formatGhsExact(posting?.total || 0)}</span>. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPosting(null)}>Cancel</Button>
            <Button onClick={doPost}><Undo2 className="size-4" /> Post return</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete return">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? Only unposted returns can be deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
