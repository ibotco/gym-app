import type { PasswordPolicy, User } from '../types'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const NUM = '23456789'
const SPEC = '!@#$%&*?'

export const defaultPasswordPolicy = (): PasswordPolicy => ({
  minLength: 10,
  requireUpper: true,
  requireLower: true,
  requireNumber: true,
  requireSpecial: true,
})

function pick(set: string) {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % set.length
  return set[n]
}

function shuffle(chars: string[]) {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
    const t = chars[i]
    chars[i] = chars[j]
    chars[j] = t
  }
  return chars
}

export function generateTempPassword(policy: PasswordPolicy = defaultPasswordPolicy()) {
  const parts: string[] = []
  if (policy.requireUpper) parts.push(pick(UPPER))
  if (policy.requireLower) parts.push(pick(LOWER))
  if (policy.requireNumber) parts.push(pick(NUM))
  if (policy.requireSpecial) parts.push(pick(SPEC))
  const pool = `${UPPER}${LOWER}${NUM}${policy.requireSpecial ? SPEC : ''}`
  const len = Math.max(policy.minLength, 12)
  while (parts.length < len) parts.push(pick(pool))
  return shuffle(parts).join('')
}

export function passwordPolicyError(password: string, policy: PasswordPolicy = defaultPasswordPolicy()) {
  if (password.length < policy.minLength) return `Password must be at least ${policy.minLength} characters.`
  if (policy.requireUpper && !/[A-Z]/.test(password)) return 'Password must include an uppercase letter.'
  if (policy.requireLower && !/[a-z]/.test(password)) return 'Password must include a lowercase letter.'
  if (policy.requireNumber && !/\d/.test(password)) return 'Password must include a number.'
  if (policy.requireSpecial && !/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol.'
  return ''
}

export function policyChecks(password: string, policy: PasswordPolicy) {
  return [
    { ok: password.length >= policy.minLength, label: `${policy.minLength}+ characters` },
    { ok: !policy.requireUpper || /[A-Z]/.test(password), label: 'Uppercase letter', hide: !policy.requireUpper },
    { ok: !policy.requireLower || /[a-z]/.test(password), label: 'Lowercase letter', hide: !policy.requireLower },
    { ok: !policy.requireNumber || /\d/.test(password), label: 'Number', hide: !policy.requireNumber },
    { ok: !policy.requireSpecial || /[^A-Za-z0-9]/.test(password), label: 'Symbol', hide: !policy.requireSpecial },
  ].filter((c) => !c.hide)
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

/** Compact SHA-256 for contexts where SubtleCrypto is missing. */
function sha256Js(message: string) {
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
  const bytes = unescape(encodeURIComponent(message))
  const extra = (bytes.length + 9) % 64
  const pad = extra === 0 ? 0 : 64 - extra
  const len = bytes.length + 1 + pad + 8
  const words: number[] = []
  for (let i = 0; i < len; i++) {
    const b = i < bytes.length ? bytes.charCodeAt(i) : i === bytes.length ? 0x80 : 0
    words[i >> 2] = (words[i >> 2] || 0) | (b << (24 - (i % 4) * 8))
  }
  const bitLen = bytes.length * 8
  words[(len >> 2) - 1] = bitLen
  let h0 = 0x6a09e667
  let h1 = 0xbb67ae85
  let h2 = 0x3c6ef372
  let h3 = 0xa54ff53a
  let h4 = 0x510e527f
  let h5 = 0x9b05688c
  let h6 = 0x1f83d9ab
  let h7 = 0x5be0cd19
  const w = new Array<number>(64)
  const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[i + t] | 0
    for (let t = 16; t < 64; t++) {
      const s0 = rr(w[t - 15], 7) ^ rr(w[t - 15], 18) ^ (w[t - 15] >>> 3)
      const s1 = rr(w[t - 2], 17) ^ rr(w[t - 2], 19) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
    for (let t = 0; t < 64; t++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[t] + w[t]) | 0
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) | 0
      h = g; g = f; f = e; e = (d + t1) | 0
      d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
    h4 = (h4 + e) | 0
    h5 = (h5 + f) | 0
    h6 = (h6 + g) | 0
    h7 = (h7 + h) | 0
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
}

export async function sha256Hex(text: string) {
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
      return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    /* fall through */
  }
  return sha256Js(text)
}

export function isHashedPassword(stored: string) {
  return stored.startsWith('sha256$')
}

export async function hashPassword(plain: string) {
  const salt = randomSalt()
  const hex = await sha256Hex(`${salt}:${plain}`)
  return `sha256$${salt}$${hex}`
}

export async function verifyPassword(stored: string, plain: string) {
  if (!stored || plain == null) return false
  if (isHashedPassword(stored)) {
    const parts = stored.split('$')
    const salt = parts[1] || ''
    const hex = parts[2] || ''
    const check = await sha256Hex(`${salt}:${plain}`)
    return timingSafeEqual(check, hex)
  }
  return stored === plain
}

export function generateUsername(name: string, taken: Iterable<string>) {
  const used = new Set(Array.from(taken, (s) => s.toLowerCase()))
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 24) || 'member'
  if (!used.has(base)) return base
  for (let i = 0; i < 24; i++) {
    const suffix = Math.random().toString(36).slice(2, 5)
    const candidate = `${base}.${suffix}`
    if (!used.has(candidate)) return candidate
  }
  return `${base}.${Date.now().toString(36).slice(-4)}`
}

export function loginIdentity(u: User) {
  return (u.username || u.email.split('@')[0] || u.email).toLowerCase()
}

export function takenUsernames(users: User[], exceptId?: string) {
  return users
    .filter((u) => u.id !== exceptId)
    .flatMap((u) => [u.username || '', u.email.split('@')[0] || '', u.email])
    .filter(Boolean)
    .map((s) => s.toLowerCase())
}
