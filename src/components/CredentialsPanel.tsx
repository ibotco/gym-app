import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, KeyRound, Mail, MessageSquare, Smartphone } from 'lucide-react'
import { Badge, Button, Field, Modal, Select, StatusBadge } from './ui'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { formatDateTime, uid } from '../lib/utils'
import {
  buildCredentialVars, loadReveal, phoneAsPassword, portalLoginUrl, renderTemplate,
} from '../lib/credentials'
import { channelLabel, deliverCredentials, statusLabel } from '../lib/messaging'
import type { CredentialChannel, CredentialDeliveryResult, CredentialEvent, CredentialScope, InitialPasswordMode, Member, User } from '../types'

const LAST_KEY = 'fitpro_cred_last'

function lastPrefs(): { scope: CredentialScope; channels: CredentialChannel[] } {
  try {
    const raw = localStorage.getItem(LAST_KEY)
    if (raw) return JSON.parse(raw) as { scope: CredentialScope; channels: CredentialChannel[] }
  } catch {
    /* ignore */
  }
  return { scope: 'password', channels: ['email', 'whatsapp'] }
}

function savePrefs(scope: CredentialScope, channels: CredentialChannel[]) {
  localStorage.setItem(LAST_KEY, JSON.stringify({ scope, channels }))
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

export function CredentialsPanel({
  member,
  user: account,
  kind = 'member',
}: {
  member?: Member
  user: User
  kind?: 'member' | 'staff'
}) {
  const app = useApp()
  const { user: admin, hasRole } = useAuth()
  const toast = useToast()
  const canManage = kind === 'staff'
    ? hasRole('super_admin', 'gym_manager')
    : hasRole('super_admin', 'gym_manager', 'staff')
  const recordId = member?.id || account.id
  const who = kind === 'staff' ? 'staff' : 'member'
  const [modal, setModal] = useState<'regen' | 'resend' | 'quick' | null>(null)
  const [scope, setScope] = useState<CredentialScope>('password')
  const [passwordMode, setPasswordMode] = useState<InitialPasswordMode>(app.credentialSettings.initialPasswordMode || 'auto')
  const [channels, setChannels] = useState<CredentialChannel[]>(['email', 'whatsapp'])
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reveal, setReveal] = useState(() => loadReveal(account.id))
  const [lastDeliveries, setLastDeliveries] = useState<CredentialDeliveryResult[]>([])
  const [hideReveal, setHideReveal] = useState(false)

  const events = useMemo(
    () => app.credentialEvents.filter((e) => e.memberId === recordId || e.userId === account.id),
    [app.credentialEvents, recordId, account.id],
  )
  const lastEvent = events[0]
  const actor = lastEvent
    ? app.users.find((u) => u.id === lastEvent.adminId)?.name || lastEvent.adminName
    : account.credentialsRegeneratedBy
      ? app.users.find((u) => u.id === account.credentialsRegeneratedBy)?.name
      : ''

  useEffect(() => {
    setReveal(loadReveal(account.id))
  }, [account.id, account.credentialsRegeneratedAt, account.username])

  const varsPreview = buildCredentialVars({
    name: account.name,
    username: reveal?.username || account.username || account.email.split('@')[0],
    password: reveal?.password || '••••••••',
    companyName: app.company.name,
    companyPhone: app.company.phone,
    companyEmail: app.company.email,
    messaging: app.credentialSettings.messaging,
  })

  const toggleChannel = (c: CredentialChannel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const openRegen = (quick = false) => {
    const prefs = lastPrefs()
    setScope(quick ? 'password' : prefs.scope)
    const available: CredentialChannel[] = []
    if (account.email) available.push('email')
    if (account.phone) {
      available.push('whatsapp')
      available.push('sms')
    }
    const next = (quick ? available : prefs.channels).filter((c) => available.includes(c) || prefs.channels.includes(c))
    setChannels(next.length ? next : available.slice(0, 1))
    setPasswordMode(app.credentialSettings.initialPasswordMode || 'auto')
    setConfirm(false)
    setModal(quick ? 'quick' : 'regen')
  }

  const runDelivery = async (
    action: 'regenerate' | 'resend',
    username: string,
    password: string,
    usedChannels: CredentialChannel[],
    event: CredentialEvent,
  ) => {
    const vars = buildCredentialVars({
      name: account.name,
      username,
      password,
      companyName: app.company.name,
      companyPhone: app.company.phone,
      companyEmail: app.company.email,
      messaging: app.credentialSettings.messaging,
    })
    const deliveries = usedChannels.length
      ? await deliverCredentials({
          channels: usedChannels,
          email: account.email,
          phone: account.phone,
          vars,
          templates: app.credentialSettings.templates,
          messaging: app.credentialSettings.messaging,
        })
      : []
    app.recordCredentialDelivery(event.id, deliveries)
    setLastDeliveries(deliveries)
    const failed = deliveries.filter((d) => d.status === 'failed')
    if (!usedChannels.length) toast.info('Credentials updated', 'Nothing was sent — copy the one-time details below.')
    else if (failed.length === deliveries.length) toast.error('Delivery failed', failed[0]?.error || 'No channel succeeded.')
    else if (failed.length) toast.warning('Partially sent', failed.map((d) => `${channelLabel(d.channel)}: ${d.error}`).join(' · '))
    else toast.success(action === 'resend' ? 'Credentials resent' : 'Credentials sent', deliveries.map((d) => `${channelLabel(d.channel)} ${statusLabel(d.status).toLowerCase()}`).join(' · '))
    return deliveries
  }

  const doRegenerate = async () => {
    if (!admin) return
    if (!confirm) { toast.error('Confirm the warning first.'); return }
    if (!channels.length) { toast.error('Pick at least one delivery channel, or use Email after you configure it.'); return }
    setBusy(true)
    const r = await app.regenerateMemberCredentials({
      memberId: member?.id,
      userId: account.id,
      adminId: admin.id,
      adminName: admin.name,
      scope,
      channels,
      passwordMode,
    })
    if (!r.ok || !r.event) {
      setBusy(false)
      toast.error(r.error || 'Could not regenerate credentials.')
      return
    }
    savePrefs(scope, channels)
    const password = r.tempPassword || loadReveal(account.id)?.password || ''
    const username = r.username || account.username || ''
    if (password) setReveal({ userId: account.id, username, password, expires: Date.now() + 15 * 60 * 1000, issuedAt: new Date().toISOString() })
    setHideReveal(false)
    await runDelivery('regenerate', username, password || '—', channels, r.event)
    setBusy(false)
    setModal(null)
  }

  const doResend = async () => {
    if (!admin) return
    const live = loadReveal(account.id)
    if (!live) {
      toast.error('No temporary password is available to resend.', 'Regenerate new credentials. FitPro does not keep the plain-text password.')
      setModal(null)
      return
    }
    if (!channels.length) { toast.error('Pick at least one channel.'); return }
    setBusy(true)
    const event: CredentialEvent = {
      id: uid('ce'),
      memberId: recordId,
      userId: account.id,
      adminId: admin.id,
      adminName: admin.name,
      action: 'resend',
      scope: 'password',
      usernameAfter: live.username,
      passwordChanged: false,
      usernameChanged: false,
      channels,
      deliveries: [],
      createdAt: new Date().toISOString(),
    }
    app.appendCredentialEvent(event)
    app.log(admin.id, 'RESEND', 'Credentials', `${admin.name} resent credentials to ${account.name}`)
    await runDelivery('resend', live.username, live.password, channels, event)
    setBusy(false)
    setModal(null)
  }

  if (!canManage) return null

  return (
    <div id="credentials" className="card cred-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Login credentials</p>
          <h3 className="mt-1 font-display text-lg font-semibold">{kind === 'staff' ? 'Staff portal access' : 'Member portal access'}</h3>
          <p className="mt-1 text-sm text-mist">
            Issue a new temporary password at any time. Club default:{' '}
            <span className="font-semibold text-inherit">
              {(app.credentialSettings.initialPasswordMode || 'auto') === 'phone' ? 'phone number' : 'auto-generate'}
            </span>
            . Change this in Settings → Credentials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {reveal && (
            <Button variant="outline" size="sm" onClick={() => { setChannels(lastPrefs().channels); setModal('resend') }}>
              Resend existing credentials
            </Button>
          )}
          <Button variant="soft" size="sm" onClick={() => openRegen(true)}>Regenerate and send</Button>
          <Button size="sm" onClick={() => openRegen(false)}><KeyRound className="size-4" /> Regenerate login credentials</Button>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">Username</dt>
          <dd className="font-semibold">{account.username || account.email.split('@')[0]}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">Password status</dt>
          <dd className="mt-1">
            {account.mustChangePassword
              ? <Badge tone="amber">Password change required</Badge>
              : <Badge tone="lime">{kind === 'staff' ? 'Set by staff' : 'Set by member'}</Badge>}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">Last regenerated</dt>
          <dd>{account.credentialsRegeneratedAt ? formatDateTime(account.credentialsRegeneratedAt) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">By</dt>
          <dd>{actor || '—'}</dd>
        </div>
      </dl>

      {reveal && !hideReveal && (
        <div className="cred-reveal mt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-lime">One-time reveal</p>
              <p className="mt-1 text-sm text-mist">Plain text is not stored after you dismiss this. Resend stays available for 15 minutes.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setHideReveal(true)}>Hide</Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <RevealRow label="Username" value={reveal.username} />
            <RevealRow label="Temporary password" value={reveal.password} secret />
          </div>
          <p className="mt-2 text-xs text-mist">Portal: {portalLoginUrl()}</p>
        </div>
      )}

      {!!lastDeliveries.length && (
        <div className="mt-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-mist">Latest delivery</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {lastDeliveries.map((d) => (
              <li key={d.channel} className="flex flex-wrap items-center gap-2">
                <StatusBadge status={d.status === 'failed' ? 'failed' : d.status === 'opened' ? 'pending' : 'paid'} />
                <span className="font-semibold">{channelLabel(d.channel)}</span>
                <span className="text-mist">{statusLabel(d.status)}</span>
                {d.error && <span className="text-ember">{d.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-mist">Credential audit trail</p>
        {!events.length && <p className="mt-2 text-sm text-mist">No regenerations yet.</p>}
        {!!events.length && (
          <div className="mt-2 table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th><th>Admin</th><th>Action</th><th>Scope</th><th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 12).map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-mist">{formatDateTime(e.createdAt)}</td>
                    <td>{e.adminName}</td>
                    <td><Badge tone={e.action === 'regenerate' ? 'orange' : 'sky'}>{e.action}</Badge></td>
                    <td>{e.scope}</td>
                    <td className="text-mist">
                      {e.deliveries.length
                        ? e.deliveries.map((d) => `${channelLabel(d.channel)} ${statusLabel(d.status)}`).join(' · ')
                        : e.channels.join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal === 'regen' || modal === 'quick'}
        onClose={() => !busy && setModal(null)}
        title={modal === 'quick' ? 'Regenerate and send' : 'Regenerate login credentials'}
        wide
      >
        <p className="text-sm text-mist">
          This immediately invalidates the current {scope === 'username' ? 'username' : scope === 'both' ? 'username and password' : 'password'}.
          The {who} must change a new temporary password at the next sign-in. The account stays {account.status}.
        </p>
        {modal === 'regen' && (
          <div className="mt-4">
            <Field label="What to regenerate">
              <Select value={scope} onChange={(e) => setScope(e.target.value as CredentialScope)}>
                <option value="password">Password only</option>
                <option value="username">Username only</option>
                <option value="both">Both username and password</option>
              </Select>
            </Field>
          </div>
        )}
        {scope !== 'username' && (
          <div className="mt-4">
            <Field label="Temporary password">
              <Select value={passwordMode} onChange={(e) => setPasswordMode(e.target.value as InitialPasswordMode)}>
                <option value="auto">Auto-generate a random password</option>
                <option value="phone">Use this {who}’s phone number</option>
              </Select>
            </Field>
            <p className="mt-2 text-xs text-mist">
              {passwordMode === 'phone'
                ? (phoneAsPassword(account.phone)
                  ? `They will sign in with ${phoneAsPassword(account.phone)} and then must change it.`
                  : 'This account has no usable phone number. Add a phone or pick auto-generate.')
                : 'A random password that matches the club policy will be created.'}
            </p>
          </div>
        )}
        <ChannelPicker
          email={account.email}
          phone={account.phone}
          channels={channels}
          onToggle={toggleChannel}
        />
        <PreviewBlock
          scope={scope}
          vars={varsPreview}
          templates={app.credentialSettings.templates}
          channels={channels}
        />
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
          <input type="checkbox" className="mt-1 size-4 accent-[#c8f542]" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
          <span>I understand the current credentials will stop working and a full audit record will be written.</span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={doRegenerate} disabled={busy || !confirm}>{busy ? 'Working…' : 'Generate and send'}</Button>
          <Button variant="outline" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={modal === 'resend'} onClose={() => !busy && setModal(null)} title="Resend existing credentials">
        {!reveal ? (
          <p className="text-sm text-mist">The temporary password was discarded. Regenerate new credentials.</p>
        ) : (
          <>
            <p className="text-sm text-mist">Send the last temporary password again. It is still valid until they change it or you regenerate.</p>
            <ChannelPicker email={account.email} phone={account.phone} channels={channels} onToggle={toggleChannel} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={doResend} disabled={busy}>{busy ? 'Sending…' : 'Send now'}</Button>
              <Button variant="outline" onClick={() => setModal(null)} disabled={busy}>Cancel</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function RevealRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 dark:bg-white/3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-mist">{label}</p>
        <button
          type="button"
          className="grid size-8 place-items-center rounded-lg text-mist hover:bg-white/10 hover:text-inherit"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            const ok = await copyText(value)
            setCopied(ok)
            if (ok) toast.success('Copied')
            setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? <Check className="size-4 text-lime" /> : <Copy className="size-4" />}
        </button>
      </div>
      <p className="font-mono text-sm font-semibold tracking-wide">{secret ? value : value}</p>
    </div>
  )
}

function ChannelPicker({
  email, phone, channels, onToggle,
}: {
  email: string
  phone: string
  channels: CredentialChannel[]
  onToggle: (c: CredentialChannel) => void
}) {
  const items: { id: CredentialChannel; label: string; hint: string; icon: typeof Mail; ready: boolean }[] = [
    { id: 'email', label: 'Email', hint: email || 'No email on file', icon: Mail, ready: !!email },
    { id: 'whatsapp', label: 'WhatsApp', hint: phone || 'No phone on file', icon: MessageSquare, ready: !!phone },
    { id: 'sms', label: 'SMS / text', hint: phone || 'No phone on file', icon: Smartphone, ready: !!phone },
  ]
  return (
    <div className="mt-4">
      <p className="mb-2 text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Send via</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon
          const on = channels.includes(it.id)
          return (
            <button
              key={it.id}
              type="button"
              disabled={!it.ready}
              onClick={() => onToggle(it.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${on ? 'border-lime bg-lime/10' : 'border-white/10 hover:border-white/20'} ${!it.ready ? 'opacity-50' : ''}`}
            >
              <Icon className="size-4 text-lime" />
              <p className="mt-1 text-sm font-semibold">{it.label}</p>
              <p className="text-xs text-mist">{it.hint}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PreviewBlock({
  scope, vars, templates, channels,
}: {
  scope: CredentialScope
  vars: ReturnType<typeof buildCredentialVars>
  templates: { emailSubject: string; emailBody: string; whatsappBody: string; smsBody: string }
  channels: CredentialChannel[]
}) {
  const [tab, setTab] = useState<CredentialChannel>(channels[0] || 'email')
  useEffect(() => {
    if (!channels.includes(tab) && channels[0]) setTab(channels[0])
  }, [channels, tab])
  if (!channels.length) return null
  const body = tab === 'email'
    ? `${renderTemplate(templates.emailSubject, vars)}\n\n${renderTemplate(templates.emailBody, vars)}`
    : tab === 'whatsapp'
      ? renderTemplate(templates.whatsappBody, vars)
      : renderTemplate(templates.smsBody, vars)
  return (
    <div className="mt-4">
      <p className="mb-2 text-[13px] font-bold text-[#16325c] dark:text-zinc-200">
        Message preview {scope === 'username' ? '(username change)' : ''}
      </p>
      <div className="mb-2 flex flex-wrap gap-1">
        {channels.map((c) => (
          <button
            key={c}
            type="button"
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${tab === c ? 'bg-lime text-lime-ink' : 'bg-white/5 text-mist'}`}
            onClick={() => setTab(c)}
          >
            {channelLabel(c)}
          </button>
        ))}
      </div>
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed dark:bg-white/3">{body}</pre>
    </div>
  )
}
