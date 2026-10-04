import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, MoreVertical, Filter } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Textarea, DatePicker, SearchField } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatDate, uid } from '../../../lib/utils'
import { loadLeaveTxns, saveLeaveTxns, type BalanceTxn } from '../../../lib/leaveExtras'

const KIND_PILL: Record<BalanceTxn['kind'], { cls: string }> = {
  accrual: { cls: 'bg-lime/15 text-green-700 dark:text-lime' },
  adjustment: { cls: 'bg-sky-500/10 text-sky-600' },
  carryover: { cls: 'bg-violet-500/10 text-violet-600' },
  deduction: { cls: 'bg-rose-500/10 text-ember' },
}

type Form = { id?: string; staffUserId: string; leaveTypeId: string; kind: BalanceTxn['kind']; days: string; date: string; note: string }

export function BalanceTransactionsPage() {
  const { users, leaveTypes, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')

  const [txns, setTxns] = useState<BalanceTxn[]>(() => loadLeaveTxns())
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [staffId, setStaffId] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<BalanceTxn | null>(null)
  const [editing, setEditing] = useState<Form | null>(null)

  // close the kebab menu on outside click
  useEffect(() => {
    if (!menuId) return
    const close = () => setMenuId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuId])

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const typeName = (id: string) => leaveTypes.find((t) => t.id === id)?.name || id
  const typeColor = (id: string) => leaveTypes.find((t) => t.id === id)?.color || '#71717a'

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...txns]
      .filter((t) => (!kind || t.kind === kind) && (!staffId || t.staffUserId === staffId))
      .filter((t) => !ql || `${staffName(t.staffUserId)} ${typeName(t.leaveTypeId)} ${t.kind} ${t.note || ''}`.toLowerCase().includes(ql))
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [txns, q, kind, staffId, users, leaveTypes])

  const persist = (next: BalanceTxn[]) => { setTxns(next); saveLeaveTxns(next) }

  const save = () => {
    if (!editing) return
    const days = Number(editing.days)
    if (!editing.staffUserId || !editing.leaveTypeId) { toast.error('Pick an employee and a leave type.'); return }
    if (!Number.isFinite(days) || days === 0) { toast.error('Days must be a non-zero number (use negatives for deductions).'); return }
    const rec: BalanceTxn = {
      id: editing.id || uid('ltx'), staffUserId: editing.staffUserId, leaveTypeId: editing.leaveTypeId,
      kind: editing.kind, days, date: editing.date, note: editing.note.trim() || undefined,
      refId: editing.id ? txns.find((t) => t.id === editing.id)?.refId : undefined,
    }
    persist(editing.id ? txns.map((t) => (t.id === rec.id ? rec : t)) : [...txns, rec])
    log(user?.id || 'system', editing.id ? 'UPDATE' : 'CREATE', 'LeaveBalance', `${rec.kind} ${days}d ${typeName(rec.leaveTypeId)} for ${staffName(rec.staffUserId)}`)
    toast.success(editing.id ? 'Transaction updated' : 'Balance transaction recorded')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    persist(txns.filter((t) => t.id !== deleting.id))
    log(user?.id || 'system', 'DELETE', 'LeaveBalance', `Deleted ${deleting.kind} txn for ${staffName(deleting.staffUserId)}`)
    toast.success('Transaction deleted')
    setDeleting(null)
  }

  const columns: Column<BalanceTxn>[] = [
    { key: 'employee', header: 'Employee', sortValue: (t) => staffName(t.staffUserId), render: (t) => <span className="font-semibold">{staffName(t.staffUserId)}</span> },
    {
      key: 'type', header: 'Leave Type', sortValue: (t) => typeName(t.leaveTypeId),
      render: (t) => <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${typeColor(t.leaveTypeId)}22`, color: typeColor(t.leaveTypeId) }}>{typeName(t.leaveTypeId)}</span>,
    },
    { key: 'date', header: 'Date', sortValue: (t) => t.date, render: (t) => <span className="text-mist">{formatDate(t.date)}</span> },
    {
      key: 'kind', header: 'Kind', sortValue: (t) => t.kind,
      render: (t) => <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${KIND_PILL[t.kind].cls}`}>{t.kind}</span>,
    },
    {
      key: 'days', header: 'Days', align: 'right', sortValue: (t) => t.days,
      render: (t) => <span className={`font-extrabold tabular-nums ${t.days < 0 ? 'text-ember' : 'text-green-700 dark:text-lime'}`}>{t.days > 0 ? `+${t.days}` : t.days}</span>,
    },
    { key: 'note', header: 'Note', sortValue: (t) => t.note || '', render: (t) => <span className="block max-w-56 truncate text-mist">{t.note || '—'}</span> },
    {
      key: 'actions', header: 'Actions', align: 'right',
      render: (t) => canManage ? (
        <span className="relative inline-block">
          <button type="button" className="rounded-lg p-2 text-mist transition hover:bg-black/5 dark:hover:bg-white/5" aria-label={`Actions for ${t.id}`} onClick={(e) => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id) }}>
            <MoreVertical className="size-4" />
          </button>
          {menuId === t.id && (
            <span className="absolute right-0 z-30 mt-1 w-36 overflow-hidden rounded-xl border border-line bg-white py-1 text-left shadow-lg dark:bg-zinc-900">
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-ember hover:bg-rose-500/10" onClick={(e) => { e.stopPropagation(); setMenuId(null); setDeleting(t) }}>
                <Trash2 className="size-4" /> Delete
              </button>
            </span>
          )}
        </span>
      ) : <span className="text-mist">—</span>,
    },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span>Leave</span><span>/</span><span className="font-semibold text-inherit">Balance Transactions</span>
      </div>
      <PageHeader
        title="Balance Transactions"
        desc="The ledger behind every leave balance: annual accruals, carry-overs, manual adjustments and deductions."
        actions={<span className="flex items-center gap-2">
          {canManage && <Button onClick={() => setEditing({ staffUserId: users[0]?.id || '', leaveTypeId: leaveTypes[0]?.id || '', kind: 'adjustment', days: '', date: new Date().toISOString().slice(0, 10), note: '' })}><Plus className="size-4" /> Add Transaction</Button>}
          <ExportButtons
            filename="leave-balance-transactions"
            rows={filtered.map((t) => ({ Employee: staffName(t.staffUserId), 'Leave Type': typeName(t.leaveTypeId), Date: t.date, Kind: t.kind, Days: t.days, Note: t.note || '' }))}
            onDone={(label, ok) => (ok ? toast.success(`${label} export started`) : toast.error('Export blocked'))}
          />
        </span>}
      />

      <div className="card overflow-hidden">
        {/* search + filter funnel */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line p-3">
          <SearchField value={q} onChange={setQ} placeholder="Search here…" className="w-full sm:w-72" />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`grid size-9 place-items-center rounded-lg border border-line transition ${showFilters ? 'bg-black text-white dark:bg-lime dark:text-black' : 'text-mist hover:text-inherit'}`}
            aria-label="Toggle filters" title="Filters"
          >
            <Filter className="size-4" />
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-black/[0.02] p-3 dark:bg-white/[0.03]">
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-52" aria-label="Employee filter">
              <option value="">All employees</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-44" aria-label="Kind filter">
              <option value="">All kinds</option>
              <option value="accrual">Accrual</option><option value="adjustment">Adjustment</option>
              <option value="carryover">Carry-over</option><option value="deduction">Deduction</option>
            </Select>
          </div>
        )}
        <div className="p-3 pt-1">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(t) => t.id}
            pageSize={10}
            emptyTitle="No balance transactions yet"
            emptyDesc="Accruals are implied from Leave Policies for the current year; record manual movements here."
          />
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Add balance transaction">
        {editing && (
          <div className="grid gap-3">
            <Field label="Employee" required>
              <Select value={editing.staffUserId} onChange={(e) => setEditing({ ...editing, staffUserId: e.target.value })}>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Leave type" required>
                <Select value={editing.leaveTypeId} onChange={(e) => setEditing({ ...editing, leaveTypeId: e.target.value })}>
                  {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
              <Field label="Kind">
                <Select value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as BalanceTxn['kind'] })}>
                  <option value="accrual">Accrual</option><option value="adjustment">Adjustment</option>
                  <option value="carryover">Carry-over</option><option value="deduction">Deduction</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Days (negative to deduct)" required><Input type="number" step="0.5" value={editing.days} onChange={(e) => setEditing({ ...editing, days: e.target.value })} placeholder="e.g. 3 or -1" /></Field>
              <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
            </div>
            <Field label="Note"><Textarea rows={2} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Reason / reference" /></Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>Save transaction</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete transaction?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Remove {deleting.days > 0 ? `+${deleting.days}` : deleting.days} day(s) {deleting.kind} ({typeName(deleting.leaveTypeId)}) for <span className="font-semibold text-inherit">{staffName(deleting.staffUserId)}</span>?</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
