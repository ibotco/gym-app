import { useState } from 'react'
import { PageHeader, Button, Field, Input, Textarea, Select, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/utils'

export function NotificationsAdmin() {
  const { notifications, users, notify, members, memberships } = useApp()
  const toast = useToast()
  const [form, setForm] = useState({ userId: 'u_member', title: '', message: '', channel: 'email' as const })

  const expiring = memberships.filter((m) => {
    const d = (new Date(m.endDate).getTime() - Date.now()) / 86400000
    return d > 0 && d < 21 && m.status === 'active'
  })

  return (
    <div>
      <PageHeader title="Notifications" desc="Email, SMS, push, in-app. Expiry reminders are automated." />
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            notify(form)
            toast.success(`Queued via ${form.channel}`)
          }}
        >
          <h3 className="font-semibold">Compose</h3>
          <Field label="Recipient">
            <Select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as typeof form.channel })}>
              {['email', 'sms', 'push', 'in-app'].map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Message"><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
          <Button type="submit">Send</Button>
        </form>
        <div className="card p-5">
          <h3 className="font-semibold">Automated renewal reminders</h3>
          <p className="mt-1 text-sm text-mist">{expiring.length} memberships expire within 21 days.</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              expiring.forEach((ms) => {
                const m = members.find((x) => x.id === ms.memberId)
                if (m) notify({ userId: m.userId, title: 'Membership expiring', message: `Renews ${ms.endDate}. Auto-renew is ${ms.autoRenew ? 'on' : 'off'}.`, channel: 'email' })
              })
              toast.success('Reminders queued')
            }}
          >
            Run reminder batch
          </Button>
          <ul className="mt-6 max-h-80 space-y-3 overflow-auto">
            {notifications.slice(0, 12).map((n) => (
              <li key={n.id} className="border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <Badge tone="zinc">{n.channel}</Badge>
                </div>
                <p className="text-xs text-mist">{n.message}</p>
                <p className="text-[11px] text-mist">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
