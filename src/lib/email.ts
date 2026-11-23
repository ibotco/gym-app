/** Shared email policy — used by the UI (client) and AuthContext (server simulation). */

export type EmailCheck = { ok: true; email: string } | { ok: false; error: string }

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase()
}

export function validateEmailAddress(raw: string): EmailCheck {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Enter your email address.' }
  if (/\s/.test(raw)) return { ok: false, error: 'Email cannot contain spaces.' }
  if (trimmed.length > 254) return { ok: false, error: 'That email is too long.' }
  const at = trimmed.indexOf('@')
  if (at < 1) return { ok: false, error: 'Enter a valid email, like name@example.com.' }
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  if (local.length > 64) return { ok: false, error: 'The part before @ is too long.' }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return { ok: false, error: 'Enter a valid email, like name@example.com.' }
  }
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) {
    return { ok: false, error: 'Enter a valid email, like name@example.com.' }
  }
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2) return { ok: false, error: 'Enter a valid email, like name@example.com.' }
  if (!EMAIL_RE.test(trimmed)) return { ok: false, error: 'Enter a valid email, like name@example.com.' }
  return { ok: true, email: normalizeEmail(trimmed) }
}

export function emailTaken(email: string, existing: string[], except?: string) {
  const n = normalizeEmail(email)
  const skip = except ? normalizeEmail(except) : ''
  return existing.some((e) => {
    const x = normalizeEmail(e)
    return x === n && x !== skip
  })
}

/** Server-side account policy. Always enforces format + uniqueness. */
export function validateEmailForAccount(
  raw: string,
  existing: string[],
  except?: string,
): EmailCheck {
  const format = validateEmailAddress(raw)
  if (!format.ok) return format
  if (emailTaken(format.email, existing, except)) {
    return { ok: false, error: 'An account with that email already exists. Sign in or use a different address.' }
  }
  return format
}
