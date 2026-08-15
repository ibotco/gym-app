import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { PageHeader, Button, SearchInput, Select, StatusBadge, Modal, Field } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { downloadText, formatGhsExact, formatDate, toCsv } from '../../lib/utils'
import { copyPaystackLink, PaystackPayButton } from '../../components/PaystackCheckout'
import { isPaystackEnabled, isPaystackLive, methodLabel, refundPaystack } from '../../lib/paystack'
import type { Payment, PaymentMethod } from '../../types'

export function Payments() {
  const { payments, invoices, users, members, refundPayment, settlePayment, notify, upsertPayment } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [st, setSt] = useState('all')
  const [inv, setInv] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [method, setMethod] = useState<PaymentMethod>('momo')

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
          <Button variant="outline" onClick={() => {
            downloadText('payments.csv', toCsv(rows.map((p) => ({ ...p, member: nameOf(p.memberId) }))))
            toast.success('Exported')
          }}><Download className="size-4" /> Export</Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} />
        <Select value={st} onChange={(e) => setSt(e.target.value)} className="w-40">
          <option value="all">All</option>
          {['paid', 'pending', 'failed', 'refunded'].map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Member</th><th>Description</th><th>Method</th><th>Amount</th><th>Status</th><th></th></tr></thead>
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
                      {isPaystackEnabled() && (
                        <PaystackPayButton
                          payment={p}
                          email={memberUserOf(p.memberId)?.email || ''}
                          name={nameOf(p.memberId)}
                          phone={memberUserOf(p.memberId)?.phone}
                          returnTo="/admin/payments"
                          label="Collect Paystack"
                        />
                      )}
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
            <p>Bill to: {nameOf(invoice.memberId)}</p>
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
