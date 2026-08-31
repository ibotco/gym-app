import { useEffect, useState } from 'react'
import { Button, Field, Input, Select } from '../../components/ui'
import { useToast } from '../../context/ToastContext'
import { mailStatus, saveMailConfig, sendTestEmail, type MailStatus } from '../../lib/mail'

const presets = [
  { id: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 587 },
  { id: 'outlook', label: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587 },
  { id: 'yahoo', label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587 },
  { id: 'custom', label: 'Custom SMTP', host: '', port: 587 },
]

export function EmailLive() {
  const toast = useToast()
  const [status, setStatus] = useState<MailStatus>({ configured: false })
  const [form, setForm] = useState({
    preset: 'gmail',
    host: 'smtp.gmail.com',
    port: '587',
    user: '',
    pass: '',
    fromName: 'FitPro',
    fromEmail: '',
    testTo: '',
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void mailStatus().then((s) => {
      setStatus(s)
      if (s.configured) {
        setForm((f) => ({
          ...f,
          preset: s.preset || 'gmail',
          host: s.host || f.host,
          port: String(s.port || 587),
          user: s.user || '',
          fromName: s.fromName || 'FitPro',
          fromEmail: s.fromEmail || s.user || '',
          testTo: s.user || '',
        }))
      }
    })
  }, [])

  const applyPreset = (id: string) => {
    const p = presets.find((x) => x.id === id)
    setForm((f) => ({
      ...f,
      preset: id,
      host: p?.host || f.host,
      port: String(p?.port || 587),
    }))
  }

  const save = async () => {
    setBusy(true)
    const r = await saveMailConfig({
      enabled: true,
      preset: form.preset,
      host: form.host,
      port: Number(form.port) || 587,
      user: form.user.trim(),
      pass: form.pass,
      fromName: form.fromName.trim() || 'FitPro',
      fromEmail: (form.fromEmail || form.user).trim(),
    })
    setBusy(false)
    if (!r.ok && r.error) {
      toast.error('Could not save', r.error)
      return
    }
    setStatus(r)
    toast.success('Live email connected')
  }

  const test = async () => {
    setBusy(true)
    const r = await sendTestEmail(form.testTo || form.user)
    setBusy(false)
    if (!r.ok) {
      toast.error('Test failed', r.error || 'Check the app password and try again.')
      return
    }
    toast.success('Test email sent', `Check ${form.testTo || form.user} (and spam).`)
  }

  return (
    <div className="card mt-4 max-w-2xl space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Live email verification</p>
          <p className="mt-1 text-sm text-mist">
            New members receive a real 6-digit code in their inbox. Gmail needs an App Password, not your normal password.
          </p>
        </div>
        <span className={`chip ${status.configured ? 'bg-lime/15 text-lime' : 'bg-white/5'}`}>
          {status.configured ? 'Live' : 'Not connected'}
        </span>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-mist">
        <li>Open Google Account → Security → 2-Step Verification (turn it on).</li>
        <li>Open App passwords → create one named FitPro.</li>
        <li>Paste that 16-character password below and save, then send a test.</li>
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider">
          <Select value={form.preset} onChange={(e) => applyPreset(e.target.value)}>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="From name"><Input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} /></Field>
        <Field label="SMTP host"><Input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} /></Field>
        <Field label="Port"><Input value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} /></Field>
        <Field label="Mailbox email">
          <Input type="email" value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="you@gmail.com" />
        </Field>
        <Field label="App password">
          <Input type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} placeholder={status.configured ? 'Unchanged if left blank' : 'xxxx xxxx xxxx xxxx'} />
        </Field>
        <Field label="From address">
          <Input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} placeholder="Same as mailbox, usually" />
        </Field>
        <Field label="Send a test to">
          <Input type="email" value={form.testTo} onChange={(e) => setForm({ ...form, testTo: e.target.value })} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void save()}>Save & go live</Button>
        <Button variant="outline" disabled={busy} onClick={() => void test()}>Send test email</Button>
      </div>
    </div>
  )
}
