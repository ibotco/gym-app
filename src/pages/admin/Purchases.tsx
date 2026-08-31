import { useMemo, useState, useEffect, useRef, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Trash2, ShoppingCart, X, Search as SearchIcon, Filter, ChevronDown,
  ChevronLeft, ChevronRight, FileText, FileSpreadsheet, Printer, Columns3,
  Download, FileDown, Check, Eye, CircleDollarSign, Info, Pencil,
  Barcode, Banknote, Undo2, SquarePen, Mail,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDismissOnOutside } from '../../lib/useDismissOnOutside'

const PAY_METHOD_LABELS: Record<string, string> = { cash: 'Cash', momo: 'Mobile Money', card: 'Card', bank: 'Bank transfer' }
import { Modal, Field, Input, Select, Empty, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, uid } from '../../lib/utils'
import { exportExcel } from '../../lib/export'
import { nextPurchaseReturnNumber } from '../../lib/inventory'
import type { Purchase, PurchaseLine, PurchasePayment, PurchaseReturn, PurchaseStatus, PaymentMethod } from '../../types'

type SortKey = 'date' | 'number' | 'location' | 'supplier' | 'status' | 'payment' | 'total' | 'addedBy'
type ColId = 'action' | 'date' | 'number' | 'location' | 'supplier' | 'status' | 'payment' | 'total' | 'due' | 'addedBy'

const year = new Date().getFullYear()
const DEFAULT_FROM = `${year}-01-01`
const DEFAULT_TO = `${year}-12-31`

const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function Purchases() {
  const app = useApp()
  const navigate = useNavigate()
  const { branches, suppliers, users, purchases, purchaseReturns, inventory, activeCompanyId, activeBranchId, recordPurchase, updatePurchase, updatePurchaseStatus, deletePurchase, purchasePayments, addPurchasePayment, updatePurchasePayment, deletePurchasePayment, upsertPurchaseReturn, company, upsertSupplier, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  // Theme tokens (mirror the Products list page so both themes fit).
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark')); sync()
    const obs = new MutationObserver(sync); obs.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  const CARD_BG = isDark ? '#1b1f24' : '#ffffff'
  const PANEL_BG = isDark ? '#20252c' : '#f8fafc'
  const PANEL_BD = isDark ? '#363c44' : '#e5e7eb'
  const TABLE_HEAD_BG = isDark ? '#2a313b' : '#f1f5f9'
  const ROW_ALT = isDark ? '#1f242b' : '#f1f5f9'
  const TEXT = isDark ? '#e5e7eb' : '#0f172a'
  const TEXT_MUTED = isDark ? '#9aa3ad' : '#64748b'
  const INPUT_BG = isDark ? '#14171c' : '#ffffff'
  const INPUT_BD = isDark ? '#49515c' : '#cbd5e1'
  const INDIGO = '#4f46e5'
  const RED = '#dc2626'

  // ---- Add / edit purchase editor (UltimatePOS-style layout) ----
  type LineDraft = { itemId: string; quantity: string; unitCost: string; discountPercent: string; sellPrice: string }
  type EdState = {
    id?: string
    supplierId: string
    referenceNo: string
    status: PurchaseStatus
    date: string
    branchId: string
    notes: string
    discountType: 'none' | 'fixed' | 'percent'
    discountAmount: string
    shippingDetails: string
    shippingCharges: string
    payMethod: PaymentMethod
    paidOn: string
    payNote: string
    lines: LineDraft[]
  }
  const today = new Date().toISOString().slice(0, 10)
  const blankEd = (): EdState => ({
    supplierId: suppliers[0]?.id || '',
    referenceNo: '',
    status: 'received',
    date: today,
    branchId: activeBranchId || branches[0]?.id || '',
    notes: '',
    discountType: 'none',
    discountAmount: '',
    shippingDetails: '',
    shippingCharges: '',
    payMethod: 'cash',
    paidOn: today,
    payNote: '',
    lines: [{ itemId: '', quantity: '1', unitCost: '', discountPercent: '', sellPrice: '' }],
  })
  const [purchaseModal, setPurchaseModal] = useState(false)
  const [ed, setEd] = useState<EdState>(() => blankEd())
  const [poSearch, setPoSearch] = useState('')
  const [poSearchOpen, setPoSearchOpen] = useState(false)
  const [quickSupplierOpen, setQuickSupplierOpen] = useState(false)
  const [quickSupplierName, setQuickSupplierName] = useState('')
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('')

  const setEdField = <K extends keyof EdState>(key: K, value: EdState[K]) => setEd((cur) => ({ ...cur, [key]: value }))
  const setLine = (index: number, patch: Partial<LineDraft>) => setEd((cur) => ({ ...cur, lines: cur.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)) }))

  const num = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? 0 : Number(v))
  const lineCostBefore = (l: LineDraft) => num(l.unitCost) * (1 - Math.min(Math.max(num(l.discountPercent), 0), 100) / 100)
  const lineTotal = (l: LineDraft) => num(l.quantity) * lineCostBefore(l)
  const netTotal = ed.lines.reduce((sum, l) => sum + (l.itemId ? lineTotal(l) : 0), 0)
  const totalItems = ed.lines.reduce((sum, l) => sum + (l.itemId ? num(l.quantity) : 0), 0)
  const discountValue = ed.discountType === 'fixed' ? Math.min(num(ed.discountAmount), netTotal) : ed.discountType === 'percent' ? (netTotal * Math.min(num(ed.discountAmount), 100)) / 100 : 0
  const shippingValue = Math.max(num(ed.shippingCharges), 0)
  const purchaseTotal = Math.max(0, netTotal - discountValue + shippingValue)
  const marginOf = (l: LineDraft) => {
    const cost = lineCostBefore(l)
    return cost > 0 && num(l.sellPrice) > 0 ? Math.round(((num(l.sellPrice) / cost - 1) * 100 + Number.EPSILON) * 100) / 100 : 0
  }

  const openNewPurchase = () => {
    setEd(blankEd())
    setPoSearch('')
    setPoSearchOpen(false)
    setPurchaseModal(true)
  }
  const openEditPurchase = (p: (typeof purchases)[number]) => {
    setEd({
      id: p.id,
      supplierId: p.supplierId,
      referenceNo: p.number,
      status: p.status,
      date: p.date || p.createdAt.slice(0, 10),
      branchId: p.branchId || activeBranchId || branches[0]?.id || '',
      notes: p.notes || '',
      discountType: p.discount ? 'fixed' : 'none',
      discountAmount: p.discount ? String(p.discount) : '',
      shippingDetails: p.shippingDetails || '',
      shippingCharges: p.shippingCharges ? String(p.shippingCharges) : '',
      payMethod: p.paymentMethod || 'cash',
      paidOn: p.paidOn || p.date || today,
      payNote: '',
      lines: p.lines.map((l) => ({
        itemId: l.itemId,
        quantity: String(l.quantity),
        unitCost: String(l.unitCost),
        discountPercent: l.discountPercent ? String(l.discountPercent) : '',
        sellPrice: l.sellPrice ? String(l.sellPrice) : String(inventory.find((it) => it.id === l.itemId)?.sellPrice || ''),
      })),
    })
    setPoSearch('')
    setPoSearchOpen(false)
    setPurchaseModal(true)
  }

  const addSearchLine = (itemId: string) => {
    const item = inventory.find((it) => it.id === itemId)
    if (!item) return
    setEd((cur) => {
      const base = cur.lines.filter((l) => l.itemId)
      return { ...cur, lines: [...base, { itemId, quantity: '1', unitCost: String(item.costPrice || ''), discountPercent: '', sellPrice: String(item.sellPrice || '') }] }
    })
    setPoSearch('')
    setPoSearchOpen(false)
  }
  const searchMatches = poSearch.trim()
    ? inventory.filter((it) => `${it.name} ${it.sku}`.toLowerCase().includes(poSearch.trim().toLowerCase())).slice(0, 6)
    : []

  const submitPurchase = () => {
    if (!ed.branchId) { toast.error('Select a business location'); return }
    const lines: PurchaseLine[] = ed.lines
      .filter((l) => l.itemId && num(l.quantity) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantity: num(l.quantity),
        unitCost: num(l.unitCost),
        discountPercent: num(l.discountPercent) || undefined,
        sellPrice: num(l.sellPrice) || undefined,
      }))
    const input = {
      companyId: activeCompanyId || undefined,
      branchId: ed.branchId || activeBranchId || undefined,
      supplierId: ed.supplierId,
      lines,
      status: ed.status,
      referenceNo: ed.referenceNo.trim() || undefined,
      discount: discountValue || undefined,
      shippingCharges: shippingValue || undefined,
      shippingDetails: ed.shippingDetails.trim() || undefined,
      paymentMethod: ed.status === 'paid' ? ed.payMethod : undefined,
      paidOn: ed.status === 'paid' ? ed.paidOn : undefined,
      notes: [ed.notes.trim(), ed.payNote.trim() ? `Payment note: ${ed.payNote.trim()}` : ''].filter(Boolean).join('\n') || undefined,
      userId: user?.id || 'system',
      date: ed.date || undefined,
    }
    if (ed.id) {
      const r = updatePurchase(ed.id, input)
      if (!r.ok) { toast.error(r.error || 'Could not update purchase'); return }
      log(user?.id || 'system', 'PURCHASE', 'Purchases', `Updated purchase ${ed.referenceNo || ''}`.trim())
      toast.success('Purchase updated')
    } else {
      const r = recordPurchase(input)
      if (!r.ok) { toast.error(r.error || 'Could not record purchase'); return }
      log(user?.id || 'system', 'PURCHASE', 'Purchases', `Purchase ${r.purchase?.number} — ${formatGhsExact(r.purchase?.total || 0)}`)
      toast.success('Purchase recorded', r.purchase?.number)
    }
    setPurchaseModal(false)
  }

  const quickAddSupplier = () => {
    const name = quickSupplierName.trim()
    if (!name) { toast.error('Enter a supplier name'); return }
    const id = `sup_${Date.now().toString(36)}`
    upsertSupplier({ id, name, contact: quickSupplierPhone.trim(), email: '', phone: quickSupplierPhone.trim() })
    setEdField('supplierId', id)
    setQuickSupplierOpen(false)
    setQuickSupplierName('')
    setQuickSupplierPhone('')
    toast.success('Supplier added', name)
  }

  // ---- Filters ----
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fLoc, setFLoc] = useState('all')
  const [fSupplier, setFSupplier] = useState('all')
  const [fPStatus, setFPStatus] = useState('all')
  const [fPayStatus, setFPayStatus] = useState('all')
  const [fFrom, setFFrom] = useState(DEFAULT_FROM)
  const [fTo, setFTo] = useState(DEFAULT_TO)

  // ---- Table state ----
  const [q, setQ] = useState('')
  const [showEntries, setShowEntries] = useState(25)
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [colsOpen, setColsOpen] = useState(false)
  const colsRef = useRef<HTMLDivElement | null>(null)
  const [visibleCols, setVisibleCols] = useState<Set<ColId>>(() => new Set<ColId>(['action', 'date', 'number', 'location', 'supplier', 'status', 'payment', 'total', 'due', 'addedBy']))
  const [openActions, setOpenActions] = useState<string | null>(null)
  const [actionMenuPosition, setActionMenuPosition] = useState({ top: 0, left: 0 })

  const userName = (id: string) => users.find((u) => u.id === id)?.name || id
  const branchName = (id?: string) => (id ? branches.find((b) => b.id === id)?.name || id : '—')

  const rows = useMemo(() => purchases.map((p) => ({
    id: p.id,
    number: p.number,
    date: p.date || p.createdAt.slice(0, 10),
    dateTime: p.createdAt,
    location: branchName(p.branchId),
    supplier: suppliers.find((s) => s.id === p.supplierId)?.name || p.supplierId,
    status: p.status,
    paid: p.status === 'paid',
    total: p.total,
    due: p.status === 'paid' ? 0 : p.total,
    addedBy: userName(p.userId),
  })), [purchases, suppliers, branches, users])

  const filtered = useMemo(() => {
    let list = rows
    if (fLoc !== 'all') list = list.filter((r) => branchName(fLoc) === r.location)
    if (fSupplier !== 'all') list = list.filter((r) => r.supplier === (suppliers.find((s) => s.id === fSupplier)?.name || fSupplier))
    if (fPStatus !== 'all') list = list.filter((r) => (fPStatus === 'ordered' ? r.status === 'ordered' : r.status !== 'ordered'))
    if (fPayStatus !== 'all') list = list.filter((r) => (fPayStatus === 'paid' ? r.paid : !r.paid))
    if (fFrom) list = list.filter((r) => r.date >= fFrom)
    if (fTo) list = list.filter((r) => r.date <= fTo)
    const ql = q.trim().toLowerCase()
    if (ql) list = list.filter((r) => `${r.number} ${r.supplier} ${r.location} ${r.addedBy}`.toLowerCase().includes(ql))
    const val = (x: (typeof rows)[number]): string | number => {
      switch (sortKey) {
        case 'date': return x.dateTime
        case 'number': return x.number.toLowerCase()
        case 'location': return x.location.toLowerCase()
        case 'supplier': return x.supplier.toLowerCase()
        case 'status': return x.status
        case 'payment': return x.paid ? 1 : 0
        case 'total': return x.total
        case 'addedBy': return x.addedBy.toLowerCase()
        default: return x.dateTime
      }
    }
    return [...list].sort((a, b) => {
      const av = val(a), bv = val(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, fLoc, fSupplier, fPStatus, fPayStatus, fFrom, fTo, q, sortKey, sortDir, branches])

  const totalPages = Math.max(1, Math.ceil(filtered.length / showEntries))
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const startIdx = filtered.length === 0 ? 0 : (page - 1) * showEntries + 1
  const endIdx = Math.min(page * showEntries, filtered.length)
  const paged = filtered.slice((page - 1) * showEntries, page * showEntries)

  // Return totals inside the same date window (for the footer block).
  const returnTotal = useMemo(
    () => purchaseReturns
      .filter((r) => { const d = r.date || r.createdAt.slice(0, 10); return (!fFrom || d >= fFrom) && (!fTo || d <= fTo) })
      .reduce((sum, r) => sum + (r.total || 0), 0),
    [purchaseReturns, fFrom, fTo])
  const grandTotal = filtered.reduce((sum, r) => sum + r.total, 0)
  const dueTotal = filtered.reduce((sum, r) => sum + r.due, 0)
  const paidCount = filtered.filter((r) => r.paid).length
  const dueCount = filtered.length - paidCount

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="ml-1 inline-flex items-center" style={{ color: sortKey === col ? TEXT : TEXT_MUTED }} aria-hidden>
      <ChevronDown className={('size-3.5 transition-transform ' + (sortKey !== col ? 'opacity-50' : sortDir === 'asc' ? 'rotate-180' : ''))} />
    </span>
  )

  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  const exportRows = (): Record<string, string | number>[] => filtered.map((r) => ({
    Date: r.date, 'Reference No': r.number, Location: r.location, Supplier: r.supplier,
    'Purchase Status': r.status === 'ordered' ? 'Ordered' : 'Received',
    'Payment Status': r.paid ? 'Paid' : 'Due',
    'Grand Total': r.total, 'Payment due': r.due, 'Added By': r.addedBy,
  }))
  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || { Date: '', 'Reference No': '' })
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const s = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'purchases.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('purchases', exportRows())
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

  const toggleActionMenu = (event: MouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation()
    if (openActions === id) { setOpenActions(null); return }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    setActionMenuPosition({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 300) })
    setOpenActions(id)
  }
  useEffect(() => {
    if (openActions === null) return
    const close = () => setOpenActions(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [openActions])
  const actionRow = openActions === null ? null : purchases.find((p) => p.id === openActions) || null

  const badge = (kind: 'received' | 'ordered' | 'paid' | 'due', clickable?: boolean, onClick?: () => void, title?: string) => {
    const map = {
      received: { background: 'rgba(22, 163, 74, 0.12)', borderColor: 'rgba(22, 163, 74, 0.45)', color: '#16a34a', label: 'Received' },
      ordered: { background: 'rgba(217, 119, 6, 0.12)', borderColor: 'rgba(217, 119, 6, 0.45)', color: '#d97706', label: 'Ordered' },
      paid: { background: 'rgba(22, 163, 74, 0.12)', borderColor: 'rgba(22, 163, 74, 0.45)', color: '#16a34a', label: 'Paid' },
      due: { background: 'rgba(220, 38, 38, 0.10)', borderColor: 'rgba(220, 38, 38, 0.40)', color: RED, label: 'Due' },
    } as const
    const s = map[kind]
    const chip = <span className="rounded-md px-2 py-0.5 text-xs font-semibold" style={{ background: s.background, border: `1px solid ${s.borderColor}`, color: s.color }}>{s.label}</span>
    if (!clickable) return chip
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className="rounded-md transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        {chip}
      </button>
    )
  }

  // ---- row actions: view / print / labels / payments / return / status ----
  const [viewRow, setViewRow] = useState<Purchase | null>(null)
  const [paymentsRow, setPaymentsRow] = useState<Purchase | null>(null)
  const [viewPayment, setViewPayment] = useState<PurchasePayment | null>(null)
  const [payForm, setPayForm] = useState<null | { mode: 'add' | 'edit'; purchaseId: string; paymentId?: string; method: PaymentMethod; paidOn: string; amount: string; account: string; note: string }>(null)
  const [returnRow, setReturnRow] = useState<Purchase | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, string>>({})
  const [returnReason, setReturnReason] = useState('')
  const [statusRow, setStatusRow] = useState<Purchase | null>(null)
  const [statusPick, setStatusPick] = useState<PurchaseStatus>('received')

  const itemName = (id: string) => inventory.find((it) => it.id === id)?.name || id
  const itemSku = (id: string) => inventory.find((it) => it.id === id)?.sku || ''
  const fmtPayDateTime = (v: string) => {
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return v
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const nowLocalMinutes = () => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  const paymentsOf = (purchaseId: string) => purchasePayments.filter((pp) => pp.purchaseId === purchaseId).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const escHtml = (v: string) => v.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))

  const openPayModal = (p: Purchase) => {
    setPayForm({ mode: 'add', purchaseId: p.id, method: (p.paymentMethod as PaymentMethod) || 'cash', paidOn: p.paidOn ? `${p.paidOn}T${nowLocalMinutes().slice(11)}` : nowLocalMinutes(), amount: p.total.toFixed(2), account: '', note: '' })
  }
  const openEditPayment = (pay: PurchasePayment, p: Purchase) => {
    setPayForm({ mode: 'edit', purchaseId: p.id, paymentId: pay.id, method: pay.method, paidOn: pay.paidOn, amount: pay.amount.toFixed(2), account: pay.account || '', note: pay.note || '' })
  }
  const openReturnModal = (p: Purchase) => { setReturnRow(p); setReturnQty(Object.fromEntries(p.lines.map((l) => [l.itemId, String(l.quantity)]))); setReturnReason('') }
  const openStatusModal = (p: Purchase) => { setStatusRow(p); setStatusPick(p.status) }

  const openPrintWindow = (title: string, body: string) => {
    const w = window.open('', '_blank', 'width=920,height=680')
    if (!w) { toast.error('Allow pop-ups to print'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(title)}</title><style>
      body{font-family:system-ui,Arial,sans-serif;padding:26px;color:#111827}
      h1{font-size:20px;margin:0 0 2px}.muted{color:#6b7280;font-size:12px;margin:1px 0}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
      th{background:#4caf50;color:#fff;text-align:left;padding:6px 8px}td{border-bottom:1px solid #e5e7eb;padding:6px 8px}
      .totals{margin-top:14px;text-align:right;font-size:13px;line-height:1.7}
      .grand{font-size:16px;font-weight:700;color:#4f46e5}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
      .label{border:1px solid #d1d5db;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid}
      .label b{display:block;font-size:12px;margin-bottom:2px}.label .sku{font-family:monospace;font-size:11px;color:#374151}
      .bars{height:34px;margin-top:6px;background:repeating-linear-gradient(90deg,#111 0 2px,transparent 2px 5px,#111 5px 6px,transparent 6px 8px,#111 8px 11px,transparent 11px 13px)}
      @media print{body{padding:0}}
    </style></head><body>${body}</body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }

  const printPurchase = (p: Purchase) => {
    const sup = suppliers.find((x) => x.id === p.supplierId)
    const rowsHtml = p.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${escHtml(itemName(l.itemId))}</td><td>${l.quantity}</td><td>${formatGhsExact(l.unitCost)}</td><td>${l.discountPercent ? `${l.discountPercent}%` : '—'}</td><td>${formatGhsExact(l.quantity * l.unitCost * (1 - (l.discountPercent || 0) / 100))}</td></tr>`).join('')
    openPrintWindow(p.number, `
      <h1>Purchase ${escHtml(p.number)}</h1>
      <p class="muted">Supplier: ${escHtml(sup?.name || p.supplierId)}${sup?.contact ? ` · ${escHtml(sup.contact)}` : ''}</p>
      <p class="muted">Location: ${escHtml(branchName(p.branchId))} &middot; Date: ${escHtml(p.date)} &middot; Status: ${escHtml(p.status)}</p>
      <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit cost</th><th>Discount</th><th>Line total</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="totals">
        ${p.discount ? `Discount: -${formatGhsExact(p.discount)}<br/>` : ''}
        ${p.shippingCharges ? `Shipping: ${formatGhsExact(p.shippingCharges)}<br/>` : ''}
        <span class="grand">Total: ${formatGhsExact(p.total)}</span><br/>
        <span class="muted">Payment due: ${formatGhsExact(p.status === 'paid' ? 0 : p.total)}</span>
      </div>`)
  }

  const printLabels = (p: Purchase) => {
    const labels: string[] = []
    for (const l of p.lines) {
      const copies = Math.min(Math.max(Math.round(l.quantity), 1), 100)
      for (let c = 0; c < copies; c++) {
        labels.push(`<div class="label"><b>${escHtml(itemName(l.itemId))}</b><span class="sku">${escHtml(itemSku(l.itemId))}</span><div class="bars"></div><span class="sku">${formatGhsExact(l.unitCost)}</span></div>`)
      }
    }
    openPrintWindow(`Labels — ${p.number}`, `<h1>Labels — ${escHtml(p.number)}</h1><p class="muted">${labels.length} label(s)</p><div class="grid">${labels.join('')}</div>`)
  }

  const notifyItemsReceived = (p: Purchase) => {
    const sup = suppliers.find((x) => x.id === p.supplierId)
    log(user?.id || 'system', 'NOTIFY', 'Purchases', `Items received notification for ${p.number} sent to ${sup?.name || 'supplier'}`)
    toast.success(`Notification sent to ${sup?.name || 'supplier'}`, p.number)
  }

  const submitPayment = () => {
    if (!payForm) return
    const purchase = purchases.find((x) => x.id === payForm.purchaseId)
    if (!purchase) return
    if (payForm.mode === 'add') {
      const r = addPurchasePayment(payForm.purchaseId, { amount: num(payForm.amount) || purchase.total, method: payForm.method, paidOn: payForm.paidOn || nowLocalMinutes(), note: payForm.note, account: payForm.account })
      if (!r.ok) { toast.error(r.error || 'Could not record payment'); return }
      log(user?.id || 'system', 'PAYMENT', 'Purchases', `Payment ${r.payment?.referenceNo || ''} recorded for ${purchase.number} — ${formatGhsExact(r.payment?.amount || 0)}`.trim())
      toast.success('Payment recorded', r.payment?.referenceNo)
    } else if (payForm.paymentId) {
      const r = updatePurchasePayment(payForm.paymentId, { amount: num(payForm.amount), method: payForm.method, paidOn: payForm.paidOn, note: payForm.note, account: payForm.account })
      if (!r.ok) { toast.error(r.error || 'Could not update payment'); return }
      log(user?.id || 'system', 'PAYMENT', 'Purchases', `Payment updated for ${purchase.number}`)
      toast.success('Payment updated')
    }
    setPayForm(null)
  }

  const removePayment = (pay: PurchasePayment) => {
    if (!window.confirm(`Delete payment ${pay.referenceNo}?`)) return
    const r = deletePurchasePayment(pay.id)
    if (!r.ok) { toast.error(r.error || 'Could not delete payment'); return }
    log(user?.id || 'system', 'DELETE', 'Purchases', `Payment ${pay.referenceNo} deleted`)
    toast.success('Payment deleted', pay.referenceNo)
  }

  const notifyPaymentPaid = (p: Purchase) => {
    const sup = suppliers.find((x) => x.id === p.supplierId)
    log(user?.id || 'system', 'NOTIFY', 'Purchases', `Payment paid notification for ${p.number} sent to ${sup?.name || 'supplier'}`)
    toast.success(`Payment notification sent to ${sup?.name || 'supplier'}`, p.number)
  }

  const printPayments = (p: Purchase) => {
    const sup = suppliers.find((x) => x.id === p.supplierId)
    const branch = branches.find((b) => b.id === p.branchId)
    const rowsHtml = paymentsOf(p.id).map((pp) => `<tr><td>${fmtPayDateTime(pp.paidOn)}</td><td>${escHtml(pp.referenceNo)}</td><td style="text-align:right">${formatGhsExact(pp.amount)}</td><td>${escHtml(PAY_METHOD_LABELS[pp.method] || pp.method)}</td><td>${escHtml(pp.note || '')}</td><td>${escHtml(pp.account || '')}</td></tr>`).join('')
    openPrintWindow(`Payments — ${p.number}`, `
      <h1>Payments — ${escHtml(p.number)}</h1>
      <p class="muted">Supplier: ${escHtml(sup?.name || p.supplierId)} &middot; Business: ${escHtml(company?.name || 'FitPro')}${branch?.city ? ` · ${escHtml(branch.city)}` : ''}</p>
      <p class="muted">Purchase total: ${formatGhsExact(p.total)} &middot; Payment status: ${escHtml(p.status === 'paid' ? 'Paid' : 'Due')}</p>
      <table><thead><tr><th>Date</th><th>Reference No</th><th>Amount</th><th>Method</th><th>Note</th><th>Account</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6">No records found</td></tr>'}</tbody></table>`)
  }

  const submitReturn = () => {
    if (!returnRow) return
    const lines: PurchaseLine[] = returnRow.lines
      .map((l) => ({ itemId: l.itemId, quantity: Math.min(num(returnQty[l.itemId] ?? ''), l.quantity), unitCost: l.unitCost }))
      .filter((l) => l.quantity > 0)
    if (!lines.length) { toast.error('Enter a return quantity for at least one item'); return }
    const total = Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0) * 100) / 100
    const rec: PurchaseReturn = {
      id: uid('pr'),
      companyId: returnRow.companyId,
      branchId: returnRow.branchId,
      number: nextPurchaseReturnNumber(purchaseReturns),
      supplierId: returnRow.supplierId,
      lines,
      total,
      status: 'returned',
      reason: returnReason.trim() || undefined,
      date: today,
      createdAt: new Date().toISOString(),
    }
    upsertPurchaseReturn(rec)
    log(user?.id || 'system', 'CREATE', 'Purchase Return', `Created ${rec.number} from ${returnRow.number} — ${formatGhsExact(total)}`)
    toast.success('Purchase return created', rec.number)
    setReturnRow(null)
  }

  const submitStatus = () => {
    if (!statusRow) return
    updatePurchaseStatus(statusRow.id, statusPick)
    log(user?.id || 'system', 'UPDATE', 'Purchases', `Status of ${statusRow.number} set to ${statusPick}`)
    toast.success('Status updated', statusRow.number)
    setStatusRow(null)
  }

  const HEAD: { id: ColId; label: string; sort?: SortKey; tip?: string }[] = [
    { id: 'action', label: 'Action' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'number', label: 'Reference No', sort: 'number' },
    { id: 'location', label: 'Location', sort: 'location' },
    { id: 'supplier', label: 'Supplier', sort: 'supplier' },
    { id: 'status', label: 'Purchase Status', sort: 'status' },
    { id: 'payment', label: 'Payment Status', sort: 'payment' },
    { id: 'total', label: 'Grand Total', sort: 'total' },
    { id: 'due', label: 'Payment due', tip: 'Outstanding amount for this purchase.' },
    { id: 'addedBy', label: 'Added By', sort: 'addedBy' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  /** Table min-width scales with the visible columns so hiding columns drops the horizontal scrollbar. */
  const tableMinWidth = shownHead.length * 120
  const spanThrough = (ids: ColId[]) => 1 + ids.filter((id) => visibleCols.has(id)).length

  const widgets = [
    { label: 'All purchases', value: String(filtered.length), hint: 'in selected range', color: INDIGO, icon: <ShoppingCart className="size-4" aria-hidden /> },
    { label: 'Grand total', value: formatGhsExact(grandTotal), hint: 'purchased value', color: '#059669', icon: <CircleDollarSign className="size-4" aria-hidden /> },
    { label: 'Payment due', value: formatGhsExact(dueTotal), hint: 'outstanding amount', color: '#b45309', icon: <Info className="size-4" aria-hidden /> },
    { label: 'Purchase returns', value: formatGhsExact(returnTotal), hint: 'returned in range', color: RED, icon: <FileDown className="size-4" aria-hidden /> },
  ]

  return (
    <div>
      {/* Summary widgets */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {widgets.map((stat) => (
          <div key={stat.label} className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: TEXT_MUTED }}>{stat.label}</p>
                <p className="mt-2 truncate text-2xl font-semibold" style={{ color: TEXT }}>{stat.value}</p>
                <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>{stat.hint}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: PANEL_BG, color: stat.color }}>
                {stat.icon}
              </span>
            </div>
          </div>
        ))}
      </div>

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
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Purchase Status:</p>
                <Select value={fPStatus} onChange={(e) => { setFPStatus(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fPStatus === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  <option value="received">Received</option>
                  <option value="ordered">Ordered</option>
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Payment Status:</p>
                <Select value={fPayStatus} onChange={(e) => { setFPayStatus(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fPayStatus === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="due">Due</option>
                </Select>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Date Range:</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    ['Today', 0, 0],
                    ['Last 7 days', 6, 0],
                    ['Last 30 days', 29, 0],
                    ['This month', -1, 0],
                    ['This year', -2, 0],
                  ] as [string, number, number][]).map(([label, back]) => (
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
                    onClick={() => { setFFrom(DEFAULT_FROM); setFTo(DEFAULT_TO); setPage(1) }}
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
                Showing purchases dated {fFrom ? fFrom.split('-').reverse().join('/') : '…'} – {fTo ? fTo.split('-').reverse().join('/') : '…'} · {filtered.length} {filtered.length === 1 ? 'purchase' : 'purchases'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* All Purchases */}
      <section className="mt-4 rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <h2 className="font-display text-xl font-bold" style={{ color: TEXT }}>All Purchases</h2>
          {canManage && (
            <button
              type="button"
              onClick={openNewPurchase}
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
              style={{ background: INDIGO }}
            >
              <Plus className="size-4" aria-hidden /> Add
            </button>
          )}
        </div>

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
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search ..."
              aria-label="Search purchases"
              className="h-[38px] w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
            />
          </span>
        </div>

        <div className="mt-4 overflow-x-auto" style={{ borderColor: PANEL_BD }}>
          <table className="w-full border-collapse text-sm" style={{ minWidth: tableMinWidth }}>
            <thead>
              <tr style={{ background: TABLE_HEAD_BG }}>
                {shownHead.map((h) => (
                  <th key={h.id} className="whitespace-nowrap px-3 py-3 text-left font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                    <span className="inline-flex items-center gap-1">
                      {h.sort ? (
                        <button type="button" onClick={() => toggleSort(h.sort!)} className="inline-flex items-center gap-1 font-semibold" style={{ color: TEXT }}>
                          {h.label} <SortIcon col={h.sort} />
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {h.label}
                          {h.tip && <Info className="size-3.5" style={{ color: TEXT_MUTED }} aria-label={h.tip} />}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((r, index) => {
                const zebra = index % 2 === 1
                return (
                  <tr key={r.id} style={{ background: zebra ? ROW_ALT : CARD_BG, color: TEXT }}>
                    {visibleCols.has('action') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={(e) => toggleActionMenu(e, r.id)}
                            className="btn whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
                            style={{ background: CARD_BG, border: `1px solid ${isDark ? '#38bdf8' : '#7dd3fc'}`, color: isDark ? '#7dd3fc' : '#0369a1' }}
                          >
                            Actions <ChevronDown className="size-3.5" aria-hidden />
                          </button>
                        ) : <span style={{ color: TEXT_MUTED }}>—</span>}
                      </td>
                    )}
                    {visibleCols.has('date') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        {fmtDateTime(r.dateTime)}
                      </td>
                    )}
                    {visibleCols.has('number') && (
                      <td className="px-3 py-3 align-top font-semibold" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{r.number}</td>
                    )}
                    {visibleCols.has('location') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{r.location}</td>
                    )}
                    {visibleCols.has('supplier') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{r.supplier}</td>
                    )}
                    {visibleCols.has('status') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{badge(r.status === 'ordered' ? 'ordered' : 'received', canManage, () => { const full = purchases.find((x) => x.id === r.id); if (full) openStatusModal(full) }, `Update status of ${r.number}`)}</td>
                    )}
                    {visibleCols.has('payment') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{badge(r.paid ? 'paid' : 'due', canManage, () => { const full = purchases.find((x) => x.id === r.id); if (full) setPaymentsRow(full) }, `View payments for ${r.number}`)}</td>
                    )}
                    {visibleCols.has('total') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(r.total)}</td>
                    )}
                    {visibleCols.has('due') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <span className="font-semibold">Purchase:</span> {formatGhsExact(r.due)}
                      </td>
                    )}
                    {visibleCols.has('addedBy') && (
                      <td className="px-3 py-3 align-top" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>{r.addedBy}</td>
                    )}
                  </tr>
                )
              })}

              {filtered.length > 0 && (
                <tr style={{ background: ROW_ALT, color: TEXT }}>
                  <td colSpan={spanThrough(['date', 'number', 'location', 'supplier'])} className="px-3 py-3 text-center text-base font-bold" style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }}>
                    Total:
                  </td>
                  {visibleCols.has('status') && <td style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }} />}
                  {visibleCols.has('payment') && (
                    <td className="px-3 py-3 align-top text-sm font-bold" style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }}>
                      {paidCount > 0 && <span>Paid - {paidCount}</span>}
                      {paidCount > 0 && dueCount > 0 && <br />}
                      {dueCount > 0 && <span>Due - {dueCount}</span>}
                    </td>
                  )}
                  {visibleCols.has('total') && (
                    <td className="whitespace-nowrap px-3 py-3 align-top text-sm font-bold" style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(grandTotal)}</td>
                  )}
                  {visibleCols.has('due') && (
                    <td className="whitespace-nowrap px-3 py-3 align-top text-xs font-semibold" style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }}>
                      Purchase Due - {formatGhsExact(dueTotal)}
                      <br />Purchase Return - {formatGhsExact(returnTotal)}
                    </td>
                  )}
                  {visibleCols.has('addedBy') && <td style={{ borderTop: `2px solid ${PANEL_BD}`, borderBottom: `1px solid ${PANEL_BD}` }} />}
                </tr>
              )}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={shownHead.length} className="px-4 py-12 text-center" style={{ color: TEXT_MUTED, background: CARD_BG }}>
                    <Empty title="No purchases found" desc="Adjust the filters or record your first purchase with the Add button." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm sm:px-5" style={{ color: TEXT_MUTED }}>
          <span>{filtered.length === 0 ? 'No entries' : `Showing ${startIdx} to ${endIdx} of ${filtered.length} entries`}</span>
          <div className="flex items-center">
            <button type="button" onClick={() => setPage((c) => Math.max(1, c - 1))} disabled={page === 1} className="rounded-l-lg border px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className="-ml-px border px-3 py-1.5 font-semibold"
                style={n === page ? { background: INDIGO, borderColor: INDIGO, color: '#ffffff' } : { background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}
              >
                {n}
              </button>
            ))}
            <button type="button" onClick={() => setPage((c) => Math.min(totalPages, c + 1))} disabled={page === totalPages} className="-ml-px rounded-r-lg border px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>
              Next <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      {/* Row actions menu (portal so the scroll wrapper cannot clip it) */}
      {actionRow && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[10050] w-[240px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-lg border py-2 shadow-2xl"
          style={{ top: actionMenuPosition.top, left: actionMenuPosition.left, background: CARD_BG, borderColor: PANEL_BD, color: TEXT }}
          onClick={(e) => e.stopPropagation()}
        >
          {([
            [
              { label: 'View', Icon: Eye, run: () => setViewRow(actionRow) },
              { label: 'Print', Icon: Printer, run: () => printPurchase(actionRow) },
              { label: 'Edit', Icon: Pencil, run: () => openEditPurchase(actionRow) },
              { label: 'Delete', Icon: Trash2, run: () => { if (window.confirm(`Delete purchase ${actionRow.number}?`)) { deletePurchase(actionRow.id); toast.success('Purchase deleted') } } },
              { label: 'Labels', Icon: Barcode, run: () => printLabels(actionRow) },
            ],
            [
              ...(actionRow.status !== 'paid' ? [{ label: 'Add payment', Icon: Banknote, run: () => openPayModal(actionRow) }] : []),
              { label: 'View Payments', Icon: CircleDollarSign, run: () => setPaymentsRow(actionRow) },
            ],
            [
              ...(actionRow.status === 'received' ? [{ label: 'Purchase Return', Icon: Undo2, run: () => openReturnModal(actionRow) }] : []),
              { label: 'Update Status', Icon: SquarePen, run: () => openStatusModal(actionRow) },
              ...(actionRow.status === 'ordered' ? [{ label: 'Items Received Notification', Icon: Mail, run: () => notifyItemsReceived(actionRow) }] : []),
            ],
          ] as { label: string; Icon: typeof Eye; run: () => void }[][]).map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-2 border-t pt-2' : ''} style={gi > 0 ? { borderColor: PANEL_BD } : undefined}>
              {group.map(({ label, Icon, run }) => (
                <button
                  key={label}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm transition hover:bg-sky-50 dark:hover:bg-sky-950"
                  style={{ color: TEXT_MUTED }}
                  onClick={() => { setOpenActions(null); run() }}
                >
                  <Icon className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}

      {/* Add / edit purchase */}
      <Modal open={purchaseModal} onClose={() => setPurchaseModal(false)} title={ed.id ? `Edit Purchase ${ed.referenceNo || ''}`.trim() : 'Add Purchase'} xl>
        <div className="space-y-4">
          {/* Purchase details */}
          <section className="rounded-lg border p-4" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Supplier<span style={{ color: RED }}>*</span></p>
                <div className="flex items-center gap-1.5">
                  <Select value={ed.supplierId} onChange={(e) => setEdField('supplierId', e.target.value)} className="min-w-0 flex-1">
                    <option value="">Please Select</option>
                    {suppliers.map((sup) => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </Select>
                  <button
                    type="button"
                    onClick={() => setQuickSupplierOpen((v) => !v)}
                    title="Add new supplier"
                    aria-label="Add new supplier"
                    className="grid size-8 shrink-0 place-items-center rounded-full text-white"
                    style={{ background: INDIGO }}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                {quickSupplierOpen && (
                  <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: INPUT_BD, background: INPUT_BG }}>
                    <input value={quickSupplierName} onChange={(e) => setQuickSupplierName(e.target.value)} placeholder="Supplier name" aria-label="New supplier name" className="mb-1.5 h-8 w-full rounded-md px-2 text-sm focus:outline-none" style={{ border: `1px solid ${INPUT_BD}`, background: CARD_BG, color: TEXT }} />
                    <input value={quickSupplierPhone} onChange={(e) => setQuickSupplierPhone(e.target.value)} placeholder="Phone (optional)" aria-label="New supplier phone" className="mb-1.5 h-8 w-full rounded-md px-2 text-sm focus:outline-none" style={{ border: `1px solid ${INPUT_BD}`, background: CARD_BG, color: TEXT }} />
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setQuickSupplierOpen(false)} className="rounded-md px-2 py-1 text-xs font-semibold" style={{ color: TEXT_MUTED }}>Cancel</button>
                      <button type="button" onClick={quickAddSupplier} className="rounded-md px-2.5 py-1 text-xs font-bold text-white" style={{ background: INDIGO }}>Add</button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 flex items-center gap-1 text-xs font-bold" style={{ color: TEXT }}>
                  Reference No:
                  <Info className="size-3.5" style={{ color: TEXT_MUTED }} aria-label="Leave empty to auto-generate the reference number." />
                </p>
                <input
                  value={ed.referenceNo}
                  onChange={(e) => setEdField('referenceNo', e.target.value)}
                  placeholder={ed.id ? undefined : 'Auto-generated'}
                  aria-label="Reference number"
                  className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Purchase Date<span style={{ color: RED }}>*</span></p>
                <input
                  type="date"
                  value={ed.date}
                  onChange={(e) => setEdField('date', e.target.value)}
                  aria-label="Purchase date"
                  className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT, colorScheme: isDark ? 'dark' : 'light' }}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Purchase Status<span style={{ color: RED }}>*</span></p>
                <Select value={ed.status} onChange={(e) => setEdField('status', e.target.value as PurchaseStatus)}>
                  <option value="received">Received</option>
                  <option value="ordered">Ordered</option>
                  <option value="paid">Paid</option>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Business Location<span style={{ color: RED }}>*</span></p>
                <Select value={ed.branchId} onChange={(e) => setEdField('branchId', e.target.value)}>
                  <option value="">Please Select</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Address:</p>
                <p className="min-h-9 rounded-lg px-3 py-2 text-sm" style={{ background: PANEL_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }}>
                  {(() => { const sup = suppliers.find((x) => x.id === ed.supplierId); if (!sup) return 'Select a supplier'; return [sup.contact, sup.phone].filter(Boolean).join(' · ') || sup.name })()}
                </p>
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="rounded-lg border p-4" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
                <input
                  value={poSearch}
                  onChange={(e) => { setPoSearch(e.target.value); setPoSearchOpen(true) }}
                  onFocus={() => setPoSearchOpen(true)}
                  placeholder="Enter Product name / SKU / Scan bar code"
                  aria-label="Search products to add"
                  className="h-9 w-full rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                />
                {poSearchOpen && searchMatches.length > 0 && (
                  <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-lg border shadow-xl" style={{ background: CARD_BG, borderColor: INPUT_BD }}>
                    {searchMatches.map((it) => (
                      <button key={it.id} type="button" onClick={() => addSearchLine(it.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5" style={{ color: TEXT }}>
                        <span className="truncate">{it.name}</span>
                        <span className="shrink-0 text-xs" style={{ color: TEXT_MUTED }}>SKU {it.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </span>
              <button type="button" onClick={() => navigate('/admin/inventory')} className="text-xs font-bold hover:underline" style={{ color: INDIGO }}>+ Add new product</button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg" style={{ border: `1px solid ${PANEL_BD}` }}>
              <table className="w-full min-w-[1050px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: '#4caf50' }}>
                    {['#', 'Product Name', 'Purchase Quantity', 'Unit Cost (Before Discount)', 'Discount Percent', 'Unit Cost (Before Tax)', 'Line Total', 'Profit Margin %', 'Unit Selling Price (exc. tax)', ''].map((h) => (
                      <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-xs font-bold text-white">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ed.lines.map((l, i) => (
                    <tr key={i} style={{ background: i % 2 ? ROW_ALT : CARD_BG }}>
                      <td className="px-2.5 py-2 text-center" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{i + 1}</td>
                      <td className="min-w-[180px] px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <Select
                          value={l.itemId}
                          onChange={(e) => {
                            const item = inventory.find((it) => it.id === e.target.value)
                            setLine(i, { itemId: e.target.value, unitCost: l.unitCost || String(item?.costPrice || ''), sellPrice: l.sellPrice || String(item?.sellPrice || '') })
                          }}
                        >
                          <option value="">Please Select</option>
                          {inventory.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                        </Select>
                      </td>
                      <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} aria-label="Purchase quantity" className="h-8 w-20 rounded-md px-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                      </td>
                      <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} aria-label="Unit cost before discount" className="h-8 w-24 rounded-md px-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                      </td>
                      <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input type="number" min={0} max={100} value={l.discountPercent} onChange={(e) => setLine(i, { discountPercent: e.target.value })} aria-label="Discount percent" placeholder="0" className="h-8 w-20 rounded-md px-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{l.itemId ? formatGhsExact(lineCostBefore(l)) : '—'}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{l.itemId ? formatGhsExact(lineTotal(l)) : '—'}</td>
                      <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input
                          type="number" min={0} step="0.1"
                          value={l.itemId ? marginOf(l) : ''}
                          onChange={(e) => { const m = num(e.target.value); const cost = lineCostBefore(l); setLine(i, { sellPrice: cost > 0 ? String(Math.round(cost * (1 + m / 100) * 100) / 100) : l.sellPrice }) }}
                          aria-label="Profit margin percent"
                          className="h-8 w-20 rounded-md px-2 text-sm focus:outline-none"
                          style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }}
                        />
                      </td>
                      <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <input type="number" min={0} step="0.01" value={l.sellPrice} onChange={(e) => setLine(i, { sellPrice: e.target.value })} aria-label="Unit selling price" className="h-8 w-24 rounded-md px-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                      </td>
                      <td className="px-2 py-2 text-center" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button type="button" title="Remove line" aria-label={`Remove line ${i + 1}`} onClick={() => setEd((cur) => ({ ...cur, lines: cur.lines.length > 1 ? cur.lines.filter((_, j) => j !== i) : cur.lines }))} className="grid size-7 place-items-center rounded-md hover:bg-rose-500/10" style={{ color: RED }}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex justify-end gap-8 text-sm" style={{ color: TEXT }}>
              <span>Total items: <span className="font-bold">{totalItems.toFixed(2)}</span></span>
              <span>Net Total Amount: <span className="font-bold">{formatGhsExact(netTotal)}</span></span>
            </div>
          </section>

          {/* Discount / tax / notes */}
          <section className="rounded-lg border p-4" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Discount Type:</p>
                <Select value={ed.discountType} onChange={(e) => setEdField('discountType', e.target.value as EdState['discountType'])}>
                  <option value="none">None</option>
                  <option value="fixed">Fixed</option>
                  <option value="percent">Percent</option>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Discount Amount:</p>
                <input type="number" min={0} value={ed.discountAmount} onChange={(e) => setEdField('discountAmount', e.target.value)} aria-label="Discount amount" className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
              </div>
              <div className="flex items-end justify-start md:justify-end">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Discount: <span style={{ color: RED }}>(-) {formatGhsExact(discountValue)}</span></p>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Purchase Tax:</p>
                <Select value="none" onChange={() => undefined} disabled>
                  <option value="none">None</option>
                </Select>
              </div>
              <div className="flex items-end justify-start md:col-span-2 md:justify-end">
                <p className="text-sm font-bold" style={{ color: TEXT }}>Purchase Tax: <span style={{ color: '#059669' }}>(+) {formatGhsExact(0)}</span></p>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Additional Notes</p>
              <textarea value={ed.notes} onChange={(e) => setEdField('notes', e.target.value)} rows={2} aria-label="Additional notes" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
            </div>
          </section>

          {/* Shipping */}
          <section className="rounded-lg border p-4" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Shipping Details:</p>
                <input value={ed.shippingDetails} onChange={(e) => setEdField('shippingDetails', e.target.value)} aria-label="Shipping details" placeholder="Carrier, tracking…" className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>(+) Additional Shipping charges:</p>
                <input type="number" min={0} step="0.01" value={ed.shippingCharges} onChange={(e) => setEdField('shippingCharges', e.target.value)} aria-label="Additional shipping charges" className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <p className="text-sm font-bold" style={{ color: TEXT }}>Purchase Total: <span style={{ color: INDIGO }}>{formatGhsExact(purchaseTotal)}</span></p>
            </div>
          </section>

          {/* Add payment */}
          <section className="rounded-lg border p-4" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
            <p className="mb-3 text-sm font-bold" style={{ color: TEXT }}>
              Add payment
              {ed.status !== 'paid' && <span className="ml-2 text-xs font-normal" style={{ color: TEXT_MUTED }}>(enabled when Purchase Status is Paid)</span>}
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Amount<span style={{ color: RED }}>*</span></p>
                <input value={ed.status === 'paid' ? purchaseTotal.toFixed(2) : '0.00'} readOnly aria-label="Payment amount" className="h-9 w-full rounded-lg px-3 text-sm" style={{ background: PANEL_BG, border: `1px solid ${INPUT_BD}`, color: TEXT_MUTED }} />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Paid on<span style={{ color: RED }}>*</span></p>
                <input
                  type="date"
                  value={ed.paidOn}
                  onChange={(e) => setEdField('paidOn', e.target.value)}
                  disabled={ed.status !== 'paid'}
                  aria-label="Paid on date"
                  className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none disabled:opacity-60"
                  style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT, colorScheme: isDark ? 'dark' : 'light' }}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Payment Method<span style={{ color: RED }}>*</span></p>
                <Select value={ed.payMethod} onChange={(e) => setEdField('payMethod', e.target.value as PaymentMethod)} disabled={ed.status !== 'paid'}>
                  <option value="cash">Cash</option>
                  <option value="momo">Mobile Money</option>
                  <option value="card">Card</option>
                  <option value="bank">Bank transfer</option>
                </Select>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Payment note:</p>
              <textarea value={ed.payNote} onChange={(e) => setEdField('payNote', e.target.value)} rows={2} disabled={ed.status !== 'paid'} aria-label="Payment note" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none disabled:opacity-60" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
            </div>
            <div className="mt-2 flex justify-end">
              <p className="text-sm font-bold" style={{ color: TEXT }}>Payment due: {formatGhsExact(ed.status === 'paid' ? 0 : purchaseTotal)}</p>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
            <button type="button" onClick={() => setPurchaseModal(false)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Cancel</button>
            <button type="button" onClick={submitPurchase} className="btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
              <ShoppingCart className="size-4" aria-hidden /> {ed.id ? 'Update purchase' : 'Save purchase'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View purchase */}
      <Modal open={!!viewRow} onClose={() => setViewRow(null)} title={viewRow ? `Purchase ${viewRow.number}` : ''} xl>
        {viewRow && (() => {
          const p = viewRow
          const sup = suppliers.find((x) => x.id === p.supplierId)
          const lineNet = p.lines.reduce((sum, l) => sum + l.quantity * l.unitCost * (1 - Math.min(Math.max(l.discountPercent || 0, 0), 100) / 100), 0)
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {badge(p.status === 'ordered' ? 'ordered' : 'received')}
                {badge(p.status === 'paid' ? 'paid' : 'due')}
                {p.referenceNo && <span className="text-xs font-semibold" style={{ color: TEXT_MUTED }}>Ref: {p.referenceNo}</span>}
              </div>
              <div className="grid gap-x-6 gap-y-2 rounded-lg border p-4 text-sm md:grid-cols-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Supplier</p><p style={{ color: TEXT }}>{sup?.name || p.supplierId}</p></div>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Business Location</p><p style={{ color: TEXT }}>{branchName(p.branchId)}</p></div>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Purchase Date</p><p style={{ color: TEXT }}>{p.date}</p></div>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Added By</p><p style={{ color: TEXT }}>{userName(p.userId)}</p></div>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Payment Method</p><p style={{ color: TEXT }}>{p.paymentMethod ? PAY_METHOD_LABELS[p.paymentMethod] || p.paymentMethod : '—'}</p></div>
                <div><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Paid On</p><p style={{ color: TEXT }}>{p.paidOn || '—'}</p></div>
                {p.shippingDetails && <div className="md:col-span-3"><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Shipping Details</p><p style={{ color: TEXT }}>{p.shippingDetails}</p></div>}
                {p.notes && <div className="md:col-span-3"><p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Notes</p><p style={{ color: TEXT }}>{p.notes}</p></div>}
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${PANEL_BD}` }}>
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr style={{ background: PANEL_BG }}>
                      {['#', 'Product Name', 'Purchase Quantity', 'Unit Cost', 'Discount Percent', 'Line Total'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-xs font-bold" style={{ color: TEXT }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.lines.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 ? ROW_ALT : CARD_BG }}>
                        <td className="px-2.5 py-2 text-center" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{i + 1}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{itemName(l.itemId)}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{l.quantity}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(l.unitCost)}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{l.discountPercent ? `${l.discountPercent}%` : '—'}</td>
                        <td className="px-2.5 py-2 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(l.quantity * l.unitCost * (1 - (l.discountPercent || 0) / 100))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span style={{ color: TEXT_MUTED }}>Net Total:</span><span style={{ color: TEXT }}>{formatGhsExact(lineNet)}</span></div>
                {!!p.discount && <div className="flex justify-between"><span style={{ color: TEXT_MUTED }}>Discount:</span><span style={{ color: RED }}>(-) {formatGhsExact(p.discount)}</span></div>}
                {!!p.shippingCharges && <div className="flex justify-between"><span style={{ color: TEXT_MUTED }}>Shipping:</span><span style={{ color: TEXT }}>(+) {formatGhsExact(p.shippingCharges)}</span></div>}
                <div className="flex justify-between text-base font-bold"><span style={{ color: TEXT }}>Purchase Total:</span><span style={{ color: INDIGO }}>{formatGhsExact(p.total)}</span></div>
                <div className="flex justify-between"><span style={{ color: TEXT_MUTED }}>Payment due:</span><span style={{ color: TEXT }}>{formatGhsExact(p.status === 'paid' ? 0 : p.total)}</span></div>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
                <button type="button" onClick={() => setViewRow(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Close</button>
                <button type="button" onClick={() => printPurchase(p)} className="btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
                  <Printer className="size-4" aria-hidden /> Print
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* View payment */}
      <Modal open={!!viewPayment} onClose={() => setViewPayment(null)} title="View payment" zIndex={80}>
        {viewPayment && (() => {
          const purchase = purchases.find((x) => x.id === viewPayment.purchaseId)
          const sup = suppliers.find((x) => x.id === purchase?.supplierId)
          return (
            <div className="space-y-3">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Supplier:</p>
                  <p className="font-semibold" style={{ color: TEXT }}>{sup?.name || purchase?.supplierId || '—'}</p>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>Business: {branchName(purchase?.branchId)}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Reference No:</p>
                  <p className="font-semibold" style={{ color: TEXT }}>{purchase?.number || '—'}</p>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>Payment ref: {viewPayment.referenceNo}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Amount: <span style={{ color: TEXT }}>{formatGhsExact(viewPayment.amount)}</span></p>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Payment Account: <span style={{ color: TEXT }}>{viewPayment.account || 'None'}</span></p>
                </div>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Payment Method:</p>
                  <p style={{ color: TEXT }}>{PAY_METHOD_LABELS[viewPayment.method] || viewPayment.method}</p>
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Paid on:</p>
                  <p style={{ color: TEXT }}>{fmtPayDateTime(viewPayment.paidOn)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Payment Note:</p>
                <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: INPUT_BD, background: INPUT_BG, color: viewPayment.note ? TEXT : TEXT_MUTED }}>{viewPayment.note || '--'}</p>
              </div>
              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
                <button type="button" onClick={() => setViewPayment(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Close</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Add / edit payment */}
      <Modal open={!!payForm} onClose={() => setPayForm(null)} title={payForm?.mode === 'edit' ? 'Edit payment' : 'Add payment'} zIndex={80}>
        {payForm && (() => {
          const purchase = purchases.find((x) => x.id === payForm.purchaseId)
          if (!purchase) return null
          const sup = suppliers.find((x) => x.id === purchase.supplierId)
          return (
            <div className="space-y-3">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Supplier:</p>
                  <p className="font-semibold" style={{ color: TEXT }}>{sup?.name || purchase.supplierId}</p>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>Business: {branchName(purchase.branchId)}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Reference No:</p>
                  <p className="font-semibold" style={{ color: TEXT }}>{purchase.number}</p>
                  <p className="text-xs" style={{ color: TEXT_MUTED }}>Location: {branchName(purchase.branchId)}</p>
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: PANEL_BD, background: PANEL_BG }}>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Total amount: <span style={{ color: TEXT }}>{formatGhsExact(purchase.total)}</span></p>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Payment Note: <span style={{ color: TEXT }}>{purchase.notes ? (purchase.notes.length > 26 ? `${purchase.notes.slice(0, 26)}…` : purchase.notes.split('\n')[0]) : '--'}</span></p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Payment Method<span style={{ color: RED }}>*</span></p>
                  <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PaymentMethod })}>
                    <option value="cash">Cash</option>
                    <option value="momo">Mobile Money</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank transfer</option>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Paid on<span style={{ color: RED }}>*</span></p>
                  <input type="datetime-local" value={payForm.paidOn} onChange={(e) => setPayForm({ ...payForm, paidOn: e.target.value })} aria-label="Paid on date and time" className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT, colorScheme: isDark ? 'dark' : 'light' }} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Amount<span style={{ color: RED }}>*</span></p>
                  <input type="number" min={0} step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} aria-label="Payment amount" className="h-9 w-full rounded-lg px-3 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Payment Account:</p>
                  <Select value={payForm.account} onChange={(e) => setPayForm({ ...payForm, account: e.target.value })}>
                    <option value="">None</option>
                    <option value="Cash on hand">Cash on hand</option>
                    <option value="Mobile money wallet">Mobile money wallet</option>
                    <option value="Bank account">Bank account</option>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Attach Document:</p>
                  <input type="file" aria-label="Attach document" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" className="w-full text-xs" style={{ color: TEXT_MUTED }} />
                  {payForm.mode === 'edit' && <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>Previously uploaded file will be replaced</p>}
                  <p className="mt-1 text-xs" style={{ color: TEXT_MUTED }}>Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Payment Note:</p>
                <textarea value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} rows={2} aria-label="Payment note" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
                <button type="button" onClick={() => setPayForm(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Close</button>
                <button type="button" onClick={submitPayment} className="btn rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
                  {payForm.mode === 'edit' ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* View payments */}
      <Modal open={!!paymentsRow} onClose={() => setPaymentsRow(null)} title={paymentsRow ? `View Payments ( Reference No: ${paymentsRow.number} )` : ''} xl>
        {paymentsRow && (() => {
          // Derive the live record so header status/pills follow payments made while open.
          const p = purchases.find((x) => x.id === paymentsRow.id) || paymentsRow
          const sup = suppliers.find((x) => x.id === p.supplierId)
          const branch = branches.find((b) => b.id === p.branchId)
          const pays = paymentsOf(p.id)
          return (
            <div className="space-y-3">
              <div className="grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Supplier:</p>
                  <p className="font-bold" style={{ color: TEXT }}>{sup?.name || p.supplierId}</p>
                  {sup?.contact && <p style={{ color: TEXT_MUTED }}>{sup.contact}</p>}
                  {sup?.phone && <p style={{ color: TEXT_MUTED }}>Mobile: {sup.phone}</p>}
                </div>
                <div>
                  <p className="text-xs font-bold" style={{ color: TEXT_MUTED }}>Business:</p>
                  <p className="font-bold" style={{ color: TEXT }}>{company?.name || 'FitPro'}</p>
                  <p style={{ color: TEXT_MUTED }}>{[branch?.address, branch?.city].filter(Boolean).join(', ') || company?.address}</p>
                  {company?.taxId && <p style={{ color: TEXT_MUTED }}>VAT: {company.taxId}</p>}
                  <p style={{ color: TEXT_MUTED }}>Mobile: {branch?.phone || company?.phone}</p>
                </div>
                <div className="text-sm">
                  <p style={{ color: TEXT }}><span className="font-bold">Reference No:</span> #{p.number}</p>
                  <p style={{ color: TEXT }}><span className="font-bold">Date:</span> {p.date}</p>
                  <p style={{ color: TEXT }}><span className="font-bold">Purchase Status:</span> {p.status === 'ordered' ? 'Ordered' : 'Received'}</p>
                  <p style={{ color: TEXT }}><span className="font-bold">Payment Status:</span> {p.status === 'paid' ? 'Paid' : 'Due'}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {p.status === 'paid' && (
                  <button type="button" onClick={() => notifyPaymentPaid(p)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ background: '#0ea5e9' }}>
                    <Mail className="size-3.5" aria-hidden /> Payment Paid Notification
                  </button>
                )}
                {p.status !== 'paid' && (
                  <button type="button" onClick={() => openPayModal(p)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold" style={{ borderColor: INDIGO, color: INDIGO }}>
                    <Plus className="size-3.5" aria-hidden /> Add payment
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${PANEL_BD}` }}>
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead>
                    <tr style={{ background: PANEL_BG }}>
                      {['Date', 'Reference No', 'Amount', 'Payment Method', 'Payment Note', 'Payment Account', 'Actions'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-xs font-bold" style={{ color: TEXT }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pays.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-6 text-center" style={{ color: TEXT_MUTED }}>No records found</td></tr>
                    ) : pays.map((pp, i) => (
                      <tr key={pp.id} style={{ background: i % 2 ? ROW_ALT : CARD_BG }}>
                        <td className="whitespace-nowrap px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{fmtPayDateTime(pp.paidOn)}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{pp.referenceNo}</td>
                        <td className="whitespace-nowrap px-2.5 py-2 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(pp.amount)}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{PAY_METHOD_LABELS[pp.method] || pp.method}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{pp.note || ''}</td>
                        <td className="px-2.5 py-2" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{pp.account || ''}</td>
                        <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                          <div className="flex items-center gap-1.5">
                            <button type="button" title="Edit payment" aria-label={`Edit payment ${pp.referenceNo}`} onClick={() => openEditPayment(pp, p)} className="grid size-7 place-items-center rounded-md border transition hover:bg-sky-500/10" style={{ color: '#0ea5e9', borderColor: 'rgba(14, 165, 233, 0.5)' }}>
                              <SquarePen className="size-4" aria-hidden />
                            </button>
                            <button type="button" title="Delete payment" aria-label={`Delete payment ${pp.referenceNo}`} onClick={() => removePayment(pp)} className="grid size-7 place-items-center rounded-md border transition hover:bg-rose-500/10" style={{ color: '#f43f5e', borderColor: 'rgba(244, 63, 94, 0.5)' }}>
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                            <button type="button" title="View payment" aria-label={`View payment ${pp.referenceNo}`} onClick={() => setViewPayment(pp)} className="grid size-7 place-items-center rounded-md border transition hover:bg-indigo-500/10" style={{ color: INDIGO, borderColor: 'rgba(79, 70, 229, 0.5)' }}>
                              <Eye className="size-4" aria-hidden />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pays.length > 0 && (
                <p className="text-right text-sm font-bold" style={{ color: TEXT }}>Payment due: {formatGhsExact(p.status === 'paid' ? 0 : p.total)}</p>
              )}
              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
                <button type="button" onClick={() => printPayments(p)} className="btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
                  <Printer className="size-4" aria-hidden /> Print
                </button>
                <button type="button" onClick={() => setPaymentsRow(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Close</button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Purchase return */}
      <Modal open={!!returnRow} onClose={() => setReturnRow(null)} title={returnRow ? `Purchase Return — ${returnRow.number}` : ''} xl>
        {returnRow && (() => {
          const returnTotal = returnRow.lines.reduce((sum, l) => { const q = Math.min(num(returnQty[l.itemId] ?? ''), l.quantity); return sum + (q > 0 ? q * l.unitCost : 0) }, 0)
          return (
            <div className="space-y-3">
              <p className="text-sm" style={{ color: TEXT_MUTED }}>Return items received in {returnRow.number}. Return quantity cannot exceed the purchased quantity.</p>
              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${PANEL_BD}` }}>
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr style={{ background: PANEL_BG }}>
                      {['#', 'Product Name', 'Purchased Qty', 'Return Qty', 'Unit Cost', 'Line Total'].map((h) => (
                        <th key={h} className="whitespace-nowrap px-2.5 py-2 text-left text-xs font-bold" style={{ color: TEXT }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returnRow.lines.map((l, i) => {
                      const q = Math.min(num(returnQty[l.itemId] ?? ''), l.quantity)
                      return (
                        <tr key={i} style={{ background: i % 2 ? ROW_ALT : CARD_BG }}>
                          <td className="px-2.5 py-2 text-center" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{i + 1}</td>
                          <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{itemName(l.itemId)}</td>
                          <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{l.quantity}</td>
                          <td className="px-2.5 py-2" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                            <input type="number" min={0} max={l.quantity} value={returnQty[l.itemId] ?? ''} onChange={(e) => setReturnQty((cur) => ({ ...cur, [l.itemId]: e.target.value }))} aria-label={`Return quantity ${itemName(l.itemId)}`} className="h-8 w-20 rounded-md px-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
                          </td>
                          <td className="px-2.5 py-2" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(l.unitCost)}</td>
                          <td className="px-2.5 py-2 font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(q > 0 ? q * l.unitCost : 0)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end text-sm font-bold" style={{ color: TEXT }}>Return total: <span className="ml-1" style={{ color: INDIGO }}>{formatGhsExact(returnTotal)}</span></div>
              <div>
                <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Reason</p>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2} aria-label="Return reason" placeholder="Damaged, expired, wrong item…" className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: TEXT }} />
              </div>
              <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
                <button type="button" onClick={() => setReturnRow(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Cancel</button>
                <button type="button" onClick={submitReturn} className="btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
                  <Undo2 className="size-4" aria-hidden /> Create return
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Update status */}
      <Modal open={!!statusRow} onClose={() => setStatusRow(null)} title={statusRow ? `Update Status — ${statusRow.number}` : ''}>
        {statusRow && (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-bold" style={{ color: TEXT }}>Purchase Status<span style={{ color: RED }}>*</span></p>
              <Select value={statusPick} onChange={(e) => setStatusPick(e.target.value as PurchaseStatus)}>
                <option value="received">Received</option>
                <option value="ordered">Ordered</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            {statusPick === 'paid' && <p className="text-xs" style={{ color: TEXT_MUTED }}>Tip: use Add payment to also record the payment method and date.</p>}
            <div className="flex justify-end gap-2 border-t pt-3" style={{ borderColor: PANEL_BD }}>
              <button type="button" onClick={() => setStatusRow(null)} className="btn rounded-lg border px-4 py-2 text-sm font-semibold" style={{ background: CARD_BG, borderColor: INPUT_BD, color: TEXT_MUTED }}>Cancel</button>
              <button type="button" onClick={submitStatus} className="btn inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: INDIGO }}>
                <SquarePen className="size-4" aria-hidden /> Update status
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
