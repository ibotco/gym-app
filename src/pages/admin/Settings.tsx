import { useState } from 'react'
import { PageHeader, Button, Field, Input, Select, Segmented, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { loadMail, mailReady, saveMail, sendVerificationEmail, type MailConfig, type MailProvider } from '../../lib/mail'
import { NotifySettings } from '../../components/NotifySettings'
import { ColorPicker } from '../../components/ColorPicker'
import { defaultCredentialSettings, policySummary } from '../../lib/credentials'
import { normalizeHex } from '../../lib/color'
import type { CredentialSettings } from '../../types'
import { Integrations } from './Integrations'

const tabs = [
  { id: 'company', label: 'Company' },
  { id: 'brand', label: 'Branding' },
  { id: 'email', label: 'Email' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'perms', label: 'Permissions' },
  { id: 'security', label: 'Security' },
  { id: 'backup', label: 'Backup' },
  { id: 'int', label: 'Integrations' },
]

export function Settings() {
  const { company, setCompany, credentialSettings, setCredentialSettings } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState('company')
  const [c, setC] = useState(company)
  const [mail, setMail] = useState<MailConfig>(() => loadMail())
  const [cred, setCred] = useState<CredentialSettings>(credentialSettings)
  const [testTo, setTestTo] = useState(company.email || '')
  const [sending, setSending] = useState(false)

  return (
    <div>
      <PageHeader title="System settings" desc="Enterprise controls for a four-club operation." />
      <Segmented value={tab} onChange={setTab} options={tabs} />

      {tab === 'company' && (
        <div className="card mt-4 grid max-w-3xl gap-3 p-5 sm:grid-cols-2">
          <Field label="Trading name"><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
          <Field label="Legal name"><Input value={c.legalName} onChange={(e) => setC({ ...c, legalName: e.target.value })} /></Field>
          <Field label="Email"><Input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={c.whatsapp} onChange={(e) => setC({ ...c, whatsapp: e.target.value })} /></Field>
          <Field label="Tax ID"><Input value={c.taxId} onChange={(e) => setC({ ...c, taxId: e.target.value })} /></Field>
          <Field label="Address"><Input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
          <Field label="Timezone"><Input value={c.timezone} onChange={(e) => setC({ ...c, timezone: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Button onClick={() => { setCompany(c); toast.success('Company saved') }}>Save company</Button>
          </div>
        </div>
      )}

      {tab === 'brand' && (
        <div className="card mt-4 max-w-xl space-y-4 p-5">
          <div>
            <p className="font-semibold">Primary brand colour</p>
            <p className="mt-1 text-sm text-mist">Click the swatch to open the colour picker, type a hex code, or tap a preset.</p>
          </div>
          <ColorPicker
            label="Primary brand colour"
            value={c.brandPrimary}
            onChange={(hex) => setC({ ...c, brandPrimary: hex })}
          />
          <div
            className="brand-preview"
            style={{ background: normalizeHex(c.brandPrimary) }}
          >
            <span>Preview</span>
            <span className="font-mono text-xs font-bold tracking-wider">{normalizeHex(c.brandPrimary)}</span>
          </div>
          <p className="text-sm text-mist">Buttons, highlights, and the wordmark accent use this colour after you save.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              const next = { ...c, brandPrimary: normalizeHex(c.brandPrimary) }
              setC(next)
              setCompany(next)
              toast.success('Brand updated')
            }}>Save branding</Button>
            <Button variant="outline" onClick={() => setC({ ...c, brandPrimary: '#C8F542' })}>Reset to FitPro lime</Button>
          </div>
        </div>
      )}

      {tab === 'perms' && (
        <div className="card mt-4 table-wrap p-2">
          <table className="data">
            <thead><tr><th>Capability</th><th>Super Admin</th><th>Manager</th><th>Staff</th><th>Trainer</th><th>Member</th></tr></thead>
            <tbody>
              {[
                ['View analytics', '●', '●', '○', '○', '—'],
                ['Edit members', '●', '●', '●', 'notes', 'self'],
                ['Regenerate login credentials', '●', '●', '●', '—', '—'],
                ['Refunds', '●', '●', '—', '—', '—'],
                ['Payroll', '●', '●', '—', '—', '—'],
                ['Audit logs', '●', '—', '—', '—', '—'],
                ['Settings', '●', 'limited', '—', '—', '—'],
                ['Manage integrations', '●', '●', '—', '—', '—'],
              ].map((r) => (
                <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'email' && (
        <div className="card mt-4 max-w-2xl space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Live email verification</p>
              <p className="text-sm text-mist">Send the 6-digit code to the member’s real inbox. Gmail App Password is the fastest setup.</p>
            </div>
            <span className={`chip ${mailReady(mail) && mail.live ? 'bg-lime/15 text-lime' : 'bg-white/5'}`}>
              {mailReady(mail) && mail.live ? 'Ready' : 'Not configured'}
            </span>
          </div>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#c8f542]"
              checked={mail.live}
              onChange={(e) => setMail({ ...mail, live: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Send real emails</span>
              <span className="mt-1 block text-sm text-mist">When this is on and a provider is saved, sign-up codes go to the inbox. The verify screen will not show the code.</span>
            </span>
          </label>
          <Field label="Provider">
            <Select value={mail.provider} onChange={(e) => {
              const provider = e.target.value as MailProvider
              setMail({
                ...mail,
                provider,
                smtpHost: provider === 'gmail' ? 'smtp.gmail.com' : mail.smtpHost,
                smtpPort: provider === 'gmail' ? '587' : mail.smtpPort,
              })
            }}>
              <option value="gmail">Gmail (recommended)</option>
              <option value="smtp">Custom SMTP</option>
              <option value="emailjs">EmailJS</option>
              <option value="resend">Resend</option>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From name"><Input value={mail.fromName} onChange={(e) => setMail({ ...mail, fromName: e.target.value })} /></Field>
            <Field label="From email"><Input type="email" value={mail.fromEmail} onChange={(e) => setMail({ ...mail, fromEmail: e.target.value })} placeholder={mail.smtpUser || 'hello@fitpro.gym'} /></Field>
          </div>
          {(mail.provider === 'gmail' || mail.provider === 'smtp') && (
            <div className="grid gap-3 sm:grid-cols-2">
              {mail.provider === 'smtp' && (
                <>
                  <Field label="SMTP host"><Input value={mail.smtpHost} onChange={(e) => setMail({ ...mail, smtpHost: e.target.value })} placeholder="smtp.example.com" /></Field>
                  <Field label="SMTP port"><Input value={mail.smtpPort} onChange={(e) => setMail({ ...mail, smtpPort: e.target.value })} placeholder="587" /></Field>
                </>
              )}
              <Field label={mail.provider === 'gmail' ? 'Gmail address' : 'SMTP username'}>
                <Input type="email" value={mail.smtpUser} onChange={(e) => setMail({ ...mail, smtpUser: e.target.value, fromEmail: mail.fromEmail || e.target.value })} />
              </Field>
              <Field label={mail.provider === 'gmail' ? 'Gmail app password' : 'SMTP password'}>
                <Input type="password" value={mail.smtpPass} onChange={(e) => setMail({ ...mail, smtpPass: e.target.value })} placeholder="16-character app password" />
              </Field>
            </div>
          )}
          {mail.provider === 'gmail' && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-mist">
              <li>Open Google Account → Security → turn on 2-Step Verification.</li>
              <li>Search for <span className="text-inherit">App passwords</span> → app Mail → device Windows.</li>
              <li>Paste the 16-character password above. Do not use your normal Gmail password.</li>
            </ol>
          )}
          {mail.provider === 'emailjs' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Public key"><Input value={mail.emailjsPublicKey} onChange={(e) => setMail({ ...mail, emailjsPublicKey: e.target.value })} /></Field>
              <Field label="Service ID"><Input value={mail.emailjsServiceId} onChange={(e) => setMail({ ...mail, emailjsServiceId: e.target.value })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Template ID"><Input value={mail.emailjsTemplateId} onChange={(e) => setMail({ ...mail, emailjsTemplateId: e.target.value })} /></Field>
              </div>
              <p className="sm:col-span-2 text-sm text-mist">Template must include variables <code>to_email</code>, <code>to_name</code>, and <code>code</code>. Set To Email to {'{{to_email}}'}.</p>
            </div>
          )}
          {mail.provider === 'resend' && (
            <Field label="Resend API key"><Input type="password" value={mail.resendKey} onChange={(e) => setMail({ ...mail, resendKey: e.target.value })} placeholder="re_…" /></Field>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { saveMail(mail); toast.success('Email settings saved') }}>Save email settings</Button>
          </div>
          <div className="border-t border-white/10 pt-4">
            <Field label="Send a test code to">
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@gmail.com" />
            </Field>
            <Button
              className="mt-3"
              variant="outline"
              disabled={sending}
              onClick={async () => {
                saveMail(mail)
                if (!testTo.trim()) { toast.error('Enter a test inbox'); return }
                setSending(true)
                const r = await sendVerificationEmail({ to: testTo.trim(), name: 'FitPro test', code: '482915' })
                setSending(false)
                if (r.ok) toast.success('Test email sent', `Check ${testTo}`)
                else toast.error('Send failed', r.error)
              }}
            >
              {sending ? 'Sending…' : 'Send test email'}
            </Button>
          </div>
        </div>
      )}

      {tab === 'credentials' && (
        <div className="mt-4 grid max-w-4xl gap-4">
          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">Initial login password</p>
              <p className="text-sm text-mist">Used when you add a member or staff record, or regenerate login credentials. They must still change this password at first sign-in.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                { id: 'auto' as const, title: 'Auto-generate', desc: 'A random temporary password that matches the policy below.' },
                { id: 'phone' as const, title: 'Member phone number', desc: 'Local digits, e.g. 0245550101. Easy to tell the member at the desk.' },
              ]).map((opt) => {
                const on = (cred.initialPasswordMode || 'auto') === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setCred({ ...cred, initialPasswordMode: opt.id })}
                    className={`rounded-xl border px-4 py-3 text-left transition ${on ? 'border-lime bg-lime/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <p className="text-sm font-semibold">{opt.title}</p>
                    <p className="mt-1 text-xs text-mist">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">Password policy</p>
              <p className="text-sm text-mist">Generated temporary passwords and member password changes must match this policy. Demo seats keep demo123 until they are regenerated.</p>
            </div>
            <Field label="Minimum length">
              <Input type="number" min={8} max={32} value={cred.policy.minLength} onChange={(e) => setCred({ ...cred, policy: { ...cred.policy, minLength: Math.max(8, Number(e.target.value) || 10) } })} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['requireUpper', 'Require uppercase'],
                ['requireLower', 'Require lowercase'],
                ['requireNumber', 'Require a number'],
                ['requireSpecial', 'Require a symbol'],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[#c8f542]"
                    checked={cred.policy[k]}
                    onChange={(e) => setCred({ ...cred, policy: { ...cred.policy, [k]: e.target.checked } })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-mist">Current rule: {policySummary(cred.policy)}</p>
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">Delivery templates</p>
              <p className="text-sm text-mist">
                Placeholders: {'{{name}}'} {'{{username}}'} {'{{password}}'} {'{{portalUrl}}'} {'{{supportPhone}}'} {'{{supportEmail}}'} {'{{clubName}}'}
              </p>
            </div>
            <Field label="Email subject"><Input value={cred.templates.emailSubject} onChange={(e) => setCred({ ...cred, templates: { ...cred.templates, emailSubject: e.target.value } })} /></Field>
            <Field label="Email body"><Textarea value={cred.templates.emailBody} onChange={(e) => setCred({ ...cred, templates: { ...cred.templates, emailBody: e.target.value } })} /></Field>
            <Field label="WhatsApp message"><Textarea value={cred.templates.whatsappBody} onChange={(e) => setCred({ ...cred, templates: { ...cred.templates, whatsappBody: e.target.value } })} /></Field>
            <Field label="SMS / text message"><Textarea value={cred.templates.smsBody} onChange={(e) => setCred({ ...cred, templates: { ...cred.templates, smsBody: e.target.value } })} /></Field>
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">Support contact on messages</p>
              <p className="text-sm text-mist">Used in WhatsApp and email footers. Falls back to company phone and email.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Support phone"><Input value={cred.messaging.supportPhone} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, supportPhone: e.target.value } })} placeholder={company.phone} /></Field>
              <Field label="Support email"><Input type="email" value={cred.messaging.supportEmail} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, supportEmail: e.target.value } })} placeholder={company.email} /></Field>
            </div>
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">WhatsApp delivery</p>
              <p className="text-sm text-mist">Default opens WhatsApp on this PC with the message filled in. Cloud API or a webhook send without a chat window.</p>
            </div>
            <Field label="Mode">
              <Select value={cred.messaging.whatsappMode} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, whatsappMode: e.target.value as typeof cred.messaging.whatsappMode } })}>
                <option value="link">Open WhatsApp (wa.me)</option>
                <option value="cloud">Meta Cloud API</option>
                <option value="webhook">Custom webhook</option>
              </Select>
            </Field>
            {cred.messaging.whatsappMode === 'cloud' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Phone number ID"><Input value={cred.messaging.whatsappPhoneNumberId} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, whatsappPhoneNumberId: e.target.value } })} /></Field>
                <Field label="Access token"><Input type="password" value={cred.messaging.whatsappToken} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, whatsappToken: e.target.value } })} /></Field>
              </div>
            )}
            {cred.messaging.whatsappMode === 'webhook' && (
              <Field label="Webhook URL"><Input value={cred.messaging.whatsappWebhookUrl} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, whatsappWebhookUrl: e.target.value } })} placeholder="https://…" /></Field>
            )}
          </div>

          <div className="card space-y-4 p-5">
            <div>
              <p className="font-semibold">SMS delivery</p>
              <p className="text-sm text-mist">Default opens the device SMS app. Hubtel is sent from the FitPro server so the browser does not hit CORS.</p>
            </div>
            <Field label="Mode">
              <Select value={cred.messaging.smsMode} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, smsMode: e.target.value as typeof cred.messaging.smsMode } })}>
                <option value="link">Open SMS app</option>
                <option value="hubtel">Hubtel SMS</option>
                <option value="webhook">Custom webhook</option>
              </Select>
            </Field>
            {cred.messaging.smsMode === 'hubtel' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Hubtel client ID"><Input value={cred.messaging.hubtelClientId} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, hubtelClientId: e.target.value } })} /></Field>
                <Field label="Hubtel client secret"><Input type="password" value={cred.messaging.hubtelClientSecret} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, hubtelClientSecret: e.target.value } })} /></Field>
                <Field label="From name / number"><Input value={cred.messaging.hubtelFrom} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, hubtelFrom: e.target.value } })} /></Field>
              </div>
            )}
            {cred.messaging.smsMode === 'webhook' && (
              <Field label="Webhook URL"><Input value={cred.messaging.smsWebhookUrl} onChange={(e) => setCred({ ...cred, messaging: { ...cred.messaging, smsWebhookUrl: e.target.value } })} /></Field>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setCredentialSettings(cred); toast.success('Credential settings saved') }}>Save credential settings</Button>
            <Button variant="outline" onClick={() => { const d = defaultCredentialSettings(); setCred(d); setCredentialSettings(d); toast.info('Templates reset to FitPro defaults') }}>Reset templates</Button>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="mt-4">
          <NotifySettings />
        </div>
      )}

      {tab === 'security' && (
        <div className="card mt-4 max-w-xl space-y-4 p-5 text-sm">
          <p><span className="text-lime">●</span> JWT session tokens (12h) · refresh rotation</p>
          <p><span className="text-lime">●</span> OAuth 2.0 — Google, Apple</p>
          <p><span className="text-lime">●</span> Role-based route guards</p>
          <p><span className="text-lime">●</span> GDPR export / delete (member profile)</p>
          <p><span className="text-lime">●</span> Password policy lives under Settings → Credentials. Regenerated passwords are hashed (SHA-256 + salt).</p>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[#c8f542]"
              checked={!!c.emailLoginValidation}
              onChange={(e) => setC({ ...c, emailLoginValidation: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Enable Email Login Validation</span>
              <span className="mt-1 block text-mist">
                Registration and login require a valid email format. Duplicate addresses are blocked. New accounts stay inactive until the member enters the 6-digit email code.
              </span>
            </span>
          </label>
          <Field label="Session timeout (minutes)">
            <Select defaultValue="60"><option>15</option><option>60</option><option>240</option></Select>
          </Field>
          <Button variant="outline" onClick={() => { setCompany(c); toast.success('Security policy saved') }}>Save controls</Button>
        </div>
      )}

      {tab === 'backup' && (
        <div className="card mt-4 max-w-xl space-y-3 p-5">
          <p className="text-sm text-mist">Nightly snapshot to encrypted object storage. Point-in-time recovery 14 days.</p>
          <Button onClick={() => toast.success('Backup started', 'fitpro-2026-08-13.json')}>Run backup now</Button>
          <Button variant="outline" onClick={() => toast.info('Restore drill queued')}>Test restore</Button>
        </div>
      )}

      {tab === 'int' && (
        <div className="mt-4">
          <Integrations embedded />
        </div>
      )}
    </div>
  )
}
