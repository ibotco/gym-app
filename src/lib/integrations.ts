import type {
  IntegrationCategory,
  IntegrationConfig,
  IntegrationHealth,
  IntegrationLog,
  IntegrationRecord,
} from '../types'
import { uid } from './utils'

export const INT_STORE_KEY = 'fitpro_integrations'
export const INT_LOG_KEY = 'fitpro_int_logs'
const SEAL = 'enc$'
const XOR_KEY = 'FitPro·Accra·int·v1'

export const CATEGORIES: { id: IntegrationCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'communication', label: 'Communication' },
  { id: 'payments', label: 'Payments' },
  { id: 'auth', label: 'Authentication' },
  { id: 'storage', label: 'Cloud storage' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'social', label: 'Social' },
  { id: 'api', label: 'Third-party APIs' },
]

export function categoryLabel(id: IntegrationCategory) {
  return CATEGORIES.find((c) => c.id === id)?.label || id
}

export const emptyConfig = (): IntegrationConfig => ({
  apiKey: '',
  secretKey: '',
  accessToken: '',
  webhookUrl: '',
  callbackUrl: '',
  username: '',
  password: '',
  environment: 'sandbox',
  syncFrequency: '15m',
  retryAttempts: 3,
  timeoutMs: 8000,
  notifyOnFail: true,
  extra: {},
})

function xor(raw: string) {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length))
  }
  return out
}

export function sealSecret(plain: string) {
  const v = plain.trim()
  if (!v) return ''
  if (v.startsWith(SEAL)) return v
  try {
    return SEAL + btoa(unescape(encodeURIComponent(xor(v))))
  } catch {
    return SEAL + btoa(xor(v))
  }
}

export function unsealSecret(stored: string) {
  if (!stored) return ''
  if (!stored.startsWith(SEAL)) return stored
  try {
    return xor(decodeURIComponent(escape(atob(stored.slice(SEAL.length)))))
  } catch {
    try { return xor(atob(stored.slice(SEAL.length))) } catch { return '' }
  }
}

export function maskSecret(stored: string) {
  const plain = unsealSecret(stored)
  if (!plain) return ''
  if (plain.length <= 4) return '••••'
  return `••••••••${plain.slice(-4)}`
}

export function isSealed(v: string) {
  return v.startsWith(SEAL)
}

function iso(daysAgo: number, hour = 8) {
  const d = new Date('2026-08-14T08:00:00')
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, (daysAgo * 7) % 60, 0, 0)
  return d.toISOString()
}

function seedOne(partial: Omit<IntegrationRecord, 'config'> & { config?: Partial<IntegrationConfig> }): IntegrationRecord {
  return {
    ...partial,
    config: { ...emptyConfig(), ...(partial.config || {}) },
  }
}

export function catalog(): IntegrationRecord[] {
  return [
    seedOne({
      id: 'int_email', name: 'Transactional email', provider: 'Resend / Gmail',
      description: 'Member codes, credential emails, invoices. Uses Settings → Email when live.',
      category: 'communication', version: '2.4.1', critical: true, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 7), lastSuccessAt: iso(0, 7),
      lastHealthCheckAt: iso(0, 7), lastTestMs: 142, lastTestResult: 'Authentication Successful',
      createdAt: iso(400, 9), updatedAt: iso(2, 11),
      config: { environment: 'production', webhookUrl: 'https://fitpro.gym/hooks/email', extra: { from: 'hello@fitpro.gym' } },
    }),
    seedOne({
      id: 'int_sms', name: 'SMS gateway', provider: 'Hubtel',
      description: 'Credential SMS and front-desk alerts across MTN, Telecel, and AirtelTigo.',
      category: 'communication', version: '1.8.0', critical: true, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 6), lastSuccessAt: iso(0, 6),
      lastHealthCheckAt: iso(0, 6), lastTestMs: 210, lastTestResult: 'Authentication Successful',
      createdAt: iso(380, 10), updatedAt: iso(5, 14),
      config: { environment: 'production', extra: { from: 'FitPro' } },
    }),
    seedOne({
      id: 'int_whatsapp', name: 'WhatsApp Business', provider: 'Meta',
      description: 'Concierge and credential delivery via Cloud API or wa.me.',
      category: 'communication', version: '3.1.2', critical: false, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 9), lastSuccessAt: iso(0, 9),
      lastHealthCheckAt: iso(0, 9), lastTestMs: 188, lastTestResult: 'Authentication Successful',
      createdAt: iso(300, 12), updatedAt: iso(1, 16),
      config: { environment: 'production', extra: { phoneNumberId: '' } },
    }),
    seedOne({
      id: 'int_zoom', name: 'Zoom rooms', provider: 'Zoom',
      description: 'Online coaching rooms for PT and prenatal classes.',
      category: 'communication', version: '1.2.0', critical: false, active: false, connected: false,
      health: 'pending', apiStatus: 'Not configured', createdAt: iso(120, 11), updatedAt: iso(120, 11),
    }),
    seedOne({
      id: 'int_paystack', name: 'Paystack', provider: 'Paystack',
      description: 'Ghana checkout — Visa, Mastercard, and MTN / Telecel / AirtelTigo MoMo in GHS.',
      category: 'payments', version: '2026.8', critical: true, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(10, 9), updatedAt: iso(10, 9),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/paystack',
        webhookUrl: 'http://127.0.0.1:5173/api/paystack',
        extra: {
          currency: 'GHS',
          channels: 'card,mobile_money,bank,bank_transfer,ussd,qr',
          checkoutMode: 'popup',
          autoSettle: 'true',
          allowDemo: 'true',
          chargeBearer: 'account',
          subaccount: '',
          splitCode: '',
        },
      },
    }),
    seedOne({
      id: 'int_payaza', name: 'Payaza', provider: 'Payaza',
      description: 'Nigeria & Ghana collections — card, bank transfer, and mobile money via hosted checkout.',
      category: 'payments', version: '2026.1', critical: true, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(6, 9), updatedAt: iso(6, 9),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/payaza',
        webhookUrl: 'http://127.0.0.1:5173/api/payaza',
        extra: {
          currency: 'GHS',
          autoSettle: 'true',
          allowDemo: 'true',
        },
      },
    }),
    seedOne({
      id: 'int_stripe', name: 'Stripe', provider: 'Stripe',
      description: 'Cards and subscriptions for Black Card and Annual plans.',
      category: 'payments', version: '2024-11', critical: true, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(500, 9), updatedAt: iso(8, 10),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/stripe',
        webhookUrl: 'http://127.0.0.1:5173/api/stripe',
        extra: { currency: 'GHS', autoSettle: 'true', allowDemo: 'true' },
      },
    }),
    seedOne({
      id: 'int_paypal', name: 'PayPal', provider: 'PayPal',
      description: 'Wallet checkout for diaspora members paying in GHS.',
      category: 'payments', version: '2.0.4', critical: false, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(450, 10), updatedAt: iso(20, 9),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/paypal',
        webhookUrl: 'http://127.0.0.1:5173/api/paypal',
        extra: { currency: 'GHS', autoSettle: 'true', allowDemo: 'true' },
      },
    }),
    seedOne({
      id: 'int_flutterwave', name: 'Flutterwave', provider: 'Flutterwave',
      description: 'Pan-African checkout — card, bank transfer, mobile money, and USSD.',
      category: 'payments', version: 'v3', critical: true, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(5, 9), updatedAt: iso(5, 9),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/flutterwave',
        webhookUrl: 'http://127.0.0.1:5173/api/flutterwave',
        extra: { currency: 'GHS', autoSettle: 'true', allowDemo: 'true' },
      },
    }),
    seedOne({
      id: 'int_hubtel', name: 'Hubtel', provider: 'Hubtel',
      description: 'Ghana collections — MTN / Telecel / AirtelTigo MoMo and online checkout.',
      category: 'payments', version: '1.0', critical: true, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(4, 9), updatedAt: iso(4, 9),
      config: {
        environment: 'sandbox',
        callbackUrl: 'http://127.0.0.1:5173/pay/hubtel',
        webhookUrl: 'http://127.0.0.1:5173/api/hubtel',
        extra: { currency: 'GHS', channel: 'mtn-gh', autoSettle: 'true', allowDemo: 'true' },
      },
    }),
    seedOne({
      id: 'int_momo', name: 'Mobile Money', provider: 'MTN · Telecel · AirtelTigo',
      description: 'Collections via Hubtel Receive Money. Default checkout in Accra.',
      category: 'payments', version: '4.3.0', critical: true, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 5), lastSuccessAt: iso(0, 5),
      lastHealthCheckAt: iso(0, 5), lastTestMs: 175, lastTestResult: 'Authentication Successful',
      createdAt: iso(480, 8), updatedAt: iso(3, 13),
      config: { environment: 'production', extra: { merchant: 'FitPro Accra' } },
    }),
    seedOne({
      id: 'int_google_oauth', name: 'Google sign-in', provider: 'Google',
      description: 'OAuth 2.0 for members and staff. Demo still opens the member seat.',
      category: 'auth', version: '1.5.0', critical: false, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSuccessAt: iso(0, 10), lastHealthCheckAt: iso(0, 10),
      lastTestMs: 130, lastTestResult: 'Authentication Successful',
      createdAt: iso(360, 9), updatedAt: iso(14, 11),
      config: { environment: 'production', callbackUrl: 'http://127.0.0.1:5173/login' },
    }),
    seedOne({
      id: 'int_apple', name: 'Apple sign-in', provider: 'Apple',
      description: 'Sign in with Apple for iOS members.',
      category: 'auth', version: '1.1.0', critical: false, active: true, connected: false,
      health: 'pending', apiStatus: 'Pending configuration', createdAt: iso(200, 12), updatedAt: iso(40, 9),
      config: { environment: 'sandbox', callbackUrl: 'http://127.0.0.1:5173/login' },
    }),
    seedOne({
      id: 'int_s3', name: 'Object backup', provider: 'Amazon S3',
      description: 'Nightly encrypted snapshots. Point-in-time 14 days.',
      category: 'storage', version: '1.0.6', critical: false, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 2), lastSuccessAt: iso(0, 2),
      lastHealthCheckAt: iso(0, 2), lastTestMs: 310, lastTestResult: 'Authentication Successful',
      createdAt: iso(220, 7), updatedAt: iso(6, 7),
      config: { environment: 'production', extra: { bucket: 'fitpro-accra-backups', region: 'eu-west-1' } },
    }),
    seedOne({
      id: 'int_gdrive', name: 'Google Drive', provider: 'Google',
      description: 'Export reports and GDPR packs to a shared Drive folder.',
      category: 'storage', version: '1.0.1', critical: false, active: false, connected: false,
      health: 'offline', apiStatus: 'Inactive', createdAt: iso(90, 14), updatedAt: iso(90, 14),
    }),
    seedOne({
      id: 'int_ga', name: 'Google Analytics', provider: 'Google',
      description: 'Public site and join-funnel events.',
      category: 'analytics', version: '4.0', critical: false, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSyncAt: iso(0, 4), lastSuccessAt: iso(0, 4),
      lastHealthCheckAt: iso(0, 4), lastTestMs: 88, lastTestResult: 'Authentication Successful',
      createdAt: iso(330, 10), updatedAt: iso(12, 10),
      config: { environment: 'production', extra: { measurementId: 'G-FITPRO01' } },
    }),
    seedOne({
      id: 'int_mixpanel', name: 'Mixpanel', provider: 'Mixpanel',
      description: 'Class booking and retention funnels for managers.',
      category: 'analytics', version: '2.2.0', critical: false, active: false, connected: false,
      health: 'pending', apiStatus: 'Not configured', createdAt: iso(60, 11), updatedAt: iso(60, 11),
    }),
    seedOne({
      id: 'int_ig', name: 'Instagram', provider: 'Meta',
      description: 'Publish class highlights and lead ads.',
      category: 'social', version: '1.4.0', critical: false, active: false, connected: false,
      health: 'offline', apiStatus: 'Inactive', createdAt: iso(150, 15), updatedAt: iso(70, 9),
    }),
    seedOne({
      id: 'int_fb', name: 'Facebook pages', provider: 'Meta',
      description: 'Club page posts and lead forms.',
      category: 'social', version: '1.4.0', critical: false, active: false, connected: false,
      health: 'offline', apiStatus: 'Inactive', createdAt: iso(150, 15), updatedAt: iso(70, 9),
    }),
    seedOne({
      id: 'int_tt', name: 'TikTok', provider: 'TikTok',
      description: 'Short-form content for East Legon and Osu floors.',
      category: 'social', version: '1.0.0', critical: false, active: false, connected: false,
      health: 'pending', apiStatus: 'Not configured', createdAt: iso(40, 16), updatedAt: iso(40, 16),
    }),
    seedOne({
      id: 'int_gcal', name: 'Google Calendar', provider: 'Google',
      description: 'Sync class timetable to trainer calendars.',
      category: 'api', version: '1.3.2', critical: false, active: false, connected: false,
      health: 'offline', apiStatus: 'Paused', lastFailedAt: iso(18, 11), lastTestResult: 'Expired Token',
      createdAt: iso(280, 10), updatedAt: iso(18, 11),
    }),
    seedOne({
      id: 'int_maps', name: 'Google Maps', provider: 'Google',
      description: 'Club locator on the public site.',
      category: 'api', version: '3.55', critical: false, active: true, connected: true,
      health: 'online', apiStatus: 'Operational', lastSuccessAt: iso(0, 3), lastHealthCheckAt: iso(0, 3),
      lastTestMs: 72, lastTestResult: 'Authentication Successful',
      createdAt: iso(500, 9), updatedAt: iso(30, 8),
      config: { environment: 'production' },
    }),
  ]
}

function mergeSaved(saved: IntegrationRecord[]): IntegrationRecord[] {
  const base = catalog()
  const byId = new Map(saved.map((r) => [r.id, r]))
  const merged = base.map((seed) => {
    const s = byId.get(seed.id)
    if (!s) return seed
    return {
      ...seed,
      ...s,
      config: { ...emptyConfig(), ...seed.config, ...s.config, extra: { ...seed.config.extra, ...(s.config?.extra || {}) } },
    }
  })
  for (const s of saved) {
    if (!base.some((b) => b.id === s.id)) merged.push({ ...s, config: { ...emptyConfig(), ...s.config } })
  }
  return merged
}

export function loadIntegrations(): IntegrationRecord[] {
  try {
    const raw = localStorage.getItem(INT_STORE_KEY)
    if (!raw) return catalog()
    return mergeSaved(JSON.parse(raw) as IntegrationRecord[])
  } catch {
    return catalog()
  }
}

export function saveIntegrations(list: IntegrationRecord[]) {
  localStorage.setItem(INT_STORE_KEY, JSON.stringify(list))
}

export function loadIntegrationLogs(): IntegrationLog[] {
  try {
    const raw = localStorage.getItem(INT_LOG_KEY)
    if (raw) return JSON.parse(raw) as IntegrationLog[]
  } catch {
    /* ignore */
  }
  return [
    { id: 'il_1', integrationId: 'int_stripe', integrationName: 'Stripe', adminId: 'u_admin', adminName: 'Naa Adjeley Quaye', action: 'Test connection', status: 'success', details: 'Authentication Successful · 96 ms', createdAt: iso(0, 8) },
    { id: 'il_2', integrationId: 'int_gcal', integrationName: 'Google Calendar', adminId: 'u_manager', adminName: 'Kwesi Ampofo', action: 'Deactivated', status: 'info', details: 'Paused class sync after token expiry', createdAt: iso(18, 11) },
    { id: 'il_3', integrationId: 'int_sms', integrationName: 'SMS gateway', adminId: 'u_admin', adminName: 'Naa Adjeley Quaye', action: 'Configuration updated', status: 'success', details: 'Hubtel from-name set to FitPro', createdAt: iso(5, 14) },
    { id: 'il_4', integrationId: 'int_momo', integrationName: 'Mobile Money', adminId: 'u_manager', adminName: 'Kwesi Ampofo', action: 'Sync', status: 'success', details: '42 settlements pulled', createdAt: iso(0, 5) },
  ]
}

export function saveIntegrationLogs(logs: IntegrationLog[]) {
  localStorage.setItem(INT_LOG_KEY, JSON.stringify(logs.slice(0, 400)))
}

export function requiredFields(rec: IntegrationRecord): (keyof IntegrationConfig | string)[] {
  if (rec.id === 'int_paystack') {
    const demo = rec.config.extra.allowDemo === 'true'
    const pk = unsealSecret(rec.config.apiKey)
    const sk = unsealSecret(rec.config.secretKey)
    if (demo && !pk && !sk) return []
    return ['apiKey', 'secretKey']
  }
  if (rec.id === 'int_payaza') {
    const demo = rec.config.extra.allowDemo === 'true'
    const pk = unsealSecret(rec.config.apiKey)
    if (demo && !pk) return []
    return ['apiKey']
  }
  if (rec.id === 'int_flutterwave' || rec.id === 'int_stripe') {
    const demo = rec.config.extra.allowDemo === 'true'
    const sk = unsealSecret(rec.config.secretKey)
    if (demo && !sk) return []
    return ['secretKey']
  }
  if (rec.id === 'int_paypal' || rec.id === 'int_hubtel') {
    const demo = rec.config.extra.allowDemo === 'true'
    const pk = unsealSecret(rec.config.apiKey)
    const sk = unsealSecret(rec.config.secretKey)
    if (demo && !pk && !sk) return []
    return ['apiKey', 'secretKey']
  }
  if (rec.id === 'int_email' || rec.id === 'int_sms' || rec.id === 'int_whatsapp') return ['apiKey']
  if (rec.category === 'payments') return ['apiKey', 'secretKey']
  if (rec.category === 'auth') return ['apiKey', 'callbackUrl']
  if (rec.id === 'int_maps' || rec.id === 'int_ga') return ['apiKey']
  return ['apiKey']
}

export function validateIntegration(rec: IntegrationRecord): { ok: boolean; error?: string } {
  const cfg = rec.config
  if (cfg.timeoutMs < 1000) return { ok: false, error: 'Timeout must be at least 1000 ms.' }
  if (cfg.retryAttempts < 0 || cfg.retryAttempts > 10) return { ok: false, error: 'Retry attempts must be between 0 and 10.' }
  if (cfg.webhookUrl && !/^https?:\/\//i.test(cfg.webhookUrl)) return { ok: false, error: 'Webhook URL must start with http:// or https://.' }
  if (cfg.callbackUrl && !/^https?:\/\//i.test(cfg.callbackUrl)) return { ok: false, error: 'Callback URL must start with http:// or https://.' }
  if (rec.id === 'int_paystack') {
    const pk = unsealSecret(cfg.apiKey).trim()
    const sk = unsealSecret(cfg.secretKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!pk && !sk && demo) return { ok: true }
    if (!pk) return { ok: false, error: 'Missing Paystack public key (pk_test_… or pk_live_…).' }
    if (!sk) return { ok: false, error: 'Missing Paystack secret key (sk_test_… or sk_live_…).' }
    if (!/^pk_(test|live)_/i.test(pk)) return { ok: false, error: 'Public key must start with pk_test_ or pk_live_.' }
    if (!/^sk_(test|live)_/i.test(sk)) return { ok: false, error: 'Secret key must start with sk_test_ or sk_live_.' }
    if (cfg.environment === 'sandbox' && /_live_/i.test(pk)) return { ok: false, error: 'Sandbox is selected but the public key is a live key. Switch environment or paste a pk_test_ key.' }
    if (cfg.environment === 'production' && /_test_/i.test(pk)) return { ok: false, error: 'Production is selected but the public key is a test key. Switch environment or paste a pk_live_ key.' }
    if ((/_test_/i.test(pk) && /_live_/i.test(sk)) || (/_live_/i.test(pk) && /_test_/i.test(sk))) {
      return { ok: false, error: 'Public and secret keys must both be test or both be live.' }
    }
    const currency = (cfg.extra.currency || 'GHS').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Currency must be a 3-letter code such as GHS.' }
  }
  if (rec.id === 'int_payaza') {
    const pk = unsealSecret(cfg.apiKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!pk && demo) return { ok: true }
    if (!pk) return { ok: false, error: 'Missing Payaza public API key (merchant key).' }
    const currency = (cfg.extra.currency || 'GHS').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Currency must be a 3-letter code such as GHS.' }
  }
  if (rec.id === 'int_flutterwave') {
    const sk = unsealSecret(cfg.secretKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!sk && demo) return { ok: true }
    if (!sk) return { ok: false, error: 'Missing Flutterwave secret key (FLWSECK-…).' }
    if (!/^FLWSECK/i.test(sk)) return { ok: false, error: 'Flutterwave secret key must start with FLWSECK.' }
  }
  if (rec.id === 'int_stripe') {
    const sk = unsealSecret(cfg.secretKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!sk && demo) return { ok: true }
    if (!sk) return { ok: false, error: 'Missing Stripe secret key (sk_test_… or sk_live_…).' }
    if (!/^sk_(test|live)_/i.test(sk)) return { ok: false, error: 'Stripe secret key must start with sk_test_ or sk_live_.' }
  }
  if (rec.id === 'int_paypal') {
    const pk = unsealSecret(cfg.apiKey).trim()
    const sk = unsealSecret(cfg.secretKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!pk && !sk && demo) return { ok: true }
    if (!pk) return { ok: false, error: 'Missing PayPal client ID.' }
    if (!sk) return { ok: false, error: 'Missing PayPal client secret.' }
  }
  if (rec.id === 'int_hubtel') {
    const pk = unsealSecret(cfg.apiKey).trim()
    const sk = unsealSecret(cfg.secretKey).trim()
    const demo = cfg.extra.allowDemo === 'true'
    if (!pk && !sk && demo) return { ok: true }
    if (!pk) return { ok: false, error: 'Missing Hubtel client ID.' }
    if (!sk) return { ok: false, error: 'Missing Hubtel client secret.' }
  }
  const need = requiredFields(rec)
  for (const key of need) {
    const val = key in cfg ? unsealSecret(String((cfg as unknown as Record<string, unknown>)[key] ?? '')) : (cfg.extra[key] || '')
    if (!String(val).trim()) return { ok: false, error: `Missing ${String(key).replace(/([A-Z])/g, ' $1').toLowerCase()}.` }
  }
  return { ok: true }
}

export type TestCode =
  | 'Authentication Successful'
  | 'Invalid API Key'
  | 'Expired Token'
  | 'Connection Timeout'
  | 'Service Unavailable'
  | 'Configuration Error'

export function testIntegration(rec: IntegrationRecord): { ok: boolean; code: TestCode; ms: number; detail: string } {
  const v = validateIntegration(rec)
  const ms = 70 + Math.floor(Math.random() * 220)
  if (!v.ok) return { ok: false, code: 'Configuration Error', ms, detail: v.error || 'Configuration Error' }
  const blob = `${unsealSecret(rec.config.apiKey)} ${unsealSecret(rec.config.secretKey)} ${unsealSecret(rec.config.accessToken)}`.toLowerCase()
  if (blob.includes('invalid')) return { ok: false, code: 'Invalid API Key', ms, detail: 'Provider rejected the API key.' }
  if (blob.includes('expired')) return { ok: false, code: 'Expired Token', ms, detail: 'Access token has expired. Generate a new one.' }
  if (blob.includes('timeout')) return { ok: false, code: 'Connection Timeout', ms: rec.config.timeoutMs, detail: `No response within ${rec.config.timeoutMs} ms.` }
  if (blob.includes('down')) return { ok: false, code: 'Service Unavailable', ms, detail: `${rec.provider} returned 503.` }
  return { ok: true, code: 'Authentication Successful', ms, detail: `${rec.provider} accepted credentials in ${rec.config.environment}.` }
}

export function applyTest(rec: IntegrationRecord, result: ReturnType<typeof testIntegration>): IntegrationRecord {
  const now = new Date().toISOString()
  return {
    ...rec,
    connected: result.ok,
    health: result.ok ? 'online' : result.code === 'Configuration Error' ? 'pending' : 'error',
    apiStatus: result.ok ? 'Operational' : result.code,
    lastTestMs: result.ms,
    lastTestResult: result.code,
    lastHealthCheckAt: now,
    lastSuccessAt: result.ok ? now : rec.lastSuccessAt,
    lastFailedAt: result.ok ? rec.lastFailedAt : now,
    lastSyncAt: result.ok ? now : rec.lastSyncAt,
    updatedAt: now,
  }
}

export function healthOf(rec: IntegrationRecord): IntegrationHealth {
  if (!rec.active) return rec.connected ? 'offline' : rec.config.apiKey ? 'offline' : 'pending'
  return rec.health
}

export function badgeFor(rec: IntegrationRecord): { label: string; tone: 'lime' | 'amber' | 'rose' | 'zinc' | 'sky' } {
  if (!rec.active) return { label: 'Inactive', tone: 'zinc' }
  if (rec.health === 'error') return { label: 'Error', tone: 'rose' }
  if (rec.connected && rec.health === 'online') return { label: 'Connected', tone: 'lime' }
  if (rec.health === 'pending' || !unsealSecret(rec.config.apiKey)) return { label: 'Pending configuration', tone: 'amber' }
  return { label: 'Disconnected', tone: 'sky' }
}

export function makeLog(partial: Omit<IntegrationLog, 'id' | 'createdAt'>): IntegrationLog {
  return { ...partial, id: uid('il'), createdAt: new Date().toISOString() }
}
