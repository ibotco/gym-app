import { useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, Eye, Pencil, Printer, Trash2, Download, Wallet, Banknote, Clock, CalendarCheck, ChevronRight, Paperclip, X } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, SEARCH_TYPES, VOUCHER_METHODS } from '../../../lib/accounting'
import { StatusSelect, VoucherStatusBadge, CurrencySelect, ConversionRateField, useConversionRate, StakeholderSelect, useStakeholderClassOptions, isCashOrBankAccount, QuickAddStakeholder, accountLabel, printTable, receiptVoucherHtml, printReceiptVoucher, printVoucherBatch } from './common'
import { AttachmentChips, AttachmentField, normaliseAttachments } from './AttachmentField'
import type { ReceiptVoucher, ReceiptLine, VoucherMethod, VoucherStatus, StakeholderClass, AttachmentFile } from '../../../types'

type LineDraft = { accountId: string; narration: string; amount: string }
type Form = {
  id?: string; number: string; date: string; receivedFrom: string; stakeholderClass: StakeholderClass
  depositAccountId: string; method: VoucherMethod; referenceNo: string; currency: string; conversionRate: string; description: string
  lines: LineDraft[]; attachments: AttachmentFile[]; status: VoucherStatus
}

const blank = (number: string, autoPost: boolean): Form => ({
  number, date: new Date().toISOString().slice(0, 10), receivedFrom: '', stakeholderClass: 'customer',
  depositAccountId: '', method: 'cash', referenceNo: '', currency: 'GHS', conversionRate: '', description: '',
  lines: [{ accountId: '', narration: '', amount: '' }], attachments: [], status: autoPost ? 'posted' : 'draft',
})

function todayIso(): string { return new Date().toISOString().slice(0, 10) }

/** Compute a [start, end] inclusive ISO date range for a preset search type. */
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

export function ReceiptVoucherPage() {
  const app = useApp()
  const { receipts, accounts, users, company, activeBranch, systemSettings, upsertReceipt, deleteReceipt, accountingSettings, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
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
  const [viewing, setViewing] = useState<ReceiptVoucher | null>(null)
  const [deleting, setDeleting] = useState<ReceiptVoucher | null>(null)

  const rows = useMemo(() => {
    return [...receipts]
      .filter((r) => {
        if (applied.start && r.date < applied.start) return false
        if (applied.end && r.date > applied.end) return false
        if (applied.stakeholder && r.stakeholderClass !== applied.stakeholder) return false
        if (applied.q && !r.number.toLowerCase().includes(applied.q.toLowerCase())) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [receipts, applied])

  // ---- Summary (global, not filtered) ----
  const posted = receipts.filter((r) => r.status === 'posted')
  const totalReceived = posted.reduce((s, r) => s + r.amount, 0)
  const pending = receipts.filter((r) => r.status === 'draft').length
  const today = todayIso()
  const todaysCollections = posted.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0)

  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name || id : '—')
  const stakeholderClassOptions = useStakeholderClassOptions()
  const className = (id?: string) => stakeholderClassOptions.find((c) => c.id === id)?.label || '—'

  // Row selection — same pattern as the Chart of Accounts list.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulk, setShowBulk] = useState(false)
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleOne = (id: string) => {
    setShowBulk(false) // selecting rows only ENABLES Bulk Actions — the menu opens on click
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleAll = () => {
    setShowBulk(false)
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) rows.forEach((r) => n.delete(r.id))
      else rows.forEach((r) => n.add(r.id))
      return n
    })
  }
  const setStatusBulk = (status: 'posted' | 'draft') => {
    receipts.filter((r) => selected.has(r.id)).forEach((r) => upsertReceipt({ ...r, status }))
    toast.success(`${selected.size} record(s) marked ${status}`)
    setSelected(new Set()); setShowBulk(false)
  }
  const deleteBulk = () => {
    receipts.filter((r) => selected.has(r.id)).forEach((r) => deleteReceipt(r.id))
    toast.success(`${selected.size} record(s) deleted`)
    setSelected(new Set()); setShowBulk(false)
  }
  const buildReceiptOpts = (rv: ReceiptVoucher) => ({
    number: rv.number,
    date: rv.date,
    receivedFrom: rv.receivedFrom,
    amount: rv.amount,
    currencyWordsUnit: (rv.currency || 'GHS') === 'GHS' ? 'Ghana Cedi(s)' : rv.currency,
    lines: (rv.lines && rv.lines.length ? rv.lines : [{ accountId: rv.depositAccountId, narration: rv.description || '', amount: rv.amount }])
      .map((l) => ({ description: accountName(accounts, l.accountId), narration: l.narration || undefined, amount: l.amount })),
    methodLabel: rv.method === 'cash' ? 'Cash' : rv.referenceNo ? `${rv.method.toUpperCase()} ${rv.referenceNo}` : rv.method.charAt(0).toUpperCase() + rv.method.slice(1),
    orgLine1: company.legalName || company.name,
    orgLine2: activeBranch?.name,
    tel: company.phone,
    email: company.email,
    digitalAddress: company.digitalAddress,
    website: company.webAddress,
    logo: company.logoImage,
    issuedBy: users.find((u) => u.id === rv.createdBy)?.name || user?.name || '',
    footerText: `© ${new Date().getFullYear()} ${systemSettings.appName}. | Phone : ${company.phone} | All Rights Reserved.`,
  })
  /** Formal Receipt Voucher document for one record. */
  const printVoucher = (rv: ReceiptVoucher) => printReceiptVoucher(buildReceiptOpts(rv))

  /** Print each selected voucher as its own formal receipt, page-break separated. */
  const printBulkVouchers = () => {
    const sel = rows.filter((r) => selected.has(r.id))
    if (!sel.length) return
    printVoucherBatch(`Receipt Vouchers (${sel.length})`, sel.map(buildReceiptOpts).map(receiptVoucherHtml))
    setShowBulk(false)
  }

  const printList = () => {
    const sel = rows.filter((r) => selected.has(r.id))
    const fmt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2,'0')
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    printTable({
      title: 'Income',
      subtitle: `${company.name} — ${sel.length} record(s) — printed ${stamp}`,
      headers: [
        { label: 'Voucher No.', mono: true, width: '11%' },
        { label: 'Date', mono: true, width: '11%' },
        { label: 'Received From', width: '24%' },
        { label: 'Method', width: '10%' },
        { label: 'Reference', mono: true, width: '14%' },
        { label: 'Currency', width: '9%' },
        { label: 'Amount', num: true, width: '12%' },
        { label: 'Status', width: '9%' },
      ],
      rows: sel.map((r) => [
        r.number,
        fmt(r.date),
        r.receivedFrom,
        r.method,
        r.referenceNo || '—',
        r.currency || 'GHS',
        formatGhsExact(r.amount),
        r.status,
      ]),
      totals: ['Total', '', '', '', '', '', formatGhsExact(sel.reduce((s, r) => s + r.amount, 0)), ''],
      footer: `Printed on ${stamp} · ${company.name}`,
    })
    setShowBulk(false)
  }

  const columns: Column<ReceiptVoucher>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = !allSelected && rows.some((r) => selected.has(r.id)) }}
          onChange={toggleAll}
          aria-label="Select all"
        />
      ),
      render: (r) => (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleOne(r.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${r.number}`}
        />
      ),
    },
    { key: 'number', header: 'Voucher No.', sortValue: (r) => r.number, render: (r) => <span className="font-mono text-sm font-semibold">{r.number}</span> },
    { key: 'date', header: 'Voucher Date', sortValue: (r) => r.date, render: (r) => <span className="text-mist">{formatDate(r.date)}</span> },
    { key: 'from', header: 'Stakeholder Name', sortValue: (r) => r.receivedFrom, render: (r) => <span className="font-semibold">{r.receivedFrom}</span> },
    { key: 'method', header: 'Payment Method', sortValue: (r) => r.method, render: (r) => <Badge tone="zinc">{r.method}</Badge> },
    { key: 'ref', header: 'Reference No.', sortValue: (r) => r.referenceNo || '', render: (r) => <span className="font-mono text-sm text-mist">{r.referenceNo || '—'}</span> },
    { key: 'amount', header: 'Amount', sortValue: (r) => r.amount, align: 'right', render: (r) => <span className="font-semibold">{formatGhsExact(r.amount)}</span> },
    { key: 'currency', header: 'Currency', sortValue: (r) => r.currency || 'GHS', align: 'center', render: (r) => <span className="text-mist">{r.currency || 'GHS'}</span> },
    { key: 'createdBy', header: 'Created By', sortValue: (r) => userName(r.createdBy), render: (r) => <span className="text-mist">{userName(r.createdBy)}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <VoucherStatusBadge status={r.status} /> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="View" onClick={() => setViewing(r)}><Eye className="size-4" /></button>
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(r)}><Pencil className="size-4" /></button>}
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Print" onClick={() => printVoucher(r)}><Printer className="size-4" /></button>
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing({ ...blank(nextNumber('RV', receipts), accountingSettings.autoPost), currency: baseCode })
  const openEdit = (r: ReceiptVoucher) => setEditing({
    id: r.id, number: r.number, date: r.date, receivedFrom: r.receivedFrom, stakeholderClass: r.stakeholderClass || 'customer',
    depositAccountId: r.depositAccountId, method: r.method, referenceNo: r.referenceNo || '', currency: r.currency || 'GHS',
    conversionRate: r.conversionRate ? String(r.conversionRate) : '',
    description: r.description || '',
    attachments: normaliseAttachments(r),
    lines: (r.lines && r.lines.length ? r.lines : [{ accountId: r.depositAccountId, narration: '', amount: String(r.amount) }])
      .map((l) => ({ accountId: l.accountId, narration: l.narration || '', amount: String(l.amount) })),
    status: r.status,
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
    if (!editing.receivedFrom.trim()) { toast.error('Select the stakeholder.'); return }
    if (!editing.depositAccountId) { toast.error('Select a deposit account.'); return }
    if (editing.currency !== baseCode && !(Number(editing.conversionRate) > 0)) { toast.error('Enter a conversion rate.', `Required for non-base currency ${editing.currency}.`); return }
    const lines: ReceiptLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, narration: l.narration.trim(), amount: Number(l.amount) || 0 }))
      .filter((l) => l.accountId && l.amount > 0)
    if (!lines.length) { toast.error('Add at least one line with an account and amount.'); return }
    const amount = lines.reduce((s, l) => s + l.amount, 0)
    const isNew = !editing.id
    upsertReceipt({
      id: editing.id || uid('rv'),
      number: editing.number.trim(),
      date: editing.date,
      receivedFrom: editing.receivedFrom.trim(),
      stakeholderClass: editing.stakeholderClass,
      depositAccountId: editing.depositAccountId,
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
      createdBy: isNew ? user?.id : (receipts.find((r) => r.id === editing.id)?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (receipts.find((r) => r.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'ReceiptVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(amount)}`)
    toast.success(isNew ? 'Income recorded' : 'Income updated', editing.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteReceipt(deleting.id)
    log(user?.id || 'system', 'DELETE', 'ReceiptVoucher', `Deleted ${deleting.number}`)
    toast.success('Income entry deleted', deleting.number)
    setDeleting(null)
  }

  const exportRows = rows.map((r) => ({
    'Voucher No.': r.number, 'Voucher Date': r.date, 'Stakeholder': r.receivedFrom, 'Stakeholder Class': className(r.stakeholderClass),
    'Payment Method': r.method, 'Reference No.': r.referenceNo || '', Amount: r.amount, Currency: r.currency || 'GHS',
    'Created By': userName(r.createdBy), Status: r.status,
  }))

  const sumCards = [
    { label: 'Total Receipts', value: String(receipts.length), icon: <Wallet className="size-5" />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Total Amount Received', value: formatGhs(totalReceived), icon: <Banknote className="size-5" />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Pending Receipts', value: String(pending), icon: <Clock className="size-5" />, tint: 'text-amber-600 bg-amber-500/10' },
    { label: "Today's Collections", value: formatGhs(todaysCollections), icon: <CalendarCheck className="size-5" />, tint: 'text-sky-600 bg-sky-500/10' },
  ]

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span>
        <ChevronRight className="size-3.5" />
        <span className="font-semibold text-inherit">Income</span>
      </div>
      <PageHeader
        title="Income"
        desc="Record and manage money received into the business."
        actions={
          <>
            <ExportButtons filename="receipt-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add Income</Button>
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
          <p className="text-sm font-semibold">Receipts <span className="ml-1 text-xs font-normal text-mist">({rows.length} records)</span></p>
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
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyTitle="No income recorded" emptyDesc="Record your first income with the Add Income button." />
      </div>

      {/* View / print */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.number || 'Receipt'} wide>
        {viewing && (
          <div className="space-y-3">
            <div id="receipt-print" className="rounded-xl bg-white p-6 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">{company.address}</p>
                  <p className="text-xs text-zinc-500">TIN {company.taxId}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide text-emerald-600">Income Receipt</p>
                  <p className="font-mono text-xs text-zinc-500">{viewing.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(viewing.date)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                {[
                  ['Received from', viewing.receivedFrom],
                  ['Stakeholder class', className(viewing.stakeholderClass)],
                  ['Deposit account', accountName(accounts, viewing.depositAccountId)],
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
              {/* Line items breakdown */}
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
                      : [{ accountId: viewing.depositAccountId, narration: viewing.description || '', amount: viewing.amount }]
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
                      <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">{formatGhsExact(viewing.amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3">
                <span className="text-xs text-zinc-400">Amount received</span>
                <span className="text-xl font-bold text-emerald-600">{formatGhsExact(viewing.amount)}</span>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => viewing && printVoucher(viewing)}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" className="flex-1" onClick={() => viewing && printVoucher(viewing)}><Download className="size-4" /> Download PDF</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Income' : 'Add New Income'} wide>
        {editing && (
          <div className="space-y-4">
            {/* Deposit account */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Deposit Account" required>
                <Select value={editing.depositAccountId} onChange={(e) => setEditing({ ...editing, depositAccountId: e.target.value })} placeholder="Please Select…">
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
                <Select value={editing.stakeholderClass} onChange={(e) => setEditing({ ...editing, stakeholderClass: e.target.value as StakeholderClass, receivedFrom: '' })}>
                  {stakeholderClassOptions.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Received From" required>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <StakeholderSelect stakeholderClass={editing.stakeholderClass} value={editing.receivedFrom} onChange={(v) => setEditing({ ...editing, receivedFrom: v })} />
                  </div>
                  <QuickAddStakeholder stakeholderClass={editing.stakeholderClass} onCreated={(name) => setEditing({ ...editing, receivedFrom: name })} />
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
              <div className="mb-1 grid grid-cols-[1fr_1fr_120px_36px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Account *</span><span>Narration</span><span>Amount *</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_120px_36px] items-center gap-2">
                    <Select value={l.accountId} onChange={(e) => setLine(i, { accountId: e.target.value })} placeholder="Select an account">
                      <option value="">Please Select the Account</option>
                      {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                    </Select>
                    <Input aria-label="Narration" value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} placeholder="narration" />
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

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete income entry?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhs(deleting.amount)})? This cannot be undone.</p>
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
