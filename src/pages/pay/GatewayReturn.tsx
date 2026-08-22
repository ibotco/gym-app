import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Button, Logo } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { formatGhsExact } from '../../lib/utils'
import {
  FLUTTERWAVE_PENDING_KEY, STRIPE_PENDING_KEY, PAYPAL_PENDING_KEY,
  clearPending, loadPending, getFlutterwaveSettings, getStripeSettings, getPaypalSettings,
} from '../../lib/gateways'

function gatewayFromPath(pathname: string): 'flutterwave' | 'stripe' | 'paypal' | null {
  if (pathname.startsWith('/pay/flutterwave')) return 'flutterwave'
  if (pathname.startsWith('/pay/stripe')) return 'stripe'
  if (pathname.startsWith('/pay/paypal')) return 'paypal'
  return null
}

export function GatewayReturn() {
  const [params] = useSearchParams()
  const loc = useLocation()
  const app = useApp()
  const { user } = useAuth()
  const gateway = gatewayFromPath(loc.pathname)
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working')
  const [detail, setDetail] = useState('Confirming your payment…')
  const [amount, setAmount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const name = gateway || 'gateway'
      if (params.get('cancelled')) {
        setState('fail')
        setDetail('The checkout was cancelled. No payment was recorded.')
        return
      }
      if (!gateway) {
        setState('fail')
        setDetail('Unknown payment gateway.')
        return
      }

      const pendingKey = gateway === 'flutterwave' ? FLUTTERWAVE_PENDING_KEY : gateway === 'stripe' ? STRIPE_PENDING_KEY : PAYPAL_PENDING_KEY
      const pending = loadPending(pendingKey)
      if (!pending) {
        setState('fail')
        setDetail('No pending payment was found on this device. The front desk can match the reference manually.')
        return
      }
      setAmount(pending.amount)

      const settings = gateway === 'flutterwave' ? getFlutterwaveSettings() : gateway === 'stripe' ? getStripeSettings() : getPaypalSettings()

      let verified = false
      let statusOk = false
      let reference = pending.reference
      let gatewayRef: string | undefined

      try {
        if (gateway === 'flutterwave') {
          const txId = params.get('transaction_id') || params.get('tx_ref') || pending.reference
          const r = await fetch('/api/flutterwave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', secretKey: settings?.secretKey, transactionId: txId }),
          }).then((res) => res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { status?: string } }
          if (r.ok) {
            verified = true
            statusOk = (r.data?.status || '').toLowerCase() === 'successful'
            gatewayRef = txId ? String(txId) : undefined
          }
        } else if (gateway === 'stripe') {
          const sessionId = params.get('session_id')
          const r = await fetch('/api/stripe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'verify', secretKey: settings?.secretKey, sessionId }),
          }).then((res) => res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { payment_status?: string; id?: string } }
          if (r.ok && r.data) {
            verified = true
            statusOk = r.data.payment_status === 'paid'
            gatewayRef = r.data.id
          }
        } else {
          const orderId = params.get('token') || params.get('order_id')
          const r = await fetch('/api/paypal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'capture', clientId: settings?.apiKey, clientSecret: settings?.secretKey, orderId }),
          }).then((res) => res.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { status?: string; id?: string } }
          if (r.ok) {
            verified = true
            statusOk = (r.data?.status || '').toUpperCase() === 'COMPLETED'
            gatewayRef = r.data?.id
          }
        }
      } catch {
        verified = false
      }

      if (cancelled) return

      if (!verified || !statusOk) {
        // Record as captured but unconfirmed; the club verifies on the dashboard.
        const r = app.applyGatewayPayment({
          paymentId: pending.paymentId,
          method: gateway,
          reference,
          gatewayRef,
          autoSettle: false,
          amount: pending.amount,
          memberId: pending.memberId,
          invoiceId: pending.invoiceId,
          description: pending.description,
        })
        if (!r.ok) {
          setState('fail')
          setDetail(r.error || 'FitPro could not attach this payment to an invoice.')
          return
        }
        clearPending(pendingKey)
        setState('ok')
        setDetail('Payment captured. The invoice will be marked paid once the club confirms the transaction.')
        return
      }

      const r = app.applyGatewayPayment({
        paymentId: pending.paymentId,
        method: gateway,
        reference,
        gatewayRef,
        autoSettle: settings?.autoSettle !== false,
        amount: pending.amount,
        memberId: pending.memberId,
        invoiceId: pending.invoiceId,
        description: pending.description,
      })
      if (!r.ok) {
        setState('fail')
        setDetail(r.error || 'Verified, but FitPro could not attach it to an invoice.')
        return
      }
      clearPending(pendingKey)
      setState('ok')
      setDetail(r.settled
        ? 'Payment received. Your invoice is marked paid and any renewal dates are updated.'
        : 'Payment captured. A manager still needs to confirm it in Payments.')
    }
    void run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const home = user?.role === 'member' ? '/app/payments' : user ? '/admin/payments' : '/login'

  return (
    <div className="verify-page">
      <div className="verify-wrap">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <h1 className="verify-title">{state === 'working' ? 'Confirming payment' : state === 'ok' ? 'Payment submitted' : 'Payment not confirmed'}</h1>
        <p className="verify-sub">{detail}</p>
        <div className="verify-card space-y-3 text-left">
          {amount != null && <p className="stat-num text-3xl">{formatGhsExact(amount)}</p>}
          {state === 'working' && <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-lime border-t-transparent" />}
          {state !== 'working' && (
            <Button className="w-full" onClick={() => { window.location.href = home }}>
              {user?.role === 'member' ? 'Back to my invoices' : user ? 'Open payments' : 'Sign in'}
            </Button>
          )}
          <p className="text-center text-xs text-mist">
            <Link to="/" className="underline">FitPro home</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
