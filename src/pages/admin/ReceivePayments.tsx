import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banknote, Search as SearchIcon, CheckCircle2, Clock } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker, SearchField, Segmented } from '../../components/ui'
import { Payments } from './Payments'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../lib/utils'
import type { Invoice, PaymentMethod } from '../../types'

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
  const [form, setForm] = useState<ReceiveForm | null>(null)
  const [params] = useSearchParams()
  const [tab, setTab] = useState<'outstanding' | 'all'>(params.get('tab') === 'all' ? 'all' : 'outstanding')

  const memberName = (memberId?: string) => {
    if (!memberId) return ''
    const m = members.find((x) => x.id === memberId)
    return m ? (users.find((u) => u.id === m.userId)?.name || '') : ''
  }
  const invoiceName = (inv: Invoice) => inv.customerName || memberName(inv.memberId) || '—'
  const paidSoFar = (inv: Invoice) =>
    payments.filter((p) => p.invoiceId === inv.id && p.status === 'paid').reduce((s, p) => s + p.amount, 0)
  const balanceOf = (inv: Invoice) => Math.max(0, inv.total - paidSoFar(inv))

  const outstanding = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return invoices
      .filter((i) => i.status === 'unpaid' || i.status === 'overdue')
      .filter((i) => !ql || i.number.toLowerCase().includes(ql) || invoiceName(i).toLowerCase().includes(ql))
      .sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, q, payments, members, users])

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
    }

    log(user?.id || 'system', 'CREATE', 'Payment', `Received ${formatGhs(amount)} on ${form.invoice.number}${fullyPaid ? ' — invoice paid' : ' — partial'}`)
    toast.success(
      fullyPaid ? 'Payment received — invoice paid' : 'Partial payment received',
      fullyPaid ? `${form.invoice.number} settled in full.` : `${formatGhsExact(balance - amount)} still due on ${form.invoice.number}.`,
    )
    setForm(null)
  }

  const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', sortValue: (i) => i.number, render: (i) => <span className="font-mono text-sm font-semibold">{i.number}</span> },
    { key: 'who', header: 'Customer / Member', sortValue: (i) => invoiceName(i), render: (i) => <span className="font-semibold">{invoiceName(i)}</span> },
    { key: 'issued', header: 'Issued', sortValue: (i) => i.issuedAt, render: (i) => <span className="text-mist">{formatDate(i.issuedAt)}</span> },
    { key: 'due', header: 'Due', sortValue: (i) => i.dueAt, render: (i) => <span className="text-mist">{formatDate(i.dueAt)}</span> },
    { key: 'total', header: 'Total', sortValue: (i) => i.total, align: 'right', render: (i) => formatGhsExact(i.total) },
    { key: 'balance', header: 'Balance Due', sortValue: (i) => balanceOf(i), align: 'right', render: (i) => <span className="font-semibold">{formatGhsExact(balanceOf(i))}</span> },
    { key: 'status', header: 'Status', sortValue: (i) => i.status, render: (i) => <Badge tone={i.status === 'overdue' ? 'rose' : 'zinc'}>{i.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (i) => canReceive ? (
        <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => openReceive(i)}>
          <Banknote className="size-4" /> Receive
        </Button>
      ) : null,
    },
  ]

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

      <div className="mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search invoice number or customer…" className="w-full max-w-sm" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Outstanding Invoices <span className="ml-1 text-xs font-normal text-mist">({outstanding.length})</span></p>
        </div>
        <DataTable columns={columns} data={outstanding} rowKey={(i) => i.id} emptyTitle="Nothing outstanding" emptyDesc="All invoices are settled. 🎉" />
      </div>

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
