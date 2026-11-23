import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Database,
  FileJson,
  GitFork,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Settings,
  Search,
  ArrowUpRight,
  Sparkles,
  X,
} from 'lucide-react'
import { Modal } from './ui'
import { useAuth } from '../context/AuthContext'
import { trustedLogin, trustedLogout } from '../lib/trustedSession'
import { getAppBasePath } from '../lib/mysqlBridge'
import {
  attachAndSyncAllModules,
  fetchMysqlStats,
  getExportSqlUrl,
  getExportNoSqlUrl,
  getMysqlState,
  subscribeMysqlState,
  type DatabaseEngineType,
  type MysqlBridgeState,
  type MysqlStatsResponse,
  type MysqlTableStat,
} from '../lib/mysqlBridge'
import { getRouteForModule, getRouteForTable } from '../lib/dbModuleRoutes'
import { useToast } from '../context/ToastContext'

export function MysqlStatusBadge() {
  const { show } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<MysqlBridgeState>(getMysqlState)
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<MysqlStatsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [syncingNow, setSyncingNow] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [serverPassword, setServerPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    return subscribeMysqlState(() => setState(getMysqlState()))
  }, [])

  const loadStats = async () => {
    setLoading(true)
    setStatsError(null)
    try {
      const res = await fetchMysqlStats()
      setStats(res)

    } catch (error) {
      setStats(null)
      setStatsError(error instanceof Error ? error.message : 'Unable to load database status.')
    } finally {
      setLoading(false)
    }
  }

  const signInServer = async () => {
    if (!user || !serverPassword || authBusy) return
    setAuthBusy(true); setAuthError('')
    try {
      const session = await trustedLogin(getAppBasePath(), user.email, serverPassword)
      setServerPassword('')
      if (session.user.id !== user.id || !['super_admin','company_admin'].includes(session.user.role)) {
        await trustedLogout(getAppBasePath()).catch(() => {})
        throw new Error('The trusted server account must match your signed-in administrator account.')
      }
      await loadStats()
    } catch (error) { setServerPassword(''); setAuthError(error instanceof Error ? error.message : 'Server sign-in failed.') }
    finally { setAuthBusy(false) }
  }

  useEffect(() => {
    if (open) {
      void loadStats()
    }
  }, [open])

  const activeEngine: DatabaseEngineType = stats?.activeEngine || state.activeEngine || 'mysql'
  const isBoth = activeEngine === 'both'
  const isNosql = activeEngine === 'nosql'
  const engineLabel = isBoth ? 'MySQL + NoSQL' : isNosql ? 'NoSQL' : 'MySQL'

  const handleForceSync = async () => {
    setSyncingNow(true)
    try {
      const res = await attachAndSyncAllModules()
      if (res.ok) {
        show(
          isBoth
            ? `Attached & saved ${res.synced ?? 0} module stores simultaneously into BOTH MySQL and NoSQL.`
            : `Attached & synced ${res.synced ?? 0} module stores to ${engineLabel} (${state.database}).`,
          'success',
        )
        if (res.stats) {
          setStats(res.stats)
        } else {
          await loadStats()
        }
      } else {
        show(res.error || `${engineLabel} sync failed.`, 'error')
      }
    } finally {
      setSyncingNow(false)
    }
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredModules = useMemo(() => {
    if (!stats?.modules) return []
    if (!normalizedQuery) return stats.modules
    return stats.modules.filter((m) => {
      if (m.module.toLowerCase().includes(normalizedQuery)) return true
      return stats.tables.some(
        (t) =>
          t.module === m.module &&
          (t.table.toLowerCase().includes(normalizedQuery) ||
            (t.menu || '').toLowerCase().includes(normalizedQuery)),
      )
    })
  }, [stats, normalizedQuery])

  const groupTablesByMenu = (modTables: MysqlTableStat[]) => {
    const groups = new Map<string, MysqlTableStat[]>()
    for (const t of modTables) {
      const label = t.menu || 'Core Tables'
      const arr = groups.get(label) || []
      arr.push(t)
      groups.set(label, arr)
    }
    return Array.from(groups.entries())
  }

  const openRoute = (route: string) => {
    setOpen(false)
    navigate(route)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          state.connected
            ? `Active mode: ${engineLabel} (${state.database}) — click for module status or to switch mode`
            : `${engineLabel} status: ${state.error || 'Offline'}`
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.03] px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-black/5 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/10 cursor-pointer"
      >
        {isBoth ? (
          <GitFork className="size-3.5 shrink-0 text-cyan-500" />
        ) : isNosql ? (
          <FileJson className="size-3.5 shrink-0 text-violet-500" />
        ) : (
          <Database className="size-3.5 shrink-0 text-green-600 dark:text-lime" />
        )}
        <span className="hidden truncate max-w-[145px] sm:inline">
          {state.syncing
            ? 'Syncing…'
            : state.connected
              ? isBoth
                ? 'Both · MySQL + NoSQL'
                : `${engineLabel} · ${state.database}`
              : `${engineLabel} Offline`}
        </span>
        <span
          className={`size-2 shrink-0 rounded-full ${
            state.syncing
              ? 'animate-pulse bg-amber-400'
              : state.connected
                ? isBoth
                  ? 'bg-cyan-500'
                  : isNosql
                    ? 'bg-violet-500'
                    : 'bg-emerald-500'
                : 'bg-rose-500'
          }`}
        />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          !stats ? 'Database Status' : isBoth
            ? 'Dual-Write Database Status (MySQL + NoSQL)'
            : isNosql
              ? 'NoSQL Document Database Status'
              : 'MySQL Relational Database Status'
        }
        maxWidth="4xl"
        zIndex={10050}
      >
        <div className="flex min-h-0 max-h-[calc(88dvh-6rem)] flex-col gap-3">
          {/* Top Connection & Mode Control Bar */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-black/[0.02] p-3 dark:bg-white/[0.025]">
            <div className="flex min-w-0 items-center gap-2.5">
              {state.connected ? (
                <CheckCircle2
                  className={`size-5 shrink-0 ${
                    isBoth ? 'text-cyan-500' : isNosql ? 'text-violet-500' : 'text-emerald-500'
                  }`}
                />
              ) : (
                <AlertTriangle className="size-5 shrink-0 text-rose-500" />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-bold sm:text-sm">
                  {isBoth
                    ? (state.connected && !statsError ? 'Simultaneous Dual-Write Active (MySQL + NoSQL)' : 'Dual-Write Database Status (MySQL + NoSQL)')
                    : `${stats?.engine || (isNosql ? 'NoSQL Document Store' : 'MySQL / MariaDB')} ${
                        stats?.version ? `v${stats.version.split('-')[0]}` : ''
                      }`}
                </p>
                <p className="truncate text-[11px] text-mist sm:text-xs">
                  {isBoth ? (
                    <>
                      {state.connected && !statsError ? 'Saving into BOTH:' : 'Configured databases:'}{' '}
                      <code className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                        {stats?.mysqlSummary?.database || 'fitpro_gym'}
                      </code>{' '}
                      +{' '}
                      <code className="font-mono font-semibold text-violet-600 dark:text-violet-400">
                        {stats?.nosqlSummary?.database || 'fitpro_nosql'}
                      </code>
                    </>
                  ) : isNosql ? (
                    <>
                      Mode: <code className="font-mono">Document Collections</code> · Namespace:{' '}
                      <code className="font-mono font-semibold">{stats?.database || state.database}</code>
                    </>
                  ) : (
                    <>
                      Host: <code className="font-mono">{stats?.host || '127.0.0.1'}:{stats?.port || 3306}</code> · Database:{' '}
                      <code className="font-mono font-semibold">{stats?.database || state.database}</code>
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleForceSync}
                disabled={syncingNow || !stats || !state.connected}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-transparent px-2.5 text-xs font-semibold text-mist transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 disabled:opacity-50 cursor-pointer"
                title="Attach and synchronize all 21 modules with the active database(s)"
              >
                {syncingNow || loading ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5 text-emerald-500" />
                )}
                {syncingNow ? 'Syncing…' : 'Sync All'}
              </button>

              {false && (
                <a
                  href={getExportSqlUrl()}
                  download
                  className="btn-lime inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-bold"
                >
                  <Download className="size-3.5" />
                  .SQL
                </a>
              )}

              {(activeEngine === 'nosql' || isBoth) && (
                <a
                  href={getExportNoSqlUrl()}
                  download
                  className="btn-lime inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-bold"
                >
                  <Download className="size-3.5" />
                  .JSON
                </a>
              )}
            </div>
          </div>

          {state.error && !stats && !statsError && (
            <div className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              {state.error}
            </div>
          )}

          {statsError && (
            <div role="alert" className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">
              <p>Database statistics unavailable: {statsError}</p>
              {/not authenticated/i.test(statsError) && user && ['super_admin','company_admin'].includes(user.role) ? <div className="mt-2 space-y-2"><p>Sign in with your separate trusted administrator server password. The app login does not automatically create a server session.</p><label className="block" htmlFor="db-status-server-password">Server password</label><input id="db-status-server-password" type="password" autoComplete="current-password" value={serverPassword} onChange={e=>setServerPassword(e.target.value)} className="w-full max-w-sm rounded-lg border border-current bg-transparent px-3 py-2 text-inherit"/>{authError && <p role="alert">{authError}</p>}<div><button type="button" onClick={()=>void signInServer()} disabled={authBusy||!serverPassword} className="rounded-lg border border-current px-3 py-1 font-semibold disabled:opacity-50">{authBusy?'Signing in…':'Sign in to server'}</button></div></div> : <p className="mt-1">Check the server connection and trusted administrator session, then retry.</p>}
              <button type="button" onClick={() => void loadStats()} disabled={loading} className="mt-2 rounded-lg border border-current px-3 py-1 font-semibold disabled:opacity-50">{loading ? 'Retrying…' : 'Retry'}</button>
            </div>
          )}

          {stats && !state.connected && <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">Server statistics loaded. The app sync session is still offline; reload the app after saving any unsynced work to reconnect. Sync and engine switching are disabled until then.</div>}

          {loading && !stats && (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-mist">
              <RefreshCw className="size-4 animate-spin" />
              Loading live database telemetry…
            </div>
          )}

          {stats && (
            <>
              {/* Summary KPI Strip */}
              <div className="grid shrink-0 grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-line bg-black/[0.015] px-3 py-2 dark:bg-white/[0.02]">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist sm:text-[11px]">
                    Modules Attached
                  </p>
                  <p className="mt-0.5 text-base font-extrabold sm:text-lg">{stats.modules.length}</p>
                </div>
                {isBoth ? (
                  <>
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] px-3 py-2">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist sm:text-[11px]">
                        MySQL ({stats.mysqlSummary?.totalTables ?? 270} Tables)
                      </p>
                      <p className="mt-0.5 text-base font-extrabold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                        {(stats.mysqlSummary?.totalRows ?? stats.totalRows).toLocaleString()} rows
                      </p>
                    </div>
                    <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] px-3 py-2">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist sm:text-[11px]">
                        NoSQL ({stats.nosqlSummary?.totalTables ?? 270} Collections)
                      </p>
                      <p className="mt-0.5 text-base font-extrabold text-violet-600 dark:text-violet-400 sm:text-lg">
                        {(stats.nosqlSummary?.totalRows ?? stats.totalRows).toLocaleString()} docs
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-line bg-black/[0.015] px-3 py-2 dark:bg-white/[0.02]">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist sm:text-[11px]">
                        {isNosql ? 'NoSQL Collections' : 'MySQL Tables'}
                      </p>
                      <p className="mt-0.5 text-base font-extrabold sm:text-lg">{stats.totalTables}</p>
                    </div>
                    <div className="rounded-xl border border-line bg-black/[0.015] px-3 py-2 dark:bg-white/[0.02]">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-mist sm:text-[11px]">
                        {isNosql ? 'Total Documents' : 'Persisted Rows'}
                      </p>
                      <p className="mt-0.5 text-base font-extrabold sm:text-lg">
                        {stats.totalRows.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Search Filter */}
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-mist" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search modules, sub-menus, or tables (e.g. edu_students, card_, cert_, church_, Front Desk)…"
                  className="h-9 w-full rounded-xl border border-line bg-black/[0.015] pl-9 pr-8 text-xs focus:border-emerald-500 focus:outline-none dark:bg-white/[0.02]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-mist hover:text-inherit cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Clean CSS-Grid Accordion List (immune to global table/th olive styles) */}
              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-line">
                {/* Sticky Column Header */}
                <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line bg-zinc-100/95 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-mist backdrop-blur-sm dark:bg-zinc-900/95 sm:grid-cols-[minmax(0,1fr)_84px_208px_84px]">
                  <span className="truncate">Module</span>
                  <span className="hidden whitespace-nowrap text-right sm:block">
                    {isBoth ? 'Schemas' : isNosql ? 'Collections' : 'Tables'}
                  </span>
                  <span className="whitespace-nowrap text-right">
                    {isBoth ? 'SQL · NoSQL Records' : isNosql ? 'Documents' : 'SQL Rows'}
                  </span>
                  <span className="hidden whitespace-nowrap text-right sm:block">Action</span>
                </div>

                {/* Module Rows */}
                <div className="divide-y divide-black/5 dark:divide-white/5">
                  {filteredModules.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-mist">
                      No modules or tables match &ldquo;{searchQuery}&rdquo;.
                    </div>
                  )}

                  {filteredModules.map((m) => {
                    const isExpanded = Boolean(normalizedQuery) || expandedModule === m.module
                    const modTables = stats.tables.filter(
                      (t) =>
                        t.module === m.module &&
                        (!normalizedQuery ||
                          m.module.toLowerCase().includes(normalizedQuery) ||
                          t.table.toLowerCase().includes(normalizedQuery) ||
                          (t.menu || '').toLowerCase().includes(normalizedQuery)),
                    )
                    const groupedMenus = groupTablesByMenu(modTables)
                    const modRoute = getRouteForModule(m.module)

                    return (
                      <div key={m.module}>
                        {/* Module Summary Row */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedModule(expandedModule === m.module ? null : m.module)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setExpandedModule(expandedModule === m.module ? null : m.module)
                            }
                          }}
                          className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-xs transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_84px_208px_84px]"
                        >
                          {/* Col 1: Chevron + Module Name */}
                          <div className="flex min-w-0 items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="size-3.5 shrink-0 text-mist" />
                            ) : (
                              <ChevronRight className="size-3.5 shrink-0 text-mist" />
                            )}
                            <span className="truncate font-semibold">{m.module}</span>
                            <span className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-mist sm:hidden dark:bg-white/[0.06]">
                              {m.tables}
                            </span>
                          </div>

                          {/* Col 2: Tables / Collections Count */}
                          <div className="hidden whitespace-nowrap text-right font-mono text-mist sm:block">
                            {m.tables}
                          </div>

                          {/* Col 3: Persisted Record Badges */}
                          <div className="flex items-center justify-end gap-1.5 font-mono">
                            {isBoth && m.mysqlRows !== undefined && m.nosqlRows !== undefined ? (
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
                                  m.rows > 0
                                    ? isNosql
                                      ? 'border border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                                      : 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                    : 'border border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {m.rows.toLocaleString()} {isNosql ? 'docs' : 'rows'}
                              </span>
                            )}
                          </div>

                          {/* Col 4: Right-Aligned Open Action */}
                          <div className="hidden justify-end sm:flex">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openRoute(modRoute)
                              }}
                              className="inline-flex whitespace-nowrap items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-mist transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300 cursor-pointer"
                              title={`Open ${m.module} in app`}
                            >
                              Open
                              <ArrowUpRight className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Tables / Collections Drawer */}
                        {isExpanded && modTables.length > 0 && (
                          <div className="border-t border-black/5 bg-black/[0.015] px-4 py-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                            <div className="space-y-3.5">
                              {groupedMenus.map(([menuLabel, items]) => (
                                <div key={menuLabel}>
                                  {groupedMenus.length > 1 && (
                                    <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-mist">
                                      <span>{menuLabel}</span>
                                      <span className="rounded bg-black/[0.04] px-1.5 py-0.5 font-mono dark:bg-white/[0.06]">
                                        {items.length} {items.length === 1 ? 'schema' : 'schemas'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {items.map((t) => {
                                      const tblRoute = getRouteForTable(t.table, m.module)
                                      return (
                                        <button
                                          key={t.table}
                                          type="button"
                                          onClick={() => openRoute(tblRoute)}
                                          title={`Open ${t.menu || m.module} (${t.table}) in app`}
                                          className="group flex items-center justify-between gap-2.5 rounded-xl border border-line bg-white px-3 py-2 text-left text-[11px] transition hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] dark:bg-zinc-900/80 cursor-pointer"
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <code
                                                className={`truncate font-mono font-bold ${
                                                  isBoth
                                                    ? 'text-cyan-700 dark:text-cyan-300'
                                                    : isNosql
                                                      ? 'text-violet-600 dark:text-violet-300'
                                                      : 'text-emerald-700 dark:text-emerald-300'
                                                }`}
                                              >
                                                {t.table}
                                              </code>
                                              <ArrowUpRight className="size-3 shrink-0 text-mist opacity-0 transition group-hover:opacity-100" />
                                            </div>
                                            {t.menu && (
                                              <span className="block truncate text-[10px] text-mist">{t.menu}</span>
                                            )}
                                          </div>
                                          <span className="shrink-0 whitespace-nowrap rounded-md bg-black/[0.04] px-2 py-0.5 font-mono text-[10px] font-semibold text-mist dark:bg-white/[0.06]">
                                            {isBoth && t.mysqlRows !== undefined && t.nosqlRows !== undefined
                                              ? `${t.mysqlRows} SQL · ${t.nosqlRows} NoSQL`
                                              : `${t.rows.toLocaleString()} ${isNosql ? 'docs' : 'rows'}`}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
