import type { CredentialChannel, CredentialDeliveryResult, CredentialVars, MessagingConfig } from '../types'
import { credentialEmailHtml, phoneDigits, renderTemplate } from './credentials'
import { loadMail, mailReady, sendHtmlEmail } from './mail'

export async function deliverCredentials(input: {
  channels: CredentialChannel[]
  email: string
  phone: string
  vars: CredentialVars
  templates: { emailSubject: string; emailBody: string; whatsappBody: string; smsBody: string }
  messaging: MessagingConfig
}): Promise<CredentialDeliveryResult[]> {
  const results: CredentialDeliveryResult[] = []
  for (const channel of input.channels) {
    const at = new Date().toISOString()
    try {
      if (channel === 'email') {
        results.push(await sendEmailChannel(input.email, input.vars, input.templates))
      } else if (channel === 'whatsapp') {
        results.push(await sendWhatsAppChannel(input.phone, input.vars, input.templates.whatsappBody, input.messaging))
      } else {
        results.push(await sendSmsChannel(input.phone, input.vars, input.templates.smsBody, input.messaging))
      }
    } catch (e) {
      results.push({
        channel,
        status: 'failed',
        at,
        error: e instanceof Error ? e.message : 'Delivery failed',
      })
    }
  }
  return results
}

async function sendEmailChannel(
  to: string,
  vars: CredentialVars,
  templates: { emailSubject: string; emailBody: string },
): Promise<CredentialDeliveryResult> {
  const at = new Date().toISOString()
  if (!to || !to.includes('@')) {
    return { channel: 'email', status: 'failed', at, error: 'Member has no email address.' }
  }
  const subject = renderTemplate(templates.emailSubject, vars)
  const body = renderTemplate(templates.emailBody, vars)
  const html = credentialEmailHtml(subject, body, vars.clubName)
  const cfg = loadMail()
  if (!cfg.live || !mailReady(cfg)) {
    return {
      channel: 'email',
      status: 'failed',
      at,
      error: 'Live email is not configured. Open Settings → Email, or copy the details from the one-time reveal.',
    }
  }
  const r = await sendHtmlEmail({
    to,
    name: vars.name,
    subject,
    html,
    text: body,
    extra: {
      username: vars.username,
      password: vars.password,
      portal_url: vars.portalUrl,
      message: body,
    },
  })
  if (!r.ok) return { channel: 'email', status: 'failed', at, error: r.error || 'Email was not sent.' }
  return { channel: 'email', status: 'sent', at }
}

async function sendWhatsAppChannel(
  phone: string,
  vars: CredentialVars,
  template: string,
  messaging: MessagingConfig,
): Promise<CredentialDeliveryResult> {
  const at = new Date().toISOString()
  const digits = phoneDigits(phone)
  if (!digits || digits.length < 8) {
    return { channel: 'whatsapp', status: 'failed', at, error: 'Member has no WhatsApp number.' }
  }
  const text = renderTemplate(template, vars)

  if (messaging.whatsappMode === 'cloud' || messaging.whatsappMode === 'webhook') {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'whatsapp',
        mode: messaging.whatsappMode,
        to: digits,
        message: text,
        phoneNumberId: messaging.whatsappPhoneNumberId,
        token: messaging.whatsappToken,
        webhookUrl: messaging.whatsappWebhookUrl,
      }),
    })
    const data = await r.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (!r.ok || !data.ok) {
      return { channel: 'whatsapp', status: 'failed', at, error: data.error || `WhatsApp error ${r.status}` }
    }
    return { channel: 'whatsapp', status: 'sent', at }
  }

  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return { channel: 'whatsapp', status: 'opened', at }
}

async function sendSmsChannel(
  phone: string,
  vars: CredentialVars,
  template: string,
  messaging: MessagingConfig,
): Promise<CredentialDeliveryResult> {
  const at = new Date().toISOString()
  const digits = phoneDigits(phone)
  if (!digits || digits.length < 8) {
    return { channel: 'sms', status: 'failed', at, error: 'Member has no mobile number.' }
  }
  const text = renderTemplate(template, vars)

  if (messaging.smsMode === 'hubtel' || messaging.smsMode === 'webhook') {
    const r = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'sms',
        mode: messaging.smsMode,
        to: digits,
        message: text,
        webhookUrl: messaging.smsWebhookUrl,
        hubtelClientId: messaging.hubtelClientId,
        hubtelClientSecret: messaging.hubtelClientSecret,
        hubtelFrom: messaging.hubtelFrom || 'FitPro',
      }),
    })
    const data = await r.json().catch(() => ({})) as { ok?: boolean; error?: string }
    if (!r.ok || !data.ok) {
      return { channel: 'sms', status: 'failed', at, error: data.error || `SMS error ${r.status}` }
    }
    return { channel: 'sms', status: 'sent', at }
  }

  const url = `sms:+${digits}?body=${encodeURIComponent(text)}`
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return { channel: 'sms', status: 'opened', at }
}

export function channelLabel(c: CredentialChannel) {
  if (c === 'email') return 'Email'
  if (c === 'whatsapp') return 'WhatsApp'
  return 'SMS'
}

export function statusLabel(s: CredentialDeliveryResult['status']) {
  if (s === 'sent') return 'Sent'
  if (s === 'opened') return 'Opened on this device'
  return 'Failed'
}
