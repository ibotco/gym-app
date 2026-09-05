import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote, Printer, FileText, Plus, Pencil, Trash2, Check, Repeat,
  Download, FileSpreadsheet, Columns3, ChevronDown, ChevronLeft, ChevronRight, Search as SearchIcon, FileStack, Save,
} from 'lucide-react'
import { PageHeader, Button, StatusBadge, Modal, Select, Field, Input, DatePicker, Textarea } from '../../components/ui'
import { exportExcel } from '../../lib/export'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import { effectiveSequence, nextInvoiceNumber, resolveInvoiceScheme } from '../../lib/invoiceScheme'
import { generateDueCycles, generateSingle, recurrenceSummary } from '../../lib/recurringInvoices'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { normalizeHex, readableInk } from '../../lib/color'
import { InvoiceEditor } from './InvoiceEditor'
import type { Invoice, InvoiceItem, InvoiceTemplate, PaymentMethod, SaleDiscountType } from '../../types'

type SortKey = 'number' | 'customer' | 'order' | 'issued' | 'items' | 'total' | 'balance' | 'status'
type ColId = SortKey | 'action'

const PAY_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'momo', label: 'Mobile Money (MoMo)' },
  { id: 'card', label: 'Card (Visa / Mastercard)' },
  { id: 'paystack', label: 'Paystack' },
  { id: 'hubtel', label: 'Hubtel' },
]

type ReceiveForm = { invoice: Invoice; date: string; amount: string; method: PaymentMethod; reference: string; notes: string }

export function Invoices() {
  const { invoices, payments, members, users, company, salesOrders, upsertPayment, upsertInvoice, deleteInvoice, invoiceTemplates, upsertInvoiceTemplate, deleteInvoiceTemplate, branchSettings, activeBranchId, setCompany, log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ invoice?: Invoice; template?: InvoiceTemplate } | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [deleting, setDeleting] = useState<Invoice | null>(null)
  const [form, setForm] = useState<ReceiveForm | null>(null)

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

  /** Id of the invoice just saved, briefly highlighted in the list. */
  const [justSaved, setJustSaved] = useState<string | null>(null)
  useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(null), 2600)
    return () => window.clearTimeout(t)
  }, [justSaved])

  /** Cycles already raised this mount — guards against React StrictMode double-invoking the effect. */
  const recProcessed = useRef<Set<string>>(new Set())
  /** Recurring cycles: raise every occurrence that is due (runs once when the page opens). */
  useEffect(() => {
    const res = generateDueCycles(invoices, company?.invoiceScheme)
    if (!res.created.length && !res.updated.length) return
    const fresh = res.created.filter((c) => {
      const key = `${c.recurringFromId}:${c.issuedAt}`
      if (recProcessed.current.has(key)) return false
      recProcessed.current.add(key)
      return true
    })
    if (!fresh.length) return
    fresh.forEach((c) => upsertInvoice(c))
    res.updated.forEach((a) => upsertInvoice(a))
    {
      const scheme = resolveInvoiceScheme(company?.invoiceScheme)
      const seq = effectiveSequence(scheme)
      setCompany({ ...company, invoiceScheme: { ...scheme, nextNumber: seq.number + fresh.length, year: seq.year } })
    }
    const first = fresh[0]
    toast.success(
      `Recurring invoice${fresh.length > 1 ? 's' : ''} generated`,
      fresh.length > 1
        ? `${fresh.length} cycles raised, e.g. ${first.number} for ${formatDate(first.issuedAt)}.`
        : `${first.number} raised for ${formatDate(first.issuedAt)}.`,
    )
    // Runs once per visit — invoices/company are the values from first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Manually raise the next occurrence of a recurring cycle. */
  const generateNext = (inv: Invoice) => {
    const res = generateSingle(inv, company?.invoiceScheme)
    if (!res) { toast.error('Cycle has ended', 'This recurring cycle has reached its limit.'); return }
    upsertInvoice(res.child)
    upsertInvoice(res.anchor)
    {
      const scheme = resolveInvoiceScheme(company?.invoiceScheme)
      const seq = effectiveSequence(scheme)
      setCompany({ ...company, invoiceScheme: { ...scheme, nextNumber: seq.number + 1, year: seq.year } })
    }
    setJustSaved(res.child.id)
    log(user?.id || 'system', 'CREATE', 'Invoice', `Recurring — ${res.child.number} generated from ${inv.number}`)
    toast.success('Next occurrence generated', `${res.child.number} raised for ${formatDate(res.child.issuedAt)}.`)
  }

  const [sortKey, setSortKey] = useState<SortKey>('issued')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(new Set<ColId>(['action', 'number', 'customer', 'order', 'issued', 'items', 'total', 'balance', 'status']))

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const billTo = (memberId?: string, customerName?: string) => {
    if (customerName) return customerName
    const m = members.find((x) => x.id === memberId)
    return m ? users.find((u) => u.id === m.userId)?.name || memberId || '' : 'Walk-in customer'
  }

  /** Paid against an invoice (only 'paid' payments count) and the balance left. */
  const paidSoFar = (inv: Invoice) =>
    payments.filter((p) => p.invoiceId === inv.id && p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const balanceOf = (inv: Invoice) => Math.max(0, inv.total - paidSoFar(inv))
  const orderNo = (orderId?: string) => salesOrders.find((o) => o.id === orderId)?.number || ''

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const list = [...invoices]
      .filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter))
      .filter((i) => !ql || i.number.toLowerCase().includes(ql) || billTo(i.memberId, i.customerName).toLowerCase().includes(ql))

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (i: Invoice): string | number => {
      switch (sortKey) {
        case 'number': return i.number.toLowerCase()
        case 'customer': return billTo(i.memberId, i.customerName).toLowerCase()
        case 'order': return orderNo(i.salesOrderId).toLowerCase()
        case 'items': return i.items.length
        case 'total': return i.total
        case 'balance': return balanceOf(i)
        case 'status': return i.status.toLowerCase()
        default: return i.issuedAt
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      let cmp = 0
      if (typeof x === 'number' && typeof y === 'number') cmp = (x - y) * dir
      else cmp = String(x).localeCompare(String(y)) * dir
      if (cmp !== 0) return cmp
      // Legacy records carry no createdAt, so a higher number means newer.
      return b.number.localeCompare(a.number)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, q, statusFilter, sortKey, sortDir, members, users])

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
  const exportRows = (): Record<string, string | number>[] => rows.map((i) => ({
    Number: i.number,
    'Bill to': billTo(i.memberId, i.customerName),
    'Sales order': orderNo(i.salesOrderId),
    Recurring: recurrenceSummary(i),
    Issued: i.issuedAt,
    Items: i.items.length,
    Total: i.total,
    Balance: balanceOf(i),
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
    const a = document.createElement('a'); a.href = url; a.download = 'invoices.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('invoices', exportRows())
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
    { id: 'customer', label: 'Bill to', sort: 'customer' },
    { id: 'order', label: 'Sales order', sort: 'order' },
    { id: 'issued', label: 'Issued', sort: 'issued' },
    { id: 'items', label: 'Items', sort: 'items' },
    { id: 'total', label: 'Total', sort: 'total' },
    { id: 'balance', label: 'Balance', sort: 'balance' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const invoice = invoices.find((i) => i.id === openId)

  const nextNumber = () => nextInvoiceNumber(resolveInvoiceScheme(company?.invoiceScheme))

  // Invoice document theme (Settings → Invoice scheme → Invoice theme)
  const invTheme = resolveInvoiceScheme(company?.invoiceScheme).theme || 'classic'
  const brand = normalizeHex(company?.brandPrimary || '#C8F542')
  const ink = readableInk(brand)

  const openNew = () => setEditing({})

  /** Open a fresh editor prefilled from a saved invoice template. */
  const useTemplate = (t: InvoiceTemplate) => {
    setEditing({ template: t })
    setShowTemplates(false)
  }
  const deleteTemplate = (t: InvoiceTemplate) => {
    deleteInvoiceTemplate(t.id)
    log(user?.id || 'system', 'DELETE', 'InvoiceTemplate', `Deleted template "${t.name}"`)
    toast.success('Template deleted', `"${t.name}" was removed.`)
  }

  /** Working copy of a template being created/edited inside the Templates modal. */
  const [tplForm, setTplForm] = useState<{
    id?: string; name: string; items: { desc: string; qty: string; unitPrice: string }[]
    discountType: SaleDiscountType; discountAmount: string; taxName: string; taxRate: string; dueInDays: string; notes: string
  } | null>(null)
  const openTplForm = (t?: InvoiceTemplate) => {
    setTplForm(t
      ? {
          id: t.id, name: t.name,
          items: t.items.map((it) => ({ desc: it.desc, qty: String(it.qty ?? 1), unitPrice: String(it.unitPrice ?? it.amount) })),
          discountType: t.discountType || 'percentage',
          discountAmount: t.discountAmount ? String(t.discountAmount) : '',
          taxName: t.taxName || '',
          taxRate: t.taxRate != null ? String(t.taxRate) : '',
          dueInDays: t.dueInDays != null ? String(t.dueInDays) : '',
          notes: t.notes || '',
        }
      : { name: '', items: [{ desc: '', qty: '1', unitPrice: '' }], discountType: 'percentage', discountAmount: '', taxName: '', taxRate: '', dueInDays: '', notes: '' })
  }
  const setTplItem = (i: number, patch: Partial<{ desc: string; qty: string; unitPrice: string }>) =>
    setTplForm((f) => f && ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }))
  const taxOptions = useMemo(() => {
    const settings = branchSettingsFor(branchSettings, activeBranchId)
    const configured = settings?.taxRates?.length ? settings.taxRates : DEFAULT_BRANCH_TAXES
    return configured.filter((tax) => tax.status === 'active')
  }, [branchSettings, activeBranchId])
  const tplLineTotal = tplForm ? tplForm.items.reduce((s, it) => s + Math.max(0, Number(it.qty) || 1) * Math.max(0, Number(it.unitPrice) || 0), 0) : 0
  const tplDiscountValue = tplForm
    ? (tplForm.discountType === 'percentage' ? tplLineTotal * (Math.max(0, Number(tplForm.discountAmount) || 0) / 100) : Math.max(0, Number(tplForm.discountAmount) || 0))
    : 0
  const saveTplForm = () => {
    if (!tplForm) return
    const name = tplForm.name.trim()
    if (!name) { toast.error('Name the template.'); return }
    if (invoiceTemplates.some((t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== tplForm.id)) { toast.error('A template with this name already exists.', 'Use a different name to keep the list readable.'); return }
    const items: InvoiceItem[] = tplForm.items
      .map((it) => {
        const qty = Math.max(1, Number(it.qty) || 1)
        const unitPrice = Math.max(0, Number(it.unitPrice) || 0)
        return { desc: it.desc.trim(), qty, unitPrice, amount: Math.round(qty * unitPrice * 100) / 100 }
      })
      .filter((it) => it.desc && it.unitPrice > 0)
    if (!items.length) { toast.error('Add at least one priced line.'); return }
    const existing = tplForm.id ? invoiceTemplates.find((t) => t.id === tplForm.id) : undefined
    const discountAmount = tplForm.discountAmount ? Number(tplForm.discountAmount) : 0
    upsertInvoiceTemplate({
      id: tplForm.id || uid('itpl'),
      name,
      items,
      discountType: discountAmount > 0 ? tplForm.discountType : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      taxName: tplForm.taxName || undefined,
      taxRate: tplForm.taxName ? (Number(tplForm.taxRate) || 0) : undefined,
      dueInDays: tplForm.dueInDays ? Math.max(0, Number(tplForm.dueInDays)) : undefined,
      notes: tplForm.notes.trim() || undefined,
      companyId: existing?.companyId,
      createdBy: existing?.createdBy || user?.id,
      createdAt: existing?.createdAt || new Date().toISOString(),
    })
    log(user?.id || 'system', tplForm.id ? 'UPDATE' : 'CREATE', 'InvoiceTemplate', `${tplForm.id ? 'Updated' : 'Saved'} template "${name}"`)
    toast.success(tplForm.id ? 'Template updated' : 'Template saved', `"${name}" is available in the Template select.`)
    setTplForm(null)
  }

  const openEdit = (inv: Invoice) => setEditing({ invoice: inv })

  const doDelete = () => {
    if (!deleting) return
    deleteInvoice(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Invoice', `Deleted ${deleting.number}`)
    toast.success('Invoice deleted', deleting.number)
    setDeleting(null)
  }

  // ---- Record a payment against an invoice (same flow as Receive Payments) ----
  const openReceive = (inv: Invoice) => setForm({
    invoice: inv,
    date: new Date().toISOString().slice(0, 10),
    amount: String(balanceOf(inv)),
    method: 'cash',
    reference: '',
    notes: '',
  })

  const saveReceive = () => {
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
        title="Invoices"
        desc="Every invoice issued — sales, renewals, and manual charges."
        actions={
          <>
            <Button variant="outline" onClick={() => setShowTemplates(true)}><FileStack className="size-4" /> Templates{invoiceTemplates.length ? ` (${invoiceTemplates.length})` : ''}</Button>
            <Button onClick={openNew}><Plus className="size-4" /> New invoice</Button>
          </>
        }
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
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search number or customer…"
              aria-label="Search invoices"
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
                    background: i.id === justSaved
                      ? (isDark ? 'rgba(132,204,22,0.16)' : 'rgba(132,204,22,0.18)')
                      : idx % 2 ? ROW_ALT : 'transparent',
                    transition: 'background 300ms ease',
                  }}
                >
                  {visibleCols.has('action') && (
                    <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View invoice" onClick={() => setOpenId(i.id)}><FileText className="size-4" /></button>
                      <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit invoice" onClick={() => openEdit(i)}><Pencil className="size-4" /></button>
                      {(i.status === 'unpaid' || i.status === 'partially_paid' || i.status === 'overdue') && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Record payment" onClick={() => openReceive(i)}><Banknote className="size-4" /></button>
                      )}
                      {i.recurrence && !i.recurrence.stopped && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title={`Generate next occurrence — ${recurrenceSummary(i)}`} onClick={() => generateNext(i)}><Repeat className="size-4" /></button>
                      )}
                      {i.status !== 'paid' && i.status !== 'partially_paid' && (
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete invoice" onClick={() => setDeleting(i)}><Trash2 className="size-4" /></button>
                      )}
                    </td>
                  )}
                  {visibleCols.has('number') && (
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {i.number}
                      {i.recurrence && (
                        <span className="ml-1.5 inline-flex align-middle" title={`Recurring — ${recurrenceSummary(i)}`}>
                          <Repeat className="size-3.5" style={{ color: i.recurrence.stopped ? TEXT_MUTED : (isDark ? '#a3e635' : '#4d7c0f') }} aria-label={`Recurring: ${recurrenceSummary(i)}`} />
                        </span>
                      )}
                      {!i.recurrence && i.recurringFromId && (
                        <span className="ml-1.5 inline-flex align-middle opacity-50" title="Generated from a recurring cycle">
                          <Repeat className="size-3.5" style={{ color: TEXT_MUTED }} aria-label="From recurring cycle" />
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('customer') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{billTo(i.memberId, i.customerName)}</td>}
                  {visibleCols.has('order') && <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{orderNo(i.salesOrderId) || '—'}</td>}
                  {visibleCols.has('issued') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(i.issuedAt)}</td>}
                  {visibleCols.has('items') && <td className="px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{i.items.length}</td>}
                  {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(i.total)}</td>}
                  {visibleCols.has('balance') && <td className="whitespace-nowrap px-3 py-2.5 font-semibold" style={{ color: balanceOf(i) > 0 ? TEXT : TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(balanceOf(i))}</td>}
                  {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><StatusBadge status={i.status} /></td>}
                </tr>
              ))}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No invoices found.
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

      {/* View invoice */}
      <Modal open={!!invoice} onClose={() => setOpenId(null)} title={invoice?.number || 'Invoice'} wide>
        {invoice && (() => {
          const banded = invTheme === 'modern' || invTheme === 'bold'
          const wrapCls = invTheme === 'bold'
            ? 'rounded-xl bg-white p-5 text-sm text-zinc-900 ring-2 ring-zinc-900'
            : invTheme === 'modern'
              ? 'rounded-xl bg-white p-5 text-sm text-zinc-900 ring-1'
              : invTheme === 'minimal'
                ? 'bg-white px-6 py-7 text-sm text-zinc-900'
                : 'rounded-xl bg-white p-5 text-sm text-zinc-900'
          const headCls = banded
            ? '-m-5 mb-4 flex items-start justify-between gap-4 rounded-t-xl px-5 py-4'
            : invTheme === 'minimal'
              ? 'flex items-start justify-between gap-4 border-b border-zinc-200 pb-4'
              : 'flex items-start justify-between gap-4'
          const headStyle = invTheme === 'modern' ? { background: brand, color: ink } : invTheme === 'bold' ? { background: '#18181b', color: '#fafafa' } : undefined
          const tableWrapCls = invTheme === 'bold'
            ? 'mt-4 overflow-hidden rounded-lg border-2 border-zinc-900'
            : invTheme === 'modern'
              ? 'mt-4 overflow-hidden rounded-lg border'
              : invTheme === 'classic'
                ? 'mt-4 overflow-hidden rounded-lg border border-zinc-200'
                : 'mt-4 border-b border-zinc-200'
          const tableWrapStyle = invTheme === 'modern' ? { borderColor: `${brand}59` } : undefined
          const theadCls = invTheme === 'bold'
            ? 'bg-zinc-900 text-left uppercase tracking-wide text-white'
            : invTheme === 'minimal'
              ? 'text-left text-[10px] uppercase tracking-[0.16em] text-zinc-400'
              : 'bg-zinc-100 text-left uppercase tracking-wide text-zinc-500'
          const theadStyle = invTheme === 'modern' ? { background: `${brand}1f`, color: '#3f3f46' } : undefined
          const totalCls = invTheme === 'bold'
            ? 'flex w-48 justify-between border-t-2 border-zinc-900 pt-2 text-base font-bold'
            : invTheme === 'minimal'
              ? 'flex w-48 justify-between border-t border-zinc-200 pt-2 text-sm font-medium'
              : 'flex w-48 justify-between border-t border-zinc-300 pt-2 text-base font-bold'
          const totalStyle = invTheme === 'modern' ? { borderTop: `2px solid ${brand}` } : undefined
          return (
          <div className="space-y-3">
            <div id="invoice-print" className={wrapCls}>
              <div className={headCls} style={headStyle}>
                <div>
                  <p className={invTheme === 'minimal' ? 'font-display text-base font-semibold uppercase tracking-[0.18em]' : 'font-display text-lg font-bold'}>{company.name}</p>
                  {banded ? (
                    <p className="mt-1 text-xs opacity-80">{company.address} · TIN {company.taxId}</p>
                  ) : (
                    <>
                      <p className="text-xs text-zinc-500">{company.address}</p>
                      <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className={invTheme === 'minimal' ? 'text-[10px] uppercase tracking-[0.2em] text-zinc-400' : 'font-bold uppercase tracking-wide'}>Invoice</p>
                  {invTheme === 'bold' ? (
                    <p className="mt-1 inline-block rounded-md px-2 py-0.5 font-mono text-xs font-bold" style={{ background: brand, color: ink }}>{invoice.number}</p>
                  ) : (
                    <p className="mt-0.5 font-mono text-xs">{invoice.number}</p>
                  )}
                  <p className={`mt-1 text-xs ${banded ? 'opacity-80' : 'text-zinc-500'}`}>{formatDate(invoice.issuedAt)}</p>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-600">
                <p><span className="font-semibold">Bill to:</span> {billTo(invoice.memberId, invoice.customerName)}</p>
                <p className="mt-1"><span className="font-semibold">Due:</span> {formatDate(invoice.dueAt)}</p>
                {invoice.salesOrderId && <p className="mt-1"><span className="font-semibold">Sales order:</span> <span className="font-mono">{orderNo(invoice.salesOrderId)}</span></p>}
              </div>

              <div className={tableWrapCls} style={tableWrapStyle}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className={theadCls} style={theadStyle}>
                      <th className="px-3 py-2">Item</th>
                      {invoice.items.some((it) => it.qty != null) && <th className="px-3 py-2 text-right">Qty</th>}
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{it.desc}</td>
                        {invoice.items.some((x) => x.qty != null) && (
                          <td className="px-3 py-2 text-right">{it.qty != null ? `${it.qty}${it.unitPrice != null ? ` × ${formatGhsExact(it.unitPrice)}` : ''}` : ''}</td>
                        )}
                        <td className="px-3 py-2 text-right">{formatGhsExact(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(invoice.subtotal != null || (invoice.discountValue || 0) > 0 || (invoice.taxAmount || 0) > 0 || invoice.notes) && (
                <div className="mt-3 flex items-end justify-between gap-6">
                  {invoice.notes ? <p className="max-w-sm text-xs text-zinc-500">{invoice.notes}</p> : <span />}
                  <dl className="w-56 space-y-1 text-xs">
                    {invoice.subtotal != null && (
                      <div className="flex justify-between"><dt className="text-zinc-500">Subtotal</dt><dd>{formatGhsExact(invoice.subtotal)}</dd></div>
                    )}
                    {(invoice.discountValue || 0) > 0 && (
                      <div className="flex justify-between">
                        <dt className="text-zinc-500">Discount{invoice.discountCode ? ` (${invoice.discountCode})` : ''}</dt>
                        <dd>− {formatGhsExact(invoice.discountValue!)}</dd>
                      </div>
                    )}
                    {(invoice.taxAmount || 0) > 0 && (
                      <div className="flex justify-between"><dt className="text-zinc-500">{invoice.taxName} ({invoice.taxRate}%)</dt><dd>+ {formatGhsExact(invoice.taxAmount!)}</dd></div>
                    )}
                  </dl>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <div className={totalCls} style={totalStyle}>
                  <span>Total</span>
                  <span style={invTheme === 'modern' || invTheme === 'bold' ? { color: brand } : undefined}>{formatGhsExact(invoice.total)}</span>
                </div>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" onClick={() => setOpenId(null)}>Close</Button>
            </div>
          </div>
          )
        })()}
      </Modal>

      {/* Add / edit invoice — duplicate of the sales orders modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.invoice ? `Edit invoice — ${editing.invoice.number}` : 'Add invoice'}
        xl
      >
        {editing && (
          <InvoiceEditor
            invoice={editing.invoice}
            initialTemplate={editing.template}
            suggestedNumber={nextNumber()}
            onSaved={(savedId) => {
              // Surface the record just saved: default sort is newest-first, so
              // reset any custom sort and jump to page 1 — otherwise it can
              // land off-screen.
              setSortKey('issued'); setSortDir('desc'); setPage(1)
              setJustSaved(savedId)
              setEditing(null)
            }}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      {/* Invoice template library — use / edit / delete saved templates */}
      <Modal open={showTemplates} onClose={() => { setShowTemplates(false); setTplForm(null) }} title={tplForm ? (tplForm.id ? 'Edit template' : 'New template') : 'Invoice templates'} xl>
        {tplForm ? (
          <div className="space-y-3">
            <Field label="Template name" required>
              <Input value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} placeholder="e.g. Gym membership — monthly" />
            </Field>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold">Lines</p>
                <Button size="sm" variant="ghost" onClick={() => setTplForm({ ...tplForm, items: [...tplForm.items, { desc: '', qty: '1', unitPrice: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_80px_110px_36px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Description</span><span>Qty</span><span>Unit price</span><span />
              </div>
              <div className="space-y-2">
                {tplForm.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_80px_110px_36px] items-center gap-2">
                    <Input aria-label="Line description" value={it.desc} onChange={(e) => setTplItem(i, { desc: e.target.value })} />
                    <Input aria-label="Quantity" type="number" min={1} value={it.qty} onChange={(e) => setTplItem(i, { qty: e.target.value })} />
                    <Input aria-label="Unit price" type="number" min={0} step="0.01" value={it.unitPrice} onChange={(e) => setTplItem(i, { unitPrice: e.target.value })} />
                    <button type="button" className="grid h-[42px] w-9 shrink-0 place-items-center rounded border border-line text-mist transition hover:border-ember/60 hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setTplForm({ ...tplForm, items: tplForm.items.filter((_, idx) => idx !== i) })}><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-sm">Line total: <span className="font-semibold">{formatGhsExact(tplLineTotal)}</span>{tplDiscountValue > 0 && <span className="ml-4">Discount: <span className="font-semibold text-lime">{formatGhsExact(tplDiscountValue)}</span></span>}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Discount type">
                <Select value={tplForm.discountType} onChange={(e) => setTplForm({ ...tplForm, discountType: e.target.value as SaleDiscountType })}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </Field>
              <Field label="Discount">
                <Input type="number" min={0} value={tplForm.discountAmount} onChange={(e) => setTplForm({ ...tplForm, discountAmount: e.target.value })} placeholder="None" />
              </Field>
              <Field label="Tax">
                <Select value={tplForm.taxName} onChange={(e) => { const t = taxOptions.find((x) => x.name === e.target.value); setTplForm({ ...tplForm, taxName: e.target.value, taxRate: t ? String(t.rate) : '' }) }}>
                  <option value="">No tax</option>
                  {taxOptions.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.rate}%)</option>)}
                </Select>
              </Field>
              <Field label="Due in (days from issue)">
                <Input type="number" min={0} value={tplForm.dueInDays} onChange={(e) => setTplForm({ ...tplForm, dueInDays: e.target.value })} placeholder="No default" />
              </Field>
            </div>
            <Field label="Notes (prefilled into new invoices)">
              <Textarea value={tplForm.notes} onChange={(e) => setTplForm({ ...tplForm, notes: e.target.value })} rows={2} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTplForm(null)}>Cancel</Button>
              <Button onClick={saveTplForm}><Save className="size-4" /> Save template</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-mist">Pick a template to start a new invoice from, or edit and manage saved templates.</p>
              <Button size="sm" variant="outline" onClick={() => openTplForm()}><Plus className="size-4" /> New template</Button>
            </div>
            {invoiceTemplates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-mist">
                No templates yet. Open an invoice, set up its lines, then use <span className="font-semibold">Save as template</span>.
              </div>
            ) : (
              <div className="space-y-2">
                {invoiceTemplates.map((t) => {
                  const amount = t.items.reduce((s, it) => s + it.amount, 0)
                  return (
                    <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{t.name}</p>
                        <p className="mt-0.5 text-xs text-mist">
                          {t.items.length} line(s) · {formatGhsExact(amount)}
                          {t.discountAmount ? ` · ${t.discountType === 'percentage' ? `${t.discountAmount}%` : formatGhsExact(t.discountAmount)} discount` : ''}
                          {t.taxName ? ` · ${t.taxName} tax` : ''}
                          {t.dueInDays != null ? ` · due in ${t.dueInDays} day(s)` : ''}
                          {t.items.map((it, i) => (
                            <span key={i}> {i > 0 && <span>·</span>} <span className="text-ink/70">{it.desc}</span> {formatGhsExact(it.amount)}</span>
                          ))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button size="sm" onClick={() => useTemplate(t)}><Plus className="size-4" /> Use</Button>
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title={`Edit "${t.name}"`} aria-label={`Edit template ${t.name}`} onClick={() => openTplForm(t)}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title={`Delete "${t.name}"`} aria-label={`Delete template ${t.name}`} onClick={() => deleteTemplate(t)}><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Record payment against an invoice */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form ? `Receive payment — ${form.invoice.number}` : 'Receive payment'}>
        {form && (
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-black/5 p-3 text-sm dark:bg-white/5">
              <div className="flex items-center justify-between">
                <span className="text-mist">{billTo(form.invoice.memberId, form.invoice.customerName)}</span>
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
                  {PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Reference No."><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="MoMo / slip reference" /></Field>
            </div>
            <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional memo" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveReceive}><Banknote className="size-4" /> Receive {Number(form.amount) > 0 ? formatGhsExact(Number(form.amount)) : ''}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete invoice */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete invoice?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete invoice <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)})? This cannot be undone.
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
