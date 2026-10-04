import type {
  CredentialSettings,
  CredentialTemplates,
  CredentialVars,
  InitialPasswordMode,
  MessagingConfig,
  PasswordPolicy,
} from '../types'
import { defaultPasswordPolicy, generateTempPassword } from './password'

export const CRED_SETTINGS_KEY = 'fitpro_cred'
export const CRED_EVENTS_KEY = 'fitpro_cred_events'
export const CRED_REVEAL_KEY = 'fitpro_cred_reveal'
export const USERS_KEY = 'fitpro_users'

export const REVEAL_TTL_MS = 15 * 60 * 1000

export const defaultTemplates = (): CredentialTemplates => ({
  emailSubject: 'Your FitPro login details',
  emailBody: `Hi {{name}},

Your FitPro portal login has been updated.

Portal: {{portalUrl}}
Username: {{username}}
Temporary password: {{password}}

First-time login
1. Open the portal URL above.
2. Sign in with the username and temporary password.
3. You will be asked to choose a new password before you can continue.
4. The temporary password stops working as soon as you save the new one.

Need help? {{supportPhone}} · {{supportEmail}}

— {{clubName}}`,
  whatsappBody: `Hi {{name}} — your FitPro login was updated.

Portal: {{portalUrl}}
Username: {{username}}
Temporary password: {{password}}

You must set a new password the next time you sign in.

Support: {{supportPhone}}`,
  smsBody: `FitPro login {{portalUrl}} user {{username}} temp {{password}} — change it after you sign in.`,
})

export const defaultMessaging = (): MessagingConfig => ({
  whatsappMode: 'link',
  whatsappPhoneNumberId: '',
  whatsappToken: '',
  whatsappWebhookUrl: '',
  smsMode: 'link',
  smsWebhookUrl: '',
  hubtelClientId: '',
  hubtelClientSecret: '',
  hubtelFrom: 'FitPro',
  supportPhone: '',
  supportEmail: '',
})

export const defaultCredentialSettings = (): CredentialSettings => ({
  policy: defaultPasswordPolicy(),
  templates: defaultTemplates(),
  messaging: defaultMessaging(),
  initialPasswordMode: 'auto',
})

export function loadCredentialSettings(): CredentialSettings {
  const base = defaultCredentialSettings()
  try {
    const raw = localStorage.getItem(CRED_SETTINGS_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<CredentialSettings>
    return {
      policy: { ...base.policy, ...(parsed.policy || {}) },
      templates: { ...base.templates, ...(parsed.templates || {}) },
      messaging: { ...base.messaging, ...(parsed.messaging || {}) },
      initialPasswordMode: parsed.initialPasswordMode === 'phone' ? 'phone' : 'auto',
    }
  } catch {
    return base
  }
}

/** Local digits a Ghana member would type, e.g. +233 24 555 0101 → 0245550101 */
export function phoneAsPassword(phone: string) {
  let d = phone.replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('233') && d.length >= 12) return `0${d.slice(3)}`
  return d
}

export function issueInitialPassword(
  mode: InitialPasswordMode,
  phone: string,
  policy: PasswordPolicy,
): { ok: true; password: string; mode: InitialPasswordMode } | { ok: false; error: string } {
  if (mode === 'phone') {
    const password = phoneAsPassword(phone)
    if (password.length < 8) {
      return { ok: false, error: 'This member has no usable phone number. Add a phone or switch to auto-generate.' }
    }
    return { ok: true, password, mode: 'phone' }
  }
  return { ok: true, password: generateTempPassword(policy), mode: 'auto' }
}

export function saveCredentialSettings(s: CredentialSettings) {
  localStorage.setItem(CRED_SETTINGS_KEY, JSON.stringify(s))
}

export function portalLoginUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5173/login'
  return `${window.location.origin}/login`
}

export function renderTemplate(tpl: string, vars: CredentialVars) {
  return tpl
    .replaceAll('{{name}}', vars.name)
    .replaceAll('{{username}}', vars.username)
    .replaceAll('{{password}}', vars.password)
    .replaceAll('{{portalUrl}}', vars.portalUrl)
    .replaceAll('{{supportPhone}}', vars.supportPhone)
    .replaceAll('{{supportEmail}}', vars.supportEmail)
    .replaceAll('{{clubName}}', vars.clubName)
}

export function buildCredentialVars(input: {
  name: string
  username: string
  password: string
  companyName: string
  companyPhone: string
  companyEmail: string
  messaging?: MessagingConfig
}): CredentialVars {
  const m = input.messaging || loadCredentialSettings().messaging
  return {
    name: input.name.trim() || 'there',
    username: input.username,
    password: input.password,
    portalUrl: portalLoginUrl(),
    supportPhone: m.supportPhone || input.companyPhone || '+233 30 396 4400',
    supportEmail: m.supportEmail || input.companyEmail || 'hello@fitpro.gym',
    clubName: input.companyName || 'FitPro',
  }
}

export function phoneDigits(phone: string) {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 10) d = `233${d.slice(1)}`
  return d
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))
}

export function credentialEmailHtml(subject: string, body: string, clubName: string) {
  const htmlBody = escapeHtml(body).replace(/\n/g, '<br/>')
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f3ee;font-family:Manrope,Segoe UI,Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #ece8e1">
    <div style="width:48px;height:48px;border-radius:14px;background:#141414;color:#fff;text-align:center;line-height:48px;font-weight:700">F</div>
    <h1 style="font-size:22px;margin:20px 0 12px;color:#111">${escapeHtml(subject)}</h1>
    <div style="color:#374151;font-size:15px;line-height:1.55">${htmlBody}</div>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">This message was sent by ${escapeHtml(clubName)}. If you did not expect it, contact the club.</p>
  </div>
</body></html>`
}

export interface RevealRecord {
  userId: string
  username: string
  password: string
  expires: number
  issuedAt: string
}

function readRevealMap(): Record<string, RevealRecord> {
  try {
    const raw = sessionStorage.getItem(CRED_REVEAL_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, RevealRecord>
    const now = Date.now()
    const next: Record<string, RevealRecord> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v && v.expires > now && v.password) next[k] = v
    }
    return next
  } catch {
    return {}
  }
}

function writeRevealMap(map: Record<string, RevealRecord>) {
  sessionStorage.setItem(CRED_REVEAL_KEY, JSON.stringify(map))
}

export function saveReveal(userId: string, username: string, password: string) {
  const map = readRevealMap()
  map[userId] = {
    userId,
    username,
    password,
    expires: Date.now() + REVEAL_TTL_MS,
    issuedAt: new Date().toISOString(),
  }
  writeRevealMap(map)
}

export function loadReveal(userId: string): RevealRecord | null {
  const rec = readRevealMap()[userId]
  if (!rec || rec.expires <= Date.now()) return null
  return rec
}

export function clearReveal(userId: string) {
  const map = readRevealMap()
  delete map[userId]
  writeRevealMap(map)
}

export function policySummary(policy: PasswordPolicy) {
  const bits = [`${policy.minLength}+ characters`]
  if (policy.requireUpper) bits.push('uppercase')
  if (policy.requireLower) bits.push('lowercase')
  if (policy.requireNumber) bits.push('number')
  if (policy.requireSpecial) bits.push('symbol')
  return bits.join(' · ')
}
