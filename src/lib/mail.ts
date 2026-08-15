export type MailProvider = 'gmail' | 'smtp' | 'emailjs' | 'resend'

export interface MailConfig {
  live: boolean
  provider: MailProvider
  fromName: string
  fromEmail: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  emailjsPublicKey: string
  emailjsServiceId: string
  emailjsTemplateId: string
  resendKey: string
}

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
  emailjsPublicKey: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  resendKey: '',
})

export function loadMail(): MailConfig {
  try {
    const raw = localStorage.getItem(MAIL_KEY)
    if (raw) return { ...defaultMail(), ...JSON.parse(raw) }
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
  if (c.provider === 'gmail') return !!(c.smtpUser && c.smtpPass)
  if (c.provider === 'smtp') return !!(c.smtpHost && c.smtpUser && c.smtpPass && c.fromEmail)
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
}): Promise<{ ok: boolean; error?: string; live: boolean }> {
  const c = loadMail()
  if (!c.live) return { ok: false, live: false, error: 'Live email is turned off in Settings → Email.' }
  if (!mailReady(c)) {
    return { ok: false, live: false, error: 'Live email is not configured. Open Settings → Email and add Gmail or SMTP.' }
  }

  const fromEmail = c.fromEmail || c.smtpUser

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
            message: input.text || input.subject,
            ...(input.extra || {}),
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
        html: input.html,
        text: input.text,
        fromName: c.fromName || 'FitPro',
        fromEmail,
        smtpHost: c.provider === 'gmail' ? 'smtp.gmail.com' : c.smtpHost,
        smtpPort: Number(c.provider === 'gmail' ? 587 : c.smtpPort || 587),
        smtpUser: c.smtpUser,
        smtpPass: c.smtpPass,
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
