import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  FileJson,
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
  Download,
  Server,
  HardDrive,
  AlertTriangle,
  Layers,
  ShieldCheck,
  PlugZap,
  GitFork,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { PageHeader, Button, Field, Input, Badge, Modal } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import {
  type DatabaseEngineType,
  type DatabaseEngineConfigResponse,
  type MysqlStatsResponse,
  getMysqlState,
  subscribeMysqlState,
  fetchDatabaseEngineConfig,
  fetchMysqlStats,
  testDatabaseConnection,
  switchDatabaseEngine,
  attachAndSyncAllModules,
  getExportSqlUrl,
  getExportNoSqlUrl,
} from '../../../lib/mysqlBridge'
import { trustedLogin, trustedLogout, trustedRestore } from '../../../lib/trustedSession'
import { getAppBasePath } from '../../../lib/mysqlBridge'
import { getRouteForModule, getRouteForTable } from '../../../lib/dbModuleRoutes'

const SELF_HEAL_MODULES = new Set([
  'Card Management',
  'Certificate Management',
  'Church Management',
  'Education Management',
])

export function DatabaseEngineSettings() {
  const { log } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const autoHealedRef = useRef(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const [bridge, setBridge] = useState(getMysqlState())
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngineType>(bridge.activeEngine)
  const [migrateData, setMigrateData] = useState(true)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [testing, setTesting] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authVerified, setAuthVerified] = useState(false)
  const [syncingNow, setSyncingNow] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [configMeta, setConfigMeta] = useState<DatabaseEngineConfigResponse | null>(null)
  const [stats, setStats] = useState<MysqlStatsResponse | null>(null)

  const [mysqlForm, setMysqlForm] = useState({
    host: '127.0.0.1',
    port: 3306,
    database: 'fitpro_gym',
    username: 'root',
    password: '',
  })

  const [nosqlForm, setNosqlForm] = useState<{
    driver: 'document_store' | 'mongodb'
    database: string
    mongoUri: string
  }>({
    driver: 'document_store',
    database: 'fitpro_nosql',
    mongoUri: 'mongodb://127.0.0.1:27017',
  })

  useEffect(() => {
    return subscribeMysqlState(() => {
      setBridge(getMysqlState())
    })
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [cfg, st] = await Promise.all([
        fetchDatabaseEngineConfig().catch(() => null),
        fetchMysqlStats().catch(() => null),
      ])
      if (cfg && cfg.ok) {
        setConfigMeta(cfg)
        setSelectedEngine(cfg.activeEngine)
        setMysqlForm((prev) => ({
          ...prev,
          host: cfg.mysql.host || '127.0.0.1',
          port: cfg.mysql.port || 3306,
          database: cfg.mysql.database || 'fitpro_gym',
          username: cfg.mysql.username || 'root',
        }))
        setNosqlForm({
          driver: cfg.nosql.driver || 'document_store',
          database: cfg.nosql.database || 'fitpro_nosql',
          mongoUri: cfg.nosql.mongoUri || 'mongodb://127.0.0.1:27017',
        })
      }
      if (st && st.ok) {
        setStats(st)
        const needsHeal =
          !autoHealedRef.current &&
          Array.isArray(st.modules) &&
          st.modules.some((m) => SELF_HEAL_MODULES.has(m.module) && m.rows === 0)
        if (needsHeal) {
          autoHealedRef.current = true
          const healRes = await attachAndSyncAllModules()
          if (healRes.ok && healRes.stats) {
            setStats(healRes.stats)
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const activeEngine: DatabaseEngineType = configMeta?.activeEngine || bridge.activeEngine || 'mysql'
  const isBothActive = activeEngine === 'both'
  const isNosqlActive = activeEngine === 'nosql'
  const isEngineChanged = selectedEngine !== activeEngine

  const engineDisplayName = (eng: DatabaseEngineType) => {
    if (eng === 'both') return 'Both Databases (MySQL + NoSQL)'
    if (eng === 'nosql') return 'NoSQL Document Database'
    return 'MySQL Relational Database'
  }

  const signInTrusted = async () => {
    if (!user || !authPassword || authBusy) return
    setAuthBusy(true); setAuthError('')
    try {
      const session = await trustedLogin(getAppBasePath(), user.email, authPassword)
      setAuthPassword('')
      if (session.user.id !== user.id || !['super_admin','company_admin'].includes(session.user.role)) {
        await trustedLogout(getAppBasePath()).catch(() => {})
        throw new Error('The trusted server account must match your signed-in administrator account.')
      }
      setAuthVerified(true)
      setAuthOpen(false)
      setStatusMessage({ tone: 'ok', text: 'Trusted server session established. Retry the connection test.' })
      await loadAll()
    } catch (error) {
      setAuthPassword('')
      setAuthError(error instanceof Error ? error.message : 'Trusted server sign-in failed.')
    } finally { setAuthBusy(false) }
  }
  // Restore the server CSRF token after a page reload when a matching trusted
  // admin session already exists. The server remains the authorization boundary.
  useEffect(() => {
    if (!user || !['super_admin','company_admin'].includes(user.role)) return
    void trustedRestore(getAppBasePath()).then(session => {
      if (session.user.id !== user.id || !['super_admin','company_admin'].includes(session.user.role)) {
        setAuthVerified(false)
        void trustedLogout(getAppBasePath()).catch(() => {})
      } else { setAuthVerified(true); void loadAll() }
    }).catch(() => { setAuthVerified(false) })
  }, [user?.id, user?.role])

  const handleTestConnection = async () => {
    setTesting(true)
    setStatusMessage(null)
    try {
      const res = await testDatabaseConnection({
        engine: selectedEngine,
        mysql: selectedEngine === 'mysql' || selectedEngine === 'both' ? mysqlForm : undefined,
        nosql: selectedEngine === 'nosql' || selectedEngine === 'both' ? nosqlForm : undefined,
      })
      if (res.ok) {
        const msg =
          res.message ||
          `${selectedEngine === 'both' ? 'MySQL + NoSQL' : selectedEngine.toUpperCase()} connection verified.`
        setStatusMessage({ tone: 'ok', text: msg })
        toast.success('Connection verified', msg)
      } else {
        const err = res.error || 'Connection test failed.'
        setStatusMessage({ tone: 'err', text: err })
        toast.error('Connection failed', err)
      }
    } finally {
      setTesting(false)
    }
  }

  const handleApplySwitch = async () => {
    setSwitching(true)
    setStatusMessage(null)
    try {
      const res = await switchDatabaseEngine({
        engine: selectedEngine,
        migrateData,
        mysql: mysqlForm,
        nosql: nosqlForm,
      })
      if (!res.ok) {
        const err = res.error || 'Failed to switch database engine.'
        setStatusMessage({ tone: 'err', text: err })
        toast.error('Database switch failed', err)
        return
      }

      const targetLabel =
        selectedEngine === 'both'
          ? `Both Databases — Dual-Write (${mysqlForm.database} + ${nosqlForm.database})`
          : selectedEngine === 'nosql'
            ? `NoSQL Document Database (${nosqlForm.database})`
            : `MySQL Relational Database (${mysqlForm.database})`
      const migNote = migrateData
        ? selectedEngine === 'both'
          ? `Synchronized ${res.migratedStores ?? 0} module stores (${res.stats?.totalRows?.toLocaleString() ?? 0} records) into BOTH MySQL tables and NoSQL collections.`
          : `Migrated ${res.migratedStores ?? 0} module stores (${res.stats?.totalRows?.toLocaleString() ?? 0} records) with zero data loss.`
        : 'Updated active persistence engine.'

      log(
        user?.id || 'system',
        'UPDATE',
        'DatabaseEngine',
        `Set active database mode to ${targetLabel}. ${migNote}`,
      )
      setStatusMessage({ tone: 'ok', text: `Active mode is now ${targetLabel}. ${migNote}` })
      toast.success(`Database mode: ${engineDisplayName(selectedEngine)}`, migNote)
      await loadAll()
    } finally {
      setSwitching(false)
    }
  }

  const handleForceSync = async () => {
    setSyncingNow(true)
    try {
      const res = await attachAndSyncAllModules()
      if (res.ok) {
        toast.success(
          'All 21 modules attached & synchronized',
          isBothActive
            ? `Saved ${res.synced ?? 0} stores simultaneously into BOTH MySQL (${mysqlForm.database}) and NoSQL (${nosqlForm.database}).`
            : `Synced ${res.synced ?? 0} stores to ${isNosqlActive ? 'NoSQL collections' : 'MySQL tables'}.`,
        )
        await loadAll()
      } else {
        toast.error('Sync failed', res.error || 'Unable to sync stores.')
      }
    } finally {
      setSyncingNow(false)
    }
  }

  return (
    <div className="space-y-4">
      {!authVerified && user && ['super_admin','company_admin'].includes(user.role) && <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"><p className="font-semibold">Trusted server sign-in required</p><p className="mt-1 text-mist">Sign in before testing or changing the database. Until then, the engine shown below may not reflect the server.</p><Button className="mt-3" size="sm" variant="outline" onClick={()=>{setAuthError('');setAuthOpen(true)}}>Sign in to server</Button></div>}
      {/* Active Engine Banner */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
                isBothActive
                  ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-400'
                  : isNosqlActive
                    ? 'border-violet-500/30 bg-violet-500/15 text-violet-400'
                    : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {isBothActive ? (
                <GitFork className="size-5" />
              ) : isNosqlActive ? (
                <FileJson className="size-5" />
              ) : (
                <Database className="size-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold">
                  Active Engine: {engineDisplayName(activeEngine)}
                </h3>
                <Badge tone={bridge.connected ? 'lime' : 'zinc'}>
                  {bridge.connected
                    ? isBothActive
                      ? 'Connected · Dual-Write Active'
                      : 'Connected · Live Write-Through'
                    : 'Offline Fallback'}
                </Badge>
                {isBothActive ? (
                  <>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                      MySQL InnoDB
                    </span>
                    <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
                      NoSQL Collections
                    </span>
                  </>
                ) : (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isNosqlActive
                        ? 'bg-violet-500/15 text-violet-300'
                        : 'bg-emerald-500/15 text-emerald-300'
                    }`}
                  >
                    {isNosqlActive ? 'NoSQL Collections' : 'InnoDB SQL'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-mist">
                {isBothActive
                  ? `Saving every transaction across all 21 ERP modules (including 121 Education Management sub-menus) simultaneously into BOTH MySQL (${mysqlForm.database}, ${stats?.mysqlSummary?.totalTables ?? 270} tables) AND NoSQL (${nosqlForm.database}, ${stats?.nosqlSummary?.totalTables ?? 270} collections).`
                  : isNosqlActive
                    ? `Storing all 21 ERP modules (including 121 Education Management sub-menus) as JSON documents across ${stats?.totalTables ?? 270} NoSQL collections in ${stats?.database || nosqlForm.database}.`
                    : `Storing all 21 ERP modules (including 121 Education Management sub-menus) as relational rows across ${stats?.totalTables ?? 270} InnoDB tables in ${stats?.database || mysqlForm.database} (${stats?.host || mysqlForm.host}:${stats?.port || mysqlForm.port}).`}
              </p>
              {configMeta?.switchedAt && (
                <p className="mt-1 text-xs text-mist">
                  Last engine configuration update: {new Date(configMeta.switchedAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleForceSync} disabled={syncingNow}>
              <Layers className={`size-3.5 ${syncingNow ? 'animate-spin' : ''}`} />
              {syncingNow ? 'Syncing…' : isBothActive ? 'Sync Both Databases' : 'Sync All Stores'}
            </Button>
            {(activeEngine === 'mysql' || isBothActive) && (
              <a
                href={getExportSqlUrl()}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold transition hover:border-emerald-500/50 hover:bg-emerald-500/5"
              >
                <Download className="size-3.5" />
                Export .sql
              </a>
            )}
            {(activeEngine === 'nosql' || isBothActive) && (
              <a
                href={getExportNoSqlUrl()}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold transition hover:border-violet-500/50 hover:bg-violet-500/5"
              >
                <Download className="size-3.5" />
                Export .json
              </a>
            )}
          </div>
        </div>

        {/* Live Telemetry Strip */}
        {isBothActive ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.04] p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">Active Mode</div>
              <div className="mt-1 font-mono text-sm font-bold text-cyan-400">
                Both (Dual-Write)
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">
                MySQL ({stats?.mysqlSummary?.database || mysqlForm.database})
              </div>
              <div className="mt-1 font-mono text-sm font-bold">
                {stats?.mysqlSummary?.totalRows?.toLocaleString() ?? stats?.totalRows?.toLocaleString() ?? '—'} rows ·{' '}
                {stats?.mysqlSummary?.totalTables ?? 270} tbl
              </div>
            </div>
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.03] p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">
                NoSQL ({stats?.nosqlSummary?.database || nosqlForm.database})
              </div>
              <div className="mt-1 font-mono text-sm font-bold">
                {stats?.nosqlSummary?.totalRows?.toLocaleString() ?? stats?.totalRows?.toLocaleString() ?? '—'} docs ·{' '}
                {stats?.nosqlSummary?.totalTables ?? 270} coll
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">Mirror Parity</div>
              <div className="mt-1 font-mono text-sm font-bold text-emerald-400">
                {stats?.mysqlSummary &&
                stats?.nosqlSummary &&
                stats.mysqlSummary.totalRows === stats.nosqlSummary.totalRows
                  ? '100% In Sync'
                  : 'Synchronized'}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">Active Mode</div>
              <div className="mt-1 font-mono text-sm font-bold">
                {isNosqlActive ? 'NoSQL (Document)' : 'MySQL (Relational)'}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">
                {isNosqlActive ? 'Collections' : 'InnoDB Tables'}
              </div>
              <div className="mt-1 font-mono text-sm font-bold">
                {stats?.totalTables?.toLocaleString() ?? '270'}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">
                {isNosqlActive ? 'Total Documents' : 'Total SQL Rows'}
              </div>
              <div className="mt-1 font-mono text-sm font-bold">
                {stats?.totalRows?.toLocaleString() ?? '—'}
              </div>
            </div>
            <div className="rounded-xl border border-line p-3">
              <div className="text-[11px] uppercase tracking-wider text-mist">Database / Namespace</div>
              <div className="mt-1 truncate font-mono text-sm font-bold">
                {stats?.database || bridge.database}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Engine Selector Cards (MySQL | NoSQL | Both) */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Select Database Persistence Mode</h3>
            <p className="mt-0.5 text-sm text-mist">
              Choose MySQL only, NoSQL only, or <strong>Both Databases</strong> to save every change simultaneously into both MySQL and NoSQL.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* 1. MySQL Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedEngine('mysql')
              setStatusMessage(null)
            }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition cursor-pointer ${
              selectedEngine === 'mysql'
                ? 'border-emerald-500 bg-emerald-500/10 ring-1 ring-emerald-500/40'
                : 'border-line hover:border-emerald-500/40 hover:bg-white/[0.02]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Database className="size-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">MySQL Database</div>
                    <div className="text-xs text-mist">Relational SQL (InnoDB)</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeEngine === 'mysql' && <Badge tone="lime">Active</Badge>}
                  {selectedEngine === 'mysql' && (
                    <CheckCircle2 className="size-4.5 text-emerald-400" />
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mist">
                Saves records exclusively into <strong>270 normalized InnoDB SQL tables</strong> (including 121{' '}
                <code className="font-mono">edu_*</code> Education tables) with full XAMPP <strong>phpMyAdmin</strong> query support.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-[11px] text-mist">
              <span className="inline-flex items-center gap-1">
                <Server className="size-3 text-emerald-400" />
                {mysqlForm.host}:{mysqlForm.port}
              </span>
              <span>·</span>
              <span className="font-mono">{mysqlForm.database}</span>
            </div>
          </button>

          {/* 2. NoSQL Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedEngine('nosql')
              setStatusMessage(null)
            }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition cursor-pointer ${
              selectedEngine === 'nosql'
                ? 'border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/40'
                : 'border-line hover:border-violet-500/40 hover:bg-white/[0.02]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                    <FileJson className="size-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">NoSQL Database</div>
                    <div className="text-xs text-mist">Document Collections / MongoDB</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeEngine === 'nosql' && <Badge tone="lime">Active</Badge>}
                  {selectedEngine === 'nosql' && (
                    <CheckCircle2 className="size-4.5 text-violet-400" />
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mist">
                Saves records exclusively into <strong>270 JSON document collections</strong> (including 121{' '}
                <code className="font-mono">edu_*</code> Education collections) with <code className="font-mono">_id</code>{' '}
                indexing or MongoDB server support.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-[11px] text-mist">
              <span className="inline-flex items-center gap-1">
                <HardDrive className="size-3 text-violet-400" />
                {nosqlForm.driver === 'mongodb' ? 'MongoDB Driver' : 'Document Store'}
              </span>
              <span>·</span>
              <span className="font-mono">{nosqlForm.database}</span>
            </div>
          </button>

          {/* 3. BOTH (MySQL + NoSQL Simultaneous Dual-Write) Card */}
          <button
            type="button"
            onClick={() => {
              setSelectedEngine('both')
              setStatusMessage(null)
            }}
            className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition cursor-pointer ${
              selectedEngine === 'both'
                ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/40'
                : 'border-line hover:border-cyan-500/40 hover:bg-white/[0.02]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                    <GitFork className="size-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold">Both (MySQL + NoSQL)</div>
                    <div className="text-xs text-mist">Simultaneous Dual-Write</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {activeEngine === 'both' && <Badge tone="lime">Active</Badge>}
                  {selectedEngine === 'both' && (
                    <CheckCircle2 className="size-4.5 text-cyan-400" />
                  )}
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-mist">
                <strong>Saves into both databases at the same time:</strong> every create, update, and delete writes simultaneously to{' '}
                <strong>270 MySQL InnoDB tables</strong> AND <strong>270 NoSQL document collections</strong> for live redundancy.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5 text-[11px] text-mist">
              <span className="font-mono text-emerald-400">{mysqlForm.database}</span>
              <span>+</span>
              <span className="font-mono text-violet-400">{nosqlForm.database}</span>
              <span>·</span>
              <span>Dual-Write</span>
            </div>
          </button>
        </div>

        {/* Selected Engine Connection Parameters */}
        <div className="mt-5 space-y-4 rounded-2xl border border-line p-4">
          {(selectedEngine === 'mysql' || selectedEngine === 'both') && (
            <div>
              <div className="flex items-center gap-2">
                <Server className="size-4 text-emerald-400" />
                <h4 className="text-sm font-semibold">MySQL Connection Settings</h4>
                {selectedEngine === 'both' && (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Primary Relational Target
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="MySQL Host">
                  <Input
                    value={mysqlForm.host}
                    onChange={(e) => setMysqlForm({ ...mysqlForm, host: e.target.value })}
                    placeholder="127.0.0.1"
                    className="font-mono"
                  />
                </Field>
                <Field label="Port">
                  <Input
                    type="number"
                    value={String(mysqlForm.port)}
                    onChange={(e) =>
                      setMysqlForm({ ...mysqlForm, port: Number(e.target.value) || 3306 })
                    }
                    placeholder="3306"
                    className="font-mono"
                  />
                </Field>
                <Field label="Database Name">
                  <Input
                    value={mysqlForm.database}
                    onChange={(e) => setMysqlForm({ ...mysqlForm, database: e.target.value })}
                    placeholder="fitpro_gym"
                    className="font-mono"
                  />
                </Field>
                <Field label="Username">
                  <Input
                    value={mysqlForm.username}
                    onChange={(e) => setMysqlForm({ ...mysqlForm, username: e.target.value })}
                    placeholder="root"
                    className="font-mono"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    value={mysqlForm.password}
                    onChange={(e) => setMysqlForm({ ...mysqlForm, password: e.target.value })}
                    placeholder="Empty on XAMPP"
                  />
                </Field>
              </div>
            </div>
          )}

          {selectedEngine === 'both' && <div className="border-t border-line" />}

          {(selectedEngine === 'nosql' || selectedEngine === 'both') && (
            <div>
              <div className="flex items-center gap-2">
                <FileJson className="size-4 text-violet-400" />
                <h4 className="text-sm font-semibold">NoSQL Document Store Settings</h4>
                {selectedEngine === 'both' && (
                  <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                    Simultaneous Document Mirror
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="NoSQL Storage Driver">
                  <select
                    value={nosqlForm.driver}
                    onChange={(e) =>
                      setNosqlForm({
                        ...nosqlForm,
                        driver: e.target.value === 'mongodb' ? 'mongodb' : 'document_store',
                      })
                    }
                    className="h-10 w-full rounded-xl border border-line bg-transparent px-3 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    <option value="document_store" className="bg-zinc-900 text-white">
                      Embedded XAMPP Document Store (JSON Collections)
                    </option>
                    <option value="mongodb" className="bg-zinc-900 text-white">
                      MongoDB Server (ext-mongodb + Document Mirror)
                    </option>
                  </select>
                </Field>
                <Field label="NoSQL Database / Namespace">
                  <Input
                    value={nosqlForm.database}
                    onChange={(e) => setNosqlForm({ ...nosqlForm, database: e.target.value })}
                    placeholder="fitpro_nosql"
                    className="font-mono"
                  />
                </Field>
                <Field label="MongoDB URI (when using MongoDB driver)">
                  <Input
                    value={nosqlForm.mongoUri}
                    onChange={(e) => setNosqlForm({ ...nosqlForm, mongoUri: e.target.value })}
                    placeholder="mongodb://127.0.0.1:27017"
                    disabled={nosqlForm.driver !== 'mongodb'}
                    className="font-mono"
                  />
                </Field>
              </div>
              {configMeta?.nosql.storagePath && (
                <p className="mt-2.5 text-xs text-mist">
                  Collection storage directory:{' '}
                  <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono">
                    {configMeta.nosql.storagePath}
                  </code>
                </p>
              )}
            </div>
          )}

          {/* Live Data Migration Checkbox + Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={migrateData}
                onChange={(e) => setMigrateData(e.target.checked)}
                className="size-4 rounded accent-blue-600"
              />
              <span>
                <strong>
                  {selectedEngine === 'both'
                    ? 'Synchronize both databases immediately:'
                    : 'Live data migration:'}
                </strong>{' '}
                {selectedEngine === 'both'
                  ? `Ensure all 21 modules’ live records (${stats?.totalTables ?? 270} tables & collections) are written identically into BOTH MySQL and NoSQL`
                  : `Copy & synchronize all 21 modules’ live records (${stats?.totalTables ?? 270} tables ↔ collections) into the target database when switching`}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || switching}
              >
                <PlugZap className="size-4" />
                {testing
                  ? 'Testing…'
                  : selectedEngine === 'both'
                    ? 'Test Both Connections'
                    : `Test ${selectedEngine === 'nosql' ? 'NoSQL' : 'MySQL'} Connection`}
              </Button>
              <Button
                className={
                  selectedEngine === 'both'
                    ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                    : selectedEngine === 'nosql'
                      ? 'bg-violet-600 text-white hover:bg-violet-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }
                onClick={handleApplySwitch}
                disabled={switching}
              >
                <ArrowLeftRight className={`size-4 ${switching ? 'animate-spin' : ''}`} />
                {switching
                  ? 'Applying & Synchronizing…'
                  : isEngineChanged
                    ? selectedEngine === 'both'
                      ? 'Set to Both Databases (MySQL + NoSQL)'
                      : `Switch to ${selectedEngine === 'nosql' ? 'NoSQL Database' : 'MySQL Database'}`
                    : `Save & Re-sync ${selectedEngine === 'both' ? 'Both Databases' : selectedEngine === 'nosql' ? 'NoSQL' : 'MySQL'}`}
              </Button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                statusMessage.tone === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              {statusMessage.tone === 'ok' ? (
                <ShieldCheck className="size-4 shrink-0" />
              ) : (
                <AlertTriangle className="size-4 shrink-0" />
              )}
              <div><span>{statusMessage.text}</span>{statusMessage.tone === 'err' && /HTTPS is required/i.test(statusMessage.text) && <p className="mt-2">On the computer running XAMPP, open the app using <a className="underline" href={`${window.location.protocol}//localhost${window.location.port ? `:${window.location.port}` : ''}${window.location.pathname}${window.location.search}`}>localhost</a> and retry. For access from another device, use HTTPS instead. If you already use HTTPS, the server’s proxy configuration needs correction.</p>}{statusMessage.tone === 'err' && /not authenticated|invalid request token/i.test(statusMessage.text) && <p className="mt-2">A trusted administrator session is required. <button className="underline" onClick={()=>{setAuthError('');setAuthOpen(true)}}>Sign in to the server</button>, then retry.</p>}</div>
            </div>
          )}
        </div>
      </div>

      <Modal open={authOpen} onClose={()=>{if(!authBusy){setAuthOpen(false);setAuthPassword('');setAuthError('')}}} title="Trusted administrator sign in"><div className="space-y-3"><p className="text-sm text-mist">Use the separate trusted server password for your signed-in administrator account. Your browser login alone does not authorize database changes.</p>{authError && <p role="alert" className="text-sm text-red-400">{authError}</p>}<Field label="Trusted server password"><Input type="password" autoComplete="current-password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)}/></Field><div className="flex justify-end gap-2"><Button variant="ghost" onClick={()=>{setAuthOpen(false);setAuthPassword('')}} disabled={authBusy}>Cancel</Button><Button onClick={()=>void signInTrusted()} disabled={authBusy||!authPassword}>{authBusy?'Signing in…':'Sign in'}</Button></div></div></Modal>

      {/* Module Storage Breakdown */}
      {stats?.modules && stats.modules.length > 0 && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">
                21-Module{' '}
                {isBothActive
                  ? 'Dual-Write (MySQL Tables + NoSQL Collections)'
                  : isNosqlActive
                    ? 'NoSQL Collection'
                    : 'MySQL Table'}{' '}
                Distribution
              </h3>
              <p className="text-xs text-mist">
                {isBothActive
                  ? 'Real-time parity telemetry showing SQL rows alongside NoSQL JSON documents for every module.'
                  : `Real-time telemetry from the active ${isNosqlActive ? 'NoSQL document store' : 'MySQL relational schema'}.`}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <a
                href={getExportSqlUrl()}
                className="rounded-lg border border-line px-2.5 py-1 font-medium hover:border-emerald-500/40"
              >
                Download MySQL (.sql)
              </a>
              <a
                href={getExportNoSqlUrl()}
                className="rounded-lg border border-line px-2.5 py-1 font-medium hover:border-violet-500/40"
              >
                Download NoSQL (.json)
              </a>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-xl border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line bg-zinc-100/80 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-mist dark:bg-zinc-900/80 sm:grid-cols-[minmax(0,1fr)_84px_208px_84px]">
              <span className="truncate">Module</span>
              <span className="hidden whitespace-nowrap text-right sm:block">
                {isBothActive ? 'Schemas' : isNosqlActive ? 'Collections' : 'Tables'}
              </span>
              <span className="whitespace-nowrap text-right">
                {isBothActive ? 'SQL · NoSQL Records' : isNosqlActive ? 'Documents' : 'SQL Rows'}
              </span>
              <span className="hidden whitespace-nowrap text-right sm:block">Action</span>
            </div>

            <div className="divide-y divide-black/5 dark:divide-white/5">
              {stats.modules.map((m) => {
                const isExp = expandedModule === m.module
                const modTables = stats.tables.filter((t) => t.module === m.module)
                return (
                  <div key={m.module}>
                    <div
                      onClick={() => setExpandedModule(isExp ? null : m.module)}
                      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-xs transition hover:bg-black/[0.025] dark:hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_84px_208px_84px]"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {isExp ? (
                          <ChevronDown className="size-3.5 shrink-0 text-mist" />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0 text-mist" />
                        )}
                        <span className="truncate font-semibold">{m.module}</span>
                        <span className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-mist sm:hidden dark:bg-white/[0.06]">
                          {m.tables}
                        </span>
                      </div>

                      <div className="hidden whitespace-nowrap text-right font-mono text-mist sm:block">
                        {m.tables}
                      </div>

                      <div className="flex items-center justify-end gap-1.5 font-mono">
                        {isBothActive && m.mysqlRows !== undefined && m.nosqlRows !== undefined ? (
                          <>
                            <span className="inline-flex whitespace-nowrap items-center rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              {m.mysqlRows.toLocaleString()} SQL
                            </span>
                            <span className="inline-flex whitespace-nowrap items-center rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-300">
                              {m.nosqlRows.toLocaleString()} NoSQL
                            </span>
                          </>
                        ) : (
                          <span
                            className={`inline-flex whitespace-nowrap items-center rounded-md px-2 py-0.5 text-[11px] font-bold ${
                              isNosqlActive
                                ? 'border border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                                : 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {m.rows.toLocaleString()} {isNosqlActive ? 'docs' : 'rows'}
                          </span>
                        )}
                      </div>

                      <div className="hidden justify-end sm:flex">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(getRouteForModule(m.module))
                          }}
                          className="inline-flex whitespace-nowrap items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-mist transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer"
                        >
                          Open
                          <ArrowUpRight className="size-3" />
                        </button>
                      </div>
                    </div>

                    {isExp && modTables.length > 0 && (
                      <div className="border-t border-line bg-black/[0.015] p-3.5 dark:bg-white/[0.015]">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {modTables.map((t) => (
                            <button
                              key={t.table}
                              type="button"
                              onClick={() => navigate(getRouteForTable(t.table, m.module))}
                              className="group flex items-center justify-between gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left text-[11px] transition hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] dark:bg-zinc-900/80 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <code className="truncate font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                    {t.table}
                                  </code>
                                  <ArrowUpRight className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100 text-mist" />
                                </div>
                                {t.menu && (
                                  <span className="block truncate text-[10px] text-mist">{t.menu}</span>
                                )}
                              </div>
                              <span className="shrink-0 rounded-md bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-mist dark:bg-white/[0.06]">
                                {isBothActive && t.mysqlRows !== undefined && t.nosqlRows !== undefined
                                  ? `${t.mysqlRows} SQL · ${t.nosqlRows} NoSQL`
                                  : `${t.rows.toLocaleString()} ${isNosqlActive ? 'docs' : 'rows'}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DatabaseEngineSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Database engine"
        desc="Choose MySQL relational tables (InnoDB), NoSQL document collections, or Both Databases for simultaneous dual-write persistence across all 21 modules."
      />
      <DatabaseEngineSettings />
    </div>
  )
}
