export type ApprovalNotificationChannel = 'email' | 'sms' | 'whatsapp'

export interface ApprovalNotificationTemplate {
  channel: ApprovalNotificationChannel
  subject: string
  body: string
  active: boolean
  updatedAt?: string
}

export const APPROVAL_NOTIFICATION_TEMPLATE_EVENT = 'approval-notification-templates-updated'
export const APPROVAL_NOTIFICATION_TEMPLATE_PLACEHOLDERS = [
  '{{approverName}}',
  '{{requesterName}}',
  '{{documentNo}}',
  '{{documentType}}',
  '{{workflowName}}',
  '{{amount}}',
  '{{approvalLink}}',
  '{{clubName}}',
]

const DEFAULT_TEMPLATES: Record<ApprovalNotificationChannel, ApprovalNotificationTemplate> = {
  email: {
    channel: 'email',
    subject: 'Approval requested: {{documentNo}}',
    body: 'Hello {{approverName}},\n\n{{requesterName}} submitted {{documentType}} {{documentNo}} for {{amount}}. Please review this request in Pending Approvals.\n\nWorkflow: {{workflowName}}\n\n{{clubName}}',
    active: true,
  },
  sms: {
    channel: 'sms',
    subject: '',
    body: 'Approval needed: {{documentNo}} ({{documentType}}) for {{amount}}. Review: {{approvalLink}}',
    active: true,
  },
  whatsapp: {
    channel: 'whatsapp',
    subject: '',
    body: 'Hello {{approverName}}, an approval is waiting for you. {{requesterName}} submitted {{documentType}} {{documentNo}} for {{amount}}.\nWorkflow: {{workflowName}}\nReview: {{approvalLink}}',
    active: true,
  },
}

const storageKey = (companyId?: string) => `fitpro_approval_notification_templates_v1_${companyId || 'default'}`

export function loadApprovalNotificationTemplates(companyId?: string): ApprovalNotificationTemplate[] {
  try {
    const raw = localStorage.getItem(storageKey(companyId))
    if (!raw) return Object.values(DEFAULT_TEMPLATES).map((template) => ({ ...template }))
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return Object.values(DEFAULT_TEMPLATES).map((template) => ({ ...template }))
    const saved = parsed.filter((item): item is Partial<ApprovalNotificationTemplate> & { channel: ApprovalNotificationChannel } =>
      !!item && typeof item === 'object' &&
      ['email', 'sms', 'whatsapp'].includes(String((item as { channel?: unknown }).channel)),
    )
    return (Object.keys(DEFAULT_TEMPLATES) as ApprovalNotificationChannel[]).map((channel) => {
      const base = DEFAULT_TEMPLATES[channel]
      const stored = saved.find((item) => item.channel === channel)
      return {
        ...base,
        ...(stored ? {
          subject: typeof stored.subject === 'string' ? stored.subject : base.subject,
          body: typeof stored.body === 'string' ? stored.body : base.body,
          active: typeof stored.active === 'boolean' ? stored.active : base.active,
          updatedAt: typeof stored.updatedAt === 'string' ? stored.updatedAt : undefined,
        } : {}),
      }
    })
  } catch {
    return Object.values(DEFAULT_TEMPLATES).map((template) => ({ ...template }))
  }
}

export function saveApprovalNotificationTemplates(companyId: string | undefined, templates: ApprovalNotificationTemplate[]): boolean {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(templates))
    window.dispatchEvent(new Event(APPROVAL_NOTIFICATION_TEMPLATE_EVENT))
    return true
  } catch {
    return false
  }
}
