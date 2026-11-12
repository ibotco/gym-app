import type { ActivationCode, LicenseLog, LicensePayment, Subscription, SubscriptionPlan } from '../types'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
export const SUB_PLANS_KEY = 'fitpro_sub_plans_v1'
export const SUBSCRIPTIONS_KEY = 'fitpro_subscriptions_v1'
export const ACTIVATION_CODES_KEY = 'fitpro_activation_codes_v1'
export const LICENSE_PAYMENTS_KEY = 'fitpro_license_payments_v1'
export const LICENSE_LOGS_KEY = 'fitpro_license_logs_v1'

// ---------------------------------------------------------------------------
// Synchronous SHA-256 (FIPS 180-4) — lets activation codes be verified fully
// offline. The signature key below ships with the client; in a hosted build
// the same checks run server-side as well (see docs/SUBSCRIPTION_SYSTEM.md).
// ---------------------------------------------------------------------------
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

export function sha256Hex(message: string): string {
  const utf8 = new TextEncoder().encode(message)
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const l = utf8.length
  const total = Math.ceil((l + 9) / 64) * 64
  const data = new Uint8Array(total)
  data.set(utf8)
  data[l] = 0x80
  const dv = new DataView(data.buffer)
  const bits = l * 8
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000))
  dv.setUint32(total - 4, bits >>> 0)
  const w = new Int32Array(64)
  for (let i = 0; i < total; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = dv.getInt32(i + t * 4)
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

// ---------------------------------------------------------------------------
// Activation codes — human-readable tokens (FITPRO-XXXX-XXXX-XXXX-XXXX)
// signed with an HMAC-style hash. The payload (company, duration, plan,
// single-use) travels in the ActivationCode record; the signature binds the
// token to the signing secret so modified or duplicated strings are rejected.
// ---------------------------------------------------------------------------
const SIGNING_SECRET = 'fitpro-license-hmac-v1::7f3a9c2e51d84b6a'

/** Unambiguous alphabet — no 0/O, 1/I/L so codes can be read aloud safely. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_FORMAT = /^FITPRO(-[A-Z2-9]{4}){4}$/

export function signCode(token: string): string {
  return sha256Hex(`${SIGNING_SECRET}.${token}`).slice(0, 20)
}

export function generateCodeToken(rand: () => number = Math.random): string {
  const groups: string[] = []
  for (let g = 0; g < 4; g++) {
    let part = ''
    for (let i = 0; i < 4; i++) part += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]
    groups.push(part)
  }
  return `FITPRO-${groups.join('-')}`
}

export function createActivationCode(opts: {
  companyId: string; days: number; planName: string; singleUse: boolean; issuedBy: string; issuedAt?: string;
}): ActivationCode {
  const code = generateCodeToken()
  return {
    id: `ac_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
    code,
    sig: signCode(code),
    companyId: opts.companyId,
    planDays: opts.days,
    planName: opts.planName,
    issuedBy: opts.issuedBy,
    issuedAt: opts.issuedAt || todayIso(),
    singleUse: opts.singleUse,
    status: 'available',
  }
}

export function verifyActivationCode(
  code: string,
  codes: ActivationCode[],
  targetCompanyId?: string,
): { ok: true; rec: ActivationCode } | { ok: false; error: string } {
  const token = code.trim().toUpperCase()
  if (!CODE_FORMAT.test(token)) return { ok: false, error: 'Code format is invalid — expected FITPRO-XXXX-XXXX-XXXX-XXXX.' }
  const rec = codes.find((c) => c.code === token)
  if (!rec) return { ok: false, error: 'This code is not recognized — check it was issued for this system.' }
  if (signCode(token) !== rec.sig) return { ok: false, error: 'Signature check failed — the code was modified.' }
  if (rec.companyId && targetCompanyId && rec.companyId !== targetCompanyId) return { ok: false, error: 'This code was issued for a different company.' }
  return { ok: true, rec }
}

// ---------------------------------------------------------------------------
// License math
// ---------------------------------------------------------------------------
export const todayIso = () => new Date().toISOString().slice(0, 10)

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const daysRemaining = (sub: Subscription) =>
  Math.round((new Date(`${sub.expiryDate}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime()) / 86400000)

/** Live status: an un-revoked subscription past its expiry reads as expired. */
export function effectiveStatus(sub: Subscription): Subscription['status'] {
  if (sub.status === 'revoked' || sub.status === 'suspended') return sub.status
  return sub.expiryDate < todayIso() ? 'expired' : 'active'
}

export const isLicenseActive = (sub: Subscription) => effectiveStatus(sub) === 'active'

/** The subscription that governs a company (latest expiry first). */
export function licenseForCompany(subs: Subscription[], companyId: string): Subscription | undefined {
  return subs
    .filter((s) => s.companyId === companyId)
    .sort((a, b) => b.expiryDate.localeCompare(a.expiryDate))[0]
}

export const EXPIRY_WARNING_DAYS = [30, 15, 7, 1]

/** Warning copy when the remaining days hit a threshold; null otherwise. */
export function expiryWarning(sub: Subscription): string | null {
  if (effectiveStatus(sub) !== 'active') return null
  const left = daysRemaining(sub)
  const hit = EXPIRY_WARNING_DAYS.find((t) => left <= t)
  if (hit == null) return null
  return left <= 1 ? 'Your subscription expires tomorrow or today — renew now to avoid interruption.' : `Your subscription expires in ${left} day${left === 1 ? '' : 's'} — renew now.`
}

/** Renewal start point: extend from the current expiry when still active, else from today. */
export function renewalBase(sub: Subscription | undefined): string {
  const t = todayIso()
  if (!sub) return t
  return sub.expiryDate > t ? sub.expiryDate : t
}

// ---------------------------------------------------------------------------
// Seeds
// ---------------------------------------------------------------------------
export const SEED_SUB_PLANS: SubscriptionPlan[] = [
  { id: 'plan_monthly', name: 'Monthly Plan', days: 30, price: 250, currency: 'GHS', description: '30 days of full access.', active: true, createdAt: '2024-01-01' },
  { id: 'plan_quarterly', name: 'Quarterly Plan', days: 90, price: 650, currency: 'GHS', description: '90 days of full access.', active: true, createdAt: '2024-01-01' },
  { id: 'plan_semi', name: 'Semi-Annual Plan', days: 180, price: 1200, currency: 'GHS', description: '180 days of full access.', active: true, createdAt: '2024-01-01' },
  { id: 'plan_annual', name: 'Annual Plan', days: 365, price: 2200, currency: 'GHS', description: '365 days of full access.', active: true, createdAt: '2024-01-01' },
]

export function seedSubscription(companyId: string): Subscription {
  const start = todayIso()
  return {
    id: `sub_${companyId}`,
    companyId,
    planId: 'plan_annual',
    planName: 'Annual Plan',
    days: 365,
    startDate: start,
    expiryDate: addDays(start, 365),
    status: 'active',
    source: 'manual',
    lastActivatedAt: start,
  }
}

// ---------------------------------------------------------------------------
// Generic loaders
// ---------------------------------------------------------------------------
function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) return JSON.parse(raw) as T
  } catch { /* fall through */ }
  return seed
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

export const loadSubPlans = () => load<SubscriptionPlan[]>(SUB_PLANS_KEY, SEED_SUB_PLANS)
export const saveSubPlans = (v: SubscriptionPlan[]) => save(SUB_PLANS_KEY, v)
export const loadSubscriptions = (defaultCompanyId: string) => load<Subscription[]>(SUBSCRIPTIONS_KEY, [seedSubscription(defaultCompanyId)])
export const saveSubscriptions = (v: Subscription[]) => save(SUBSCRIPTIONS_KEY, v)
export const loadActivationCodes = () => load<ActivationCode[]>(ACTIVATION_CODES_KEY, [])
export const saveActivationCodes = (v: ActivationCode[]) => save(ACTIVATION_CODES_KEY, v)
export const loadLicensePayments = () => load<LicensePayment[]>(LICENSE_PAYMENTS_KEY, [])
export const saveLicensePayments = (v: LicensePayment[]) => save(LICENSE_PAYMENTS_KEY, v)
export const loadLicenseLogs = () => load<LicenseLog[]>(LICENSE_LOGS_KEY, [])
export const saveLicenseLogs = (v: LicenseLog[]) => save(LICENSE_LOGS_KEY, v)

export function logLicense(logs: LicenseLog[], actor: string, action: string, detail: string): LicenseLog[] {
  return [{ id: `ll_${Date.now()}_${Math.floor(Math.random() * 1e5)}`, at: new Date().toISOString(), actor, action, detail, synced: typeof navigator !== 'undefined' ? navigator.onLine : true }, ...logs]
}
