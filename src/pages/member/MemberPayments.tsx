import { useState } from 'react'
import { PageHeader, Button, StatusBadge, Modal } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { GatewayPayButton } from '../../components/GatewayPayButton'
import { isPaystackEnabled, methodLabel } from '../../lib/paystack'
import { CreditCard, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Invoice, Payment } from '../../types'

export function MemberPayments() {
  const { user } = useAuth()
  const { members, memberships, plans, payments, invoices, users, createPayment, requestMembershipRenewal, cancelPayment, notify } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const ms = memberships.find((x) => x.id === m?.membershipId)
  const currentPlan = plans.find((p) => p.id === (ms?.planId || m?.planId))
  const mine = payments.filter((p) => p.memberId === m?.id)
  const inv = invoices.filter((i) => i.memberId === m?.id)
  const paystackOn = isPaystackEnabled()
  const [paying, setPaying] = useState<Payment | null>(null)
  const [cancelling, setCancelling] = useState<Payment | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const [renewPlanId, setRenewPlanId] = useState('')

  const openRenew = () => {
    if (!m) return
    setRenewPlanId(currentPlan?.id || plans[0]?.id || '')
    setRenewOpen(true)
  }

  const confirmRenewal = () => {
    if (!m) return
    const r = requestMembershipRenewal(m.id, renewPlanId || undefined)
    setRenewOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not create renewal invoice')
      return
    }
    const p = payments.find((x) => x.id === r.paymentId)
    if (paystackOn && p) {
      setPaying(p)
      return
    }
    users
      .filter((u) => u.role === 'super_admin' || u.role === 'gym_manager' || u.role === 'staff')
      .forEach((admin) => {
        notify({
          userId: admin.id,
          title: 'Renewal awaiting confirmation',
          message: `${user?.name} requested a membership renewal. Confirm payment in Payments.`,
          channel: 'in-app',
        })
      })
    toast.info('Renewal requested', 'Status stays unpaid until an admin confirms payment.')
  }

  const payInvoice = (invoice: Invoice) => {
    if (!m) return
    // Reuse an existing unpaid/failed payment for this invoice, else create one.
    let pay = payments.find((p) => p.invoiceId === invoice.id && (p.status === 'pending' || p.status === 'failed'))
    if (!pay) {
      const r = createPayment({
        memberId: m.id,
        amount: invoice.total,
        description: invoice.items[0]?.desc || 'Invoice',
      })
      if (!r.ok) {
        toast.error(r.error || 'Could not create payment')
        return
      }
      pay = r.payment!
    }
    setPaying(pay)
  }

  const doCancel = () => {
    if (!cancelling) return
    const r = cancelPayment(cancelling.id)
    if (!r.ok) {
      toast.error(r.error || 'Could not cancel this payment')
      setCancelling(null)
      return
    }
    toast.success('Renewal cancelled', 'The payment and its invoice were cancelled.')
    setCancelling(null)
  }

  const cancelInvoice = (invoice: Invoice) => {
    // Find a cancellable payment attached to this invoice, else cancel nothing.
    const pay = payments.find((p) => p.invoiceId === invoice.id && (p.status === 'pending' || p.status === 'failed'))
    if (pay) {
      setCancelling(pay)
      return
    }
    toast.info('Nothing to cancel', 'This invoice has no pending payment.')
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        desc={paystackOn
          ? 'Pay online with Paystack (card or Mobile Money), or ask the desk to confirm a cash receipt.'
          : 'Request a renewal and download invoices. Only club staff can confirm that money was received.'}
        actions={
          <>
            <Button variant="outline" onClick={openRenew}>Renew membership</Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">History</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {mine.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-white/5 py-2">
                <span>
                  {p.description}
                  <br />
                  <span className="text-xs text-mist">{formatDate(p.date)} · {methodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ''}</span>
                </span>
                <span className="flex flex-col items-end gap-2">
                  <span className="flex items-center gap-2">
                    {formatGhsExact(p.amount)} <StatusBadge status={p.status} />
                  </span>
                  {(p.status === 'pending' || p.status === 'failed') && user && (
                    <span className="flex items-center gap-2">
                      <GatewayPayButton
                        payment={p}
                        email={user.email}
                        name={user.name}
                        phone={user.phone}
                        returnTo="/app/payments"
                      />
                      <Button size="sm" variant="ghost" onClick={() => setCancelling(p)} title="Cancel this renewal">
                        <XCircle className="size-4" /> Cancel
                      </Button>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Invoices</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {inv.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 border-b border-white/5 py-2">
                <span>{i.number} · {formatGhsExact(i.total)}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  {(i.status === 'unpaid' || i.status === 'overdue') && (
                    <>
                      {paystackOn && (
                        <Button size="sm" variant="soft" onClick={() => payInvoice(i)}>
                          <CreditCard className="size-4" /> Pay now
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => cancelInvoice(i)} title="Cancel this invoice">
                        <XCircle className="size-4" />
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => window.print()}>PDF</Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">How payment works</p>
            <p className="mt-1 text-mist">
              {paystackOn
                ? 'Pay any outstanding invoice here with Paystack (Visa, Mastercard, or MTN / Telecel / AirtelTigo MoMo). A verified charge marks the invoice paid. Cash at the desk still needs a staff confirmation.'
                : 'Renew membership creates an unpaid invoice. Front desk or finance confirms the MoMo, card, or cash receipt. Your plan dates update only after that confirmation.'}
            </p>
          </div>
        </div>
      </div>

      {/* Choose renewal plan */}
      <Modal open={renewOpen} onClose={() => setRenewOpen(false)} title="Renew membership">
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Your current plan is <span className="font-semibold text-inherit">{currentPlan?.name || '—'}</span>.
            Pick a plan to renew into — you can switch to a different membership type.
          </p>
          <div className="space-y-2">
            {plans.filter((p) => p.active).map((p) => {
              const isCurrent = p.id === currentPlan?.id
              const selected = renewPlanId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setRenewPlanId(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition',
                    selected ? 'border-lime bg-lime/10 ring-1 ring-lime' : 'border-line hover:border-lime/40',
                  )}
                >
                  <span>
                    <span className="block font-semibold">
                      {p.name}
                      {isCurrent && <span className="ml-2 text-[11px] font-semibold text-lime">Current</span>}
                    </span>
                    <span className="block text-xs text-mist">{p.durationDays} days · {p.type.replace(/-/g, ' ')}</span>
                  </span>
                  <span className="font-display text-lg">{formatGhsExact(p.price)}</span>
                </button>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancel</Button>
            <Button onClick={confirmRenewal} disabled={!renewPlanId}>Continue</Button>
          </div>
        </div>
      </Modal>

      {/* One-click online payment modal */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Make a payment">
        {paying && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{paying.description}</p>
              <p className="stat-num mt-2 text-3xl">{formatGhsExact(paying.amount)}</p>
              <p className="mt-1 text-mist">Invoice {paying.invoiceId}</p>
            </div>
            {user ? (
              <GatewayPayButton
                payment={paying}
                email={user.email}
                name={user.name}
                phone={user.phone}
                returnTo="/app/payments"
                size="md"
                onDone={(r) => { if (r.ok) setPaying(null) }}
              />
            ) : (
              <p className="text-sm text-mist">Sign in to pay.</p>
            )}
            <p className="text-xs text-mist">Pay with your club&apos;s default gateway. Demo mode records the payment without moving real money.</p>
          </div>
        )}
      </Modal>

      {/* Cancel renewal confirmation */}
      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title="Cancel renewal?">
        {cancelling && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 p-3 text-sm">
              <p className="font-semibold">{cancelling.description}</p>
              <p className="stat-num mt-2 text-3xl">{formatGhsExact(cancelling.amount)}</p>
              <p className="mt-1 text-mist">{cancelling.status === 'failed' ? 'This payment failed and can be safely cancelled.' : 'This payment has not been confirmed or paid yet.'}</p>
            </div>
            <p className="text-sm text-mist">
              Cancelling marks the payment and its invoice as cancelled. Your membership stays as it is — nothing is renewed.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelling(null)}>Keep it</Button>
              <Button variant="danger" onClick={doCancel}>Cancel renewal</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
