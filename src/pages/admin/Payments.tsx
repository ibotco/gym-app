import { useMemo, useState } from 'react'
import { Plus, CreditCard } from 'lucide-react'
import { PageHeader, Button, SearchInput, Select, StatusBadge, Modal, Field, Input } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { copyPaystackLink } from '../../components/PaystackCheckout'
import { GatewayPayButton } from '../../components/GatewayPayButton'
import { isPaystackEnabled, isPaystackLive, methodLabel, refundPaystack } from '../../lib/paystack'
import type { Payment, PaymentMethod } from '../../types'

export function Payments() {
  const { payments, invoices, users, members, refundPayment, settlePayment, notify, upsertPayment, createPayment } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const [inv, setInv] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('momo')
  const [newOpen, setNewOpen] = useState(false)
  const [npMember, setNpMember] = useState('')
  const [npDesc, setNpDesc] = useState('')
  const [npAmount, setNpAmount] = useState('')
  const [collect, setCollect] = useState<Payment | null>(null)

  const nameOf = (memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    return users.find((u) => u.id === m?.userId)?.name || memberId
  }

  const memberUserOf = (memberId: string) => {
    const m = members.find((x) => x.id === memberId)
    return users.find((u) => u.id === m?.userId)
  }

  const rows = useMemo(
    () => payments.filter((p) => {
      if (st !== 'all' && p.status !== st) return false
      const blob = `${nameOf(p.memberId)} ${p.description} ${p.invoiceId}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    }),
    [payments, q, st],
  )

  const invoice = invoices.find((i) => i.id === inv)
  const pending = payments.find((p) => p.id === confirmId)
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.total, 0)

  const openConfirm = (p: Payment) => {
    setMethod(p.method)
    setConfirmId(p.id)
  }

  const openNew = () => {
    setNpMember(members[0]?.id || '')
    setNpDesc('')
    setNpAmount('')
    setNewOpen(true)
  }

  const submitNew = (collectOnline: boolean) => {
    if (!npMember) { toast.error('Select a member.'); return }
    const amount = Number(npAmount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount.'); return }
    const r = createPayment({
      memberId: npMember,
      amount,
      description: npDesc.trim() || 'Manual charge',
      method: collectOnline ? undefined : 'momo',
    })
    if (!r.ok) { toast.error(r.error || 'Could not create payment'); return }
    setNewOpen(false)
    if (collectOnline) {
      setCollect(r.payment!)
    } else {
      toast.success('Payment created', 'Pending — confirm receipt or collect online from the table.')
    }
  }

  const confirmPayment = () => {
    if (!pending) return
    upsertPayment({ ...pending, method })
    const r = settlePayment(pending.id)
    if (!r.ok) {
      toast.error(r.error || 'Could not confirm payment')
      return
    }
    const memberUser = memberUserOf(pending.memberId)
    if (memberUser) {
      notify({
        userId: memberUser.id,
        title: 'Payment confirmed',
        message: `${pending.description} (${formatGhsExact(pending.amount)}) was confirmed by ${user?.name || 'admin'}.`,
        channel: 'in-app',
      })
    }
    setConfirmId(null)
    toast.success('Payment confirmed', 'Invoice marked paid and membership updated if this was a renewal.')
  }

  return (
    <div>
      <PageHeader
        title="Payments & invoices"
        desc={`Outstanding ${formatGhsExact(outstanding)} · Confirm cash / desk MoMo, or collect with Paystack.`}
        actions={
          <>
            <Button onClick={openNew}><Plus className="size-4" /> New payment</Button>
            <ExportButtons filename="payments" rows={rows.map((p) => ({ ...p, member: nameOf(p.memberId) }))} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} />
        <Select value={st} onChange={(e) => setSt(e.target.value)} className="w-40">
          <option value="all">All</option>
          {['paid', 'pending', 'failed', 'refunded', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Member</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th><th>ACTIONS</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="text-mist">{formatDate(p.date)}</td>
                <td className="font-semibold">{nameOf(p.memberId)}</td>
                <td>{p.description}</td>
                <td className="text-mist">
                  {methodLabel(p.method)}
                  {p.gatewayChannel && <span className="block text-[11px]">{p.gatewayChannel}</span>}
                </td>
                <td>{formatGhsExact(p.amount)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="space-x-2">
                  <Button size="sm" variant="ghost" onClick={() => setInv(p.invoiceId)}>Invoice</Button>
                  {(p.status === 'pending' || p.status === 'failed') && (
                    <>
                      <Button size="sm" onClick={() => openConfirm(p)}>Confirm payment</Button>
                      <GatewayPayButton
                        payment={p}
                        email={memberUserOf(p.memberId)?.email || ''}
                        name={nameOf(p.memberId)}
                        phone={memberUserOf(p.memberId)?.phone}
                        returnTo="/admin/payments"
                        label="Collect online"
                      />
                    </>
                  )}
                  {p.status === 'paid' && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      if (p.method === 'paystack' && p.reference && isPaystackLive()) {
                        const r = await refundPaystack(p.reference)
                        if (!r.ok) {
                          toast.error('Paystack refund failed', r.error)
                          return
                        }
                      }
                      refundPayment(p.id)
                      toast.info('Refund recorded')
                    }}>Refund</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New payment">
        <div className="space-y-3">
          <Field label="Member" required>
            <Select value={npMember} onChange={(e) => setNpMember(e.target.value)}>
              {members.map((m) => {
                const u = users.find((x) => x.id === m.userId)
                return <option key={m.id} value={m.id}>{u?.name || m.id}</option>
              })}
            </Select>
          </Field>
          <Field label="Description"><Input value={npDesc} onChange={(e) => setNpDesc(e.target.value)} placeholder="e.g. PT session — Kojo Mensah" /></Field>
          <Field label="Amount (GHS)" required><Input type="number" value={npAmount} onChange={(e) => setNpAmount(e.target.value)} placeholder="180" /></Field>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => submitNew(false)}>Create payment</Button>
            {isPaystackEnabled() && (
              <Button onClick={() => submitNew(true)}><CreditCard className="size-4" /> Create & collect online</Button>
            )}
          </div>
          {!isPaystackEnabled() && (
            <p className="text-xs text-mist">Paystack is not enabled — payments will be recorded as pending for manual confirmation.</p>
          )}
        </div>
      </Modal>

      <Modal open={!!collect} onClose={() => setCollect(null)} title="Collect payment online">
        {collect && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{nameOf(collect.memberId)}</p>
              <p className="mt-1">{collect.description}</p>
              <p className="stat-num mt-2 text-3xl">{formatGhsExact(collect.amount)}</p>
            </div>
            <GatewayPayButton
              payment={collect}
              email={memberUserOf(collect.memberId)?.email || ''}
              name={nameOf(collect.memberId)}
              phone={memberUserOf(collect.memberId)?.phone}
              returnTo="/admin/payments"
              size="md"
              onDone={(r) => { if (r.ok) setCollect(null) }}
            />
            <p className="text-xs text-mist">Collects via the member&apos;s gateway. Demo mode records the charge without moving real money.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!pending} onClose={() => setConfirmId(null)} title="Confirm payment received">
        {pending && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{nameOf(pending.memberId)}</p>
              <p className="mt-1">{pending.description}</p>
              <p className="stat-num mt-2 text-2xl">{formatGhsExact(pending.amount)}</p>
              <p className="mt-1 text-mist">This stays unpaid until you confirm funds were received.</p>
            </div>
            <Field label="Received via">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                <option value="momo">Mobile Money</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmPayment}>Confirm payment</Button>
              <Button variant="outline" onClick={() => setConfirmId(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!inv} onClose={() => setInv(null)} title={invoice?.number || 'Invoice'}>
        {invoice && (
          <div id="invoice-print" className="space-y-3 text-sm">
            <div className="flex justify-between">
              <div>
                <p className="font-display text-lg">FitPro Gym</p>
                <p className="text-mist">Airport City, Accra · TIN C0067843210</p>
              </div>
              <StatusBadge status={invoice.status} />
            </div>
            <p>Bill to: {invoice.customerName || (invoice.memberId ? nameOf(invoice.memberId) : 'Walk-in customer')}</p>
            <p className="text-mist">Issued {formatDate(invoice.issuedAt)} · Due {formatDate(invoice.dueAt)}</p>
            <ul className="divide-y divide-line">
              {invoice.items.map((it) => (
                <li key={it.desc} className="flex justify-between py-2"><span>{it.desc}</span><span>{formatGhsExact(it.amount)}</span></li>
              ))}
            </ul>
            <p className="text-right font-display text-xl">Total {formatGhsExact(invoice.total)}</p>
            {invoice.status !== 'paid' && (
              <Button className="no-print w-full" onClick={() => {
                const p = payments.find((x) => x.invoiceId === invoice.id && x.status !== 'paid' && x.status !== 'refunded')
                if (p) { setInv(null); openConfirm(p) }
              }}>Confirm payment</Button>
            )}
            <Button className="no-print w-full" variant="outline" onClick={() => window.print()}>Print / PDF</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
