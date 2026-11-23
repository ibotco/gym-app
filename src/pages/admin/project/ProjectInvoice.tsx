import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Pencil, Trash2, Printer, Check, Send, Banknote, X,
  Download, FileSpreadsheet, Columns3, ChevronDown, Filter, ChevronLeft, ChevronRight, Search as SearchIcon,
} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, Badge } from '../../../components/ui'
import { TaxMultiSelect, sumTaxRates } from '../../../components/TaxMultiSelect'
import { exportExcel } from '../../../lib/export'
import { activeDiscounts, computeDiscount, discountBlockReason, discountLabel } from '../../../lib/discounts'
import { branchSettingsFor, DEFAULT_BRANCH_TAXES } from '../../../lib/branchSettings'
import { useDismissOnOutside } from '../../../lib/useDismissOnOutside'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import {
  PROJECT_INVOICE_STATUSES, nextProjectInvoiceNumber, projectInvoiceTotals, projectInvoiceLineTotal,
  projectInvoiceBalance, isProjectInvoiceOverdue, projectInvoiceLabel,
  projectInvoiceEditable, projectInvoiceDeletable,
} from '../../../lib/projectInvoices'
import type { ProjectInvoice as ProjectInvoiceType, ProjectInvoiceStatus } from '../../../types'

const year = new Date().getFullYear()
const DEFAULT_FROM = `${year}-01-01`
const DEFAULT_TO = `${year}-12-31`

type SortKey = 'number' | 'project' | 'client' | 'date' | 'due' | 'total' | 'status'
type ColId = SortKey | 'action'

/** Status pill with the same tone language as the procurement documents. */
function InvStatus({ status }: { status: string }) {
  const tone = status === 'paid' ? 'lime' : status === 'sent' ? 'amber' : status === 'cancelled' ? 'rose' : 'zinc'
  return <Badge tone={tone}>{projectInvoiceLabel(status)}</Badge>
}

type LineDraft = { id: string; itemId?: string; description: string; qty: string; rate: string; discount: string; tax: string }

type EditorDraft = {
  id?: string
  number: string
  projectId: string
  clientName: string
  invoiceDate: string
  dueDate: string
  taxRate: string
  discountId: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  taxName: string
  notes: string
  lines: LineDraft[]
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function ProjectInvoice() {
  const { projectInvoices, projects, branches, company, inventory, branchSettings, activeBranchId, upsertProjectInvoice, deleteProjectInvoice, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<ProjectInvoiceType | null>(null)
  const [editing, setEditing] = useState<EditorDraft | null>(null)
  // Discount & tax panel — collapsible like the purchase invoice form. Auto-expands
  // when the invoice being edited already carries a discount or tax.
  const [discountTaxOpen, setDiscountTaxOpen] = useState(false)

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id

  // Theme tokens — mirror the Purchase Invoices list so both pages match in either theme.
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
    ['action', 'number', 'project', 'client', 'date', 'due', 'total', 'status'],
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

  // ---- Filters (same panel as the Purchase Invoices filters) ----
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fLoc, setFLoc] = useState('all')
  const [fProject, setFProject] = useState('all')
  const [fClient, setFClient] = useState('all')
  const [fFrom, setFFrom] = useState(DEFAULT_FROM)
  const [fTo, setFTo] = useState(DEFAULT_TO)

  /** Distinct clients across the invoice list, for the client filter. */
  const clientNames = useMemo(
    () => Array.from(new Set(projectInvoices.map((i) => i.clientName).filter(Boolean))).sort(),
    [projectInvoices],
  )

  /** Filtered + sorted set. Every export and the print view use exactly this. */
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let list = [...projectInvoices]
      .filter((i) => (statusFilter === 'all' ? true : i.status === statusFilter))
      .filter((i) => !ql
        || i.number.toLowerCase().includes(ql)
        || i.projectName.toLowerCase().includes(ql)
        || i.clientName.toLowerCase().includes(ql))
    if (fLoc !== 'all') list = list.filter((i) => i.branchId === fLoc)
    if (fProject !== 'all') list = list.filter((i) => i.projectId === fProject)
    if (fClient !== 'all') list = list.filter((i) => i.clientName === fClient)
    if (fFrom) list = list.filter((i) => i.invoiceDate >= fFrom)
    if (fTo) list = list.filter((i) => i.invoiceDate <= fTo)

    const dir = sortDir === 'asc' ? 1 : -1
    const val = (i: ProjectInvoiceType): string | number => {
      switch (sortKey) {
        case 'number': return i.number.toLowerCase()
        case 'project': return i.projectName.toLowerCase()
        case 'client': return i.clientName.toLowerCase()
        case 'due': return i.dueDate || ''
        case 'total': return i.total
        case 'status': return projectInvoiceLabel(i.status).toLowerCase()
        default: return i.invoiceDate
      }
    }
    return list.sort((a, b) => {
      const x = val(a); const y = val(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir
      return String(x).localeCompare(String(y)) * dir
    })
  }, [projectInvoices, q, statusFilter, sortKey, sortDir, fLoc, fProject, fClient, fFrom, fTo])

  // Reset to the first page whenever the result set changes shape.
  useEffect(() => { setPage(1) }, [q, statusFilter, showEntries, fLoc, fProject, fClient, fFrom, fTo])
  const totalPages = Math.max(1, Math.ceil(rows.length / showEntries))
  const safePage = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => rows.slice((safePage - 1) * showEntries, safePage * showEntries),
    [rows, safePage, showEntries],
  )

  // ---- KPI status cards ----
  const kpis = useMemo(() => {
    const active = projectInvoices.filter((i) => i.status !== 'cancelled')
    const sent = projectInvoices.filter((i) => i.status === 'sent')
    const overdue = sent.filter((i) => isProjectInvoiceOverdue(i))
    const paid = projectInvoices.filter((i) => i.status === 'paid')
    return [
      { label: 'Total invoices', value: String(active.length), sub: 'excl. cancelled', accent: TEXT },
      { label: 'Outstanding', value: formatGhsExact(sent.reduce((s, i) => s + i.total, 0)), sub: `${sent.length} sent`, accent: '#f5a623' },
      { label: 'Overdue', value: formatGhsExact(overdue.reduce((s, i) => s + i.total, 0)), sub: `${overdue.length} past due`, accent: '#dc2626' },
      { label: 'Collected', value: formatGhsExact(paid.reduce((s, i) => s + i.total, 0)), sub: `${paid.length} paid`, accent: '#22c55e' },
    ]
  }, [projectInvoices, TEXT])

  // ---- Toolbar actions (identical behaviour to Purchase Invoices) ----
  const [busy, setBusy] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const [done, setDone] = useState<'' | 'csv' | 'excel' | 'print' | 'pdf'>('')
  const flashDone = (key: 'csv' | 'excel' | 'print' | 'pdf') => { setDone(key); window.setTimeout(() => setDone(''), 1600) }

  /** Every filtered record — exports ignore pagination. */
  const exportRows = (): Record<string, string | number>[] => rows.map((i) => ({
    Invoice: i.number,
    Project: i.projectName,
    Client: i.clientName,
    Date: i.invoiceDate,
    Due: i.dueDate || '',
    Subtotal: i.subtotal,
    Tax: i.tax,
    Total: i.total,
    Status: projectInvoiceLabel(i.status),
  }))

  const handleCsv = () => {
    setBusy('csv')
    const data = exportRows()
    const headers = Object.keys(data[0] || { Invoice: '', Project: '' })
    const csv = [headers, ...data.map((r) => headers.map((h) => {
      const v = String(r[h] ?? '').replace(/"/g, '""'); return /[",\n]/.test(v) ? `"${v}"` : v
    }).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'project-invoices.csv'; document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    setBusy(''); flashDone('csv')
  }
  const handleExcel = async () => {
    setBusy('excel')
    const ok = await exportExcel('project-invoices', exportRows())
    setBusy(''); if (ok) flashDone('excel')
  }
  const handlePrint = () => { setBusy('print'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('print') }, 150) }
  const handlePdf = () => { setBusy('pdf'); window.setTimeout(() => { window.print(); setBusy(''); flashDone('pdf') }, 150) }

  const ToolbarBtn = ({ label, icon, onClick, doneKey }:
    { label: string; icon: React.ReactNode; onClick: () => void; doneKey: typeof done }) => (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={busy !== ''}
        aria-label={label}
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
    { id: 'project', label: 'Project', sort: 'project' },
    { id: 'client', label: 'Client', sort: 'client' },
    { id: 'date', label: 'Date', sort: 'date' },
    { id: 'due', label: 'Due', sort: 'due' },
    { id: 'total', label: 'Grand Total', sort: 'total' },
    { id: 'status', label: 'Status', sort: 'status' },
  ]
  useDismissOnOutside(colsOpen, colsRef, () => setColsOpen(false))
  const shownHead = HEAD.filter((h) => visibleCols.has(h.id))
  const tableMinWidth = shownHead.length * 120

  const open = projectInvoices.find((i) => i.id === openId) || null

  // ---- Editor ----
  const blankEditor = (): EditorDraft => ({
    number: nextProjectInvoiceNumber(projectInvoices),
    projectId: '',
    clientName: '',
    invoiceDate: todayIso(),
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    taxRate: '0',
    discountId: '',
    discountType: 'percentage',
    discountValue: '',
    taxName: '',
    notes: '',
    lines: [{ id: uid('pil'), description: '', qty: '1', rate: '', discount: '0', tax: '0' }],
  })

  const openEdit = (inv: ProjectInvoiceType) => {
    setEditing({
      id: inv.id,
      number: inv.number,
      projectId: inv.projectId,
      clientName: inv.clientName,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      taxRate: String(inv.taxRate || 0),
      discountId: inv.discountId || '',
      discountType: inv.discountType || 'percentage',
      discountValue: inv.discountValue != null && inv.discountValue !== 0 ? String(inv.discountValue) : '',
      taxName: inv.taxName || '',
      notes: inv.notes || '',
      lines: inv.lines.length
        ? inv.lines.map((l) => ({ id: l.id, description: l.description, qty: String(l.qty), rate: String(l.rate), discount: String(l.discount ?? 0), tax: String(l.tax ?? (inv.taxRate || 0)) }))
        : [{ id: uid('pil'), description: '', qty: '1', rate: '', discount: '0', tax: '0' }],
    })
    setDiscountTaxOpen(Boolean(inv.discountId || (inv.discountValue ?? 0) > 0 || inv.taxName))
  }

  /** Discount codes from the Discounts table (manual amount when none is picked). */
  const tableDiscounts = useMemo(() => activeDiscounts(), [])

  /** Taxes configured for the active business location (fallback: defaults). */
  const taxOptions = useMemo(() => {
    const settings = branchSettingsFor(branchSettings, activeBranchId || '')
    const configured = settings?.taxRates?.length ? settings.taxRates : DEFAULT_BRANCH_TAXES
    const activeTaxes = configured.filter((t) => t.status === 'active')
    if (editing?.taxName && !activeTaxes.some((t) => t.name === editing.taxName)) {
      return [...activeTaxes, { name: editing.taxName, rate: Number(editing.taxRate) || 0, status: 'active' as const }]
    }
    return activeTaxes
  }, [branchSettings, activeBranchId, editing?.taxName, editing?.taxRate])

  const selectedDiscount = tableDiscounts.find((d) => d.id === editing?.discountId) || null

  /** Order-level discount amount for the current draft (code-driven or manual). */
  const orderDiscountFor = (d: EditorDraft): number => {
    const filled = d.lines.filter((l) => l.description.trim())
    const lineSubtotal = filled.reduce((sum, l) => {
      const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0)
      return sum + (gross - gross * ((Number(l.discount) || 0) / 100))
    }, 0)
    const picked = tableDiscounts.find((x) => x.id === d.discountId)
    if (picked) return computeDiscount(picked, lineSubtotal, filled.map((l) => l.itemId).filter(Boolean) as string[])
    return d.discountType === 'fixed'
      ? Math.max(0, Number(d.discountValue) || 0)
      : lineSubtotal * ((Number(d.discountValue) || 0) / 100)
  }

  /** Live totals for the editor draft — per-line discount/tax plus the order-level card. */
  const draftTotals = useMemo(() => {
    if (!editing) return null
    const filled = editing.lines.filter((l) => l.description.trim())
    const mapped = filled.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, discount: Number(l.discount) || 0, tax: Number(l.tax) || 0 }))
    const lineSubtotal = mapped.reduce((sum, l) => sum + (l.qty * l.rate - l.qty * l.rate * (l.discount / 100)), 0)
    const lineTax = mapped.reduce((sum, l) => {
      const net = l.qty * l.rate - l.qty * l.rate * (l.discount / 100)
      return sum + net * (l.tax / 100)
    }, 0)
    const orderDiscount = orderDiscountFor(editing)
    const totals = projectInvoiceTotals(mapped, Number(editing.taxRate) || 0, orderDiscount)
    return { lineSubtotal, lineTax, orderDiscount, orderTax: totals.tax - lineTax, ...totals }
  }, [editing, tableDiscounts])

  const codeDiscountValue = selectedDiscount && draftTotals
    ? computeDiscount(selectedDiscount, draftTotals.lineSubtotal, (editing?.lines || []).map((l) => l.itemId).filter(Boolean) as string[])
    : null
  const codeBlock = selectedDiscount && draftTotals
    ? discountBlockReason(selectedDiscount, draftTotals.lineSubtotal, {
        itemIds: (editing?.lines || []).map((l) => l.itemId).filter(Boolean) as string[],
        productName: (id: string) => inventory.find((x) => x.id === id)?.name,
      })
    : null

  const setDraftLine = (id: string, patch: Partial<LineDraft>) =>
    setEditing((d) => (d ? { ...d, lines: d.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : d))

  const saveInvoice = () => {
    if (!editing) return
    const project = projects.find((p) => p.id === editing.projectId)
    if (!project) { toast.error('Project required', 'Pick the project this invoice bills.'); return }
    const filled = editing.lines
      .filter((l) => l.description.trim())
      .map((l) => ({ id: l.id, description: l.description.trim(), qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, discount: Math.max(0, Number(l.discount) || 0), tax: Math.max(0, Number(l.tax) || 0) }))
    if (!filled.length) { toast.error('Lines required', 'Add at least one line with a description.'); return }
    if (filled.some((l) => l.qty <= 0)) { toast.error('Invalid quantity', 'Line quantities must be greater than zero.'); return }

    const taxRate = Math.max(0, Number(editing.taxRate) || 0)
    const orderDiscount = orderDiscountFor(editing)
    const totals = projectInvoiceTotals(filled, taxRate, orderDiscount)
    const existing = projectInvoices.find((i) => i.id === editing.id)
    const inv: ProjectInvoiceType = {
      id: editing.id || uid('pinv'),
      ...(existing ? { companyId: existing.companyId, branchId: existing.branchId } : {}),
      number: editing.number,
      projectId: project.id,
      projectName: project.name,
      clientName: editing.clientName.trim() || project.clientName,
      invoiceDate: editing.invoiceDate,
      dueDate: editing.dueDate,
      lines: filled,
      taxRate,
      discountId: editing.discountId || undefined,
      discountType: editing.discountType,
      discountValue: Math.max(0, Number(editing.discountValue) || 0),
      taxName: editing.taxName || undefined,
      taxes: editing.taxName
        ? editing.taxName.split(' + ').map((p) => p.trim()).filter(Boolean)
            .map((name) => ({ name, rate: taxOptions.find((t) => t.name === name)?.rate || 0 }))
        : undefined,
      notes: editing.notes.trim() || undefined,
      status: existing?.status || 'draft',
      ...totals,
    }
    upsertProjectInvoice(inv)
    log(user?.id || 'system', existing ? 'UPDATE' : 'CREATE', 'Project Invoice',
      `${existing ? 'Updated' : 'Created'} ${inv.number} — ${formatGhsExact(inv.total)} for ${inv.projectName}`)
    toast.success(existing ? 'Invoice updated' : 'Invoice created', inv.number)
    setEditing(null)
  }

  const changeStatus = (inv: ProjectInvoiceType, status: ProjectInvoiceStatus, verb: string) => {
    upsertProjectInvoice({ ...inv, status })
    log(user?.id || 'system', 'UPDATE', 'Project Invoice', `${verb} ${inv.number}`)
    toast.success(verb, `${inv.number} — ${projectInvoiceLabel(status)}`)
    setOpenId(null)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteProjectInvoice(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Project Invoice', `Deleted ${deleting.number}`)
    toast.success('Invoice deleted', deleting.number)
    setDeleting(null)
    setOpenId(null)
  }

  return (
    <div>
      <PageHeader
        title="Project invoices"
        desc="Bills raised to clients against a project. Track drafts, sent invoices, overdue balances and collections in one place."
        actions={canManage ? (
          <Button onClick={() => { setEditing(blankEditor()); setDiscountTaxOpen(false) }}>
            <Plus className="size-4" /> New invoice
          </Button>
        ) : undefined}
      />

      {/* ── Status cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border p-4" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT_MUTED }}>{k.label}</p>
            <p className="mt-1.5 font-display text-xl font-bold" style={{ color: k.accent }}>{k.value}</p>
            <p className="mt-0.5 text-xs" style={{ color: TEXT_MUTED }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <section className="mt-4 rounded-xl border" style={{ background: CARD_BG, borderColor: PANEL_BD }}>
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left" aria-expanded={filtersOpen}>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={{ background: PANEL_BG, color: TEXT_MUTED }}><Filter className="size-4" aria-hidden /></span>
          <span className="flex-1 text-sm font-bold" style={{ color: TEXT }}>Filters</span>
          <ChevronDown className={('size-4 transition-transform ' + (filtersOpen ? 'rotate-180' : ''))} style={{ color: TEXT_MUTED }} aria-hidden />
        </button>
        {filtersOpen && (
          <div className="border-t px-4 py-4" style={{ borderColor: PANEL_BD }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Business Location:</p>
                <Select value={fLoc} onChange={(e) => { setFLoc(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fLoc === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Project:</p>
                <Select value={fProject} onChange={(e) => { setFProject(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fProject === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div>
                <p className="mb-1.5 text-sm font-bold" style={{ color: TEXT }}>Client:</p>
                <Select value={fClient} onChange={(e) => { setFClient(e.target.value); setPage(1) }} className="w-full" style={{ background: INPUT_BG, border: `1px solid ${INPUT_BD}`, color: fClient === 'all' ? TEXT_MUTED : TEXT }}>
                  <option value="all">All</option>
                  {clientNames.map((c) => <option key={c} value={c}>{c}</option>)}
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
                    onClick={() => { setFFrom(DEFAULT_FROM); setFTo(DEFAULT_TO); setFLoc('all'); setFProject('all'); setFClient('all'); setPage(1) }}
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

      {/* ── List ───────────────────────────────────────────────────────── */}
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
            <ToolbarBtn label="Export CSV" icon={<Download className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handleCsv} doneKey="csv" />
            <ToolbarBtn label="Export Excel" icon={<FileSpreadsheet className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={() => void handleExcel()} doneKey="excel" />
            <ToolbarBtn label="Print" icon={<Printer className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePrint} doneKey="print" />
            <div className="relative" ref={colsRef}>
              <span className="group relative inline-flex">
                <button
                  type="button"
                  onClick={() => setColsOpen((v) => !v)}
                  aria-expanded={colsOpen}
                  aria-label="Column visibility"
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
            <ToolbarBtn label="Export PDF" icon={<FileText className="size-5" aria-hidden style={{ width: 20, height: 20 }} />} onClick={handlePdf} doneKey="pdf" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[11rem]">
              <option value="all">All statuses</option>
              {PROJECT_INVOICE_STATUSES.map((st) => <option key={st} value={st}>{projectInvoiceLabel(st)}</option>)}
            </Select>
          </div>
          <span className="relative block w-full sm:w-[240px]">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" style={{ color: TEXT_MUTED }} aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Search ..."
              aria-label="Search project invoices"
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
              {pageRows.map((i, idx) => {
                const overdue = isProjectInvoiceOverdue(i)
                return (
                  <tr key={i.id} style={{ background: idx % 2 ? ROW_ALT : 'transparent' }}>
                    {visibleCols.has('action') && (
                      <td className="whitespace-nowrap px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="View" onClick={() => setOpenId(i.id)}><FileText className="size-4" /></button>
                        {canManage && projectInvoiceEditable(i.status) && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Edit" onClick={() => openEdit(i)}><Pencil className="size-4" /></button>
                        )}
                        {canManage && i.status === 'draft' && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Mark sent" onClick={() => changeStatus(i, 'sent', 'Invoice sent')}><Send className="size-4" /></button>
                        )}
                        {canManage && i.status === 'sent' && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Record payment" onClick={() => changeStatus(i, 'paid', 'Payment received')}><Banknote className="size-4" /></button>
                        )}
                        {canManage && projectInvoiceDeletable(i.status) && (
                          <button className="rounded-lg p-2" style={{ color: TEXT_MUTED }} title="Delete" onClick={() => setDeleting(i)}><Trash2 className="size-4" /></button>
                        )}
                      </td>
                    )}
                    {visibleCols.has('number') && <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{i.number}</td>}
                    {visibleCols.has('project') && (
                      <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>
                        <button className="text-left hover:underline" onClick={() => setOpenId(i.id)}>{i.projectName}</button>
                      </td>
                    )}
                    {visibleCols.has('client') && <td className="px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{i.clientName}</td>}
                    {visibleCols.has('date') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT_MUTED, borderBottom: `1px solid ${PANEL_BD}` }}>{formatDate(i.invoiceDate)}</td>}
                    {visibleCols.has('due') && (
                      <td className="whitespace-nowrap px-3 py-2.5" style={{ color: overdue ? '#dc2626' : TEXT_MUTED, fontWeight: overdue ? 600 : 400, borderBottom: `1px solid ${PANEL_BD}` }}>
                        {i.dueDate ? formatDate(i.dueDate) : '—'}
                      </td>
                    )}
                    {visibleCols.has('total') && <td className="whitespace-nowrap px-3 py-2.5" style={{ color: TEXT, borderBottom: `1px solid ${PANEL_BD}` }}>{formatGhsExact(i.total)}</td>}
                    {visibleCols.has('status') && <td className="px-3 py-2.5" style={{ borderBottom: `1px solid ${PANEL_BD}` }}><InvStatus status={i.status} /></td>}
                  </tr>
                )
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={Math.max(1, shownHead.length)} className="px-3 py-10 text-center" style={{ color: TEXT_MUTED }}>
                    No project invoices found.
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

      {/* ── View invoice (printable) ───────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpenId(null)} title="Project invoice" wide>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <InvStatus status={open.status} />
              {open.status === 'draft' && <span className="text-xs text-mist">Draft — not yet sent to the client.</span>}
              {isProjectInvoiceOverdue(open) && <span className="text-xs font-semibold text-rose-600">Overdue — due {formatDate(open.dueDate)}</span>}
            </div>

            <div id="pinv-print" className="rounded-xl bg-white p-5 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">Project invoice — {open.projectName}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide">Invoice</p>
                  <p className="text-xs text-zinc-500">{open.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(open.invoiceDate)}</p>
                  {open.dueDate && <p className="text-xs text-zinc-500">Due {formatDate(open.dueDate)}</p>}
                </div>
              </div>

              <div className="mt-4 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                <p><span className="font-semibold">Project:</span> {open.projectName}</p>
                <p><span className="font-semibold">Client:</span> {open.clientName}</p>
                <p><span className="font-semibold">Business location:</span> {branches.find((b) => b.id === open.branchId)?.name || '—'}</p>
                <p><span className="font-semibold">Status:</span> {projectInvoiceLabel(open.status)}</p>
              </div>

              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-100 text-left uppercase tracking-wide text-zinc-500">
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.lines.map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2 text-right">{l.qty}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(l.rate)}</td>
                        <td className="px-3 py-2 text-right">{formatGhsExact(projectInvoiceLineTotal(l))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex items-end justify-between">
                {open.notes ? <p className="max-w-sm text-xs text-zinc-500">{open.notes}</p> : <span />}
                <div className="w-60 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span>{formatGhsExact(open.subtotal)}</span></div>
                  <div className="flex justify-between"><span>{open.taxRate ? `Tax (${open.taxRate}%)` : 'Tax'}</span><span>{formatGhsExact(open.tax)}</span></div>
                  <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-bold"><span>Total</span><span>{formatGhsExact(open.total)}</span></div>
                  {open.status === 'paid'
                    ? <div className="flex justify-between text-zinc-600"><span>Balance due</span><span>GHS 0.00</span></div>
                    : open.status === 'sent' && (
                      <div className="flex justify-between border-t border-zinc-300 pt-2 font-bold"><span>Balance due</span><span>{formatGhsExact(projectInvoiceBalance(open))}</span></div>
                    )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              {canManage && projectInvoiceEditable(open.status) && (
                <Button onClick={() => { openEdit(open); setOpenId(null) }}><Pencil className="size-4" /> Edit</Button>
              )}
              {canManage && open.status === 'draft' && (
                <Button onClick={() => changeStatus(open, 'sent', 'Invoice sent')}><Send className="size-4" /> Mark sent</Button>
              )}
              {canManage && open.status === 'sent' && (
                <>
                  <Button onClick={() => changeStatus(open, 'paid', 'Payment received')}><Banknote className="size-4" /> Mark paid</Button>
                  <Button variant="ghost" onClick={() => changeStatus(open, 'cancelled', 'Invoice cancelled')}><X className="size-4" /> Cancel invoice</Button>
                </>
              )}
              {canManage && projectInvoiceDeletable(open.status) && (
                <Button variant="ghost" onClick={() => { setDeleting(open); setOpenId(null) }}><Trash2 className="size-4" /> Delete</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add / edit invoice ─────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit project invoice' : 'New project invoice'} xl>
        {editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Field label="Invoice No.">
                <Input value={editing.number} readOnly className="font-mono" />
              </Field>
              <Field label="Project" required>
                <Select
                  value={editing.projectId}
                  onChange={(e) => {
                    const prj = projects.find((p) => p.id === e.target.value)
                    setEditing({ ...editing, projectId: e.target.value, clientName: prj ? prj.clientName : '' })
                  }}
                >
                  <option value="">Select a project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Client">
                <Input
                  value={editing.clientName}
                  onChange={(e) => setEditing({ ...editing, clientName: e.target.value })}
                  placeholder={projects.find((p) => p.id === editing.projectId)?.clientName || 'Billed to'}
                />
              </Field>
              <Field label="Invoice Date" required>
                <Input type="date" value={editing.invoiceDate} onChange={(e) => setEditing({ ...editing, invoiceDate: e.target.value })} />
              </Field>
              <Field label="Due Date" required>
                <Input type="date" value={editing.dueDate} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} />
              </Field>
            </div>

            {/* Lines */}
            <div>
              <div className="mb-1.5 grid grid-cols-[10rem_1fr_4.5rem_7rem_5rem_5rem_8rem_2.5rem] items-center gap-2 text-xs font-bold uppercase tracking-wider text-mist">
                <span>Item</span><span>Description</span><span>Qty</span><span>Rate (GHS)</span><span>Disc %</span><span>Tax %</span><span className="text-right">Amount</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l) => {
                  const gross = (Number(l.qty) || 0) * (Number(l.rate) || 0)
                  const net = gross - gross * ((Number(l.discount) || 0) / 100)
                  const amount = net + net * ((Number(l.tax) || 0) / 100)
                  return (
                    <div key={l.id} className="grid grid-cols-[10rem_1fr_4.5rem_7rem_5rem_5rem_8rem_2.5rem] items-center gap-2">
                      <Select
                        value={l.itemId || ''}
                        placeholder="Search items…"
                        aria-label="Select product item"
                        onChange={(e) => {
                          const v = e.target.value
                          const picked = inventory.find((x) => x.id === v)
                          setDraftLine(l.id, {
                            itemId: v || undefined,
                            description: l.description.trim() || (picked?.name ?? ''),
                            rate: l.rate || String(picked?.sellPrice ?? ''),
                          })
                        }}
                      >
                        <option value="">Please Select…</option>
                        {inventory.map((x) => <option key={x.id} value={x.id}>{x.name}{x.sku ? ` — ${x.sku}` : ''}</option>)}
                      </Select>
                      <Input
                        value={l.description}
                        onChange={(e) => setDraftLine(l.id, { description: e.target.value })}
                        placeholder="Line description"
                      />
                      <Input
                        type="number" min={0} step="0.01" value={l.qty}
                        onChange={(e) => setDraftLine(l.id, { qty: e.target.value })}
                        aria-label="Quantity"
                      />
                      <Input
                        type="number" min={0} step="0.01" value={l.rate}
                        onChange={(e) => setDraftLine(l.id, { rate: e.target.value })}
                        aria-label="Rate"
                      />
                      <Input
                        type="number" min={0} step="0.01" value={l.discount}
                        onChange={(e) => setDraftLine(l.id, { discount: e.target.value })}
                        aria-label="Discount percent"
                      />
                      <Input
                        type="number" min={0} step="0.01" value={l.tax}
                        onChange={(e) => setDraftLine(l.id, { tax: e.target.value })}
                        aria-label="Tax percent"
                      />
                      <span className="text-right text-sm font-semibold">{formatGhsExact(amount)}</span>
                      <button
                        type="button"
                        aria-label="Remove line"
                        className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-rose-500"
                        onClick={() => setEditing({ ...editing, lines: editing.lines.filter((x) => x.id !== l.id) })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-500/40 px-3 py-1.5 text-sm text-mist transition hover:border-lime hover:text-lime"
                onClick={() => setEditing({ ...editing, lines: [...editing.lines, { id: uid('pil'), description: '', qty: '1', rate: '', discount: '0', tax: '0' }] })}
              >
                <Plus className="size-4" /> Add row
              </button>
            </div>

            {/* Discount & tax (order level) — collapsible, same as the purchase invoice. */}
            <div className="rounded-xl border border-zinc-500/20 bg-zinc-500/5">
              <button
                type="button"
                onClick={() => setDiscountTaxOpen((v) => !v)}
                aria-expanded={discountTaxOpen}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left sm:px-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-mist">Discount &amp; tax</p>
                <ChevronDown className={`size-4 shrink-0 text-mist transition-transform ${discountTaxOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
              </button>
              {discountTaxOpen && (
                <div className="border-t border-zinc-500/20 p-3 sm:p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Discount code">
                      <Select value={editing.discountId} onChange={(e) => {
                        const nextId = e.target.value
                        const next = tableDiscounts.find((d) => d.id === nextId)
                        setEditing({
                          ...editing,
                          discountId: nextId,
                          discountType: next ? next.type : editing.discountType,
                          discountValue: next ? String(next.value) : editing.discountValue,
                        })
                      }} placeholder="Search codes…">
                        <option value="">Manual discount</option>
                        {tableDiscounts.map((d) => <option key={d.id} value={d.id}>{discountLabel(d)}</option>)}
                      </Select>
                    </Field>
                    <div className="self-end pb-2 text-[11px] leading-snug">
                      {selectedDiscount ? (
                        codeBlock ? (
                          <span className="font-medium text-amber-500"><span className="font-semibold">{selectedDiscount.name}</span> not applied — {codeBlock}.</span>
                        ) : (
                          <span className="font-medium text-emerald-500"><span className="font-semibold">{selectedDiscount.name}</span> ({selectedDiscount.code}) applies −{formatGhsExact(codeDiscountValue ?? 0)}</span>
                        )
                      ) : (
                        <span className="text-mist">Pick a code from the Discounts table or set a manual amount.</span>
                      )}
                    </div>
                    <Field label="Discount type">
                      <Select value={editing.discountType} disabled={!!selectedDiscount} onChange={(e) => setEditing({ ...editing, discountType: e.target.value as 'percentage' | 'fixed' })}>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed amount</option>
                      </Select>
                    </Field>
                    <Field label={editing.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}>
                      <Input type="number" min={0} step="0.01" disabled={!!selectedDiscount} value={editing.discountValue} onChange={(e) => setEditing({ ...editing, discountValue: e.target.value })} />
                    </Field>
                    <Field label="Tax name">
                      <TaxMultiSelect
                        taxes={taxOptions}
                        selected={editing.taxName ? editing.taxName.split(' + ').map((p) => p.trim()).filter(Boolean) : []}
                        onChange={(names) => setEditing({
                          ...editing,
                          taxName: names.join(' + '),
                          taxRate: names.length ? String(sumTaxRates(taxOptions, names)) : '0',
                        })}
                        emptyLabel="No tax"
                        ariaLabel="Tax name"
                      />
                    </Field>
                    <Field label="Tax rate (%)">
                      <Input value={`${Number(editing.taxRate) || 0}%`} readOnly aria-label="Associated tax rate" />
                    </Field>
                  </div>
                  {draftTotals && (
                    <div className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between text-mist"><span>Subtotal</span><span>{formatGhsExact(draftTotals.lineSubtotal)}</span></div>
                      {draftTotals.orderDiscount > 0 && (
                        <div className="flex justify-between text-mist"><span>Order discount{selectedDiscount ? ` — ${selectedDiscount.name}` : ''}</span><span>−{formatGhsExact(draftTotals.orderDiscount)}</span></div>
                      )}
                      <div className="flex justify-between text-mist"><span>Tax total</span><span>{formatGhsExact(draftTotals.tax)}</span></div>
                      {draftTotals.orderTax > 0 && (
                        <div className="flex justify-between text-mist"><span>Order tax</span><span>{formatGhsExact(draftTotals.orderTax)}</span></div>
                      )}
                      <div className="flex justify-between border-t border-zinc-500/20 pt-2 text-base font-bold">
                        <span>Grand total</span><span>{formatGhsExact(draftTotals.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Field label="Notes">
              <Textarea
                value={editing.notes}
                onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                rows={2}
                placeholder="Payment terms, milestone reference, thank-you note…"
              />
            </Field>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={saveInvoice}><Check className="size-4" /> {editing.id ? 'Save changes' : 'Create invoice'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete confirm ─────────────────────────────────────────────── */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete invoice" narrow>
        {deleting && (
          <div className="space-y-4">
            <p className="text-sm text-mist">
              Delete <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhsExact(deleting.total)}) for{' '}
              <span className="font-semibold text-inherit">{deleting.projectName}</span>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Keep it</Button>
              <Button variant="danger" onClick={confirmDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
