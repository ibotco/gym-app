import type { IntegrationRecord } from '../types'
import type { TestCode } from './integrations'
import { applyTest, loadIntegrations, testIntegration, unsealSecret, validateIntegration } from './integrations'

// Shared client helpers for Stripe, PayPal, Flutterwave, and Hubtel.
// Each provider follows the same shape as Paystack/Payaza: settings reader,
// reference generator, pending-transaction storage, server-backed test
// connection, and a hosted-checkout initializer.

export const FLUTTERWAVE_ID = 'int_flutterwave'
export const STRIPE_ID = 'int_stripe'
export const PAYPAL_ID = 'int_paypal'
export const HUBTEL_ID = 'int_hubtel'

export const FLUTTERWAVE_PENDING_KEY = 'fitpro_flutterwave_pending'
export const STRIPE_PENDING_KEY = 'fitpro_stripe_pending'
export const PAYPAL_PENDING_KEY = 'fitpro_paypal_pending'
export const HUBTEL_PENDING_KEY = 'fitpro_hubtel_pending'

export interface GatewaySettings {
  rec: IntegrationRecord
  apiKey: string
  secretKey: string
  currency: string
  autoSettle: boolean
  allowDemo: boolean
  liveReady: boolean
  callbackUrl: string
  sandbox: boolean
}

export interface PendingGatewayTx {
  paymentId: string
  invoiceId: string
  memberId: string
  amount: number
  reference: string
  email: string
  phone?: string
  returnTo: string
  description: string
}

function record(id: string): IntegrationRecord | undefined {
  return loadIntegrations().find((r) => r.id === id)
}

function settings(id: string): GatewaySettings | null {
  const rec = record(id)
  if (!rec) return null
  const extra = rec.config.extra || {}
  return {
    rec,
    apiKey: unsealSecret(rec.config.apiKey).trim(),
    secretKey: unsealSecret(rec.config.secretKey).trim(),
    currency: (extra.currency || 'GHS').toUpperCase(),
    autoSettle: extra.autoSettle !== 'false',
    allowDemo: extra.allowDemo !== 'false',
    liveReady: id === FLUTTERWAVE_ID || id === STRIPE_ID
      ? unsealSecret(rec.config.secretKey).trim().length > 0
      : unsealSecret(rec.config.apiKey).trim().length > 0 && unsealSecret(rec.config.secretKey).trim().length > 0,
    callbackUrl: rec.config.callbackUrl || defaultCallback(),
    sandbox: rec.config.environment !== 'production',
  }
}

export const getFlutterwaveSettings = () => settings(FLUTTERWAVE_ID)
export const getStripeSettings = () => settings(STRIPE_ID)
export const getPaypalSettings = () => settings(PAYPAL_ID)
export const getHubtelSettings = () => settings(HUBTEL_ID)

export function isGatewayEnabled(id: string) {
  const s = settings(id)
  if (!s || !s.rec.active) return false
  return s.liveReady || s.allowDemo
}
export const isFlutterwaveEnabled = () => isGatewayEnabled(FLUTTERWAVE_ID)
export const isStripeEnabled = () => isGatewayEnabled(STRIPE_ID)
export const isPaypalEnabled = () => isGatewayEnabled(PAYPAL_ID)
export const isHubtelEnabled = () => isGatewayEnabled(HUBTEL_ID)

export function isGatewayLive(id: string) {
  const s = settings(id)
  return !!(s && s.rec.active && s.liveReady)
}

export function defaultCallback() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/pay'
  return `${window.location.origin}/pay`
}

export function makeReference(prefix: string, paymentId: string) {
  const clean = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-18)
  return `${prefix}${clean}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase().slice(0, 40)
}

export function savePending(key: string, tx: PendingGatewayTx) {
  try { sessionStorage.setItem(key, JSON.stringify(tx)) } catch { /* ignore */ }
  try { localStorage.setItem(key, JSON.stringify(tx)) } catch { /* ignore */ }
}

export function loadPending(key: string): PendingGatewayTx | null {
  try {
    const raw = sessionStorage.getItem(key) || localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as PendingGatewayTx
  } catch {
    return null
  }
}

export function clearPending(key: string) {
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

async function call(api: string, body: Record<string, unknown>): Promise<Record<string, unknown> & { ok?: boolean }> {
  try {
    const r = await fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({})) as Record<string, unknown> & { ok?: boolean; error?: string }
    return { ...data, ok: r.ok && data.ok !== false }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : `Could not reach the FitPro ${api} helper.` }
  }
}

function simulatedTest(rec: IntegrationRecord) {
  const v = testIntegration(rec)
  if (!v.ok) return { ok: false, code: v.code as TestCode, ms: v.ms, detail: v.detail }
  return null
}

/** Generic test-connection: validate locally, then hit the provider API via the plugin. */
export async function testGatewayConnection(
  rec: IntegrationRecord,
  api: string,
  apiBody: Record<string, unknown>,
  demoNote: string,
): Promise<{ ok: boolean; code: TestCode; ms: number; detail: string }> {
  const started = Date.now()
  const sim = simulatedTest(rec)
  if (sim) return sim
  const v = validateIntegration(rec)
  if (!v.ok) return { ok: false, code: 'Configuration Error' as TestCode, ms: Date.now() - started, detail: v.error || 'Invalid configuration.' }
  const result = await call(api, apiBody)
  const ms = Date.now() - started
  if (!result.ok) return { ok: false, code: 'Invalid API Key' as TestCode, ms, detail: (result.error as string) || 'Provider rejected the credentials.' }
  return { ok: true, code: 'Authentication Successful' as TestCode, ms, detail: (result.message as string) || demoNote }
}

export function testFlutterwaveConnection(rec?: IntegrationRecord) {
  const row = rec || record(FLUTTERWAVE_ID)
  if (!row) return Promise.resolve({ ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'Flutterwave is not in the catalogue.' })
  return testGatewayConnection(row, '/api/flutterwave', { action: 'test', secretKey: unsealSecret(row.config.secretKey) }, 'Flutterwave accepted the key.')
}

export function testStripeConnection(rec?: IntegrationRecord) {
  const row = rec || record(STRIPE_ID)
  if (!row) return Promise.resolve({ ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'Stripe is not in the catalogue.' })
  return testGatewayConnection(row, '/api/stripe', { action: 'test', secretKey: unsealSecret(row.config.secretKey) }, 'Stripe accepted the key.')
}

export function testPaypalConnection(rec?: IntegrationRecord) {
  const row = rec || record(PAYPAL_ID)
  if (!row) return Promise.resolve({ ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'PayPal is not in the catalogue.' })
  return testGatewayConnection(
    row,
    '/api/paypal',
    { action: 'test', clientId: unsealSecret(row.config.apiKey), clientSecret: unsealSecret(row.config.secretKey) },
    'PayPal accepted the credentials.',
  )
}

export function testHubtelConnection(rec?: IntegrationRecord) {
  const row = rec || record(HUBTEL_ID)
  if (!row) return Promise.resolve({ ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'Hubtel is not in the catalogue.' })
  return testGatewayConnection(
    row,
    '/api/hubtel',
    { action: 'test', clientId: unsealSecret(row.config.apiKey), clientSecret: unsealSecret(row.config.secretKey) },
    'Hubtel accepted the credentials.',
  )
}

export function applyGatewayTest(rec: IntegrationRecord, result: Awaited<ReturnType<typeof testGatewayConnection>>) {
  return applyTest(rec, result)
}
