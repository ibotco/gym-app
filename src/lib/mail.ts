import { loadCompanyEmailSettings, validEmail } from './companyEmailSettings'
export type MailProvider = 'gmail' | 'smtp' | 'emailjs' | 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'postmark'
export type SmtpProfile = { smtpHost:string; smtpPort:string; smtpUser:string; smtpPass:string; smtpSecurity:'ssl'|'tls'; smtpAuth:boolean }
export function usesSmtp(provider: MailProvider) { return ['gmail','smtp','sendgrid','mailgun','ses','postmark'].includes(provider) }
export function switchMailProvider(c: MailConfig, provider: MailProvider): MailConfig {
 const profiles = {...c.smtpProfiles}
 if (usesSmtp(c.provider)) profiles[c.provider] = {smtpHost:c.smtpHost,smtpPort:c.smtpPort,smtpUser:c.smtpUser,smtpPass:c.smtpPass,smtpSecurity:c.smtpSecurity,smtpAuth:c.smtpAuth}
 if (!usesSmtp(provider)) return {...c,provider,smtpProfiles:profiles}
 const defaults: SmtpProfile = {smtpHost:provider==='gmail' ? 'smtp.gmail.com' : provider==='sendgrid' ? 'smtp.sendgrid.net' : provider==='postmark' ? 'smtp.postmarkapp.com' : '',smtpPort:'587',smtpUser:provider==='sendgrid' ? 'apikey' : '',smtpPass:'',smtpSecurity:'tls',smtpAuth:true}
 return {...c,...(profiles[provider] || defaults),provider,smtpProfiles:profiles}
}

export interface MailConfig {
  live: boolean
  provider: MailProvider
  fromName: string
  fromEmail: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpSecurity: 'ssl' | 'tls'
  smtpAuth: boolean
  mailType: 'html' | 'text'
  smtpProfiles?: Partial<Record<MailProvider, SmtpProfile>>
  emailProviders?: EmailProviderEntry[]
  emailDefault?: MailProvider | null
  emailjsPublicKey: string
  emailjsServiceId: string
  emailjsTemplateId: string
  resendKey: string
}

export type EmailProviderEntry = { provider: MailProvider; active: boolean; config: Omit<MailConfig, 'emailProviders' | 'emailDefault'> }

export const MAIL_KEY = 'fitpro_mail'

export const defaultMail = (): MailConfig => ({
  live: true,
  provider: 'gmail',
  fromName: 'FitPro',
  fromEmail: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpSecurity: 'tls',
  smtpAuth: true,
  mailType: 'html',
  emailjsPublicKey: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  resendKey: '',
})

export function loadMail(): MailConfig {
  try {
    const raw = localStorage.getItem(MAIL_KEY)
    if (raw) { const saved = JSON.parse(raw); return { ...defaultMail(), ...saved, smtpSecurity: saved.smtpSecurity || (String(saved.smtpPort) === '465' ? 'ssl' : 'tls') } }
  } catch {
    /* ignore */
  }
  return defaultMail()
}

export function saveMail(c: MailConfig) {
  localStorage.setItem(MAIL_KEY, JSON.stringify(c))
}

export function mailReady(c = loadMail()) {
  if (!c.live) return false
  if (c.provider === 'gmail') return !!((c.fromEmail || c.smtpUser) && (!c.smtpAuth || (c.smtpUser && c.smtpPass)))
  if (usesSmtp(c.provider)) return !!(c.smtpHost && (c.fromEmail || c.smtpUser) && (!c.smtpAuth || (c.smtpUser && c.smtpPass)))
  if (c.provider === 'emailjs') return !!(c.emailjsPublicKey && c.emailjsServiceId && c.emailjsTemplateId)
  if (c.provider === 'resend') return !!(c.resendKey && (c.fromEmail || c.smtpUser))
  return false
}

export function verifyEmailHtml(name: string, code: string) {
  const who = name.trim() || 'there'
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f3ee;font-family:Manrope,Segoe UI,Arial,sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #ece8e1">
    <div style="width:48px;height:48px;border-radius:14px;background:#141414;color:#fff;text-align:center;line-height:48px;font-weight:700">F</div>
    <h1 style="font-size:24px;margin:20px 0 8px;color:#111">Verify your email</h1>
    <p style="color:#6b7280;font-size:15px;margin:0 0 20px">Hi ${escapeHtml(who)}, use this code to activate your FitPro membership.</p>
    <div style="letter-spacing:10px;font-size:32px;font-weight:700;color:#111;background:#f4f2ee;border-radius:12px;padding:16px 8px;text-align:center">${escapeHtml(code)}</div>
    <p style="color:#9ca3af;font-size:12px;margin:20px 0 0">This code expires in 15 minutes. If you did not join FitPro, ignore this email.</p>
  </div>
</body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch))
}

export async function sendHtmlEmail(input: {
  to: string
  name?: string
  subject: string
  html: string
  text?: string
  code?: string
  extra?: Record<string, string>
  companyId?: string
}): Promise<{ ok: boolean; error?: string; live: boolean }> {
  const c = loadMail()
  if (!c.live) return { ok: false, live: false, error: 'Live email is turned off in Settings → Email.' }
  if (!mailReady(c)) {
    return { ok: false, live: false, error: 'Live email is not configured. Open Settings → Email and add Gmail or SMTP.' }
  }

  const fromEmail = c.fromEmail || c.smtpUser
  const settings = loadCompanyEmailSettings(input.companyId)
  if (settings.replyTo && !validEmail(settings.replyTo)) return { ok: false, live: false, error: 'Invalid reply-to address in Email settings.' }
  if (settings.sendCopy && !validEmail(fromEmail)) return { ok: false, live: false, error: 'A valid provider From email is required to send copies.' }
  if (c.provider === 'emailjs' && (settings.replyTo || settings.sendCopy)) return { ok: false, live: false, error: 'EmailJS cannot reliably apply reply-to or send-copy settings; use another provider or turn those settings off.' }
  const additions = [settings.signature, settings.footer].filter(x => x.trim())
  const extraHtml = additions.map(x => `<div style="white-space:pre-wrap;margin-top:16px">${escapeHtml(x)}</div>`).join('')
  const html = /<\/body\s*>/i.test(input.html) ? input.html.replace(/<\/body\s*>/i, extraHtml + '</body>') : input.html + extraHtml
  const baseText = input.text || input.html.replace(/<[^>]*>/g, ' ')
  const text = [baseText, ...additions].join('\n\n')

  try {
    if (c.provider === 'emailjs') {
      const r = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: c.emailjsServiceId,
          template_id: c.emailjsTemplateId,
          user_id: c.emailjsPublicKey,
          template_params: {
            to_email: input.to,
            to_name: input.name || '',
            code: input.code || '',
            subject: input.subject,
            from_name: c.fromName || 'FitPro',
            ...(input.extra || {}),
            message: text || input.subject,
          },
        }),
      })
      if (!r.ok) {
        const t = await r.text()
        return { ok: false, live: true, error: t || `EmailJS error ${r.status}` }
      }
      return { ok: true, live: true }
    }

    const r = await fetch('/api/mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: c.provider,
        to: input.to,
        name: input.name,
        code: input.code,
        subject: input.subject,
        html,
        text,
        replyTo: settings.replyTo,
        bcc: settings.sendCopy ? fromEmail : '',
        fromName: c.fromName || 'FitPro',
        fromEmail,
        smtpHost: c.provider === 'gmail' ? 'smtp.gmail.com' : c.smtpHost,
        smtpPort: Number(c.smtpPort || (c.smtpSecurity === 'ssl' ? 465 : 587)),
        smtpUser: c.smtpUser,
        smtpPass: c.smtpPass,
        smtpSecurity: c.smtpSecurity,
        smtpAuth: c.smtpAuth,
        mailType: c.mailType,
        resendKey: c.resendKey,
      }),
    })
    const raw = await r.text()
    let data: { ok?: boolean; error?: string } = {}
    try { data = JSON.parse(raw) as { ok?: boolean; error?: string } } catch { /* not json */ }
    if (!r.ok || !data.ok) {
      const hint = /nodemailer/i.test(raw)
        ? 'Restart FitPro after this update (Stop then Start). Mail no longer needs nodemailer.'
        : (data.error || raw.slice(0, 180) || `Mail server error ${r.status}`)
      return { ok: false, live: true, error: hint }
    }
    return { ok: true, live: true }
  } catch (e) {
    return { ok: false, live: true, error: e instanceof Error ? e.message : 'Could not send email' }
  }
}

export async function sendVerificationEmail(input: {
  to: string
  name: string
  code: string
}): Promise<{ ok: boolean; error?: string; live: boolean }> {
  return sendHtmlEmail({
    to: input.to,
    name: input.name,
    code: input.code,
    subject: `${input.code} is your FitPro verification code`,
    html: verifyEmailHtml(input.name, input.code),
    text: `Your FitPro verification code is ${input.code}`,
  })
}

// ---- Live email settings helper (used by Settings → Email) ----

export interface MailStatus {
  configured: boolean
  preset?: string
  host?: string
  port?: number
  user?: string
  fromName?: string
  fromEmail?: string
}

export async function mailStatus(): Promise<MailStatus> {
  const c = loadMail()
  return {
    configured: mailReady(c),
    preset: c.provider,
    host: c.smtpHost,
    port: Number(c.smtpPort || 587),
    user: c.smtpUser,
    fromName: c.fromName,
    fromEmail: c.fromEmail || c.smtpUser,
  }
}

export async function saveMailConfig(input: {
  enabled: boolean
  preset: string
  host: string
  port: number
  user: string
  pass: string
  fromName: string
  fromEmail: string
}): Promise<MailStatus & { ok: boolean; error?: string }> {
  if (!input.user.trim()) {
    return { ...(await mailStatus()), ok: false, error: 'Enter the mailbox email first.' }
  }
  const valid = ['gmail', 'smtp', 'emailjs', 'resend', 'sendgrid', 'mailgun', 'ses', 'postmark'] as const
  const provider: MailProvider = (valid as readonly string[]).includes(input.preset)
    ? (input.preset as MailProvider)
    : 'smtp'
  const prev = loadMail()
  const cfg: MailConfig = {
    ...defaultMail(),
    live: input.enabled,
    provider,
    fromName: input.fromName.trim() || 'FitPro',
    fromEmail: input.fromEmail.trim(),
    smtpHost: input.host.trim() || 'smtp.gmail.com',
    smtpPort: String(input.port || 587),
    smtpUser: input.user.trim(),
    smtpPass: input.pass || prev.smtpPass,
    smtpSecurity: prev.smtpSecurity, smtpAuth: prev.smtpAuth, mailType: prev.mailType,
    emailjsPublicKey: '',
    emailjsServiceId: '',
    emailjsTemplateId: '',
    resendKey: '',
  }
  saveMail(cfg)
  return { ...(await mailStatus()), ok: true }
}

export async function sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
  if (!to || !to.includes('@')) return { ok: false, error: 'Enter a valid test address.' }
  const r = await sendHtmlEmail({
    to,
    name: 'FitPro admin',
    subject: 'FitPro test email',
    html: '<p style="font-family:sans-serif">This is a test email from FitPro. Your live email is working.</p>',
    text: 'This is a test email from FitPro. Your live email is working.',
  })
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}
