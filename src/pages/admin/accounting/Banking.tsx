import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search, RotateCcw, ChevronRight, Landmark, Download, Banknote, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, SearchField, Textarea, Switch, DatePicker } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, uid } from '../../../lib/utils'
import { COUNTRIES } from '../../../lib/geo'
import { Settings2 } from 'lucide-react'
import type { BankAccount, BankSignatory } from '../../../types'
import { accountLabel } from './common'

type BankForm = {
  id?: string; code: string; name: string; bank: string; accountNumber: string; branch: string
  parentId: string; type: BankAccount['type']; detailType: string; openingBalance: string; balance: string; status: 'active' | 'inactive'
  noteNo: string; fundId: string; description: string; routing: string; contactNo: string; email: string; country: string
}

/** Common Ghana banks + mobile-money issuers offered in the Bank dropdown. */
const BANK_OPTIONS = [
  'GCB Bank', 'Ecobank Ghana', 'Stanbic Bank', 'Absa Bank Ghana', 'Fidelity Bank', 'CalBank',
  'Zenith Bank Ghana', 'Standard Chartered Ghana', 'Access Bank Ghana', 'UBA Ghana',
  'Agricultural Development Bank', 'National Investment Bank', 'Consolidated Bank Ghana',
  'Republic Bank Ghana', 'Société Générale Ghana', 'Prudential Bank', 'OmniBSIC Bank',
  'GTBank Ghana', 'First National Bank Ghana', 'Bank of Africa Ghana',
  'MTN Mobile Money', 'Telecel Cash', 'AT Money',
]
type SignatoryForm = {
  id?: string; bankName: string; bankAccountId: string; name: string; role: string; signatoryType: string; signatoryOrder: string
  phone: string; email: string; status: 'active' | 'inactive'
}

const DEFAULT_SIGNATORY_TYPES = ['Sole Signatory', 'Class A', 'Class B', 'Joint']
const SIGNATORY_TYPES_KEY = 'fitpro_signatory_types_v2'

const loadSignatoryTypes = (): string[] => {
  try {
    const raw = localStorage.getItem(SIGNATORY_TYPES_KEY)
    const parsed = raw ? (JSON.parse(raw) as string[]) : null
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SIGNATORY_TYPES
  } catch { return DEFAULT_SIGNATORY_TYPES }
}
const SIGNATORY_ORDERS = ['1st', '2nd', '3rd', '4th', '5th', '6th']

/** Mask an account number like the bank mandate forms: xxxxxxxxx5243. */
const maskAccount = (n?: string) => (n ? `xxxxxxxxx${n.slice(-4)}` : '')

const blankBank = (): BankForm => ({ code: '', name: '', bank: '', accountNumber: '', branch: '', parentId: '', type: 'current', detailType: 'Checking', openingBalance: '', balance: '', status: 'active', noteNo: '', fundId: '', description: '', routing: '', contactNo: '', email: '', country: 'Ghana' })
const blankSignatory = (): SignatoryForm => ({ bankName: '', bankAccountId: '', name: '', role: '', signatoryType: '', signatoryOrder: '', phone: '', email: '', status: 'active' })

type Tab = 'accounts' | 'deposit' | 'feeds' | 'signatory'

export function Banking() {
  const app = useApp()
  const { banks, signatories, receipts, paymentVouchers, accounts, funds, upsertBank, deleteBank, upsertSignatory, deleteSignatory, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')
  const canDelete = hasRole('super_admin', 'gym_manager')

  const [tab, setTab] = useState<Tab>('accounts')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<BankForm | null>(null)
  const [deleting, setDeleting] = useState<BankAccount | null>(null)

  // List controls (page size, pagination, row selection, bulk actions)
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [showBulk, setShowBulk] = useState(false)

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

  // Pagination + selection helpers for the accounts list
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const curPage = Math.min(page, totalPages)
  const paged = rows.slice((curPage - 1) * pageSize, curPage * pageSize)
  const allSelected = paged.length > 0 && paged.every((b) => selected.includes(b.id))
  const toggleAll = () => {
    setShowBulk(false) // selecting rows only ENABLES Bulk Actions — the menu opens on click
    setSelected(allSelected ? selected.filter((id) => !paged.some((b) => b.id === id)) : [...new Set([...selected, ...paged.map((b) => b.id)])])
  }
  const toggleOne = (id: string) => {
    setShowBulk(false)
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const setStatusBulk = (status: 'active' | 'inactive') => {
    banks.filter((b) => selected.includes(b.id)).forEach((b) => upsertBank({ ...b, status }))
    toast.success(`${selected.length} account(s) ${status === 'active' ? 'activated' : 'deactivated'}`)
    setSelected([]); setShowBulk(false)
  }
  const deleteBulk = () => {
    banks.filter((b) => selected.includes(b.id)).forEach((b) => deleteBank(b.id))
    toast.success(`${selected.length} account(s) deleted`)
    setSelected([]); setShowBulk(false)
  }

  const openNew = () => setEditing(blankBank())
  const openEdit = (b: BankAccount) => setEditing({
    id: b.id, code: b.code || '', name: b.name, bank: b.bank, accountNumber: b.accountNumber, branch: b.branch || '',
    parentId: b.parentId || '', type: b.type, detailType: b.detailType || '', openingBalance: String(b.openingBalance), balance: String(b.balance), status: b.status,
    noteNo: b.noteNo || '', fundId: b.fundId || '', description: b.description || '', routing: b.routing || '',
    contactNo: b.contactNo || '', email: b.email || '', country: b.country || 'Ghana',
  })

  // ---- Banking feeds (statement lines derived from income/expense vouchers) ----
  const [feedAccountId, setFeedAccountId] = useState('')
  const [feedFrom, setFeedFrom] = useState('')
  const [feedTo, setFeedTo] = useState('')
  const [feedStatus, setFeedStatus] = useState<'uncleared' | 'cleared' | 'all'>('uncleared')
  const [feedPageSize, setFeedPageSize] = useState(25)
  const [feedPage, setFeedPage] = useState(1)
  const [feedSortDesc, setFeedSortDesc] = useState(true)

  type FeedRow = { id: string; date: string; payee: string; description: string; withdrawal: number; deposit: number; cleared: boolean }
  const feedRows: FeedRow[] = useMemo(() => {
    const rowsIn: FeedRow[] = receipts
      .filter((rv) => !feedAccountId || rv.depositAccountId === feedAccountId)
      .map((rv) => ({ id: rv.id, date: rv.date, payee: rv.receivedFrom, description: rv.description || rv.number, withdrawal: 0, deposit: rv.amount, cleared: rv.status === 'posted' }))
    const rowsOut: FeedRow[] = paymentVouchers
      .filter((pv) => !feedAccountId || pv.paymentAccountId === feedAccountId)
      .map((pv) => ({ id: pv.id, date: pv.date, payee: pv.paidTo, description: pv.description || pv.number, withdrawal: pv.amount, deposit: 0, cleared: pv.status === 'posted' }))
    return [...rowsIn, ...rowsOut]
      .filter((x) => (!feedFrom || x.date >= feedFrom) && (!feedTo || x.date <= feedTo))
      .filter((x) => feedStatus === 'all' || (feedStatus === 'cleared' ? x.cleared : !x.cleared))
      .sort((a, b) => (feedSortDesc ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))
  }, [receipts, paymentVouchers, feedAccountId, feedFrom, feedTo, feedStatus, feedSortDesc])
  const feedTotalPages = Math.max(1, Math.ceil(feedRows.length / feedPageSize))
  const feedCurPage = Math.min(feedPage, feedTotalPages)
  const feedPaged = feedRows.slice((feedCurPage - 1) * feedPageSize, feedCurPage * feedPageSize)
  const feedAccounts = accounts.filter((a) => a.type === 'asset' && /cash|bank|momo|mobile money|petty|card|wallet/i.test(`${a.detailType || ''} ${a.name}`))

  // Signatory types managed from the Bank Signatory form (gear button).
  // The whole list — defaults included — can be renamed or, when unused, deleted.
  const [sigTypes, setSigTypes] = useState<string[]>(() => loadSignatoryTypes())
  const [showSigTypes, setShowSigTypes] = useState(false)
  const [newSigType, setNewSigType] = useState('')
  const [renamingType, setRenamingType] = useState<string | null>(null)
  const sigTypeOptions = useMemo(() => {
    const set = new Set<string>([...sigTypes, ...signatories.map((x) => x.signatoryType || '').filter(Boolean)])
    return Array.from(set)
  }, [sigTypes, signatories])
  const saveSigTypes = (list: string[]) => {
    setSigTypes(list)
    try { localStorage.setItem(SIGNATORY_TYPES_KEY, JSON.stringify(list)) } catch { /* ignore */ }
  }

  // Custom bank names added on the fly via the gear button next to Bank.
  const [customBanks, setCustomBanks] = useState<string[]>([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const bankOptions = useMemo(() => {
    const set = new Set<string>([...BANK_OPTIONS, ...customBanks, ...banks.map((b) => b.bank).filter(Boolean)])
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [customBanks, banks])

  const saveBank = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter the account name.'); return }
    if (!editing.fundId) { toast.error('Select a fund.'); return }
    if (!editing.bank.trim()) { toast.error('Select a bank.'); return }
    if (!editing.accountNumber.trim()) { toast.error('Enter the bank account number.'); return }
    if (!editing.branch.trim()) { toast.error('Enter the bank branch.'); return }
    if (!editing.country) { toast.error('Select a country.'); return }
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
      noteNo: editing.noteNo.trim() || undefined,
      fundId: editing.fundId || undefined,
      description: editing.description.trim() || undefined,
      routing: editing.routing.trim() || undefined,
      contactNo: editing.contactNo.trim() || undefined,
      email: editing.email.trim() || undefined,
      country: editing.country || undefined,
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
  const sigAccount = (id?: string) => banks.find((b) => b.id === id || (!!id && b.id === id.replace(/^bk_/, 'ac_')))
  const sigColumns: Column<BankSignatory>[] = [
    { key: 'bank', header: 'Bank Name', sortValue: (s) => sigAccount(s.bankAccountId)?.bank || '', render: (s) => <span className="font-semibold">{sigAccount(s.bankAccountId)?.bank || '—'}</span> },
    {
      key: 'account', header: 'Account', sortValue: (s) => sigAccount(s.bankAccountId)?.name || '',
      render: (s) => {
        const a = sigAccount(s.bankAccountId)
        return a ? <span className="font-mono text-xs">{maskAccount(a.accountNumber)}<span className="ml-1 font-sans text-mist">{a.name}</span></span> : <span className="text-mist">—</span>
      },
    },
    { key: 'name', header: "Signatory's Name", sortValue: (s) => s.name, render: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'type', header: 'Type', sortValue: (s) => s.signatoryType || '', render: (s) => s.signatoryType ? <Badge tone="zinc">{s.signatoryType}</Badge> : <span className="text-mist">—</span> },
    { key: 'order', header: 'Order', sortValue: (s) => s.signatoryOrder || '', align: 'center', render: (s) => s.signatoryOrder || '—' },
    { key: 'role', header: 'Designation', sortValue: (s) => s.role, render: (s) => <Badge tone="zinc">{s.role}</Badge> },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, render: (s) => <Badge tone={s.status === 'active' ? 'lime' : 'zinc'}>{s.status}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (s) => (
        <span className="whitespace-nowrap">
          {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => setSigEditing({ id: s.id, bankName: sigAccount(s.bankAccountId)?.bank || '', bankAccountId: s.bankAccountId || '', name: s.name, role: s.role, signatoryType: s.signatoryType || '', signatoryOrder: s.signatoryOrder || '', phone: s.phone, email: s.email, status: s.status })}><Pencil className="size-4" /></button>}
          {canDelete && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setSigDeleting(s)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const saveSignatory = () => {
    if (!sigEditing) return
    if (!sigEditing.bankAccountId) { toast.error('Select the bank account.'); return }
    if (!sigEditing.signatoryType) { toast.error('Select the signatory type.'); return }
    if (!sigEditing.signatoryOrder) { toast.error('Select the signatory order.'); return }
    if (!sigEditing.name.trim()) { toast.error("Enter the signatory's name."); return }
    if (!sigEditing.role.trim()) { toast.error('Enter the designation.'); return }
    const isNew = !sigEditing.id
    upsertSignatory({
      id: sigEditing.id || uid('sg'), bankAccountId: sigEditing.bankAccountId,
      name: sigEditing.name.trim(), role: sigEditing.role.trim(),
      signatoryType: sigEditing.signatoryType, signatoryOrder: sigEditing.signatoryOrder,
      phone: sigEditing.phone.trim(), email: sigEditing.email.trim(), status: sigEditing.status,
    })
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
        title={tabs.find((t) => t.id === tab)?.label || 'Banking'}
        desc={{
          accounts: 'Manage bank and mobile-money accounts.',
          deposit: 'Money received into bank and mobile-money accounts.',
          feeds: 'Connected bank feeds and imported statements.',
          signatory: 'Authorised signatories mandated on each bank account.',
        }[tab]}
        actions={canManage && tab === 'accounts' ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button> : undefined}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left sub-nav */}
        <aside className="shrink-0 lg:w-48">
          <div className="card border0 accounting-nav-card p-1.5">
            <nav className="space-y-0.5">
              {tabs.map((t) => {
                const Icon = t.icon
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition ${active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
                  >
                    <Icon className="size-4 shrink-0" />{t.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {tab === 'accounts' && (
            <>
              {/* Toolbar: page size · Export · Bulk Actions · refresh · search */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="w-20">
                  <Select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} aria-label="Rows per page">
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </div>
                <ExportButtons filename="bank-accounts" rows={exportRows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />
                <div className="relative">
                  <Button variant="outline" onClick={() => setShowBulk((v) => !v)} disabled={!selected.length}>
                    Bulk Actions{selected.length ? ` (${selected.length})` : ''}
                  </Button>
                  {showBulk && selected.length > 0 && (
                    <div className="menu-pop absolute left-0 top-full z-30 mt-1 w-48 rounded-xl p-1.5">
                      {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('active')}><CheckCircle2 className="size-4" /> Activate</button>}
                      {canManage && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold" onClick={() => setStatusBulk('inactive')}><XCircle className="size-4" /> Deactivate</button>}
                      {canDelete && <button className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember" onClick={deleteBulk}><Trash2 className="size-4" /> Delete</button>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title="Refresh list"
                  aria-label="Refresh list"
                  onClick={() => { setQ(''); setSelected([]); setPage(1); toast.success('List refreshed') }}
                  className="grid size-10 place-items-center rounded-xl border border-line text-mist transition hover:text-lime"
                >
                  <RotateCcw className="size-4" />
                </button>
                <div className="ml-auto">
                  <SearchField value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search name, code, bank…" className="w-full sm:w-64" />
                </div>
              </div>

              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-black/10 text-xs font-bold uppercase tracking-wide dark:bg-white/10">
                      <th className="w-10 px-3 py-2.5">
                        <input type="checkbox" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && selected.length > 0 }} onChange={toggleAll} aria-label="Select all" className="size-4" />
                      </th>
                      <th className="px-3 py-2.5">Name</th>
                      <th className="px-3 py-2.5">Parent account</th>
                      <th className="px-3 py-2.5">Type</th>
                      <th className="px-3 py-2.5">Detail type</th>
                      <th className="px-3 py-2.5 text-right">Primary Balance</th>
                      <th className="px-3 py-2.5 text-right">Bank Balance</th>
                      <th className="px-3 py-2.5 text-center">Active</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {paged.map((b) => (
                      <tr key={b.id} className={selected.includes(b.id) ? 'bg-lime/5' : undefined}>
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggleOne(b.id)} aria-label={`Select ${b.name}`} className="size-4 accent-blue-600" />
                        </td>
                        <td className={`group px-3 py-2.5 ${b.parentId ? 'pl-10' : ''}`}>
                          <div className="text-sm font-semibold leading-snug">
                            {b.code ? `${b.code}${b.code && b.name ? ' - ' : ''}` : ''}{b.name}
                          </div>
                          <div className="mt-0.5 hidden items-center gap-2 text-[13px] group-hover:flex">
                            {canManage && (
                              <button
                                type="button"
                                className="font-medium text-mist transition hover:text-lime"
                                onClick={() => openEdit(b)}
                              >
                                Edit
                              </button>
                            )}
                            {canManage && canDelete && <span className="text-mist/40">|</span>}
                            {canDelete && (
                              <button
                                type="button"
                                className="font-semibold text-red-600 transition hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                                onClick={() => setDeleting(b)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-mist">{b.parentId ? parentName(b.parentId) : ''}</td>
                        <td className="px-3 py-2.5">{b.type === 'momo' ? 'Mobile money' : b.type === 'savings' ? 'Savings' : 'Bank'}</td>
                        <td className="px-3 py-2.5 text-mist">{b.detailType || '—'}</td>
                        <td className="px-3 py-2.5 text-right">{formatGhsExact(b.openingBalance)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{b.balance ? formatGhsExact(b.balance) : ''}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <Switch
                              checked={b.status === 'active'}
                              disabled={!canManage}
                              onChange={(next) => { upsertBank({ ...b, status: next ? 'active' : 'inactive' }); toast.success(next ? 'Account activated' : 'Account deactivated', b.name) }}
                              aria-label={`Toggle ${b.name} active`}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!paged.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-mist">No bank accounts. Add your first bank account.</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Footer: entries summary + pagination */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
                <span>
                  {rows.length
                    ? `Showing ${(curPage - 1) * pageSize + 1} to ${Math.min(curPage * pageSize, rows.length)} of ${rows.length} entries`
                    : 'Showing 0 entries'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={curPage <= 1}
                    onClick={() => setPage(curPage - 1)}
                    aria-label="Previous page"
                    className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40"
                  >
                    <ChevronRight className="size-4 rotate-180" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, curPage - 3), curPage + 2).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`grid size-9 place-items-center rounded-lg border text-sm font-semibold ${n === curPage ? '' : 'border-line'}`}
                      style={n === curPage ? { backgroundColor: 'var(--brand, #c8f542)', borderColor: 'var(--brand, #c8f542)', color: 'var(--brand-ink, #132000)' } : undefined}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={curPage >= totalPages}
                    onClick={() => setPage(curPage + 1)}
                    aria-label="Next page"
                    className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
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
            <div className="card space-y-4 p-4">
              {/* Bank account selector */}
              <div className="w-full max-w-xs">
                <Select value={feedAccountId} onChange={(e) => { setFeedAccountId(e.target.value); setFeedPage(1) }} placeholder="Select Bank Account" aria-label="Select Bank Account">
                  <option value="">Select Bank Account</option>
                  {feedAccounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </Select>
              </div>

              {/* From date | To date | Status */}
              <div className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
                <Field label="From date"><DatePicker value={feedFrom} onChange={(v) => { setFeedFrom(v); setFeedPage(1) }} /></Field>
                <Field label="To date"><DatePicker value={feedTo} onChange={(v) => { setFeedTo(v); setFeedPage(1) }} /></Field>
                <Field label="Status">
                  <Select value={feedStatus} onChange={(e) => { setFeedStatus(e.target.value as typeof feedStatus); setFeedPage(1) }}>
                    <option value="uncleared">Uncleared</option>
                    <option value="cleared">Cleared</option>
                    <option value="all">All</option>
                  </Select>
                </Field>
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-20">
                  <Select value={String(feedPageSize)} onChange={(e) => { setFeedPageSize(Number(e.target.value)); setFeedPage(1) }} aria-label="Rows per page">
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </div>
                <ExportButtons
                  filename="banking-feeds"
                  rows={feedRows.map((x) => ({ Date: x.date, Payee: x.payee, Description: x.description, Withdrawals: x.withdrawal || '', Deposits: x.deposit || '', 'Banking rule': '', Cleared: x.cleared ? 'Yes' : 'No' }))}
                  onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')}
                />
                <button
                  type="button"
                  title="Refresh feed"
                  aria-label="Refresh feed"
                  onClick={() => { setFeedAccountId(''); setFeedFrom(''); setFeedTo(''); setFeedStatus('uncleared'); setFeedPage(1); toast.success('Feed refreshed') }}
                  className="grid size-10 place-items-center rounded-xl border border-line text-mist transition hover:text-lime"
                >
                  <RotateCcw className="size-4" />
                </button>
              </div>

              {/* Feed table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-black/5 text-xs font-bold uppercase tracking-wide dark:bg-white/5">
                      <th className="cursor-pointer select-none px-3 py-2.5" onClick={() => setFeedSortDesc((v) => !v)}>
                        <span className="inline-flex items-center gap-1">Date <ChevronRight className={`size-3.5 text-mist transition-transform ${feedSortDesc ? 'rotate-90' : '-rotate-90'}`} /></span>
                      </th>
                      <th className="px-3 py-2.5">Payee</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5 text-right">Withdrawals</th>
                      <th className="px-3 py-2.5 text-right">Deposits</th>
                      <th className="px-3 py-2.5">Banking rule</th>
                      <th className="px-3 py-2.5 text-center">Cleared</th>
                      <th className="px-3 py-2.5 text-center">Options</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {feedPaged.map((x) => (
                      <tr key={x.id}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-mist">{x.date}</td>
                        <td className="px-3 py-2.5 font-semibold">{x.payee || '—'}</td>
                        <td className="px-3 py-2.5 text-mist">{x.description}</td>
                        <td className="px-3 py-2.5 text-right">{x.withdrawal ? formatGhsExact(x.withdrawal) : ''}</td>
                        <td className="px-3 py-2.5 text-right font-semibold">{x.deposit ? formatGhsExact(x.deposit) : ''}</td>
                        <td className="px-3 py-2.5 text-mist">—</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge tone={x.cleared ? 'lime' : 'zinc'}>{x.cleared ? 'Cleared' : 'Uncleared'}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-center text-mist">—</td>
                      </tr>
                    ))}
                    {!feedPaged.length && <tr><td colSpan={8} className="px-3 py-6 text-sm text-mist">No entries found</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              {feedRows.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-mist">
                  <span>Showing {(feedCurPage - 1) * feedPageSize + 1} to {Math.min(feedCurPage * feedPageSize, feedRows.length)} of {feedRows.length} entries</span>
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={feedCurPage <= 1} onClick={() => setFeedPage(feedCurPage - 1)} aria-label="Previous page" className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronRight className="size-4 rotate-180" /></button>
                    <span className="grid size-9 place-items-center rounded-lg border text-sm font-semibold" style={{ backgroundColor: 'var(--brand, #c8f542)', borderColor: 'var(--brand, #c8f542)', color: 'var(--brand-ink, #132000)' }}>{feedCurPage}</span>
                    <button type="button" disabled={feedCurPage >= feedTotalPages} onClick={() => setFeedPage(feedCurPage + 1)} aria-label="Next page" className="grid size-9 place-items-center rounded-lg border border-line disabled:opacity-40"><ChevronRight className="size-4" /></button>
                  </div>
                </div>
              )}
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
            {/* Account Name | Account Code */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Account Name" required><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              </div>
              <Field label="Account Code"><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="font-mono" placeholder="e.g. 2003" /></Field>
            </div>

            {/* Parent account | Note No. */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Parent account" required>
                  <Select value={editing.parentId} onChange={(e) => setEditing({ ...editing, parentId: e.target.value })} placeholder="Please Select…">
                    <option value="">None (top-level)</option>
                    {banks.filter((b) => b.id !== editing.id).map((b) => <option key={b.id} value={b.id}>{b.code ? `${b.code} - ` : ''}{b.name}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Note No.">
                <Input value={editing.noteNo} onChange={(e) => setEditing({ ...editing, noteNo: e.target.value })} placeholder="note no." className="placeholder:italic placeholder:text-rose-400" />
              </Field>
            </div>

            {/* Fund | Description */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fund" required>
                <Select value={editing.fundId} onChange={(e) => setEditing({ ...editing, fundId: e.target.value })} placeholder="Please Select…">
                  <option value="" disabled>Please Select…</option>
                  {funds.filter((f) => f.status === 'active').map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description">
                  <Textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="please provide description" className="min-h-16 max-w-full resize placeholder:italic placeholder:text-rose-400" />
                </Field>
              </div>
            </div>

            {/* Bank (+ gear) | Bank Account Number */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <Field label="Bank" required>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Select value={editing.bank} onChange={(e) => setEditing({ ...editing, bank: e.target.value })} placeholder="Please Select…">
                        <option value="" disabled>Please Select…</option>
                        {bankOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                      </Select>
                    </div>
                    <button
                      type="button"
                      title="Add a bank not in the list"
                      aria-label="Add a bank not in the list"
                      onClick={() => setShowAddBank((v) => !v)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                    >
                      <Settings2 className="size-4" />
                    </button>
                  </div>
                  {showAddBank && (
                    <div className="mt-2 flex gap-2">
                      <Input value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="New bank name…" />
                      <Button
                        size="sm"
                        onClick={() => {
                          const name = newBankName.trim()
                          if (!name) return
                          setCustomBanks((s) => (s.includes(name) ? s : [...s, name]))
                          setEditing({ ...editing, bank: name })
                          setNewBankName('')
                          setShowAddBank(false)
                          toast.success('Bank added to the list', name)
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  )}
                </Field>
              </div>
              <Field label="Bank Account Number" required><Input value={editing.accountNumber} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} className="font-mono" /></Field>
            </div>

            {/* Bank Branch | Bank Routing | Account type */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bank Branch" required><Input value={editing.branch} onChange={(e) => setEditing({ ...editing, branch: e.target.value })} /></Field>
              <Field label="Bank Routing"><Input value={editing.routing} onChange={(e) => setEditing({ ...editing, routing: e.target.value })} className="font-mono" /></Field>
              <Field label="Account type" required>
                <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as BankAccount['type'] })} placeholder="Please Select…">
                  <option value="current">Bank</option>
                  <option value="savings">Savings</option>
                  <option value="momo">Mobile money</option>
                </Select>
              </Field>
            </div>

            {/* Contact No. | Email Address */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Contact No."><Input value={editing.contactNo} onChange={(e) => setEditing({ ...editing, contactNo: e.target.value })} placeholder="+233 …" /></Field>
              <div className="sm:col-span-2">
                <Field label="Email Address"><Input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} /></Field>
              </div>
            </div>

            {/* Country | Status | Save */}
            <div className="grid items-end gap-3 sm:grid-cols-3">
              <Field label="Country" required>
                <Select value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value })} placeholder="Please Select…">
                  <option value="" disabled>Please Select…</option>
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                  <option value="active">ACTIVE</option>
                  <option value="inactive">INACTIVE</option>
                </Select>
              </Field>
              <Button className="h-10 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={saveBank}>Save</Button>
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
      <Modal open={!!sigEditing} onClose={() => setSigEditing(null)} title="Bank Signatory">
        {sigEditing && (() => {
          const bankNames = Array.from(new Set(banks.map((b) => b.bank).filter(Boolean))).sort((a, b) => a.localeCompare(b))
          const selectedAccount = banks.find((b) => b.id === sigEditing.bankAccountId)
          const bankValue = sigEditing.bankName || selectedAccount?.bank || ''
          const accountsOfBank = bankValue ? banks.filter((b) => b.bank === bankValue) : banks
          return (
            <div className="space-y-3">
              {/* Bank Name | Account Number (auto, read-only) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Bank Name" required>
                  <Select
                    value={bankValue}
                    onChange={(e) => {
                      const bank = e.target.value
                      const ofBank = banks.filter((b) => b.bank === bank)
                      // Auto-pick the account when the bank has exactly one.
                      setSigEditing({ ...sigEditing, bankName: bank, bankAccountId: ofBank.length === 1 ? ofBank[0].id : '' })
                    }}
                    placeholder="Please Select…"
                  >
                    <option value="" disabled>Please Select…</option>
                    {bankNames.map((b) => <option key={b} value={b}>{b}</option>)}
                  </Select>
                </Field>
                <Field label="Account Number">
                  <Input value={selectedAccount?.accountNumber || ''} readOnly disabled className="bg-black/5 font-mono dark:bg-white/10" placeholder="Auto-filled" />
                </Field>
              </div>

              {/* Account Name (masked) */}
              <Field label="Account Name" required>
                <Select
                  value={sigEditing.bankAccountId}
                  onChange={(e) => setSigEditing({ ...sigEditing, bankAccountId: e.target.value })}
                  placeholder="Please Select…"
                >
                  <option value="" disabled>Please Select…</option>
                  {accountsOfBank.map((b) => <option key={b.id} value={b.id}>{maskAccount(b.accountNumber)}-{b.name}</option>)}
                </Select>
              </Field>

              {/* Signatory Type | Signatory Order */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Signatory Type" required>
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <Select value={sigEditing.signatoryType} onChange={(e) => setSigEditing({ ...sigEditing, signatoryType: e.target.value })} placeholder="Please Select…">
                        <option value="" disabled>Please Select…</option>
                        {sigTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </div>
                    <button
                      type="button"
                      title="Manage signatory types"
                      aria-label="Manage signatory types"
                      onClick={() => setShowSigTypes((v) => !v)}
                      className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                    >
                      <Settings2 className="size-4" />
                    </button>
                  </div>
                  {showSigTypes && (
                    <div className="mt-2 space-y-2 rounded-xl border border-line p-2.5">
                      <div className="flex gap-2">
                        <Input
                          value={newSigType}
                          onChange={(e) => setNewSigType(e.target.value)}
                          placeholder={renamingType ? `Rename "${renamingType}"…` : 'New signatory type…'}
                        />
                        <Button
                          size="sm"
                          onClick={() => {
                            const name = newSigType.trim()
                            if (!name) return
                            if (renamingType) {
                              // Rename — updates the list and every signatory using the old name.
                              if (name !== renamingType && sigTypeOptions.some((t) => t.toLowerCase() === name.toLowerCase())) { toast.error('This signatory type already exists.'); return }
                              saveSigTypes(sigTypes.map((t) => (t === renamingType ? name : t)))
                              signatories.filter((x) => x.signatoryType === renamingType).forEach((x) => upsertSignatory({ ...x, signatoryType: name }))
                              if (sigEditing.signatoryType === renamingType) setSigEditing({ ...sigEditing, signatoryType: name })
                              toast.success('Signatory type renamed', `${renamingType} → ${name}`)
                              setRenamingType(null)
                            } else {
                              if (sigTypeOptions.some((t) => t.toLowerCase() === name.toLowerCase())) { toast.error('This signatory type already exists.'); return }
                              saveSigTypes([...sigTypes, name])
                              setSigEditing({ ...sigEditing, signatoryType: name })
                              toast.success('Signatory type added', name)
                            }
                            setNewSigType('')
                          }}
                        >
                          {renamingType ? 'Save' : 'Add'}
                        </Button>
                        {renamingType && (
                          <Button size="sm" variant="outline" onClick={() => { setRenamingType(null); setNewSigType('') }}>Cancel</Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sigTypeOptions.map((t) => {
                          const inUse = signatories.some((x) => x.signatoryType === t)
                          return (
                            <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${renamingType === t ? 'border-lime text-lime' : 'border-line'}`}>
                              {t}
                              <button
                                type="button"
                                title={`Rename ${t}`}
                                aria-label={`Rename ${t}`}
                                className="text-mist hover:text-lime"
                                onClick={() => { setRenamingType(t); setNewSigType(t) }}
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                title={inUse ? 'In use by a signatory — cannot delete' : 'Delete type'}
                                aria-label={`Delete ${t}`}
                                className={inUse ? 'cursor-not-allowed text-mist/40' : 'text-mist hover:text-ember'}
                                onClick={() => {
                                  if (inUse) { toast.error('Type is in use', `Reassign signatories using "${t}" first.`); return }
                                  saveSigTypes(sigTypes.filter((x) => x !== t))
                                  if (renamingType === t) { setRenamingType(null); setNewSigType('') }
                                  if (sigEditing.signatoryType === t) setSigEditing({ ...sigEditing, signatoryType: '' })
                                  toast.success('Signatory type deleted', t)
                                }}
                              >
                                <XCircle className="size-3.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                      <p className="text-[11px] text-mist">Rename updates every signatory using that type. Types in use cannot be deleted.</p>
                    </div>
                  )}
                </Field>
                <Field label="Signatory Order" required>
                  <Select value={sigEditing.signatoryOrder} onChange={(e) => setSigEditing({ ...sigEditing, signatoryOrder: e.target.value })} placeholder="Please Select…">
                    <option value="" disabled>Please Select…</option>
                    {SIGNATORY_ORDERS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </Select>
                </Field>
              </div>

              {/* Signatory's Name | Status */}
              <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                <Field label="Signatory's Name" required><Input value={sigEditing.name} onChange={(e) => setSigEditing({ ...sigEditing, name: e.target.value })} /></Field>
                <Field label="Status">
                  <Select value={sigEditing.status} onChange={(e) => setSigEditing({ ...sigEditing, status: e.target.value as 'active' | 'inactive' })}>
                    <option value="active">ACTIVE</option>
                    <option value="inactive">INACTIVE</option>
                  </Select>
                </Field>
              </div>

              {/* Designation | Save */}
              <div className="grid items-end gap-3 sm:grid-cols-[2fr_1fr]">
                <Field label="Designation" required><Input value={sigEditing.role} onChange={(e) => setSigEditing({ ...sigEditing, role: e.target.value })} placeholder="e.g. Director, Treasurer" /></Field>
                <Button className="h-10 w-full bg-blue-600 text-base font-semibold text-white hover:bg-blue-700" onClick={saveSignatory}>Save</Button>
              </div>
            </div>
          )
        })()}
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
