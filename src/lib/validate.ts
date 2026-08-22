const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function isEmail(v: string) {
  const s = v.trim()
  if (!s || s.length > 254) return false
  return EMAIL_RE.test(s)
}

export function emailError(v: string) {
  const s = v.trim()
  if (!s) return 'Enter your email address.'
  if (!s.includes('@')) return 'Email must include an @ symbol, like name@example.com.'
  const parts = s.split('@')
  if (parts.length !== 2) return 'Enter a valid email address, like name@example.com.'
  if (!parts[0]) return 'Enter a name before the @ symbol.'
  if (!parts[1] || !parts[1].includes('.')) return 'Enter a domain after the @, like name@example.com.'
  if (s.includes(' ')) return 'Email cannot contain spaces.'
  if (!isEmail(s)) return 'Enter a valid email address, like name@example.com.'
  return ''
}

export function isPhone(v: string) {
  const d = v.replace(/[^\d+]/g, '')
  return d.length >= 8
}

export function required(v: string, label: string) {
  if (!v.trim()) return `${label} is required`
  return ''
}

export function firstError(errors: Record<string, string>) {
  return Object.values(errors).find(Boolean) || ''
}
