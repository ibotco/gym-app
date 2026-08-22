import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 , X} from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Textarea, SearchField, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { nextNumber, accountName, voucherTotal } from '../../../lib/accounting'
import { AccountSelect, StatusSelect, VoucherStatusBadge } from './common'
import type { JournalVoucher, JournalLine, VoucherStatus } from '../../../types'

type Line = { accountId: string; debit: string; credit: string }
type Form = { id?: string; number: string; date: string; description: string; lines: Line[]; status: VoucherStatus; notes: string }

export function JournalVoucherPage() {
  const app = useApp()
  const { journals, accounts, upsertJournal, deleteJournal, accountingSettings, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Form | null>(null)
  const [deleting, setDeleting] = useState<JournalVoucher | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...journals]
      .filter((j) => !ql || `${j.number} ${j.description}`.toLowerCase().includes(ql))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [journals, q])

  const columns: Column<JournalVoucher>[] = [
    { key: 'number', header: 'Number', sortValue: (j) => j.number, render: (j) => <span className="font-mono text-sm font-semibold">{j.number}</span> },
    { key: 'date', header: 'Date', sortValue: (j) => j.date, render: (j) => <span className="text-mist">{formatDate(j.date)}</span> },
    { key: 'desc', header: 'Description', sortValue: (j) => j.description, render: (j) => <span className="font-semibold">{j.description}</span> },
    { key: 'lines', header: 'Lines', sortValue: (j) => j.lines.length, align: 'center', render: (j) => j.lines.length },
    { key: 'amount', header: 'Amount', sortValue: (j) => voucherTotal(j), align: 'right', render: (j) => <span className="font-semibold">{formatGhs(voucherTotal(j))}</span> },
    { key: 'status', header: 'Status', sortValue: (j) => j.status, render: (j) => <VoucherStatusBadge status={j.status} /> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (j) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => setEditing({ id: j.id, number: j.number, date: j.date, description: j.description, lines: j.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ? String(l.debit) : '', credit: l.credit ? String(l.credit) : '' })), status: j.status, notes: j.notes || '' })}><Pencil className="size-4" /></button>}
          {canManage && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(j)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing({ number: nextNumber('JV', journals), date: new Date().toISOString().slice(0, 10), description: '', lines: [{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }], status: accountingSettings.autoPost ? 'posted' : 'draft', notes: '' })

  const setLine = (i: number, patch: Partial<Line>) => setEditing((e) => e && ({ ...e, lines: e.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }))

  const totalDebit = editing ? editing.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0) : 0
  const totalCredit = editing ? editing.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0) : 0
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff < 0.005 && totalDebit > 0

  const save = () => {
    if (!editing) return
    if (!editing.description.trim()) { toast.error('Enter a description.'); return }
    const lines: JournalLine[] = editing.lines
      .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }))
      .filter((l) => l.accountId && (l.debit > 0 || l.credit > 0))
    if (lines.length < 2) { toast.error('Add at least two lines (a debit and a credit).'); return }
    const d = lines.reduce((s, l) => s + l.debit, 0)
    const c = lines.reduce((s, l) => s + l.credit, 0)
    if (Math.abs(d - c) >= 0.005) { toast.error('Debits and credits must balance.'); return }

    const isNew = !editing.id
    upsertJournal({
      id: editing.id || uid('jv'),
      number: editing.number.trim(),
      date: editing.date,
      description: editing.description.trim(),
      lines,
      status: editing.status,
      notes: editing.notes.trim() || undefined,
      createdAt: isNew ? new Date().toISOString() : (journals.find((j) => j.id === editing.id)?.createdAt || new Date().toISOString()),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'JournalVoucher', `${isNew ? 'Created' : 'Updated'} ${editing.number} — ${formatGhs(d)}`)
    toast.success(isNew ? 'Journal voucher created' : 'Journal voucher updated')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteJournal(deleting.id)
    log(user?.id || 'system', 'DELETE', 'JournalVoucher', `Deleted ${deleting.number}`)
    toast.success('Journal voucher deleted')
    setDeleting(null)
  }

  const exportRows = rows.map((j) => ({ number: j.number, date: j.date, description: j.description, amount: voucherTotal(j), lines: j.lines.length, status: j.status }))

  return (
    <div>
      <PageHeader
        title="Journal voucher"
        desc="Manual double-entry journals with balancing debits and credits."
        actions={
          <>
            <ExportButtons filename="journal-vouchers" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && <Button onClick={openNew}><Plus className="size-4" /> New journal</Button>}
          </>
        }
      />
      <div className="mb-4"><SearchField value={q} onChange={setQ} placeholder="Search number, description…" className="w-full max-w-sm" /></div>

      <div className="card">
        <DataTable columns={columns} data={rows} rowKey={(j) => j.id} emptyTitle="No journal vouchers" emptyDesc="Create your first journal with the New journal button." />
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit journal voucher' : 'New journal voucher'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Voucher number" required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" /></Field>
              <Field label="Date"><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
              <Field label="Status"><StatusSelect value={editing.status} onChange={(v) => setEditing({ ...editing, status: v })} /></Field>
            </div>
            <Field label="Description" required><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[13px] font-bold">Lines</p>
                <Button size="sm" variant="ghost" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { accountId: '', debit: '', credit: '' }] })}><Plus className="size-4" /> Add line</Button>
              </div>
              <div className="mb-1 grid grid-cols-[1fr_100px_100px_36px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-mist">
                <span>Account</span><span>Debit</span><span>Credit</span><span />
              </div>
              <div className="space-y-2">
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_36px] items-center gap-2">
                    <AccountSelect accounts={accounts} value={l.accountId} onChange={(v) => setLine(i, { accountId: v })} />
                    <Input aria-label="Debit" type="number" min={0} value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} />
                    <Input aria-label="Credit" type="number" min={0} value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} />
                    <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, idx) => idx !== i) })}><X className="size-4" /></button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-end gap-6 text-sm">
                <span>Debit total: <span className="font-semibold">{formatGhsExact(totalDebit)}</span></span>
                <span>Credit total: <span className="font-semibold">{formatGhsExact(totalCredit)}</span></span>
                <span className={balanced ? 'font-semibold text-lime' : 'font-semibold text-ember'}>{balanced ? 'Balanced' : 'Unbalanced'}</span>
              </div>
            </div>

            <Field label="Notes"><Textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing.id ? 'Save voucher' : 'Create voucher'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete journal voucher?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-mono font-semibold">{deleting.number}</span> ({formatGhs(voucherTotal(deleting))})? This cannot be undone.</p>
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
