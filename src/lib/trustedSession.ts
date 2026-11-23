/** Trusted-session transport for the gradual API migration. A token held in
 * memory is not an authorization decision; the server validates every request.
 * Nothing in this module enables the API gate or migrates browser identities. */
type TrustedUser = { id: string; companyId: string; role: string; studentId?: string; branchId?: string }
type Session = { ok: true; user: TrustedUser; csrf: string }
let csrf: string | null = null
export function trustedCsrfHeaders(): Record<string,string> { return csrf ? { 'X-CSRF-Token': csrf } : {} }
export function clearTrustedSessionToken(): void { csrf = null }
function validated(value: unknown): Session {
  if (!value || typeof value !== 'object') throw new Error('Invalid server session response.')
  const s = value as Partial<Session>
  if (s.ok !== true || !s.user || typeof s.user.id !== 'string' || !s.user.id || typeof s.user.companyId !== 'string' || !s.user.companyId || typeof s.user.role !== 'string' || !s.user.role || typeof s.csrf !== 'string' || !s.csrf) throw new Error('Invalid server session response.')
  return s as Session
}
async function request(url: string, options: RequestInit): Promise<Session> {
  const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store' })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error((body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') ? body.error : `Session request failed (${response.status}).`)
  const session = validated(body)
  csrf = session.csrf
  return session
}
export async function trustedLogin(base: string, email: string, password: string): Promise<Session> {
  csrf = null
  return request(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ email, password }) })
}
export async function trustedRestore(base: string): Promise<Session> {
  csrf = null
  return request(`${base}/api/auth/session`, { method: 'GET' })
}
export async function trustedLogout(base: string): Promise<void> {
  const token = csrf
  csrf = null
  if (!token) throw new Error('No trusted session token; restore the session before signing out.')
  const response = await fetch(`${base}/api/auth/logout`, { method:'POST', credentials:'same-origin', cache:'no-store', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ csrf:token }) })
  if (!response.ok) throw new Error(`Server sign-out failed (${response.status}).`)
}
