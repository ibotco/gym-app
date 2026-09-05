import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Check,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { exportExcel } from '../../../lib/export'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { AttachmentField } from '../accounting/AttachmentField'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import {
  nextPaymentNumber, statusLabel, balanceOf, paidAgainst, canPay, CENT, paymentInvoiceIds,
  SUPPLIER_PAYMENT_STATUSES,
} from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import type { AttachmentFile, PaymentMethod, SupplierInvoice, SupplierPayment } from '../../../types'

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile money' },
  { id: 'card', label: 'Card' },
  { id: 'paystack', label: 'Paystack' },
  { id: 'flutterwave', label: 'Flutterwave' },
  { id: 'hubtel', label: 'Hubtel' },
]

type SortKey = 'number' | 'date' | 'supplier' | 'invoice' | 'method' | 'account' | 'amount' | 'status'
type ColId = SortKey | 'action'

export function SupplierPayments() {
  const {
    supplierPayments, supplierInvoices, suppliers, accounts, company,
    upsertSupplierPayment, deleteSupplierPayment, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SupplierPayment | null>(null)
  /** Id of the payment just saved, briefly highlighted in the list. */
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(null), 2600)
    return () => window.clearTimeout(t)
  }, [justSaved])

  /** Set when the form was opened from a specific invoice (deep link or row action). */
  const [lockedInvoice, setLockedInvoice] = useState(false)
  /** One editable allocation row: which invoice, and how much of the payment. */
  type AllocRow = { invoiceId: string; amount: string }
  const [editing, setEditing] = useState<
    | { id?: string; number: string; supplierId: string; paymentDate: string
        method: PaymentMethod; accountId: string; reference: string; notes: string
        allocations: AllocRow[]; attachments: AttachmentFile[] }
    | null
  >(null)

  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const invOf = (id: string) => supplierInvoices.find((i) => i.id === id)
  /** Cash and bank accounts are the only sensible funding sources. */
  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'asset' && /cash|bank/i.test(`${a.name} ${a.detailType || ''}`)),
    [accounts],
  )

  /** Invoices that still owe money. */
  const payableInvoices = useMemo(
    () => supplierInvoices.filter((i) => canPay(i, supplierPayments)),
    [supplierInvoices, supplierPayments],
  )

  /** Deep-link ids already rejected, so an unpayable invoice toasts only once. */
  const rejectedDeepLink = useRef<string | null>(null)
  /** Bulk deep link already handled, so closing the form cannot reopen it. */
  const handledBulkLink = useRef<string | null>(null)
  /** Deep-link id already opened, so closing the form cannot immediately reopen it. */
  const handledDeepLink = useRef<string | null>(null)

  /** Drop ?invoice= from the URL without touching the rest of the query string. */
  const clearInvoiceParam = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('invoice')
      return next
    }, { replace: true })
  }

  /** Drop ?invoices= (bulk) from the URL. */
  const clearBulkParam = () => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('invoices')
      return next
    }, { replace: true })
  }

  const closeForm = () => {
    setEditing(null)
    setLockedInvoice(false)
    rejectedDeepLink.current = null
    // Leave handledDeepLink / handledBulkLink set: the param may take a render to
    // disappear and we must not re-open the form we just closed.
    clearInvoiceParam()
    clearBulkParam()
  }

  const startFor = (invoiceId: string, locked = true) => {
    const inv = invOf(invoiceId)
    if (!inv) return
    setLockedInvoice(locked)
    setEditing({
      number: nextPaymentNumber(supplierPayments),
      supplierId: inv.supplierId,
      paymentDate: new Date().toISOString().slice(0, 10),
      method: 'cash', accountId: cashAccounts[0]?.id || '',
      // Default to clearing the outstanding balance — the common case.
      allocations: [{ invoiceId: inv.id, amount: balanceOf(inv, supplierPayments).toFixed(2) }],
      reference: '', notes: '', attachments: [],
    })
  }

  /** Bulk deep link: preload one payment allocated across several invoices. */
  const startForMany = (invoiceIds: string[]) => {
    const invs = invoiceIds.map((id) => invOf(id)).filter((i): i is SupplierInvoice => !!i)
    if (!invs.length) return
    setLockedInvoice(false)
    setEditing({
      number: nextPaymentNumber(supplierPayments),
      supplierId: invs[0].supplierId,
      paymentDate: new Date().toISOString().slice(0, 10),
      method: 'cash', accountId: cashAccounts[0]?.id || '',
      allocations: invs.map((inv) => ({ invoiceId: inv.id, amount: balanceOf(inv, supplierPayments).toFixed(2) })),
      reference: '', notes: '', attachments: [],
    })
  }

  /** Bulk deep link from the invoice list: ?invoices=<id,id,id> */
  useEffect(() => {
    const raw = params.get('invoices')
    if (!raw) { handledBulkLink.current = null; return }
    if (handledBulkLink.current === raw) return
    const ids = raw.split(',').map((x) => x.trim()).filter(Boolean)
    const found = ids.map((id) => invOf(id)).filter(Boolean)
    // Wait for the store to hydrate before consuming the param.
    if (found.length !== ids.length) return

    handledBulkLink.current = raw
    const payable = ids.filter((id) => {
      const inv = invOf(id)
      return inv && canPay(inv, supplierPayments)
    })
    if (!payable.length) {
      toast.error('Nothing to pay', 'The selected invoices are already settled.')
      clearBulkParam()
      return
    }
    if (payable.length < ids.length) {
      toast.info('Some invoices skipped', `${ids.length - payable.length} already settled.`)
    }
    startForMany(payable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, supplierInvoices, supplierPayments])

  // Deep link from the invoice screen: /admin/supplier-payments?invoice=<id>
  // Runs whenever the param or the invoice data changes, so a link that arrives
  // before the store has hydrated still opens the form once the record appears.
  // handledDeepLink guards against re-opening the modal after the user closes it.
  // The ?invoice= param stays in the URL for as long as the form is open and is
  // the source of truth for the deep link. Clearing it eagerly used to remount
  // this route, which threw away the freshly-opened modal — so the form never
  // appeared. rejectedDeepLink stops an unpayable invoice re-toasting forever.
  useEffect(() => {
    const id = params.get('invoice')
    if (!id) { handledDeepLink.current = null; return }
    // Already opened (or deliberately closed) for this id — do not reopen.
    if (handledDeepLink.current === id) return
    const inv = invOf(id)
    // Invoice not loaded yet — keep the param and retry once the store hydrates.
    if (!inv) return

    if (canPay(inv, supplierPayments)) { handledDeepLink.current = id; startFor(id); return }

    if (rejectedDeepLink.current !== id) {
      rejectedDeepLink.current = id
      if (inv.status === 'draft') toast.error('Not payable', `${inv.number} is still a draft. Submit and approve it first.`)
      else if (inv.status === 'cancelled') toast.error('Not payable', `${inv.number} was cancelled.`)
      else toast.error('Nothing to pay', `${inv.number} is already settled.`)
    }
    clearInvoiceParam()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, supplierInvoices, supplierPayments])

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
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'date', 'supplier', 'invoice', 'method', 'account', 'amount', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  /** All invoice numbers a payment settles, comma separated. */
  const invoiceNumbersOf = (p: SupplierPayment) =>
    paymentInvoiceIds(p).map((id) => invOf(id)?.number || '').filter(Boolean).join(', ')

  const methodLabel = (m: string) => METHODS.find((x) => x.id === m)?.label || m
  const accountLabel = (id?: string) => accounts.find((a) => a.id === id)?.name || ''

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...supplierPayments]
      .filter((p) => (statusFilter === 'all' ? true : p.status === statusFilter))
      .filter((p) => !ql || p.number.toLowerCase().includes(ql)
        || supplierName(p.supplierId).toLowerCase().includes(ql)
        || invoiceNumbersOf(p).toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (p: SupplierPayment): string | number => {
      switch (sortKey) {
        case 'number': return p.number.toLowerCase()
        case 'supplier': return supplierName(p.supplierId).toLowerCase()
        case 'invoice': return invoiceNumbersOf(p).toLowerCase()
        case 'method': return methodLabel(p.method).toLowerCase()
        case 'account': return accountLabel(p.accountId).toLowerCase()
        case 'amount': return p.amount
        case 'status': return statusLabel(p.status).toLowerCase()
        default: return p.paymentDate
      }
    }
    // Newest first within a tie. Two payments dated the same day (the common
    // case — you record several today) would otherwise order arbitrarily, so the
    // one just created may not appear on top. createdAt breaks the tie.
    const recency = (p: SupplierPayment) => p.createdAt || ''
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      if (cmp !== 0) return cmp
      // Always newest-created first, whichever direction the column is sorted.
      return recency(b).localeCompare(recency(a))
    })
  }, [supplierPayments, q, statusFilter, suppliers, supplierInvoices, sortKey, sortDir, accounts])

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
  const exportRows = (): Record<string, string | number>[] => rows.map((p) => ({
    Payment: p.number,
    Date: p.paymentDate,
    Supplier: supplierName(p.supplierId),
    Invoice: invoiceNumbersOf(p),
    Method: methodLabel(p.method),
    Account: accountLabel(p.accountId),
    Amount: p.amount,
    Status: statusLabel(p.status),
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
    const a = document.createElement('a'); a.href = url; a.download = 'supplier-payments.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('supplier-payments', exportRows())
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
    { id: 'number', label: 'Payment', sort: 'number' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'invoice', label: 'Invoice', sort: 'invoice' },
    { id: 'method', label: 'Method', sort: 'method' },
    { id: 'account', label: 'Account', sort: 'account' },
    { id: 'amount', label: 'Amount', sort: 'amount' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120


  const open = supplierPayments.find((p) => p.id === openId) || null

  const openNew = () => {
    if (!payableInvoices.length) { toast.error('Nothing to pay', 'Post a purchase invoice first.'); return }
    startFor(payableInvoices[0].id, false)
  }

  const openEdit = (p: SupplierPayment) => { setLockedInvoice(false); setEditing({
    id: p.id, number: p.number, supplierId: p.supplierId,
    paymentDate: p.paymentDate, method: p.method, accountId: p.accountId || '',
    allocations: (p.allocations && p.allocations.length
      ? p.allocations.map((a) => ({ invoiceId: a.supplierInvoiceId, amount: String(a.amount) }))
      : [{ invoiceId: p.supplierInvoiceId, amount: String(p.amount) }]),
    reference: p.reference || '', notes: p.notes || '',
    attachments: p.attachments || [],
  }) }

  /** Outstanding on one invoice, ignoring the payment being edited. */
  const balanceFor = (invoiceId: string, excludeId?: string) => {
    const inv = invOf(invoiceId)
    if (!inv) return 0
    return Math.max(0, inv.total - paidAgainst(supplierPayments, inv.id, excludeId))
  }

  /** Total being paid across every allocation row. */
  const allocTotal = useMemo(() => {
    if (!editing) return 0
    return editing.allocations.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  }, [editing])

  /** Per-row validation message, indexed alongside editing.allocations. */
  const rowErrors = useMemo(() => {
    if (!editing) return [] as string[]
    const seen = new Map<string, number>()
    editing.allocations.forEach((r) => seen.set(r.invoiceId, (seen.get(r.invoiceId) || 0) + 1))
    return editing.allocations.map((r) => {
      if (!r.invoiceId) return 'Select an invoice.'
      if ((seen.get(r.invoiceId) || 0) > 1) return 'This invoice is listed twice.'
      const amt = Number(r.amount)
      if (!Number.isFinite(amt) || amt <= 0) return 'Enter an amount greater than zero.'
      const bal = balanceFor(r.invoiceId, editing.id)
      if (amt > bal + CENT) return `Exceeds the outstanding balance of ${formatGhsExact(bal)}.`
      return ''
    })
  }, [editing, supplierInvoices, supplierPayments])

  const amountError = useMemo(() => {
    if (!editing) return ''
    if (!editing.allocations.length) return 'Add at least one invoice.'
    const first = rowErrors.find((e) => e)
    return first || ''
  }, [editing, rowErrors])

  const save = (post: boolean) => {
    if (!editing) return
    if (amountError) { toast.error('Cannot save payment', amountError); return }

    const existing = supplierPayments.find((p) => p.id === editing.id)
    const isNew = !editing.id
    const allocations = editing.allocations.map((r) => ({
      supplierInvoiceId: r.invoiceId, amount: Number(r.amount),
    }))
    const rec: SupplierPayment = {
      ...(existing || {} as SupplierPayment),
      id: editing.id || uid('spay'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      // Mirror the first allocation so older readers keep working.
      supplierInvoiceId: allocations[0]?.supplierInvoiceId || '',
      allocations,
      paymentDate: editing.paymentDate,
      method: editing.method,
      accountId: editing.accountId || undefined,
      amount: allocations.reduce((sum, a) => sum + a.amount, 0),
      reference: editing.reference.trim() || undefined,
      notes: editing.notes.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      status: post ? 'posted' : (existing?.status === 'posted' ? 'posted' : 'draft'),
      postedAt: post ? new Date().toISOString() : existing?.postedAt,
      postedBy: post ? (user?.name || 'system') : existing?.postedBy,
      createdAt: existing?.createdAt || new Date().toISOString(),
    }
    upsertSupplierPayment(rec)
    const against = allocations.map((a) => invOf(a.supplierInvoiceId)?.number || '').filter(Boolean).join(', ')
    log(user?.id || 'system', post ? 'POST' : isNew ? 'CREATE' : 'UPDATE', 'Supplier Payment',
      `${post ? 'Posted' : isNew ? 'Created' : 'Updated'} ${rec.number} — ${formatGhsExact(rec.amount)} against ${against}`)
    toast.success(post ? 'Payment posted' : 'Payment saved', rec.number)
    // Surface the record just saved: default sort is newest-first, so reset any
    // custom sort and jump to page 1 — otherwise it can land off-screen.
    setSortKey('date'); setSortDir('desc'); setPage(1)
    setJustSaved(rec.id)
    closeForm()
  }

  const doDelete = () => {
    if (!deleting) return
    deleteSupplierPayment(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Supplier Payment', `Deleted ${deleting.number}`)
    toast.success('Payment deleted', deleting.number)
    setDeleting(null)
  }

  const editingInvoice = editing && editing.allocations.length === 1 ? invOf(editing.allocations[0].invoiceId) : undefined

  return (
    <div>
      <PageHeader
        title="Supplier payments"
        desc="Money paid out against purchase invoices. Posting a payment updates the invoice's payment status."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New payment</Button> : undefined}
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
              {SUPPLIER_PAYMENT_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search payment, invoice or supplier…"
              aria-label="Search supplier payments"
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
              {pageRows.map((p, idx) => (
                <tr
                  key={p.id}
                  style={{
                    background: p.id === justSaved
                      ? (isDark ? 'rgba(132,204,22,0.16)' : 'rgba(132,204,22,0.18)')
                      : idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(p.id)}><FileText className="size-4" /></button>
                      {canManage && p.status === 'draft' && (
                        <>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(p)}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>
                        </>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{p.number}</td>}
                  {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(p.paymentDate)}</td>}
                  {visibleCols.has('supplier') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{supplierName(p.supplierId)}</td>}
                  {visibleCols.has('invoice') && (
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {invoiceNumbersOf(p) || '—'}
                    </td>
                  )}
                  {visibleCols.has('method') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{methodLabel(p.method)}</td>}
                  {visibleCols.has('account') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{accountLabel(p.accountId) || '—'}</td>}
                  {visibleCols.has('amount') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(p.amount)}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={p.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No supplier payments found.
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
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Payment'} wide>
        {open && (
          <div className="space-y-4">
            <ProcStatus status={open.status} />
            <div id="spay-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Payment Voucher</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.paymentDate)}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Paid to:</span> {supplierName(open.supplierId)}</p>
                <p><span className="font-semibold">Invoice{paymentInvoiceIds(open).length > 1 ? 's' : ''}:</span> {invoiceNumbersOf(open) || '—'}</p>
                <p><span className="font-semibold">Method:</span> {METHODS.find((m) => m.id === open.method)?.label || open.method}</p>
                <p><span className="font-semibold">Account:</span> {accounts.find((a) => a.id === open.accountId)?.name || '—'}</p>
                <p><span className="font-semibold">Reference:</span> {open.reference || '—'}</p>
              </div>
              <div className="mt-4 flex justify-end">
                <div className="w-56 border-t border-zinc-300 pt-2 text-base font-bold">
                  <div className="flex justify-between"><span>Amount paid</span><span>{formatGhsExact(open.amount)}</span></div>
                </div>
              </div>
              {open.notes && <p className="mt-3 text-xs text-zinc-500">{open.notes}</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Payment created', at: open.createdAt, tone: 'zinc' },
                  { label: 'Posted', at: open.postedAt, by: open.postedBy },
                ]} />
              </div>
              <div className="card p-4">
                <SubHead>Related documents</SubHead>
                <RelatedDocs>
                  {paymentInvoiceIds(open).map((id) => (
                    <DocChip key={id} label={invOf(id)?.number || 'Invoice'} />
                  ))}
                </RelatedDocs>
                {paymentInvoiceIds(open).length > 1 && (
                  <ul className="mt-3 space-y-1 text-xs text-mist">
                    {(open.allocations || []).map((a) => (
                      <li key={a.supplierInvoiceId} className="flex justify-between gap-3">
                        <span className="font-mono">{invOf(a.supplierInvoiceId)?.number || a.supplierInvoiceId}</span>
                        <span className="font-semibold">{formatGhsExact(a.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {open.attachments?.length ? (
                  <p className="mt-3 text-xs text-mist">{open.attachments.length} attachment(s): {open.attachments.map((a) => a.name).join(', ')}</p>
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit ─────────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={closeForm} title={editing?.id ? 'Edit payment' : 'New payment'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Payment number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Payment date"><DatePicker value={editing.paymentDate} onChange={(v) => setEditing({ ...editing, paymentDate: v })} /></Field>
              <Field label="Payment method">
                <Select value={editing.method} onChange={(e) => setEditing({ ...editing, method: e.target.value as PaymentMethod })}>
                  {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Bank / cash account">
                <Select value={editing.accountId} onChange={(e) => setEditing({ ...editing, accountId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Reference"><Input value={editing.reference} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} placeholder="Cheque / transfer ref" /></Field>
            </div>

            {/* ── Invoices settled by this payment ───────────────────────── */}
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <SubHead>Invoices paid</SubHead>
                {!lockedInvoice && (
                  <Button
                    variant="ghost"
                    onClick={() => setEditing({ ...editing, allocations: [...editing.allocations, { invoiceId: '', amount: '' }] })}
                  >
                    <Plus className="size-4" /> Add invoice
                  </Button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm" style={{ minWidth: 560 }}>
                  <thead>
                    <tr style={{ background: TABLE_HEAD_BG }}>
                      <th className="px-3 py-2 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Invoice</th>
                      <th className="w-32 px-3 py-2 text-right font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Outstanding</th>
                      <th className="w-36 px-3 py-2 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>Amount</th>
                      <th className="w-10 px-2 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }} />
                    </tr>
                  </thead>
                  <tbody>
                    {editing.allocations.map((row, idx) => {
                      const rowInv = invOf(row.invoiceId)
                      const bal = row.invoiceId ? balanceFor(row.invoiceId, editing.id) : 0
                      const err = rowErrors[idx]
                      // Hide invoices already chosen on another row.
                      const taken = new Set(editing.allocations.filter((_, i) => i !== idx).map((r) => r.invoiceId))
                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            {lockedInvoice && rowInv ? (
                              <div className="flex h-[38px] items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg px-3"
                                style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                                title={`${rowInv.number} — ${supplierName(rowInv.supplierId)}`}>
                                <span className="shrink-0 font-mono font-semibold">{rowInv.number}</span>
                                <span className="truncate" style={{ color: TEXT_MUTED }}>— {supplierName(rowInv.supplierId)}</span>
                              </div>
                            ) : (
                              <Select
                                value={row.invoiceId}
                                onChange={(e) => {
                                  const inv = invOf(e.target.value)
                                  const next = [...editing.allocations]
                                  next[idx] = {
                                    invoiceId: e.target.value,
                                    // Default the row to whatever is still owed.
                                    amount: inv ? balanceFor(inv.id, editing.id).toFixed(2) : '',
                                  }
                                  setEditing({
                                    ...editing,
                                    allocations: next,
                                    supplierId: inv?.supplierId || editing.supplierId,
                                  })
                                }}
                              >
                                <option value="">Please Select…</option>
                                {payableInvoices.filter((i) => !taken.has(i.id)).map((i) => (
                                  <option key={i.id} value={i.id}>{i.number} — {supplierName(i.supplierId)} — {formatGhsExact(balanceOf(i, supplierPayments))} due</option>
                                ))}
                                {row.invoiceId && !payableInvoices.some((i) => i.id === row.invoiceId) && (
                                  <option value={row.invoiceId}>{rowInv?.number || 'Current invoice'}</option>
                                )}
                              </Select>
                            )}
                            {err && <p className="mt-1 text-xs font-semibold text-rose-500">{err}</p>}
                          </td>
                          <td className="px-3 py-2 text-right align-top tabular-nums" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>
                            <span className="inline-block pt-2">{row.invoiceId ? formatGhsExact(bal) : '—'}</span>
                          </td>
                          <td className="px-3 py-2 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <Input
                              value={row.amount}
                              onChange={(e) => {
                                const next = [...editing.allocations]
                                next[idx] = { ...next[idx], amount: e.target.value }
                                setEditing({ ...editing, allocations: next })
                              }}
                              inputMode="decimal"
                              aria-label={`Amount for ${rowInv?.number || 'invoice'}`}
                              aria-invalid={!!err}
                            />
                          </td>
                          <td className="px-2 py-2 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            {editing.allocations.length > 1 && !lockedInvoice && (
                              <button
                                type="button"
                                className="mt-2 rounded-lg p-2"
                                style={{ color: TEXT_MUTED }}
                                title="Remove invoice"
                                onClick={() => setEditing({ ...editing, allocations: editing.allocations.filter((_, i) => i !== idx) })}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="px-3 py-2.5 text-right font-semibold" style={{ color: TEXT }}>Total payment</td>
                      <td />
                      <td className="px-3 py-2.5 font-bold tabular-nums" style={{ color: TEXT }}>{formatGhsExact(allocTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Notes"><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            </div>

            <div>
              <SubHead>Supporting documents</SubHead>
              <AttachmentField files={editing.attachments} onChange={(next) => setEditing({ ...editing, attachments: next })} />
            </div>

            <p className="text-xs text-mist">Draft payments do not reduce invoice balances and are not posted to the payables ledger — post the payment to settle the invoice.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={closeForm}>Cancel</Button>
              <Button variant="ghost" onClick={() => save(false)} disabled={!!amountError}>Save as draft</Button>
              <Button onClick={() => save(true)} disabled={!!amountError}><Check className="size-4" /> Post payment</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete payment">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? The invoice status will be recalculated.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
