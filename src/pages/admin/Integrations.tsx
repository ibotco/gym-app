import { useMemo, useState } from 'react'
import { RefreshCw, ShieldAlert } from 'lucide-react'
import {
  Badge, Button, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard, StatusBadge,
} from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatDateTime } from '../../lib/utils'
import {
  CATEGORIES, applyTest, badgeFor, categoryLabel, emptyConfig, healthOf, loadIntegrationLogs,
  loadIntegrations, makeLog, maskSecret, saveIntegrationLogs, saveIntegrations, sealSecret,
  testIntegration, validateIntegration,
} from '../../lib/integrations'
import { PAYSTACK_CHANNELS, PAYSTACK_ID, testPaystackConnection } from '../../lib/paystack'
import type { IntegrationCategory, IntegrationConfig, IntegrationLog, IntegrationRecord } from '../../types'

const SECRET_KEYS = ['apiKey', 'secretKey', 'accessToken', 'password'] as const

function sealConfig(cfg: IntegrationConfig): IntegrationConfig {
  return {
    ...cfg,
    apiKey: sealSecret(cfg.apiKey),
    secretKey: sealSecret(cfg.secretKey),
    accessToken: sealSecret(cfg.accessToken),
    password: sealSecret(cfg.password),
  }
}

export function Integrations({ embedded }: { embedded?: boolean }) {
  const { user, hasRole } = useAuth()
  const { log, notify } = useApp()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')
  const [list, setList] = useState<IntegrationRecord[]>(loadIntegrations)
  const [logs, setLogs] = useState<IntegrationLog[]>(loadIntegrationLogs)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState('all')
  const [connFilter, setConnFilter] = useState('all')
  const [errOnly, setErrOnly] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'setup' | 'health' | 'logs'>('setup')
  const [draft, setDraft] = useState<IntegrationConfig>(emptyConfig())
  const [busy, setBusy] = useState(false)
  const [disableTarget, setDisableTarget] = useState<IntegrationRecord | null>(null)
  const [testOut, setTestOut] = useState<{ ok: boolean; code: string; ms: number; detail: string } | null>(null)
  const [logQ, setLogQ] = useState('')

  const persist = (next: IntegrationRecord[], nextLogs?: IntegrationLog[]) => {
    setList(next)
    saveIntegrations(next)
    if (nextLogs) {
      setLogs(nextLogs)
      saveIntegrationLogs(nextLogs)
    }
  }

  const addLog = (entry: Omit<IntegrationLog, 'id' | 'createdAt'>) => {
    const row = makeLog(entry)
    const next = [row, ...logs]
    setLogs(next)
    saveIntegrationLogs(next)
    log(user?.id || 'admin', entry.action.toUpperCase().replace(/\s+/g, '_'), 'Integration', `${entry.integrationName}: ${entry.details}`)
    return row
  }

  const pingAdmins = (title: string, message: string) => {
    if (user) notify({ userId: user.id, title, message, channel: 'in-app' })
  }

  const rows = useMemo(() => {
    return list.filter((r) => {
      const blob = `${r.name} ${r.provider} ${r.description}`.toLowerCase()
      if (q && !blob.includes(q.toLowerCase())) return false
      if (cat !== 'all' && r.category !== cat) return false
      if (activeFilter === 'active' && !r.active) return false
      if (activeFilter === 'inactive' && r.active) return false
      if (connFilter === 'connected' && !r.connected) return false
      if (connFilter === 'disconnected' && r.connected) return false
      if (errOnly && r.health !== 'error') return false
      return true
    })
  }, [list, q, cat, activeFilter, connFilter, errOnly])

  const stats = useMemo(() => ({
    total: list.length,
    active: list.filter((r) => r.active).length,
    online: list.filter((r) => r.active && healthOf(r) === 'online').length,
    errors: list.filter((r) => r.health === 'error').length,
  }), [list])

  const current = list.find((r) => r.id === openId) || null

  const open = (r: IntegrationRecord) => {
    setOpenId(r.id)
    setTab('setup')
    setTestOut(null)
    setDraft({
      ...emptyConfig(),
      ...r.config,
      apiKey: '',
      secretKey: '',
      accessToken: '',
      password: '',
    })
  }

  const toggle = (r: IntegrationRecord, next: boolean) => {
    if (!canManage) { toast.error('Only managers can change integrations.'); return }
    if (r.active && !next && r.critical) {
      setDisableTarget(r)
      return
    }
    applyActive(r, next)
  }

  const applyActive = (r: IntegrationRecord, next: boolean) => {
    const now = new Date().toISOString()
    const updated: IntegrationRecord = {
      ...r,
      active: next,
      health: next ? (r.connected ? 'online' : 'pending') : 'offline',
      apiStatus: next ? r.apiStatus : 'Inactive',
      updatedAt: now,
    }
    persist(list.map((x) => (x.id === r.id ? updated : x)))
    addLog({
      integrationId: r.id, integrationName: r.name,
      adminId: user?.id || 'admin', adminName: user?.name || 'Admin',
      action: next ? 'Activated' : 'Deactivated',
      status: 'info',
      details: next ? 'Integration turned on. Saved configuration kept.' : 'Integration turned off. Configuration retained.',
    })
    pingAdmins(next ? 'Integration activated' : 'Integration disabled', r.name)
    toast.success(next ? `${r.name} is active` : `${r.name} is inactive`)
  }

  const saveConfig = () => {
    if (!current || !canManage) return
    const merged: IntegrationConfig = {
      ...current.config,
      ...draft,
      apiKey: draft.apiKey.trim() ? sealSecret(draft.apiKey) : current.config.apiKey,
      secretKey: draft.secretKey.trim() ? sealSecret(draft.secretKey) : current.config.secretKey,
      accessToken: draft.accessToken.trim() ? sealSecret(draft.accessToken) : current.config.accessToken,
      password: draft.password.trim() ? sealSecret(draft.password) : current.config.password,
      extra: { ...current.config.extra, ...draft.extra },
    }
    const updated: IntegrationRecord = { ...current, config: merged, updatedAt: new Date().toISOString() }
    persist(list.map((x) => (x.id === current.id ? updated : x)))
    addLog({
      integrationId: current.id, integrationName: current.name,
      adminId: user?.id || 'admin', adminName: user?.name || 'Admin',
      action: draft.apiKey || draft.secretKey || draft.accessToken ? 'Credential update' : 'Configuration updated',
      status: 'success',
      details: `${current.config.environment} → ${merged.environment} · sync ${merged.syncFrequency}`,
    })
    pingAdmins('Configuration updated', current.name)
    toast.success('Configuration saved', 'Secrets are stored encrypted on this device.')
    setDraft({ ...draft, apiKey: '', secretKey: '', accessToken: '', password: '' })
  }

  const runValidate = () => {
    if (!current) return
    const preview = previewRecord()
    const v = validateIntegration(preview)
    addLog({
      integrationId: current.id, integrationName: current.name,
      adminId: user?.id || 'admin', adminName: user?.name || 'Admin',
      action: 'Validate configuration',
      status: v.ok ? 'success' : 'failed',
      details: v.ok ? 'All required fields look valid.' : (v.error || 'Invalid'),
    })
    if (v.ok) toast.success('Configuration is valid')
    else toast.error('Configuration error', v.error)
  }

  const previewRecord = (): IntegrationRecord => {
    if (!current) return list[0]
    return {
      ...current,
      config: {
        ...current.config,
        ...draft,
        apiKey: draft.apiKey.trim() ? sealSecret(draft.apiKey) : current.config.apiKey,
        secretKey: draft.secretKey.trim() ? sealSecret(draft.secretKey) : current.config.secretKey,
        accessToken: draft.accessToken.trim() ? sealSecret(draft.accessToken) : current.config.accessToken,
        password: draft.password.trim() ? sealSecret(draft.password) : current.config.password,
      },
    }
  }

  const runTest = async (kind: 'test' | 'health') => {
    if (!current || !canManage) return
    setBusy(true)
    const preview = previewRecord()
    const result = preview.id === PAYSTACK_ID
      ? await testPaystackConnection(preview)
      : (await new Promise<ReturnType<typeof testIntegration>>((r) => setTimeout(() => r(testIntegration(preview)), 350)))
    const updated = applyTest(preview, result)
    persist(list.map((x) => (x.id === current.id ? updated : x)))
    setTestOut(result)
    addLog({
      integrationId: current.id, integrationName: current.name,
      adminId: user?.id || 'admin', adminName: user?.name || 'Admin',
      action: kind === 'health' ? 'Health check' : 'Test connection',
      status: result.ok ? 'success' : 'failed',
      details: `${result.code} · ${result.ms} ms · ${result.detail}`,
    })
    if (result.ok) {
      pingAdmins('Connection successful', `${current.name} · ${result.ms} ms`)
      toast.success(result.code, `${result.ms} ms`)
    } else {
      pingAdmins(kind === 'health' ? 'Sync failure' : 'Connection failed', `${current.name}: ${result.code}`)
      toast.error(result.code, result.detail)
    }
    setBusy(false)
  }

  const recLogs = logs.filter((l) => !current || l.integrationId === current.id)
  const filteredLogs = logs.filter((l) => {
    const blob = `${l.integrationName} ${l.action} ${l.details} ${l.adminName}`.toLowerCase()
    return !logQ || blob.includes(logQ.toLowerCase())
  })

  return (
    <div>
      {!embedded && (
        <PageHeader
          eyebrow="Settings"
          title="Integrations"
          desc="Configure, test, and audit every connected service. Secrets stay encrypted on this PC."
        />
      )}
      {embedded && (
        <div className="mb-4">
          <p className="font-semibold">Integration management</p>
          <p className="text-sm text-mist">Activate, configure, test, and audit providers without changing code.</p>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Providers" value={String(stats.total)} hint="in the catalogue" />
        <StatCard label="Active" value={String(stats.active)} hint="toggled on" />
        <StatCard label="Online" value={String(stats.online)} hint="last health check ok" />
        <StatCard label="Errors" value={String(stats.errors)} hint="need attention" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search integrations…" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-48">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
        <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-36">
          <option value="all">All activity</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Select value={connFilter} onChange={(e) => setConnFilter(e.target.value)} className="w-44">
          <option value="all">Any connection</option>
          <option value="connected">Connected</option>
          <option value="disconnected">Disconnected</option>
        </Select>
        <label className="flex items-center gap-2 rounded-xl border border-white/10 px-3 text-sm">
          <input type="checkbox" className="size-4 accent-[#c8f542]" checked={errOnly} onChange={(e) => setErrOnly(e.target.checked)} />
          Errors only
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => {
          const b = badgeFor(r)
          const h = healthOf(r)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => open(r)}
              className="card int-card p-4 text-left transition hover:border-lime/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-mist">{r.provider} · v{r.version}</p>
                </div>
                <span className={`int-health int-health-${h}`} title={h} />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-mist">{r.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge tone={b.tone}>{b.label}</Badge>
                <Badge tone="zinc">{categoryLabel(r.category)}</Badge>
                {r.critical && <Badge tone="orange">Critical</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                <p className="text-[11px] text-mist">
                  {r.lastSuccessAt ? `Last ok ${formatDateTime(r.lastSuccessAt)}` : 'Never connected'}
                </p>
                <label className="int-switch" title={r.active ? 'Active' : 'Inactive'}>
                  <input
                    type="checkbox"
                    checked={r.active}
                    disabled={!canManage}
                    onChange={(e) => toggle(r, e.target.checked)}
                  />
                  <span />
                </label>
              </div>
            </button>
          )
        })}
      </div>
      {!rows.length && <p className="mt-6 text-sm text-mist">No integrations match those filters.</p>}

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-semibold">Integration activity log</p>
            <p className="text-sm text-mist">Activation, config, tests, syncs, and credential changes.</p>
          </div>
          <SearchInput value={logQ} onChange={setLogQ} placeholder="Filter log…" />
        </div>
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr><th>When</th><th>Admin</th><th>Integration</th><th>Action</th><th>Result</th><th>Details</th></tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, 40).map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap text-mist">{formatDateTime(l.createdAt)}</td>
                  <td>{l.adminName}</td>
                  <td>{l.integrationName}</td>
                  <td>{l.action}</td>
                  <td><StatusBadge status={l.status === 'success' ? 'paid' : l.status === 'failed' ? 'failed' : 'pending'} /></td>
                  <td className="max-w-[280px] truncate text-mist">{l.details}</td>
                </tr>
              ))}
              {!filteredLogs.length && <tr><td colSpan={6} className="text-mist">No log rows yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!current} onClose={() => setOpenId(null)} title={current?.name || 'Integration'} wide>
        {current && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone={badgeFor(current).tone}>{badgeFor(current).label}</Badge>
              <StatusBadge status={healthOf(current)} />
              <Badge>{categoryLabel(current.category)}</Badge>
              {current.critical && <Badge tone="orange">Critical</Badge>}
              <span className="ml-auto text-xs text-mist">v{current.version}</span>
            </div>
            <p className="text-sm text-mist">{current.description}</p>
            <p className="mt-1 text-xs text-mist">Provider {current.provider}</p>

            <div className="mt-4 flex flex-wrap gap-1">
              {(['setup', 'health', 'logs'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === id ? 'bg-lime text-lime-ink' : 'bg-white/5 text-mist'}`}
                  onClick={() => setTab(id)}
                >
                  {id === 'setup' ? 'Configuration' : id === 'health' ? 'Health' : 'Logs'}
                </button>
              ))}
            </div>

            {tab === 'setup' && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SecretField label="API key" stored={current.config.apiKey} value={draft.apiKey} onChange={(v) => setDraft({ ...draft, apiKey: v })} />
                  <SecretField label="Secret key" stored={current.config.secretKey} value={draft.secretKey} onChange={(v) => setDraft({ ...draft, secretKey: v })} />
                  <SecretField label="Access token" stored={current.config.accessToken} value={draft.accessToken} onChange={(v) => setDraft({ ...draft, accessToken: v })} />
                  <SecretField label="Auth password" stored={current.config.password} value={draft.password} onChange={(v) => setDraft({ ...draft, password: v })} />
                  <Field label="Auth username"><Input value={draft.username} onChange={(e) => setDraft({ ...draft, username: e.target.value })} /></Field>
                  <Field label="Environment">
                    <Select value={draft.environment} onChange={(e) => setDraft({ ...draft, environment: e.target.value as IntegrationConfig['environment'] })}>
                      <option value="sandbox">Sandbox</option>
                      <option value="production">Production</option>
                    </Select>
                  </Field>
                  <Field label="Webhook URL"><Input value={draft.webhookUrl} onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value })} placeholder="https://…" /></Field>
                  <Field label="Callback URL"><Input value={draft.callbackUrl} onChange={(e) => setDraft({ ...draft, callbackUrl: e.target.value })} placeholder="https://…" /></Field>
                  <Field label="Sync frequency">
                    <Select value={draft.syncFrequency} onChange={(e) => setDraft({ ...draft, syncFrequency: e.target.value })}>
                      <option value="5m">Every 5 minutes</option>
                      <option value="15m">Every 15 minutes</option>
                      <option value="1h">Hourly</option>
                      <option value="1d">Daily</option>
                      <option value="manual">Manual only</option>
                    </Select>
                  </Field>
                  <Field label="Retry attempts"><Input type="number" min={0} max={10} value={draft.retryAttempts} onChange={(e) => setDraft({ ...draft, retryAttempts: Number(e.target.value) || 0 })} /></Field>
                  <Field label="Timeout (ms)"><Input type="number" min={1000} step={500} value={draft.timeoutMs} onChange={(e) => setDraft({ ...draft, timeoutMs: Number(e.target.value) || 8000 })} /></Field>
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input type="checkbox" className="size-4 accent-[#c8f542]" checked={draft.notifyOnFail} onChange={(e) => setDraft({ ...draft, notifyOnFail: e.target.checked })} />
                    Notify on failure
                  </label>
                </div>
                {current.id === PAYSTACK_ID && (
                  <PaystackExtras draft={draft} setDraft={setDraft} />
                )}
                <p className="text-xs text-mist">Leave a secret blank to keep the saved encrypted value. New values are encrypted before they are stored.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={saveConfig} disabled={!canManage}>Save configuration</Button>
                  <Button variant="outline" onClick={runValidate} disabled={!canManage}>Validate configuration</Button>
                  <Button variant="soft" onClick={() => runTest('test')} disabled={!canManage || busy}>
                    {busy ? 'Testing…' : 'Test connection'}
                  </Button>
                </div>
                {testOut && (
                  <div className={`rounded-xl border p-3 text-sm ${testOut.ok ? 'border-lime/40 bg-lime/10' : 'border-ember/40 bg-ember/10'}`}>
                    <p className="font-semibold">{testOut.code}</p>
                    <p className="mt-1 text-mist">{testOut.detail} · {testOut.ms} ms</p>
                  </div>
                )}
              </div>
            )}

            {tab === 'health' && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <HealthRow k="Active" v={current.active ? 'Yes' : 'No'} />
                  <HealthRow k="Connection" v={current.connected ? 'Connected' : 'Disconnected'} />
                  <HealthRow k="Health" v={healthOf(current)} />
                  <HealthRow k="API status" v={current.apiStatus} />
                  <HealthRow k="Last sync" v={current.lastSyncAt ? formatDateTime(current.lastSyncAt) : '—'} />
                  <HealthRow k="Last success" v={current.lastSuccessAt ? formatDateTime(current.lastSuccessAt) : '—'} />
                  <HealthRow k="Last failure" v={current.lastFailedAt ? formatDateTime(current.lastFailedAt) : '—'} />
                  <HealthRow k="Last health check" v={current.lastHealthCheckAt ? formatDateTime(current.lastHealthCheckAt) : '—'} />
                  <HealthRow k="Last test" v={current.lastTestResult ? `${current.lastTestResult} · ${current.lastTestMs ?? '—'} ms` : '—'} />
                  <HealthRow k="Created" v={formatDateTime(current.createdAt)} />
                  <HealthRow k="Updated" v={formatDateTime(current.updatedAt)} />
                  <HealthRow k="Environment" v={current.config.environment} />
                  {current.id === PAYSTACK_ID && (
                    <>
                      <HealthRow k="Currency" v={current.config.extra.currency || 'GHS'} />
                      <HealthRow k="Channels" v={current.config.extra.channels || 'card,mobile_money'} />
                      <HealthRow k="Auto-settle" v={current.config.extra.autoSettle === 'false' ? 'No' : 'Yes'} />
                      <HealthRow k="Checkout" v={current.config.extra.checkoutMode || 'popup'} />
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => runTest('health')} disabled={!canManage || busy}>
                  <RefreshCw className="size-4" /> Run health check
                </Button>
              </div>
            )}

            {tab === 'logs' && (
              <div className="mt-4 table-wrap">
                <table className="data">
                  <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Result</th><th>Details</th></tr></thead>
                  <tbody>
                    {recLogs.slice(0, 20).map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-mist">{formatDateTime(l.createdAt)}</td>
                        <td>{l.adminName}</td>
                        <td>{l.action}</td>
                        <td><StatusBadge status={l.status === 'success' ? 'paid' : l.status === 'failed' ? 'failed' : 'pending'} /></td>
                        <td className="text-mist">{l.details}</td>
                      </tr>
                    ))}
                    {!recLogs.length && <tr><td colSpan={5} className="text-mist">No events for this provider yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!disableTarget} onClose={() => setDisableTarget(null)} title="Disable critical integration">
        {disableTarget && (
          <>
            <p className="text-sm text-mist">
              <ShieldAlert className="mb-2 size-5 text-ember" />
              {disableTarget.name} is marked critical ({disableTarget.provider}). Turning it off may stop payments, mail, or SMS. Saved keys are not deleted.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => { applyActive(disableTarget, false); setDisableTarget(null) }}>Disable anyway</Button>
              <Button variant="outline" onClick={() => setDisableTarget(null)}>Keep active</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function SecretField({
  label, stored, value, onChange,
}: {
  label: string
  stored: string
  value: string
  onChange: (v: string) => void
}) {
  const masked = maskSecret(stored)
  return (
    <Field label={label}>
      <Input
        type="password"
        autoComplete="new-password"
        value={value}
        placeholder={masked ? `Saved ${masked}` : 'Not set'}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}

function HealthRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-white/10 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-mist">{k}</p>
      <p className="text-sm font-semibold capitalize">{v}</p>
    </div>
  )
}

function PaystackExtras({
  draft,
  setDraft,
}: {
  draft: IntegrationConfig
  setDraft: (c: IntegrationConfig) => void
}) {
  const extra = draft.extra || {}
  const setExtra = (key: string, value: string) => {
    setDraft({ ...draft, extra: { ...extra, [key]: value } })
  }
  const selected = new Set((extra.channels || 'card,mobile_money').split(',').map((c) => c.trim()).filter(Boolean))
  const toggleChannel = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setExtra('channels', Array.from(next).join(','))
  }
  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3">
      <p className="text-sm font-semibold">Paystack checkout</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Currency">
          <Select value={extra.currency || 'GHS'} onChange={(e) => setExtra('currency', e.target.value)}>
            <option value="GHS">GHS — Ghana cedi</option>
            <option value="NGN">NGN — Naira</option>
            <option value="USD">USD</option>
            <option value="ZAR">ZAR</option>
          </Select>
        </Field>
        <Field label="Checkout style">
          <Select value={extra.checkoutMode || 'popup'} onChange={(e) => setExtra('checkoutMode', e.target.value)}>
            <option value="popup">In-app popup</option>
            <option value="redirect">Redirect to Paystack</option>
          </Select>
        </Field>
        <Field label="Split code (optional)">
          <Input value={extra.splitCode || ''} onChange={(e) => setExtra('splitCode', e.target.value)} placeholder="SPL_…" />
        </Field>
        <Field label="Subaccount (optional)">
          <Input value={extra.subaccount || ''} onChange={(e) => setExtra('subaccount', e.target.value)} placeholder="ACCT_…" />
        </Field>
        <Field label="Charge bearer">
          <Select value={extra.chargeBearer || 'account'} onChange={(e) => setExtra('chargeBearer', e.target.value)}>
            <option value="account">Club absorbs fees</option>
            <option value="subaccount">Subaccount absorbs fees</option>
          </Select>
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Accepted channels</p>
        <div className="flex flex-wrap gap-3">
          {PAYSTACK_CHANNELS.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[#c8f542]"
                checked={selected.has(c.id)}
                onChange={() => toggleChannel(c.id)}
              />
              {c.label}
            </label>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[#c8f542]"
          checked={extra.autoSettle !== 'false'}
          onChange={(e) => setExtra('autoSettle', e.target.checked ? 'true' : 'false')}
        />
        Auto-mark invoice paid after a verified Paystack success
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[#c8f542]"
          checked={extra.allowDemo !== 'false'}
          onChange={(e) => setExtra('allowDemo', e.target.checked ? 'true' : 'false')}
        />
        Allow demo checkout when keys are empty (no real money)
      </label>
    </div>
  )
}

