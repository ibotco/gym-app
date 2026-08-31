import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea, SearchField, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate, uid } from '../../../lib/utils'
import type { BankReconciliation } from '../../../types'

type Form = { id?: string; bankAccountId: string; statementDate: string; statementBalance: string; bookBalance: string; status: 'open' | 'reconciled'; notes: string }

export function BankReconciliationPage() {
  const app = useApp()
  const { reconciliations, banks, upsertReconciliation, deleteReconciliation, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<BankReconciliation | null>(null)

  const bankName = (id: string) => banks.find((b) => b.id === id)?.name || id

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...reconciliations]
      .filter((r) => !ql || bankName(r.bankAccountId).toLowerCase().includes(ql))
      .sort((a, b) => b.statementDate.localeCompare(a.statementDate))
  }, [reconciliations, q, banks])

  const columns: Column<BankReconciliation>[] = [
    { key: 'bank', header: 'Bank account', sortValue: (r) => bankName(r.bankAccountId), render: (r) => <span className="font-semibold">{bankName(r.bankAccountId)}</span> },
    { key: 'date', header: 'Statement date', sortValue: (r) => r.statementDate, render: (r) => <span className="text-mist">{formatDate(r.statementDate)}</span> },
    { key: 'stmt', header: 'Statement balance', sortValue: (r) => r.statementBalance, align: 'right', render: (r) => formatGhsExact(r.statementBalance) },
    { key: 'book', header: 'Book balance', sortValue: (r) => r.bookBalance, align: 'right', render: (r) => formatGhsExact(r.bookBalance) },
    { key: 'diff', header: 'Difference', sortValue: (r) => r.difference, align: 'right', render: (r) => <span className={r.difference === 0 ? 'font-semibold text-lime' : 'font-semibold text-ember'}>{formatGhsExact(r.difference)}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, render: (r) => <Badge tone={r.status === 'reconciled' ? 'lime' : 'amber'}>{r.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setEditing({ id: r.id, bankAccountId: r.bankAccountId, statementDate: r.statementDate, statementBalance: String(r.statementBalance), bookBalance: String(r.bookBalance), status: r.status, notes: r.notes || '' })}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing({ bankAccountId: banks[0]?.id || '', statementDate: new Date().toISOString().slice(0, 10), statementBalance: '', bookBalance: banks[0] ? String(banks[0].balance) : '', status: 'open', notes: '' })

  const save = () => {
    if (!editing) return
    if (!editing.bankAccountId) { toast.error('Select a bank account.'); return }
    const statementBalance = Number(editing.statementBalance)
    const bookBalance = Number(editing.bookBalance)
    if (!Number.isFinite(statementBalance) || !Number.isFinite(bookBalance)) { toast.error('Enter valid balances.'); return }
    const isNew = !editing.id
    upsertReconciliation({
      id: editing.id || uid('rc'),
      bankAccountId: editing.bankAccountId,
      statementDate: editing.statementDate,
      statementBalance,
      bookBalance,
      difference: Math.round((bookBalance - statementBalance) * 100) / 100,
      status: editing.status,
      notes: editing.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (reconciliations.find((r) => r.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'BankReconciliation', `${isNew ? 'Created' : 'Updated'} reconciliation for ${bankName(editing.bankAccountId)}`)
    toast.success(isNew ? 'Reconciliation created' : 'Reconciliation updated')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteReconciliation(deleting.id)
    log(user?.id || 'system', 'DELETE', 'BankReconciliation', `Deleted reconciliation for ${bankName(deleting.bankAccountId)}`)
    toast.success('Reconciliation deleted')
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Bank reconciliation"
        desc="Match your bank statements against your books."
        actions={canManage ? <Button onClick={openNew}><Plus className="size-4" /> New reconciliation</Button> : undefined}
      />
      <div className="mb-4"><SearchField value={q} onChange={setQ} placeholder="Search bank account…" className="w-full max-w-sm" /></div>

      <div className="card">
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyTitle="No reconciliations" emptyDesc="Start a reconciliation with the New reconciliation button." />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit reconciliation' : 'New reconciliation'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank account" required>
                <select className="field" value={editing.bankAccountId} onChange={(e) => setEditing({ ...editing, bankAccountId: e.target.value, bookBalance: String(banks.find((b) => b.id === e.target.value)?.balance || '') })}>
                  <option value="">Select account…</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
              <Field label="Statement date"><DatePicker value={editing.statementDate} onChange={(v) => setEditing({ ...editing, statementDate: v })} /></Field>
              <Field label="Statement balance (GHS)"><Input type="number" value={editing.statementBalance} onChange={(e) => setEditing({ ...editing, statementBalance: e.target.value })} /></Field>
              <Field label="Book balance (GHS)"><Input type="number" value={editing.bookBalance} onChange={(e) => setEditing({ ...editing, bookBalance: e.target.value })} /></Field>
              <Field label="Status">
                <select className="field" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'open' | 'reconciled' })}>
                  <option value="open">open</option>
                  <option value="reconciled">reconciled</option>
                </select>
              </Field>
            </div>
            {editing.statementBalance !== '' && editing.bookBalance !== '' && (
              <p className="text-sm">
                Difference: <span className="font-semibold">{formatGhsExact((Number(editing.bookBalance) || 0) - (Number(editing.statementBalance) || 0))}</span>
              </p>
            )}
            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save reconciliation' : 'Create reconciliation'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete reconciliation?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete the reconciliation for <span className="font-semibold">{bankName(deleting.bankAccountId)}</span>? This cannot be undone.</p>
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
