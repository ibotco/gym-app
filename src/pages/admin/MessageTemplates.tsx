import { useMemo, useState } from 'react'
import { Info, Mail, MessageSquareText, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, Field, Input, Modal, PageHeader, Select, Switch } from '../../components/ui'
import { plainToHtml, RichBodyEditor, stripHtml } from '../../components/RichBodyEditor'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { TEMPLATE_EVENTS, TEMPLATE_PLACEHOLDERS, templateEventLabel } from '../../lib/messageTemplates'
import type { MessageChannel, MessageTemplate, MessageTemplateAttachment } from '../../types'

const CONFIG: Record<MessageChannel, {
  title: string
  desc: string
  noun: string
  lowerNoun: string
  hasSubject: boolean
  icon: typeof Mail
  hint: string
}> = {
  email: {
    title: 'Email templates',
    desc: 'Reusable email messages for member communications. Placeholders are filled in automatically when a message is sent.',
    noun: 'Email template',
    lowerNoun: 'email template',
    hasSubject: true,
    icon: Mail,
    hint: 'One short subject plus a few lines reads best.',
  },
  sms: {
    title: 'SMS templates',
    desc: 'Reusable text messages for member communications. Keep messages under 160 characters to stay in a single SMS part.',
    noun: 'SMS template',
    lowerNoun: 'SMS template',
    hasSubject: false,
    icon: MessageSquareText,
    hint: 'SMS is delivered as plain text — formatting is stripped on send.',
  },
}

const MAX_ATTACHMENTS = 3
const MAX_ATTACH_SIZE = 512 * 1024 // 512 KB per file (kept small for browser storage)

const formatBytes = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

const readDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(f)
  })

const emptyForm = (channel: MessageChannel) => ({
  name: '',
  event: 'custom',
  subject: '',
  body: '',
  attachments: [] as MessageTemplateAttachment[],
  active: true,
})
type TemplateForm = ReturnType<typeof emptyForm>

export function MessageTemplates({ channel }: { channel: MessageChannel }) {
  const cfg = CONFIG[channel]
  const Icon = cfg.icon
  const { messageTemplates, upsertMessageTemplate, deleteMessageTemplate } = useApp()
  const toast = useToast()

  const templates = useMemo(
    () => messageTemplates.filter((t) => t.channel === channel),
    [messageTemplates, channel],
  )

  const [form, setForm] = useState<TemplateForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<MessageTemplate | null>(null)

  const openCreate = () => { setEditingId(null); setForm(emptyForm(channel)) }
  const openEdit = (t: MessageTemplate) => {
    setEditingId(t.id)
    setForm({ name: t.name, event: t.event, subject: t.subject || '', body: t.body, attachments: [...(t.attachments ?? [])], active: t.active })
  }

  const attachFiles = async (list: FileList | null) => {
    if (!form || !list || list.length === 0) return
    const room = MAX_ATTACHMENTS - form.attachments.length
    if (room <= 0) { toast.error('Attachment limit reached', `Up to ${MAX_ATTACHMENTS} files per email template.`); return }
    const picked = Array.from(list).slice(0, room)
    if (list.length > picked.length) toast.error('Too many files', `Only ${MAX_ATTACHMENTS} attachments are allowed — the rest were skipped.`)
    const accepted: MessageTemplateAttachment[] = []
    for (const f of picked) {
      if (f.size > MAX_ATTACH_SIZE) { toast.error('Attachment too large', `${f.name} exceeds the 512 KB limit.`); continue }
      try { accepted.push({ name: f.name, size: f.size, type: f.type || 'application/octet-stream', dataUrl: await readDataUrl(f) }) }
      catch { toast.error('Could not read file', f.name) }
    }
    if (accepted.length) setForm((prev) => (prev ? { ...prev, attachments: [...prev.attachments, ...accepted] } : prev))
  }

  const removeAttachment = (i: number) =>
    setForm((prev) => (prev ? { ...prev, attachments: prev.attachments.filter((_, x) => x !== i) } : prev))

  const save = () => {
    if (!form) return
    const plainBody = stripHtml(form.body).trim()
    if (!form.name.trim()) { toast.error(`${cfg.noun} name is required.`); return }
    if (!plainBody) { toast.error('Message is required.'); return }
    if (cfg.hasSubject && !form.subject.trim()) { toast.error('Subject is required.'); return }
    if (channel === 'sms' && plainBody.length > 300) { toast.error('Message too long', 'SMS templates are limited to 300 characters.'); return }
    upsertMessageTemplate({
      id: editingId || `mt_${channel}_${Math.random().toString(36).slice(2, 10)}`,
      channel,
      name: form.name.trim(),
      event: form.event,
      subject: cfg.hasSubject ? form.subject.trim() : undefined,
      attachments: cfg.hasSubject ? form.attachments : undefined,
      body: plainToHtml(form.body),
      active: form.active,
    })
    toast.success(editingId ? `${cfg.noun} updated` : `${cfg.noun} created`, form.name.trim())
    setForm(null)
    setEditingId(null)
  }

  const smsLen = form && channel === 'sms' ? stripHtml(form.body).length : 0

  return (
    <div>
      <PageHeader
        title={cfg.title}
        desc={cfg.desc}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New {cfg.lowerNoun}
          </Button>
        }
      />

      <div className="card table-wrap p-2">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Event</th>
              {cfg.hasSubject && <th>Subject</th>}
              {cfg.hasSubject && <th>Attachments</th>}
              <th>Message</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 && (
              <tr>
                <td colSpan={cfg.hasSubject ? 7 : 5} className="py-10 text-center">
                  <Icon className="mx-auto size-8 text-mist" />
                  <p className="mt-2 text-sm font-semibold">No {cfg.lowerNoun}s yet</p>
                  <p className="mt-1 text-xs text-mist">Create one to reuse this message across the club.</p>
                </td>
              </tr>
            )}
            {templates.map((t) => {
              const plain = stripHtml(t.body).replace(/\s+/g, ' ').trim()
              return (
              <tr key={t.id}>
                <td className="font-semibold">{t.name}</td>
                <td className="whitespace-nowrap text-mist">{templateEventLabel(t.event)}</td>
                {cfg.hasSubject && <td className="max-w-[220px] truncate" title={t.subject}>{t.subject}</td>}
                {cfg.hasSubject && (
                  <td className="whitespace-nowrap" title={(t.attachments ?? []).map((a) => a.name).join(', ')}>
                    {t.attachments && t.attachments.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        <Paperclip className="size-3.5 text-mist" /> {t.attachments.length}
                      </span>
                    ) : (
                      <span className="text-xs text-mist/50">—</span>
                    )}
                  </td>
                )}
                <td className="max-w-[320px]">
                  <p className="truncate text-mist" title={plain}>{plain}</p>
                  {channel === 'sms' && <p className="text-[10px] font-bold text-mist/70">{plain.length} chars</p>}
                </td>
                <td>{t.active ? <Badge tone="lime">Active</Badge> : <Badge tone="zinc">Draft</Badge>}</td>
                <td className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <button className="rounded-lg p-2 text-mist transition hover:bg-black/5 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white" title="Edit" onClick={() => openEdit(t)}>
                      <Pencil className="size-4" />
                    </button>
                    <button className="rounded-lg p-2 text-mist transition hover:bg-ember/10 hover:text-ember" title="Delete" onClick={() => setConfirmDelete(t)}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-mist">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Placeholders: {TEMPLATE_PLACEHOLDERS.join('  ')} · {cfg.hint}
        </span>
      </p>

      {form && (
        <Modal open onClose={() => { setForm(null); setEditingId(null) }} title={editingId ? `Edit ${cfg.lowerNoun}` : `New ${cfg.lowerNoun}`}>
          <div className="space-y-3">
            <Field label="Template name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Expiry reminder" />
            </Field>
            <Field label="Event">
              <Select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })}>
                {TEMPLATE_EVENTS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
              </Select>
            </Field>
            {cfg.hasSubject && (
              <Field label="Subject" required>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Hi {{name}}, quick update…" />
              </Field>
            )}
            <Field label={channel === 'sms' ? 'Message' : 'Message body'} required>
              <RichBodyEditor
                tall={channel !== 'sms'}
                value={form.body}
                onChange={(html) => setForm({ ...form, body: html })}
                placeholder={channel === 'sms' ? 'Hi {{name}}, …' : 'Hi {{name}}, …'}
              />
              {channel === 'sms' && (
                <p className={`mt-1 text-[11px] font-bold ${smsLen > 160 ? 'text-amber-500' : 'text-mist'}`}>
                  {smsLen} / 160 chars{smsLen > 160 ? ' — will be split into multiple SMS parts' : ''}
                </p>
              )}
            </Field>
            {cfg.hasSubject && (
              <Field label={`Attachments (${form.attachments.length}/${MAX_ATTACHMENTS})`}>
                <div className="space-y-2">
                  {form.attachments.length > 0 && (
                    <ul className="space-y-1.5">
                      {form.attachments.map((a, i) => (
                        <li key={`${a.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-line bg-zinc-50 px-2.5 py-1.5 dark:bg-white/5">
                          <Paperclip className="size-3.5 shrink-0 text-mist" aria-hidden />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium" title={a.name}>{a.name}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-mist">{formatBytes(a.size)}</span>
                          <button type="button" title="Remove attachment" aria-label={`Remove ${a.name}`} onClick={() => removeAttachment(i)} className="shrink-0 rounded p-1 text-mist transition hover:text-ember">
                            <X className="size-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-sm font-medium text-mist transition hover:border-ember hover:text-ember">
                    <Paperclip className="size-4" aria-hidden />
                    {form.attachments.length ? 'Add more files' : 'Attach files'}
                    <input type="file" multiple hidden onChange={(e) => { attachFiles(e.target.files); e.target.value = '' }} />
                  </label>
                  <p className="text-[11px] text-mist">
                    Up to {MAX_ATTACHMENTS} files · max 512 KB each · attached to every email sent from this template.
                  </p>
                </div>
              </Field>
            )}
            <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
              <span className="text-sm font-semibold">Active</span>
              <Switch checked={form.active} onChange={(v) => setForm({ ...form, active: v })} aria-label="Template active" />
            </label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setForm(null); setEditingId(null) }}>Cancel</Button>
            <Button onClick={save}>{editingId ? 'Save changes' : `Add ${cfg.lowerNoun}`}</Button>
          </div>
        </Modal>
      )}

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete template" narrow>
        <p className="text-sm text-mist">
          Delete <span className="font-semibold text-ink dark:text-zinc-100">{confirmDelete?.name}</span>? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirmDelete) {
                deleteMessageTemplate(confirmDelete.id)
                toast.success(`${cfg.noun} deleted`, confirmDelete.name)
              }
              setConfirmDelete(null)
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export const EmailTemplates = () => <MessageTemplates channel="email" />
export const SmsTemplates = () => <MessageTemplates channel="sms" />
