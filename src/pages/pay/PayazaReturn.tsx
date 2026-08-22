import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Logo } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { formatGhsExact } from '../../lib/utils'
import {
  clearPendingPayaza,
  getPayazaSettings,
  loadPendingPayaza,
} from '../../lib/payaza'

export function PayazaReturn() {
  const [params] = useSearchParams()
  const app = useApp()
  const { user } = useAuth()
  const [state, setState] = useState<'working' | 'ok' | 'fail'>('working')
  const [detail, setDetail] = useState('Confirming your Payaza payment…')
  const [amount, setAmount] = useState<number | null>(null)
  const [reference, setReference] = useState('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const ref = params.get('transaction_reference') || params.get('reference') || loadPendingPayaza()?.reference || ''
      setReference(ref)
      const pending = loadPendingPayaza()
      const settings = getPayazaSettings()

      if (!ref && !pending) {
        setState('fail')
        setDetail('No Payaza reference was returned. If you paid, ask the front desk to verify the transaction.')
        return
      }
      if (!pending) {
        setState('fail')
        setDetail('No pending payment was found on this device. The front desk can match the Payaza reference manually.')
        return
      }
      if (pending.amount) setAmount(pending.amount)

      // Payaza's hosted page confirms via redirect + webhook; without a
      // live verify step here we record the charge as captured and leave
      // settlement to the webhook / front-desk confirmation.
      const r = app.applyGatewayPayment({
        paymentId: pending.paymentId,
        method: 'payaza',
        reference: ref || pending.reference,
        autoSettle: settings?.autoSettle === true && false, // never auto-settle without a verified webhook
        amount: pending.amount,
        memberId: pending.memberId,
        invoiceId: pending.invoiceId,
        description: pending.description,
      })
      if (cancelled) return
      if (!r.ok) {
        setState('fail')
        setDetail(r.error || 'FitPro could not attach this Payaza reference to an invoice.')
        return
      }
      clearPendingPayaza()
      setState('ok')
      setDetail('Thank you — your Payaza payment is being confirmed. The invoice will be marked paid once the club verifies the transaction.')
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
        <h1 className="verify-title">{state === 'working' ? 'Talking to Payaza' : state === 'ok' ? 'Payment submitted' : 'Payment not confirmed'}</h1>
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
