import { trustedCsrfHeaders } from './trustedSession'
import { restoreFailedSync } from './syncPendingQueue'
import { validateDatabaseStats } from './databaseStatsValidation'
import { collectInitialSeedStores, ensureAttachedModuleStores } from './mysqlSeedCollector'

const DB_HYDRATED_EVENT = 'fitpro:db-hydrated'

function notifyStoresHydrated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(DB_HYDRATED_EVENT))
  }
}

export function subscribeDbHydrated(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(DB_HYDRATED_EVENT, listener)
  return () => window.removeEventListener(DB_HYDRATED_EVENT, listener)
}

declare global {
  interface Window {
    __FITPRO_BASE__?: string
  }
}

export type DatabaseEngineType = 'mysql' | 'nosql' | 'both'

export interface MysqlModuleStat {
  module: string
  tables: number
  rows: number
  mysqlRows?: number
  nosqlRows?: number
}

export interface MysqlTableStat {
  table: string
  module: string
  menu?: string | null
  rows: number
  mysqlRows?: number
  nosqlRows?: number
}

export interface MysqlStatsResponse {
  ok: boolean
  activeEngine?: DatabaseEngineType
  dualWrite?: boolean
  connected: boolean
  engine: string
  version: string
  host: string
  port: number
  database: string
  storagePath?: string
  totalTables: number
  totalRows: number
  lastSyncedAt: string | null
  mysqlSummary?: {
    connected: boolean
    engine: string
    version: string
    host: string
    port: number
    database: string
    totalTables: number
    totalRows: number
  }
  nosqlSummary?: {
    connected: boolean
    engine: string
    version: string
    database: string
    storagePath: string | null
    totalTables: number
    totalRows: number
  }
  modules: MysqlModuleStat[]
  tables: MysqlTableStat[]
  error?: string
}

export interface DatabaseEngineConfigResponse {
  ok: boolean
  activeEngine: DatabaseEngineType
  dualWrite?: boolean
  switchedAt: string | null
  mysql: {
    host: string
    port: number
    database: string
    username: string
    hasPassword?: boolean
    available: boolean
    version: string | null
    error: string | null
  }
  nosql: {
    driver: 'document_store' | 'mongodb'
    database: string
    mongoUri: string
    available: boolean
    storagePath: string | null
    mongoExtLoaded: boolean
    error: string | null
  }
  error?: string
}

export interface MysqlBridgeState {
  activeEngine: DatabaseEngineType
  connected: boolean
  database: string
  syncing: boolean
  lastSyncedAt: string | null
  error: string | null
}

const LOCAL_ONLY_KEYS = new Set([
  'fitpro_session',
  'fitpro_impersonator',
  'fitpro_theme',
  'fitpro_lang',
  'fitpro_db_engine_pref',
])

const isSyncedKey = (key: string) =>
  !LOCAL_ONLY_KEYS.has(key) && (key.startsWith('fitpro_') || key.startsWith('cert_'))

const rawSetItem = Storage.prototype.setItem
const rawRemoveItem = Storage.prototype.removeItem
const rawClear = Storage.prototype.clear

let nativeFetch: typeof window.fetch | null = null
let isHydrating = false
let syncTimer: ReturnType<typeof setTimeout> | null = null
let inFlightSync: Promise<void> | null = null
let pendingStores: Record<string, string> = {}
const pendingDeleted = new Set<string>()
let noSqlRevisions: Record<string, string | null> | null = null

const isValidEngine = (v: unknown): v is DatabaseEngineType =>
  v === 'mysql' || v === 'nosql' || v === 'both'

const defaultDbLabel = (eng: DatabaseEngineType): string =>
  eng === 'both'
    ? 'fitpro_gym + fitpro_nosql'
    : eng === 'nosql'
      ? 'fitpro_nosql'
      : 'fitpro_gym'

const initialSavedEngine = (): DatabaseEngineType => {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('fitpro_db_engine_pref') : null
    return isValidEngine(v) ? v : 'mysql'
  } catch {
    return 'mysql'
  }
}

const bridgeState: MysqlBridgeState = {
  activeEngine: initialSavedEngine(),
  connected: false,
  database: defaultDbLabel(initialSavedEngine()),
  syncing: false,
  lastSyncedAt: null,
  error: null,
}

const listeners = new Set<() => void>()
function emitBridgeState() {
  listeners.forEach((fn) => {
    try { fn() } catch { /* ignore */ }
  })
}

export function subscribeMysqlState(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getMysqlState(): MysqlBridgeState {
  return { ...bridgeState }
}

export function getAppBasePath(): string {
  if (typeof window === 'undefined') return ''
  const raw = (window.__FITPRO_BASE__ || '').trim()
  if (!raw || raw === '/') return ''
  return raw.endsWith('/') ? raw.slice(0, -1) : raw
}

export function apiUrl(path: string): string {
  const base = getAppBasePath()
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

export function getExportSqlUrl(): string {
  return apiUrl('/api/db/export-sql')
}

export function getExportNoSqlUrl(): string {
  return apiUrl('/api/db/export-nosql')
}

function installSubfolderFetchPatch() {
  if (typeof window === 'undefined' || nativeFetch) return
  nativeFetch = window.fetch.bind(window)
  const base = getAppBasePath()
  if (!base) return

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return nativeFetch!(`${base}${input}`, init)
    }
    return nativeFetch!(input, init)
  }

  // Rewrite root-relative /images/ and /cropped_photo/ URLs when hosted in a XAMPP htdocs subfolder
  const rewriteImages = (root: ParentNode) => {
    root.querySelectorAll?.('img[src^="/images/"], img[src^="/cropped_photo/"]').forEach((el) => {
      const src = el.getAttribute('src')
      if (src && src.startsWith('/')) el.setAttribute('src', `${base}${src}`)
    })
  }
  if (document.body) rewriteImages(document.body)
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.target instanceof HTMLImageElement) {
        const src = m.target.getAttribute('src')
        if (src && (src.startsWith('/images/') || src.startsWith('/cropped_photo/'))) {
          m.target.setAttribute('src', `${base}${src}`)
        }
      }
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) {
          if (n instanceof HTMLImageElement) {
            const src = n.getAttribute('src')
            if (src && (src.startsWith('/images/') || src.startsWith('/cropped_photo/'))) {
              n.setAttribute('src', `${base}${src}`)
            }
          }
          rewriteImages(n)
        }
      })
    }
  })
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  })
}

/** Conditional NoSQL writes reject snapshots that were superseded by another
 * cooperating client. Legacy endpoints and engine switches can still bypass it;
 * this is not authorization or an atomic multi-collection transaction. */
async function sendStoreSync(stores:Record<string,string>, deleted:string[], keepalive = false) {
  const f = nativeFetch || window.fetch.bind(window)
  const conditional = bridgeState.activeEngine === 'nosql'
  if (conditional && noSqlRevisions === null) throw new Error('NoSQL revisions are unavailable. Reload before syncing.')
  const revisions:Record<string,string|null> = {}
  if (conditional) for (const key of new Set([...Object.keys(stores), ...deleted])) revisions[key] = noSqlRevisions![key] ?? null
  const res = await f(apiUrl(conditional ? '/api/db/sync-conditional' : '/api/db/sync'), {
    method:'POST', headers:{'Content-Type':'application/json', ...trustedCsrfHeaders()},
    body:JSON.stringify(conditional ? {stores,deleted,revisions} : {stores,deleted}), keepalive,
  })
  const json = await res.json().catch(()=>null)
  if (!res.ok || !json?.ok) {
    const conflict = res.status === 409 && Array.isArray(json?.conflicts)
    throw new Error(conflict ? 'Database changes conflict with another session. Unsynced changes remain in this tab; review before reloading.' : json?.error || `Database sync HTTP ${res.status}`)
  }
  if (conditional) {
    if (!json.revisions || typeof json.revisions !== 'object') throw new Error('NoSQL sync did not return revisions; review the database before retrying.')
    for (const key of Object.keys(revisions)) {
      if (!Object.prototype.hasOwnProperty.call(json.revisions,key) || (json.revisions[key] !== null && typeof json.revisions[key] !== 'string')) throw new Error('NoSQL sync returned invalid revisions; review before retrying.')
    }
    Object.assign(noSqlRevisions!,json.revisions)
  }
  return json
}

async function flushPendingSync(keepalive = false): Promise<void> {
  if (syncTimer) { clearTimeout(syncTimer); syncTimer = null }
  // Never allow an earlier request to finish after a later one from this tab.
  if (inFlightSync) { await inFlightSync; if (!bridgeState.error) return flushPendingSync(keepalive); return }
  const stores = pendingStores
  const deleted = [...pendingDeleted]
  if (Object.keys(stores).length === 0 && deleted.length === 0) return
  pendingStores = {}
  pendingDeleted.clear()
  bridgeState.syncing = true
  emitBridgeState()
  let succeeded = false
  inFlightSync = (async () => {
    try {
      const json = await sendStoreSync(stores, deleted, keepalive)
      if (isValidEngine(json.activeEngine)) bridgeState.activeEngine = json.activeEngine
      if (json.database) bridgeState.database = json.database
      bridgeState.connected = true
      bridgeState.lastSyncedAt = new Date().toISOString()
      bridgeState.error = null
      succeeded = true
    } catch (e) {
      restoreFailedSync(pendingStores, pendingDeleted, stores, deleted)
      bridgeState.error = e instanceof Error ? e.message : 'Database sync failed'
    } finally {
      bridgeState.syncing = false
      emitBridgeState()
    }
  })()
  await inFlightSync
  inFlightSync = null
  // Changes made during the request are sent after it finishes. Failed writes
  // remain queued, but are not retried in a tight loop while the server is down.
  if (succeeded && (Object.keys(pendingStores).length || pendingDeleted.size)) scheduleSync()
}

/** Flush an already queued education-store write before a payment notification.
 * Does not make the underlying whole-store sync concurrency-safe. */
export async function flushEducationBeforeNotification(): Promise<boolean> {
  if (bridgeState.syncing || !Object.prototype.hasOwnProperty.call(pendingStores, 'fitpro_edu_records_v1')) return false
  await flushPendingSync(false)
  return bridgeState.connected && !bridgeState.error && !bridgeState.syncing
}

/** Flush queued store updates without writing unrelated stores. */
export async function flushDataMaintenanceChanges(): Promise<boolean> {
  await flushPendingSync(false)
  return bridgeState.connected && !bridgeState.error && !bridgeState.syncing
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    void flushPendingSync(false)
  }, 80)
}

function installStorageInterceptor() {
  if (typeof window === 'undefined') return

  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    const strVal = String(value)
    rawSetItem.call(this, key, strVal)
    if (this === window.localStorage && !isHydrating && isSyncedKey(key)) {
      pendingDeleted.delete(key)
      pendingStores[key] = strVal
      scheduleSync()
    }
  }

  Storage.prototype.removeItem = function (this: Storage, key: string) {
    rawRemoveItem.call(this, key)
    if (this === window.localStorage && !isHydrating && isSyncedKey(key)) {
      delete pendingStores[key]
      pendingDeleted.add(key)
      scheduleSync()
    }
  }

  Storage.prototype.clear = function (this: Storage) {
    if (this === window.localStorage && !isHydrating) {
      for (let i = 0; i < this.length; i++) {
        const k = this.key(i)
        if (k && isSyncedKey(k)) {
          delete pendingStores[k]
          pendingDeleted.add(k)
        }
      }
      scheduleSync()
    }
    rawClear.call(this)
  }

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      void flushPendingSync(true)
    }
  })
  window.addEventListener('pagehide', () => {
    void flushPendingSync(true)
  })
}

/**
 * Bootstraps all 21 modules from the XAMPP MySQL database before React renders.
 * If the MySQL database is brand new (empty), initializes and seeds all module tables.
 */
export async function initMysqlBridge(): Promise<void> {
  if (typeof window === 'undefined') return
  installSubfolderFetchPatch()
  installStorageInterceptor()

  const f = nativeFetch || window.fetch.bind(window)
  try {
    const res = await f(apiUrl('/api/db/bootstrap'), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      const errBody = await res.json().catch(() => null)
      bridgeState.connected = false
      bridgeState.error = errBody?.error || `Bootstrap HTTP ${res.status}`
      emitBridgeState()
      return
    }

    const body = (await res.json()) as {
      ok: boolean
      activeEngine?: DatabaseEngineType
      database?: string
      seeded?: boolean
      stores?: Record<string, string>
      revisions?: Record<string, string>
      error?: string
    }

    if (!body?.ok) {
      bridgeState.connected = false
      bridgeState.error = body?.error || 'Database bootstrap failed'
      emitBridgeState()
      return
    }

    if (isValidEngine(body.activeEngine)) {
      bridgeState.activeEngine = body.activeEngine
      rawSetItem.call(window.localStorage, 'fitpro_db_engine_pref', body.activeEngine)
    }
    noSqlRevisions = body.activeEngine === 'nosql' && body.revisions && typeof body.revisions === 'object' ? { ...body.revisions } : null
    bridgeState.connected = true
    bridgeState.database = body.database || defaultDbLabel(bridgeState.activeEngine)
    bridgeState.error = null

    if (body.seeded && body.stores) {
      isHydrating = true
      let repairedStores: Record<string, string> = {}
      try {
        // Remove stale synced keys that no longer exist in the database
        const toRemove: string[] = []
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i)
          if (k && isSyncedKey(k) && !(k in body.stores)) {
            toRemove.push(k)
          }
        }
        for (const k of toRemove) {
          rawRemoveItem.call(window.localStorage, k)
        }
        for (const [k, v] of Object.entries(body.stores)) {
          if (isSyncedKey(k)) {
            rawSetItem.call(window.localStorage, k, String(v))
          }
        }
        // Self-heal & attach Education (121 tables), Certificates (8), Cards (4), and Church (4) if missing
        repairedStores = ensureAttachedModuleStores()
      } finally {
        isHydrating = false
      }

      if (Object.keys(repairedStores).length > 0) {
        await sendStoreSync(repairedStores, [])
      }

      bridgeState.lastSyncedAt = new Date().toISOString()
      emitBridgeState()
      notifyStoresHydrated()
    } else {
      // Fresh empty database — collect seeds across all 21 modules and push to active database(s)!
      isHydrating = true
      let initialStores: Record<string, string> = {}
      try {
        initialStores = collectInitialSeedStores((k, v) => {
          rawSetItem.call(window.localStorage, k, v)
        })
      } finally {
        isHydrating = false
      }

      await sendStoreSync(initialStores, [])
      bridgeState.lastSyncedAt = new Date().toISOString()
      emitBridgeState()
      notifyStoresHydrated()
    }
  } catch (e) {
    isHydrating = true
    try {
      ensureAttachedModuleStores()
    } finally {
      isHydrating = false
    }
    bridgeState.connected = false
    bridgeState.error = e instanceof Error ? e.message : 'Unable to reach XAMPP PHP/MySQL API'
    emitBridgeState()
  }
}

export async function fetchMysqlStats(): Promise<MysqlStatsResponse> {
  const f = nativeFetch || window.fetch.bind(window)
  const res = await f(apiUrl('/api/db/stats'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const json: unknown = await res.json().catch(() => null)
  validateDatabaseStats(json, res.ok, res.status)
  return json as MysqlStatsResponse
}

export async function forceSyncAllToMysql(): Promise<{
  ok: boolean
  synced?: number
  mysqlSynced?: number
  nosqlSynced?: number
  dualWrite?: boolean
  error?: string
}> {
  await flushPendingSync(false)
  const allStores = collectCurrentClientStores()
  if (bridgeState.error) return { ok:false, error:bridgeState.error }
  let json: any
  try { json = await sendStoreSync(allStores, []) }
  catch (e) { return { ok:false, error:e instanceof Error ? e.message : 'Database sync failed' } }
  if (json?.ok) {
    if (isValidEngine(json.activeEngine)) {
      bridgeState.activeEngine = json.activeEngine
    }
    if (json.database) {
      bridgeState.database = json.database
    }
    bridgeState.connected = true
    bridgeState.lastSyncedAt = new Date().toISOString()
    bridgeState.error = null
    emitBridgeState()
    return {
      ok: true,
      synced: json.synced,
      mysqlSynced: json.mysqlSynced,
      nosqlSynced: json.nosqlSynced,
      dualWrite: json.dualWrite,
    }
  }
  return { ok: false, error: json?.error || 'Database sync failed' }
}

function collectCurrentClientStores(): Record<string, string> {
  isHydrating = true
  try {
    ensureAttachedModuleStores()
  } finally {
    isHydrating = false
  }
  const allStores: Record<string, string> = {}
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k && isSyncedKey(k)) {
      const v = window.localStorage.getItem(k)
      if (v !== null) allStores[k] = v
    }
  }
  return allStores
}

/**
 * Ensures all 21 modules (including Education 121 tables, Certificate 8 tables,
 * Card 4 tables, and Church 4 tables) are initialized and synced to the active database(s).
 */
export async function attachAndSyncAllModules(): Promise<{
  ok: boolean
  synced?: number
  stats?: MysqlStatsResponse
  error?: string
}> {
  await flushPendingSync(false)
  bridgeState.syncing = true
  emitBridgeState()
  try {
    isHydrating = true
    try {
      ensureAttachedModuleStores()
      // If core stores are also missing, ensure initial seed baseline
      if (!window.localStorage.getItem('fitpro_companies')) {
        collectInitialSeedStores((k, v) => {
          rawSetItem.call(window.localStorage, k, v)
        })
      }
    } finally {
      isHydrating = false
    }

    const allStores = collectCurrentClientStores()
    if (bridgeState.error) return { ok:false, error:bridgeState.error }
    const json = await sendStoreSync(allStores, [])
    bridgeState.connected = true
    bridgeState.lastSyncedAt = new Date().toISOString()
    bridgeState.error = null
    notifyStoresHydrated()
    const stats = await fetchMysqlStats().catch(() => undefined)
    return { ok: true, synced: json.synced, stats }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Database sync failed' }
  } finally {
    bridgeState.syncing = false
    emitBridgeState()
  }
}

export async function fetchDatabaseEngineConfig(): Promise<DatabaseEngineConfigResponse> {
  const f = nativeFetch || window.fetch.bind(window)
  const res = await f(apiUrl('/api/db/engine'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  const json = (await res.json()) as DatabaseEngineConfigResponse
  if (json?.ok && isValidEngine(json.activeEngine)) {
    bridgeState.activeEngine = json.activeEngine
    bridgeState.database =
      json.activeEngine === 'both'
        ? `${json.mysql.database} + ${json.nosql.database}`
        : json.activeEngine === 'nosql'
          ? json.nosql.database
          : json.mysql.database
    rawSetItem.call(window.localStorage, 'fitpro_db_engine_pref', json.activeEngine)
    emitBridgeState()
  }
  return json
}

export async function testDatabaseConnection(payload: {
  engine: DatabaseEngineType
  mysql?: {
    host: string
    port: number
    database: string
    username: string
    password?: string
  }
  nosql?: {
    driver: 'document_store' | 'mongodb'
    database: string
    mongoUri: string
  }
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  const f = nativeFetch || window.fetch.bind(window)
  const res = await f(apiUrl('/api/db/test-connection'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...trustedCsrfHeaders() },
    body: JSON.stringify(payload),
  })
  return (await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))) as {
    ok: boolean
    message?: string
    error?: string
  }
}

export async function switchDatabaseEngine(payload: {
  engine: DatabaseEngineType
  migrateData: boolean
  mysql?: {
    host: string
    port: number
    database: string
    username: string
    password?: string
  }
  nosql?: {
    driver: 'document_store' | 'mongodb'
    database: string
    mongoUri: string
  }
}): Promise<{
  ok: boolean
  activeEngine?: DatabaseEngineType
  migratedStores?: number
  stats?: MysqlStatsResponse
  error?: string
}> {
  await flushPendingSync(false)
  bridgeState.syncing = true
  emitBridgeState()

  try {
    const f = nativeFetch || window.fetch.bind(window)
    const stores = payload.migrateData ? collectCurrentClientStores() : undefined
    const res = await f(apiUrl('/api/db/switch-engine'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...trustedCsrfHeaders() },
      body: JSON.stringify({ ...payload, stores }),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.ok) {
      const errMsg = json?.error || `Engine switch failed (${res.status})`
      bridgeState.error = errMsg
      return { ok: false, error: errMsg }
    }

    bridgeState.activeEngine = json.activeEngine
    // Do not attach fresh revisions to potentially stale client data after a switch.
    // NoSQL writes require a full reload/bootstrap to obtain a matching snapshot.
    noSqlRevisions = null
    bridgeState.connected = true
    bridgeState.database = json.stats?.database || defaultDbLabel(json.activeEngine)
    bridgeState.lastSyncedAt = new Date().toISOString()
    bridgeState.error = null
    rawSetItem.call(window.localStorage, 'fitpro_db_engine_pref', json.activeEngine)

    // Hydrate merged stores from the server so all 21 modules stay attached in client state
    if (json.stores && typeof json.stores === 'object') {
      isHydrating = true
      try {
        for (const [k, v] of Object.entries(json.stores as Record<string, string>)) {
          if (isSyncedKey(k)) {
            rawSetItem.call(window.localStorage, k, String(v))
          }
        }
        ensureAttachedModuleStores()
      } finally {
        isHydrating = false
      }
      notifyStoresHydrated()
    } else if (!payload.migrateData) {
      const bootRes = await f(apiUrl('/api/db/bootstrap'), { cache: 'no-store' })
      const bootJson = await bootRes.json().catch(() => null)
      if (bootRes.ok && bootJson?.ok && bootJson?.seeded && bootJson?.stores) {
        isHydrating = true
        try {
          for (const [k, v] of Object.entries(bootJson.stores as Record<string, string>)) {
            if (isSyncedKey(k)) {
              rawSetItem.call(window.localStorage, k, String(v))
            }
          }
          ensureAttachedModuleStores()
        } finally {
          isHydrating = false
        }
        notifyStoresHydrated()
      }
    }

    return {
      ok: true,
      activeEngine: json.activeEngine,
      migratedStores: json.migratedStores,
      stats: json.stats,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unable to reach XAMPP PHP backend'
    bridgeState.error = msg
    return { ok: false, error: msg }
  } finally {
    bridgeState.syncing = false
    emitBridgeState()
  }
}
