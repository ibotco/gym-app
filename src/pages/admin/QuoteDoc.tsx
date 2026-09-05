import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Check,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { PageHeader, Button, Modal, Badge, Select } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { nextDocNumber, DOC_STATUSES, ORDER_STATUSES } from '../../lib/quotes'
import { QuoteEditor, secondDateOf, type QuoteDoc, type QuoteKind } from './QuoteEditor'

type SortKey = 'number' | 'customer' | 'date' | 'secondDate' | 'total' | 'status'
type ColId = SortKey | 'action'

/** Covers both the quotation statuses and the sales-order statuses. */
function docTone(status: string): 'zinc' | 'sky' | 'lime' | 'rose' | 'violet' {
  if (status === 'draft') return 'zinc'
  if (status === 'sent' || status === 'confirmed') return 'sky'
  if (status === 'accepted' || status === 'fulfilled' || status === 'invoiced') return 'lime'
  if (status === 'declined' || status === 'cancelled') return 'rose'
  return 'violet'
}

const KIND_COPY: Record<QuoteKind, {
  label: string
  lower: string
  prefix: 'EST' | 'PRO' | 'SO'
  desc: string
  secondDateLabel: string
  statuses: string[]
  fileBase: string
}> = {
  estimate: {
    label: 'Estimate', lower: 'estimate', prefix: 'EST', secondDateLabel: 'Valid until',
    statuses: DOC_STATUSES as string[], fileBase: 'estimates',
    desc: 'Estimates and quotations for prospective sales.',
  },
  proposal: {
    label: 'Proposal', lower: 'proposal', prefix: 'PRO', secondDateLabel: 'Valid until',
    statuses: DOC_STATUSES as string[], fileBase: 'proposals',
    desc: 'Formal proposals sent to prospective members and clients.',
  },
  salesorder: {
    label: 'Sales order', lower: 'sales order', prefix: 'SO', secondDateLabel: 'Expected',
    statuses: ORDER_STATUSES as string[], fileBase: 'sales-orders',
    desc: 'Confirmed customer orders awaiting fulfilment and invoicing.',
  },
}

/** Shared list + editor page for the two quotation documents. */
export function QuoteDocPage({ kind }: { kind: QuoteKind }) {
  const app = useApp()
  const { deleteEstimate, deleteProposal, deleteSalesOrder, members, users, company, log } = app
  const { user } = useAuth()
  const toast = useToast()
  const copy = KIND_COPY[kind]
  const docs: QuoteDoc[] = kind === 'proposal' ? app.proposals : kind === 'salesorder' ? app.salesOrders : app.estimates
  const del = kind === 'proposal' ? deleteProposal : kind === 'salesorder' ? deleteSalesOrder : deleteEstimate

  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ doc?: QuoteDoc } | null>(null)
  const [deleting, setDeleting] = useState<QuoteDoc | null>(null)

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

  /** Id of the doc just saved, briefly highlighted in the list. */
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
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'customer', 'date', 'secondDate', 'total', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const billTo = (d: QuoteDoc) => {
    if (d.customerName) return d.customerName
    const m = members.find((x) => x.id === d.memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || d.memberId || '' : 'Walk-in customer'
  }

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...docs]
      .filter((d) => (statusFilter === 'all' ? true : d.status === statusFilter))
      .filter((d) => !ql || d.number.toLowerCase().includes(ql) || billTo(d).toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (d: QuoteDoc): string | number => {
      switch (sortKey) {
        case 'number': return d.number.toLowerCase()
        case 'customer': return billTo(d).toLowerCase()
        case 'secondDate': return secondDateOf(d).toLowerCase()
        case 'total': return d.total
        case 'status': return d.status.toLowerCase()
        default: return d.date
      }
    }
    const recency = (d: QuoteDoc) => d.createdAt || ''
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
  }, [docs, q, statusFilter, sortKey, sortDir, members, users])

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
    Number: d.number,
    Customer: billTo(d),
    Date: d.date,
    [copy.secondDateLabel]: secondDateOf(d),
    Total: d.total,
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
    const a = document.createElement('a'); a.href = url; a.download = `${copy.fileBase}.csv`; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel(copy.fileBase, exportRows())
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
    { id: 'customer', label: 'Customer', sort: 'customer' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'secondDate', label: copy.secondDateLabel, sort: 'secondDate' },
    { id: 'total', label: 'Total', sort: 'total' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const open = docs.find((d) => d.id === openId)

  const doDelete = () => {
    if (!deleting) return
    del(deleting.id)
    log(user?.id || 'system', 'DELETE', copy.label, `Deleted ${deleting.number}`)
    toast.success(`${copy.label} deleted`, deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title={`${copy.label}s`}
        desc={copy.desc}
        actions={<Button onClick={() => setEditing({})}><Plus className="size-4" /> Add {copy.label}</Button>}
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
              {copy.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search number or customer…"
              aria-label={`Search ${copy.lower}s`}
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
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title={`View ${copy.lower}`} onClick={() => setOpenId(d.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title={`Edit ${copy.lower}`} onClick={() => setEditing({ doc: d })}><Pencil className="size-4" /></button>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title={`Delete ${copy.lower}`} onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{d.number}</td>}
                  {visibleCols.has('customer') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{billTo(d)}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(d.date)}</td>}
                  {visibleCols.has('secondDate') && (
                    <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {secondDateOf(d) ? formatDate(secondDateOf(d)) : '—'}
                    </td>
                  )}
                  {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(d.total)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><Badge tone={docTone(d.status)}>{d.status}</Badge></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No {copy.lower}s found.
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

      {/* View */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || copy.label} wide>
        {open && (
          <div className="space-y-3">
            <div id="doc-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">{copy.label}</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.date)}</p>
                  {secondDateOf(open) && <p className="text-xs text-zinc-500">{copy.secondDateLabel} {formatDate(secondDateOf(open))}</p>}
                  {open.businessLocation && <p className="text-xs text-zinc-500">{open.businessLocation}</p>}
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Prepared for:</span> {billTo(open)}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">
                          {it.desc}
                          {(it.discount || 0) > 0 && <span className="ml-1 text-[11px] text-zinc-500">(less {formatGhsExact(it.discount!)})</span>}
                        </td>
                        <td className="px-3 py-2 text-right">{it.qty != null ? `${it.qty}${it.unitPrice != null ? ` × ${formatGhsExact(it.unitPrice)}` : ''}` : ''}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between gap-6">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <dl className="w-56 space-y-1 text-xs">
                  {open.subtotal != null && (
                    <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{formatGhsExact(open.subtotal)}</dd></div>
                  )}
                  {(open.discountValue || 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500">Discount{open.discountCode ? ` (${open.discountCode})` : ''}</dt>
                      <dd>− {formatGhsExact(open.discountValue!)}</dd>
                    </div>
                  )}
                  {(open.taxAmount || 0) > 0 && (
                    <div className="flex justify-between"><dt className="text-zinc-500">{open.taxName} ({open.taxRate}%)</dt><dd>+ {formatGhsExact(open.taxAmount!)}</dd></div>
                  )}
                  <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold">
                    <dt>Total</dt><dd>{formatGhsExact(open.total)}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit — Sale-style sectioned editor */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.doc ? `Edit ${copy.label} — ${editing.doc.number}` : `Add ${copy.label}`}
        xl
      >
        {editing && (
          <QuoteEditor
            kind={kind}
            doc={editing.doc}
            suggestedNumber={nextDocNumber(copy.prefix, docs.length)}
            onSaved={(savedId) => {
              // Surface the record just saved: default sort is newest-first, so
              // reset any custom sort and jump to page 1 — otherwise it can
              // land off-screen.
              setSortKey('date'); setSortDir('desc'); setPage(1)
              setJustSaved(savedId)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${copy.lower}?`}>
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete {copy.lower} <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
