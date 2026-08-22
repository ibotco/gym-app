import { useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, Eye, Pencil, Printer, Trash2, Download, Wallet, Banknote, Clock, CalendarCheck, ChevronRight, Paperclip, X } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea, Select, DatePicker, Empty } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, SEARCH_TYPES, STAKEHOLDER_CLASSES, VOUCHER_METHODS } from '../../../lib/accounting'
import { StatusSelect, VoucherStatusBadge } from './common'
import type { ReceiptVoucher, ReceiptLine, VoucherMethod, VoucherStatus, StakeholderClass } from '../../../types'

type LineDraft = { accountId: string; narration: string; amount: string }
type Form = {
  id?: string; number: string; date: string; receivedFrom: string; stakeholderClass: StakeholderClass
  depositAccountId: string; method: VoucherMethod; referenceNo: string; currency: string; description: string
  lines: LineDraft[]; attachmentName: string; status: VoucherStatus
}

const blank = (number: string, autoPost: boolean): Form => ({
  number, date: new Date().toISOString().slice(0, 10), receivedFrom: '', stakeholderClass: 'customer',
  depositAccountId: '', method: 'cash', referenceNo: '', currency: 'GHS', description: '',
  lines: [{ accountId: '', narration: '', amount: '' }], attachmentName: '', status: autoPost ? 'posted' : 'draft',
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
  const { receipts, accounts, users, company, upsertReceipt, deleteReceipt, accountingSettings, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

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
  const className = (id?: string) => STAKEHOLDER_CLASSES.find((c) => c.id === id)?.label || '—'

  const columns: Column<ReceiptVoucher>[] = [
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
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Print" onClick={() => setViewing(r)}><Printer className="size-4" /></button>
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing(blank(nextNumber('RV', receipts), accountingSettings.autoPost))
  const openEdit = (r: ReceiptVoucher) => setEditing({
    id: r.id, number: r.number, date: r.date, receivedFrom: r.receivedFrom, stakeholderClass: r.stakeholderClass || 'customer',
    depositAccountId: r.depositAccountId, method: r.method, referenceNo: r.referenceNo || '', currency: r.currency || 'GHS',
    description: r.description || '', attachmentName: r.attachmentName || '',
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
    if (!editing.receivedFrom.trim()) { toast.error('Enter the stakeholder name.'); return }
    if (!editing.depositAccountId) { toast.error('Select a deposit account.'); return }
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
      description: editing.description.trim() || undefined,
      attachmentName: editing.attachmentName.trim() || undefined,
      status: editing.status,
      createdBy: isNew ? user?.id : (receipts.find((r) => r.id === editing.id)?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (receipts.find((r) => r.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'ReceiptVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(amount)}`)
    toast.success(isNew ? 'Receipt voucher created' : 'Receipt voucher updated', editing.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteReceipt(deleting.id)
    log(user?.id || 'system', 'DELETE', 'ReceiptVoucher', `Deleted ${deleting.number}`)
    toast.success('Receipt voucher deleted', deleting.number)
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
        <span className="font-semibold text-inherit">Receipt Voucher</span>
      </div>
      <PageHeader
        title="Receipt Voucher"
        desc="Record and manage money received into the business."
        actions={
          <>
            <ExportButtons filename="receipt-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New Receipt Voucher</Button>
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
              {STAKEHOLDER_CLASSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setApplied({ start: '', end: '', stakeholder: '', q: '' })}>
              Show all
            </Button>
          )}
        </div>
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyTitle="No receipt vouchers" emptyDesc="Record your first receipt with the New Receipt Voucher button." />
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
                  <p className="font-bold uppercase tracking-wide text-emerald-600">Receipt Voucher</p>
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
              <div className="mt-5 flex items-center justify-between border-t border-zinc-200 pt-3">
                <span className="text-xs text-zinc-400">Amount received</span>
                <span className="text-xl font-bold text-emerald-600">{formatGhsExact(viewing.amount)}</span>
              </div>
            </div>
            <div className="no-print flex gap-2">
              <Button className="flex-1" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
              <Button variant="outline" className="flex-1" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}><Download className="size-4" /> Download PDF</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Receipt' : 'Add New Receipt'} wide>
        {editing && (
          <div className="space-y-4">
            {/* Deposit account */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Deposit Account" required>
                <Select value={editing.depositAccountId} onChange={(e) => setEditing({ ...editing, depositAccountId: e.target.value })} placeholder="Please Select…">
                  <option value="">Please Select…</option>
                  {accounts.filter((a) => a.type === 'asset').map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
                <Field label="Voucher No." required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" /></Field>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Currency" required>
                <Input value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} />
              </Field>
              <Field label="Received From" required>
                <Input value={editing.receivedFrom} onChange={(e) => setEditing({ ...editing, receivedFrom: e.target.value })} />
              </Field>
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
                      {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                    </Select>
                    <Input aria-label="Narration" value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} placeholder="narration" />
                    <Input aria-label="Amount" type="number" min={0} value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder="amount" />
                    <button
                      type="button"
                      className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember"
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
              <Field label="Attachment">
                <div className="flex items-center gap-2">
                  <Input
                    value={editing.attachmentName}
                    onChange={(e) => setEditing({ ...editing, attachmentName: e.target.value })}
                    placeholder="Attachment name (optional)"
                  />
                  <Button variant="outline" size="icon" title="Attach file" type="button">
                    <Paperclip className="size-4" />
                  </Button>
                </div>
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
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete receipt voucher?">
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
