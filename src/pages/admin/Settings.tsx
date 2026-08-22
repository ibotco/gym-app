import { useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, GripVertical, RotateCcw, Check } from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Segmented, Textarea, Badge, SearchField, Switch } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { loadMail, mailReady, saveMail, sendVerificationEmail, type MailConfig, type MailProvider } from '../../lib/mail'
import { NotifySettings } from '../../components/NotifySettings'
import { ColorPicker } from '../../components/ColorPicker'
import { defaultCredentialSettings, policySummary } from '../../lib/credentials'
import { normalizeHex, readableInk } from '../../lib/color'
import { TIMEZONES } from '../../lib/timezones'
import { CURRENCIES } from '../../lib/currencies'
import { DATA_COLLECTIONS } from '../../lib/dataReset'
import type { CredentialSettings, CronSettings } from '../../types'
import { Integrations } from './Integrations'
import { DataMaintenance } from './DataMaintenance'
import { CustomFieldsSettings } from './CustomFieldsSettings'
import { PrintHeaderSettings } from './PrintHeaderSettings'
import { PaymentSettingsForm } from './PaymentSettingsForm'
import { ModuleManagement } from './ModuleManagement'
import { MODULES, defaultSidebarOrder } from '../../lib/modules'
import { DEFAULT_PREFIXES, DEFAULT_ALLOWED_FILE_TYPES, DEFAULT_CRON_SETTINGS } from '../../data/seed'

const tabs = [
  { id: 'company', label: 'Company' },
  { id: 'prefixes', label: 'Prefixes' },
  { id: 'customfields', label: 'Custom fields' },
  { id: 'captcha', label: 'Captcha' },
  { id: 'filetypes', label: 'File types' },
  { id: 'logo', label: 'Logo' },
  { id: 'cron', label: 'Cron job' },
  { id: 'printheader', label: 'Print header' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'sysupdate', label: 'System update' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'brand', label: 'Branding' },
  { id: 'email', label: 'Email' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'perms', label: 'Permissions' },
  { id: 'payments', label: 'Payments' },
  { id: 'security', label: 'Security' },
  { id: 'backup', label: 'Backup' },
  { id: 'data', label: 'Data' },
  { id: 'modules', label: 'Modules' },
  { id: 'sidebar', label: 'Sidebar Menu' },
  { id: 'int', label: 'Integrations' },
]

/** Marks a company-level field that branches are permitted to override. */
function BranchTag() {
  return (
    <span className="ml-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400" title="Branches may override this setting">
      branch
    </span>
  )
}

const APP_VERSION = '1.0.0'
const RELEASE_NOTES = [
  { version: '1.0.0', date: '2026-08-21', notes: ['Initial multi-company & multi-branch release', 'Print header/footer settings', 'Custom fields across modules'] },
  { version: '0.9.0', date: '2026-07-30', notes: ['Accounting, assets and inventory modules', 'Role-based permissions matrix'] },
  { version: '0.8.0', date: '2026-06-15', notes: ['People management (members, suppliers, customers)', 'Branches and memberships'] },
]

export function Settings() {
  const { company, setCompany, credentialSettings, setCredentialSettings, companies, activeCompanyId, setActiveCompany } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState('company')
  const [tabQuery, setTabQuery] = useState('')
  const [c, setC] = useState(company)
  const [mail, setMail] = useState<MailConfig>(() => loadMail())
  const [cred, setCred] = useState<CredentialSettings>(credentialSettings)
  const [testTo, setTestTo] = useState(company.email || '')
  const [sending, setSending] = useState(false)

  // Filter tabs by the search query; if exactly one matches, jump straight to it.
  const visibleTabs = useMemo(() => {
    const ql = tabQuery.trim().toLowerCase()
    if (!ql) return tabs
    return tabs.filter((t) => t.label.toLowerCase().includes(ql))
  }, [tabQuery])

  const selectTab = (id: string) => {
    setTab(id)
    setTabQuery('')
  }

  // Load a company from the companies table into the settings form and make it
  // the active tenant so the rest of the app follows the selection.
  const selectCompany = (id: string) => {
    const co = companies.find((x) => x.id === id)
    if (!co) return
    setActiveCompany(id)
    setC((prev) => ({
      ...prev,
      name: co.name,
      legalName: co.legalName || '',
      email: co.email,
      phone: co.phone,
      address: co.address,
      digitalAddress: co.digitalAddress || '',
      taxId: co.taxId || '',
      currency: co.currency,
      currencySymbol: co.currencySymbol || prev.currencySymbol,
      timezone: co.timezone,
      brandPrimary: co.brandPrimary || prev.brandPrimary,
      buttonPrimary: co.buttonPrimary,
      logoText: co.logoText || co.name,
      webAddress: co.webAddress || '',
    }))
  }

  const prefixList = c.prefixes && c.prefixes.length ? c.prefixes : DEFAULT_PREFIXES
  const updatePrefix = (key: string, value: string) => {
    setC({ ...c, prefixes: prefixList.map((p) => (p.key === key ? { ...p, prefix: value } : p)) })
  }

  const fileTypes = c.allowedFileTypes && c.allowedFileTypes.length ? c.allowedFileTypes : DEFAULT_ALLOWED_FILE_TYPES
  const [newFileType, setNewFileType] = useState('')
  const addFileType = () => {
    const raw = newFileType.trim().toLowerCase()
    if (!raw) return
    const ext = raw.startsWith('.') ? raw : `.${raw}`
    if (fileTypes.includes(ext)) return
    setC({ ...c, allowedFileTypes: [...fileTypes, ext] })
    setNewFileType('')
  }
  const removeFileType = (ext: string) => setC({ ...c, allowedFileTypes: fileTypes.filter((x) => x !== ext) })

  const onLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setC({ ...c, logoImage: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const cron = c.cron ?? DEFAULT_CRON_SETTINGS
  const cronSchedule = (mins: number) => (mins === 1 ? '* * * * *' : mins === 60 ? '0 * * * *' : `*/${mins} * * * *`)
  const cronCommand = `${cronSchedule(cron.intervalMinutes)} curl -s ${c.webAddress || 'https://yourapp.com'}/cron`
  const [cronLastRun, setCronLastRun] = useState<string>(() => localStorage.getItem('fitpro_cron_last_run') || '')
  const updateCron = (patch: Partial<CronSettings>) => setC({ ...c, cron: { ...cron, ...patch } })
  const copyCron = async () => {
    try {
      await navigator.clipboard.writeText(cronCommand)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Copy failed')
    }
  }
  const runCron = () => {
    const now = new Date().toLocaleString()
    localStorage.setItem('fitpro_cron_last_run', now)
    setCronLastRun(now)
    toast.success('Cron job ran successfully')
  }

  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'uptodate'>('idle')
  const [lastChecked, setLastChecked] = useState<string>(() => localStorage.getItem('fitpro_update_last_check') || '')
  const checkUpdate = () => {
    setUpdateStatus('checking')
    window.setTimeout(() => {
      setUpdateStatus('uptodate')
      const now = new Date().toLocaleString()
      setLastChecked(now)
      localStorage.setItem('fitpro_update_last_check', now)
      toast.success('Your system is up to date')
    }, 1200)
  }

  return (
    <div>
      <PageHeader title="System settings" desc="Enterprise controls for a four-club operation." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchField value={tabQuery} onChange={setTabQuery} placeholder="Search settings…" className="w-full max-w-xs" />
        {tabQuery.trim() && visibleTabs.length === 1 && (
          <span className="text-xs text-mist">Press Enter to open “{visibleTabs[0].label}”</span>
        )}
      </div>
      <Segmented value={tab} onChange={selectTab} options={visibleTabs} />
      {tabQuery.trim() && !visibleTabs.length && (
        <p className="mt-2 text-sm text-mist">No settings match “{tabQuery}”.</p>
      )}

      {tab === 'company' && (
        <div className="card mt-4 max-w-4xl p-5">
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-sm text-mist">
            <span className="font-semibold text-sky-600 dark:text-sky-400">Company (global) settings</span>
            <span className="hidden sm:inline">— apply to every branch. Branches can override the marked per-branch fields in “Branch settings”.</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Company name" required>
              <Select value={activeCompanyId} onChange={(e) => selectCompany(e.target.value)}>
                {companies.map((co) => (
                  <option key={co.id} value={co.id}>{co.name}{co.status === 'inactive' ? ' (inactive)' : ''}</option>
                ))}
              </Select>
            </Field>
            <Field label="Legal name"><Input value={c.legalName} onChange={(e) => setC({ ...c, legalName: e.target.value })} /></Field>
            <Field label={<>Phone <BranchTag /></>} required><Input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
            <Field label="Email Address"><Input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
            <Field label={<>Address <BranchTag /></>}><Input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
            <Field label="Digital Address"><Input value={c.digitalAddress || ''} onChange={(e) => setC({ ...c, digitalAddress: e.target.value })} placeholder="GP/BBK23089" /></Field>
            <Field label="Web Address"><Input value={c.webAddress || ''} onChange={(e) => setC({ ...c, webAddress: e.target.value })} placeholder="www.example.com" /></Field>
            <Field label="Tax ID / TIN"><Input value={c.taxId} onChange={(e) => setC({ ...c, taxId: e.target.value })} /></Field>

            <Field label="Currency List" required>
              <Select value={c.currency} onChange={(e) => setC({ ...c, currency: e.target.value })}>
                {CURRENCIES.map((cur) => <option key={cur.code} value={cur.code}>{cur.name} ({cur.code})</option>)}
              </Select>
            </Field>
            <Field label="ISO code"><Input value={c.currency} onChange={(e) => setC({ ...c, currency: e.target.value.toUpperCase() })} className="font-mono" /></Field>
            <Field label="Currency Symbol"><Input value={c.currencySymbol || 'GH₵'} onChange={(e) => setC({ ...c, currencySymbol: e.target.value })} /></Field>
            <Field label="Remember Me">
              <Select value={String(c.rememberMeMinutes ?? 15)} onChange={(e) => setC({ ...c, rememberMeMinutes: Number(e.target.value) })}>
                <option value="15">15 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="1440">1 Day</option>
                <option value="10080">1 Week</option>
                <option value="43200">1 Month</option>
              </Select>
            </Field>

            <Field label={<>Date Format <BranchTag /></>}>
              <Select value={c.dateFormat || 'dd-mm-yyyy'} onChange={(e) => setC({ ...c, dateFormat: e.target.value })}>
                <option value="dd-mm-yyyy">dd-mm-yyyy</option>
                <option value="mm-dd-yyyy">mm-dd-yyyy</option>
                <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                <option value="dd/mm/yyyy">dd/mm/yyyy</option>
              </Select>
            </Field>
            <Field label={<>Time Format <BranchTag /></>}>
              <Select value={c.timeFormat || '12 hours'} onChange={(e) => setC({ ...c, timeFormat: e.target.value })}>
                <option value="12 hours">12 hours</option>
                <option value="24 hours">24 hours</option>
              </Select>
            </Field>
            <Field label={<>Timezone <BranchTag /></>}>
              <Select value={c.timezone} onChange={(e) => setC({ ...c, timezone: e.target.value })}>
                {TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
            </Field>
            <Field label={<>Start Day of Week <BranchTag /></>}>
              <Select value={c.startDayOfWeek || 'Monday'} onChange={(e) => setC({ ...c, startDayOfWeek: e.target.value })}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>

            <Field label="Sidebar behaviour">
              <Select value={c.sidebarSticky === false ? 'scroll' : 'sticky'} onChange={(e) => setC({ ...c, sidebarSticky: e.target.value === 'sticky' })}>
                <option value="sticky">Locked (scrolls independently)</option>
                <option value="scroll">Scroll with the page</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('Company saved') }}>Save company</Button>
          </div>
        </div>
      )}

      {tab === 'prefixes' && (
        <div className="card mt-4 max-w-2xl p-5">
          <p className="font-semibold">Document number prefixes</p>
          <p className="mb-4 text-xs text-mist">Prefixes used when generating document numbers across the company.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] font-bold uppercase tracking-wider text-mist">
                <th className="py-2 pr-3">Settings</th>
                <th className="py-2">Number prefix</th>
              </tr>
            </thead>
            <tbody>
              {prefixList.map((p) => (
                <tr key={p.key} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 font-medium">{p.label}</td>
                  <td className="py-2.5">
                    <Input value={p.prefix} onChange={(e) => updatePrefix(p.key, e.target.value)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('Prefixes saved') }}>Save prefixes</Button>
          </div>
        </div>
      )}

      {tab === 'customfields' && <CustomFieldsSettings />}

      {tab === 'captcha' && (
        <div className="card mt-4 max-w-xl space-y-4 p-5">
          <div>
            <p className="font-semibold">Google reCAPTCHA</p>
            <p className="mt-1 text-sm text-mist">Protect public forms (registration, contact and login) from bots.</p>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="text-sm font-semibold">Enable reCAPTCHA</span>
            <Switch checked={!!c.captchaEnabled} onChange={(v) => setC({ ...c, captchaEnabled: v })} aria-label="Enable reCAPTCHA" />
          </label>
          <Field label="reCAPTCHA site key"><Input value={c.captchaSiteKey || ''} onChange={(e) => setC({ ...c, captchaSiteKey: e.target.value })} placeholder="6LeIxAcT…" /></Field>
          <Field label="reCAPTCHA secret key"><Input type="password" value={c.captchaSecretKey || ''} onChange={(e) => setC({ ...c, captchaSecretKey: e.target.value })} placeholder="6LeIxAcT…" /></Field>
          <div className="flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('Captcha settings saved') }}>Save captcha settings</Button>
          </div>
        </div>
      )}

      {tab === 'filetypes' && (
        <div className="card mt-4 max-w-xl p-5">
          <p className="font-semibold">Allowed file types</p>
          <p className="mt-1 text-sm text-mist">File extensions members and staff are allowed to upload.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {fileTypes.map((ext) => (
              <span key={ext} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-semibold">
                {ext}
                <button className="text-mist hover:text-ember" title="Remove" onClick={() => removeFileType(ext)}>×</button>
              </span>
            ))}
            {!fileTypes.length && <p className="text-sm text-mist">No file types configured.</p>}
          </div>
          <div className="mt-3 flex gap-2">
            <Input value={newFileType} onChange={(e) => setNewFileType(e.target.value)} placeholder=".pdf" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFileType() } }} />
            <Button variant="outline" className="shrink-0 whitespace-nowrap" onClick={addFileType}>Add type</Button>
          </div>
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('File types saved') }}>Save file types</Button>
          </div>
        </div>
      )}

      {tab === 'logo' && (
        <div className="card mt-4 max-w-xl space-y-5 p-5">
          <div>
            <p className="font-semibold">Company logo</p>
            <p className="mt-1 text-sm text-mist">Shown in the sidebar, on the login page and on printed documents.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border border-line bg-white/5">
              {c.logoImage ? (
                <img src={c.logoImage} alt="Company logo" className="h-full w-full object-contain" />
              ) : (
                <span className="font-display text-lg font-bold">{c.logoText || 'FitPro'}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold transition hover:bg-black/5 dark:hover:bg-white/5">
                Upload logo
                <input type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
              </label>
              {c.logoImage && (
                <Button variant="outline" onClick={() => setC({ ...c, logoImage: undefined })}>Remove</Button>
              )}
            </div>
          </div>
          <Field label="Logo text (wordmark)"><Input value={c.logoText || ''} onChange={(e) => setC({ ...c, logoText: e.target.value })} placeholder="FitPro" /></Field>
          <div className="flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('Logo saved') }}>Save logo</Button>
          </div>
        </div>
      )}

      {tab === 'cron' && (
        <div className="mt-4 max-w-xl space-y-4">
          <div className="card p-5">
            <p className="font-semibold">Cron job</p>
            <p className="mt-1 text-sm text-mist">Schedule the command below on your server to run automated tasks such as reminders, renewals and reports.</p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-black/5 p-3 dark:bg-white/5">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">{cronCommand}</code>
              <button className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5" onClick={copyCron}>Copy</button>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-mist">Last run: {cronLastRun || 'Never'}</p>
              <Button variant="outline" size="sm" onClick={runCron}>Run now</Button>
            </div>
          </div>

          <div className="card p-5">
            <p className="font-semibold">Automation settings</p>
            <p className="mb-4 mt-1 text-sm text-mist">What the cron job does each time it runs.</p>
            <div className="space-y-4">
              <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span className="text-sm font-semibold">Enable automated tasks</span>
                <Switch checked={cron.enabled} onChange={(v) => updateCron({ enabled: v })} aria-label="Enable automated tasks" />
              </label>
              <Field label="Run interval">
                <Select value={String(cron.intervalMinutes)} onChange={(e) => updateCron({ intervalMinutes: Number(e.target.value) })}>
                  <option value="1">Every minute</option>
                  <option value="5">Every 5 minutes</option>
                  <option value="15">Every 15 minutes</option>
                  <option value="30">Every 30 minutes</option>
                  <option value="60">Every hour</option>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Delete activity logs older than">
                  <Select value={String(cron.activityLogRetentionMonths)} onChange={(e) => updateCron({ activityLogRetentionMonths: Number(e.target.value) })}>
                    <option value="0">Never</option>
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">1 year</option>
                    <option value="24">2 years</option>
                  </Select>
                </Field>
                <Field label="Delete notification logs older than">
                  <Select value={String(cron.notificationRetentionMonths)} onChange={(e) => updateCron({ notificationRetentionMonths: Number(e.target.value) })}>
                    <option value="0">Never</option>
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">1 year</option>
                  </Select>
                </Field>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span className="text-sm font-semibold">Auto-renew memberships</span>
                <Switch checked={cron.autoRenew} onChange={(v) => updateCron({ autoRenew: v })} aria-label="Auto-renew memberships" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Renewal reminder (days before expiry)"><Input type="number" min="0" value={String(cron.renewalReminderDays)} onChange={(e) => updateCron({ renewalReminderDays: Number(e.target.value) })} /></Field>
                <Field label="Overdue reminder (days after due)"><Input type="number" min="0" value={String(cron.overdueReminderDays)} onChange={(e) => updateCron({ overdueReminderDays: Number(e.target.value) })} /></Field>
              </div>
              <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span className="text-sm font-semibold">Daily summary report</span>
                <Switch checked={cron.dailyReport} onChange={(v) => updateCron({ dailyReport: v })} aria-label="Daily summary report" />
              </label>
            </div>
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <Button onClick={() => { setCompany(c); toast.success('Cron settings saved') }}>Save cron settings</Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'printheader' && <PrintHeaderSettings />}

      {tab === 'maintenance' && (
        <div className="card mt-4 max-w-xl space-y-4 p-5">
          <div>
            <p className="font-semibold">Maintenance mode</p>
            <p className="mt-1 text-sm text-mist">Temporarily take the platform offline for members and staff while you perform updates or fixes.</p>
          </div>
          <label className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5">
            <span className="text-sm font-semibold">Enable maintenance mode</span>
            <Switch checked={!!c.maintenanceMode} onChange={(v) => setC({ ...c, maintenanceMode: v })} aria-label="Enable maintenance mode" />
          </label>
          <Field label="Maintenance message">
            <Textarea value={c.maintenanceMessage || ''} onChange={(e) => setC({ ...c, maintenanceMessage: e.target.value })} placeholder="We'll be back shortly…" />
          </Field>
          <p className="text-xs text-mist">While enabled, visitors see this message instead of the application.</p>
          <div className="flex justify-end border-t border-line pt-4">
            <Button onClick={() => { setCompany(c); toast.success('Maintenance settings saved') }}>Save maintenance settings</Button>
          </div>
        </div>
      )}

      {tab === 'sysupdate' && (
        <div className="mt-4 max-w-xl space-y-4">
          <div className="card p-5">
            <p className="font-semibold">System update</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="font-display text-2xl font-bold">v{APP_VERSION}</span>
              {updateStatus === 'checking' && <Badge tone="amber">Checking…</Badge>}
              {updateStatus === 'uptodate' && <Badge tone="lime">Up to date</Badge>}
              {updateStatus === 'idle' && <Badge tone="zinc">Not checked</Badge>}
            </div>
            <p className="mt-1 text-xs text-mist">Last checked: {lastChecked || 'Never'}</p>
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={checkUpdate} disabled={updateStatus === 'checking'}>
                {updateStatus === 'checking' ? 'Checking…' : 'Check for updates'}
              </Button>
            </div>
          </div>

          <div className="card p-5">
            <p className="font-semibold">Release notes</p>
            <div className="mt-3 space-y-4">
              {RELEASE_NOTES.map((r) => (
                <div key={r.version}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">v{r.version}</span>
                    <span className="text-xs text-mist">{r.date}</span>
                  </div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-mist">
                    {r.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'appearance' && <AppearanceSettings />}

      {tab === 'brand' && (
        <div className="mt-4 space-y-4">
          <div className="card max-w-xl space-y-4 p-5">
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
            <p className="text-sm text-mist">Highlights and the wordmark accent use this colour after you save.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => {
                const next = { ...company, brandPrimary: normalizeHex(c.brandPrimary) }
                setC(next)
                setCompany(next)
                toast.success('Brand colour saved')
              }}>Save branding</Button>
              <Button variant="outline" onClick={() => setC({ ...c, brandPrimary: '#C8F542' })}>Reset to FitPro lime</Button>
            </div>
          </div>

          <div className="card max-w-xl space-y-4 p-5">
            <div>
              <p className="font-semibold">Button colour</p>
              <p className="mt-1 text-sm text-mist">
                Set a custom colour for primary buttons across the app. Leave empty to follow the brand lime.
              </p>
            </div>
            <ColorPicker
              label="Button colour"
              value={c.buttonPrimary || ''}
              onChange={(hex) => setC({ ...c, buttonPrimary: hex })}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"
                style={{ background: c.buttonPrimary ? normalizeHex(c.buttonPrimary) : '#C8F542', color: readableInk(c.buttonPrimary || '#C8F542') }}
              >
                Preview button
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-mist"
              >
                Secondary
              </button>
              <span className="font-mono text-xs font-bold tracking-wider text-mist">
                {c.buttonPrimary ? normalizeHex(c.buttonPrimary) : 'Default lime'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => {
                const next = {
                  ...company,
                  buttonPrimary: c.buttonPrimary ? normalizeHex(c.buttonPrimary) : undefined,
                }
                setC(next)
                setCompany(next)
                toast.success('Button colour saved')
              }}>Save button colour</Button>
              <Button variant="outline" onClick={() => {
                const next = { ...company, buttonPrimary: undefined }
                setC(next)
                setCompany(next)
                toast.success('Button colour reset to default')
              }}>Reset to default</Button>
            </div>
          </div>

          <div className="card max-w-xl space-y-4 p-5">
            <div>
              <p className="font-semibold">Membership card code</p>
              <p className="mt-1 text-sm text-mist">
                Choose which scannable code appears on the member&apos;s digital membership card. The check-in desk reads both.
              </p>
            </div>
            <Segmented
              value={c.cardCodeFormat || 'both'}
              onChange={(v) => setC({ ...c, cardCodeFormat: v as 'qr' | 'barcode' | 'both' })}
              options={[
                { id: 'qr', label: 'QR code' },
                { id: 'barcode', label: 'Barcode' },
                { id: 'both', label: 'Both' },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => {
                const next = { ...company, cardCodeFormat: (c.cardCodeFormat || 'both') as 'qr' | 'barcode' | 'both' }
                setC(next)
                setCompany(next)
                toast.success('Card code saved')
              }}>Save card code</Button>
              <Button variant="outline" onClick={() => setC({ ...c, cardCodeFormat: 'both' })}>Reset to both</Button>
            </div>
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => toast.success('Backup started', 'fitpro-2026-08-13.json')}>Run backup now</Button>
            <Button variant="outline" onClick={() => toast.info('Restore drill queued')}>Test restore</Button>
          </div>
        </div>
      )}

      {tab === 'payments' && <PaymentSettingsForm />}

      {tab === 'data' && <DataMaintenance />}

      {tab === 'modules' && <ModuleManagement />}

      {tab === 'sidebar' && <SidebarMenuOrder />}

      {tab === 'int' && (
        <div className="mt-4">
          <Integrations embedded />
        </div>
      )}
    </div>
  )
}

const CHROME_PRESETS = [
  { id: 'default', name: 'Default', sidebar: undefined as string | undefined, header: undefined as string | undefined, hint: 'Follow the app light/dark theme' },
  { id: 'gracesoft', name: 'Enterprise Navy', sidebar: '#343A40', header: '#1E3D73', hint: 'Dark charcoal sidebar · navy header' },
  { id: 'ocean', name: 'Ocean', sidebar: '#0F2A43', header: '#0B3D6E', hint: 'Deep ocean blues' },
  { id: 'emerald', name: 'Emerald', sidebar: '#10312B', header: '#0F5132', hint: 'Dark green finance' },
  { id: 'midnight', name: 'Midnight', sidebar: '#0B1020', header: '#101C3D', hint: 'Deep blue-black' },
  { id: 'slate', name: 'Slate', sidebar: '#1E293B', header: '#334155', hint: 'Tailwind slate' },
  { id: 'graphite', name: 'Graphite', sidebar: '#1A1A1E', header: '#2A2A31', hint: 'Neutral dark grey' },
  { id: 'indigo', name: 'Indigo', sidebar: '#1E1B4B', header: '#3730A3', hint: 'Deep indigo & violet' },
  { id: 'royal', name: 'Royal Purple', sidebar: '#2A0A4A', header: '#5B21B6', hint: 'Rich purple chrome' },
  { id: 'burgundy', name: 'Burgundy', sidebar: '#2B0F14', header: '#7F1D1D', hint: 'Deep wine & red' },
  { id: 'charcoalLime', name: 'Charcoal & Lime', sidebar: '#1A1A1A', header: '#3F6212', hint: 'Black sidebar · olive header' },
  { id: 'steel', name: 'Steel Blue', sidebar: '#0F172A', header: '#1D4ED8', hint: 'Dark slate · cobalt header' },
  { id: 'teal', name: 'Teal', sidebar: '#042F2E', header: '#115E59', hint: 'Dark teal chrome' },
  { id: 'chocolate', name: 'Chocolate', sidebar: '#2A1606', header: '#7C2D12', hint: 'Warm brown chrome' },
  { id: 'lightGray', name: 'Light Grey', sidebar: '#F1F5F9', header: '#E2E8F0', hint: 'Light slate chrome' },
  { id: 'skyLight', name: 'Sky', sidebar: '#E0F2FE', header: '#0284C7', hint: 'Light blue sidebar · sky header' },
  { id: 'roseLight', name: 'Rose', sidebar: '#FFF1F2', header: '#E11D48', hint: 'Light pink sidebar · rose header' },
  { id: 'sand', name: 'Sand', sidebar: '#FAF3E8', header: '#B45309', hint: 'Warm cream · amber header' },
]

function AppearanceSettings() {
  const { company, setCompany } = useApp()
  const toast = useToast()
  const [sidebar, setSidebar] = useState(company.sidebarColor || '')
  const [header, setHeader] = useState(company.headerColor || '')
  const [preloaderOn, setPreloaderOn] = useState(company.preloaderEnabled !== false)

  const apply = (sb: string | undefined, hd: string | undefined) => {
    const next = {
      ...company,
      sidebarColor: sb || undefined,
      headerColor: hd || undefined,
    }
    setCompany(next)
    setSidebar(sb || '')
    setHeader(hd || '')
    toast.success('Appearance saved', 'Sidebar and header colours were updated.')
  }

  const pickPreset = (p: (typeof CHROME_PRESETS)[number]) => apply(p.sidebar, p.header)

  return (
    <div className="mt-4 space-y-4">
      <div className="card max-w-3xl space-y-4 p-5">
        <div>
          <p className="font-semibold">Theme presets</p>
          <p className="mt-1 text-sm text-mist">Pick a ready-made sidebar and header colour theme.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHROME_PRESETS.map((p) => {
            const active =
              (p.sidebar || undefined) === (company.sidebarColor || undefined) &&
              (p.header || undefined) === (company.headerColor || undefined)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p)}
                className={`rounded-xl border p-3 text-left transition ${active ? 'border-lime ring-1 ring-lime' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex h-12 overflow-hidden rounded-lg">
                  <span className="w-1/3" style={{ background: p.sidebar || '#0e0e11' }} />
                  <span className="w-2/3" style={{ background: p.header || '#0b0b0d' }} />
                </div>
                <p className="mt-2 text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-mist">{p.hint}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="card max-w-3xl space-y-4 p-5">
        <div>
          <p className="font-semibold">Custom colours</p>
          <p className="mt-1 text-sm text-mist">Choose exact colours for the sidebar and top header.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <ColorPicker label="Sidebar background" value={sidebar} onChange={setSidebar} />
            <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: sidebar || '#0e0e11' }}>
              <span className="text-xs font-semibold" style={{ color: readableInk(sidebar || '#0e0e11') }}>Sidebar preview</span>
            </div>
          </div>
          <div>
            <ColorPicker label="Top header background" value={header} onChange={setHeader} />
            <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: header || '#0b0b0d' }}>
              <span className="text-xs font-semibold" style={{ color: readableInk(header || '#0b0b0d') }}>Header preview</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => apply(sidebar || undefined, header || undefined)}>Save appearance</Button>
          <Button variant="outline" onClick={() => apply(undefined, undefined)}>Reset to default</Button>
        </div>
      </div>

      <div className="card max-w-3xl p-5">
        <label className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Page preloader</p>
            <p className="mt-1 text-sm text-mist">Show a loading spinner when navigating between pages.</p>
          </div>
          <Switch
            checked={preloaderOn}
            onChange={(v) => {
              setPreloaderOn(v)
              setCompany({ ...company, preloaderEnabled: v })
              toast.success(v ? 'Preloader enabled' : 'Preloader disabled')
            }}
            aria-label="Toggle page preloader"
          />
        </label>
      </div>
    </div>
  )
}

function SidebarMenuOrder() {
  const { sidebarOrder, setSidebarOrder, modules } = useApp()
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // `sidebarOrder` from context is the single source of truth; every mutation
  // persists it immediately so the main sidebar updates live.
  const order = sidebarOrder

  const ordered = useMemo(() => {
    const rank = new Map(order.map((id, i) => [id, i]))
    return [...MODULES].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999))
  }, [order])

  const apply = (next: string[]) => {
    setSidebarOrder(next)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1500)
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    apply(next)
  }

  const moveToTop = (index: number) => {
    const next = [...order]
    const [item] = next.splice(index, 1)
    next.unshift(item)
    apply(next)
  }

  const moveToBottom = (index: number) => {
    const next = [...order]
    const [item] = next.splice(index, 1)
    next.push(item)
    apply(next)
  }

  const reset = () => {
    apply(defaultSidebarOrder())
    toast.info('Sidebar order reset to default')
  }

  // ---- Drag & drop ----
  const onDragStart = (id: string) => {
    setDragId(id)
  }
  const onDragEnter = (id: string) => {
    if (id !== dragId) setOverId(id)
  }
  const onDragEnd = () => {
    if (dragId && overId && dragId !== overId) {
      const next = [...order]
      const from = next.indexOf(dragId)
      const to = next.indexOf(overId)
      if (from !== -1 && to !== -1) {
        const [item] = next.splice(from, 1)
        next.splice(to, 0, item)
        apply(next)
      }
    }
    setDragId(null)
    setOverId(null)
  }
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  return (
    <div className="card max-w-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">Sidebar Menu</h3>
          <p className="mt-1 text-sm text-mist">Drag or use the arrows to reorder — the sidebar updates instantly.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={reset}><RotateCcw className="size-4" /> Reset</Button>
          <span className="flex items-center text-xs font-semibold text-lime">{saved ? <><Check className="size-4" /> Saved</> : null}</span>
        </div>
      </div>

      <div className="mt-4 border-b border-line pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-mist">Selected Sidebar Menus</p>
      </div>

      <ul className="mt-2 space-y-1" onDragOver={onDragOver}>
        {ordered.map((m, i) => {
          const enabled = modules[m.id] !== false
          const isDragging = dragId === m.id
          const isOver = overId === m.id && !isDragging
          return (
            <li
              key={m.id}
              draggable
              onDragStart={() => onDragStart(m.id)}
              onDragEnter={() => onDragEnter(m.id)}
              onDragEnd={onDragEnd}
              className={`group flex cursor-grab items-center gap-2 rounded-xl border border-white/5 px-3 py-2.5 transition active:cursor-grabbing ${
                isDragging ? 'opacity-40' : ''
              } ${isOver ? 'border-lime ring-1 ring-lime' : 'hover:border-white/15'} ${!enabled ? 'opacity-50' : ''}`}
            >
              <GripVertical className="size-4 shrink-0 text-mist" aria-hidden />
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-lime/10 text-[11px] font-bold text-lime">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{m.label}</p>
                <p className="truncate text-xs text-mist">{m.description}</p>
              </div>
              {!enabled && <Badge tone="zinc">Hidden</Badge>}
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Move to top" onClick={() => moveToTop(i)} disabled={i === 0}><ChevronUp className="size-3.5" /></button>
                <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ChevronUp className="size-3.5" /></button>
                <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Move down" onClick={() => move(i, 1)} disabled={i === ordered.length - 1}><ChevronDown className="size-3.5" /></button>
                <button className="rounded-md p-1.5 text-mist hover:bg-black/5 hover:text-inherit dark:hover:bg-white/10" title="Move to bottom" onClick={() => moveToBottom(i)} disabled={i === ordered.length - 1}><ChevronDown className="size-3.5" /></button>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs text-mist">
        Hidden modules are shown dimmed but still reorderable. Use the Modules tab to show or hide a module.
      </p>
    </div>
  )
}
