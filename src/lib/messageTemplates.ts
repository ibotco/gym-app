import type { MessageTemplate } from '../types'

export const MESSAGE_TEMPLATES_KEY = 'fitpro_message_templates'

/** Placeholders available in every template body. */
export const TEMPLATE_PLACEHOLDERS = ['{{name}}', '{{clubName}}', '{{plan}}', '{{date}}', '{{amount}}', '{{phone}}']

export const TEMPLATE_EVENTS = [
  { value: 'welcome', label: 'New member welcome' },
  { value: 'membership_expiring', label: 'Membership expiring' },
  { value: 'payment_received', label: 'Payment received' },
  { value: 'password_reset', label: 'Password reset' },
  { value: 'appointment_reminder', label: 'Appointment reminder' },
  { value: 'custom', label: 'Custom / other' },
]

export const templateEventLabel = (value: string) =>
  TEMPLATE_EVENTS.find((e) => e.value === value)?.label || value

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'mt_email_welcome',
    channel: 'email',
    name: 'New member welcome',
    event: 'welcome',
    subject: 'Welcome to {{clubName}}!',
    body: 'Hi {{name}},\n\nWelcome to {{clubName}}! Your membership ({{plan}}) is now active.\n\nWe look forward to seeing you at the club.\n\nThe {{clubName}} team',
    active: true,
  },
  {
    id: 'mt_email_expiring',
    channel: 'email',
    name: 'Membership expiring',
    event: 'membership_expiring',
    subject: 'Your membership expires on {{date}}',
    body: 'Hi {{name}},\n\nYour membership at {{clubName}} expires on {{date}}. Renew now to keep access to classes, the floor and the app.\n\nThe {{clubName}} team',
    active: true,
  },
  {
    id: 'mt_email_payment',
    channel: 'email',
    name: 'Payment received',
    event: 'payment_received',
    subject: 'Payment received — thank you',
    body: 'Hi {{name}},\n\nWe have received your payment of {{amount}}. Thank you!\n\n{{clubName}} billing',
    active: true,
  },
  {
    id: 'mt_email_reset',
    channel: 'email',
    name: 'Password reset',
    event: 'password_reset',
    subject: 'Reset your {{clubName}} password',
    body: 'Hi {{name}},\n\nUse the link inside to reset your password. If you did not request this, you can safely ignore this email.\n\n{{clubName}}',
    active: true,
  },
  {
    id: 'mt_sms_welcome',
    channel: 'sms',
    name: 'New member welcome',
    event: 'welcome',
    body: 'Hi {{name}}, welcome to {{clubName}}! Your membership is active. See you soon!',
    active: true,
  },
  {
    id: 'mt_sms_expiring',
    channel: 'sms',
    name: 'Expiry reminder',
    event: 'membership_expiring',
    body: 'Hi {{name}}, your {{clubName}} membership expires on {{date}}. Renew to keep access.',
    active: true,
  },
  {
    id: 'mt_sms_payment',
    channel: 'sms',
    name: 'Payment received',
    event: 'payment_received',
    body: 'Thank you {{name}}. We received {{amount}} for your {{clubName}} membership.',
    active: true,
  },
]

export function loadMessageTemplates(): MessageTemplate[] {
  try {
    const raw = localStorage.getItem(MESSAGE_TEMPLATES_KEY)
    if (!raw) return MESSAGE_TEMPLATES
    const saved = JSON.parse(raw) as MessageTemplate[]
    return Array.isArray(saved) && saved.length ? saved : MESSAGE_TEMPLATES
  } catch {
    return MESSAGE_TEMPLATES
  }
}

export function saveMessageTemplates(templates: MessageTemplate[]) {
  try { localStorage.setItem(MESSAGE_TEMPLATES_KEY, JSON.stringify(templates)) } catch { /* ignore */ }
}
