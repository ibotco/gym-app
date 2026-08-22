import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Logo } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { formatGhsExact } from '../../lib/utils'
import {
  clearPendingPaystack,
  getPaystackSettings,
  loadPendingPaystack,
  verifyPaystack,
} from '../../lib/paystack'

export function PaystackReturn() {
  const [params] = useSearchParams()
  const app = useApp()
  const { user } = useAuth()
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working')
  const [detail, setDetail] = useState('Confirming your Paystack payment…')
  const [amount, setAmount] = useState<number | null>(null)
  const [reference, setReference] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ref = params.get('reference') || params.get('trxref') || loadPendingPaystack()?.reference || ''
      setReference(ref)
      if (!ref) {
        setState('fail')
        setDetail('No Paystack reference was returned. If you paid, ask the front desk to verify the transaction.')
        return
      }
      const pending = loadPendingPaystack()
      const live = getPaystackSettings()?.liveReady
      if (!live) {
        setState('fail')
        setDetail('Paystack keys are not configured on this computer, so the charge cannot be verified.')
        return
      }
      const verified = await verifyPaystack(ref)
      if (cancelled) return
      if (!verified.ok) {
        setState('fail')
        setDetail(verified.error || 'Paystack could not verify this reference.')
        return
      }
      const data = verified.data
      if ((data?.status || '').toLowerCase() !== 'success') {
        setState('fail')
        setDetail(data?.gateway_response || 'The Paystack charge was not successful.')
        return
      }
      const paymentId = data?.metadata?.paymentId || pending?.paymentId || ''
      const memberId = data?.metadata?.memberId || pending?.memberId || ''
      const invoiceId = data?.metadata?.invoiceId || pending?.invoiceId || ''
      const ghs = typeof data?.amount === 'number' ? data.amount / 100 : pending?.amount
      if (ghs) setAmount(ghs)
      if (pending && typeof data?.amount === 'number' && data.amount !== Math.round(pending.amount * 100)) {
        setState('fail')
        setDetail('Paystack amount does not match the FitPro invoice. A manager must review this charge.')
        return
      }
      const settings = getPaystackSettings()
      const r = app.applyGatewayPayment({
        paymentId,
        method: 'paystack',
        reference: ref,
        gatewayRef: data?.id != null ? String(data.id) : undefined,
        gatewayChannel: data?.channel,
        autoSettle: settings?.autoSettle !== false,
        amount: ghs,
        memberId,
        invoiceId,
        description: (data?.metadata?.description as string) || pending?.description || 'Paystack payment',
      })
      if (!r.ok) {
        setState('fail')
        setDetail(r.error || 'Verified on Paystack, but FitPro could not attach it to an invoice.')
        return
      }
      clearPendingPaystack()
      setState('ok')
      setDetail(r.settled
        ? 'Payment received. Your invoice is marked paid and any renewal dates are updated.'
        : 'Paystack captured the charge. A manager still needs to confirm it in Payments.')
    }
    void run()
    return () => { cancelled = true }
    // applyGatewayPayment is stable enough for a one-shot return page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const home = user?.role === 'member' ? '/app/payments' : user ? '/admin/payments' : '/login'

  return (
    <div className="verify-page">
      <div className="verify-wrap">
        <div className="mb-4 flex justify-center"><Logo /></div>
        <h1 className="verify-title">{state === 'working' ? 'Talking to Paystack' : state === 'ok' ? 'Payment received' : 'Payment not confirmed'}</h1>
        <p className="verify-sub">{detail}</p>
        <div className="verify-card space-y-3 text-left">
          {amount != null && <p className="stat-num text-3xl">{formatGhsExact(amount)}</p>}
          {reference && <p className="text-xs text-mist">Reference {reference}</p>}
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
