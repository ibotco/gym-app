import { useRef, useState } from 'react'
import { Mail, MessageSquareText, Send } from 'lucide-react'
import { Button, Field, Input, PageHeader, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { sendHtmlEmail } from '../../../lib/mail'
import { validEmail } from '../../../lib/companyEmailSettings'
import { sendDirectSms, normalizeInternationalPhone } from '../../../lib/directSms'

type Outcome = { ok:boolean; message:string }
const escapeHtml = (value:string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c))
export type EmailAttempt = { companyId:string; to:string; subject:string; message:string; ok:boolean; priority?: 'low'|'normal'|'high'|'urgent' }
export type SmsAttempt = { companyId: string; to: string; message: string; ok: boolean; priority?: 'low'|'normal'|'high'|'urgent' }
export function DirectNotifications({ channel, onSmsResult, onEmailResult, onBack }: {channel:'email'|'sms'; onSmsResult?: (attempt: SmsAttempt) => void; onEmailResult?: (attempt: EmailAttempt) => void; onBack?: () => void}) {
  const { activeCompanyId } = useApp()
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const sending = useRef(false)
  const isEmail = channel === 'email'
  const label = isEmail ? 'Email' : 'SMS'
  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (sending.current) return
    if (isEmail ? !validEmail(to.trim()) : !normalizeInternationalPhone(to)) { setOutcome({ok:false,message:isEmail ? 'Enter a valid recipient email address.' : 'Enter a valid international number starting with + and country code.'}); return }
    if (!message.trim() || (isEmail && !subject.trim())) { setOutcome({ok:false,message:'Complete all required fields.'}); return }
    if (isEmail && /[\r\n]/.test(subject)) { setOutcome({ok:false,message:'The subject cannot contain a line break.'}); return }
    if (/\{\{[^{}]+\}\}/.test(message) || (isEmail && /\{\{[^{}]+\}\}/.test(subject))) { setOutcome({ok:false,message:'Replace template tags with actual values before sending. Automatic tag substitution is not connected.'}); return }
    sending.current = true; setBusy(true); setOutcome(null)
    try {
      const result = isEmail
        ? await sendHtmlEmail({to:to.trim(),subject:subject.trim(),text:message.trim(),html:`<div style="white-space:pre-wrap">${escapeHtml(message.trim())}</div>`,companyId:activeCompanyId})
        : await sendDirectSms(to,message)
      if (isEmail && onEmailResult) onEmailResult({companyId:activeCompanyId,to:to.trim(),subject:subject.trim(),message:message.trim(),ok:result.ok})
      if (!isEmail && onSmsResult) onSmsResult({companyId:activeCompanyId,to:to.trim(),message:message.trim(),ok:result.ok})
      setOutcome(result.ok ? {ok:true,message:'Request submitted to the configured provider. Delivery is not verified.'} : {ok:false,message:result.error || 'Request could not be confirmed. Check the provider before retrying.'})
    } catch { if (isEmail && onEmailResult) onEmailResult({companyId:activeCompanyId,to:to.trim(),subject:subject.trim(),message:message.trim(),ok:false}); if (!isEmail && onSmsResult) onSmsResult({companyId:activeCompanyId,to:to.trim(),message:message.trim(),ok:false}); setOutcome({ok:false,message:'The request outcome is unknown. Check the provider before retrying to avoid a duplicate.'}) }
    finally { sending.current=false; setBusy(false) }
  }
  return <div>
    <PageHeader title={`${label} Notifications`} desc={`Compose and send a ${label} to one recipient.`} />
    <form onSubmit={send} className="card max-w-3xl space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-violet-500/10 p-2 text-violet-500">{isEmail ? <Mail className="size-5" /> : <MessageSquareText className="size-5" />}</div><div><h2 className="font-semibold">New {label} notification</h2><p className="text-xs text-mist">Uses the active provider configured in Company Settings → Communication.</p></div></div>
      <Field label={isEmail ? 'Recipient email' : 'Recipient phone number'} required><Input value={to} onChange={e=>setTo(e.target.value)} type={isEmail ? 'email' : 'tel'} placeholder={isEmail ? 'name@example.com' : '+233 24 000 0000'} required />{!isEmail && <p className="mt-1 text-xs text-mist">Include + and the country code.</p>}</Field>
      {isEmail && <Field label="Subject" required><Input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={200} required /></Field>}
      <Field label="Message" required><Textarea value={message} onChange={e=>setMessage(e.target.value)} rows={7} required />{!isEmail && <p className="mt-1 text-xs text-mist">{Array.from(message).length} characters. SMS cost and number of parts depend on encoding and provider.</p>}</Field>
      <p className="text-xs text-mist">Messages are sent individually and are not scheduled. Templates and their tags are not automatically applied. {onSmsResult || onEmailResult ? 'Attempts are recorded in browser-backed history; delivery receipts are not available.' : 'No delivery receipt or message history is provided here.'}</p>
      {outcome && <p role="status" className={`rounded-lg border p-3 text-sm ${outcome.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>{outcome.message}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">{onBack && <Button type="button" variant="outline" disabled={busy} onClick={onBack}>Back to notifications</Button>}<Button type="submit" disabled={busy}><Send className="size-4" />{busy ? 'Submitting…' : `Send ${label}`}</Button></div>
    </form>
  </div>
}

