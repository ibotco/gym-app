import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ArrowLeftRight, Wrench, PlusCircle, ArrowDownUp, UserCheck, Archive, SlidersHorizontal } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea, Empty, SearchField, DatePicker } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { ASSET_TRANSACTION_TYPES } from '../../lib/assetTransactions'
import type { AssetTransaction, AssetTransactionType } from '../../types'

type FormState = {
  id?: string
  assetId: string
  type: AssetTransactionType
  date: string
  from: string
  to: string
  amount: string
  performedBy: string
  notes: string
}

const blankForm = (): FormState => ({
  assetId: '', type: 'transfer', date: new Date().toISOString().slice(0, 10),
  from: '', to: '', amount: '', performedBy: '', notes: '',
})

const TYPE_ICONS: Record<AssetTransactionType, typeof ArrowLeftRight> = {
  acquire: PlusCircle,
  assign: UserCheck,
  transfer: ArrowLeftRight,
  maintenance: Wrench,
  return: ArrowDownUp,
  dispose: Archive,
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
  const { assets, assetTransactions, upsertAssetTransaction, deleteAssetTransaction, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'staff')

  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editing, setEditing] = useState<FormState | null>(null)
  const [deleting, setDeleting] = useState<AssetTransaction | null>(null)

  const assetName = (id: string) => {
    const a = assets.find((x) => x.id === id)
    return a ? `${a.tag} — ${a.name}` : id
  }

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...assetTransactions]
      .filter((t) => {
        if (typeFilter && t.type !== typeFilter) return false
        if (!ql) return true
        return (
          assetName(t.assetId).toLowerCase().includes(ql) ||
          (t.from || '').toLowerCase().includes(ql) ||
          (t.to || '').toLowerCase().includes(ql) ||
          (t.notes || '').toLowerCase().includes(ql) ||
          (t.performedBy || '').toLowerCase().includes(ql)
        )
      })
      .sort((a, b) => b.date.localeCompare(a.date))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTransactions, q, typeFilter, assets])

  const openNew = () => setEditing(blankForm())
  const openEdit = (t: AssetTransaction) => setEditing({
    id: t.id, assetId: t.assetId, type: t.type, date: t.date,
    from: t.from || '', to: t.to || '', amount: t.amount != null ? String(t.amount) : '',
    performedBy: t.performedBy || '', notes: t.notes || '',
  })

  const save = () => {
    if (!editing) return
    if (!editing.assetId) { toast.error('Select an asset.'); return }
    if (!editing.date) { toast.error('Select a date.'); return }
    const amount = editing.amount ? Number(editing.amount) : undefined
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) { toast.error('Enter a valid amount.'); return }

    const isNew = !editing.id
    const rec: AssetTransaction = {
      id: editing.id || uid('atx'),
      assetId: editing.assetId,
      type: editing.type,
      date: editing.date,
      from: editing.from.trim() || undefined,
      to: editing.to.trim() || undefined,
      amount,
      performedBy: editing.performedBy.trim() || undefined,
      notes: editing.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (assetTransactions.find((t) => t.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertAssetTransaction(rec)
    const typeLabel = ASSET_TRANSACTION_TYPES.find((t) => t.id === rec.type)?.label || rec.type
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'AssetTransaction', `${isNew ? 'Created' : 'Updated'} ${typeLabel} for ${assetName(rec.assetId)}`)
    toast.success(isNew ? 'Transaction recorded' : 'Transaction updated', typeLabel)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteAssetTransaction(deleting.id)
    log(user?.id || 'system', 'DELETE', 'AssetTransaction', `Deleted transaction for ${assetName(deleting.assetId)}`)
    toast.success('Transaction deleted')
    setDeleting(null)
  }

  const exportRows = rows.map((t) => ({
    date: t.date, asset: assetName(t.assetId), type: t.type,
    from: t.from || '', to: t.to || '', amount: t.amount ?? '',
    performedBy: t.performedBy || '', notes: t.notes || '',
  }))

  return (
    <div>
      <PageHeader
        title="Asset transactions"
        desc="Track the lifecycle of your assets — acquisition, assignment, transfers, maintenance, and disposal."
        actions={
          <>
            <ExportButtons filename="asset-transactions" rows={exportRows} onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New transaction</Button>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search asset, location, notes…" className="w-full max-w-sm" />
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto" icon={<SlidersHorizontal className="size-4" />}>
          <option value="">All types</option>
          {ASSET_TRANSACTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </Select>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Asset</th><th>Type</th><th>From</th><th>To</th><th className="text-right">Amount</th><th>By</th><th>ACTIONS</th></tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const Icon = TYPE_ICONS[t.type]
              return (
                <tr key={t.id}>
                  <td className="text-mist">{formatDate(t.date)}</td>
                  <td className="font-semibold">{assetName(t.assetId)}</td>
                  <td><Badge tone={typeTone(t.type)}><Icon className="mr-1 inline size-3" />{ASSET_TRANSACTION_TYPES.find((x) => x.id === t.type)?.label || t.type}</Badge></td>
                  <td className="text-mist">{t.from || '—'}</td>
                  <td className="text-mist">{t.to || '—'}</td>
                  <td className="text-right font-semibold">{t.amount != null ? formatGhs(t.amount) : '—'}</td>
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
        {!rows.length && <Empty title="No transactions yet" desc="Record an asset move or lifecycle event with the New transaction button." />}
      </div>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit transaction' : 'New transaction'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Asset" required>
                <Select value={editing.assetId} onChange={(e) => setEditing({ ...editing, assetId: e.target.value })}>
                  <option value="">Select asset…</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.tag} — {a.name}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as AssetTransactionType })}>
                  {ASSET_TRANSACTION_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
              </Field>
              <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Performed by"><Input value={editing.performedBy} onChange={(e) => setEditing({ ...editing, performedBy: e.target.value })} placeholder="Name" /></Field>
              <Field label="From (location / custodian)"><Input value={editing.from} onChange={(e) => setEditing({ ...editing, from: e.target.value })} placeholder="e.g. Accra — Airport City" /></Field>
              <Field label="To (location / custodian)"><Input value={editing.to} onChange={(e) => setEditing({ ...editing, to: e.target.value })} placeholder="e.g. Tema — Community 1" /></Field>
              <Field label="Amount (GHS, optional)"><Input type="number" min={0} value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} placeholder="Cost, proceeds, or charge" /></Field>
            </div>
            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} placeholder="Context for this transaction…" /></Field>
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
