import { PageHeader, Button, StatusBadge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../lib/utils'
import { PaystackPayButton } from '../../components/PaystackCheckout'
import { isPaystackEnabled, methodLabel } from '../../lib/paystack'

export function MemberPayments() {
  const { user } = useAuth()
  const { members, payments, invoices, users, requestMembershipRenewal, notify } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const mine = payments.filter((p) => p.memberId === m?.id)
  const inv = invoices.filter((i) => i.memberId === m?.id)
  const paystackOn = isPaystackEnabled()

  const requestRenewal = () => {
    if (!m) return
    const r = requestMembershipRenewal(m.id)
    if (!r.ok) {
      toast.error(r.error || 'Could not create renewal invoice')
      return
    }
    users
      .filter((u) => u.role === 'super_admin' || u.role === 'gym_manager' || u.role === 'staff')
      .forEach((admin) => {
        notify({
          userId: admin.id,
          title: 'Renewal awaiting confirmation',
          message: `${user?.name} requested a membership renewal.${paystackOn ? ' They can pay with Paystack, or you can confirm in Payments.' : ' Confirm payment in Payments.'}`,
          channel: 'in-app',
        })
      })
    toast.info('Renewal requested', paystackOn
      ? 'Pay the unpaid invoice with Paystack, or wait for the front desk to confirm cash / MoMo.'
      : 'Status stays unpaid until an admin confirms payment.')
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        desc={paystackOn
          ? 'Renew online with Paystack (card or Mobile Money), or ask the desk to confirm a cash receipt.'
          : 'Request a renewal and download invoices. Only club staff can confirm that money was received.'}
        actions={<Button onClick={requestRenewal}>Renew membership</Button>}
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
                    <PaystackPayButton
                      payment={p}
                      email={user.email}
                      name={user.name}
                      phone={user.phone}
                      returnTo="/app/payments"
                      label="Pay with Paystack"
                    />
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
              <li key={i.id} className="flex items-center justify-between">
                <span>{i.number} · {formatGhsExact(i.total)}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={i.status} />
                  <Button size="sm" variant="ghost" onClick={() => window.print()}>PDF</Button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">How payment works</p>
            <p className="mt-1 text-mist">
              {paystackOn
                ? 'Renew membership creates an unpaid invoice. Pay it here with Paystack (Visa, Mastercard, or MTN / Telecel / AirtelTigo MoMo). A verified Paystack charge marks the invoice paid. Cash at the desk still needs a staff confirmation.'
                : 'Renew membership creates an unpaid invoice. Front desk or finance confirms the MoMo, card, or cash receipt. Your plan dates update only after that confirmation.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
