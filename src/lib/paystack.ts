import type { IntegrationRecord, Payment } from '../types'
import type { TestCode } from './integrations'
import { applyTest, loadIntegrations, testIntegration, unsealSecret, validateIntegration } from './integrations'

export const PAYSTACK_ID = 'int_paystack'
export const PAYSTACK_PENDING_KEY = 'fitpro_paystack_pending'
export const PAYSTACK_CHANNELS = [
  { id: 'card', label: 'Card' },
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank', label: 'Bank' },
  { id: 'bank_transfer', label: 'Bank transfer' },
  { id: 'ussd', label: 'USSD' },
  { id: 'qr', label: 'QR' },
] as const

export type PaystackChannel = (typeof PAYSTACK_CHANNELS)[number]['id']

export interface PaystackSettings {
  rec: IntegrationRecord
  publicKey: string
  secretKey: string
  currency: string
  channels: string[]
  checkoutMode: 'popup' | 'redirect'
  autoSettle: boolean
  allowDemo: boolean
  liveReady: boolean
  chargeBearer: string
  subaccount: string
  splitCode: string
  callbackUrl: string
}

export interface PendingPaystackTx {
  paymentId: string
  invoiceId: string
  memberId: string
  amount: number
  reference: string
  email: string
  returnTo: string
  description: string
}

export interface PaystackVerifyData {
  status?: string
  reference?: string
  amount?: number
  currency?: string
  channel?: string
  id?: number | string
  paid_at?: string
  gateway_response?: string
  customer?: { email?: string }
  metadata?: {
    paymentId?: string
    invoiceId?: string
    memberId?: string
    description?: string
    [key: string]: unknown
  }
}

type PaystackApiOk = {
  ok: true
  message: string
  authorizationUrl?: string
  accessCode?: string
  reference?: string
  data?: PaystackVerifyData
  balance?: string
}

type PaystackApiErr = { ok: false; error: string; code?: TestCode }

export type PaystackApiResult = PaystackApiOk | PaystackApiErr

type PaystackPopSetup = {
  setup: (opts: {
    key: string
    email: string
    amount: number
    currency?: string
    ref: string
    metadata?: Record<string, unknown>
    channels?: string[]
    callback: (resp: { reference: string }) => void
    onClose: () => void
  }) => { openIframe: () => void }
}

declare global {
  interface Window {
    PaystackPop?: PaystackPopSetup
  }
}

export function getPaystackRecord(): IntegrationRecord | undefined {
  return loadIntegrations().find((r) => r.id === PAYSTACK_ID)
}

export function getPaystackSettings(): PaystackSettings | null {
  const rec = getPaystackRecord()
  if (!rec) return null
  const extra = rec.config.extra || {}
  const publicKey = unsealSecret(rec.config.apiKey).trim()
  const secretKey = unsealSecret(rec.config.secretKey).trim()
  const channels = (extra.channels || 'card,mobile_money')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  return {
    rec,
    publicKey,
    secretKey,
    currency: (extra.currency || 'GHS').toUpperCase(),
    channels: channels.length ? channels : ['card', 'mobile_money'],
    checkoutMode: extra.checkoutMode === 'redirect' ? 'redirect' : 'popup',
    autoSettle: extra.autoSettle !== 'false',
    allowDemo: extra.allowDemo !== 'false',
    liveReady: /^pk_(test|live)_/i.test(publicKey) && /^sk_(test|live)_/i.test(secretKey),
    chargeBearer: extra.chargeBearer || 'account',
    subaccount: extra.subaccount || '',
    splitCode: extra.splitCode || '',
    callbackUrl: rec.config.callbackUrl || defaultCallbackUrl(),
  }
}

export function isPaystackEnabled() {
  const s = getPaystackSettings()
  if (!s || !s.rec.active) return false
  return s.liveReady || s.allowDemo
}

export function isPaystackLive() {
  const s = getPaystackSettings()
  return !!(s && s.rec.active && s.liveReady)
}

export function defaultCallbackUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/pay/paystack'
  return `${window.location.origin}/pay/paystack`
}

export function toPesewas(amountGhs: number) {
  return Math.round(Number(amountGhs) * 100)
}

export function makePaystackReference(paymentId: string) {
  const clean = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-18)
  return `FP${clean}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
}

export function savePendingPaystack(tx: PendingPaystackTx) {
  try { sessionStorage.setItem(PAYSTACK_PENDING_KEY, JSON.stringify(tx)) } catch { /* ignore */ }
  try { localStorage.setItem(PAYSTACK_PENDING_KEY, JSON.stringify(tx)) } catch { /* ignore */ }
}

export function loadPendingPaystack(): PendingPaystackTx | null {
  try {
    const raw = sessionStorage.getItem(PAYSTACK_PENDING_KEY) || localStorage.getItem(PAYSTACK_PENDING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingPaystackTx
  } catch {
    return null
  }
}

export function clearPendingPaystack() {
  try { sessionStorage.removeItem(PAYSTACK_PENDING_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(PAYSTACK_PENDING_KEY) } catch { /* ignore */ }
}

async function callPaystackApi(body: Record<string, unknown>): Promise<PaystackApiResult> {
  try {
    const r = await fetch('/api/paystack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({})) as PaystackApiResult & { error?: string }
    if (!r.ok || !data.ok) {
      return { ok: false, error: data.error || `Paystack ${r.status}`, code: mapPaystackError(data.error || '') }
    }
    return data
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach the FitPro Paystack helper. Stop then Start FitPro.', code: 'Service Unavailable' }
  }
}

function mapPaystackError(msg: string): TestCode {
  const m = msg.toLowerCase()
  if (m.includes('invalid') || m.includes('key') || m.includes('401') || m.includes('forbidden')) return 'Invalid API Key'
  if (m.includes('expired') || m.includes('token')) return 'Expired Token'
  if (m.includes('timeout') || m.includes('timed out')) return 'Connection Timeout'
  if (m.includes('503') || m.includes('unavailable') || m.includes('network')) return 'Service Unavailable'
  return 'Configuration Error'
}

export async function testPaystackConnection(rec?: IntegrationRecord) {
  const row = rec || getPaystackRecord()
  if (!row) {
    return { ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'Paystack is not in the catalogue.' }
  }
  const started = Date.now()
  const simulated = testIntegration(row)
  if (!simulated.ok) return simulated
  const sk = unsealSecret(row.config.secretKey)
  if (!sk) {
    return {
      ok: true,
      code: 'Authentication Successful' as TestCode,
      ms: Date.now() - started,
      detail: 'Demo mode. Add a sk_test_ or sk_live_ key to test the live Paystack API.',
    }
  }
  const result = await callPaystackApi({ action: 'test', secretKey: sk })
  const ms = Date.now() - started
  if (!result.ok) {
    return { ok: false, code: result.code || 'Invalid API Key' as TestCode, ms, detail: result.error }
  }
  return {
    ok: true,
    code: 'Authentication Successful' as TestCode,
    ms,
    detail: result.balance ? `Paystack accepted the secret key. ${result.balance}` : result.message || 'Paystack accepted the secret key.',
  }
}

export function applyPaystackTest(rec: IntegrationRecord, result: Awaited<ReturnType<typeof testPaystackConnection>>) {
  return applyTest(rec, result)
}

export async function initializePaystack(input: {
  email: string
  amount: number
  reference: string
  callbackUrl?: string
  metadata?: Record<string, unknown>
  payment?: Payment
}) {
  const s = getPaystackSettings()
  if (!s?.liveReady) return { ok: false as const, error: 'Paystack keys are not configured.' }
  const v = validateIntegration(s.rec)
  if (!v.ok) return { ok: false as const, error: v.error || 'Invalid Paystack configuration.' }
  return callPaystackApi({
    action: 'initialize',
    secretKey: s.secretKey,
    email: input.email,
    amount: toPesewas(input.amount),
    currency: s.currency,
    reference: input.reference,
    callbackUrl: input.callbackUrl || defaultCallbackUrl(),
    metadata: input.metadata,
    channels: s.channels,
    subaccount: s.subaccount || undefined,
    splitCode: s.splitCode || undefined,
    bearer: s.chargeBearer,
  })
}

export async function verifyPaystack(reference: string) {
  const s = getPaystackSettings()
  if (!s?.liveReady) return { ok: false as const, error: 'Paystack keys are not configured.' }
  return callPaystackApi({
    action: 'verify',
    secretKey: s.secretKey,
    reference,
  })
}

export async function refundPaystack(reference: string, reason?: string) {
  const s = getPaystackSettings()
  if (!s?.liveReady) return { ok: false as const, error: 'Paystack keys are not configured. The local refund was not sent to Paystack.' }
  return callPaystackApi({
    action: 'refund',
    secretKey: s.secretKey,
    reference,
    reason: reason || 'FitPro refund',
  })
}

export function loadPaystackJs(): Promise<PaystackPopSetup> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Paystack checkout only runs in the browser.'))
  if (window.PaystackPop?.setup) return Promise.resolve(window.PaystackPop)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-fitpro-paystack]')
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.PaystackPop?.setup) resolve(window.PaystackPop)
        else reject(new Error('Paystack script loaded without PaystackPop.'))
      })
      existing.addEventListener('error', () => reject(new Error('Could not load Paystack checkout. Check your internet connection.')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://js.paystack.co/v1/inline.js'
    s.async = true
    s.dataset.fitproPaystack = '1'
    s.onload = () => {
      if (window.PaystackPop?.setup) resolve(window.PaystackPop)
      else reject(new Error('Paystack script loaded without PaystackPop.'))
    }
    s.onerror = () => reject(new Error('Could not load Paystack checkout. Check your internet connection.'))
    document.head.appendChild(s)
  })
}

export function methodLabel(method: string) {
  const map: Record<string, string> = {
    paystack: 'Paystack',
    momo: 'Mobile Money',
    stripe: 'Stripe',
    paypal: 'PayPal',
    cash: 'Cash',
    card: 'Card',
  }
  return map[method] || method
}
