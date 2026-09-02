import { useEffect, useMemo, useState } from 'react'
import { ChevronUp, ChevronDown, GripVertical, RotateCcw, Check, Receipt, Percent, Lock, ShieldAlert } from 'lucide-react'
import { PageHeader, Button, Field, Input, Select, Segmented, Textarea, Badge, SearchField, Switch } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { loadMail, mailReady, saveMail, sendVerificationEmail, type MailConfig, type MailProvider } from '../../lib/mail'
import { NotifySettings } from '../../components/NotifySettings'
import { ColorPicker } from '../../components/ColorPicker'
import { defaultCredentialSettings, policySummary } from '../../lib/credentials'
import { normalizeHex, readableInk } from '../../lib/color'
import { cn } from '../../lib/utils'
import { TIMEZONES } from '../../lib/timezones'
import { CURRENCIES } from '../../lib/currencies'
import { COUNTRIES, regionsFor } from '../../lib/geo'
import { DATA_COLLECTIONS } from '../../lib/dataReset'
import type { CredentialSettings, CronSettings, TaxDiscountMode, TaxDiscountSettings, SaleDiscountType } from '../../types'
import { DEFAULT_TAX_DISCOUNT_SETTINGS, TAX_DISCOUNT_MODES, describeTaxDiscountChange, resolveTaxDiscountPolicy, taxDiscountSettings } from '../../lib/taxDiscountPolicy'
import { DEFAULT_BRANCH_TAXES } from '../../lib/branchSettings'
import { useAuth } from '../../context/AuthContext'
import { Integrations } from './Integrations'
import { DataMaintenance } from './DataMaintenance'
import { CustomFieldsSettings } from './CustomFieldsSettings'
import { PrintHeaderSettings } from './PrintHeaderSettings'
import { PaymentSettingsForm } from './PaymentSettingsForm'
import { ModuleManagement } from './ModuleManagement'
import { MODULES, defaultSidebarOrder } from '../../lib/modules'
import { DEFAULT_PREFIXES, DEFAULT_ALLOWED_FILE_TYPES, DEFAULT_CRON_SETTINGS } from '../../data/seed'
import { DEFAULT_INVOICE_SCHEME, INVOICE_THEMES, resolveInvoiceScheme, formatInvoiceNumber, nextInvoiceNumber, upcomingInvoiceNumbers, effectiveSequence } from '../../lib/invoiceScheme'

const tabs = [
  { id: 'company', label: 'Company' },
  { id: 'prefixes', label: 'Prefixes' },
  { id: 'invoicescheme', label: 'Invoice scheme' },
  { id: 'taxdiscount', label: 'Tax & Discount' },
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
      country: co.country || prev.country,
      stateRegion: co.stateRegion || prev.stateRegion,
      location: co.location || prev.location,
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
            <Field label={<>Country <BranchTag /></>} required>
              <Select value={c.country || 'Ghana'} onChange={(e) => setC({ ...c, country: e.target.value, stateRegion: '' })}>
                {COUNTRIES.map((co) => <option key={co} value={co}>{co}</option>)}
              </Select>
            </Field>
            <Field label={<>State/Region <BranchTag /></>} required>
              {regionsFor(c.country || 'Ghana') ? (
                <Select value={c.stateRegion || ''} onChange={(e) => setC({ ...c, stateRegion: e.target.value })}>
                  <option value="" disabled>Select region…</option>
                  {regionsFor(c.country || 'Ghana')!.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              ) : (
                <Input value={c.stateRegion || ''} onChange={(e) => setC({ ...c, stateRegion: e.target.value })} placeholder="State / province / region" />
              )}
            </Field>
            <Field label={<>Location <BranchTag /></>} required><Input value={c.location || ''} onChange={(e) => setC({ ...c, location: e.target.value })} placeholder="City / town, e.g. Accra" /></Field>
            <Field label="Web Address"><Input value={c.webAddress || ''} onChange={(e) => setC({ ...c, webAddress: e.target.value })} placeholder="www.example.com" /></Field>
            <Field label="Footer Brand Name"><Input value={c.footerBrand || ''} onChange={(e) => setC({ ...c, footerBrand: e.target.value })} placeholder={c.name || 'e.g. iGracesoft'} /></Field>
            <Field label="Footer Brand Link"><Input value={c.footerUrl || ''} onChange={(e) => setC({ ...c, footerUrl: e.target.value })} placeholder="https://igracesoft.com" /></Field>
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

      {tab === 'invoicescheme' && (() => {
        const scheme = resolveInvoiceScheme(c.invoiceScheme)
        const updateScheme = (patch: Partial<typeof scheme>) => setC({ ...c, invoiceScheme: { ...scheme, ...patch } })
        const brand = normalizeHex(c.brandPrimary || '#C8F542')
        const ink = readableInk(brand)
        const seq = effectiveSequence(scheme)
        const year = seq.year
        const paddedExample = String(scheme.nextNumber).padStart(Math.max(0, Math.min(10, scheme.padding || 0)), '0')
        const sep = scheme.separator || ''
        const step = (n: number, label: string) => (
          <p className="mt-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-mist">
            <span className="grid size-5 place-items-center rounded-md font-mono text-[10px]" style={{ background: `${brand}1f`, color: brand }}>{n}</span>
            {label}
          </p>
        )
        const PRESETS: { name: string; hint: string; scheme: Partial<typeof scheme> }[] = [
          { name: 'Classic', hint: formatInvoiceNumber({ ...scheme, format: 'number', prefix: 'INV-', padding: 6, suffix: '', yearFormat: 'full' }, 1, year), scheme: { format: 'number', prefix: 'INV-', padding: 6, suffix: '', yearFormat: 'full' } },
          { name: 'Yearly', hint: formatInvoiceNumber({ ...scheme, format: 'year-number', prefix: 'INV-', padding: 4, separator: '/', suffix: '', yearFormat: 'full' }, 1, year), scheme: { format: 'year-number', prefix: 'INV-', padding: 4, separator: '/', suffix: '', yearFormat: 'full' } },
          { name: 'Compact', hint: formatInvoiceNumber({ ...scheme, format: 'number-year', prefix: 'INV-', padding: 3, separator: '-', suffix: '', yearFormat: 'short' }, 1, year), scheme: { format: 'number-year', prefix: 'INV-', padding: 3, separator: '-', suffix: '', yearFormat: 'short' } },
          { name: 'Tagged', hint: formatInvoiceNumber({ ...scheme, format: 'number-year', prefix: 'FIN-', padding: 4, separator: '/', suffix: '-FIT', yearFormat: 'full' }, 1, year), scheme: { format: 'number-year', prefix: 'FIN-', padding: 4, separator: '/', suffix: '-FIT', yearFormat: 'full' } },
        ]
        const FORMATS: { value: typeof scheme.format; label: string; hint: string }[] = [
          { value: 'number', label: 'Number', hint: formatInvoiceNumber({ ...scheme, format: 'number' }, scheme.nextNumber, year) },
          { value: 'number-year', label: 'Number with year', hint: formatInvoiceNumber({ ...scheme, format: 'number-year' }, scheme.nextNumber, year) },
          { value: 'year-number', label: 'Year with number', hint: formatInvoiceNumber({ ...scheme, format: 'year-number' }, scheme.nextNumber, year) },
        ]
        const PADDINGS = [0, 2, 3, 4, 5, 6]
        const SEPARATORS: { value: string; label: string; symbol: string }[] = [
          { value: '-', label: 'Dash', symbol: '-' },
          { value: '/', label: 'Slash', symbol: '/' },
          { value: '_', label: 'Underscore', symbol: '_' },
          { value: '', label: 'None', symbol: '—' },
        ]
        const usesYear = scheme.format !== 'number'
        const customSeparator = usesYear && !SEPARATORS.some((s) => s.value === scheme.separator)
        const upcoming = upcomingInvoiceNumbers(scheme, 5)
        const pillCls = (selected: boolean) => cn('rounded-lg border px-3 py-2 text-xs font-semibold transition', !selected && 'border-line hover:bg-black/[0.03] dark:hover:bg-white/[0.05]')
        const pillStyle = (selected: boolean) => (selected ? { background: brand, borderColor: brand, color: ink } : undefined)
        const breakdown: [string, string][] = [
          ['Prefix', scheme.prefix || '—'],
          ['Number', `${paddedExample}${scheme.padding ? ` (${scheme.padding} digits)` : ''}`],
          ...(usesYear ? [['Separator', sep ? `"${sep}"` : '—'] as [string, string], ['Year', `${scheme.yearFormat === 'short' ? String(year).slice(-2) : year} (${scheme.yearFormat === 'short' ? 'short' : 'full'})`] as [string, string]] : []),
          ['Suffix', scheme.suffix || '—'],
        ]
        return (
          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
            {/* Configuration */}
            <div className="card p-5">
              <div className="mb-5 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: `${brand}1f`, color: brand }}>
                  <Receipt className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">Invoice numbering scheme</p>
                  <p className="mt-0.5 text-xs text-mist">Choose how invoice numbers are built. The next number is consumed automatically whenever an invoice is created.</p>
                </div>
              </div>

              {step(1, 'Start from a preset')}
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => updateScheme({ ...preset.scheme, nextNumber: scheme.nextNumber })}
                    title={`Apply the ${preset.name} scheme`}
                    className="rounded-xl border border-line p-3 text-left transition hover:bg-black/[0.03] dark:hover:bg-white/[0.05]"
                  >
                    <span className="block text-sm font-semibold">{preset.name}</span>
                    <span className="mt-1 block truncate font-mono text-xs text-mist">{preset.hint}</span>
                  </button>
                ))}
              </div>

              {step(2, 'Number format')}
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {FORMATS.map((f) => {
                  const selected = scheme.format === f.value
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => updateScheme({ format: f.value })}
                      aria-pressed={selected}
                      className={cn('rounded-xl border p-3 text-left transition', !selected && 'border-line hover:bg-black/[0.03] dark:hover:bg-white/[0.05]')}
                      style={selected ? { borderColor: brand, boxShadow: `0 0 0 1px ${brand}`, background: `${brand}12` } : undefined}
                    >
                      <span className="block text-sm font-semibold">{f.label}</span>
                      <span className="mt-1 block truncate font-mono text-xs text-mist">{f.hint}</span>
                    </button>
                  )
                })}
              </div>

              {step(3, 'Prefix & suffix')}
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Invoice prefix">
                  <Input value={scheme.prefix} onChange={(e) => updateScheme({ prefix: e.target.value })} placeholder="INV-" />
                </Field>
                <Field label="Suffix (optional)">
                  <Input value={scheme.suffix || ''} onChange={(e) => updateScheme({ suffix: e.target.value })} placeholder="e.g. -FIT" />
                </Field>
              </div>

              {step(4, 'Zeros padding')}
              <div className="mt-2 flex flex-wrap gap-2">
                {PADDINGS.map((p) => (
                  <button key={p} type="button" onClick={() => updateScheme({ padding: p })} aria-pressed={scheme.padding === p} className={pillCls(scheme.padding === p)} style={pillStyle(scheme.padding === p)}>
                    {p === 0 ? 'None' : `${p} digits`}
                  </button>
                ))}
              </div>

              {usesYear && (
                <>
                  {step(5, 'Year separator & style')}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SEPARATORS.map((s) => (
                      <button key={s.value || 'none'} type="button" onClick={() => updateScheme({ separator: s.value })} aria-pressed={scheme.separator === s.value && !customSeparator} className={pillCls(scheme.separator === s.value && !customSeparator)} style={pillStyle(scheme.separator === s.value && !customSeparator)}>
                        {s.label} <span className="font-mono">{s.symbol}</span>
                      </button>
                    ))}
                    <button type="button" onClick={() => updateScheme({ separator: customSeparator ? scheme.separator : '.' })} aria-pressed={customSeparator} className={pillCls(customSeparator)} style={pillStyle(customSeparator)}>
                      Custom
                    </button>
                  </div>
                  {customSeparator && (
                    <div className="mt-2 max-w-[220px]">
                      <Field label="Custom separator">
                        <Input value={scheme.separator} maxLength={3} onChange={(e) => updateScheme({ separator: e.target.value })} placeholder="e.g. . or / or -" />
                      </Field>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => updateScheme({ yearFormat: 'full' })} aria-pressed={scheme.yearFormat !== 'short'} className={pillCls(scheme.yearFormat !== 'short')} style={pillStyle(scheme.yearFormat !== 'short')}>
                      Full year <span className="font-mono">{year}</span>
                    </button>
                    <button type="button" onClick={() => updateScheme({ yearFormat: 'short' })} aria-pressed={scheme.yearFormat === 'short'} className={pillCls(scheme.yearFormat === 'short')} style={pillStyle(scheme.yearFormat === 'short')}>
                      Short year <span className="font-mono">{String(year).slice(-2)}</span>
                    </button>
                  </div>
                </>
              )}

              {step(usesYear ? 6 : 5, 'Sequence')}
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Field label="Next number">
                  <Input type="number" min={1} value={scheme.nextNumber} onChange={(e) => updateScheme({ nextNumber: Math.max(1, Number(e.target.value) || 1) })} className="w-36" />
                </Field>
                <Button variant="outline" size="sm" onClick={() => updateScheme({ nextNumber: 1 })}>
                  <RotateCcw className="size-4" aria-hidden /> Set to 1
                </Button>
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-line px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Restart numbering every year</span>
                  <span className="block text-xs text-mist">On {scheme.resetYearly ? '1 January' : '1 January'}, numbering starts again from 1 instead of continuing.</span>
                </span>
                <Switch checked={!!scheme.resetYearly} onChange={(next) => updateScheme({ resetYearly: next, year: next ? new Date().getFullYear() : scheme.year })} aria-label="Restart numbering every year" />
              </label>
              {scheme.resetYearly && (
                <p className="mt-2 text-xs text-mist">
                  Current sequence: <span className="font-semibold">{seq.number}</span> for {year}.
                  {scheme.year && scheme.year !== year ? ' The stored year differs, so numbering has restarted for the new year.' : ''}
                </p>
              )}

              {step(usesYear ? 7 : 6, 'Invoice theme')}
              <p className="mt-1 text-xs text-mist">How invoices look when viewed or printed.</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {INVOICE_THEMES.map((th) => {
                  const selected = (scheme.theme || 'classic') === th.id
                  const banded = th.id === 'modern' || th.id === 'bold'
                  const line = th.id === 'bold' ? 'bg-zinc-600' : 'bg-zinc-200'
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => updateScheme({ theme: th.id })}
                      aria-pressed={selected}
                      className={cn('rounded-xl border p-2 text-left transition', !selected && 'border-line hover:bg-black/[0.03] dark:hover:bg-white/[0.05]')}
                      style={selected ? { borderColor: brand, boxShadow: `0 0 0 1px ${brand}`, background: `${brand}12` } : undefined}
                    >
                      <span className="block h-24 overflow-hidden rounded-lg bg-white p-2 ring-1 ring-black/10">
                        <span className="flex h-7 items-start justify-between rounded-md px-1.5 py-1.5" style={banded ? { background: th.id === 'modern' ? brand : '#18181b' } : { borderBottom: '1px solid #e4e4e7' }}>
                          <span className="h-1.5 w-8 rounded-full" style={{ background: th.id === 'modern' ? 'rgba(255,255,255,0.85)' : th.id === 'bold' ? '#a1a1aa' : '#d4d4d8' }} />
                          <span className="h-2 w-6 rounded-sm" style={{ background: th.id === 'bold' ? brand : th.id === 'modern' ? 'rgba(255,255,255,0.55)' : '#e4e4e7' }} />
                        </span>
                        <span className="mt-2 block space-y-1 px-0.5">
                          <span className="flex gap-1 rounded px-0.5 py-0.5" style={th.id === 'modern' ? { background: `${brand}1f` } : th.id === 'bold' ? { background: '#18181b' } : undefined}>
                            <span className="h-1 flex-1 rounded-full" style={{ background: th.id === 'bold' ? '#52525b' : '#d4d4d8' }} />
                            <span className="h-1 w-3 rounded-full" style={{ background: th.id === 'bold' ? '#52525b' : '#d4d4d8' }} />
                          </span>
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="flex gap-1">
                              <span className={`h-1 flex-1 rounded-full ${line}`} />
                              <span className={`h-1 w-3 rounded-full ${line}`} />
                            </span>
                          ))}
                        </span>
                      </span>
                      <span className="mt-2 block text-sm font-semibold">{th.name}</span>
                      <span className="mt-0.5 block text-xs text-mist">{th.desc}</span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <Button variant="outline" onClick={() => setC({ ...c, invoiceScheme: { ...DEFAULT_INVOICE_SCHEME } })}>
                  <RotateCcw className="size-4" aria-hidden /> Reset to defaults
                </Button>
                <Button onClick={() => { setCompany(c); toast.success('Invoice scheme saved') }}>Save invoice scheme</Button>
              </div>
            </div>

            {/* Live preview */}
            <div className="card overflow-hidden lg:sticky lg:top-4">
              <div className="border-b border-line px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">Live preview</p>
                <p className="mt-0.5 text-xs text-mist">How the next invoice will be numbered</p>
              </div>
              <div className="space-y-4 px-5 py-5">
                <div className="rounded-xl border border-line px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{c.name}</p>
                      <p className="text-xs text-mist">Invoice</p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-line bg-black/[0.03] px-2.5 py-1.5 font-mono text-sm font-bold dark:bg-white/[0.05]">{nextInvoiceNumber(scheme)}</span>
                  </div>
                </div>
                <dl className="space-y-1.5">
                  {breakdown.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 text-xs">
                      <dt className="text-mist">{label}</dt>
                      <dd className="truncate font-mono font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">The next 5 numbers</p>
                  <ol className="mt-2 space-y-1.5">
                    {upcoming.map((number, i) => (
                      <li key={number} className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 font-mono text-xs', i === 0 ? 'border-dashed font-bold' : 'border-line text-mist')}>
                        <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line text-[10px] font-bold">{i + 1}</span>
                        {number}
                        {i === 0 && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide" style={{ color: brand }}>next</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {tab === 'taxdiscount' && <TaxDiscountSettingsPanel />}

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

/**
 * Settings → Tax & Discount.
 *
 * Company-wide policy consumed by every transaction form. Writing is gated on
 * `settings.manage`; every save is diffed field-by-field into the audit trail
 * with the previous value, the new value, the user and the timestamp.
 */
function TaxDiscountSettingsPanel() {
  const { company, setCompany, branchSettings, log } = useApp()
  const { user, hasPermission } = useAuth()
  const toast = useToast()

  const saved = useMemo(() => taxDiscountSettings(company), [company])
  const [form, setForm] = useState<TaxDiscountSettings>(saved)
  const canManage = hasPermission('settings.manage')

  // Re-sync when the active company changes underneath the form.
  useEffect(() => { setForm(saved) }, [saved])

  const set = <K extends keyof TaxDiscountSettings>(key: K, value: TaxDiscountSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  // Tax names come from the branch tax table so the default always resolves.
  const taxChoices = useMemo(() => {
    const seen = new Map<string, number>()
    for (const t of DEFAULT_BRANCH_TAXES) if (t.status === 'active') seen.set(t.name, t.rate)
    for (const b of branchSettings) for (const t of b.taxRates || []) if (t.status === 'active') seen.set(t.name, t.rate)
    return [...seen.entries()].map(([name, rate]) => ({ name, rate }))
  }, [branchSettings])

  const diff = describeTaxDiscountChange(saved, form)
  const dirty = diff.length > 0
  const preview = resolveTaxDiscountPolicy({ taxDiscount: form })

  const save = () => {
    if (!canManage) {
      toast.error('Not permitted', 'Only administrators with “Manage system settings” may change this policy.')
      return
    }
    if (!dirty) {
      toast.info('No changes to save')
      return
    }
    if (form.taxMode === 'mandatory' && !(form.defaultTaxRate > 0)) {
      toast.error('Set a default tax rate', 'Mandatory tax needs a rate above zero to apply automatically.')
      return
    }
    if (form.discountMode === 'mandatory' && !(form.defaultDiscountValue > 0)) {
      toast.error('Set a default discount', 'A mandatory discount needs a value above zero.')
      return
    }
    setCompany({ ...company, taxDiscount: form })
    log(user?.id || 'system', 'UPDATE', 'Tax & Discount settings', diff)
    toast.success('Tax & discount policy saved', 'Applied to POS, sales, quotations and invoices.')
  }

  const ModeField = ({
    title,
    value,
    onChange,
    disabled,
  }: { title: string; value: TaxDiscountMode; onChange: (next: TaxDiscountMode) => void; disabled: boolean }) => (
    <div className={cn('grid gap-2 sm:grid-cols-3', disabled && 'pointer-events-none opacity-45')}>
      {TAX_DISCOUNT_MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          onClick={() => onChange(mode.value)}
          aria-pressed={value === mode.value}
          className={cn(
            'rounded-xl border p-3 text-left transition',
            value === mode.value
              ? 'border-lime bg-lime/10 shadow-[0_0_0_3px_rgb(200_245_66_/_0.15)]'
              : 'border-line hover:border-lime/50',
          )}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{mode.label}</span>
            {value === mode.value && <Check className="size-4 text-lime" aria-hidden />}
          </span>
          <span className="mt-1 block text-xs leading-snug text-mist">{mode.hint}</span>
          <span className="sr-only">{title}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="mt-4 max-w-4xl space-y-4">
      {!canManage && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
          <span>
            <span className="font-semibold">Read-only.</span> Changing the tax &amp; discount policy requires the
            <span className="font-mono"> settings.manage </span> permission.
          </span>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-start gap-3 border-b border-line pb-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-lime/15 text-lime"><Percent className="size-5" aria-hidden /></span>
          <div>
            <p className="font-display text-lg font-bold">Tax &amp; Discount Settings</p>
            <p className="mt-0.5 text-sm text-mist">
              Applies to Standard POS, Advanced POS, sales orders, quotations and invoices. Hidden features are never
              calculated; mandatory features cannot be bypassed by cashiers.
            </p>
          </div>
        </div>

        {/* ── Tax ── */}
        <fieldset className={cn('mt-5', !canManage && 'pointer-events-none opacity-60')} disabled={!canManage}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Tax configuration</p>
              <p className="text-xs text-mist">Turn tax off entirely, or choose how strictly it is enforced.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Enable Tax
              <Switch checked={form.taxEnabled} onChange={(v) => set('taxEnabled', v)} aria-label="Enable tax" />
              <span className="w-8 text-mist">{form.taxEnabled ? 'Yes' : 'No'}</span>
            </label>
          </div>

          <div className={cn('mt-3 space-y-3', !form.taxEnabled && 'pointer-events-none opacity-45')}>
            <ModeField title="Tax mode" value={form.taxMode} onChange={(v) => set('taxMode', v)} disabled={!form.taxEnabled} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Default tax">
                <Select
                  value={form.defaultTaxName || ''}
                  onChange={(e) => {
                    const name = e.target.value
                    const match = taxChoices.find((t) => t.name === name)
                    setForm((prev) => ({ ...prev, defaultTaxName: name, defaultTaxRate: match ? match.rate : prev.defaultTaxRate }))
                  }}
                >
                  <option value="">No default</option>
                  {taxChoices.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.rate}%)</option>)}
                </Select>
              </Field>
              <Field label="Default tax rate (%)">
                <Input
                  type="number" min="0" max="100" step="0.01"
                  value={form.defaultTaxRate}
                  onChange={(e) => set('defaultTaxRate', Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Allow users to modify tax">
                <Select value={form.allowTaxOverride ? 'yes' : 'no'} onChange={(e) => set('allowTaxOverride', e.target.value === 'yes')}>
                  <option value="yes">Yes — editable during transactions</option>
                  <option value="no">No — read-only field</option>
                </Select>
              </Field>
            </div>
          </div>
        </fieldset>

        {/* ── Discount ── */}
        <fieldset className={cn('mt-6 border-t border-line pt-5', !canManage && 'pointer-events-none opacity-60')} disabled={!canManage}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Discount configuration</p>
              <p className="text-xs text-mist">Control whether staff may discount, must discount, or cannot discount at all.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              Enable Discount
              <Switch checked={form.discountEnabled} onChange={(v) => set('discountEnabled', v)} aria-label="Enable discount" />
              <span className="w-8 text-mist">{form.discountEnabled ? 'Yes' : 'No'}</span>
            </label>
          </div>

          <div className={cn('mt-3 space-y-3', !form.discountEnabled && 'pointer-events-none opacity-45')}>
            <ModeField title="Discount mode" value={form.discountMode} onChange={(v) => set('discountMode', v)} disabled={!form.discountEnabled} />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Default discount type">
                <Select value={form.defaultDiscountType} onChange={(e) => set('defaultDiscountType', e.target.value as SaleDiscountType)}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </Field>
              <Field label={form.defaultDiscountType === 'percentage' ? 'Default discount (%)' : 'Default discount amount'}>
                <Input
                  type="number" min="0" step="0.01"
                  value={form.defaultDiscountValue}
                  onChange={(e) => set('defaultDiscountValue', Math.max(0, Number(e.target.value) || 0))}
                />
              </Field>
              <Field label="Allow users to modify discount">
                <Select value={form.allowDiscountOverride ? 'yes' : 'no'} onChange={(e) => set('allowDiscountOverride', e.target.value === 'yes')}>
                  <option value="yes">Yes — editable during transactions</option>
                  <option value="no">No — read-only field</option>
                </Select>
              </Field>
            </div>
          </div>
        </fieldset>

        {/* ── Effect preview + save ── */}
        <div className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-mist">Tax on transaction forms</p>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
              {preview.tax.visible ? <Badge tone={preview.tax.required ? 'amber' : 'lime'}>{preview.tax.label}</Badge> : <Badge>Hidden</Badge>}
              {preview.tax.visible && !preview.tax.editable && <span className="flex items-center gap-1 text-xs text-mist"><Lock className="size-3" aria-hidden /> read-only</span>}
            </p>
            <p className="mt-1.5 text-xs leading-snug text-mist">
              {!preview.tax.visible
                ? 'Tax fields are removed and no tax is calculated.'
                : preview.tax.required
                  ? `Every sale is taxed at ${preview.tax.defaultRate}%${preview.tax.defaultName ? ` (${preview.tax.defaultName})` : ''} and cannot be completed without it.`
                  : `Staff may apply tax; new transactions start at ${preview.tax.defaultRate}%.`}
            </p>
          </div>
          <div className="rounded-xl border border-line p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-mist">Discount on transaction forms</p>
            <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
              {preview.discount.visible ? <Badge tone={preview.discount.required ? 'amber' : 'lime'}>{preview.discount.label}</Badge> : <Badge>Hidden</Badge>}
              {preview.discount.visible && !preview.discount.editable && <span className="flex items-center gap-1 text-xs text-mist"><Lock className="size-3" aria-hidden /> read-only</span>}
            </p>
            <p className="mt-1.5 text-xs leading-snug text-mist">
              {!preview.discount.visible
                ? 'Discount fields are removed and no discount is calculated.'
                : preview.discount.required
                  ? `Every sale carries a ${preview.discount.defaultValue}${preview.discount.defaultType === 'percentage' ? '%' : ''} discount.`
                  : 'Staff choose whether to discount each sale.'}
            </p>
          </div>
        </div>

        {dirty && (
          <div className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-xs">
            <p className="font-bold text-sky-600 dark:text-sky-400">Pending changes — recorded in the audit trail on save</p>
            <p className="mt-1 text-mist">{diff}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button variant="outline" onClick={() => setForm(saved)} disabled={!dirty}>Discard</Button>
          <Button variant="outline" onClick={() => setForm(DEFAULT_TAX_DISCOUNT_SETTINGS)} disabled={!canManage}>
            <RotateCcw className="size-4" aria-hidden /> Reset to defaults
          </Button>
          <Button onClick={save} disabled={!canManage || !dirty}>Save tax &amp; discount policy</Button>
        </div>
      </div>
    </div>
  )
}
