import { useState } from 'react'
import { Button, Field, Input, Modal, Select } from './ui'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { formatGhsExact } from '../lib/utils'
import {
  clearPendingPaystack,
  defaultCallbackUrl,
  getPaystackSettings,
  initializePaystack,
  isPaystackEnabled,
  isPaystackLive,
  loadPaystackJs,
  makePaystackReference,
  savePendingPaystack,
  verifyPaystack,
} from '../lib/paystack'
import type { Payment } from '../types'

const DEMO_CHANNELS = [
  { id: 'card', label: 'Card' },
  { id: 'mtn', label: 'MTN MoMo' },
  { id: 'telecel', label: 'Telecel Cash' },
  { id: 'at', label: 'AirtelTigo Money' },
]

export function PaystackPayButton({
  payment,
  email,
  name,
  phone,
  label = 'Pay with Paystack',
  returnTo,
  size = 'sm',
  onDone,
}: {
  payment: Payment
  email: string
  name?: string
  phone?: string
  label?: string
  returnTo?: string
  size?: 'sm' | 'md'
  onDone?: (r: { ok: boolean; settled?: boolean; reference?: string; demo?: boolean }) => void
}) {
  const app = useApp()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoChannel, setDemoChannel] = useState('mtn')
  const [demoPhone, setDemoPhone] = useState(phone || '')

  if (!isPaystackEnabled()) return null
  if (payment.status === 'paid' || payment.status === 'refunded') return null

  const go = async () => {
    if (!email || !email.includes('@')) {
      toast.error('A valid email is required for Paystack.')
      return
    }
    if (isPaystackLive()) {
      await startLive()
      return
    }
    setDemoOpen(true)
  }

  const startLive = async () => {
    const settings = getPaystackSettings()
    if (!settings?.liveReady) {
      toast.error('Paystack keys are missing.')
      return
    }
    const reference = makePaystackReference(payment.id)
    const dest = returnTo || `${window.location.pathname}${window.location.search}`
    savePendingPaystack({
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      memberId: payment.memberId,
      amount: payment.amount,
      reference,
      email,
      returnTo: dest,
      description: payment.description,
    })
    app.upsertPayment({ ...payment, method: 'paystack', reference })
    setBusy(true)
    try {
      if (settings.checkoutMode === 'redirect') {
        const init = await initializePaystack({
          email,
          amount: payment.amount,
          reference,
          callbackUrl: defaultCallbackUrl(),
          metadata: {
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            memberId: payment.memberId,
            description: payment.description,
            custom_fields: [
              { display_name: 'Member', variable_name: 'member', value: name || email },
              { display_name: 'Invoice', variable_name: 'invoice', value: payment.invoiceId },
            ],
          },
        })
        if (!init.ok || !init.authorizationUrl) {
          toast.error('Paystack initialize failed', !init.ok ? init.error : 'No checkout URL returned.')
          setBusy(false)
          return
        }
        window.location.assign(init.authorizationUrl)
        return
      }

      const pop = await loadPaystackJs()
      const handler = pop.setup({
        key: settings.publicKey,
        email,
        amount: Math.round(payment.amount * 100),
        currency: settings.currency,
        ref: reference,
        channels: settings.channels,
        metadata: {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          memberId: payment.memberId,
          description: payment.description,
          custom_fields: [
            { display_name: 'Member', variable_name: 'member', value: name || email },
            { display_name: 'Invoice', variable_name: 'invoice', value: payment.invoiceId },
          ],
        },
        callback: (resp) => {
          void finishLive(resp.reference)
        },
        onClose: () => {
          setBusy(false)
          toast.info('Paystack checkout closed', 'No charge was completed.')
        },
      })
      handler.openIframe()
    } catch (e) {
      setBusy(false)
      toast.error('Paystack checkout failed', e instanceof Error ? e.message : 'Unknown error')
    }
  }

  const finishLive = async (reference: string) => {
    const verified = await verifyPaystack(reference)
    if (!verified.ok) {
      setBusy(false)
      toast.error('Paystack could not verify the charge', verified.error)
      onDone?.({ ok: false, reference })
      return
    }
    const data = verified.data
    if ((data?.status || '').toLowerCase() !== 'success') {
      setBusy(false)
      toast.error('Payment not successful', data?.gateway_response || data?.status || 'Declined')
      onDone?.({ ok: false, reference })
      return
    }
    const expected = Math.round(payment.amount * 100)
    if (typeof data?.amount === 'number' && data.amount !== expected) {
      setBusy(false)
      toast.error('Amount mismatch', 'Paystack amount does not match this invoice. Staff must review it.')
      onDone?.({ ok: false, reference })
      return
    }
    const settings = getPaystackSettings()
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: 'paystack',
      reference,
      gatewayRef: data?.id != null ? String(data.id) : undefined,
      gatewayChannel: data?.channel,
      autoSettle: settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    clearPendingPaystack()
    setBusy(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the Paystack payment')
      onDone?.({ ok: false, reference })
      return
    }
    toast.success(
      r.settled ? 'Paystack payment received' : 'Paystack charge captured',
      r.settled ? 'Invoice marked paid.' : 'Waiting for a manager to confirm in Payments.',
    )
    onDone?.({ ok: true, settled: r.settled, reference })
  }

  const finishDemo = () => {
    const reference = `DEMO${makePaystackReference(payment.id)}`.slice(0, 32)
    const channel = demoChannel === 'card' ? 'card' : 'mobile_money'
    const settings = getPaystackSettings()
    const r = app.applyGatewayPayment({
      paymentId: payment.id,
      method: 'paystack',
      reference,
      gatewayRef: `demo_${Date.now()}`,
      gatewayChannel: channel,
      autoSettle: settings?.autoSettle !== false,
      amount: payment.amount,
      memberId: payment.memberId,
      invoiceId: payment.invoiceId,
      description: payment.description,
    })
    setDemoOpen(false)
    if (!r.ok) {
      toast.error(r.error || 'Could not record the demo payment')
      onDone?.({ ok: false, reference, demo: true })
      return
    }
    toast.success(
      r.settled ? 'Demo Paystack payment recorded' : 'Demo charge captured',
      'No real money moved. Add live keys in Integrations → Paystack to collect GHS.',
    )
    onDone?.({ ok: true, settled: r.settled, reference, demo: true })
  }

  return (
    <>
      <Button size={size} variant="soft" disabled={busy} onClick={() => void go()}>
        {busy ? 'Opening Paystack…' : label}
      </Button>
      <Modal open={demoOpen} onClose={() => setDemoOpen(false)} title="Paystack checkout (demo)">
        <div className="psk-demo">
          <div className="psk-demo-head">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">FitPro · Paystack</p>
            <p className="stat-num mt-1 text-3xl">{formatGhsExact(payment.amount)}</p>
            <p className="mt-1 text-sm text-mist">{payment.description}</p>
          </div>
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs">
            Demo only — no card is charged. Save a <b>pk_test_</b> and <b>sk_test_</b> key in Integrations → Paystack to take live test payments.
          </p>
          <Field label="Pay with">
            <Select value={demoChannel} onChange={(e) => setDemoChannel(e.target.value)}>
              {DEMO_CHANNELS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          {demoChannel !== 'card' && (
            <Field label="MoMo number">
              <Input value={demoPhone} onChange={(e) => setDemoPhone(e.target.value)} placeholder="024 555 0101" />
            </Field>
          )}
          {demoChannel === 'card' && (
            <Field label="Card">
              <Input value="4084 0840 8408 4081" readOnly />
            </Field>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={finishDemo}>Pay {formatGhsExact(payment.amount)}</Button>
            <Button variant="outline" onClick={() => setDemoOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export async function copyPaystackLink(opts: {
  payment: Payment
  email: string
  name?: string
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isPaystackLive()) {
    return { ok: false, error: 'Add live or test Paystack keys to generate a hosted checkout link.' }
  }
  const reference = makePaystackReference(opts.payment.id)
  savePendingPaystack({
    paymentId: opts.payment.id,
    invoiceId: opts.payment.invoiceId,
    memberId: opts.payment.memberId,
    amount: opts.payment.amount,
    reference,
    email: opts.email,
    returnTo: '/admin/payments',
    description: opts.payment.description,
  })
  const init = await initializePaystack({
    email: opts.email,
    amount: opts.payment.amount,
    reference,
    callbackUrl: defaultCallbackUrl(),
    metadata: {
      paymentId: opts.payment.id,
      invoiceId: opts.payment.invoiceId,
      memberId: opts.payment.memberId,
      description: opts.payment.description,
      custom_fields: [
        { display_name: 'Member', variable_name: 'member', value: opts.name || opts.email },
      ],
    },
  })
  if (!init.ok || !init.authorizationUrl) {
    return { ok: false, error: !init.ok ? init.error : 'Paystack did not return a checkout URL.' }
  }
  try {
    await navigator.clipboard.writeText(init.authorizationUrl)
  } catch { /* ignore clipboard */ }
  return { ok: true, url: init.authorizationUrl }
}
