import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, X, Paperclip, Wallet, Search, RotateCcw, ChevronRight, Banknote, Clock, CalendarCheck } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea, DatePicker, Select, Badge as UIBadge } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, STAKEHOLDER_CLASSES, VOUCHER_METHODS, SEARCH_TYPES } from '../../../lib/accounting'
import { StatusSelect, VoucherStatusBadge } from './common'
import type { PaymentVoucher, ReceiptLine, VoucherMethod, VoucherStatus, StakeholderClass } from '../../../types'

type LineDraft = { accountId: string; narration: string; amount: string }
type Form = {
  id?: string; number: string; date: string; paidTo: string; stakeholderClass: StakeholderClass
  paymentAccountId: string; method: VoucherMethod; referenceNo: string; currency: string; description: string
  lines: LineDraft[]; attachmentName: string; status: VoucherStatus
}

const blank = (number: string, autoPost: boolean): Form => ({
  number, date: new Date().toISOString().slice(0, 10), paidTo: '', stakeholderClass: 'supplier',
  paymentAccountId: '', method: 'bank', referenceNo: '', currency: 'GHS', description: '',
  lines: [{ accountId: '', narration: '', amount: '' }], attachmentName: '', status: autoPost ? 'posted' : 'draft',
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
  const { paymentVouchers, accounts, users, upsertPaymentVoucher, deletePaymentVoucher, accountingSettings, log } = app
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
  const className = (id?: string) => STAKEHOLDER_CLASSES.find((c) => c.id === id)?.label || '—'

  const columns: Column<PaymentVoucher>[] = [
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
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(p)}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing(blank(nextNumber('PV', paymentVouchers), accountingSettings.autoPost))
  const openEdit = (p: PaymentVoucher) => setEditing({
    id: p.id, number: p.number, date: p.date, paidTo: p.paidTo, stakeholderClass: p.stakeholderClass || 'supplier',
    paymentAccountId: p.paymentAccountId, method: p.method, referenceNo: p.referenceNo || '', currency: p.currency || 'GHS',
    description: p.description || '', attachmentName: p.attachmentName || '',
    lines: (p.lines && p.lines.length ? p.lines : [{ accountId: p.paymentAccountId, narration: '', amount: String(p.amount) }])
      .map((l) => ({ accountId: l.accountId, narration: l.narration || '', amount: String(l.amount) })),
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
    if (!editing.paidTo.trim()) { toast.error('Enter who was paid.'); return }
    if (!editing.paymentAccountId) { toast.error('Select a payment account.'); return }
    const lines: ReceiptLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, narration: l.narration.trim(), amount: Number(l.amount) || 0 }))
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
      description: editing.description.trim() || undefined,
      attachmentName: editing.attachmentName.trim() || undefined,
      status: editing.status,
      createdBy: isNew ? user?.id : (paymentVouchers.find((p) => p.id === editing.id)?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (paymentVouchers.find((p) => p.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'PaymentVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(amount)}`)
    toast.success(isNew ? 'Payment voucher created' : 'Payment voucher updated', editing.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deletePaymentVoucher(deleting.id)
    log(user?.id || 'system', 'DELETE', 'PaymentVoucher', `Deleted ${deleting.number}`)
    toast.success('Payment voucher deleted', deleting.number)
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
        <span className="font-semibold text-inherit">Payment Voucher</span>
      </div>
      <PageHeader
        title="Payment Voucher"
        desc="Record and manage money paid out of the business."
        actions={
          <>
            <ExportButtons filename="payment-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && (
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New Payment Voucher</Button>
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
          <p className="text-sm font-semibold">Payments <span className="ml-1 text-xs font-normal text-mist">({rows.length} records)</span></p>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={() => setApplied({ start: '', end: '', stakeholder: '', q: '' })}>
              Show all
            </Button>
          )}
        </div>
        <DataTable columns={columns} data={rows} rowKey={(p) => p.id} emptyTitle="No payment vouchers" emptyDesc="Record your first payment with the New Payment Voucher button." />
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Payment' : 'Add New Payment'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Payment Account" required>
                <Select value={editing.paymentAccountId} onChange={(e) => setEditing({ ...editing, paymentAccountId: e.target.value })} placeholder="Please Select…">
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
              <Field label="Paid To" required>
                <Input value={editing.paidTo} onChange={(e) => setEditing({ ...editing, paidTo: e.target.value })} />
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

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete payment voucher?">
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
