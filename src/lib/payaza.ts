import type { IntegrationRecord } from '../types'
import type { TestCode } from './integrations'
import { applyTest, loadIntegrations, testIntegration, unsealSecret, validateIntegration } from './integrations'

export const PAYAZA_ID = 'int_payaza'
export const PAYAZA_PENDING_KEY = 'fitpro_payaza_pending'
export const PAYAZA_CHECKOUT_URL = 'https://payment.payaza.africa/'

export interface PayazaSettings {
  rec: IntegrationRecord
  publicKey: string
  currency: string
  connectionMode: 'test' | 'live'
  autoSettle: boolean
  allowDemo: boolean
  liveReady: boolean
  callbackUrl: string
}

export interface PendingPayazaTx {
  paymentId: string
  invoiceId: string
  memberId: string
  amount: number
  reference: string
  email: string
  returnTo: string
  description: string
}

export function getPayazaRecord(): IntegrationRecord | undefined {
  return loadIntegrations().find((r) => r.id === PAYAZA_ID)
}

export function getPayazaSettings(): PayazaSettings | null {
  const rec = getPayazaRecord()
  if (!rec) return null
  const extra = rec.config.extra || {}
  const publicKey = unsealSecret(rec.config.apiKey).trim()
  return {
    rec,
    publicKey,
    currency: (extra.currency || 'GHS').toUpperCase(),
    connectionMode: rec.config.environment === 'production' ? 'live' : 'test',
    autoSettle: extra.autoSettle !== 'false',
    allowDemo: extra.allowDemo !== 'false',
    liveReady: publicKey.length > 0,
    callbackUrl: rec.config.callbackUrl || defaultCallbackUrl(),
  }
}

export function isPayazaEnabled() {
  const s = getPayazaSettings()
  if (!s || !s.rec.active) return false
  return s.liveReady || s.allowDemo
}

export function isPayazaLive() {
  const s = getPayazaSettings()
  return !!(s && s.rec.active && s.liveReady)
}

export function defaultCallbackUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/pay/payaza'
  return `${window.location.origin}/pay/payaza`
}

export function makePayazaReference(paymentId: string) {
  const clean = paymentId.replace(/[^a-zA-Z0-9]/g, '').slice(-18)
  return `FP${clean}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()
}

export function savePendingPayaza(tx: PendingPayazaTx) {
  try { sessionStorage.setItem(PAYAZA_PENDING_KEY, JSON.stringify(tx)) } catch { /* ignore */ }
  try { localStorage.setItem(PAYAZA_PENDING_KEY, JSON.stringify(tx)) } catch { /* ignore */ }
}

export function loadPendingPayaza(): PendingPayazaTx | null {
  try {
    const raw = sessionStorage.getItem(PAYAZA_PENDING_KEY) || localStorage.getItem(PAYAZA_PENDING_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingPayazaTx
  } catch {
    return null
  }
}

export function clearPendingPayaza() {
  try { sessionStorage.removeItem(PAYAZA_PENDING_KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(PAYAZA_PENDING_KEY) } catch { /* ignore */ }
}

async function callPayazaApi(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; message?: string; balance?: string }> {
  try {
    const r = await fetch('/api/payaza', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await r.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string; balance?: string }
    if (!r.ok || !data.ok) return { ok: false, error: data.error || `Payaza ${r.status}` }
    return { ok: true, message: data.message, balance: data.balance }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not reach the FitPro Payaza helper. Stop then Start FitPro.' }
  }
}

/** Builds the hosted Payment Page checkout URL (redirect flow). */
export function buildPayazaCheckoutUrl(input: {
  publicKey: string
  connectionMode: 'test' | 'live'
  amount: number
  currency: string
  email: string
  reference: string
  name?: string
  phone?: string
  redirectUrl: string
}): string {
  const [first = '', ...rest] = (input.name || input.email).trim().split(/\s+/)
  const last = rest.join(' ') || first
  const params = new URLSearchParams({
    merchant_key: input.publicKey,
    connection_mode: input.connectionMode,
    checkout_amount: String(input.amount),
    currency_code: input.currency,
    email_address: input.email,
    first_name: first || 'FitPro',
    last_name: last || 'Member',
    phone_number: (input.phone || '').replace(/[^\d]/g, ''),
    transaction_reference: input.reference,
    redirect_url: input.redirectUrl,
  })
  return `${PAYAZA_CHECKOUT_URL}?${params.toString()}`
}

export async function testPayazaConnection(rec?: IntegrationRecord) {
  const row = rec || getPayazaRecord()
  if (!row) {
    return { ok: false, code: 'Configuration Error' as TestCode, ms: 0, detail: 'Payaza is not in the catalogue.' }
  }
  const started = Date.now()
  const simulated = testIntegration(row)
  if (!simulated.ok) return simulated
  const pk = unsealSecret(row.config.apiKey)
  if (!pk) {
    return {
      ok: true,
      code: 'Authentication Successful' as TestCode,
      ms: Date.now() - started,
      detail: 'Demo mode. Add your Payaza public API key (merchant key) to test the live API.',
    }
  }
  const v = validateIntegration(row)
  if (!v.ok) return { ok: false, code: 'Configuration Error' as TestCode, ms: Date.now() - started, detail: v.error || 'Invalid Payaza configuration.' }
  const result = await callPayazaApi({ action: 'test', apiKey: pk, tenant: row.config.environment === 'production' ? 'live' : 'test' })
  const ms = Date.now() - started
  if (!result.ok) return { ok: false, code: 'Invalid API Key' as TestCode, ms, detail: result.error || 'Payaza request failed' }
  return {
    ok: true,
    code: 'Authentication Successful' as TestCode,
    ms,
    detail: result.balance ? `Payaza accepted the key · ${result.balance}` : result.message || 'Payaza accepted the key.',
  }
}

export function applyPayazaTest(rec: IntegrationRecord, result: Awaited<ReturnType<typeof testPayazaConnection>>) {
  return applyTest(rec, result)
}
