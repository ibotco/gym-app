import { useMemo, useState } from 'react'
import { Link2, RefreshCw, Trash2, CheckCircle2, XCircle, Landmark, Smartphone, AlertTriangle, Upload, Download, Settings2 } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField, Empty, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { exportExcel, exportCsv } from '../../../lib/export'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { nextNumber } from '../../../lib/accounting'
import {
  FEED_PROVIDERS, FEED_INSTITUTIONS, FEED_COUNTRIES, FEED_REGIONS, feedCountryName, feedRegionOf,
  loadFeedState, saveFeedState, fetchFeedTransactions, matchRule,
  type BankFeed, type FeedTxn, type FeedState, type FeedRegion, type FeedRule,
} from '../../../lib/bankFeeds'
import { readSheet, parseStatementDate, parseStatementAmount, type SheetRow } from '../../../lib/sheetReader'
import {
  MOMO_DEFAULT_BASE, MOMO_PRODUCTION_BASE, MOMO_DEV_PROXY_SANDBOX, MOMO_DEV_PROXY_LIVE,
  loadMomoConfig, saveMomoConfig,
  getMomoToken, getMomoBalance, getMomoTransaction, isMomoAccountActive, provisionSandboxUser,
  type MomoConfig, type MomoEnvironment,
} from '../../../lib/momo'
import {
  PROVIDER_APIS, specFor, loadProviderCreds, saveProviderCreds, testProvider, fetchProviderTransactions,
  type ProviderCreds,
} from '../../../lib/providerApi'
import { accountLabel } from './common'

type ConnectForm = {
  region: FeedRegion
  providerId: string
  countryCode: string
  institutionId: string
  accountName: string
  accountNumber: string
  ledgerAccountId: string
  frequency: BankFeed['frequency']
}

const todayIso = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

/**
 * Bank Feed — link African bank and mobile-money accounts through an open
 * banking provider, pull the statement lines in, then add or exclude each one.
 * Accepted lines post real receipt / payment vouchers to the mapped account.
 */
export function BankFeedsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const app = useApp()
  const { accounts, banks, receipts, paymentVouchers, upsertReceipt, upsertPaymentVoucher, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [state, setState] = useState<FeedState>(() => loadFeedState())
  const persist = (next: FeedState) => { setState(next); saveFeedState(next) }

  const [connecting, setConnecting] = useState<ConnectForm | null>(null)
  const [activeFeedId, setActiveFeedId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [txnFilter, setTxnFilter] = useState<'new' | 'accepted' | 'excluded' | 'all'>('new')
  const [postTo, setPostTo] = useState<Record<string, string>>({})
  const [syncFrom, setSyncFrom] = useState(daysAgo(30))
  const [syncTo, setSyncTo] = useState(todayIso())
  const [disconnecting, setDisconnecting] = useState<BankFeed | null>(null)

  const activeFeed = state.feeds.find((f) => f.id === activeFeedId) ?? state.feeds[0] ?? null
  /** Chart accounts that can receive a feed — bank accounts first, then cash. */
  const ledgerOptions = useMemo(
    () => accounts
      .filter((a) => Number(a.accountTypeId) === 16 || Number(a.accountTypeId) === 3)
      .sort((a, b) => Number(b.accountTypeId) - Number(a.accountTypeId) || (a.code || '').localeCompare(b.code || '')),
    [accounts],
  )
  /** Chart bank account whose name looks like the institution being linked. */
  const guessLedgerAccount = (institutionName: string) => {
    const words = institutionName.toLowerCase().replace(/[()]/g, '').split(/\s+/).filter((w) => w.length > 2)
    const hit = ledgerOptions.find((a) => words.some((w) => a.name.toLowerCase().includes(w)))
    return hit?.id || ledgerOptions[0]?.id || ''
  }
  /** Posting categories offered when adding a feed line. */
  const categoryOptions = useMemo(
    () => accounts.filter((a) => ![16].includes(Number(a.accountTypeId))),
    [accounts],
  )

  // ------------------------------------------------ live provider connections
  const [creds, setCreds] = useState<Record<string, ProviderCreds>>(() => loadProviderCreds())
  const [liveOpen, setLiveOpen] = useState(false)
  const [liveProvider, setLiveProvider] = useState<string>('mono')
  const [liveFeedId, setLiveFeedId] = useState('')
  const [liveAccount, setLiveAccount] = useState('')
  const [liveAccounts, setLiveAccounts] = useState<{ id: string; name: string }[]>([])
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveMsg, setLiveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const liveSpec = specFor(liveProvider)
  const liveCred: ProviderCreds = creds[liveProvider] ?? {
    providerId: liveProvider,
    env: 'sandbox',
    baseUrl: liveSpec?.proxy.sandbox || '',
    values: {},
  }
  const persistCreds = (next: ProviderCreds) => {
    const all = { ...creds, [next.providerId]: next }
    setCreds(all); saveProviderCreds(all)
  }

  /** Verify credentials against the provider and list its accounts. */
  const testLive = async () => {
    setLiveBusy(true); setLiveMsg(null); setLiveAccounts([])
    try {
      const { summary, accounts } = await testProvider(liveCred)
      setLiveAccounts(accounts)
      if (accounts[0] && !liveAccount) setLiveAccount(accounts[0].id)
      persistCreds({ ...liveCred, verifiedAt: new Date().toISOString() })
      setLiveMsg({ ok: true, text: summary })
    } catch (err) {
      setLiveMsg({ ok: false, text: err instanceof Error ? err.message : 'Connection failed.' })
    } finally { setLiveBusy(false) }
  }

  /** Pull real statement lines from the provider into the chosen feed. */
  const pullLive = async () => {
    const feed = state.feeds.find((f) => f.id === liveFeedId)
    if (!feed) { setLiveMsg({ ok: false, text: 'Choose the feed the transactions belong to.' }); return }
    const account = liveAccount || liveCred.values.accountId || ''
    if (!account) { setLiveMsg({ ok: false, text: 'Choose the provider account to pull.' }); return }
    setLiveBusy(true); setLiveMsg(null)
    try {
      const rows = await fetchProviderTransactions(liveCred, account, syncFrom, syncTo)
      if (!rows.length) { setLiveMsg({ ok: false, text: 'The provider returned no transactions for that date range.' }); return }
      const existing = state.txns.filter((t) => t.feedId === feed.id)
      let balance = existing.length ? existing[existing.length - 1].balance : 0
      const fresh: FeedTxn[] = rows
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r, i) => {
          balance = Math.round((balance + r.amount) * 100) / 100
          return {
            id: `ft_live_${feed.id}_${r.reference || `${r.date}_${i}`}`,
            feedId: feed.id,
            date: r.date,
            description: r.description,
            reference: r.reference || `${liveProvider.toUpperCase()}-${i + 1}`,
            amount: r.amount,
            balance,
            status: 'new' as const,
          }
        })
        .filter((t) => !existing.some((e) => e.id === t.id))
      persist({
        feeds: state.feeds.map((f) => (f.id === feed.id
          ? { ...f, live: true, status: 'connected', lastSyncAt: new Date().toISOString(), externalAccountId: account }
          : f)),
        txns: [...state.txns, ...fresh],
      })
      setActiveFeedId(feed.id)
      setLiveMsg({ ok: true, text: `Imported ${fresh.length} live transaction(s) from ${liveSpec?.label}.` })
      log(user?.id || 'system', 'CREATE', 'BankFeed', `Pulled ${fresh.length} live line(s) from ${liveSpec?.label} into ${feed.institutionName}`)
    } catch (err) {
      setLiveMsg({ ok: false, text: err instanceof Error ? err.message : 'Pull failed.' })
    } finally { setLiveBusy(false) }
  }

  // -------------------------------------------------- MTN MoMo (live API)
  const [momoCfg, setMomoCfg] = useState<MomoConfig>(() => loadMomoConfig() ?? {
    baseUrl: MOMO_DEFAULT_BASE,
    subscriptionKey: '',
    apiUser: '',
    apiKey: '',
    targetEnvironment: 'sandbox' as MomoEnvironment,
  })
  const [momoOpen, setMomoOpen] = useState(false)
  const [momoBusy, setMomoBusy] = useState(false)
  const [momoResult, setMomoResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [momoMsisdn, setMomoMsisdn] = useState('')
  const [momoRef, setMomoRef] = useState('')
  const [momoFeedId, setMomoFeedId] = useState('')

  const saveMomo = (next: MomoConfig) => { setMomoCfg(next); saveMomoConfig(next) }

  /** Fetch a token + balance so the credentials prove themselves. */
  const testMomo = async () => {
    setMomoBusy(true); setMomoResult(null)
    try {
      const token = await getMomoToken(momoCfg)
      const balance = await getMomoBalance(momoCfg, token)
      saveMomoConfig(momoCfg)
      setMomoResult({ ok: true, text: `Connected. Available balance ${balance.availableBalance} ${balance.currency}.` })
      if (momoFeedId) {
        persist({
          feeds: state.feeds.map((f) => (f.id === momoFeedId
            ? { ...f, live: true, status: 'connected', liveBalance: { amount: balance.availableBalance, currency: balance.currency, fetchedAt: new Date().toISOString() } }
            : f)),
          txns: state.txns,
        })
      }
    } catch (err) {
      setMomoResult({ ok: false, text: err instanceof Error ? err.message : 'Connection failed.' })
    } finally { setMomoBusy(false) }
  }

  /** Sandbox helper: mint an API user + key from a subscription key. */
  const provisionMomo = async () => {
    setMomoBusy(true); setMomoResult(null)
    try {
      const { apiUser, apiKey } = await provisionSandboxUser(momoCfg.baseUrl, momoCfg.subscriptionKey)
      saveMomo({ ...momoCfg, apiUser, apiKey })
      setMomoResult({ ok: true, text: `Sandbox credentials created. API user ${apiUser.slice(0, 8)}… saved.` })
    } catch (err) {
      setMomoResult({ ok: false, text: err instanceof Error ? err.message : 'Provisioning failed.' })
    } finally { setMomoBusy(false) }
  }

  /** Check that a customer wallet exists and is active. */
  const checkMomoWallet = async () => {
    setMomoBusy(true); setMomoResult(null)
    try {
      const token = await getMomoToken(momoCfg)
      const active = await isMomoAccountActive(momoCfg, token, momoMsisdn.trim())
      setMomoResult({ ok: active, text: active ? `${momoMsisdn} is an active MoMo wallet.` : `${momoMsisdn} is not an active MoMo wallet.` })
    } catch (err) {
      setMomoResult({ ok: false, text: err instanceof Error ? err.message : 'Lookup failed.' })
    } finally { setMomoBusy(false) }
  }

  /** Pull one real collection by reference and file it in the feed. */
  const pullMomoTransaction = async () => {
    const feed = state.feeds.find((f) => f.id === momoFeedId)
    if (!feed) { setMomoResult({ ok: false, text: 'Choose the MoMo feed to file the transaction under.' }); return }
    setMomoBusy(true); setMomoResult(null)
    try {
      const token = await getMomoToken(momoCfg)
      const txn = await getMomoTransaction(momoCfg, token, momoRef.trim())
      if (txn.status !== 'SUCCESSFUL') {
        setMomoResult({ ok: false, text: `Reference ${momoRef} is ${txn.status}${typeof txn.reason === 'string' ? ` — ${txn.reason}` : ''}. Only successful collections are imported.` })
        return
      }
      const amount = Number(txn.amount) || 0
      const existing = state.txns.filter((t) => t.feedId === feed.id)
      const balance = Math.round(((existing.length ? existing[existing.length - 1].balance : 0) + amount) * 100) / 100
      const line: FeedTxn = {
        id: `ft_momo_${momoRef.trim()}`,
        feedId: feed.id,
        date: new Date().toISOString().slice(0, 10),
        description: `MoMo collection from ${txn.payer?.partyId || 'customer'}${txn.payerMessage ? ` — ${txn.payerMessage}` : ''}`,
        reference: txn.financialTransactionId || momoRef.trim(),
        amount,
        balance,
        status: 'new',
      }
      if (state.txns.some((t) => t.id === line.id)) {
        setMomoResult({ ok: false, text: 'That reference has already been imported.' })
        return
      }
      persist({ feeds: state.feeds, txns: [...state.txns, line] })
      setActiveFeedId(feed.id)
      setMomoResult({ ok: true, text: `Imported ${txn.amount} ${txn.currency} from ${txn.payer?.partyId || 'customer'} — now waiting for review.` })
    } catch (err) {
      setMomoResult({ ok: false, text: err instanceof Error ? err.message : 'Lookup failed.' })
    } finally { setMomoBusy(false) }
  }

  /**
   * Blank statement templates. Downloading one shows the exact columns the
   * importer understands — fill it from your bank export and upload it back.
   */
  type TemplateRow = { Date: string; Description: string; Reference: string; Debit?: number | ''; Credit?: number | ''; Amount?: number }
  const templateRows = (style: 'split' | 'single'): TemplateRow[] => (style === 'split'
    ? [
        { Date: '2026-09-01', Description: 'POS settlement', Reference: 'TRX-0001', Debit: '', Credit: 1250 },
        { Date: '2026-09-03', Description: 'Supplier transfer', Reference: 'TRX-0002', Debit: 840.5, Credit: '' },
        { Date: '2026-09-07', Description: 'Bank charges', Reference: 'TRX-0003', Debit: 35.25, Credit: '' },
      ]
    : [
        { Date: '2026-09-01', Description: 'POS settlement', Reference: 'TRX-0001', Amount: 1250 },
        { Date: '2026-09-03', Description: 'Supplier transfer', Reference: 'TRX-0002', Amount: -840.5 },
        { Date: '2026-09-07', Description: 'Bank charges', Reference: 'TRX-0003', Amount: -35.25 },
      ])

  const downloadTemplate = async (style: 'split' | 'single', format: 'xlsx' | 'csv') => {
    const name = `bank-statement-template-${style === 'split' ? 'debit-credit' : 'amount'}`
    const ok = format === 'xlsx' ? await exportExcel(name, templateRows(style)) : await exportCsv(name, templateRows(style))
    if (ok) toast.success('Template downloaded', `${name}.${format} — fill it in and upload it back.`)
    else toast.error('Download blocked', 'Allow downloads for this site and try again.')
  }

  // ----------------------------------------------------------- manual upload
  type ImportState = {
    feedId: string
    fileName: string
    rows: SheetRow[]
    headerRow: boolean
    /** Column indexes (-1 = not mapped). */
    map: { date: number; description: number; reference: number; amount: number; debit: number; credit: number }
    mode: 'single' | 'split'
    error?: string
  }
  const [importing, setImporting] = useState<ImportState | null>(null)
  const [busy, setBusy] = useState(false)

  /** Guess which column is which from the header labels. */
  const guessMap = (header: SheetRow) => {
    const find = (...needles: string[]) =>
      header.findIndex((h) => needles.some((n) => String(h).toLowerCase().replace(/[^a-z]/g, '').includes(n)))
    return {
      date: find('date', 'valuedate', 'posted'),
      description: find('description', 'narration', 'details', 'particular', 'memo'),
      reference: find('reference', 'refno', 'transactionid', 'chequeno', 'cheque'),
      amount: find('amount', 'value'),
      debit: find('debit', 'withdrawal', 'moneyout', 'paidout'),
      credit: find('credit', 'deposit', 'moneyin', 'paidin'),
    }
  }

  const openImport = (feedId: string) => setImporting({
    feedId, fileName: '', rows: [], headerRow: true, mode: 'single',
    map: { date: -1, description: -1, reference: -1, amount: -1, debit: -1, credit: -1 },
  })

  const pickFile = async (file: File) => {
    if (!importing) return
    setBusy(true)
    try {
      const rows = await readSheet(file)
      if (!rows.length) { setImporting({ ...importing, fileName: file.name, rows: [], error: 'The file has no rows.' }); return }
      const map = guessMap(rows[0])
      setImporting({
        ...importing,
        fileName: file.name,
        rows,
        headerRow: true,
        map,
        mode: map.amount >= 0 ? 'single' : (map.debit >= 0 || map.credit >= 0) ? 'split' : 'single',
        error: undefined,
      })
    } catch (err) {
      setImporting({ ...importing, fileName: file.name, rows: [], error: err instanceof Error ? err.message : 'Could not read the file.' })
    } finally { setBusy(false) }
  }

  /** Statement rows converted with the current column mapping. */
  const mappedRows = useMemo(() => {
    if (!importing || !importing.rows.length) return []
    const body = importing.headerRow ? importing.rows.slice(1) : importing.rows
    const m = importing.map
    const at = (r: SheetRow, i: number) => (i >= 0 ? (r[i] ?? '') : '')
    return body.map((r) => {
      const amount = importing.mode === 'single'
        ? parseStatementAmount(at(r, m.amount))
        : parseStatementAmount(at(r, m.credit)) - parseStatementAmount(at(r, m.debit))
      return {
        date: parseStatementDate(at(r, m.date)),
        description: String(at(r, m.description) || '').trim() || 'Imported statement line',
        reference: String(at(r, m.reference) || '').trim(),
        amount,
      }
    }).filter((r) => r.date && Math.abs(r.amount) >= 0.005)
  }, [importing])

  const runImport = () => {
    if (!importing) return
    const feed = state.feeds.find((f) => f.id === importing.feedId)
    if (!feed) { toast.error('Choose the account to import into.'); return }
    if (!mappedRows.length) { toast.error('Nothing to import', 'Check the column mapping — no dated rows with an amount were found.'); return }
    const existing = state.txns.filter((t) => t.feedId === feed.id)
    let balance = existing.length ? existing[existing.length - 1].balance : 0
    const stamp = Date.now()
    const fresh: FeedTxn[] = mappedRows.map((r, i) => {
      balance = Math.round((balance + r.amount) * 100) / 100
      return {
        id: `ft_up_${feed.id}_${stamp}_${i}`,
        feedId: feed.id,
        date: r.date,
        description: r.description,
        reference: r.reference || `UPLOAD-${String(i + 1).padStart(4, '0')}`,
        amount: r.amount,
        balance,
        status: 'new' as const,
      }
    }).sort((a, b) => a.date.localeCompare(b.date))
    persist({
      feeds: state.feeds.map((f) => (f.id === feed.id ? { ...f, status: 'connected', lastSyncAt: new Date().toISOString() } : f)),
      txns: [...state.txns, ...fresh],
    })
    setActiveFeedId(feed.id)
    setImporting(null)
    log(user?.id || 'system', 'CREATE', 'BankFeed', `Imported ${fresh.length} statement line(s) into ${feed.institutionName} from ${importing.fileName}`)
    toast.success('Statement imported', `${fresh.length} line(s) added to ${feed.institutionName} for review.`)
  }

  // ---------------------------------------------------------------- connect
  const startConnect = () => setConnecting({
    region: 'Africa',
    providerId: FEED_PROVIDERS[0].id,
    countryCode: 'GH',
    institutionId: '',
    accountName: '',
    accountNumber: '',
    ledgerAccountId: ledgerOptions[0]?.id || '',
    frequency: 'daily',
  })

  const providersForCountry = (code: string) => FEED_PROVIDERS.filter((p) => p.countries.includes(code))
  /**
   * Provider directory grouped by region — African providers first, then each
   * other region, with the multi-region aggregators collected under "Global".
   */
  const providerGroups = useMemo(() => {
    const regionsOf = (p: typeof FEED_PROVIDERS[number]) => new Set(p.countries.map(feedRegionOf))
    const global = FEED_PROVIDERS.filter((p) => regionsOf(p).size >= 4)
    const regional = FEED_PROVIDERS.filter((p) => regionsOf(p).size < 4)
    const groups = FEED_REGIONS.map((region) => {
      const regionProviders = regional.filter((p) => regionsOf(p).has(region))
      const counts = `${FEED_COUNTRIES.filter((c) => c.region === region).length} countries · ${FEED_INSTITUTIONS.filter((i) => feedRegionOf(i.countryCode) === region).length} institutions`
      return {
        title: region,
        // Regions without a dedicated aggregator are still reachable through
        // the multi-region providers listed at the bottom.
        note: regionProviders.length ? counts : `${counts} · served by the global aggregators below`,
        providers: regionProviders.length ? regionProviders : global.filter((p) => regionsOf(p).has(region)),
      }
    }).filter((g) => g.providers.length > 0)
    return global.length
      ? [...groups, { title: 'Global (multi-region)', note: 'Cover four or more regions', providers: global }]
      : groups
  }, [])
  const countriesInRegion = (region: FeedRegion) => FEED_COUNTRIES.filter((c) => c.region === region)
  const institutionsFor = (code: string, providerId: string) => {
    const provider = FEED_PROVIDERS.find((p) => p.id === providerId)
    return FEED_INSTITUTIONS.filter((i) => i.countryCode === code && (!provider || provider.kinds.includes(i.kind)))
  }

  const saveConnection = () => {
    if (!connecting) return
    const inst = FEED_INSTITUTIONS.find((i) => i.id === connecting.institutionId)
    if (!inst) { toast.error('Choose the bank or wallet to link.'); return }
    if (!connecting.accountNumber.trim()) { toast.error('Enter the account or wallet number.'); return }
    if (!connecting.ledgerAccountId) { toast.error('Choose the chart-of-accounts account to post to.'); return }
    const feed: BankFeed = {
      id: uid('bf'),
      providerId: connecting.providerId,
      institutionId: inst.id,
      institutionName: inst.name,
      countryCode: connecting.countryCode,
      accountName: connecting.accountName.trim() || inst.name,
      accountMask: `••••${connecting.accountNumber.trim().slice(-4)}`,
      currency: FEED_COUNTRIES.find((c) => c.code === connecting.countryCode)?.currency || 'GHS',
      ledgerAccountId: connecting.ledgerAccountId,
      status: 'connected',
      frequency: connecting.frequency,
      createdAt: new Date().toISOString(),
    }
    persist({ ...state, feeds: [...state.feeds, feed] })
    setActiveFeedId(feed.id)
    setConnecting(null)
    log(user?.id || 'system', 'CREATE', 'BankFeed', `Linked ${inst.name} ${feed.accountMask} via ${FEED_PROVIDERS.find((p) => p.id === feed.providerId)?.name}`)
    toast.success('Account linked (demo)', `${inst.name} ${feed.accountMask} is set up. Sync produces sample lines; upload a statement for your real transactions.`)
  }

  // ------------------------------------------------------------------- sync
  /** Pull the provider's real statement lines for a feed that is already mapped. */
  const syncLive = async (feed: BankFeed, cred: ProviderCreds) => {
    const account = feed.externalAccountId || cred.values.accountId || ''
    try {
      const rows = await fetchProviderTransactions(cred, account, syncFrom, syncTo)
      const existing = state.txns.filter((t) => t.feedId === feed.id)
      let balance = existing.length ? existing[existing.length - 1].balance : 0
      const fresh: FeedTxn[] = rows
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r, i) => {
          balance = Math.round((balance + r.amount) * 100) / 100
          return {
            id: `ft_live_${feed.id}_${r.reference || `${r.date}_${i}`}`,
            feedId: feed.id,
            date: r.date,
            description: r.description,
            reference: r.reference || `${feed.providerId.toUpperCase()}-${i + 1}`,
            amount: r.amount,
            balance,
            status: 'new' as const,
          }
        })
        .filter((t) => !existing.some((e) => e.id === t.id))
      persist({
        feeds: state.feeds.map((f) => (f.id === feed.id ? { ...f, live: true, status: 'connected', lastSyncAt: new Date().toISOString() } : f)),
        txns: [...state.txns, ...fresh],
      })
      toast.success('Live sync complete', `${fresh.length} new transaction(s) from ${feed.institutionName}.`)
      log(user?.id || 'system', 'UPDATE', 'BankFeed', `Live sync pulled ${fresh.length} line(s) for ${feed.institutionName}`)
    } catch (err) {
      toast.error('Live sync failed', err instanceof Error ? err.message : 'The provider rejected the request.')
    }
  }

  const syncFeed = (feed: BankFeed) => {
    // A verified provider with a mapped account means real data; otherwise the
    // sample generator runs and the feed stays flagged as demo.
    const cred = creds[feed.providerId]
    if (cred?.verifiedAt && (feed.externalAccountId || cred.values.accountId)) {
      void syncLive(feed, cred)
      return
    }
    const existing = state.txns.filter((t) => t.feedId === feed.id)
    const opening = existing.length ? existing[existing.length - 1].balance : 0
    const fresh = fetchFeedTransactions(feed, syncFrom, syncTo, opening)
      .filter((t) => !existing.some((e) => e.id === t.id))
    const next: FeedState = {
      feeds: state.feeds.map((f) => (f.id === feed.id ? { ...f, status: 'connected', lastSyncAt: new Date().toISOString() } : f)),
      txns: [...state.txns, ...fresh],
    }
    persist(next)
    log(user?.id || 'system', 'UPDATE', 'BankFeed', `Synced ${feed.institutionName} ${feed.accountMask} — ${fresh.length} new line(s)`)
    toast.success('Demo feed synced', `${fresh.length} sample line(s) generated for ${feed.institutionName}. Upload a statement for real figures.`)
  }

  const disconnect = (feed: BankFeed) => {
    persist({ feeds: state.feeds.filter((f) => f.id !== feed.id), txns: state.txns.filter((t) => t.feedId !== feed.id) })
    setDisconnecting(null)
    log(user?.id || 'system', 'DELETE', 'BankFeed', `Disconnected ${feed.institutionName} ${feed.accountMask}`)
    toast.success('Feed disconnected', `${feed.institutionName} ${feed.accountMask} was removed.`)
  }

  // ------------------------------------------------------- matching + rules
  const rules = state.rules ?? []
  const [rulesOpen, setRulesOpen] = useState(false)
  const [ruleDraft, setRuleDraft] = useState<FeedRule | null>(null)

  const saveRule = (rule: FeedRule) => {
    const next = rules.some((r) => r.id === rule.id) ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]
    persist({ ...state, rules: next })
    setRuleDraft(null)
  }
  const deleteRule = (id: string) => persist({ ...state, rules: rules.filter((r) => r.id !== id) })

  /** Account a line should post to: manual pick → saved rule → nothing. */
  const categoryFor = (txn: FeedTxn) =>
    postTo[txn.id] || txn.suggestedAccountId || matchRule(rules, txn.description, txn.amount)?.accountId || ''

  /**
   * An existing voucher that looks like this bank line: same direction, same
   * amount to the cent, posted within five days and not already linked.
   */
  const findMatch = (feed: BankFeed, txn: FeedTxn) => {
    const linked = new Set(state.txns.filter((t) => t.voucherNo && t.id !== txn.id).map((t) => t.voucherNo))
    const near = (d: string) => Math.abs(new Date(`${d}T00:00:00`).getTime() - new Date(`${txn.date}T00:00:00`).getTime()) <= 5 * 86400000
    const amount = Math.abs(txn.amount)
    const same = (v: number) => Math.abs(Math.abs(v) - amount) < 0.005
    if (txn.amount >= 0) {
      const hit = receipts.find((r) => r.depositAccountId === feed.ledgerAccountId && same(r.amount) && near(r.date) && !linked.has(r.number))
      return hit ? { number: hit.number, kind: 'Receipt' as const, date: hit.date, party: hit.receivedFrom || '—' } : null
    }
    const hit = paymentVouchers.find((pv) => pv.paymentAccountId === feed.ledgerAccountId && same(pv.amount) && near(pv.date) && !linked.has(pv.number))
    return hit ? { number: hit.number, kind: 'Payment' as const, date: hit.date, party: hit.paidTo || '—' } : null
  }

  /** Link the line to the voucher that already exists — no new posting. */
  const matchTxn = (feed: BankFeed, txn: FeedTxn) => {
    const hit = findMatch(feed, txn)
    if (!hit) { toast.error('No match found', 'No existing voucher matches this amount and date.'); return }
    persist({ ...state, txns: state.txns.map((t) => (t.id === txn.id ? { ...t, status: 'accepted', voucherNo: hit.number, matched: true } : t)) })
    log(user?.id || 'system', 'UPDATE', 'BankFeed', `Matched feed line ${txn.reference} to ${hit.number}`)
    toast.success('Matched to an existing voucher', `${hit.number} — ${hit.party}. Nothing new was posted.`)
  }

  // ------------------------------------------------------- accept / exclude
  const acceptTxn = (feed: BankFeed, txn: FeedTxn) => {
    const categoryId = categoryFor(txn) || categoryOptions[0]?.id
    if (!categoryId) { toast.error('Choose the category account first.'); return }
    const amount = Math.abs(txn.amount)
    const stamp = new Date().toISOString()
    let voucherNo = ''
    if (txn.amount >= 0) {
      voucherNo = nextNumber('RV', receipts)
      upsertReceipt({
        id: uid('rv'), number: voucherNo, date: txn.date,
        receivedFrom: feed.institutionName, stakeholderClass: 'customer',
        depositAccountId: feed.ledgerAccountId,
        lines: [{ accountId: categoryId, narration: txn.description, amount }],
        amount, method: 'bank', referenceNo: txn.reference, currency: 'GHS',
        description: `Bank feed — ${txn.description}`, status: 'posted',
        createdBy: user?.id, createdAt: stamp,
      })
    } else {
      voucherNo = nextNumber('PV', paymentVouchers)
      upsertPaymentVoucher({
        id: uid('pv'), number: voucherNo, date: txn.date,
        paidTo: feed.institutionName, stakeholderClass: 'supplier',
        paymentAccountId: feed.ledgerAccountId,
        lines: [{ accountId: categoryId, narration: txn.description, amount }],
        amount, method: 'bank', referenceNo: txn.reference, currency: 'GHS',
        description: `Bank feed — ${txn.description}`, status: 'posted',
        createdBy: user?.id, createdAt: stamp,
      })
    }
    persist({ ...state, txns: state.txns.map((t) => (t.id === txn.id ? { ...t, status: 'accepted', voucherNo, suggestedAccountId: categoryId } : t)) })
    log(user?.id || 'system', 'CREATE', 'BankFeed', `Added feed line ${txn.reference} as ${voucherNo}`)
    toast.success('Added to the books', `${voucherNo} — ${formatGhsExact(amount)}`)
  }

  const excludeTxn = (txn: FeedTxn) =>
    persist({ ...state, txns: state.txns.map((t) => (t.id === txn.id ? { ...t, status: 'excluded' } : t)) })

  const restoreTxn = (txn: FeedTxn) =>
    persist({ ...state, txns: state.txns.map((t) => (t.id === txn.id ? { ...t, status: 'new', voucherNo: undefined } : t)) })

  const acceptAllNew = (feed: BankFeed) => {
    const list = state.txns.filter((t) => t.feedId === feed.id && t.status === 'new')
    if (!list.length) { toast.error('Nothing to add', 'There are no new lines in this feed.'); return }
    list.forEach((t) => acceptTxn(feed, t))
  }

  // ------------------------------------------------------------------- view
  const feedTxns = useMemo(() => {
    if (!activeFeed) return []
    const ql = q.trim().toLowerCase()
    return state.txns
      .filter((t) => t.feedId === activeFeed.id)
      .filter((t) => txnFilter === 'all' || t.status === txnFilter)
      .filter((t) => !ql || `${t.description} ${t.reference}`.toLowerCase().includes(ql))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [state.txns, activeFeed, txnFilter, q])

  const counts = (feedId: string) => ({
    neu: state.txns.filter((t) => t.feedId === feedId && t.status === 'new').length,
    accepted: state.txns.filter((t) => t.feedId === feedId && t.status === 'accepted').length,
    excluded: state.txns.filter((t) => t.feedId === feedId && t.status === 'excluded').length,
  })

  const columns: Column<FeedTxn>[] = [
    { key: 'date', header: 'Date', sortValue: (t) => t.date, render: (t) => <span className="whitespace-nowrap">{t.date}</span> },
    { key: 'description', header: 'Bank description', render: (t) => (<div><div className="font-semibold">{t.description}</div><div className="text-[11px] text-mist">{t.reference}</div></div>) },
    {
      key: 'amount', header: 'Amount', align: 'right', sortValue: (t) => t.amount,
      render: (t) => <span className={`font-semibold tabular-nums ${t.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{t.amount < 0 ? `(${formatGhsExact(-t.amount)})` : formatGhsExact(t.amount)}</span>,
    },
    { key: 'balance', header: 'Balance', align: 'right', render: (t) => <span className="tabular-nums text-mist">{formatGhsExact(t.balance)}</span> },
    {
      key: 'category', header: 'Category',
      render: (t) => (t.status === 'new' ? (
        <Select
          value={categoryFor(t)}
          onChange={(e) => setPostTo((m) => ({ ...m, [t.id]: e.target.value }))}
          placeholder="Choose account"
          disabled={!canManage}
        >
          <option value="">Choose account</option>
          {categoryOptions.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </Select>
      ) : (
        <span className="text-mist">{t.suggestedAccountId ? accountLabel(accounts.find((a) => a.id === t.suggestedAccountId)!) : '—'}</span>
      )),
    },
    {
      key: 'status', header: 'Status', align: 'center',
      render: (t) => (t.status === 'accepted'
        ? <Badge tone="lime">{t.matched ? 'Matched' : 'Added'} {t.voucherNo}</Badge>
        : t.status === 'excluded' ? <Badge tone="zinc">Excluded</Badge> : <Badge tone="amber">For review</Badge>),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (t) => (canManage ? (
        <div className="flex justify-end gap-1.5">
          {t.status === 'new' ? (
            <>
              {activeFeed && findMatch(activeFeed, t) && (
                <Button
                  variant="ghost"
                  onClick={() => activeFeed && matchTxn(activeFeed, t)}
                  title={`Link to existing voucher ${findMatch(activeFeed, t)?.number}`}
                >
                  <Link2 className="size-4" /> Match {findMatch(activeFeed, t)?.number}
                </Button>
              )}
              <Button variant="ghost" onClick={() => activeFeed && acceptTxn(activeFeed, t)} title="Add to the books"><CheckCircle2 className="size-4" /> Add</Button>
              <Button variant="ghost" onClick={() => excludeTxn(t)} title="Exclude this line"><XCircle className="size-4" /></Button>
            </>
          ) : (
            <Button variant="ghost" onClick={() => restoreTxn(t)} title="Send back to review">Undo</Button>
          )}
        </div>
      ) : null),
    },
  ]

  return (
    <div>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-mist">
            Connect African and international bank or mobile-money accounts, pull transactions in automatically, then add them to your books.
          </p>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setLiveOpen(true)}><Link2 className="size-4" /> Live API keys</Button>
              <Button variant="ghost" onClick={() => { setMomoFeedId(state.feeds.find((f) => f.providerId === 'momo')?.id || ''); setMomoOpen(true) }}><Smartphone className="size-4" /> MTN MoMo API</Button>
              <Button variant="ghost" onClick={() => openImport(state.feeds[0]?.id || '')}><Upload className="size-4" /> Upload statement</Button>
              <Button onClick={startConnect}><Link2 className="size-4" /> Connect a bank</Button>
            </div>
          )}
        </div>
      ) : (
        <PageHeader
          title="Bank Feed"
          desc="Connect African and international bank and mobile-money accounts, pull transactions in automatically, then add them to your books."
          actions={canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => setLiveOpen(true)}><Link2 className="size-4" /> Live API keys</Button>
              <Button variant="ghost" onClick={() => { setMomoFeedId(state.feeds.find((f) => f.providerId === 'momo')?.id || ''); setMomoOpen(true) }}><Smartphone className="size-4" /> MTN MoMo API</Button>
              <Button variant="ghost" onClick={() => openImport(state.feeds[0]?.id || '')}><Upload className="size-4" /> Upload statement</Button>
              <Button onClick={startConnect}><Link2 className="size-4" /> Connect a bank</Button>
            </div>
          ) : undefined}
        />
      )}

      {/* ---------------- connected feeds ---------------- */}
      {state.feeds.length === 0 ? (
        <div className="card p-6">
          <Empty
            title="No bank connected yet"
            desc="Link an account through Mono, Okra, Stitch, Pngme, MTN MoMo, Flutterwave or Paystack to pull your statement lines automatically."
          />
          <div className="mt-6 space-y-6">
            <div className="text-[11px] font-bold uppercase tracking-wider text-mist">
              Available providers — {FEED_PROVIDERS.length} aggregators covering {FEED_COUNTRIES.length} countries and {FEED_INSTITUTIONS.length} institutions worldwide
            </div>
            {providerGroups.map((g) => (
              <div key={g.title}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink dark:text-white">{g.title}</h3>
                  <Badge tone="zinc">{g.providers.length}</Badge>
                  <span className="text-[11px] text-mist">{g.note}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {g.providers.map((p) => (
                    <div key={p.id} className="rounded-lg border border-line p-3">
                      <div className="text-sm font-bold text-ink dark:text-white">{p.name}</div>
                      <div className="mt-1 text-[11px] text-mist">{p.blurb}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.countries.map((c) => <Badge key={c} tone="sky" tip={feedCountryName(c)}>{c}</Badge>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {state.feeds.map((f) => {
              const c = counts(f.id)
              const provider = FEED_PROVIDERS.find((p) => p.id === f.providerId)
              const inst = FEED_INSTITUTIONS.find((i) => i.id === f.institutionId)
              const active = activeFeed?.id === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFeedId(f.id)}
                  className={`cursor-pointer rounded-lg border p-4 text-left transition ${active ? 'border-[#2e75b6] bg-[#2e75b6]/[0.06]' : 'border-line hover:bg-black/[0.02] dark:hover:bg-white/[0.04]'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {inst?.kind === 'momo' ? <Smartphone className="size-4 text-mist" /> : <Landmark className="size-4 text-mist" />}
                      <span className="text-sm font-bold text-ink dark:text-white">{f.institutionName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {/* Live feeds talk to the provider API; the rest are samples. */}
                      {f.live
                        ? <Badge tone="lime" tip="Live provider API — figures come from the bank/wallet">Live API</Badge>
                        : <Badge tone="amber" tip="Simulated connection — statement lines are generated samples, not live bank data">Demo data</Badge>}
                      <Badge tone={f.status === 'connected' ? 'lime' : f.status === 'needs_attention' ? 'amber' : 'rose'}>
                        {f.status === 'connected' ? 'Connected' : f.status === 'needs_attention' ? 'Needs attention' : 'Disconnected'}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-mist">
                    {f.accountName} · {f.accountMask} · {f.currency} · {feedCountryName(f.countryCode)}
                  </div>
                  <div className="mt-1 text-[11px] text-mist">
                    via {provider?.name} · posts to {accountLabel(accounts.find((a) => a.id === f.ledgerAccountId)!)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={c.neu ? 'amber' : 'zinc'}>{c.neu} for review</Badge>
                    <Badge tone="lime">{c.accepted} added</Badge>
                    {c.excluded > 0 && <Badge tone="zinc">{c.excluded} excluded</Badge>}
                  </div>
                  {f.externalAccountId && (
                    <div className="mt-1 text-[11px] text-mist">Provider account {f.externalAccountId}</div>
                  )}
                  {f.liveBalance && (
                    <div className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Live balance {f.liveBalance.amount} {f.liveBalance.currency} · read {new Date(f.liveBalance.fetchedAt).toLocaleString()}
                    </div>
                  )}
                  <div className="mt-2 text-[11px] text-mist">
                    {f.lastSyncAt ? `Last sync ${new Date(f.lastSyncAt).toLocaleString()}` : 'Never synced'} · {f.frequency === 'manual' ? 'Manual refresh' : f.frequency === 'hourly' ? 'Hourly refresh' : 'Daily refresh'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* ---------------- transactions for the selected feed ---------------- */}
          {activeFeed && (
            <div className="card p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#2e75b6] dark:text-sky-300">{activeFeed.institutionName} {activeFeed.accountMask}</h2>
                  <p className="text-xs text-mist">Statement lines pulled by {FEED_PROVIDERS.find((p) => p.id === activeFeed.providerId)?.name}. Add a line to post it, or exclude it to leave it out of the books.</p>
                  {creds[activeFeed.providerId]?.verifiedAt && (activeFeed.externalAccountId || creds[activeFeed.providerId]?.values.accountId) ? (
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="mt-px size-3.5 shrink-0" />
                      Live connection verified — Sync pulls real transactions from {PROVIDER_APIS.find((p) => p.id === activeFeed.providerId)?.label || activeFeed.providerId}.
                    </p>
                  ) : (
                    <p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="mt-px size-3.5 shrink-0" />
                      No verified API keys for this provider yet — Sync generates sample lines. Add keys under “Live API keys”, or use “Upload statement”.
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-40"><Field label="Sync from"><DatePicker value={syncFrom} onChange={setSyncFrom} max={syncTo} /></Field></div>
                    <div className="w-40"><Field label="Sync to"><DatePicker value={syncTo} onChange={setSyncTo} min={syncFrom} /></Field></div>
                    <Button onClick={() => syncFeed(activeFeed)}>
                      <RefreshCw className="size-4" />
                      {creds[activeFeed.providerId]?.verifiedAt && (activeFeed.externalAccountId || creds[activeFeed.providerId]?.values.accountId) ? 'Sync now (live)' : 'Sync now (demo)'}
                    </Button>
                    <Button variant="ghost" onClick={() => openImport(activeFeed.id)}><Upload className="size-4" /> Upload statement</Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setLiveProvider(activeFeed.providerId === 'momo' ? 'mono' : activeFeed.providerId)
                        setLiveFeedId(activeFeed.id)
                        setLiveOpen(true)
                      }}
                    >
                      <Link2 className="size-4" /> Live pull
                    </Button>
                    <Button variant="ghost" onClick={() => acceptAllNew(activeFeed)}><CheckCircle2 className="size-4" /> Add all</Button>
                    <Button variant="ghost" onClick={() => setRulesOpen(true)}><Settings2 className="size-4" /> Rules ({rules.length})</Button>
                    <Button variant="ghost" onClick={() => setDisconnecting(activeFeed)}><Trash2 className="size-4" /> Disconnect</Button>
                  </div>
                )}
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(['new', 'accepted', 'excluded', 'all'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTxnFilter(k)}
                    className={`inline-flex h-9 cursor-pointer items-center rounded-md px-4 text-sm font-semibold transition ${txnFilter === k ? 'bg-[#2e75b6] text-white' : 'border border-line text-mist hover:text-inherit'}`}
                  >
                    {k === 'new' ? 'For review' : k === 'accepted' ? 'Added' : k === 'excluded' ? 'Excluded' : 'All'}
                  </button>
                ))}
                <div className="min-w-[200px] flex-1"><SearchField value={q} onChange={setQ} placeholder="Search description or reference…" /></div>
                {feedTxns.length > 0 && (
                  <ExportButtons
                    filename={`bank-feed-${activeFeed.institutionName.toLowerCase().replace(/\s+/g, '-')}`}
                    rows={feedTxns.map((t) => ({
                      Date: t.date, Description: t.description, Reference: t.reference,
                      Amount: t.amount, Balance: t.balance, Status: t.status, Voucher: t.voucherNo || '',
                    }))}
                    compact
                  />
                )}
              </div>

              {feedTxns.length ? (
                <DataTable data={feedTxns} columns={columns} rowKey={(t) => t.id} pageSize={15} />
              ) : (
                <Empty
                  title={txnFilter === 'new' ? 'Nothing waiting for review' : 'No transactions'}
                  desc={state.txns.some((t) => t.feedId === activeFeed.id) ? 'Switch the tab or widen the search to see other lines.' : 'Choose a date range and click Sync now to pull statement lines.'}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* ---------------- connect modal ---------------- */}
      <Modal open={!!connecting} onClose={() => setConnecting(null)} title="Connect a bank or wallet">
        {connecting && (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Region" required>
                <Select
                  value={connecting.region}
                  onChange={(e) => {
                    const region = e.target.value as FeedRegion
                    const code = countriesInRegion(region)[0]?.code || 'GH'
                    setConnecting({
                      ...connecting,
                      region,
                      countryCode: code,
                      providerId: providersForCountry(code)[0]?.id || FEED_PROVIDERS[0].id,
                      institutionId: '',
                    })
                  }}
                >
                  {FEED_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <Field label="Country" required>
                <Select
                  value={connecting.countryCode}
                  onChange={(e) => {
                    const code = e.target.value
                    const provider = providersForCountry(code)[0]?.id || FEED_PROVIDERS[0].id
                    setConnecting({ ...connecting, countryCode: code, region: feedRegionOf(code), providerId: provider, institutionId: '' })
                  }}
                >
                  {countriesInRegion(connecting.region).map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Provider" required>
              <Select
                value={connecting.providerId}
                onChange={(e) => setConnecting({ ...connecting, providerId: e.target.value, institutionId: '' })}
              >
                {providersForCountry(connecting.countryCode).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <p className="rounded-lg bg-black/5 px-3 py-2 text-[12px] text-mist dark:bg-white/5">
              {FEED_PROVIDERS.find((p) => p.id === connecting.providerId)?.blurb}
            </p>
            <Field label="Bank / wallet" required>
              <Select
                value={connecting.institutionId}
                onChange={(e) => {
                  const inst = FEED_INSTITUTIONS.find((i) => i.id === e.target.value)
                  setConnecting({
                    ...connecting,
                    institutionId: e.target.value,
                    // Pre-map to the matching chart bank account when there is one.
                    ledgerAccountId: inst ? guessLedgerAccount(inst.name) : connecting.ledgerAccountId,
                  })
                }}
                placeholder="Select institution"
              >
                <option value="">Select institution</option>
                {institutionsFor(connecting.countryCode, connecting.providerId).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Account name">
                <Input value={connecting.accountName} onChange={(e) => setConnecting({ ...connecting, accountName: e.target.value })} placeholder="Business current account" />
              </Field>
              <Field label="Account / wallet number" required>
                <Input value={connecting.accountNumber} onChange={(e) => setConnecting({ ...connecting, accountNumber: e.target.value })} placeholder="e.g. 1441000123456" />
              </Field>
            </div>
            <Field label="Post transactions to" required>
              <Select value={connecting.ledgerAccountId} onChange={(e) => setConnecting({ ...connecting, ledgerAccountId: e.target.value })}>
                {ledgerOptions.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
              </Select>
            </Field>
            <Field label="Refresh">
              <Select value={connecting.frequency} onChange={(e) => setConnecting({ ...connecting, frequency: e.target.value as BankFeed['frequency'] })}>
                <option value="daily">Daily</option>
                <option value="hourly">Hourly</option>
                <option value="manual">Manual only</option>
              </Select>
            </Field>
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span><b>Demo connection.</b> No credentials leave this browser and no bank is contacted — synced lines are generated samples, not your real balance. For real figures, export the statement from your bank or MoMo portal and use <b>Upload statement</b>. Live links need the provider&apos;s API keys and a server-side callback.</span>
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveConnection}><Link2 className="size-4" /> Connect</Button>
              <Button variant="ghost" onClick={() => setConnecting(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- banking rules ---------------- */}
      <Modal open={rulesOpen} onClose={() => { setRulesOpen(false); setRuleDraft(null) }} title="Banking rules" wide>
        <div className="grid gap-3">
          <p className="text-[12px] text-mist">
            A rule pre-selects the posting account for any new statement line whose description contains your keyword —
            so recurring items like “bank charges” or “payroll” are categorised before you even look at them.
          </p>

          {rules.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#2e75b6] text-left text-[10px] font-bold uppercase tracking-wider text-white">
                    <th className="px-3 py-2">When description contains</th>
                    <th className="px-3 py-2">Applies to</th>
                    <th className="px-3 py-2">Post to</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-semibold">{r.contains}</td>
                      <td className="px-3 py-2">{r.direction === 'in' ? 'Money in' : r.direction === 'out' ? 'Money out' : 'Any'}</td>
                      <td className="px-3 py-2">{accounts.find((a) => a.id === r.accountId) ? accountLabel(accounts.find((a) => a.id === r.accountId)!) : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" onClick={() => setRuleDraft(r)}>Edit</Button>
                        <Button variant="ghost" onClick={() => deleteRule(r.id)}><Trash2 className="size-4" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-line px-3 py-2 text-[12px] text-mist">No rules yet.</p>
          )}

          {ruleDraft ? (
            <div className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-3">
              <Field label="Description contains" required>
                <Input value={ruleDraft.contains} onChange={(e) => setRuleDraft({ ...ruleDraft, contains: e.target.value })} placeholder="bank charges" />
              </Field>
              <Field label="Applies to">
                <Select value={ruleDraft.direction} onChange={(e) => setRuleDraft({ ...ruleDraft, direction: e.target.value as FeedRule['direction'] })}>
                  <option value="any">Any line</option>
                  <option value="in">Money in only</option>
                  <option value="out">Money out only</option>
                </Select>
              </Field>
              <Field label="Post to" required>
                <Select value={ruleDraft.accountId} onChange={(e) => setRuleDraft({ ...ruleDraft, accountId: e.target.value })} placeholder="Choose account">
                  <option value="">Choose account</option>
                  {categoryOptions.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </Select>
              </Field>
              <div className="flex gap-2 sm:col-span-3">
                <Button onClick={() => ruleDraft.contains.trim() && ruleDraft.accountId && saveRule(ruleDraft)}>Save rule</Button>
                <Button variant="ghost" onClick={() => setRuleDraft(null)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div>
              <Button onClick={() => setRuleDraft({ id: uid('rule'), contains: '', direction: 'any', accountId: '', createdAt: new Date().toISOString() })}>
                + New rule
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setRulesOpen(false); setRuleDraft(null) }}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- live API keys for every provider ---------------- */}
      <Modal open={liveOpen} onClose={() => { setLiveOpen(false); setLiveMsg(null) }} title="Live provider connections" wide>
        <div className="grid gap-3">
          <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[12px] text-sky-800 dark:text-sky-300">
            Each provider is called through a same-origin proxy (<code className="px-1">/api-…</code>) so there is no CORS problem.
            Enter the keys from the provider&apos;s dashboard, press <b>Test connection</b> to list your accounts, then
            <b> Pull transactions</b> into a feed. Keys stay in this browser — move them to your own gateway before going live.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Provider" required>
              <Select
                value={liveProvider}
                onChange={(e) => { setLiveProvider(e.target.value); setLiveAccounts([]); setLiveAccount(''); setLiveMsg(null) }}
              >
                {PROVIDER_APIS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Field label="Environment" required>
              <Select
                value={liveCred.env}
                onChange={(e) => {
                  const env = e.target.value as 'sandbox' | 'live'
                  persistCreds({ ...liveCred, env, baseUrl: env === 'live' ? (liveSpec?.proxy.live || '') : (liveSpec?.proxy.sandbox || '') })
                }}
              >
                <option value="sandbox">Sandbox / test</option>
                <option value="live">Live / production</option>
              </Select>
            </Field>
            <Field label="Base URL (proxy or gateway)" required>
              <Input value={liveCred.baseUrl} onChange={(e) => persistCreds({ ...liveCred, baseUrl: e.target.value })} />
            </Field>
          </div>

          <p className="text-[11px] text-mist">
            Upstream host: <code className="px-1">{liveCred.env === 'live' ? liveSpec?.hosts.live : liveSpec?.hosts.sandbox}</code>
            {liveSpec?.docs ? <> · docs <code className="px-1">{liveSpec.docs}</code></> : null}
            {liveSpec?.notes ? <> · {liveSpec.notes}</> : null}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {(liveSpec?.fields || []).map((f) => (
              <Field key={f.key} label={`${f.label}${f.optional ? '' : ' *'}`}>
                <Input
                  type={f.secret ? 'password' : 'text'}
                  value={liveCred.values[f.key] || ''}
                  onChange={(e) => persistCreds({ ...liveCred, values: { ...liveCred.values, [f.key]: e.target.value } })}
                  placeholder={f.placeholder || f.label}
                />
              </Field>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void testLive()} disabled={liveBusy}><RefreshCw className="size-4" /> Test connection</Button>
            <Button variant="ghost" onClick={() => { const all = { ...creds }; delete all[liveProvider]; setCreds(all); saveProviderCreds(all); setLiveMsg({ ok: true, text: `${liveSpec?.label} keys cleared from this browser.` }) }}>
              <Trash2 className="size-4" /> Forget keys
            </Button>
            {liveCred.verifiedAt && <span className="self-center text-[11px] text-emerald-700 dark:text-emerald-300">Last verified {new Date(liveCred.verifiedAt).toLocaleString()}</span>}
          </div>

          {liveMsg && (
            <p className={`rounded-lg px-3 py-2 text-[12px] ${liveMsg.ok ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
              {liveMsg.text}
            </p>
          )}

          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Pull transactions into a feed</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Provider account">
                <Select value={liveAccount} onChange={(e) => setLiveAccount(e.target.value)} placeholder="Run Test connection first">
                  <option value="">{liveAccounts.length ? 'Select account' : 'Run Test connection first'}</option>
                  {liveAccounts.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.id}</option>)}
                </Select>
              </Field>
              <Field label="Into feed">
                <Select value={liveFeedId} onChange={(e) => setLiveFeedId(e.target.value)} placeholder="Select a feed">
                  <option value="">Select a feed</option>
                  {state.feeds.map((f) => <option key={f.id} value={f.id}>{f.institutionName} {f.accountMask}</option>)}
                </Select>
              </Field>
              <Field label="From date"><DatePicker value={syncFrom} onChange={setSyncFrom} max={syncTo} /></Field>
              <Field label="To date"><DatePicker value={syncTo} onChange={setSyncTo} min={syncFrom} /></Field>
            </div>
            <div className="mt-2">
              <Button onClick={() => void pullLive()} disabled={liveBusy || !liveFeedId}>
                <Upload className="size-4" /> Pull transactions
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Configured providers</div>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_APIS.map((p) => (
                <Badge
                  key={p.id}
                  tone={creds[p.id]?.verifiedAt ? 'lime' : creds[p.id] ? 'amber' : 'zinc'}
                  tip={creds[p.id]?.verifiedAt ? `Verified ${new Date(creds[p.id].verifiedAt as string).toLocaleString()}` : creds[p.id] ? 'Keys saved, not yet verified' : 'No keys saved'}
                >
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setLiveOpen(false); setLiveMsg(null) }}>Close</Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- MTN MoMo Open API (live) ---------------- */}
      <Modal open={momoOpen} onClose={() => { setMomoOpen(false); setMomoResult(null) }} title="MTN MoMo Open API — live connection" wide>
        <div className="grid gap-3">
          <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-[12px] text-sky-800 dark:text-sky-300">
            <b>Base URL is already set to the built-in proxy</b> (<code className="px-1">/momo-api</code> → sandbox,
            <code className="px-1">/momo-live</code> → production). The request leaves from the server, so there is no CORS problem.
            Enter your Collections <b>subscription key</b>, <b>API user</b> and <b>API key</b>, then press
            <b> Test connection</b> to read your real balance. Credentials stay in this browser only — for a deployed app put them
            in your own gateway instead.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Base URL (API or your proxy)" required>
              <Input value={momoCfg.baseUrl} onChange={(e) => saveMomo({ ...momoCfg, baseUrl: e.target.value })} placeholder={MOMO_DEFAULT_BASE} />
            </Field>
            <Field label="Target environment" required>
              <Select
                value={momoCfg.targetEnvironment}
                onChange={(e) => {
                  const env = e.target.value as MomoEnvironment
                  saveMomo({
                    ...momoCfg,
                    targetEnvironment: env,
                    baseUrl: momoCfg.baseUrl === MOMO_DEFAULT_BASE && env !== 'sandbox' ? MOMO_PRODUCTION_BASE
                      : momoCfg.baseUrl === MOMO_PRODUCTION_BASE && env === 'sandbox' ? MOMO_DEFAULT_BASE
                        : momoCfg.baseUrl,
                  })
                }}
              >
                <option value="sandbox">sandbox</option>
                <option value="mtnghana">mtnghana (production)</option>
                <option value="mtnuganda">mtnuganda</option>
                <option value="mtncameroon">mtncameroon</option>
                <option value="mtnivorycoast">mtnivorycoast</option>
                <option value="mtnzambia">mtnzambia</option>
                <option value="mtnrwanda">mtnrwanda</option>
              </Select>
            </Field>
            <Field label="Collections subscription key" required>
              <Input value={momoCfg.subscriptionKey} onChange={(e) => saveMomo({ ...momoCfg, subscriptionKey: e.target.value })} placeholder="Ocp-Apim-Subscription-Key" />
            </Field>
            <Field label="API user (UUID)" required>
              <Input value={momoCfg.apiUser} onChange={(e) => saveMomo({ ...momoCfg, apiUser: e.target.value })} placeholder="00000000-0000-0000-0000-000000000000" />
            </Field>
            <Field label="API key" required>
              <Input value={momoCfg.apiKey} onChange={(e) => saveMomo({ ...momoCfg, apiKey: e.target.value })} placeholder="API key issued for that user" />
            </Field>
            <Field label="Attach to feed">
              <Select value={momoFeedId} onChange={(e) => setMomoFeedId(e.target.value)} placeholder="Select a MoMo feed">
                <option value="">Select a MoMo feed</option>
                {state.feeds.map((f) => <option key={f.id} value={f.id}>{f.institutionName} {f.accountMask}</option>)}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => saveMomo({ ...momoCfg, baseUrl: MOMO_DEV_PROXY_SANDBOX, targetEnvironment: 'sandbox' })}>Use sandbox proxy</Button>
            <Button variant="ghost" onClick={() => saveMomo({ ...momoCfg, baseUrl: MOMO_DEV_PROXY_LIVE, targetEnvironment: 'mtnghana' })}>Use Ghana production proxy</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void testMomo()} disabled={momoBusy || !momoCfg.subscriptionKey || !momoCfg.apiUser || !momoCfg.apiKey}>
              <RefreshCw className="size-4" /> Test connection &amp; read balance
            </Button>
            <Button variant="ghost" onClick={() => void provisionMomo()} disabled={momoBusy || !momoCfg.subscriptionKey || momoCfg.targetEnvironment !== 'sandbox'}>
              Create sandbox API user
            </Button>
          </div>

          {momoResult && (
            <p className={`rounded-lg px-3 py-2 text-[12px] ${momoResult.ok ? 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}>
              {momoResult.text}
            </p>
          )}

          <div className="rounded-lg border border-line p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Pull real transactions</div>
            <p className="mb-2 text-[12px] text-mist">
              The Open API has no “list all transactions” endpoint — it returns the balance, wallet checks and the status of a
              collection by its reference. Import a successful collection below, or use <b>Upload statement</b> for a full MoMo
              Business statement export.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Collection reference id">
                <Input value={momoRef} onChange={(e) => setMomoRef(e.target.value)} placeholder="X-Reference-Id of the request to pay" />
              </Field>
              <Field label="Customer wallet (MSISDN)">
                <Input value={momoMsisdn} onChange={(e) => setMomoMsisdn(e.target.value)} placeholder="233244000000" />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => void pullMomoTransaction()} disabled={momoBusy || !momoRef.trim() || !momoFeedId}>
                <Upload className="size-4" /> Import this collection
              </Button>
              <Button variant="ghost" onClick={() => void checkMomoWallet()} disabled={momoBusy || !momoMsisdn.trim()}>
                Check wallet is active
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setMomoOpen(false); setMomoResult(null) }}>Close</Button>
            <Button variant="ghost" onClick={() => { saveMomoConfig(null); setMomoCfg({ baseUrl: MOMO_DEFAULT_BASE, subscriptionKey: '', apiUser: '', apiKey: '', targetEnvironment: 'sandbox' }); setMomoResult({ ok: true, text: 'Stored credentials cleared from this browser.' }) }}>
              <Trash2 className="size-4" /> Forget credentials
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------- manual statement upload ---------------- */}
      <Modal open={!!importing} onClose={() => setImporting(null)} title="Upload a bank statement" wide>
        {importing && (
          <div className="grid gap-3">
            <Field label="Import into" required>
              <Select value={importing.feedId} onChange={(e) => setImporting({ ...importing, feedId: e.target.value })} placeholder="Select a connected account">
                <option value="">Select a connected account</option>
                {state.feeds.map((f) => <option key={f.id} value={f.id}>{f.institutionName} {f.accountMask}</option>)}
              </Select>
            </Field>
            {state.feeds.length === 0 && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
                Connect a bank first — the imported lines are filed under a connected account.
              </p>
            )}

            <div className="rounded-lg border border-[#2e75b6]/40 bg-[#2e75b6]/[0.06] p-3">
              <div className="mb-1 flex items-center gap-2">
                <Download className="size-4 text-[#2e75b6]" />
                <span className="text-sm font-bold text-ink dark:text-white">Download a template to fill</span>
              </div>
              <p className="mb-2 text-[12px] text-mist">
                Don&apos;t have the right layout? Download one of these, paste your bank&apos;s rows into it and upload it back.
                The importer also reads your bank&apos;s own export — headings like “Value date”, “Narration”,
                “Withdrawal” or “Money in” are recognised automatically.
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                <Button onClick={() => void downloadTemplate('split', 'xlsx')}><Download className="size-4" /> Excel — Debit / Credit</Button>
                <Button variant="ghost" onClick={() => void downloadTemplate('single', 'xlsx')}><Download className="size-4" /> Excel — single Amount</Button>
                <Button variant="ghost" onClick={() => void downloadTemplate('split', 'csv')}><Download className="size-4" /> CSV</Button>
              </div>
              {/* What the file has to look like, shown before anyone downloads. */}
              <div className="overflow-x-auto rounded-md border border-line bg-white dark:bg-transparent">
                <table className="w-full min-w-[520px] text-[11px]">
                  <thead>
                    <tr className="bg-[#2e75b6] text-left font-bold uppercase tracking-wider text-white">
                      <th className="px-2 py-1.5">Date</th>
                      <th className="px-2 py-1.5">Description</th>
                      <th className="px-2 py-1.5">Reference</th>
                      <th className="px-2 py-1.5 text-right">Debit</th>
                      <th className="px-2 py-1.5 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {templateRows('split').map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1">{r.Date}</td>
                        <td className="px-2 py-1">{r.Description}</td>
                        <td className="px-2 py-1">{r.Reference}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.Debit === '' ? '' : r.Debit}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.Credit === '' ? '' : r.Credit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-mist">
                One row per transaction · dates as <code className="px-1">YYYY-MM-DD</code> or <code className="px-1">dd/mm/yyyy</code> ·
                leave the unused money column blank · the single-Amount template uses negatives for money out.
              </p>
            </div>

            <Field label="Statement file (.xlsx or .csv)" required>
              <input
                type="file"
                accept=".xlsx,.csv,.txt,text/csv"
                className="field h-10 w-full cursor-pointer py-1.5 text-sm"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f) }}
              />
            </Field>
            {busy && <p className="text-xs text-mist">Reading {importing.fileName}…</p>}
            {importing.error && (
              <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300">{importing.error}</p>
            )}

            {importing.rows.length > 0 && (
              <>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink dark:text-white">
                  <input
                    type="checkbox"
                    className="size-4 cursor-pointer accent-[#2e75b6]"
                    checked={importing.headerRow}
                    onChange={(e) => setImporting({ ...importing, headerRow: e.target.checked })}
                  />
                  First row contains column headings
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Amount columns">
                    <Select value={importing.mode} onChange={(e) => setImporting({ ...importing, mode: e.target.value as 'single' | 'split' })}>
                      <option value="single">One signed Amount column</option>
                      <option value="split">Separate Debit and Credit columns</option>
                    </Select>
                  </Field>
                  {([
                    ['date', 'Date'],
                    ['description', 'Description'],
                    ['reference', 'Reference'],
                    ...(importing.mode === 'single' ? [['amount', 'Amount']] : [['debit', 'Debit (money out)'], ['credit', 'Credit (money in)']]),
                  ] as [keyof ImportState['map'], string][]).map(([key, label]) => (
                    <Field key={key} label={label}>
                      <Select
                        value={String(importing.map[key])}
                        onChange={(e) => setImporting({ ...importing, map: { ...importing.map, [key]: Number(e.target.value) } })}
                      >
                        <option value="-1">Not in the file</option>
                        {(importing.rows[0] || []).map((h, i) => (
                          <option key={i} value={String(i)}>
                            {importing.headerRow ? (String(h).trim() || `Column ${i + 1}`) : `Column ${i + 1}`}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  ))}
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-mist">
                    Preview — {mappedRows.length} line(s) ready from {importing.headerRow ? importing.rows.length - 1 : importing.rows.length} row(s)
                  </div>
                  <div className="max-h-56 overflow-auto rounded-lg border border-line">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#2e75b6] text-left text-[10px] font-bold uppercase tracking-wider text-white">
                        <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2 text-right">Amount</th></tr>
                      </thead>
                      <tbody className="divide-y divide-line/70">
                        {mappedRows.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-1.5 whitespace-nowrap">{r.date}</td>
                            <td className="px-3 py-1.5">{r.description}</td>
                            <td className="px-3 py-1.5 text-mist">{r.reference || '—'}</td>
                            <td className={`px-3 py-1.5 text-right tabular-nums ${r.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{formatGhsExact(r.amount)}</td>
                          </tr>
                        ))}
                        {!mappedRows.length && (
                          <tr><td colSpan={4} className="px-3 py-4 text-center text-mist">No usable rows — check the Date and Amount column mapping.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={runImport} disabled={!importing.feedId || !mappedRows.length}>
                <Upload className="size-4" /> Import {mappedRows.length || ''} line(s)
              </Button>
              <Button variant="ghost" onClick={() => setImporting(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- disconnect confirm ---------------- */}
      <Modal open={!!disconnecting} onClose={() => setDisconnecting(null)} title="Disconnect this feed?">
        {disconnecting && (
          <>
            <p className="text-sm text-mist">
              Remove the link to <span className="font-semibold text-inherit">{disconnecting.institutionName} {disconnecting.accountMask}</span>?
              Statement lines still waiting for review will be discarded. Vouchers already added to the books are kept.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDisconnecting(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => disconnect(disconnecting)}><Trash2 className="size-4" /> Disconnect</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
