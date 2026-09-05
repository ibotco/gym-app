import { useMemo, useState } from 'react'
import { Plus, Eye, Pencil, Trash2, Wallet, Search, RotateCcw, ChevronRight, Banknote, Clock, CalendarCheck, Printer, Download, Paperclip, X } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, DatePicker, Badge as UIBadge } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, VOUCHER_METHODS, SEARCH_TYPES } from '../../../lib/accounting'
import { StatusSelect, VoucherStatusBadge, CurrencySelect, ConversionRateField, useConversionRate, StakeholderSelect, useStakeholderClassOptions, isCashOrBankAccount, QuickAddStakeholder, accountLabel, printTable, paymentVoucherHtml, printPaymentVoucher, printVoucherBatch } from './common'
import { AttachmentChips, AttachmentField, normaliseAttachments } from './AttachmentField'
import { costCenterOnLineItems } from '../../../lib/costCenters'
import { CostCenterSelect } from '../../../components/CostCenterSelect'
import type { PaymentVoucher, ReceiptLine, VoucherMethod, VoucherStatus, StakeholderClass, AttachmentFile } from '../../../types'

type LineDraft = { accountId: string; narration: string; amount: string; costCenterId?: string }
type Form = {
  id?: string; number: string; date: string; paidTo: string; stakeholderClass: StakeholderClass
  paymentAccountId: string; method: VoucherMethod; referenceNo: string; currency: string; conversionRate: string; description: string
  lines: LineDraft[]; attachments: AttachmentFile[]; status: VoucherStatus
}

const blank = (number: string, autoPost: boolean): Form => ({
  number, date: new Date().toISOString().slice(0, 10), paidTo: '', stakeholderClass: 'supplier',
  paymentAccountId: '', method: 'bank', referenceNo: '', currency: 'GHS', conversionRate: '', description: '',
  lines: [{ accountId: '', narration: '', amount: '' }], attachments: [], status: autoPost ? 'posted' : 'draft',
})

function todayIso(): string { return new Date().toISOString().slice(0, 10) }

function rangeFor(type: string): { start: string; end: string } {
  const now = new Date()
  const d = (x: Date) => x.toISOString().slice(0, 10)
  if (type === 'today') return { start: todayIso(), end: todayIso() }
  if (type === 'this_week') {
    const day = now.getDay() || 7
    const start = new Date(now); start.setDate(now.getDate() - day + 1)
    const end = new Date(start); end.setDate(start.getDate() + 6)
    return { start: d(start), end: d(end) }
  }
  if (type === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return { start: d(start), end: d(end) }
  }
  if (type === 'this_quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), q * 3, 1)
    const end = new Date(now.getFullYear(), q * 3 + 3, 0)
    return { start: d(start), end: d(end) }
  }
  if (type === 'this_year') {
    return { start: d(new Date(now.getFullYear(), 0, 1)), end: d(new Date(now.getFullYear(), 11, 31)) }
  }
  if (type === 'last_year') {
    return { start: d(new Date(now.getFullYear() - 1, 0, 1)), end: d(new Date(now.getFullYear() - 1, 11, 31)) }
  }
  return { start: '', end: '' }
}

export function PaymentVoucherPage() {
  const app = useApp()
  const { paymentVouchers, accounts, users, company, activeBranch, systemSettings, upsertPaymentVoucher, deletePaymentVoucher, accountingSettings, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const showCostCenter = costCenterOnLineItems(company)
  const lineGridCls = showCostCenter ? 'grid grid-cols-[1fr_1fr_130px_120px_36px] gap-2' : 'grid grid-cols-[1fr_1fr_120px_36px] gap-2'
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')
  const { base: baseCode, rateFor } = useConversionRate()

  // Draft filter state
  const [searchType, setSearchType] = useState('this_month')
  const [start, setStart] = useState(rangeFor('this_month').start)
  const [end, setEnd] = useState(rangeFor('this_month').end)
  const [stakeholder, setStakeholder] = useState('')
  const [voucherQ, setVoucherQ] = useState('')
  // Applied filter state (set on Search)
  const [applied, setApplied] = useState({ start, end, stakeholder, q: '' })

  const [editing, setEditing] = useState<Form | null>(null)
  const [viewing, setViewing] = useState<PaymentVoucher | null>(null)
  const [deleting, setDeleting] = useState<PaymentVoucher | null>(null)

  const rows = useMemo(() => {
    return [...paymentVouchers]
      .filter((p) => {
        if (applied.start && p.date < applied.start) return false
        if (applied.end && p.date > applied.end) return false
        if (applied.stakeholder && p.stakeholderClass !== applied.stakeholder) return false
        if (applied.q && !p.number.toLowerCase().includes(applied.q.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [paymentVouchers, applied])

  // ---- Summary (global) ----
  const posted = paymentVouchers.filter((p) => p.status === 'posted')
  const totalPaid = posted.reduce((s, p) => s + p.amount, 0)
  const pending = paymentVouchers.filter((p) => p.status === 'draft').length
  const today = todayIso()
  const todaysPayments = posted.filter((p) => p.date === today).reduce((s, p) => s + p.amount, 0)

  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name || id : '—')
  const stakeholderClassOptions = useStakeholderClassOptions()
  const className = (id?: string) => stakeholderClassOptions.find((c) => c.id === id)?.label || '—'

  // Row selection — same pattern as the Chart of Accounts list.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const allSelected = rows.length > 0 && rows.every((p) => selected.has(p.id))
  const toggleOne = (id: string) => {
    setShowBulk(false) // selecting rows only ENABLES Bulk Actions — the menu opens on click
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleAll = () => {
    setShowBulk(false)
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) rows.forEach((p) => n.delete(p.id))
      else rows.forEach((p) => n.add(p.id))
      return n
    })
  }
  const setStatusBulk = (status: 'posted' | 'draft') => {
    paymentVouchers.filter((p) => selected.has(p.id)).forEach((p) => upsertPaymentVoucher({ ...p, status }))
    toast.success(`${selected.size} record(s) marked ${status}`)
    setSelected(new Set()); setShowBulk(false)
  }
  const deleteBulk = () => {
    paymentVouchers.filter((p) => selected.has(p.id)).forEach((p) => deletePaymentVoucher(p.id))
    toast.success(`${selected.size} record(s) deleted`)
    setSelected(new Set()); setShowBulk(false)
  }
  const buildPaymentOpts = (pv: PaymentVoucher) => ({
    number: pv.number,
    date: pv.date,
    paidTo: pv.paidTo,
    amount: pv.amount,
    currencyWordsUnit: (pv.currency || 'GHS') === 'GHS' ? 'Ghana Cedi(s)' : pv.currency,
    lines: (pv.lines && pv.lines.length ? pv.lines : [{ accountId: pv.paymentAccountId, narration: pv.description || '', amount: pv.amount }])
      .map((l) => ({ description: accountName(accounts, l.accountId), narration: l.narration || undefined, amount: l.amount })),
    methodLabel: pv.method === 'bank' ? (pv.referenceNo ? `Bank ${pv.referenceNo}` : 'Bank Transfer') : pv.method === 'cash' ? 'Cash' : pv.referenceNo ? `${pv.method.toUpperCase()} ${pv.referenceNo}` : pv.method.charAt(0).toUpperCase() + pv.method.slice(1),
    orgLine1: company.legalName || company.name,
    orgLine2: activeBranch?.name,
    tel: company.phone,
    email: company.email,
    digitalAddress: company.digitalAddress,
    website: company.webAddress,
    logo: company.logoImage,
    issuedBy: users.find((u) => u.id === pv.createdBy)?.name || user?.name || '',
    footerText: `© ${new Date().getFullYear()} ${systemSettings.appName}. | Phone : ${company.phone} | All Rights Reserved.`,
  })
  const printVoucher = (pv: PaymentVoucher) => printPaymentVoucher(buildPaymentOpts(pv))

  /** Print each selected voucher as its own formal payment voucher, page-break separated. */
  const printBulkVouchers = () => {
    const sel = rows.filter((p) => selected.has(p.id))
    if (!sel.length) return
    printVoucherBatch(`Payment Vouchers (${sel.length})`, sel.map(buildPaymentOpts).map(paymentVoucherHtml))
    setShowBulk(false)
  }

  const printList = () => {
    const sel = rows.filter((p) => selected.has(p.id))
    const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2,'0')
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    printTable({
      title: 'Expenses',
      subtitle: `${company.name} — ${sel.length} record(s) — printed ${stamp}`,
      headers: [
        { label: 'Voucher No.', mono: true, width: '11%' },
        { label: 'Date', mono: true, width: '11%' },
        { label: 'Paid To', width: '24%' },
        { label: 'Method', width: '10%' },
        { label: 'Reference', mono: true, width: '14%' },
        { label: 'Currency', width: '9%' },
        { label: 'Amount', num: true, width: '12%' },
        { label: 'Status', width: '9%' },
      ],
      rows: sel.map((p) => [
        p.number,
        fmt(p.date),
        p.paidTo,
        p.method,
        p.referenceNo || '—',
        p.currency || 'GHS',
        formatGhsExact(p.amount),
        p.status,
      ]),
      totals: ['Total', '', '', '', '', '', formatGhsExact(sel.reduce((s, p) => s + p.amount, 0)), ''],
      footer: `Printed on ${stamp} · ${company.name}`,
    })
    setShowBulk(false)
  }

  const columns: Column<PaymentVoucher>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = !allSelected && rows.some((p) => selected.has(p.id)) }}
          onChange={toggleAll}
          aria-label="Select all"
        />
      ),
      render: (p) => (
        <input
          type="checkbox"
          checked={selected.has(p.id)}
          onChange={() => toggleOne(p.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${p.number}`}
        />
      ),
    },
    { key: 'number', header: 'Voucher No.', sortValue: (p) => p.number, render: (p) => <span className="font-mono text-sm font-semibold">{p.number}</span> },
    { key: 'date', header: 'Voucher Date', sortValue: (p) => p.date, render: (p) => <span className="text-mist">{formatDate(p.date)}</span> },
    { key: 'to', header: 'Stakeholder Name', sortValue: (p) => p.paidTo, render: (p) => <span className="font-semibold">{p.paidTo}</span> },
    { key: 'method', header: 'Payment Method', sortValue: (p) => p.method, render: (p) => <UIBadge tone="zinc">{p.method}</UIBadge> },
    { key: 'ref', header: 'Reference No.', sortValue: (p) => p.referenceNo || '', render: (p) => <span className="font-mono text-sm text-mist">{p.referenceNo || '—'}</span> },
    { key: 'amount', header: 'Amount', sortValue: (p) => p.amount, align: 'right', render: (p) => <span className="font-semibold">{formatGhsExact(p.amount)}</span> },
    { key: 'currency', header: 'Currency', sortValue: (p) => p.currency || 'GHS', align: 'center', render: (p) => <span className="text-mist">{p.currency || 'GHS'}</span> },
    { key: 'createdBy', header: 'Created By', sortValue: (p) => userName(p.createdBy), render: (p) => <span className="text-mist">{userName(p.createdBy)}</span> },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <VoucherStatusBadge status={p.status} /> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (p) => (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="View" onClick={() => setViewing(p)}><Eye className="size-4" /></button>
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(p)}><Pencil className="size-4" /></button>}
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Print" onClick={() => printVoucher(p)}><Printer className="size-4" /></button>
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing({ ...blank(nextNumber('PV', paymentVouchers), accountingSettings.autoPost), currency: baseCode })
  const openEdit = (p: PaymentVoucher) => setEditing({
    id: p.id, number: p.number, date: p.date, paidTo: p.paidTo, stakeholderClass: p.stakeholderClass || 'supplier',
    paymentAccountId: p.paymentAccountId, method: p.method, referenceNo: p.referenceNo || '', currency: p.currency || 'GHS',
    conversionRate: p.conversionRate ? String(p.conversionRate) : '',
    description: p.description || '',
    attachments: normaliseAttachments(p),
    lines: (p.lines && p.lines.length ? p.lines : [{ accountId: p.paymentAccountId, narration: '', amount: String(p.amount), costCenterId: undefined }])
      .map((l) => ({ accountId: l.accountId, narration: l.narration || '', amount: String(l.amount), costCenterId: l.costCenterId })),
    status: p.status,
  })

  const onSearchType = (t: string) => {
    setSearchType(t)
    if (t === 'custom') return
    const r = rangeFor(t)
    setStart(r.start); setEnd(r.end)
  }

  const doSearch = () => {
    setApplied({ start, end, stakeholder, q: voucherQ.trim() })
  }

  const doReset = () => {
    setSearchType('this_month')
    const r = rangeFor('this_month')
    setStart(r.start); setEnd(r.end)
    setStakeholder(''); setVoucherQ('')
    setApplied({ start: r.start, end: r.end, stakeholder: '', q: '' })
  }

  const setLine = (i: number, patch: Partial<LineDraft>) => setEditing((e) => e && ({ ...e, lines: e.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }))
  const totalDraft = editing ? editing.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0

  const save = () => {
    if (!editing) return
    if (!editing.paidTo.trim()) { toast.error('Select who was paid.'); return }
    if (!editing.paymentAccountId) { toast.error('Select a payment account.'); return }
    if (editing.currency !== baseCode && !(Number(editing.conversionRate) > 0)) { toast.error('Enter a conversion rate.', `Required for non-base currency ${editing.currency}.`); return }
    const lines: ReceiptLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, narration: l.narration.trim(), amount: Number(l.amount) || 0, costCenterId: l.costCenterId || undefined }))
      .filter((l) => l.accountId && l.amount > 0)
    if (!lines.length) { toast.error('Add at least one line with an account and amount.'); return }
    const amount = lines.reduce((s, l) => s + l.amount, 0)
    const isNew = !editing.id
    upsertPaymentVoucher({
      id: editing.id || uid('pv'),
      number: editing.number.trim(),
      date: editing.date,
      paidTo: editing.paidTo.trim(),
      stakeholderClass: editing.stakeholderClass,
      paymentAccountId: editing.paymentAccountId,
      lines,
      amount,
      method: editing.method,
      referenceNo: editing.referenceNo.trim() || undefined,
      currency: editing.currency.trim() || 'GHS',
      conversionRate: editing.currency !== baseCode && Number(editing.conversionRate) > 0 ? Number(editing.conversionRate) : undefined,
      description: editing.description.trim() || undefined,
      attachments: editing.attachments.length ? editing.attachments : undefined,
      attachmentName: editing.attachments[0]?.name || undefined,
      status: editing.status,
      createdBy: isNew ? user?.id : (paymentVouchers.find((p) => p.id === editing.id)?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (paymentVouchers.find((p) => p.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'PaymentVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(amount)}`)
    toast.success(isNew ? 'Expense recorded' : 'Expense updated', editing.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deletePaymentVoucher(deleting.id)
    log(user?.id || 'system', 'DELETE', 'PaymentVoucher', `Deleted ${deleting.number}`)
    toast.success('Expense entry deleted', deleting.number)
    setDeleting(null)
  }

  const exportRows = rows.map((p) => ({
    'Voucher No.': p.number, 'Voucher Date': p.date, 'Stakeholder': p.paidTo, 'Stakeholder Class': className(p.stakeholderClass),
    'Payment Method': p.method, 'Reference No.': p.referenceNo || '', Amount: p.amount, Currency: p.currency || 'GHS',
    'Created By': userName(p.createdBy), Status: p.status,
  }))

  const sumCards = [
    { label: 'Total Payments', value: String(paymentVouchers.length), icon: <Wallet className="size-5" />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Total Amount Paid', value: formatGhs(totalPaid), icon: <Banknote className="size-5" />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Pending Payments', value: String(pending), icon: <Clock className="size-5" />, tint: 'text-amber-600 bg-amber-500/10' },
    { label: "Today's Payments", value: formatGhs(todaysPayments), icon: <CalendarCheck className="size-5" />, tint: 'text-sky-600 bg-sky-500/10' },
  ]

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span>
        <ChevronRight className="size-3.5" />
        <span className="font-semibold text-inherit">Expenses</span>
      </div>
      <PageHeader
        title="Expenses"
        desc="Record and manage money paid out of the business."
        actions={
          <>
            <ExportButtons filename="payment-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add Expense</Button>
            )}
          </>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sumCards.map((c) => (
          <div key={c.label} className="card flex items-center gap-3 p-4">
            <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${c.tint}`}>{c.icon}</div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-mist">{c.label}</p>
              <p className="stat-num mt-0.5 truncate text-xl md:text-2xl">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search filters */}
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Search Type</label>
            <Select value={searchType} onChange={(e) => onSearchType(e.target.value)}>
              {SEARCH_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Start Date</label>
            <DatePicker value={start} onChange={setStart} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">End Date</label>
            <DatePicker value={end} onChange={setEnd} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Stakeholders Class</label>
            <Select value={stakeholder} onChange={(e) => setStakeholder(e.target.value)}>
              <option value="">All Stakeholders</option>
              {stakeholderClassOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Voucher Number</label>
            <Input value={voucherQ} onChange={(e) => setVoucherQ(e.target.value)} placeholder="Search by Voucher Number" onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
          </div>
          <div className="flex items-end gap-2 xl:col-span-1">
            <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" onClick={doSearch}><Search className="size-4" /> Search</Button>
            <Button variant="outline" onClick={doReset} title="Reset filters"><RotateCcw className="size-4" /></Button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Payments <span className="ml-1 text-xs font-normal text-mist">({rows.length} records)</span></p>
          <div className="flex items-center gap-2">
            {canManage && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowBulk((v) => !v)} disabled={!selected.size}>
                  Bulk Actions{selected.size ? ` (${selected.size})` : ''}
                </Button>
                {showBulk && selected.size > 0 && (
                  <div className="menu-pop absolute right-0 top-full z-30 mt-1 w-44 rounded-xl p-1.5">
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('posted')}><CalendarCheck className="size-4" /> Mark Posted</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('draft')}><Clock className="size-4" /> Mark Draft</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={printBulkVouchers}><Printer className="size-4" /> Print</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={printList}><Printer className="size-4" /> Print List</button>
                    {canDelete && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember" onClick={deleteBulk}><Trash2 className="size-4" /> Delete</button>}
                  </div>
                )}
              </div>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={() => setApplied({ start: '', end: '', stakeholder: '', q: '' })}>
                Show all
              </Button>
            )}
          </div>
        </div>
        <DataTable columns={columns} data={rows} rowKey={(p) => p.id} emptyTitle="No expenses recorded" emptyDesc="Record your first expense with the Add Expense button." />
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Expense' : 'Add New Expense'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment Account" required>
                <Select value={editing.paymentAccountId} onChange={(e) => setEditing({ ...editing, paymentAccountId: e.target.value })} placeholder="Please Select…">
                  <option value="">Please Select…</option>
                  {accounts.filter(isCashOrBankAccount).map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
                <Field label="Voucher No." required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" /></Field>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" required>
                <CurrencySelect value={editing.currency} onChange={(code) => setEditing({ ...editing, currency: code, conversionRate: code === baseCode ? '' : String(rateFor(code) ?? '') })} />
              </Field>
              <Field label="Stakeholder Class" required>
                <Select value={editing.stakeholderClass} onChange={(e) => setEditing({ ...editing, stakeholderClass: e.target.value as StakeholderClass, paidTo: '' })}>
                  {stakeholderClassOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Paid To" required>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <StakeholderSelect stakeholderClass={editing.stakeholderClass} value={editing.paidTo} onChange={(v) => setEditing({ ...editing, paidTo: v })} />
                  </div>
                  <QuickAddStakeholder stakeholderClass={editing.stakeholderClass} onCreated={(name) => setEditing({ ...editing, paidTo: name })} />
                </div>
              </Field>
              <ConversionRateField currency={editing.currency} value={editing.conversionRate} onChange={(v) => setEditing({ ...editing, conversionRate: v })} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment Method" required>
                <Select value={editing.method} onChange={(e) => setEditing({ ...editing, method: e.target.value as VoucherMethod })}>
                  {VOUCHER_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </Select>
              </Field>
              <Field label="Remarks / Memo">
                <Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Remarks / memo" />
              </Field>
            </div>

            {/* Line items */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold">Line items</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { accountId: '', narration: '', amount: '' }] })}>
                  <Plus className="size-4" /> Add line
                </Button>
              </div>
              <div className={`mb-1 ${lineGridCls} px-1 text-[10px] font-bold uppercase tracking-wider text-mist`}>
                <span>Account *</span><span>Narration</span>{showCostCenter && <span>Cost center</span>}<span>Amount *</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className={`${lineGridCls} items-center`}>
                    <Select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })} placeholder="Select an account">
                      <option value="">Please Select the Account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                    </Select>
                    <Input aria-label="Narration" value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} placeholder="narration" />
                    {showCostCenter && <CostCenterSelect value={l.costCenterId} onChange={(id) => setLine(i, { costCenterId: id || undefined })} ariaLabel={`Cost center for line ${i + 1}`} />}
                    <Input aria-label="Amount" type="number" min={0} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="amount" />
                    <button
                      type="button"
                      className="grid h-[42px] w-9 shrink-0 place-items-center rounded border border-[#e4e4de] bg-white text-mist transition hover:border-ember/60 hover:bg-rose-500/10 hover:text-ember dark:border-[#2a2a30] dark:bg-[#0d0d0f]"
                      title="Remove line"
                      aria-label="Remove line"
                      onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, idx) => idx !== i) })}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-mist">Row#: {editing.lines.length}</p>
            </div>

            {/* Attachment + status */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Attachments">
                <AttachmentField
                  files={editing.attachments}
                  onChange={(files) => setEditing({ ...editing, attachments: files })}
                />
              </Field>
              <Field label="Status"><StatusSelect value={editing.status} onChange={(v) => setEditing({ ...editing, status: v })} /></Field>
            </div>

            {/* Total + save */}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <div className="text-sm">
                <span className="text-mist">Total</span>{' '}
                <span className="font-display text-lg font-bold">{formatGhsExact(totalDraft)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><Wallet className="size-4" /> Save Voucher</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* View / print */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.number || 'Payment'} wide>
        {viewing && (
          <div className="space-y-3">
            <div className="rounded-xl bg-white p-6 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide text-rose-600">Expense Payment</p>
                  <p className="font-mono text-xs text-zinc-500">{viewing.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(viewing.date)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                {[
                  ['Paid to', viewing.paidTo],
                  ['Stakeholder class', className(viewing.stakeholderClass)],
                  ['Payment account', accountName(accounts, viewing.paymentAccountId)],
                  ['Method', viewing.method],
                  ['Reference', viewing.referenceNo || '—'],
                  ['Currency', viewing.currency || 'GHS'],
                  ['Created by', userName(viewing.createdBy)],
                  ['Status', viewing.status],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-zinc-100 py-1.5">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">{k}</span>
                    <span className="text-right text-xs font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              {viewing.description && <p className="mt-3 text-xs text-zinc-600">{viewing.description}</p>}
              {(() => {
                const files = normaliseAttachments(viewing)
                if (!files.length) return null
                return (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-400">Attachments</p>
                    <AttachmentChips files={files} readOnly />
                  </div>
                )
              })()}
              <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full text-xs">
                  <thead className="bg-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Narration</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.lines && viewing.lines.length
                      ? viewing.lines
                      : [{ accountId: viewing.paymentAccountId, narration: viewing.description || '', amount: viewing.amount }]
                    ).map((l, i) => (
                      <tr key={i} className="border-t border-zinc-100">
                        <td className="px-3 py-2 text-zinc-400">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold">{accountName(accounts, l.accountId)}</td>
                        <td className="px-3 py-2 text-zinc-600">{l.narration || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatGhsExact(Number(l.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50/60">
                      <td colSpan={3} className="px-3 py-2 text-right font-bold uppercase tracking-wider text-zinc-500">Total</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">{formatGhsExact(viewing.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3">
                <span className="text-xs text-zinc-400">Amount paid</span>
                <span className="text-xl font-bold text-rose-600">{formatGhsExact(viewing.amount)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => viewing && printVoucher(viewing)}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" className="flex-1" onClick={() => viewing && printVoucher(viewing)}><Download className="size-4" /> Download PDF</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete expense entry?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting.number}</span> ({formatGhs(deleting.amount)})? This cannot be undone.</p>
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
