import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Check, Banknote, Package, Wallet, Send, X, Info,
  Download, FileSpreadsheet, Columns3, ChevronDown, Filter, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker } from '../../../components/ui'
import { AttachmentField } from '../accounting/AttachmentField'
import { exportExcel } from '../../../lib/export'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import {
  nextInvoiceNumber, statusLabel, balanceOf, paidAgainst, canPay,
  SUPPLIER_INVOICE_STATUSES, receivedQty, CENT, paymentInvoiceIds,
  fullInvoiceTotals, validateInvoice, invoiceEditable, isPostableExpenseAccount, invoiceJournalPreview,
  PAY_TERM_UNITS, DEFAULT_PAY_TERM_UNIT, dueDateFromTerm, validatePayTerm,
} from '../../../lib/procurement'
import { ProcStatus, ActivityTimeline, SubHead, DocChip, RelatedDocs } from './common'
import type { AttachmentFile, PayTermUnit, SupplierInvoice, SupplierInvoiceExpenseLine, SupplierInvoiceLine } from '../../../types'

const year = new Date().getFullYear()
const DEFAULT_FROM = `${year}-01-01`
const DEFAULT_TO = `${year}-12-31`

type SortKey = 'number' | 'supplier' | 'type' | 'po' | 'grn' | 'date' | 'due' | 'total' | 'balance' | 'status'
type ColId = SortKey | 'action' | 'select'

/** Label with the info affordance used across the sale/purchase editors. */
function HelpLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{children}:{required && <span className="text-[#e00]" aria-hidden>*</span>}</span>
      <Info className="size-[15px] fill-[#00a9d4] text-white" strokeWidth={2.25} aria-hidden="true" />
    </span>
  )
}

type LineDraft = {
  itemId: string; description: string; qty: string; unitCost: string
  discount: string; tax: string
}
type ExpenseDraft = {
  accountId: string; description: string; amount: string; tax: string
}
type EditorTab = 'items' | 'expenses'

const BLANK_ITEM: LineDraft = {
  itemId: '', description: '', qty: '1', unitCost: '',
  discount: '0', tax: '0',
}
const BLANK_EXPENSE: ExpenseDraft = {
  accountId: '', description: '', amount: '', tax: '0',
}

export function SupplierInvoices() {
  const {
    supplierInvoices, supplierPayments, procPurchaseOrders, goodsReceipts,
    inventory, suppliers, branches, activeBranchId, accounts, company, upsertSupplierInvoice, deleteSupplierInvoice, log,
  } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')
  // Approval is a manager-level control, matching purchase orders and returns.
  const canApprove = hasRole('super_admin', 'gym_manager', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SupplierInvoice | null>(null)
  const [sourcePick, setSourcePick] = useState(false)
  const [editing, setEditing] = useState<
    | { id?: string; number: string; supplierId: string; purchaseOrderId: string; goodsReceiptId: string
        invoiceDate: string; dueDate: string; currency: string; notes: string
        branchId: string; payTermValue: string; payTermUnit: PayTermUnit
        attachments: AttachmentFile[]; lines: LineDraft[]; expenses: ExpenseDraft[] }
    | null
  >(null)
  const [tab, setTab] = useState<EditorTab>('items')
  const [showJournal, setShowJournal] = useState(false)

  const itemName = (id: string) => inventory.find((i) => i.id === id)?.name || id
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name || id
  const poNumber = (id?: string) => procPurchaseOrders.find((o) => o.id === id)?.number
  /** Whether an invoice carries items, expenses, or both. */
  const invoiceMix = (i: SupplierInvoice) => {
    const items = i.lines?.length || 0
    const exp = i.expenseLines?.length || 0
    if (items && exp) return 'Items + expenses'
    if (exp) return 'Expenses'
    return 'Items'
  }
  const grnNumber = (id?: string) => goodsReceipts.find((g) => g.id === id)?.number

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
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
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
    ['select', 'action', 'number', 'supplier', 'type', 'po', 'grn', 'date', 'due', 'total', 'balance', 'status'],
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

  /** Invoice ids ticked for bulk payment. */
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleSelected = (id: string) => setSelected((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ---- Filters (same panel as the Purchases history form) ----
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fLoc, setFLoc] = useState('all')
  const [fSupplier, setFSupplier] = useState('all')
  const [fType, setFType] = useState('all')
  const [fPayStatus, setFPayStatus] = useState('all')
  const [fFrom, setFFrom] = useState(DEFAULT_FROM)
  const [fTo, setFTo] = useState(DEFAULT_TO)

  /** Paid / partial / due, derived from posted payments — mirrors the Purchases payment filter. */
  const payStateOf = (i: SupplierInvoice): 'paid' | 'partial' | 'due' => {
    const bal = balanceOf(i, supplierPayments)
    if (bal <= CENT) return 'paid'
    return paidAgainst(supplierPayments, i.id) > CENT ? 'partial' : 'due'
  }

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = [...supplierInvoices]
      .filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter))
      .filter((i) => !ql || i.number.toLowerCase().includes(ql) || supplierName(i.supplierId).toLowerCase().includes(ql))
    if (fLoc !== 'all') list = list.filter((i) => i.branchId === fLoc)
    if (fSupplier !== 'all') list = list.filter((i) => i.supplierId === fSupplier)
    if (fType !== 'all') list = list.filter((i) => invoiceMix(i) === fType)
    if (fPayStatus !== 'all') list = list.filter((i) => payStateOf(i) === fPayStatus)
    if (fFrom) list = list.filter((i) => i.invoiceDate >= fFrom)
    if (fTo) list = list.filter((i) => i.invoiceDate <= fTo)

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (i: SupplierInvoice): string | number => {
      switch (sortKey) {
        case 'number': return i.number.toLowerCase()
        case 'supplier': return supplierName(i.supplierId).toLowerCase()
        case 'type': return invoiceMix(i).toLowerCase()
        case 'po': return (poNumber(i.purchaseOrderId) || '').toLowerCase()
        case 'grn': return (grnNumber(i.goodsReceiptId) || '').toLowerCase()
        case 'due': return i.dueDate || ''
        case 'total': return i.total
        case 'balance': return balanceOf(i, supplierPayments)
        case 'status': return statusLabel(i.status).toLowerCase()
        default: return i.invoiceDate
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }, [supplierInvoices, q, statusFilter, suppliers, sortKey, sortDir, supplierPayments, procPurchaseOrders, goodsReceipts, fLoc, fSupplier, fType, fPayStatus, fFrom, fTo])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, statusFilter, showEntries, fLoc, fSupplier, fType, fPayStatus, fFrom, fTo])
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
  const exportRows = (): Record<string, string | number>[] => rows.map((i) => ({
    Invoice: i.number,
    Supplier: supplierName(i.supplierId),
    Type: invoiceMix(i),
    'PO Ref': poNumber(i.purchaseOrderId) || '',
    'GRN Ref': grnNumber(i.goodsReceiptId) || '',
    Date: i.invoiceDate,
    Due: i.dueDate || '',
    Total: i.total,
    Balance: balanceOf(i, supplierPayments),
    Status: statusLabel(i.status),
  }))

  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || { Invoice: '', Supplier: '' })
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const v = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'supplier-invoices.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('supplier-invoices', exportRows())
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
    { id: 'select', label: '' },
    { id: 'action', label: 'Action' },
    { id: 'number', label: 'Invoice', sort: 'number' },
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'type', label: 'Type', sort: 'type' },
    { id: 'po', label: 'PO Ref', sort: 'po' },
    { id: 'grn', label: 'GRN Ref', sort: 'grn' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'due', label: 'Due', sort: 'due' },
    { id: 'total', label: 'Grand Total', sort: 'total' },
    { id: 'balance', label: 'Balance', sort: 'balance' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  /** Payable invoices on the current page — drives the header select-all box. */
  const pagePayable = pageRows.filter((i) => canPay(i, supplierPayments))
  /** Every ticked invoice that is still payable. */
  const selectedPayable = rows.filter((i) => selected.has(i.id) && canPay(i, supplierPayments))
  const selectedTotal = selectedPayable.reduce((sum, i) => sum + balanceOf(i, supplierPayments), 0)
  const tableMinWidth = shownHead.length * 120

  const open = supplierInvoices.find((i) => i.id === openId) || null

  /** Receipts that have been posted and so can be invoiced. */
  const postedGrns = useMemo(() => goodsReceipts.filter((g) => g.status === 'posted'), [goodsReceipts])
  /** Orders past approval — anything that could plausibly be invoiced. */
  const invoiceablePos = useMemo(
    () => procPurchaseOrders.filter((o) => !['draft', 'pending_approval', 'rejected', 'cancelled'].includes(o.status)),
    [procPurchaseOrders],
  )

  /** Accounts a user may charge an expense to, sorted for the searchable picker. */
  const expenseAccounts = useMemo(
    () => accounts.filter(isPostableExpenseAccount).sort((a, b) => a.name.localeCompare(b.name)),
    [accounts],
  )

  const blankEditor = () => ({
    number: nextInvoiceNumber(supplierInvoices),
    supplierId: suppliers[0]?.id || '', purchaseOrderId: '', goodsReceiptId: '',
    invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '', currency: 'GHS',
    branchId: activeBranchId || branches[0]?.id || '',
    payTermValue: '', payTermUnit: DEFAULT_PAY_TERM_UNIT,
    notes: '', attachments: [] as AttachmentFile[],
    lines: [{ ...BLANK_ITEM }] as LineDraft[],
    expenses: [] as ExpenseDraft[],
  })

  /** Build an invoice from a posted GRN — bills exactly what was accepted. */
  const fromGrn = (grnId: string) => {
    const g = goodsReceipts.find((x) => x.id === grnId)
    if (!g) return
    setEditing({
      ...blankEditor(),
      supplierId: g.supplierId, purchaseOrderId: g.purchaseOrderId, goodsReceiptId: g.id,
      lines: g.lines.filter((l) => l.quantityReceiving > 0).map((l) => ({
        ...BLANK_ITEM,
        itemId: l.itemId, qty: String(l.quantityReceiving), unitCost: String(l.unitCost),
      })),
    })
    setTab('items')
    setSourcePick(false)
  }

  /** Build an invoice from a PO — bills what has actually been received to date. */
  const fromPo = (poId: string) => {
    const o = procPurchaseOrders.find((x) => x.id === poId)
    if (!o) return
    const lines = o.lines.map((l) => {
      const got = receivedQty(goodsReceipts, o.id, l.itemId)
      return {
        ...BLANK_ITEM,
        itemId: l.itemId,
        description: l.description || '',
        qty: String(got > 0 ? got : l.quantity),
        unitCost: String(l.unitCost),
        discount: String(l.discountPercent ?? 0),
        tax: String(l.taxRate ?? 0),
      }
    })
    setEditing({
      ...blankEditor(), supplierId: o.supplierId, purchaseOrderId: o.id, goodsReceiptId: '',
      currency: o.currency || 'GHS', lines,
    })
    setTab('items')
    setSourcePick(false)
  }

  const openEdit = (i: SupplierInvoice) => {
    setEditing({
      id: i.id, number: i.number, supplierId: i.supplierId,
      purchaseOrderId: i.purchaseOrderId || '', goodsReceiptId: i.goodsReceiptId || '',
      invoiceDate: i.invoiceDate, dueDate: i.dueDate || '', currency: i.currency || 'GHS',
      branchId: i.branchId || '',
      payTermValue: i.payTermValue != null ? String(i.payTermValue) : '',
      payTermUnit: i.payTermUnit || DEFAULT_PAY_TERM_UNIT,
      notes: i.notes || '', attachments: i.attachments || [],
      lines: i.lines.map((l) => ({
        itemId: l.itemId, description: l.description || '',
        qty: String(l.quantity), unitCost: String(l.unitCost),
        discount: String(l.discountPercent ?? 0), tax: String(l.taxRate ?? 0),
      })),
      expenses: (i.expenseLines || []).map((e) => ({
        accountId: e.accountId, description: e.description || '', amount: String(e.amount),
        tax: String(e.taxRate ?? 0),
      })),
    })
    // Open on whichever tab actually has content.
    setTab(i.lines.length === 0 && (i.expenseLines?.length || 0) > 0 ? 'expenses' : 'items')
  }

  const setLine = (idx: number, patch: Partial<LineDraft>) => setEditing((e) =>
    e ? { ...e, lines: e.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : e)
  const setExpense = (idx: number, patch: Partial<ExpenseDraft>) => setEditing((e) =>
    e ? { ...e, expenses: e.expenses.map((x, i) => (i === idx ? { ...x, ...patch } : x)) } : e)
  const addItemRow = () => setEditing((e) => (e ? { ...e, lines: [...e.lines, { ...BLANK_ITEM }] } : e))
  const addExpenseRow = () => setEditing((e) => (e ? { ...e, expenses: [...e.expenses, { ...BLANK_EXPENSE }] } : e))
  const removeItemRow = (i: number) => setEditing((e) => (e ? { ...e, lines: e.lines.filter((_, x) => x !== i) } : e))
  const removeExpenseRow = (i: number) => setEditing((e) => (e ? { ...e, expenses: e.expenses.filter((_, x) => x !== i) } : e))

  /** Live totals across both tabs. */
  /** Keep the pay term and the derived due date in lockstep. */
  const setPayTerm = (rawValue: string, unit: PayTermUnit) => {
    if (!editing) return
    const n = rawValue === '' ? null : Number(rawValue)
    const due = dueDateFromTerm(editing.invoiceDate, n, unit)
    setEditing({ ...editing, payTermValue: rawValue, payTermUnit: unit, dueDate: due || editing.dueDate })
  }

  const payTermError = editing ? validatePayTerm(editing.payTermValue) : null

  const draftTotals = useMemo(() => {
    const empty = { itemGross: 0, discountTotal: 0, itemSubtotal: 0, expenseSubtotal: 0, itemTax: 0, expenseTax: 0, taxTotal: 0, total: 0 }
    if (!editing) return empty
    return fullInvoiceTotals(
      editing.lines.map((l) => ({
        quantity: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0,
        discountPercent: Number(l.discount) || 0, taxRate: Number(l.tax) || 0,
      })),
      editing.expenses.map((e) => ({ amount: Number(e.amount) || 0, taxRate: Number(e.tax) || 0 })),
    )
  }, [editing])

  /** Live validation drives the inline banner and disables the save actions. */
  const validation = useMemo(() => {
    if (!editing) return { ok: true, errors: [] as string[] }
    return validateInvoice(
      editing.lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 })),
      editing.expenses.map((e) => ({ accountId: e.accountId, amount: Number(e.amount) || 0 })),
      accounts,
    )
  }, [editing, accounts])

  /** Balanced double-entry preview for the current draft. */
  const journalPreview = useMemo(() => {
    if (!editing) return []
    return invoiceJournalPreview(
      editing.lines.map((l) => ({
        quantity: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0,
        discountPercent: Number(l.discount) || 0, taxRate: Number(l.tax) || 0,
      })),
      editing.expenses
        .filter((e) => e.accountId && (Number(e.amount) || 0) > 0)
        .map((e) => ({ accountId: e.accountId, amount: Number(e.amount) || 0, taxRate: Number(e.tax) || 0 })),
      accounts,
    )
  }, [editing, accounts])

  type SaveMode = 'draft' | 'submit' | 'approve' | 'post'

  /** Persist the draft. `mode` drives the workflow transition. */
  const save = (mode: SaveMode) => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Invoice number is required.'); return }
    if (!editing.supplierId) { toast.error('Select a supplier.'); return }
    if (!editing.branchId) { toast.error('Business location is required.'); return }
    if (payTermError) { toast.error('Invalid pay term', payTermError); return }
    if (!validation.ok) { toast.error('Cannot save invoice', validation.errors[0]); return }

    const lines: SupplierInvoiceLine[] = editing.lines
      .map((l): SupplierInvoiceLine | null => {
        const quantity = Number(l.qty); const unitCost = Number(l.unitCost)
        if (!l.itemId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost)) return null
        return {
          itemId: l.itemId,
          description: l.description.trim() || undefined,
          quantity, unitCost,
          discountPercent: Number(l.discount) || 0,
          taxRate: Number(l.tax) || 0,
        }
      })
      .filter((l): l is SupplierInvoiceLine => l != null)

    const expenseLines: SupplierInvoiceExpenseLine[] = editing.expenses
      .map((e): SupplierInvoiceExpenseLine | null => {
        const amount = Number(e.amount)
        if (!e.accountId || !Number.isFinite(amount) || amount <= 0) return null
        return {
          accountId: e.accountId,
          description: e.description.trim() || undefined,
          amount,
          taxRate: Number(e.tax) || 0,
        }
      })
      .filter((e): e is SupplierInvoiceExpenseLine => e != null)

    const t = fullInvoiceTotals(lines, expenseLines)
    const existing = supplierInvoices.find((i) => i.id === editing.id)
    const isNew = !editing.id
    const now = new Date().toISOString()
    const who = user?.name || 'system'

    // Only move the status forward; never regress a posted invoice.
    const nextStatus: SupplierInvoice['status'] =
      mode === 'post' ? 'posted'
      : mode === 'approve' ? 'approved'
      : mode === 'submit' ? 'submitted'
      : (existing?.status && existing.status !== 'draft' ? existing.status : 'draft')

    const rec: SupplierInvoice = {
      ...(existing || {} as SupplierInvoice),
      id: editing.id || uid('sinv'),
      number: editing.number.trim(),
      supplierId: editing.supplierId,
      purchaseOrderId: editing.purchaseOrderId || undefined,
      goodsReceiptId: editing.goodsReceiptId || undefined,
      invoiceDate: editing.invoiceDate,
      dueDate: editing.dueDate || undefined,
      currency: editing.currency || undefined,
      branchId: editing.branchId || undefined,
      payTermValue: editing.payTermValue.trim() !== '' ? Number(editing.payTermValue) : undefined,
      payTermUnit: editing.payTermValue.trim() !== '' ? editing.payTermUnit : undefined,
      lines,
      expenseLines: expenseLines.length ? expenseLines : undefined,
      subtotal: t.itemSubtotal,
      discountTotal: t.discountTotal,
      expenseSubtotal: t.expenseSubtotal,
      taxTotal: t.taxTotal,
      total: t.total,
      notes: editing.notes.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      status: nextStatus,
      submittedAt: mode === 'submit' ? now : existing?.submittedAt,
      submittedBy: mode === 'submit' ? who : existing?.submittedBy,
      approvedAt: mode === 'approve' ? now : existing?.approvedAt,
      approvedBy: mode === 'approve' ? who : existing?.approvedBy,
      postedAt: mode === 'post' ? now : existing?.postedAt,
      postedBy: mode === 'post' ? who : existing?.postedBy,
      createdAt: existing?.createdAt || now,
    }
    upsertSupplierInvoice(rec)

    const verb = mode === 'post' ? 'Posted' : mode === 'approve' ? 'Approved' : mode === 'submit' ? 'Submitted' : isNew ? 'Created' : 'Updated'
    const mix = lines.length && expenseLines.length ? 'items + expenses'
      : expenseLines.length ? 'expenses only' : 'items only'
    log(user?.id || 'system', mode === 'post' ? 'POST' : isNew ? 'CREATE' : 'UPDATE', 'Purchase Invoice',
      `${verb} ${rec.number} — ${formatGhsExact(rec.total)} (${mix}: ${lines.length} item line(s), ${expenseLines.length} expense line(s))`)
    toast.success(`Invoice ${verb.toLowerCase()}`, rec.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    if (paidAgainst(supplierPayments, deleting.id) > 0) {
      toast.error('Cannot delete', 'This invoice has payments against it.')
      setDeleting(null); return
    }
    deleteSupplierInvoice(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Purchase Invoice', `Deleted ${deleting.number}`)
    toast.success('Invoice deleted', deleting.number)
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Purchase invoices"
        desc="Bills received from suppliers. Generate one from a purchase order or a posted goods receipt."
        actions={canManage ? <Button onClick={() => setSourcePick(true)}><Plus className="size-4" /> New invoice</Button> : undefined}
      />

      {/* Filters */}
      <section className="mt-4 rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={filtersOpen}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: PANEL_BG, color: TEXT_MUTED }}><Filter className="size-4" aria-hidden /></span>
          <span className="flex-1 text-sm font-bold" style={{ color: TEXT }}>Filters</span>
          <ChevronDown className={('size-4 transition-transform ' + (filtersOpen ? 'rotate-180' : ''))} style={{ color: TEXT_MUTED }} aria-hidden />
        </button>
        {filtersOpen && (
          <div className="border-t px-4 py-4" style={{ borderColor: PANEL_BD }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Business Location:</p>
                <Select value={fLoc} onChange={(e) => { setFLoc(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fLoc === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Supplier:</p>
                <Select value={fSupplier} onChange={(e) => { setFSupplier(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fSupplier === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  {suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Invoice Type:</p>
                <Select value={fType} onChange={(e) => { setFType(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fType === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  <option value="Items">Items</option>
                  <option value="Expenses">Expenses</option>
                  <option value="Items + expenses">Items + expenses</option>
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Payment Status:</p>
                <Select value={fPayStatus} onChange={(e) => { setFPayStatus(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fPayStatus === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partially paid</option>
                  <option value="due">Due</option>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Date Range:</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    ['Today', 0],
                    ['Last 7 days', 6],
                    ['Last 30 days', 29],
                    ['This month', -1],
                    ['This year', -2],
                  ] as [string, number][]).map(([label, back]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const now = new Date()
                        const to = now.toISOString().slice(0, 10)
                        let from = to
                        if (back === 0) from = to
                        else if (back === -1) from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
                        else if (back === -2) from = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
                        else from = new Date(now.getTime() - back * 86400000).toISOString().slice(0, 10)
                        setFFrom(from); setFTo(to); setPage(1)
                      }}
                      className="rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
                      style={{ background: PANEL_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setFFrom(DEFAULT_FROM); setFTo(DEFAULT_TO); setFLoc('all'); setFSupplier('all'); setFType('all'); setFPayStatus('all'); setPage(1) }}
                    className="rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:opacity-80"
                    style={{ background: PANEL_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex max-w-md flex-wrap items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}` }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>From</span>
                  <input
                    type="date"
                    value={fFrom}
                    onChange={(e) => { setFFrom(e.target.value); setPage(1) }}
                    aria-label="Date range from"
                    className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                    style={{ color: TEXT, colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </label>
                <span style={{ color: TEXT_MUTED }}>–</span>
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-1.5" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}` }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>To</span>
                  <input
                    type="date"
                    value={fTo}
                    onChange={(e) => { setFTo(e.target.value); setPage(1) }}
                    aria-label="Date range to"
                    className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                    style={{ color: TEXT, colorScheme: isDark ? 'dark' : 'light' }}
                  />
                </label>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: TEXT_MUTED }}>
                Showing invoices dated {fFrom ? fFrom.split('-').reverse().join('/') : '…'} – {fTo ? fTo.split('-').reverse().join('/') : '…'} · {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'}
              </p>
            </div>
          </div>
        )}
      </section>

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
                  {HEAD.filter((h) => h.id !== 'action' && h.id !== 'select').map((h) => {
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
              {SUPPLIER_INVOICE_STATUSES.map((st) => <option key={st} value={st}>{statusLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search ..."
              aria-label="Search purchase invoices"
              className="w-full rounded-md border py-2 pl-9 pr-3 text-sm outline-none"
              style={{ background: INPUT_BG, borderColor: INPUT_BD, color: TEXT }}
            />
          </span>
        </div>

        {selectedPayable.length > 0 && (
          <div
            className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 sm:mx-5"
            style={{ background: isDark ? 'rgba(132,204,22,0.10)' : 'rgba(132,204,22,0.12)', borderColor: INPUT_BD }}
          >
            <span className="text-sm" style={{ color: TEXT }}>
              <span className="font-bold">{selectedPayable.length}</span>
              {' '}invoice{selectedPayable.length === 1 ? '' : 's'} selected
              {' '}· <span className="font-semibold">{formatGhsExact(selectedTotal)}</span> outstanding
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              {canManage && (
                <Button onClick={() => navigate(`/admin/supplier-payments?invoices=${selectedPayable.map((i) => i.id).join(',')}`)}>
                  <Banknote className="size-4" /> Pay selected
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr style={{ background: TABLE_HEAD_BG }}>
                {shownHead.map((h) => (
                  h.id === 'select' ? (
                    <th key={h.id} scope="col" className="w-10 px-3 py-3" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                      <input
                        type="checkbox"
                        className="size-4 accent-indigo-600 align-middle"
                        aria-label="Select all payable invoices on this page"
                        checked={pagePayable.length > 0 && pagePayable.every((i) => selected.has(i.id))}
                        ref={(el) => { if (el) el.indeterminate = pagePayable.some((i) => selected.has(i.id)) && !pagePayable.every((i) => selected.has(i.id)) }}
                        disabled={!pagePayable.length}
                        onChange={(e) => setSelected((cur) => {
                          const next = new Set(cur)
                          if (e.target.checked) pagePayable.forEach((i) => next.add(i.id))
                          else pagePayable.forEach((i) => next.delete(i.id))
                          return next
                        })}
                      />
                    </th>
                  ) : (
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
                  )
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((i, idx) => {
                const bal = balanceOf(i, supplierPayments)
                const overdue = i.dueDate && bal > 0 && i.dueDate < new Date().toISOString().slice(0, 10)
                return (
                  <tr key={i.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                    {visibleCols.has('select') && (
                      <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input
                          type="checkbox"
                          className="size-4 accent-indigo-600 align-middle"
                          aria-label={`Select ${i.number}`}
                          checked={selected.has(i.id)}
                          disabled={!canPay(i, supplierPayments)}
                          title={canPay(i, supplierPayments) ? undefined : 'Nothing outstanding to pay'}
                          onChange={() => toggleSelected(i.id)}
                        />
                      </td>
                    )}
                    {visibleCols.has('action') && (
                      <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(i.id)}><FileText className="size-4" /></button>
                        {canManage && invoiceEditable(i.status) && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(i)}><Pencil className="size-4" /></button>
                        )}
                        {canManage && canPay(i, supplierPayments) && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Record payment" onClick={() => navigate(`/admin/supplier-payments?invoice=${i.id}`)}><Banknote className="size-4" /></button>
                        )}
                        {canManage && invoiceEditable(i.status) && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(i)}><Trash2 className="size-4" /></button>
                        )}
                      </td>
                    )}
                    {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{i.number}</td>}
                    {visibleCols.has('supplier') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{supplierName(i.supplierId)}</td>}
                    {visibleCols.has('type') && <td className="whitespace-nowrap px-3 py-2.5 text-xs" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{invoiceMix(i)}</td>}
                    {visibleCols.has('po') && <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{poNumber(i.purchaseOrderId) || '—'}</td>}
                    {visibleCols.has('grn') && <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{grnNumber(i.goodsReceiptId) || '—'}</td>}
                    {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(i.invoiceDate)}</td>}
                    {visibleCols.has('due') && (
                      <td className="whitespace-nowrap px-3 py-2.5" style={{ color: overdue ? '#dc2626' : TEXT_MUTED, fontWeight: overdue ? 600 : 400, borderBottom: `1px solid ${PANEL_BD}` }}>
                        {i.dueDate ? formatDate(i.dueDate) : '—'}
                      </td>
                    )}
                    {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(i.total)}</td>}
                    {visibleCols.has('balance') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: bal > 0 ? TEXT : TEXT_MUTED, fontWeight: bal > 0 ? 600 : 400, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(bal)}</td>}
                    {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><ProcStatus status={i.status} /></td>}
                  </tr>
                )
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No purchase invoices found.
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

      {/* ── Source picker ──────────────────────────────────────────────── */}
      <Modal open={sourcePick} onClose={() => setSourcePick(false)} title="Create purchase invoice" wide>
        <div className="space-y-4">
          <p className="text-sm text-mist">
            Invoicing from a goods receipt bills exactly what was accepted, which is the safest match against the supplier's bill.
          </p>

          <div>
            <SubHead>From a posted goods receipt</SubHead>
            {postedGrns.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>GRN</th><th>Date</th><th>Supplier</th><th>PO</th><th className="text-right">Value</th><th /></tr></thead>
                  <tbody>
                    {postedGrns.map((g) => (
                      <tr key={g.id}>
                        <td className="font-mono text-xs font-semibold">{g.number}</td>
                        <td className="text-mist">{formatDate(g.date)}</td>
                        <td>{supplierName(g.supplierId)}</td>
                        <td className="font-mono text-xs">{poNumber(g.purchaseOrderId) || '—'}</td>
                        <td className="text-right">{formatGhsExact(g.total)}</td>
                        <td className="text-right"><Button size="sm" variant="outline" onClick={() => fromGrn(g.id)}>Use</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-mist">No posted goods receipts yet.</p>}
          </div>

          <div>
            <SubHead>From a purchase order</SubHead>
            {invoiceablePos.length ? (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>PO</th><th>Date</th><th>Supplier</th><th>Status</th><th className="text-right">Total</th><th /></tr></thead>
                  <tbody>
                    {invoiceablePos.map((o) => (
                      <tr key={o.id}>
                        <td className="font-mono text-xs font-semibold">{o.number}</td>
                        <td className="text-mist">{formatDate(o.date)}</td>
                        <td>{supplierName(o.supplierId)}</td>
                        <td><ProcStatus status={o.status} /></td>
                        <td className="text-right">{formatGhsExact(o.total)}</td>
                        <td className="text-right"><Button size="sm" variant="outline" onClick={() => fromPo(o.id)}>Use</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-xs text-mist">No approved purchase orders yet.</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSourcePick(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setEditing(blankEditor()); setSourcePick(false) }}>Start blank invoice</Button>
          </div>
        </div>
      </Modal>

      {/* ── View ───────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.number || 'Purchase invoice'} wide>
        {open && (() => {
          const paid = paidAgainst(supplierPayments, open.id)
          const bal = balanceOf(open, supplierPayments)
          const mine = supplierPayments.filter((p) => paymentInvoiceIds(p).includes(open.id))
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <ProcStatus status={open.status} />
                {open.status === 'draft' && <span className="text-xs text-mist">Draft — not yet in the payables ledger.</span>}
              </div>

              <div id="sinv-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-lg font-bold">{company.name}</p>
                    <p className="text-xs text-zinc-500">{company.address}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold uppercase tracking-wide">Purchase Invoice</p>
                    <p className="text-xs text-zinc-500">{open.number}</p>
                    <p className="mt-1 text-xs text-zinc-500">{formatDate(open.invoiceDate)}</p>
                    {open.dueDate && <p className="text-xs text-zinc-500">Due {formatDate(open.dueDate)}</p>}
                  </div>
                </div>

                <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                  <p><span className="font-semibold">Supplier:</span> {supplierName(open.supplierId)}</p>
                  <p><span className="font-semibold">PO reference:</span> {poNumber(open.purchaseOrderId) || '—'}</p>
                  <p><span className="font-semibold">GRN reference:</span> {grnNumber(open.goodsReceiptId) || '—'}</p>
                  <p><span className="font-semibold">Business location:</span> {branches.find((b) => b.id === open.branchId)?.name || '—'}</p>
                  <p><span className="font-semibold">Payment terms:</span> {open.payTermValue != null && open.payTermUnit ? `${open.payTermValue} ${open.payTermUnit === 'month' ? 'Month' : 'Day'}${open.payTermValue === 1 ? '' : 's'}` : '—'}</p>
                  <p><span className="font-semibold">Posted:</span> {open.postedAt ? formatDate(open.postedAt.slice(0, 10)) : '—'}</p>
                </div>

                <div className={`mt-4 overflow-hidden rounded-lg border border-zinc-200 ${open.lines.length ? '' : 'hidden'}`}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit cost</th>
                        <th className="px-3 py-2 text-right">Disc %</th>
                        <th className="px-3 py-2 text-right">Tax %</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {open.lines.map((l, i) => {
                        const gross = l.quantity * l.unitCost
                        const net = gross - gross * ((l.discountPercent || 0) / 100)
                        return (
                          <tr key={i} className="border-t border-zinc-100">
                            <td className="px-3 py-2">{itemName(l.itemId)}</td>
                            <td className="px-3 py-2 text-right">{l.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatGhsExact(l.unitCost)}</td>
                            <td className="px-3 py-2 text-right">{l.discountPercent || 0}</td>
                            <td className="px-3 py-2 text-right">{l.taxRate || 0}</td>
                            <td className="px-3 py-2 text-right">{formatGhsExact(net + net * ((l.taxRate || 0) / 100))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {!!open.expenseLines?.length && (
                  <div className="mt-4">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Expenses</p>
                    <div className="overflow-hidden rounded-lg border border-zinc-200">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                            <th className="px-3 py-2">Account</th>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2 text-right">Tax %</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {open.expenseLines.map((x, i) => (
                            <tr key={i} className="border-t border-zinc-100">
                              <td className="px-3 py-2">{accounts.find((a) => a.id === x.accountId)?.name || x.accountId}</td>
                              <td className="px-3 py-2">{x.description || '—'}</td>
                              <td className="px-3 py-2 text-right">{x.taxRate || 0}</td>
                              <td className="px-3 py-2 text-right">{formatGhsExact(x.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-end justify-between">
                  {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                  <div className="w-60 space-y-1 text-xs">
                    <div className="flex justify-between"><span>Item subtotal</span><span>{formatGhsExact(open.subtotal)}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span>−{formatGhsExact(open.discountTotal)}</span></div>
                    {!!open.expenseSubtotal && (
                      <div className="flex justify-between"><span>Expense subtotal</span><span>{formatGhsExact(open.expenseSubtotal)}</span></div>
                    )}
                    <div className="flex justify-between"><span>Tax</span><span>{formatGhsExact(open.taxTotal)}</span></div>
                    <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold"><span>Total</span><span>{formatGhsExact(open.total)}</span></div>
                    <div className="flex justify-between text-zinc-600"><span>Paid</span><span>−{formatGhsExact(paid)}</span></div>
                    <div className="flex justify-between border-t border-zinc-300 pt-2 font-bold"><span>Balance due</span><span>{formatGhsExact(bal)}</span></div>
                  </div>
                </div>
              </div>

              <div className="card p-4">
                <SubHead>Activity</SubHead>
                <ActivityTimeline events={[
                  { label: 'Invoice created', at: open.createdAt, tone: 'zinc' },
                  { label: 'Submitted', at: open.submittedAt, by: open.submittedBy, tone: 'amber' },
                  { label: 'Approved', at: open.approvedAt, by: open.approvedBy },
                  { label: 'Posted to payables', at: open.postedAt, by: open.postedBy },
                  ...mine.filter((p) => p.status === 'posted').map((p) => ({
                    label: `Payment ${p.number} — ${formatGhsExact(p.amount)}`, at: p.postedAt || p.paymentDate,
                  })),
                ]} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="card p-4">
                  <SubHead>Payments</SubHead>
                  {mine.length ? (
                    <ul className="space-y-2 text-sm">
                      {mine.map((p) => (
                        <li key={p.id} className="flex items-center justify-between">
                          <span className="font-mono text-xs">{p.number}</span>
                          <span className="text-mist">{formatDate(p.paymentDate)}</span>
                          <span className="font-semibold">{formatGhsExact(p.amount)}</span>
                          <ProcStatus status={p.status} />
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-mist">No payments recorded.</p>}
                </div>
                <div className="card p-4">
                  <SubHead>Related documents</SubHead>
                  <RelatedDocs>
                    {open.purchaseOrderId && <DocChip label={poNumber(open.purchaseOrderId) || 'PO'} onClick={() => navigate('/admin/procurement-orders')} />}
                    {open.goodsReceiptId && <DocChip label={grnNumber(open.goodsReceiptId) || 'GRN'} onClick={() => navigate('/admin/goods-receipts')} />}
                    {!open.purchaseOrderId && !open.goodsReceiptId && <p className="text-xs text-mist">Standalone invoice.</p>}
                  </RelatedDocs>
                  {open.attachments?.length ? (
                    <p className="mt-3 text-xs text-mist">{open.attachments.length} attachment(s): {open.attachments.map((a) => a.name).join(', ')}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                {canManage && invoiceEditable(open.status) && (
                  <Button onClick={() => { openEdit(open); setOpenId(null) }}><Pencil className="size-4" /> Edit</Button>
                )}
                {canManage && canPay(open, supplierPayments) && (
                  <Button onClick={() => navigate(`/admin/supplier-payments?invoice=${open.id}`)}><Banknote className="size-4" /> Record payment</Button>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Add / edit: tabbed Items | Expenses ────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Purchase Invoice' : 'New Purchase Invoice'} xl>
        {editing && (
          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Invoice number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Supplier" required>
                <Select value={editing.supplierId} onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })} placeholder="Search suppliers…">
                  <option value="">Please Select…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label={<HelpLabel required>Business Location</HelpLabel>}>
                <Select value={editing.branchId} onChange={(e) => setEditing({ ...editing, branchId: e.target.value })} placeholder="Search locations…">
                  <option value="">Please Select</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })}>
                  {['GHS', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Invoice date"><DatePicker value={editing.invoiceDate} onChange={(v) => setEditing({ ...editing, invoiceDate: v })} /></Field>
              <Field label="Due date"><DatePicker value={editing.dueDate} onChange={(v) => setEditing({ ...editing, dueDate: v })} /></Field>
              {/* Payment Terms — two responsive columns inside one grid cell. */}
              <div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label="Pay Term">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="Enter value"
                      aria-label="Pay Term"
                      aria-invalid={!!payTermError}
                      value={editing.payTermValue}
                      onChange={(e) => setPayTerm(e.target.value, editing.payTermUnit)}
                    />
                  </Field>
                  <Field label="Unit">
                    <Select
                      aria-label="Unit"
                      value={editing.payTermUnit}
                      onChange={(e) => setPayTerm(editing.payTermValue, e.target.value as PayTermUnit)}
                    >
                      {PAY_TERM_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </Select>
                  </Field>
                </div>
                {payTermError && <p className="mt-1 text-[11px] font-semibold text-rose-500">{payTermError}</p>}
              </div>
              <Field label="Purchase order reference">
                <Select value={editing.purchaseOrderId} onChange={(e) => setEditing({ ...editing, purchaseOrderId: e.target.value })} placeholder="Search orders…">
                  <option value="">None</option>
                  {procPurchaseOrders.map((o) => <option key={o.id} value={o.id}>{o.number} — {supplierName(o.supplierId)}</option>)}
                </Select>
              </Field>
              <Field label="Goods receipt reference">
                <Select value={editing.goodsReceiptId} onChange={(e) => setEditing({ ...editing, goodsReceiptId: e.target.value })} placeholder="Search receipts…">
                  <option value="">None</option>
                  {postedGrns.map((g) => <option key={g.id} value={g.id}>{g.number} — {supplierName(g.supplierId)}</option>)}
                </Select>
              </Field>
            </div>

            {/* Import helpers */}
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-500/20 bg-zinc-500/5 p-2.5">
              <span className="text-xs font-semibold text-mist">Import lines:</span>
              <Button size="sm" variant="outline" disabled={!editing.purchaseOrderId}
                onClick={() => editing.purchaseOrderId && fromPo(editing.purchaseOrderId)}>
                From purchase order
              </Button>
              <Button size="sm" variant="outline" disabled={!editing.goodsReceiptId}
                onClick={() => editing.goodsReceiptId && fromGrn(editing.goodsReceiptId)}>
                From goods receipt
              </Button>
              <span className="text-xs text-mist">Replaces the current item lines.</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-zinc-500/20">
              {([
                { id: 'items' as const, label: 'Items', icon: Package, count: editing.lines.filter((l) => l.itemId).length },
                { id: 'expenses' as const, label: 'Expenses', icon: Wallet, count: editing.expenses.filter((e) => e.accountId).length },
              ]).map((t) => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={[
                      '-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors',
                      active ? 'border-lime text-lime' : 'border-transparent text-mist hover:text-inherit',
                    ].join(' ')}
                  >
                    <Icon className="size-4" />
                    {t.label}
                    {t.count > 0 && (
                      <span className={['rounded-full px-1.5 py-0.5 text-[10px] font-bold', active ? 'bg-lime/20 text-lime' : 'bg-zinc-500/15 text-mist'].join(' ')}>
                        {t.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── Items tab ── */}
            {tab === 'items' && (
              <div>
                <div className="table-wrap">
                  <table className="data line-grid">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="w-40">Description</th>
                        <th className="w-20">Qty</th>
                        <th className="w-28">Unit cost</th>
                        <th className="w-20">Disc %</th>
                        <th className="w-20">Tax %</th>
                        <th className="w-28 text-right">Line total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {editing.lines.map((l, i) => {
                        const it = inventory.find((x) => x.id === l.itemId)
                        const gross = (Number(l.qty) || 0) * (Number(l.unitCost) || 0)
                        const net = gross - gross * ((Number(l.discount) || 0) / 100)
                        const lineTotal = net + net * ((Number(l.tax) || 0) / 100)
                        return (
                          <tr key={i}>
                            <td>
                              <Select value={l.itemId} placeholder="Search items…" onChange={(e) => {
                                const v = e.target.value
                                const picked = inventory.find((x) => x.id === v)
                                setLine(i, { itemId: v, unitCost: l.unitCost || String(picked?.costPrice ?? '') })
                              }}>
                                <option value="">Please Select…</option>
                                {inventory.map((x) => <option key={x.id} value={x.id}>{x.name}{x.sku ? ` — ${x.sku}` : ''}</option>)}
                              </Select>
                            </td>
                            <td><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder={it?.name || ''} /></td>
                            <td><Input value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} inputMode="decimal" /></td>
                            <td><Input value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} inputMode="decimal" /></td>
                            <td><Input value={l.discount} onChange={(e) => setLine(i, { discount: e.target.value })} inputMode="decimal" /></td>
                            <td><Input value={l.tax} onChange={(e) => setLine(i, { tax: e.target.value })} inputMode="decimal" /></td>
                            <td className="text-right text-sm font-semibold">{formatGhsExact(lineTotal)}</td>
                            <td>
                              <button className="rounded-lg p-2 text-mist hover:text-ember" title="Remove row" onClick={() => removeItemRow(i)}>
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {!editing.lines.length && (
                        <tr><td colSpan={8} className="py-6 text-center text-sm text-mist">No item lines. This invoice can still be saved with expenses only.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Button variant="ghost" className="mt-2" onClick={addItemRow}><Plus className="size-4" /> Add row</Button>
              </div>
            )}

            {/* ── Expenses tab ── */}
            {tab === 'expenses' && (
              <div>
                <div className="table-wrap">
                  <table className="data line-grid">
                    <thead>
                      <tr>
                        <th className="w-72">Expense account</th>
                        <th className="w-40">Description</th>
                        <th>Amount</th>
                        <th>Tax %</th>
                        <th className="w-28 text-right">Line total</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {editing.expenses.map((x, i) => {
                        const amt = Number(x.amount) || 0
                        const lineTotal = amt + amt * ((Number(x.tax) || 0) / 100)
                        const missing = !x.accountId && (amt !== 0 || !!x.description)
                        return (
                          <tr key={i}>
                            <td>
                              <Select value={x.accountId} placeholder="Search accounts…" onChange={(e) => setExpense(i, { accountId: e.target.value })}>
                                <option value="">Please Select…</option>
                                {expenseAccounts.map((a) => (
                                  <option key={a.id} value={a.id}>{a.code ? `${a.code} — ${a.name}` : a.name}</option>
                                ))}
                              </Select>
                              {missing && <p className="mt-1 text-[11px] font-semibold text-rose-500">Account required</p>}
                            </td>
                            <td><Input value={x.description} onChange={(e) => setExpense(i, { description: e.target.value })} placeholder="e.g. Shipping charges" /></td>
                            <td><Input value={x.amount} onChange={(e) => setExpense(i, { amount: e.target.value })} inputMode="decimal" /></td>
                            <td><Input value={x.tax} onChange={(e) => setExpense(i, { tax: e.target.value })} inputMode="decimal" /></td>
                            <td className="text-right text-sm font-semibold">{formatGhsExact(lineTotal)}</td>
                            <td>
                              <button className="rounded-lg p-2 text-mist hover:text-ember" title="Remove row" onClick={() => removeExpenseRow(i)}>
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {!editing.expenses.length && (
                        <tr><td colSpan={6} className="py-6 text-center text-sm text-mist">
                          No expense lines. Add freight, customs duty, professional fees or other supplier charges that do not affect inventory.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <Button variant="ghost" className="mt-2" onClick={addExpenseRow}><Plus className="size-4" /> Add row</Button>
              </div>
            )}

            {/* Validation banner */}
            {!validation.ok && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">Cannot save yet</p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* Totals + notes + attachments */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-[18rem] flex-1 space-y-3">
                <Field label="Notes"><Textarea rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
                <div>
                  <SubHead>Supporting documents</SubHead>
                  <AttachmentField files={editing.attachments} onChange={(next) => setEditing({ ...editing, attachments: next })} />
                </div>
              </div>
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between text-mist"><span>Item subtotal</span><span>{formatGhsExact(draftTotals.itemSubtotal)}</span></div>
                {draftTotals.discountTotal > 0 && (
                  <div className="flex justify-between text-mist"><span>Item discount</span><span>−{formatGhsExact(draftTotals.discountTotal)}</span></div>
                )}
                <div className="flex justify-between text-mist"><span>Expense subtotal</span><span>{formatGhsExact(draftTotals.expenseSubtotal)}</span></div>
                <div className="flex justify-between text-mist"><span>Tax total</span><span>{formatGhsExact(draftTotals.taxTotal)}</span></div>
                <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold">
                  <span>Grand total</span><span>{formatGhsExact(draftTotals.total)}</span>
                </div>
                <button type="button" className="pt-1 text-xs font-semibold text-mist underline-offset-2 hover:text-lime hover:underline"
                  onClick={() => setShowJournal((v) => !v)}>
                  {showJournal ? 'Hide' : 'Show'} accounting entry
                </button>
                {showJournal && (
                  <div className="mt-2 rounded-lg border border-zinc-500/20 p-2">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left uppercase tracking-wide text-mist">
                          <th className="pb-1">Account</th><th className="pb-1 text-right">Dr</th><th className="pb-1 text-right">Cr</th>
                        </tr>
                      </thead>
                      <tbody>
                        {journalPreview.map((j, i) => (
                          <tr key={i} className="border-t border-zinc-500/10">
                            <td className="py-1 pr-2">{j.accountName}</td>
                            <td className="py-1 text-right">{j.debit ? formatGhsExact(j.debit) : ''}</td>
                            <td className="py-1 text-right">{j.credit ? formatGhsExact(j.credit) : ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-1 text-[10px] text-mist">Preview only — no journal is written to the ledger yet.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow actions */}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="ghost" onClick={() => save('draft')} disabled={!validation.ok}>Save draft</Button>
              <Button variant="outline" onClick={() => save('submit')} disabled={!validation.ok}><Send className="size-4" /> Submit</Button>
              {canApprove && <Button variant="outline" onClick={() => save('approve')} disabled={!validation.ok}><Check className="size-4" /> Approve</Button>}
              <Button onClick={() => save('post')} disabled={!validation.ok}><Check className="size-4" /> Post invoice</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete ─────────────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete invoice">
        <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting?.number}</span>? Only unpaid drafts can be deleted.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="danger" onClick={doDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}
