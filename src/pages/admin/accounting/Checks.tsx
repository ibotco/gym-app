import { useMemo, useState } from 'react'
import { Plus, Search, RotateCcw, Eye, Pencil, Printer, Trash2, Download, ChevronRight, CheckSquare, CalendarCheck, Clock, Banknote, FileCheck2, XCircle, CheckCircle2, Ban, AlertOctagon } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate, uid } from '../../../lib/utils'
import { isCashOrBankAccount, accountLabel } from './common'
import { printTable } from './common'
import type { ChequeEntry, ChequeDirection, ChequeStatus } from '../../../types'

type Form = {
  id?: string
  number: string
  direction: ChequeDirection
  bankAccountId: string
  date: string
  clearedDate: string
  party: string
  amount: string
  status: ChequeStatus
  referenceNo: string
  notes: string
}

const blank = (): Form => ({
  number: '', direction: 'issued', bankAccountId: '',
  date: new Date().toISOString().slice(0, 10), clearedDate: '',
  party: '', amount: '', status: 'issued', referenceNo: '', notes: '',
})

const STATUSES: { id: ChequeStatus; label: string; tone: 'lime' | 'zinc' | 'rose' | 'sky' | 'amber' }[] = [
  { id: 'issued', label: 'Issued', tone: 'sky' },
  { id: 'received', label: 'Received', tone: 'zinc' },
  { id: 'cleared', label: 'Cleared', tone: 'lime' },
  { id: 'cancelled', label: 'Cancelled', tone: 'amber' },
  { id: 'bounced', label: 'Bounced', tone: 'rose' },
  { id: 'void', label: 'Void', tone: 'zinc' },
]

function statusBadge(s: ChequeStatus) {
  const def = STATUSES.find((x) => x.id === s)
  return <Badge tone={def?.tone || 'zinc'}>{def?.label || s}</Badge>
}

function fmtD(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function ChecksPage() {
  const { cheques, accounts, banks, company, upsertCheque, deleteCheque, log } = useApp()
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [status, setStatusFilter] = useState<'' | ChequeStatus>('')
  const [direction, setDirection] = useState<'' | ChequeDirection>('')
  const [bankFilter, setBankFilter] = useState('')
  const [q, setQ] = useState('')

  const [editing, setEditing] = useState<Form | null>(null)
  const [viewing, setViewing] = useState<ChequeEntry | null>(null)
  const [deleting, setDeleting] = useState<ChequeEntry | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulk, setShowBulk] = useState(false)

  // Cash/bank accounts list for the bank dropdown.
  const bankOptions = useMemo(
    () => accounts.filter((a) => isCashOrBankAccount(a) && (a.status || 'active') === 'active'),
    [accounts],
  )
  const bankName = (id: string) => {
    const a = accounts.find((x) => x.id === id)
    if (!a) return id
    return a.bank ? `${a.bank} — ${a.name}` : a.name
  }

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...cheques]
      .filter((c) => {
        if (start && c.date < start) return false
        if (end && c.date > end) return false
        if (status && c.status !== status) return false
        if (direction && c.direction !== direction) return false
        if (bankFilter && c.bankAccountId !== bankFilter) return false
        if (ql && ![c.number, c.party, c.referenceNo || '', c.notes || ''].join(' ').toLowerCase().includes(ql)) return false
        return true
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
  }, [cheques, start, end, status, direction, bankFilter, q])

  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id))
  const toggleOne = (id: string) => {
    setShowBulk(false)
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  const toggleAll = () => {
    setShowBulk(false)
    setSelected((s) => {
      const n = new Set(s)
      if (allSelected) rows.forEach((c) => n.delete(c.id))
      else rows.forEach((c) => n.add(c.id))
      return n
    })
  }

  const totalIssued = cheques.filter((c) => c.direction === 'issued' && c.status !== 'void' && c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0)
  const totalReceived = cheques.filter((c) => c.direction === 'received' && c.status !== 'void' && c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0)
  const outstanding = cheques.filter((c) => c.status === 'issued' || c.status === 'received').reduce((s, c) => s + c.amount, 0)
  const cleared = cheques.filter((c) => c.status === 'cleared').reduce((s, c) => s + c.amount, 0)

  const openNew = () => setEditing(blank())
  const openEdit = (c: ChequeEntry) => setEditing({
    id: c.id, number: c.number, direction: c.direction, bankAccountId: c.bankAccountId,
    date: c.date, clearedDate: c.clearedDate || '', party: c.party, amount: String(c.amount),
    status: c.status, referenceNo: c.referenceNo || '', notes: c.notes || '',
  })

  const resetFilters = () => {
    setStart(''); setEnd(''); setStatusFilter(''); setDirection(''); setBankFilter(''); setQ('')
  }

  const save = () => {
    if (!editing) return
    if (!editing.number.trim()) { toast.error('Enter the cheque number.'); return }
    if (!editing.bankAccountId) { toast.error('Select the bank account.'); return }
    if (!editing.party.trim()) { toast.error(editing.direction === 'issued' ? 'Enter the payee.' : 'Enter the payer.'); return }
    const amount = Number(editing.amount)
    if (!(amount > 0)) { toast.error('Enter a valid amount.'); return }
    const isNew = !editing.id
    const entry: ChequeEntry = {
      id: editing.id || uid('chq'),
      number: editing.number.trim(),
      direction: editing.direction,
      bankAccountId: editing.bankAccountId,
      date: editing.date,
      clearedDate: editing.clearedDate || undefined,
      party: editing.party.trim(),
      amount,
      status: editing.status,
      referenceNo: editing.referenceNo.trim() || undefined,
      notes: editing.notes.trim() || undefined,
      createdBy: isNew ? user?.id : (cheques.find((c) => c.id === editing.id)?.createdBy || user?.id),
      createdAt: isNew ? new Date().toISOString() : (cheques.find((c) => c.id === editing.id)?.createdAt || new Date().toISOString()),
    }
    upsertCheque(entry)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Cheque', `${isNew ? 'Created' : 'Updated'} cheque ${entry.number} — ${formatGhs(amount)}`)
    toast.success(isNew ? 'Cheque recorded' : 'Cheque updated', entry.number)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteCheque(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Cheque', `Deleted cheque ${deleting.number}`)
    toast.success('Cheque deleted', deleting.number)
    setDeleting(null)
  }

  const markBulk = (s: ChequeStatus) => {
    cheques.filter((c) => selected.has(c.id)).forEach((c) => upsertCheque({ ...c, status: s, clearedDate: s === 'cleared' ? (c.clearedDate || new Date().toISOString().slice(0, 10)) : c.clearedDate }))
    toast.success(`${selected.size} cheque(s) marked ${s}`)
    setSelected(new Set()); setShowBulk(false)
  }
  const deleteBulk = () => {
    cheques.filter((c) => selected.has(c.id)).forEach((c) => deleteCheque(c.id))
    toast.success(`${selected.size} cheque(s) deleted`)
    setSelected(new Set()); setShowBulk(false)
  }

  const printList = () => {
    const sel = rows.filter((c) => selected.has(c.id))
    const list = sel.length ? sel : rows
    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const stamp = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    printTable({
      title: 'Checks / Cheques',
      subtitle: `${company.name} — ${list.length} record(s) — printed ${stamp}`,
      headers: [
        { label: 'Cheque No.', mono: true, width: '11%' },
        { label: 'Date', mono: true, width: '10%' },
        { label: 'Type', width: '8%' },
        { label: 'Bank Account', width: '22%' },
        { label: 'Party', width: '20%' },
        { label: 'Status', width: '9%' },
        { label: 'Cleared', mono: true, width: '10%' },
        { label: 'Amount', num: true, width: '10%' },
      ],
      rows: list.map((c) => [
        c.number,
        fmtD(c.date),
        c.direction === 'issued' ? 'Issued' : 'Received',
        bankName(c.bankAccountId),
        c.party,
        (STATUSES.find((s) => s.id === c.status)?.label || c.status),
        fmtD(c.clearedDate),
        formatGhsExact(c.amount),
      ]),
      totals: ['Total', '', '', '', '', '', '', formatGhsExact(list.reduce((s, c) => s + c.amount, 0))],
      footer: `Printed on ${stamp} · ${company.name}`,
    })
    setShowBulk(false)
  }

  const columns: Column<ChequeEntry>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = !allSelected && rows.some((c) => selected.has(c.id)) }}
          onChange={toggleAll}
          aria-label="Select all"
        />
      ),
      render: (c) => (
        <input
          type="checkbox"
          checked={selected.has(c.id)}
          onChange={() => toggleOne(c.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${c.number}`}
        />
      ),
    },
    { key: 'number', header: 'Cheque No.', sortValue: (c) => c.number, render: (c) => <span className="font-mono text-sm font-semibold">{c.number}</span> },
    { key: 'date', header: 'Date', sortValue: (c) => c.date, render: (c) => <span className="text-mist">{formatDate(c.date)}</span> },
    { key: 'dir', header: 'Type', sortValue: (c) => c.direction, render: (c) => (
      <Badge tone={c.direction === 'issued' ? 'rose' : 'lime'}>{c.direction === 'issued' ? 'Issued' : 'Received'}</Badge>
    ) },
    { key: 'bank', header: 'Bank Account', sortValue: (c) => bankName(c.bankAccountId), render: (c) => <span className="text-sm">{bankName(c.bankAccountId)}</span> },
    { key: 'party', header: 'Party', sortValue: (c) => c.party, render: (c) => <span className="font-semibold">{c.party}</span> },
    { key: 'ref', header: 'Reference', sortValue: (c) => c.referenceNo || '', render: (c) => <span className="font-mono text-xs text-mist">{c.referenceNo || '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (c) => c.status, render: (c) => statusBadge(c.status) },
    { key: 'cleared', header: 'Cleared', sortValue: (c) => c.clearedDate || '', render: (c) => <span className="text-mist">{c.clearedDate ? formatDate(c.clearedDate) : '—'}</span> },
    { key: 'amount', header: 'Amount', sortValue: (c) => c.amount, align: 'right', render: (c) => <span className="font-semibold">{formatGhsExact(c.amount)}</span> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (c) => (
        <span className="flex items-center gap-0.5 whitespace-nowrap">
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="View" onClick={() => setViewing(c)}><Eye className="size-4" /></button>
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(c)}><Pencil className="size-4" /></button>}
          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Print list" onClick={printList}><Printer className="size-4" /></button>
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(c)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const exportRows = rows.map((c) => ({
    'Cheque No.': c.number, 'Date': c.date, 'Type': c.direction, 'Bank': bankName(c.bankAccountId),
    'Party': c.party, 'Reference': c.referenceNo || '', 'Status': c.status, 'Cleared': c.clearedDate || '', Amount: c.amount,
    'Notes': c.notes || '',
  }))

  const sumCards = [
    { label: 'Total Cheques', value: String(cheques.length), icon: <FileCheck2 className="size-5" />, tint: 'text-sky-600 bg-sky-500/10' },
    { label: 'Total Issued', value: formatGhs(totalIssued), icon: <Banknote className="size-5" />, tint: 'text-rose-600 bg-rose-500/10' },
    { label: 'Total Received', value: formatGhs(totalReceived), icon: <Banknote className="size-5" />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Outstanding', value: formatGhs(outstanding), icon: <Clock className="size-5" />, tint: 'text-amber-600 bg-amber-500/10' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><ChevronRight className="size-3.5" /><span className="font-semibold text-inherit">Checks</span>
      </div>
      <PageHeader
        title="Checks"
        desc="Cheque register — track issued and received cheques through clearing."
        actions={
          <>
            <ExportButtons filename="cheque-register" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
            {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New Cheque</Button>}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sumCards.map((c) => (
          <div key={c.label} className="card flex items-center gap-3 p-4">
            <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${c.tint}`}>{c.icon}</div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-wider text-mist">{c.label}</p>
              <p className="stat-num mt-0.5 truncate text-xl md:text-2xl">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Start Date</label>
            <DatePicker value={start} onChange={setStart} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">End Date</label>
            <DatePicker value={end} onChange={setEnd} />
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Type</label>
            <Select value={direction} onChange={(e) => setDirection(e.target.value as '' | ChequeDirection)}>
              <option value="">All types</option>
              <option value="issued">Issued</option>
              <option value="received">Received</option>
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Status</label>
            <Select value={status} onChange={(e) => setStatusFilter(e.target.value as '' | ChequeStatus)}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <div className="xl:col-span-1">
            <label className="mb-1 block text-xs font-semibold text-mist">Bank Account</label>
            <Select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)}>
              <option value="">All bank accounts</option>
              {bankOptions.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
            </Select>
          </div>
          <div className="flex items-end gap-2 xl:col-span-1">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, party, ref…" className="flex-1" />
            <Button variant="outline" onClick={resetFilters} title="Reset filters"><RotateCcw className="size-4" /></Button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Cheques <span className="ml-1 text-xs font-normal text-mist">({rows.length} records)</span></p>
          <div className="flex items-center gap-2">
            {canManage && (
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowBulk((v) => !v)} disabled={!selected.size}>
                  Bulk Actions{selected.size ? ` (${selected.size})` : ''}
                </Button>
                {showBulk && selected.size > 0 && (
                  <div className="menu-pop absolute right-0 top-full z-30 mt-1 w-48 rounded-xl p-1.5">
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => markBulk('cleared')}><CheckCircle2 className="size-4" /> Mark Cleared</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => markBulk('cancelled')}><Ban className="size-4" /> Mark Cancelled</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => markBulk('bounced')}><AlertOctagon className="size-4" /> Mark Bounced</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => markBulk('void')}><XCircle className="size-4" /> Mark Void</button>
                    <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={printList}><Printer className="size-4" /> Print List</button>
                    {canDelete && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember" onClick={deleteBulk}><Trash2 className="size-4" /> Delete</button>}
                  </div>
                )}
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={resetFilters}>Show all</Button>
          </div>
        </div>
        <DataTable columns={columns} data={rows} rowKey={(c) => c.id} emptyTitle="No cheques recorded" emptyDesc="Record your first cheque with the New Cheque button." />
      </div>

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.number ? `Cheque ${viewing.number}` : 'Cheque'} wide>
        {viewing && (
          <div className="space-y-3">
            <div className="rounded-xl bg-white p-6 text-sm text-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-bold">{company.name}</p>
                  <p className="text-xs text-zinc-500">Cheque Register</p>
                </div>
                <div className="text-right">
                  <p className="font-bold uppercase tracking-wide text-sky-600">{viewing.direction === 'issued' ? 'Cheque Issued' : 'Cheque Received'}</p>
                  <p className="font-mono text-xs text-zinc-500">{viewing.number}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(viewing.date)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
                {[
                  ['Bank account', bankName(viewing.bankAccountId)],
                  [viewing.direction === 'issued' ? 'Payee' : 'Payer', viewing.party],
                  ['Amount', formatGhsExact(viewing.amount)],
                  ['Status', (STATUSES.find((s) => s.id === viewing.status)?.label || viewing.status)],
                  ['Reference', viewing.referenceNo || '—'],
                  ['Cleared date', viewing.clearedDate ? formatDate(viewing.clearedDate) : '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-zinc-100 py-1.5">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-400">{k}</span>
                    <span className="text-right text-xs font-semibold">{v}</span>
                  </div>
                ))}
              </div>
              {viewing.notes && <p className="mt-3 text-xs text-zinc-600"><strong>Notes:</strong> {viewing.notes}</p>}
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={printList}><Printer className="size-4" /> Print List</Button>
              <Button variant="outline" onClick={printList}><Download className="size-4" /> Download PDF</Button>
              <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / edit */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit Cheque' : 'New Cheque'} wide>
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bank Account" required>
                <Select value={editing.bankAccountId} onChange={(e) => setEditing({ ...editing, bankAccountId: e.target.value })}>
                  <option value="">Please Select…</option>
                  {bankOptions.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" required><DatePicker value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} /></Field>
                <Field label="Cheque No." required><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="font-mono" /></Field>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Type" required>
                <Select value={editing.direction} onChange={(e) => {
                  const d = e.target.value as ChequeDirection
                  const defStatus: ChequeStatus = d === 'issued' ? 'issued' : 'received'
                  setEditing({ ...editing, direction: d, status: editing.id ? editing.status : defStatus })
                }}>
                  <option value="issued">Issued (we wrote it)</option>
                  <option value="received">Received (we received it)</option>
                </Select>
              </Field>
              <Field label={editing.direction === 'issued' ? 'Payee' : 'Payer'} required>
                <Input value={editing.party} onChange={(e) => setEditing({ ...editing, party: e.target.value })} placeholder={editing.direction === 'issued' ? 'Pay to the order of…' : 'Received from…'} />
              </Field>
              <Field label="Amount" required>
                <Input type="number" min="0" step="any" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} />
              </Field>
              <Field label="Status" required>
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ChequeStatus })}>
                  {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="Reference No."><Input value={editing.referenceNo} onChange={(e) => setEditing({ ...editing, referenceNo: e.target.value })} placeholder="Voucher / invoice ref" /></Field>
              <Field label="Cleared Date"><DatePicker value={editing.clearedDate} onChange={(v) => setEditing({ ...editing, clearedDate: v })} /></Field>
            </div>

            <Field label="Notes"><Input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Memo / notes" /></Field>

            <div className="flex items-center justify-between border-t border-line pt-3">
              <div className="text-sm">
                <span className="text-mist">Amount</span>{' '}
                <span className="font-display text-lg font-bold">{formatGhsExact(Number(editing.amount) || 0)}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><CheckSquare className="size-4" /> Save Cheque</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete cheque?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete cheque <span className="font-mono font-semibold text-inherit">{deleting.number}</span> ({formatGhs(deleting.amount)})? This cannot be undone.</p>
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
