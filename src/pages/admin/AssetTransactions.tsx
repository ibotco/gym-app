import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Pencil, Trash2, ArrowLeftRight, Wrench, PlusCircle, ArrowDownUp, UserCheck, Archive, FileX, SlidersHorizontal, Landmark } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty, SearchField, DatePicker } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { ASSET_TRANSACTION_TYPES } from '../../lib/assetTransactions'
import { accumulatedDepreciationTo, netBookValueTo } from '../../lib/assets'
import { assetLocationPath, loadAssetLocations } from '../../lib/assetLocations'
import { DEFAULT_AUTO_MAPPING_LINES, mappingLink } from '../../lib/accounting'
import type { AssetTransaction, AssetTransactionType, JournalLine, JournalVoucher } from '../../types'

/** Page tabs — Asset Transactions covers Asset Disposal, Asset Write-off and Asset Transfer. */
const TX_TABS: { id: AssetTransactionType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'dispose', label: 'Asset Disposal' },
  { id: 'write_off', label: 'Asset Write-off' },
  { id: 'transfer', label: 'Asset Transfer' },
]

const DISPOSAL_METHODS = ['Sold', 'Scrapped', 'Donated', 'Lost / stolen', 'Other']

/** Asset Transactions covers exactly these three ledger transaction types. */
const TX_TYPES: AssetTransactionType[] = ['dispose', 'write_off', 'transfer']

/** Accounting-mapping key that drives each ledger-posted transaction type. */
const MAPPING_KEY: Partial<Record<AssetTransactionType, string>> = {
  dispose: 'fixedequip.disposal',
  write_off: 'fixedequip.writeoff',
}
/** Fallback accounts when the asset has no GL mapping of its own. */
const FALLBACK_ACCUM_ACCOUNT = 'ac_5' // Accumulated depreciation on PP&E
const GAIN_LOSS_ACCOUNT = 'ac_43' // Loss on disposal of assets (other income — gains credit it)

type FormState = {
  id?: string
  assetId: string
  type: AssetTransactionType
  date: string
  from: string
  to: string
  amount: string
  reason: string
  ledgerAccountId: string
  performedBy: string
  notes: string
}

const TYPE_ICONS: Record<AssetTransactionType, typeof ArrowLeftRight> = {
  acquire: PlusCircle,
  assign: UserCheck,
  transfer: ArrowLeftRight,
  maintenance: Wrench,
  return: ArrowDownUp,
  dispose: Archive,
  write_off: FileX,
}

function typeTone(t: AssetTransactionType): 'lime' | 'sky' | 'amber' | 'rose' | 'violet' | 'zinc' {
  if (t === 'acquire') return 'lime'
  if (t === 'assign') return 'sky'
  if (t === 'transfer') return 'violet'
  if (t === 'maintenance') return 'amber'
  if (t === 'return') return 'sky'
  return 'rose'
}

export function AssetTransactions() {
  const app = useApp()
  const {
    assets, assetTransactions, upsertAssetTransaction, deleteAssetTransaction, upsertAsset,
    accounts, accountingSettings, journals, upsertJournal, deleteJournal, depreciationPolicy, depreciationPolicies, log,
  } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [tab, setTab] = useState<AssetTransactionType | 'all'>('all')
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AssetTransaction | null>(null)

  const assetName = (id: string) => {
    const a = assets.find((x) => x.id === id)
    return a ? `${a.tag} — ${a.name}` : id
  }
  const acctName = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    return a ? (a.code ? `${a.code} — ${a.name}` : a.name) : id
  }
  const voucherNo = (journalId?: string) => journals.find((j) => j.id === journalId)?.number

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...assetTransactions]
      .filter((t) => {
        if (!TX_TYPES.includes(t.type)) return false
        if (tab !== 'all' && t.type !== tab) return false
        if (typeFilter && t.type !== typeFilter) return false
        if (!ql) return true
        return (
          assetName(t.assetId).toLowerCase().includes(ql) ||
          (t.from || '').toLowerCase().includes(ql) ||
          (t.to || '').toLowerCase().includes(ql) ||
          (t.reason || '').toLowerCase().includes(ql) ||
          (t.notes || '').toLowerCase().includes(ql) ||
          (t.performedBy || '').toLowerCase().includes(ql) ||
          (voucherNo(t.journalId) || '').toLowerCase().includes(ql)
        )
      })
      .sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTransactions, q, typeFilter, tab, assets, journals])

  // ---- Locations from the Asset setup (Asset location) page ----
  const setupLocations = useMemo(() => loadAssetLocations(), [])
  const setupLocationOptions = useMemo(() => {
    const active = setupLocations.filter((l) => l.status === 'active')
    return active
      .map((l) => {
        const path = assetLocationPath(l, setupLocations)
        return { value: path, label: `${path} · ${l.type}` }
      })
      .sort((a, b) => a.value.localeCompare(b.value))
  }, [setupLocations])
  /** Free-text location already on the form (e.g. the asset's current site) kept selectable. */
  const extraFromOption = editing
    && (editing.type === 'dispose' || editing.type === 'write_off' || editing.type === 'transfer')
    && editing.from.trim()
    && !setupLocationOptions.some((o) => o.value === editing.from)
    ? editing.from : ''
  const extraToOption = editing
    && editing.type === 'transfer'
    && editing.to.trim()
    && !setupLocationOptions.some((o) => o.value === editing.to)
    ? editing.to : ''

  const tabLabel = TX_TABS.find((t) => t.id === tab)?.label || ''
  /** Assets eligible for a new transaction (already disposed / written-off assets are excluded). */
  const pickableAssets = assets.filter((a) => a.status !== 'disposed' && a.status !== 'written_off')

  // ---- Accounting mapping for the ledger-posted types ----
  const mappingLineFor = (type: AssetTransactionType) => {
    const key = MAPPING_KEY[type]
    if (!key) return null
    return { key, line: { ...DEFAULT_AUTO_MAPPING_LINES[key], ...accountingSettings.autoMapping?.lines?.[key] } }
  }

  const openNew = () => {
    const type: AssetTransactionType = tab === 'all' ? 'dispose' : tab
    const m = mappingLineFor(type)
    setEditing({
      assetId: '', type, date: new Date().toISOString().slice(0, 10),
      from: '', to: '', amount: '', reason: '',
      ledgerAccountId: m?.line.depositToAccountId || '',
      performedBy: '', notes: '',
    })
  }
  const openEdit = (t: AssetTransaction) => setEditing({
    id: t.id, assetId: t.assetId, type: t.type, date: t.date,
    from: t.from || '', to: t.to || '', amount: t.amount != null ? String(t.amount) : '',
    reason: t.reason || '', ledgerAccountId: '', performedBy: t.performedBy || '', notes: t.notes || '',
  })

  const pickAsset = (id: string) => {
    if (!editing) return
    const a = assets.find((x) => x.id === id)
    // For transfers / disposals, prefill "From" with the asset's current location.
    const from = editing.id ? editing.from : (a?.location || editing.from)
    setEditing({ ...editing, assetId: id, from })
  }

  // ---- Deep link (Asset Audit corrective actions): ?new=dispose&asset=ast_2&note=… ----
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const tx = params.get('new')
    if (!tx) return
    const type = tx as AssetTransactionType
    if (!TX_TYPES.includes(type)) return
    const assetId = params.get('asset') || ''
    const a = assets.find((x) => x.id === assetId)
    const m = mappingLineFor(type)
    setTab(type)
    setEditing({
      assetId, type, date: new Date().toISOString().slice(0, 10),
      from: a?.location || '', to: '', amount: '', reason: '',
      ledgerAccountId: m?.line.depositToAccountId || '',
      performedBy: '', notes: params.get('note') || '',
    })
    const next = new URLSearchParams(params)
    next.delete('new'); next.delete('asset'); next.delete('note')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Valuation of the selected asset at the transaction date (dispose / write_off) ----
  const valuation = (() => {
    if (!editing || (editing.type !== 'dispose' && editing.type !== 'write_off') || !editing.assetId) return null
    const a = assets.find((x) => x.id === editing.assetId)
    if (!a) return null
    const asOf = new Date(`${editing.date}T00:00:00`).getTime()
    const cost = a.purchaseCost || 0
    const matchPol = depreciationPolicies.find((p) => p.status === 'active' && p.period > 0 && p.name.toLowerCase() === a.category.toLowerCase())
    const effPolicy = matchPol ? { ...depreciationPolicy, usefulLifeYears: matchPol.period } : depreciationPolicy
    const acc = accumulatedDepreciationTo(a, effPolicy, asOf)
    const nbv = netBookValueTo(a, effPolicy, asOf)
    const proceeds = editing.type === 'dispose' && editing.amount ? Number(editing.amount) || 0 : 0
    const gainLoss = editing.type === 'dispose' ? proceeds - nbv : 0
    return { a, cost, acc, nbv, proceeds, gainLoss }
  })()

  /** Ledger lines that will be posted — previewed before saving. */
  const previewLines = useMemo((): { label: string; debit: number; credit: number }[] => {
    if (!valuation) return []
    const { a, cost, acc, nbv, proceeds, gainLoss } = valuation
    const m = mappingLineFor(editing!.type)
    const assetAcct = a.assetAccountId || m?.line.paymentAccountId || 'ac_59'
    const accumAcct = a.accumulatedDepreciationAccountId || FALLBACK_ACCUM_ACCOUNT
    const lines: { label: string; debit: number; credit: number }[] = []
    if (acc > 0) lines.push({ label: `Dr ${acctName(accumAcct)}`, debit: acc, credit: 0 })
    if (editing!.type === 'dispose') {
      const proceedsAcct = editing!.ledgerAccountId || m?.line.depositToAccountId || 'ac_13'
      if (proceeds > 0) lines.push({ label: `Dr ${acctName(proceedsAcct)}`, debit: proceeds, credit: 0 })
      if (gainLoss < 0) lines.push({ label: `Dr ${acctName(GAIN_LOSS_ACCOUNT)} (loss)`, debit: Math.round(-gainLoss), credit: 0 })
      if (cost > 0) lines.push({ label: `Cr ${acctName(assetAcct)}`, debit: 0, credit: cost })
      if (gainLoss > 0) lines.push({ label: `Cr ${acctName(GAIN_LOSS_ACCOUNT)} (gain)`, debit: 0, credit: Math.round(gainLoss) })
    } else {
      const writeoffAcct = editing!.ledgerAccountId || m?.line.depositToAccountId || GAIN_LOSS_ACCOUNT
      if (nbv > 0) lines.push({ label: `Dr ${acctName(writeoffAcct)}`, debit: nbv, credit: 0 })
      if (cost > 0) lines.push({ label: `Cr ${acctName(assetAcct)}`, debit: 0, credit: cost })
    }
    return lines
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuation, editing?.ledgerAccountId, accounts])

  const nextJournalNumber = () => {
    const max = journals.reduce((m, j) => {
      const n = /^JV-(\d+)$/.exec(j.number)
      return n ? Math.max(m, Number(n[1])) : m
    }, 0)
    return `JV-${String(max + 1).padStart(4, '0')}`
  }

  const save = () => {
    if (!editing) return
    if (!editing.assetId) { toast.error('Select an asset.'); return }
    if (!editing.date) { toast.error('Select a date.'); return }
    const amount = editing.amount ? Number(editing.amount) : undefined
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) { toast.error('Enter a valid amount.'); return }
    if (editing.type === 'dispose' && !editing.reason.trim()) { toast.error('Select the disposal method.'); return }
    if (editing.type === 'write_off' && !editing.reason.trim()) { toast.error('Enter the write-off reason.'); return }
    if ((editing.type === 'dispose' || editing.type === 'write_off' || editing.type === 'transfer') && !editing.from.trim()) {
      toast.error(editing.type === 'transfer' ? 'Select the location the asset is moving from.' : 'Select the location the asset is held at.')
      return
    }
    if (editing.type === 'transfer' && !editing.to.trim()) { toast.error('Select the destination location.'); return }

    const isNew = !editing.id
    const asset = assets.find((a) => a.id === editing.assetId)

    // ---- Post the ledger entry through the accounting mapping (new disposals / write-offs) ----
    let journalId: string | undefined
    if (isNew && valuation && (editing.type === 'dispose' || editing.type === 'write_off')) {
      const m = mappingLineFor(editing.type)
      if (m && m.line.enabled !== false) {
        const assetAcct = valuation.a.assetAccountId || m.line.paymentAccountId
        const accumAcct = valuation.a.accumulatedDepreciationAccountId || FALLBACK_ACCUM_ACCOUNT
        const lines: JournalLine[] = []
        if (valuation.acc > 0) lines.push({ accountId: accumAcct, debit: valuation.acc, credit: 0 })
        if (editing.type === 'dispose') {
          const proceedsAcct = editing.ledgerAccountId || m.line.depositToAccountId
          if (valuation.proceeds > 0) lines.push({ accountId: proceedsAcct, debit: valuation.proceeds, credit: 0 })
          if (valuation.gainLoss < 0) lines.push({ accountId: GAIN_LOSS_ACCOUNT, debit: Math.round(-valuation.gainLoss), credit: 0 })
          if (valuation.cost > 0) lines.push({ accountId: assetAcct, debit: 0, credit: valuation.cost })
          if (valuation.gainLoss > 0) lines.push({ accountId: GAIN_LOSS_ACCOUNT, debit: 0, credit: Math.round(valuation.gainLoss) })
        } else {
          const writeoffAcct = editing.ledgerAccountId || m.line.depositToAccountId
          if (valuation.nbv > 0) lines.push({ accountId: writeoffAcct, debit: valuation.nbv, credit: 0 })
          if (valuation.cost > 0) lines.push({ accountId: assetAcct, debit: 0, credit: valuation.cost })
        }
        if (lines.length) {
          const link = mappingLink(accountingSettings, m.key)
          const stamp = new Date().toISOString()
          const jv: JournalVoucher = {
            id: uid('jv'),
            number: nextJournalNumber(),
            date: editing.date,
            description: editing.type === 'dispose'
              ? `Asset disposal — ${assetName(editing.assetId)} (${editing.reason.trim()})`
              : `Write-off — ${assetName(editing.assetId)} (${editing.reason.trim()})`,
            lines,
            status: (link.postingProfile === 'auto_post' ? 'posted' : 'draft') as 'posted' | 'draft',
            notes: [
              editing.notes.trim() && `Note: ${editing.notes.trim()}`,
              editing.performedBy.trim() && `Authorized by ${editing.performedBy.trim()}`,
              `Generated from Asset Transactions — automatic mapping “${editing.type === 'dispose' ? 'Fixed equipment → Disposal' : 'Fixed equipment → Write-off'}”.`,
            ].filter(Boolean).join(' · '),
            createdBy: user?.id,
            createdAt: stamp,
          }
          upsertJournal(jv)
          journalId = jv.id
          toast.success(
            link.postingProfile === 'auto_post' ? `Journal ${jv.number} posted to the ledger` : `Journal ${jv.number} saved as draft`,
            editing.type === 'dispose' ? 'Asset Disposal' : 'Asset Write-off',
          )
        }
      }
    }

    const rec: AssetTransaction = {
      id: editing.id || uid('atx'),
      assetId: editing.assetId,
      type: editing.type,
      date: editing.date,
      from: editing.from.trim() || undefined,
      to: editing.to.trim() || undefined,
      amount,
      reason: editing.reason.trim() || undefined,
      journalId: journalId || (editing.id ? assetTransactions.find((t) => t.id === editing.id)?.journalId : undefined),
      performedBy: editing.performedBy.trim() || undefined,
      notes: editing.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (assetTransactions.find((t) => t.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertAssetTransaction(rec)

    // Apply the transaction to the asset itself (only on first record, not edits).
    if (isNew && asset) {
      const stamp = new Date().toISOString()
      if (rec.type === 'dispose') upsertAsset({ ...asset, status: 'disposed', updatedAt: stamp })
      else if (rec.type === 'write_off') upsertAsset({ ...asset, status: 'written_off', updatedAt: stamp })
      else if (rec.type === 'transfer' && rec.to) upsertAsset({ ...asset, location: rec.to, updatedAt: stamp })
    }

    const typeLabel = ASSET_TRANSACTION_TYPES.find((t) => t.id === rec.type)?.label || rec.type
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'AssetTransaction', `${isNew ? 'Created' : 'Updated'} ${typeLabel} for ${assetName(rec.assetId)}${journalId ? ` (journal ${voucherNo(journalId)})` : ''}`)
    if (!journalId) toast.success(isNew ? 'Transaction recorded' : 'Transaction updated', typeLabel)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteAssetTransaction(deleting.id)
    // Keep the ledger consistent: remove the voucher this transaction generated.
    if (deleting.journalId) deleteJournal(deleting.journalId)
    log(user?.id || 'system', 'DELETE', 'AssetTransaction', `Deleted transaction for ${assetName(deleting.assetId)}${deleting.journalId ? ' and its journal voucher' : ''}`)
    toast.success('Transaction deleted', deleting.journalId ? 'Linked journal voucher removed' : undefined)
    setDeleting(null)
  }

  const exportRows = rows.map((t) => ({
    date: t.date, asset: assetName(t.assetId), type: t.type,
    from: t.from || '', to: t.to || '', reason: t.reason || '', amount: t.amount ?? '',
    journal: voucherNo(t.journalId) || '', authorizedBy: t.performedBy || '', notes: t.notes || '',
  }))

  const m = editing ? mappingLineFor(editing.type) : null

  return (
    <div>
      <PageHeader
        title="Asset transactions"
        desc="Asset disposal, asset write-off and asset transfer — disposals and write-offs post straight to the ledger through the accounting mapping."
        actions={
          <ExportButtons filename="asset-transactions" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
        }
      />

      {/* ---- Transaction tabs ---- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TX_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id); setTypeFilter('') }}
            className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm transition ${tab === t.id ? 'bg-orange-500 hover:bg-orange-600' : 'bg-[#2c4a77] hover:bg-[#243d63]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search asset, location, reason, voucher…" className="w-full max-w-sm" />
        {tab === 'all' && (
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
            <option value="">All types</option>
            {ASSET_TRANSACTION_TYPES.filter((t) => TX_TYPES.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        )}
        {canManage && (
          <Button className="ml-auto bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}>
            <Plus className="size-4" /> {tab === 'all' ? 'New transaction' : tabLabel}
          </Button>
        )}
      </div>

      {/* ---- All tab reflects the three covered transaction types ---- */}
      {tab === 'all' && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TX_TABS.filter((t) => t.id !== 'all').map((t) => {
            const count = assetTransactions.filter((x) => x.type === t.id).length
            const on = typeFilter === t.id
            const Icon = TYPE_ICONS[t.id as AssetTransactionType]
            return (
              <button
                key={t.id}
                type="button"
                title={on ? 'Clear filter' : `Show ${t.label} only`}
                onClick={() => setTypeFilter(on ? '' : (t.id as AssetTransactionType))}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? 'border-orange-500 ring-1 ring-orange-500/40' : 'border-line hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'}`}
              >
                <span className={`grid size-9 flex-shrink-0 place-items-center rounded-lg ${t.id === 'transfer' ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{t.label}</span>
                  <span className="block text-xs text-mist">{count} transaction{count === 1 ? '' : 's'}</span>
                </span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${on ? 'bg-orange-500/15 text-orange-500' : 'bg-black/[0.06] dark:bg-white/10'}`}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Asset</th><th>Type</th><th>From</th><th>To</th><th>Reason / Method</th><th className="text-right">Amount</th><th>Ledger</th><th>Authorized by</th><th>ACTIONS</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const Icon = TYPE_ICONS[t.type]
              const no = voucherNo(t.journalId)
              return (
                <tr key={t.id}>
                  <td className="text-mist">{formatDate(t.date)}</td>
                  <td className="font-semibold">{assetName(t.assetId)}</td>
                  <td><Badge tone={typeTone(t.type)}><Icon className="mr-1 inline size-3" />{ASSET_TRANSACTION_TYPES.find((x) => x.id === t.type)?.label || t.type}</Badge></td>
                  <td className="text-mist">{t.from || '—'}</td>
                  <td className="text-mist">{t.to || '—'}</td>
                  <td className="text-mist">{t.reason || '—'}</td>
                  <td className="text-right font-semibold">{t.amount != null ? formatGhs(t.amount) : '—'}</td>
                  <td>{no ? <Badge tone="violet"><Landmark className="mr-1 inline size-3" />{no}</Badge> : <span className="text-mist">—</span>}</td>
                  <td className="text-mist">{t.performedBy || '—'}</td>
                  <td className="whitespace-nowrap">
                    {canManage && (
                      <>
                        <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit transaction" onClick={() => openEdit(t)}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete transaction" onClick={() => setDeleting(t)}><Trash2 className="size-4" /></button>
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!rows.length && (
          <Empty
            title={tab === 'all' ? 'No transactions yet' : `No ${tabLabel.toLowerCase()} transactions yet`}
            desc={canManage ? `Record a ${tab === 'all' ? 'transaction' : tabLabel.toLowerCase()} with the button above the list.` : 'No transactions match the current view.'}
          />
        )}
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit transaction' : (tab === 'all' ? 'New transaction' : tabLabel)} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Asset" required>
                <Select value={editing.assetId} onChange={(e) => pickAsset(e.target.value)}>
                  <option value="">Select asset…</option>
                  {(editing.id ? assets : pickableAssets).map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
                </Select>
              </Field>
              {tab === 'all' && (
                <Field label="Transaction type">
                  <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as AssetTransactionType })}>
                    {ASSET_TRANSACTION_TYPES.filter((t) => TX_TYPES.includes(t.id)).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Authorized by"><Input value={editing.performedBy} onChange={(e) => setEditing({ ...editing, performedBy: e.target.value })} placeholder="Name" /></Field>

              {editing.type === 'transfer' ? (
                <>
                  <Field label="From location" required>
                    <Select value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })}>
                      <option value="">Select location…</option>
                      {extraFromOption && (
                        <option value={extraFromOption}>
                          {extraFromOption}{!editing.id && extraFromOption === (assets.find((a) => a.id === editing.assetId)?.location || '') ? ' (current)' : ''}
                        </option>
                      )}
                      {setupLocationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="To location" required>
                    <Select value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })}>
                      <option value="">Select destination…</option>
                      {extraToOption && <option value={extraToOption}>{extraToOption}</option>}
                      {setupLocationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                </>
              ) : (
                <>
                  <Field label="From location" required>
                    <Select value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })}>
                      <option value="">Select location…</option>
                      {extraFromOption && (
                        <option value={extraFromOption}>
                          {extraFromOption}{!editing.id && extraFromOption === (assets.find((a) => a.id === editing.assetId)?.location || '') ? ' (current)' : ''}
                        </option>
                      )}
                      {setupLocationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                  {editing.type === 'dispose' && (
                    <Field label="Received by / disposed to">
                      <Input value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} placeholder="e.g. Buyer or scrap yard" />
                    </Field>
                  )}
                </>
              )}

              {editing.type === 'dispose' ? (
                <Field label="Disposal method" required>
                  <Select value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })}>
                    <option value="">Select method…</option>
                    {DISPOSAL_METHODS.map((m2) => <option key={m2} value={m2}>{m2}</option>)}
                  </Select>
                </Field>
              ) : editing.type === 'write_off' ? (
                <Field label="Write-off reason" required>
                  <Input value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} placeholder="e.g. Damaged beyond repair" />
                </Field>
              ) : (
                <Field label="Reason / method"><Input value={editing.reason} onChange={(e) => setEditing({ ...editing, reason: e.target.value })} placeholder="Optional" /></Field>
              )}

              <Field label={editing.type === 'dispose' ? 'Proceeds (GHS, optional)' : editing.type === 'write_off' ? 'Write-off value (GHS, optional)' : 'Amount (GHS, optional)'}>
                <Input type="number" min={0} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder={editing.type === 'dispose' ? 'Sale proceeds' : editing.type === 'write_off' ? 'Book value written off' : 'Cost, proceeds, or charge'} />
              </Field>

              {/* Ledger account for the debit side of the generated entry */}
              {!editing.id && (editing.type === 'dispose' || editing.type === 'write_off') && (
                <Field label={editing.type === 'dispose' ? 'Proceeds received in (Dr)' : 'Charge book value to (Dr)'}>
                  <Select value={editing.ledgerAccountId} onChange={(e) => setEditing({ ...editing, ledgerAccountId: e.target.value })}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => <option key={a.id} value={a.id}>{a.code ? `${a.code} — ` : ''}{a.name}</option>)}
                  </Select>
                </Field>
              )}
            </div>

            {/* ---- Valuation at the transaction date ---- */}
            {valuation && !editing.id && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist">Valuation at {formatDate(editing.date)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-mist">Cost</p><p className="font-bold">{formatGhs(valuation.cost)}</p></div>
                  <div><p className="text-xs text-mist">Accumulated depreciation</p><p className="font-bold">{formatGhs(valuation.acc)}</p></div>
                  <div><p className="text-xs text-mist">Net book value</p><p className="font-bold">{formatGhs(valuation.nbv)}</p></div>
                  {editing.type === 'dispose' && (
                    <div>
                      <p className="text-xs text-mist">Result</p>
                      <p className={`font-bold ${valuation.gainLoss > 0 ? 'text-lime' : valuation.gainLoss < 0 ? 'text-rose-500' : ''}`}>
                        {valuation.gainLoss > 0 ? `Gain ${formatGhs(valuation.gainLoss)}` : valuation.gainLoss < 0 ? `Loss ${formatGhs(-valuation.gainLoss)}` : 'Break-even'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ---- Ledger entry preview ---- */}
            {previewLines.length > 0 && !editing.id && (
              <div className="rounded-xl border border-line p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist">
                  <Landmark className="size-3.5" /> Journal entry preview
                  {m && <span className="ml-1 font-semibold normal-case text-mist">· mapping: {editing.type === 'dispose' ? 'Fixed equipment → Disposal' : 'Fixed equipment → Write-off'}{m.line.enabled === false ? ' (disabled — no voucher will be created)' : ''}</span>}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-mist">
                      <th className="pb-1 text-left font-bold">Account</th>
                      <th className="pb-1 text-right font-bold">Debit</th>
                      <th className="pb-1 text-right font-bold">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {previewLines.map((l, i) => (
                      <tr key={i}>
                        <td className="py-1.5">{l.label}</td>
                        <td className="py-1.5 text-right font-semibold">{l.debit ? formatGhs(l.debit) : ''}</td>
                        <td className="py-1.5 text-right font-semibold">{l.credit ? formatGhs(l.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Context for this transaction…" /></Field>

            {!editing.id && (editing.type === 'dispose' || editing.type === 'write_off') && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                Saving marks the asset as {editing.type === 'dispose' ? 'Disposed' : 'Written off'} and posts the journal entry above to the ledger
                {m && mappingLink(accountingSettings, m.key).postingProfile === 'manual_draft' ? ' as a draft (per the accounting mapping).' : '.'}
              </p>
            )}
            {!editing.id && editing.type === 'transfer' && (
              <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400">
                Saving will move the asset to the destination location in the asset register.
              </p>
            )}
            {editing.id && voucherNo(assetTransactions.find((t) => t.id === editing.id)?.journalId) && (
              <p className="rounded-lg bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
                Linked ledger voucher: {voucherNo(assetTransactions.find((t) => t.id === editing.id)?.journalId)} — edits here do not repost the journal.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save transaction' : 'Record transaction'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete transaction?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Delete this <span className="font-semibold text-inherit">{ASSET_TRANSACTION_TYPES.find((t) => t.id === deleting.type)?.label || deleting.type}</span> transaction for{' '}
              <span className="font-semibold text-inherit">{assetName(deleting.assetId)}</span> ({formatDate(deleting.date)})? This cannot be undone.
              {deleting.journalId && voucherNo(deleting.journalId) && (
                <> The linked journal voucher <span className="font-semibold text-inherit">{voucherNo(deleting.journalId)}</span> will also be removed from the ledger.</>
              )}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
