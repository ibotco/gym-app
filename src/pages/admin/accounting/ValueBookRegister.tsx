import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea, SearchField, StatCard, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import type { ValueBookEntry } from '../../../types'

type Form = { id?: string; date: string; assetName: string; openingValue: string; additions: string; depreciation: string; notes: string }

export function ValueBookRegisterPage() {
  const app = useApp()
  const { valueBook, upsertValueBookEntry, deleteValueBookEntry, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<ValueBookEntry | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return valueBook.filter((v) => !ql || v.assetName.toLowerCase().includes(ql)).sort((a, b) => b.date.localeCompare(a.date))
  }, [valueBook, q])

  const totalClosing = valueBook.reduce((s, v) => s + v.closingValue, 0)

  const columns: Column<ValueBookEntry>[] = [
    { key: 'date', header: 'Date', sortValue: (v) => v.date, render: (v) => <span className="text-mist">{formatDate(v.date)}</span> },
    { key: 'asset', header: 'Asset', sortValue: (v) => v.assetName, render: (v) => <span className="font-semibold">{v.assetName}</span> },
    { key: 'opening', header: 'Opening', sortValue: (v) => v.openingValue, align: 'right', render: (v) => formatGhs(v.openingValue) },
    { key: 'add', header: 'Additions', sortValue: (v) => v.additions, align: 'right', render: (v) => formatGhs(v.additions) },
    { key: 'dep', header: 'Depreciation', sortValue: (v) => v.depreciation, align: 'right', render: (v) => formatGhs(v.depreciation) },
    { key: 'closing', header: 'Closing', sortValue: (v) => v.closingValue, align: 'right', render: (v) => <span className="font-semibold">{formatGhs(v.closingValue)}</span> },
    { key: 'notes', header: 'Notes', render: (v) => <span className="text-mist">{v.notes || '—'}</span> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (v) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setEditing({ id: v.id, date: v.date, assetName: v.assetName, openingValue: String(v.openingValue), additions: String(v.additions), depreciation: String(v.depreciation), notes: v.notes || '' })}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(v)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing({ date: new Date().toISOString().slice(0, 10), assetName: '', openingValue: '', additions: '0', depreciation: '0', notes: '' })

  const save = () => {
    if (!editing) return
    if (!editing.assetName.trim()) { toast.error('Enter an asset name.'); return }
    const opening = Number(editing.openingValue) || 0
    const additions = Number(editing.additions) || 0
    const depreciation = Number(editing.depreciation) || 0
    const closingValue = opening + additions - depreciation
    const isNew = !editing.id
    upsertValueBookEntry({
      id: editing.id || uid('vb'),
      date: editing.date,
      assetName: editing.assetName.trim(),
      openingValue: opening,
      additions,
      depreciation,
      closingValue,
      notes: editing.notes.trim() || undefined,
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'ValueBook', `${isNew ? 'Created' : 'Updated'} entry for ${editing.assetName}`)
    toast.success(isNew ? 'Value book entry created' : 'Value book entry updated')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteValueBookEntry(deleting.id)
    log(user?.id || 'system', 'DELETE', 'ValueBook', `Deleted entry for ${deleting.assetName}`)
    toast.success('Value book entry deleted')
    setDeleting(null)
  }

  return (
    <div>
      <PageHeader
        title="Value book register"
        desc="Track the opening, additions, depreciation, and closing value of fixed assets."
        actions={
          <>
            <ExportButtons filename="value-book" rows={rows.map((v) => ({ date: v.date, asset: v.assetName, opening: v.openingValue, additions: v.additions, depreciation: v.depreciation, closing: v.closingValue, notes: v.notes || '' }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New entry</Button>}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Total closing value" value={formatGhsExact(totalClosing)} />
        <StatCard label="Entries" value={String(valueBook.length)} />
      </div>
      <div className="mb-4"><SearchField value={q} onChange={setQ} placeholder="Search asset…" className="w-full max-w-sm" /></div>

      <div className="card">
        <DataTable columns={columns} data={rows} rowKey={(v) => v.id} emptyTitle="No entries" emptyDesc="Add your first value book entry." />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit entry' : 'New value book entry'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Asset name" required><Input value={editing.assetName} onChange={(e) => setEditing({ ...editing, assetName: e.target.value })} /></Field>
              <Field label="Opening value (GHS)"><Input type="number" min={0} value={editing.openingValue} onChange={(e) => setEditing({ ...editing, openingValue: e.target.value })} /></Field>
              <Field label="Additions (GHS)"><Input type="number" min={0} value={editing.additions} onChange={(e) => setEditing({ ...editing, additions: e.target.value })} /></Field>
              <Field label="Depreciation (GHS)"><Input type="number" min={0} value={editing.depreciation} onChange={(e) => setEditing({ ...editing, depreciation: e.target.value })} /></Field>
            </div>
            <p className="text-sm text-mist">
              Closing value: <span className="font-semibold text-inherit">{formatGhs((Number(editing.openingValue) || 0) + (Number(editing.additions) || 0) - (Number(editing.depreciation) || 0))}</span>
            </p>
            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save entry' : 'Create entry'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete entry?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete the value book entry for <span className="font-semibold">{deleting.assetName}</span>? This cannot be undone.</p>
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
