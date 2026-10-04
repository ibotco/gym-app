import { useState } from 'react'
import { Button, Modal } from './ui'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { formatGhsExact } from '../lib/utils'
import { gatewayLabel } from '../lib/payments'
import { getPaystackSettings, makePaystackReference } from '../lib/paystack'
import { PaystackPayButton } from './PaystackCheckout'
import {
  buildPayazaCheckoutUrl,
  getPayazaSettings,
  makePayazaReference,
  savePendingPayaza,
} from '../lib/payaza'
import {
  FLUTTERWAVE_ID, STRIPE_ID, PAYPAL_ID, HUBTEL_ID,
  FLUTTERWAVE_PENDING_KEY, STRIPE_PENDING_KEY, PAYPAL_PENDING_KEY, HUBTEL_PENDING_KEY,
  getFlutterwaveSettings, getStripeSettings, getPaypalSettings, getHubtelSettings,
  savePending, makeReference,
} from '../lib/gateways'
import type { Payment, PaymentMethod } from '../types'

/**
 * A gateway-aware pay button. Paystack uses the real/demo Paystack checkout;
 * other gateways (Stripe, PayPal, MoMo) are simulated in the demo build and
 * record the charge the same way, clearly labelled.
 */
export function GatewayPayButton({
  payment,
  email,
  name,
  phone,
  returnTo,
  label,
  size = 'sm',
  onDone,
}: {
  payment: Payment
  email: string
  name?: string
  phone?: string
  returnTo?: string
  label?: string
  size?: 'sm' | 'md'
  onDone?: (r: { ok: boolean; settled?: boolean; reference?: string; demo?: boolean }) => void
}) {
  const app = useApp()
  const toast = useToast()
  const gateway = payment.method as PaymentMethod
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'cancelled') return null

  if (gateway === 'paystack') {
    return (
      <PaystackPayButton
        payment={payment}
        email={email}
        name={name}
        phone={phone}
        returnTo={returnTo}
        label={label || 'Pay with Paystack'}
        size={size}
        onDone={onDone}
      />
    )
  }

  if (gateway === 'payaza') {
    return (
      <PayazaPayButton
        payment={payment}
        email={email}
        name={name}
        phone={phone}
        returnTo={returnTo}
        label={label}
        size={size}
        onDone={onDone}
      />
    )
  }

  if (gateway === 'flutterwave' || gateway === 'stripe' || gateway === 'paypal') {
    return (
      <HostedGatewayPayButton
        payment={payment}
        email={email}
        name={name}
        phone={phone}
        returnTo={returnTo}
        label={label}
        size={size}
        onDone={onDone}
      />
    )
  }

  if (gateway === 'hubtel') {
    return (
      <HubtelPayButton
        payment={payment}
        email={email}
        name={name}
        phone={phone}
        returnTo={returnTo}
        label={label}
        size={size}
        onDone={onDone}
      />
    )
  }

  const confirm = () => {
    setBusy(true)
    const reference = `DEMO${makePaystackReference(payment.id)}`.slice(0, 32)
    const settings = getPaystackSettings()
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: gateway,
      reference,
      gatewayRef: `demo_${Date.now()}`,
      gatewayChannel: gateway === 'momo' ? 'mobile_money' : undefined,
      autoSettle: settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    setBusy(false)
    setOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the payment')
      onDone?.({ ok: false, reference, demo: true })
      return
    }
    toast.success(
      r.settled ? `${gatewayLabel(gateway)} payment recorded` : 'Charge captured',
      'This is a simulated payment — no real money moved.',
    )
    onDone?.({ ok: true, settled: r.settled, reference, demo: true })
  }

  return (
    <>
      <Button size={size} variant="soft" disabled={busy} onClick={() => setOpen(true)}>
        {busy ? 'Processing…' : label || `Pay with ${gatewayLabel(gateway)}`}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${gatewayLabel(gateway)} checkout (demo)`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">{payment.description}</p>
            <p className="stat-num mt-2 text-3xl">{formatGhsExact(payment.amount)}</p>
          </div>
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs">
            Demo only — {gatewayLabel(gateway)} is not wired to a live account in this build. No real money moves.
            Configure the gateway to take live payments.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirm}>Pay {formatGhsExact(payment.amount)}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function PayazaPayButton({
  payment,
  email,
  name,
  phone,
  returnTo,
  label,
  size = 'sm',
  onDone,
}: {
  payment: Payment
  email: string
  name?: string
  phone?: string
  returnTo?: string
  label?: string
  size?: 'sm' | 'md'
  onDone?: (r: { ok: boolean; settled?: boolean; reference?: string; demo?: boolean }) => void
}) {
  const app = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'cancelled') return null

  const start = () => {
    if (!email || !email.includes('@')) {
      toast.error('A valid email is required for Payaza.')
      return
    }
    const settings = getPayazaSettings()
    if (settings?.liveReady) {
      const reference = makePayazaReference(payment.id)
      const dest = returnTo || `${window.location.pathname}${window.location.search}`
      savePendingPayaza({
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        memberId: payment.memberId,
        amount: payment.amount,
        reference,
        email,
        returnTo: dest,
        description: payment.description,
      })
      app.upsertPayment({ ...payment, method: 'payaza', reference })
      const url = buildPayazaCheckoutUrl({
        publicKey: settings.publicKey,
        connectionMode: settings.connectionMode,
        amount: payment.amount,
        currency: settings.currency,
        email,
        reference,
        name,
        phone,
        redirectUrl: settings.callbackUrl,
      })
      window.location.assign(url)
      return
    }
    setOpen(true)
  }

  const confirmDemo = () => {
    setBusy(true)
    const reference = `DEMO${makePayazaReference(payment.id)}`.slice(0, 32)
    const settings = getPayazaSettings()
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: 'payaza',
      reference,
      gatewayRef: `demo_${Date.now()}`,
      gatewayChannel: 'card',
      autoSettle: settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    setBusy(false)
    setOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the payment')
      onDone?.({ ok: false, reference, demo: true })
      return
    }
    toast.success(
      r.settled ? 'Payaza payment recorded' : 'Charge captured',
      'This is a simulated payment — no real money moved.',
    )
    onDone?.({ ok: true, settled: r.settled, reference, demo: true })
  }

  return (
    <>
      <Button size={size} variant="soft" disabled={busy} onClick={start}>
        {busy ? 'Opening Payaza…' : label || 'Pay with Payaza'}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Payaza checkout (demo)">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">{payment.description}</p>
            <p className="stat-num mt-2 text-3xl">{formatGhsExact(payment.amount)}</p>
          </div>
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs">
            Demo only — no card is charged. Add your Payaza public API key in Integrations → Payaza to redirect members to the real hosted checkout.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmDemo}>Pay {formatGhsExact(payment.amount)}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

type HostedProps = {
  payment: Payment
  email: string
  name?: string
  phone?: string
  returnTo?: string
  label?: string
  size?: 'sm' | 'md'
  onDone?: (r: { ok: boolean; settled?: boolean; reference?: string; demo?: boolean }) => void
}

/** Flutterwave / Stripe / PayPal — hosted checkout via server, then redirect. */
function HostedGatewayPayButton(props: HostedProps) {
  const { payment, email, name, phone, returnTo, label, size = 'sm', onDone } = props
  const app = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const gateway = payment.method as PaymentMethod
  const gLabel = gatewayLabel(gateway)

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'cancelled') return null

  const config = () => {
    if (gateway === 'flutterwave') {
      const s = getFlutterwaveSettings()
      return { id: FLUTTERWAVE_ID, key: 'flutterwave', pendingKey: FLUTTERWAVE_PENDING_KEY, settings: s, prefix: 'FLW' }
    }
    if (gateway === 'stripe') {
      const s = getStripeSettings()
      return { id: STRIPE_ID, key: 'stripe', pendingKey: STRIPE_PENDING_KEY, settings: s, prefix: 'STR' }
    }
    const s = getPaypalSettings()
    return { id: PAYPAL_ID, key: 'paypal', pendingKey: PAYPAL_PENDING_KEY, settings: s, prefix: 'PPL' }
  }

  const start = async () => {
    if (!email || !email.includes('@')) {
      toast.error(`A valid email is required for ${gLabel}.`)
      return
    }
    const c = config()
    if (!c.settings?.liveReady) {
      setOpen(true)
      return
    }
    setBusy(true)
    const reference = makeReference(c.prefix, payment.id)
    const dest = returnTo || `${window.location.pathname}${window.location.search}`
    const base = { action: 'init', secretKey: c.settings.secretKey, clientId: c.settings.apiKey, clientSecret: c.settings.secretKey }
    const body: Record<string, unknown> = {
      ...base,
      email,
      amount: payment.amount,
      currency: c.settings.currency,
      description: payment.description,
      name,
      phone,
      reference,
      returnUrl: `${window.location.origin}/pay/${c.key}?next=${encodeURIComponent(dest)}`,
      cancelUrl: `${window.location.origin}/pay/${c.key}?cancelled=1`,
    }
    // Normalise action names per provider.
    if (c.key === 'flutterwave') body.action = 'initialize'
    if (c.key === 'stripe') {
      body.action = 'checkout'
      body.successUrl = body.returnUrl
      body.cancelUrl = body.cancelUrl
    }
    if (c.key === 'paypal') body.action = 'order'

    savePending(c.pendingKey, {
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      memberId: payment.memberId,
      amount: payment.amount,
      reference,
      email,
      phone,
      returnTo: dest,
      description: payment.description,
    })
    app.upsertPayment({ ...payment, method: gateway, reference })

    const r = await fetch(`/api/${c.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((res) => res.json().catch(() => ({}))) as { ok?: boolean; error?: string; authorizationUrl?: string }

    if (!r.ok || !r.authorizationUrl) {
      setBusy(false)
      toast.error(`${gLabel} checkout failed`, r.error || 'No checkout URL returned.')
      return
    }
    window.location.assign(r.authorizationUrl)
  }

  const confirmDemo = () => {
    setBusy(true)
    const c = config()
    const reference = `DEMO${makeReference(c.prefix, payment.id)}`.slice(0, 32)
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: gateway,
      reference,
      gatewayRef: `demo_${Date.now()}`,
      gatewayChannel: 'card',
      autoSettle: c.settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    setBusy(false)
    setOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the payment')
      onDone?.({ ok: false, reference, demo: true })
      return
    }
    toast.success(r.settled ? `${gLabel} payment recorded` : 'Charge captured', 'This is a simulated payment — no real money moved.')
    onDone?.({ ok: true, settled: r.settled, reference, demo: true })
  }

  return (
    <>
      <Button size={size} variant="soft" disabled={busy} onClick={() => void start()}>
        {busy ? `Opening ${gLabel}…` : label || `Pay with ${gLabel}`}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`${gLabel} checkout (demo)`}>
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">{payment.description}</p>
            <p className="stat-num mt-2 text-3xl">{formatGhsExact(payment.amount)}</p>
          </div>
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs">
            Demo only — no real money moves. Add your {gLabel} keys in Integrations to redirect members to the hosted checkout.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmDemo}>Pay {formatGhsExact(payment.amount)}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

/** Hubtel — sends a MoMo prompt to the customer's phone (or demo modal). */
function HubtelPayButton(props: HostedProps) {
  const { payment, email, name, phone, returnTo, label, size = 'sm', onDone } = props
  const app = useApp()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (payment.status === 'paid' || payment.status === 'refunded' || payment.status === 'cancelled') return null

  const start = async () => {
    const settings = getHubtelSettings()
    const hasPhone = phone && phone.replace(/[^\d]/g, '').length >= 9
    if (settings?.liveReady && hasPhone) {
      setBusy(true)
      const reference = makeReference('HUB', payment.id)
      const dest = returnTo || `${window.location.pathname}${window.location.search}`
      savePending(HUBTEL_PENDING_KEY, {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        memberId: payment.memberId,
        amount: payment.amount,
        reference,
        email,
        phone,
        returnTo: dest,
        description: payment.description,
      })
      app.upsertPayment({ ...payment, method: 'hubtel', reference })
      const r = await fetch('/api/hubtel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'receive',
          clientId: settings.apiKey,
          clientSecret: settings.secretKey,
          amount: payment.amount,
          name,
          phone,
          email,
          channel: settings.rec.config.extra.channel || 'mtn-gh',
          description: payment.description,
          callbackUrl: settings.callbackUrl,
          reference,
        }),
      }).then((res) => res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string }
      setBusy(false)
      if (!r.ok) {
        toast.error('Hubtel request failed', r.error || 'The MoMo prompt could not be sent.')
        return
      }
      toast.info('Check your phone', 'Approve the Mobile Money prompt to complete the payment.')
      onDone?.({ ok: true, settled: false, reference, demo: false })
      return
    }
    setOpen(true)
  }

  const confirmDemo = () => {
    setBusy(true)
    const settings = getHubtelSettings()
    const reference = `DEMO${makeReference('HUB', payment.id)}`.slice(0, 32)
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: 'hubtel',
      reference,
      gatewayRef: `demo_${Date.now()}`,
      gatewayChannel: 'mobile_money',
      autoSettle: settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    setBusy(false)
    setOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the payment')
      onDone?.({ ok: false, reference, demo: true })
      return
    }
    toast.success(r.settled ? 'Hubtel payment recorded' : 'Charge captured', 'This is a simulated payment — no real money moved.')
    onDone?.({ ok: true, settled: r.settled, reference, demo: true })
  }

  return (
    <>
      <Button size={size} variant="soft" disabled={busy} onClick={() => void start()}>
        {busy ? 'Sending prompt…' : label || 'Pay with Hubtel'}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Hubtel checkout (demo)">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/5 p-3 text-sm">
            <p className="font-semibold">{payment.description}</p>
            <p className="stat-num mt-2 text-3xl">{formatGhsExact(payment.amount)}</p>
          </div>
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs">
            Demo only — no real money moves. Add your Hubtel client ID and secret in Integrations to send a real MoMo prompt to the member&apos;s phone.
          </p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmDemo}>Pay {formatGhsExact(payment.amount)}</Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
