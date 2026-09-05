import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Banknote, Search as SearchIcon, CheckCircle2, Clock, Check, Printer, FileText,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker, Segmented } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { Payments } from './Payments'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import type { Invoice, PaymentMethod } from '../../types'

type SortKey = 'number' | 'who' | 'issued' | 'due' | 'total' | 'balance' | 'status'
type ColId = SortKey | 'action'

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile Money (MoMo)' },
  { id: 'card', label: 'Card (Visa / Mastercard)' },
  { id: 'paystack', label: 'Paystack' },
  { id: 'hubtel', label: 'Hubtel' },
]

type ReceiveForm = { invoice: Invoice; date: string; amount: string; method: PaymentMethod; reference: string; notes: string }

/**
 * Receive Payments — record money received against outstanding invoices.
 * Full payment marks the invoice paid; a partial amount keeps it open with
 * the balance noted on the payment record.
 */
export function ReceivePayments() {
  const { invoices, payments, members, users, upsertPayment, upsertInvoice, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canReceive = hasRole('super_admin', 'gym_manager', 'staff', 'receptionist')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [form, setForm] = useState<ReceiveForm | null>(null)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'outstanding' | 'all'>(params.get('tab') === 'all' ? 'all' : 'outstanding')

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

  const [sortKey, setSortKey] = useState<SortKey>('due')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'who', 'issued', 'due', 'total', 'balance', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const memberName = (memberId?: string) => {
    if (!memberId) return ''
    const m = members.find((x) => x.id === memberId)
    return m ? (users.find((u) => u.id === m.userId)?.name || '') : ''
  }
  const invoiceName = (inv: Invoice) => inv.customerName || memberName(inv.memberId) || '—'
  const paidSoFar = (inv: Invoice) =>
    payments.filter((p) => p.invoiceId === inv.id && p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const balanceOf = (inv: Invoice) => Math.max(0, inv.total - paidSoFar(inv))

  /** Filtered + sorted outstanding set. Every export uses exactly this. */
  const outstanding = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'partially_paid' || i.status === 'overdue')
      .filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter))
      .filter((i) => !ql || i.number.toLowerCase().includes(ql) || invoiceName(i).toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (i: Invoice): string | number => {
      switch (sortKey) {
        case 'number': return i.number.toLowerCase()
        case 'who': return invoiceName(i).toLowerCase()
        case 'issued': return i.issuedAt
        case 'total': return i.total
        case 'balance': return balanceOf(i)
        case 'status': return i.status.toLowerCase()
        default: return i.dueAt
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      if (cmp !== 0) return cmp
      // Higher invoice number means newer.
      return b.number.localeCompare(a.number)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, q, statusFilter, sortKey, sortDir, payments, members, users])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, statusFilter, showEntries])
  const totalPages = Math.max(1, Math.ceil(outstanding.length / showEntries))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => outstanding.slice((safePage - 1) * showEntries, safePage * showEntries),
    [outstanding, safePage, showEntries],
  )

  // ---- Toolbar actions (identical behaviour to Supplier payments) ----
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  /** Every filtered record — exports ignore pagination, matching Supplier payments. */
  const exportRows = (): Record<string, string | number>[] => outstanding.map((i) => ({
    Invoice: i.number,
    Customer: invoiceName(i),
    Issued: i.issuedAt,
    Due: i.dueAt,
    Total: i.total,
    'Balance Due': balanceOf(i),
    Status: i.status,
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
    const a = document.createElement('a'); a.href = url; a.download = 'outstanding-invoices.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('outstanding-invoices', exportRows())
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
    { id: 'number', label: 'Invoice', sort: 'number' },
    { id: 'who', label: 'Customer / Member', sort: 'who' },
    { id: 'issued', label: 'Issued', sort: 'issued' },
    { id: 'due', label: 'Due', sort: 'due' },
    { id: 'total', label: 'Total', sort: 'total' },
    { id: 'balance', label: 'Balance Due', sort: 'balance' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const totalOutstanding = outstanding.reduce((s, i) => s + balanceOf(i), 0)

  const recent = useMemo(
    () => [...payments].filter((p) => p.status === 'paid').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    [payments],
  )

  const openReceive = (inv: Invoice) => setForm({
    invoice: inv,
    date: new Date().toISOString().slice(0, 10),
    amount: String(balanceOf(inv)),
    method: 'cash',
    reference: '',
    notes: '',
  })

  const save = () => {
    if (!form) return
    const amount = Number(form.amount)
    if (!(amount > 0)) { toast.error('Enter a valid amount.'); return }
    const balance = balanceOf(form.invoice)
    if (amount > balance + 0.005) { toast.error('Amount exceeds the invoice balance.', `Balance due is ${formatGhsExact(balance)}.`); return }
    const fullyPaid = amount >= balance - 0.005

    // If the invoice already carries a pending payment (e.g. an approved
    // member plan awaiting collection), settle THAT record instead of
    // creating a duplicate.
    const pending = payments.find((p) => p.invoiceId === form.invoice.id && p.status === 'pending')
    if (fullyPaid && pending) {
      upsertPayment({
        ...pending,
        status: 'paid',
        amount,
        method: form.method,
        date: form.date,
        reference: form.reference.trim() || pending.reference,
        description: form.notes.trim() || pending.description,
      })
    } else {
      upsertPayment({
        id: uid('pay'),
        memberId: form.invoice.memberId || '',
        amount,
        method: form.method,
        status: 'paid',
        invoiceId: form.invoice.id,
        date: form.date,
        description: form.notes.trim() || `Payment received — ${form.invoice.number}${fullyPaid ? '' : ' (partial)'}`,
        reference: form.reference.trim() || undefined,
      })
    }
    if (fullyPaid) {
      upsertInvoice({ ...form.invoice, status: 'paid' })
      // Clear any other stale pending payments on this invoice.
      payments
        .filter((p) => p.invoiceId === form.invoice.id && p.status === 'pending' && p.id !== pending?.id)
        .forEach((p) => upsertPayment({ ...p, status: 'cancelled' }))
    } else {
      upsertInvoice({ ...form.invoice, status: 'partially_paid' })
    }

    log(user?.id || 'system', 'CREATE', 'Payment', `Received ${formatGhs(amount)} on ${form.invoice.number}${fullyPaid ? ' — invoice paid' : ' — partial'}`)
    toast.success(
      fullyPaid ? 'Payment received — invoice paid' : 'Partial payment received',
      fullyPaid ? `${form.invoice.number} settled in full.` : `${formatGhsExact(balance - amount)} still due on ${form.invoice.number}.`,
    )
    setForm(null)
  }

  return (
    <div>
      <PageHeader
        title="Receive Payments"
        desc="Record payments against outstanding invoices, and manage the full payment history — cash, MoMo, card or gateway."
      />

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as 'outstanding' | 'all')}
          options={[{ id: 'outstanding', label: `Outstanding (${outstanding.length})` }, { id: 'all', label: 'All Payments' }]}
        />
      </div>

      {tab === 'all' && <Payments embedded />}

      {tab === 'outstanding' && <>
      {/* Summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:max-w-lg">
        <div className="card flex items-center gap-3 p-4">
          <Clock className="size-8 rounded-lg bg-rose-500/10 p-1.5 text-rose-500" />
          <div>
            <p className="text-xs text-mist">Outstanding invoices</p>
            <p className="text-lg font-bold">{outstanding.length}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <CheckCircle2 className="size-8 rounded-lg bg-lime/10 p-1.5 text-lime" />
          <div>
            <p className="text-xs text-mist">Total balance due</p>
            <p className="text-lg font-bold">{formatGhsExact(totalOutstanding)}</p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
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
              <option value="all">All outstanding</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="overdue">Overdue</option>
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search invoice number or customer…"
              aria-label="Search outstanding invoices"
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
              {pageRows.map((i, idx) => (
                <tr
                  key={i.id}
                  style={{
                    background: idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      {canReceive && (
                        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => openReceive(i)}>
                          <Banknote className="size-4" /> Receive
                        </Button>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{i.number}</td>}
                  {visibleCols.has('who') && <td className="px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{invoiceName(i)}</td>}
                  {visibleCols.has('issued') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(i.issuedAt)}</td>}
                  {visibleCols.has('due') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(i.dueAt)}</td>}
                  {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(i.total)}</td>}
                  {visibleCols.has('balance') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(balanceOf(i))}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><Badge tone={i.status === 'overdue' ? 'rose' : i.status === 'partially_paid' ? 'sky' : 'zinc'}>{i.status}</Badge></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    Nothing outstanding — all invoices are settled. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-5" style={{ color: TEXT_MUTED }}>
          <span className="text-sm">
            {outstanding.length === 0
              ? 'Showing 0 to 0 of 0 entries'
              : `Showing ${(safePage - 1) * showEntries + 1} to ${Math.min(safePage * showEntries, outstanding.length)} of ${outstanding.length} entries`}
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

      {/* Recent receipts */}
      <div className="card mt-4">
        <div className="px-4 py-3"><p className="text-sm font-semibold">Recently received</p></div>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-mist">
              <th className="px-4 py-2">Date</th><th className="px-4 py-2">Member / Invoice</th><th className="px-4 py-2">Method</th><th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {recent.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2.5 text-mist">{formatDate(p.date)}</td>
                <td className="px-4 py-2.5 font-semibold">{memberName(p.memberId) || '—'} <span className="font-mono text-xs font-normal text-mist">{invoices.find((i) => i.id === p.invoiceId)?.number || ''}</span></td>
                <td className="px-4 py-2.5"><Badge tone="zinc">{p.method}</Badge></td>
                <td className="px-4 py-2.5 text-right font-semibold">{formatGhsExact(p.amount)}</td>
              </tr>
            ))}
            {!recent.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-mist">No payments received yet.</td></tr>}
          </tbody>
        </table>
      </div>
      </>}

      {/* Receive modal */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form ? `Receive payment — ${form.invoice.number}` : 'Receive payment'}>
        {form && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-black/5 p-3 text-sm dark:bg-white/5">
              <div className="flex items-center justify-between">
                <span className="text-mist">{invoiceName(form.invoice)}</span>
                <span className="font-semibold">Balance due: {formatGhsExact(balanceOf(form.invoice))}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date" required><DatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} /></Field>
              <Field label="Amount" required><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment Method" required>
                <Select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
                  {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Reference No."><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="MoMo / slip reference" /></Field>
            </div>
            <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional memo" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><Banknote className="size-4" /> Receive {Number(form.amount) > 0 ? formatGhsExact(Number(form.amount)) : ''}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
