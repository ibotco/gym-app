/**
 * MTN MoMo Open API client (Collections product) — real calls, no simulation.
 *
 * Endpoints used (MTN MoMo Developer portal):
 *   POST {base}/collection/token/                              → OAuth2 access token
 *   GET  {base}/collection/v1_0/account/balance                → account balance
 *   GET  {base}/collection/v1_0/accountholder/msisdn/{n}/active→ holder validation
 *   POST {base}/collection/v1_0/requesttopay                   → request a payment
 *   GET  {base}/collection/v1_0/requesttopay/{referenceId}     → status of one request
 *   POST {base}/v1_0/apiuser + /apikey                         → sandbox provisioning
 *
 * IMPORTANT — browsers cannot call api.momodeveloper.mtn.com directly: the
 * service sends no CORS headers and the API key must never sit in client code
 * in production. Point `baseUrl` at your own server-side proxy (it forwards the
 * headers and keeps the secret), or use the sandbox from a trusted environment.
 * Every failure below is reported verbatim so the cause is obvious.
 */

export type MomoEnvironment = 'sandbox' | 'mtnghana' | 'mtnuganda' | 'mtncameroon' | 'mtnivorycoast' | 'mtnzambia' | 'mtnrwanda'

export interface MomoConfig {
  /** API host or your proxy, e.g. https://sandbox.momodeveloper.mtn.com */
  baseUrl: string
  /** Ocp-Apim-Subscription-Key for the Collections product. */
  subscriptionKey: string
  /** API user id (a UUID you created) — the OAuth username. */
  apiUser: string
  /** API key issued for that user — the OAuth password. */
  apiKey: string
  /** X-Target-Environment: sandbox, or the production market (mtnghana…). */
  targetEnvironment: MomoEnvironment
}

export interface MomoToken {
  accessToken: string
  /** Epoch ms when the token stops being usable. */
  expiresAt: number
}

export interface MomoBalance {
  availableBalance: string
  currency: string
}

export interface MomoTransaction {
  amount: string
  currency: string
  financialTransactionId?: string
  externalId?: string
  payer?: { partyIdType: string; partyId: string }
  payeeNote?: string
  payerMessage?: string
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED'
  reason?: string | { code?: string; message?: string }
}

const trimBase = (url: string) => url.replace(/\/+$/, '')

/** Human-readable error for the common failure modes. */
function describe(status: number, body: string, url: string): string {
  if (status === 0) {
    return `Network/CORS error calling ${url}. Browsers cannot call the MoMo API directly — point the Base URL at your own server-side proxy.`
  }
  if (status === 401) return 'Unauthorized (401): the API user / API key pair was rejected for this subscription key.'
  if (status === 403) return 'Forbidden (403): the subscription key is not valid for the Collections product, or the target environment is wrong.'
  if (status === 404) return `Not found (404) at ${url}: check the base URL and that the reference exists.`
  if (status === 429) return 'Rate limited (429) by the MoMo API — wait a moment and retry.'
  if (status === 500) return 'MoMo API internal error (500) — retry, and check the X-Target-Environment value.'
  return `MoMo API error ${status}: ${body.slice(0, 300) || 'no response body'}`
}

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    throw new Error(describe(0, err instanceof Error ? err.message : '', url))
  }
}

/** OAuth2 access token (valid ~1 hour). */
export async function getMomoToken(cfg: MomoConfig): Promise<MomoToken> {
  const url = `${trimBase(cfg.baseUrl)}/collection/token/`
  const res = await call(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${cfg.apiUser}:${cfg.apiKey}`)}`,
      'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
    },
  })
  const body = await res.text()
  if (!res.ok) throw new Error(describe(res.status, body, url))
  if (!body.trim()) {
    throw new Error(`MoMo returned an empty response from ${url}. If you are proxying, make sure the proxy strips the browser Origin header — MTN answers those with an empty 200.`)
  }
  const json = JSON.parse(body) as { access_token: string; expires_in: number }
  return { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 - 30_000 }
}

const authHeaders = (cfg: MomoConfig, token: MomoToken) => ({
  Authorization: `Bearer ${token.accessToken}`,
  'Ocp-Apim-Subscription-Key': cfg.subscriptionKey,
  'X-Target-Environment': cfg.targetEnvironment,
})

/** Balance of the collection account. */
export async function getMomoBalance(cfg: MomoConfig, token: MomoToken): Promise<MomoBalance> {
  const url = `${trimBase(cfg.baseUrl)}/collection/v1_0/account/balance`
  const res = await call(url, { headers: authHeaders(cfg, token) })
  const body = await res.text()
  if (!res.ok) throw new Error(describe(res.status, body, url))
  return JSON.parse(body) as MomoBalance
}

/** True when the MSISDN is a registered, active MoMo wallet. */
export async function isMomoAccountActive(cfg: MomoConfig, token: MomoToken, msisdn: string): Promise<boolean> {
  const url = `${trimBase(cfg.baseUrl)}/collection/v1_0/accountholder/msisdn/${encodeURIComponent(msisdn)}/active`
  const res = await call(url, { headers: authHeaders(cfg, token) })
  const body = await res.text()
  if (!res.ok) throw new Error(describe(res.status, body, url))
  try { return (JSON.parse(body) as { result?: boolean }).result !== false } catch { return true }
}

/** Status (and amount) of one collection by its reference id. */
export async function getMomoTransaction(cfg: MomoConfig, token: MomoToken, referenceId: string): Promise<MomoTransaction> {
  const url = `${trimBase(cfg.baseUrl)}/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`
  const res = await call(url, { headers: authHeaders(cfg, token) })
  const body = await res.text()
  if (!res.ok) throw new Error(describe(res.status, body, url))
  return JSON.parse(body) as MomoTransaction
}

/** Ask a customer to pay — returns the reference id used to poll the status. */
export async function requestToPay(
  cfg: MomoConfig,
  token: MomoToken,
  args: { amount: string; currency: string; msisdn: string; externalId: string; payerMessage?: string; payeeNote?: string },
): Promise<string> {
  const referenceId = crypto.randomUUID()
  const url = `${trimBase(cfg.baseUrl)}/collection/v1_0/requesttopay`
  const res = await call(url, {
    method: 'POST',
    headers: {
      ...authHeaders(cfg, token),
      'X-Reference-Id': referenceId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: args.amount,
      currency: args.currency,
      externalId: args.externalId,
      payer: { partyIdType: 'MSISDN', partyId: args.msisdn },
      payerMessage: args.payerMessage || 'Payment',
      payeeNote: args.payeeNote || 'Payment',
    }),
  })
  if (res.status !== 202) throw new Error(describe(res.status, await res.text(), url))
  return referenceId
}

/**
 * Sandbox only: create an API user + key for a subscription key, so a developer
 * can get going without the portal. Production credentials come from MTN.
 */
export async function provisionSandboxUser(baseUrl: string, subscriptionKey: string, callbackHost = 'https://example.com'): Promise<{ apiUser: string; apiKey: string }> {
  const base = trimBase(baseUrl)
  const apiUser = crypto.randomUUID()
  const createUrl = `${base}/v1_0/apiuser`
  const created = await call(createUrl, {
    method: 'POST',
    headers: {
      'X-Reference-Id': apiUser,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerCallbackHost: callbackHost.replace(/^https?:\/\//, '') }),
  })
  if (created.status !== 201) throw new Error(describe(created.status, await created.text(), createUrl))
  const keyUrl = `${base}/v1_0/apiuser/${apiUser}/apikey`
  const keyRes = await call(keyUrl, { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': subscriptionKey } })
  const keyBody = await keyRes.text()
  if (!keyRes.ok) throw new Error(describe(keyRes.status, keyBody, keyUrl))
  return { apiUser, apiKey: (JSON.parse(keyBody) as { apiKey: string }).apiKey }
}

/** Same-origin paths proxied to MTN by the dev server (see vite.config.ts). */
export const MOMO_DEV_PROXY_SANDBOX = '/momo-api'
export const MOMO_DEV_PROXY_LIVE = '/momo-live'
export const MOMO_DEFAULT_BASE = MOMO_DEV_PROXY_SANDBOX
export const MOMO_SANDBOX_DIRECT = 'https://sandbox.momodeveloper.mtn.com'
export const MOMO_PRODUCTION_BASE = MOMO_DEV_PROXY_LIVE
export const MOMO_PRODUCTION_DIRECT = 'https://proxy.momoapi.mtn.com'

/** Credentials live in this browser only — never bundled or sent anywhere else. */
export const MOMO_KEYS = 'fitpro_momo_config_v1'

export const loadMomoConfig = (): MomoConfig | null => {
  try {
    const raw = localStorage.getItem(MOMO_KEYS)
    return raw ? (JSON.parse(raw) as MomoConfig) : null
  } catch { return null }
}
export const saveMomoConfig = (cfg: MomoConfig | null) => {
  try {
    if (cfg) localStorage.setItem(MOMO_KEYS, JSON.stringify(cfg))
    else localStorage.removeItem(MOMO_KEYS)
  } catch { /* storage full */ }
}
