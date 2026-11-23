import { useEffect, useState } from 'react'
import { BellRing, Mail, MessageCircle, MessageSquareText } from 'lucide-react'
import { Badge, Button, Field, Input, PageHeader, Switch, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import {
  APPROVAL_NOTIFICATION_TEMPLATE_EVENT,
  APPROVAL_NOTIFICATION_TEMPLATE_PLACEHOLDERS,
  loadApprovalNotificationTemplates,
  saveApprovalNotificationTemplates,
  type ApprovalNotificationChannel,
  type ApprovalNotificationTemplate,
} from '../../../lib/approvalNotificationTemplates'

type ChannelDef = { key: ApprovalNotificationChannel; label: string; icon: typeof Mail; hint: string }

const CHANNELS: ChannelDef[] = [
  { key: 'email', label: 'Email', icon: Mail, hint: 'An email subject and message body.' },
  { key: 'sms', label: 'SMS', icon: MessageSquareText, hint: 'A concise text message; long messages may require multiple SMS segments.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: 'A WhatsApp message body template.' },
]

export function ApprovalNotificationsAdmin() {
  const app = useApp()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const companyName = app.activeCompany?.name || 'Current company'
  const branchName = app.activeBranch?.name || 'Current branch'
  const [templates, setTemplates] = useState<ApprovalNotificationTemplate[]>(() => loadApprovalNotificationTemplates(companyId))
  const [activeChannel, setActiveChannel] = useState<ApprovalNotificationChannel>('email')

  useEffect(() => {
    setTemplates(loadApprovalNotificationTemplates(companyId))
  }, [companyId])

  useEffect(() => {
    const refresh = () => setTemplates(loadApprovalNotificationTemplates(companyId))
    window.addEventListener(APPROVAL_NOTIFICATION_TEMPLATE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(APPROVAL_NOTIFICATION_TEMPLATE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [companyId])

  const currentChannel = CHANNELS.find((channel) => channel.key === activeChannel) ?? CHANNELS[0]
  const currentTemplate = templates.find((template) => template.channel === activeChannel) ?? {
    channel: activeChannel,
    subject: '',
    body: '',
    active: true,
  }

  const updateTemplate = (patch: Partial<ApprovalNotificationTemplate>) => {
    setTemplates((current) => current.map((template) => template.channel === activeChannel ? { ...template, ...patch } : template))
  }

  const saveCurrentTemplate = () => {
    if (!currentTemplate.body.trim() || (activeChannel === 'email' && !currentTemplate.subject.trim())) {
      toast.error('Complete the template before saving', activeChannel === 'email' ? 'Add an email subject and message.' : 'Add a message body.')
      return
    }
    const next = templates.map((template) => template.channel === activeChannel
      ? { ...template, updatedAt: new Date().toISOString() }
      : template)
    if (!saveApprovalNotificationTemplates(companyId, next)) {
      toast.error('Approval notification template could not be saved', 'Check browser storage and try again.')
      return
    }
    setTemplates(loadApprovalNotificationTemplates(companyId))
    toast.success(`${currentChannel.label} approval template saved`)
  }

  const smsLength = activeChannel === 'sms' ? currentTemplate.body.length : 0

  return (
    <div>
      <PageHeader
        eyebrow="Communications"
        title="Approval notifications"
        desc="Set up Email, SMS and WhatsApp approval templates. Settings are saved in this browser; this page does not send messages."
        actions={<Badge tone="sky">{companyName} · {branchName}</Badge>}
      />

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Notification templates</h2>
            <p className="mt-1 text-xs text-mist">Create one reusable approval message for each channel.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-mist"><BellRing className="size-4" /> Approval message template</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Notification template channel">
          {CHANNELS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeChannel === key}
              onClick={() => setActiveChannel(key)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${activeChannel === key ? 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300' : 'border-line text-mist hover:text-inherit'}`}
            >
              <Icon className="size-4" /> Template for {label}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">Template for {currentChannel.label}</h3>
              <p className="mt-1 text-xs text-mist">{currentChannel.hint}</p>
            </div>
            {currentTemplate.updatedAt && <span className="text-[11px] text-mist">Saved {new Date(currentTemplate.updatedAt).toLocaleString()}</span>}
          </div>
          {activeChannel === 'email' && (
            <Field label="Email subject" required>
              <Input value={currentTemplate.subject} onChange={(event) => updateTemplate({ subject: event.target.value })} placeholder="Approval requested: {{documentNo}}" />
            </Field>
          )}
          <Field label={activeChannel === 'email' ? 'Email message' : `${currentChannel.label} message`} required>
            <Textarea
              rows={activeChannel === 'email' ? 8 : 5}
              value={currentTemplate.body}
              onChange={(event) => updateTemplate({ body: event.target.value })}
              placeholder="Write the approval notification message…"
            />
          </Field>
          {activeChannel === 'sms' && (
            <p className={`mt-1 text-[11px] font-semibold ${smsLength > 160 ? 'text-amber-600 dark:text-amber-400' : 'text-mist'}`}>
              {smsLength} characters{smsLength > 160 ? ' — may be split into multiple SMS parts.' : ' · 160 characters per SMS segment.'}
            </p>
          )}
          <div className="mt-3 rounded-lg bg-black/[0.03] p-3 text-xs text-mist dark:bg-white/[0.04]">
            <p className="font-semibold text-inherit">Placeholder tokens (stored as text)</p>
            <p className="mt-1 break-words">These tokens are not expanded or sent by this page: {APPROVAL_NOTIFICATION_TEMPLATE_PLACEHOLDERS.join(' · ')}</p>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <span>Template active</span>
              <Switch checked={currentTemplate.active} onChange={(active) => updateTemplate({ active })} aria-label={`${currentChannel.label} template active`} />
            </label>
            <Button type="button" variant="lime" onClick={saveCurrentTemplate}>Save {currentChannel.label} template</Button>
          </div>
        </div>
      </section>
    </div>
  )
}
