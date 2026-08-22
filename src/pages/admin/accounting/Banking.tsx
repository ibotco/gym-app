import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, RotateCcw, ChevronRight, Landmark, Download, Banknote, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { BANK_DETAIL_TYPES } from '../../../lib/accounting'
import type { BankAccount, BankSignatory } from '../../../types'

type BankForm = {
  id?: string; code: string; name: string; bank: string; accountNumber: string; branch: string
  parentId: string; type: BankAccount['type']; detailType: string; openingBalance: string; balance: string; status: 'active' | 'inactive'
}
type SignatoryForm = { id?: string; name: string; role: string; phone: string; email: string; status: 'active' | 'inactive' }

const blankBank = (): BankForm => ({ code: '', name: '', bank: '', accountNumber: '', branch: '', parentId: '', type: 'current', detailType: 'Checking', openingBalance: '', balance: '', status: 'active' })
const blankSignatory = (): SignatoryForm => ({ name: '', role: '', phone: '+233 ', email: '', status: 'active' })

type Tab = 'accounts' | 'deposit' | 'feeds' | 'signatory'

export function Banking() {
  const app = useApp()
  const { banks, signatories, receipts, accounts, upsertBank, deleteBank, upsertSignatory, deleteSignatory, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  const [tab, setTab] = useState<Tab>('accounts')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<BankForm | null>(null)
  const [deleting, setDeleting] = useState<BankAccount | null>(null)

  const [sigEditing, setSigEditing] = useState<SignatoryForm | null>(null)
  const [sigDeleting, setSigDeleting] = useState<BankSignatory | null>(null)

  // ---- Bank accounts ----
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return [...banks]
      .filter((b) => !ql || `${b.code} ${b.name} ${b.bank} ${b.accountNumber}`.toLowerCase().includes(ql))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name))
  }, [banks, q])

  const parentName = (id?: string) => (id ? banks.find((b) => b.id === id)?.name || '—' : '—')

  const columns: Column<BankAccount>[] = [
    {
      key: 'name', header: 'Name', sortValue: (b) => `${b.code} ${b.name}`,
      render: (b) => (
        <span className="flex items-center gap-1.5">
          {b.parentId && <span className="text-mist">└</span>}
          <span className="font-semibold">{b.code ? `${b.code} - ` : ''}{b.name}</span>
        </span>
      ),
    },
    { key: 'parent', header: 'Parent account', sortValue: (b) => parentName(b.parentId), render: (b) => <span className="text-mist">{b.parentId ? parentName(b.parentId) : '—'}</span> },
    { key: 'type', header: 'Type', sortValue: (b) => b.type, render: (b) => <Badge tone="zinc">{b.type === 'momo' ? 'Mobile money' : b.type === 'current' ? 'Bank' : 'Bank'}</Badge> },
    { key: 'detail', header: 'Detail type', sortValue: (b) => b.detailType || '', render: (b) => <span className="text-mist">{b.detailType || '—'}</span> },
    { key: 'primary', header: 'Primary Balance', sortValue: (b) => b.openingBalance, align: 'right', render: (b) => formatGhsExact(b.openingBalance) },
    { key: 'bankbal', header: 'Bank Balance', sortValue: (b) => b.balance, align: 'right', render: (b) => <span className="font-semibold">{formatGhsExact(b.balance)}</span> },
    { key: 'active', header: 'Active', sortValue: (b) => b.status, align: 'center', render: (b) => <Badge tone={b.status === 'active' ? 'lime' : 'zinc'}>{b.status === 'active' ? 'Yes' : 'No'}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (b) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(b)}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(b)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const openNew = () => setEditing(blankBank())
  const openEdit = (b: BankAccount) => setEditing({
    id: b.id, code: b.code || '', name: b.name, bank: b.bank, accountNumber: b.accountNumber, branch: b.branch || '',
    parentId: b.parentId || '', type: b.type, detailType: b.detailType || '', openingBalance: String(b.openingBalance), balance: String(b.balance), status: b.status,
  })

  const saveBank = () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.bank.trim() || !editing.accountNumber.trim()) { toast.error('Name, bank, and account number are required.'); return }
    const isNew = !editing.id
    upsertBank({
      id: editing.id || uid('bk'),
      code: editing.code.trim() || undefined,
      name: editing.name.trim(),
      bank: editing.bank.trim(),
      accountNumber: editing.accountNumber.trim(),
      branch: editing.branch.trim() || undefined,
      parentId: editing.parentId || undefined,
      type: editing.type,
      detailType: editing.detailType || undefined,
      openingBalance: Number(editing.openingBalance) || 0,
      balance: Number(editing.balance) || 0,
      status: editing.status,
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'BankAccount', `${isNew ? 'Created' : 'Updated'} ${editing.name}`)
    toast.success(isNew ? 'Bank account created' : 'Bank account updated')
    setEditing(null)
  }

  const doDeleteBank = () => {
    if (!deleting) return
    deleteBank(deleting.id)
    log(user?.id || 'system', 'DELETE', 'BankAccount', `Deleted ${deleting.name}`)
    toast.success('Bank account deleted')
    setDeleting(null)
  }

  // ---- Signatories ----
  const sigColumns: Column<BankSignatory>[] = [
    { key: 'name', header: 'Name', sortValue: (s) => s.name, render: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'role', header: 'Role', sortValue: (s) => s.role, render: (s) => <Badge tone="zinc">{s.role}</Badge> },
    { key: 'phone', header: 'Phone', sortValue: (s) => s.phone, render: (s) => <span className="text-mist">{s.phone}</span> },
    { key: 'email', header: 'Email', sortValue: (s) => s.email, render: (s) => <span className="text-mist">{s.email}</span> },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, render: (s) => <Badge tone={s.status === 'active' ? 'lime' : 'zinc'}>{s.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (s) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => setSigEditing({ id: s.id, name: s.name, role: s.role, phone: s.phone, email: s.email, status: s.status })}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setSigDeleting(s)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const saveSignatory = () => {
    if (!sigEditing) return
    if (!sigEditing.name.trim() || !sigEditing.role.trim()) { toast.error('Name and role are required.'); return }
    const isNew = !sigEditing.id
    upsertSignatory({ id: sigEditing.id || uid('sg'), name: sigEditing.name.trim(), role: sigEditing.role.trim(), phone: sigEditing.phone.trim(), email: sigEditing.email.trim(), status: sigEditing.status })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'BankSignatory', `${isNew ? 'Created' : 'Updated'} ${sigEditing.name}`)
    toast.success(isNew ? 'Signatory added' : 'Signatory updated')
    setSigEditing(null)
  }

  const doDeleteSignatory = () => {
    if (!sigDeleting) return
    deleteSignatory(sigDeleting.id)
    log(user?.id || 'system', 'DELETE', 'BankSignatory', `Deleted ${sigDeleting.name}`)
    toast.success('Signatory deleted')
    setSigDeleting(null)
  }

  // ---- Bank deposits (receipts with bank/momo method) ----
  const deposits = receipts.filter((r) => r.method === 'bank' || r.method === 'momo')

  const exportRows = rows.map((b) => ({
    Name: `${b.code ? b.code + ' - ' : ''}${b.name}`, 'Parent account': parentName(b.parentId), Type: b.type, 'Detail type': b.detailType || '',
    'Primary Balance': b.openingBalance, 'Bank Balance': b.balance, Active: b.status === 'active' ? 'Yes' : 'No',
  }))

  const tabs: { id: Tab; label: string; icon: typeof Landmark }[] = [
    { id: 'accounts', label: 'Bank Accounts', icon: Landmark },
    { id: 'deposit', label: 'Bank Deposit', icon: Banknote },
    { id: 'feeds', label: 'Banking Feeds', icon: Download },
    { id: 'signatory', label: 'Bank Signatory', icon: CheckCircle2 },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><ChevronRight className="size-3.5" /><span className="font-semibold text-inherit">Banking</span>
      </div>
      <PageHeader
        title="Bank Accounts"
        desc="Manage bank and mobile-money accounts, deposits, feeds, and signatories."
        actions={canManage && tab === 'accounts' ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button> : undefined}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left sub-nav */}
        <aside className="shrink-0 lg:w-48">
          <nav className="space-y-1">
            {tabs.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                >
                  <Icon className="size-4 shrink-0" />{t.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {tab === 'accounts' && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <SearchField value={q} onChange={setQ} placeholder="Search name, code, bank…" className="w-full max-w-sm" />
                <div className="ml-auto"><ExportButtons filename="bank-accounts" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} /></div>
              </div>
              <div className="card">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-sm font-semibold">Bank Accounts <span className="ml-1 text-xs font-normal text-mist">({rows.length})</span></p>
                </div>
                <DataTable columns={columns} data={rows} rowKey={(b) => b.id} emptyTitle="No bank accounts" emptyDesc="Add your first bank account." />
              </div>
            </>
          )}

          {tab === 'deposit' && (
            <div className="card">
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-semibold">Bank Deposits <span className="ml-1 text-xs font-normal text-mist">({deposits.length})</span></p>
              </div>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Voucher</th><th>Date</th><th>Received from</th><th>Method</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {deposits.map((r) => (
                      <tr key={r.id}>
                        <td className="font-mono text-sm font-semibold">{r.number}</td>
                        <td className="text-mist">{r.date}</td>
                        <td className="font-semibold">{r.receivedFrom}</td>
                        <td><Badge tone="zinc">{r.method}</Badge></td>
                        <td className="text-right font-semibold">{formatGhsExact(r.amount)}</td>
                        <td><Badge tone={r.status === 'posted' ? 'lime' : 'amber'}>{r.status}</Badge></td>
                      </tr>
                    ))}
                    {!deposits.length && <tr><td colSpan={6} className="py-6 text-center text-sm text-mist">No bank deposits recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'feeds' && (
            <div className="space-y-3">
              {banks.filter((b) => b.type !== 'momo').map((b) => (
                <div key={b.id} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><Landmark className="size-5" /></div>
                    <div>
                      <p className="font-semibold">{b.code ? `${b.code} - ` : ''}{b.name}</p>
                      <p className="text-xs text-mist">{b.bank} · {b.accountNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="lime">Connected</Badge>
                    <span className="text-xs text-mist">Last sync: just now</span>
                  </div>
                </div>
              ))}
              {!banks.some((b) => b.type !== 'momo') && <div className="card p-6 text-center text-sm text-mist">No banking feeds configured.</div>}
            </div>
          )}

          {tab === 'signatory' && (
            <>
              <div className="mb-3 flex justify-end">
                {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setSigEditing(blankSignatory())}><Plus className="size-4" /> Add signatory</Button>}
              </div>
              <div className="card">
                <DataTable columns={sigColumns} data={signatories} rowKey={(s) => s.id} emptyTitle="No signatories" emptyDesc="Add an authorised bank signatory." />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bank account modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit bank account' : 'Add bank account'} wide>
        {editing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Account code"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="font-mono" placeholder="e.g. 2003" /></Field>
              <Field label="Account name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Parent account">
                <Select value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })}>
                  <option value="">None (top-level)</option>
                  {banks.filter((b) => b.id !== editing.id).map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} - ` : ''}{b.name}</option>)}
                </Select>
              </Field>
              <Field label="Type">
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as BankAccount['type'] })}>
                  <option value="current">Bank</option>
                  <option value="savings">Savings</option>
                  <option value="momo">Mobile money</option>
                </Select>
              </Field>
              <Field label="Detail type">
                <Select value={editing.detailType} onChange={(e) => setEditing({ ...editing, detailType: e.target.value })}>
                  <option value="">None</option>
                  {BANK_DETAIL_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              </Field>
              <Field label="Bank" required><Input value={editing.bank} onChange={(e) => setEditing({ ...editing, bank: e.target.value })} /></Field>
              <Field label="Account number" required><Input value={editing.accountNumber} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} className="font-mono" /></Field>
              <Field label="Branch"><Input value={editing.branch} onChange={(e) => setEditing({ ...editing, branch: e.target.value })} /></Field>
              <Field label="Primary balance (GHS)"><Input type="number" value={editing.openingBalance} onChange={(e) => setEditing({ ...editing, openingBalance: e.target.value })} /></Field>
              <Field label="Bank balance (GHS)"><Input type="number" value={editing.balance} onChange={(e) => setEditing({ ...editing, balance: e.target.value })} /></Field>
              <Field label="Active">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">Yes</option>
                  <option value="inactive">No</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveBank}>{editing.id ? 'Save account' : 'Add account'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete bank account?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDeleteBank}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Signatory modal */}
      <Modal open={!!sigEditing} onClose={() => setSigEditing(null)} title={sigEditing?.id ? 'Edit signatory' : 'Add signatory'} wide>
        {sigEditing && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required><Input value={sigEditing.name} onChange={(e) => setSigEditing({ ...sigEditing, name: e.target.value })} /></Field>
              <Field label="Role" required><Input value={sigEditing.role} onChange={(e) => setSigEditing({ ...sigEditing, role: e.target.value })} placeholder="e.g. Director" /></Field>
              <Field label="Phone"><Input value={sigEditing.phone} onChange={(e) => setSigEditing({ ...sigEditing, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={sigEditing.email} onChange={(e) => setSigEditing({ ...sigEditing, email: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={sigEditing.status} onChange={(e) => setSigEditing({ ...sigEditing, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSigEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveSignatory}>{sigEditing.id ? 'Save signatory' : 'Add signatory'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!sigDeleting} onClose={() => setSigDeleting(null)} title="Delete signatory?">
        {sigDeleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete signatory <span className="font-semibold">{sigDeleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSigDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDeleteSignatory}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
