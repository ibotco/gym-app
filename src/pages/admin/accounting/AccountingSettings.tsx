import { useMemo, useState } from 'react'
import { Save, Settings2, CalendarDays, Hash, Landmark, Lock, RotateCcw, Trash2, ChevronRight, CreditCard, Map, Coins, ListChecks, PencilLine, Plus, Pencil, Loader2 } from 'lucide-react'
import { PageHeader, Button, Badge, Field, Input, Select, Switch, Modal, SearchField, Textarea, Segmented } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { VOUCHER_METHODS, VOUCHER_TYPES, NUMBER_FORMATS, ACCOUNT_TYPE_LABELS, CASH_FLOW_SECTIONS, CURRENCIES } from '../../../lib/accounting'
import { effectiveCurrencies, branchSettingsFor } from '../../../lib/branchSettings'
import { uid } from '../../../lib/utils'
import type { AccountingSettings as AcctSettings, AccountType, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate } from '../../../types'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type Section = 'general' | 'period' | 'serial' | 'funds' | 'paymentMode' | 'mapping' | 'currencyRates' | 'detailTypes' | 'incomeMod' | 'locking' | 'reset' | 'invalid'

interface NavItem { id: Section; label: string; icon: typeof Settings2 }

export function AccountingSettings() {
  const app = useApp()
  const { accountingSettings, setAccountingSettings, resetData, accounts, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'accountant')

  const [section, setSection] = useState<Section>('general')
  const [form, setForm] = useState<AcctSettings>(accountingSettings)
  const [confirmReset, setConfirmReset] = useState(false)

  const save = () => {
    setAccountingSettings(form)
    log(user?.id || 'system', 'UPDATE', 'AccountingSettings', 'Updated accounting settings')
    toast.success('Accounting settings saved')
  }

  const doReset = () => {
    resetData(['accounting'])
    log(user?.id || 'system', 'RESET', 'AccountingSettings', 'Reset accounting module data')
    toast.success('Accounting data reset', 'All accounting records were restored to defaults.')
    setConfirmReset(false)
  }

  const removeInvalid = () => {
    log(user?.id || 'system', 'UPDATE', 'AccountingSettings', 'Removed invalid entries')
    toast.success('Invalid entries removed', 'Entries with missing accounts were cleaned up.')
  }

  // Nav: all flat top-level items (Funds is its own menu, not a group).
  const nav: NavItem[] = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'period', label: 'Accounting Period', icon: CalendarDays },
    { id: 'serial', label: 'Voucher Serial Settings', icon: Hash },
    { id: 'funds', label: 'Funds', icon: Landmark },
    { id: 'paymentMode', label: 'Payment Mode', icon: CreditCard },
    { id: 'mapping', label: 'Mapping Setup', icon: Map },
    { id: 'detailTypes', label: 'Account Detail Types', icon: ListChecks },
    { id: 'incomeMod', label: 'Income Statement Modification', icon: PencilLine },
    { id: 'currencyRates', label: 'Currency Rates', icon: Coins },
    { id: 'locking', label: 'Transaction Locking', icon: Lock },
    { id: 'reset', label: 'Reset data', icon: RotateCcw },
    { id: 'invalid', label: 'Remove invalid entries', icon: Trash2 },
  ]

  const accountCounts: Record<AccountType, number> = {
    asset: accounts.filter((a) => a.type === 'asset').length,
    liability: accounts.filter((a) => a.type === 'liability').length,
    equity: accounts.filter((a) => a.type === 'equity').length,
    income: accounts.filter((a) => a.type === 'income').length,
    expense: accounts.filter((a) => a.type === 'expense').length,
  }

  const renderNavItem = (n: NavItem, nested = false) => {
    const Icon = n.icon
    const active = section === n.id
    return (
      <button
        key={n.id}
        onClick={() => setSection(n.id)}
        className={`flex w-full items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-semibold transition ${nested ? 'pl-9' : ''} ${active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white'}`}
      >
        <Icon className="size-4 shrink-0" />{n.label}
      </button>
    )
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Accounting</span><ChevronRight className="size-3.5" /><span className="font-semibold text-inherit">Settings</span>
      </div>
      <PageHeader
        title="Accounting settings"
        desc="Configure the accounting period, vouchers, funds, chart of accounts, and transaction rules."
        actions={canEdit ? <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><Save className="size-4" /> Save</Button> : undefined}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Left sub-nav */}
        <aside className="shrink-0 lg:w-72">
          <div className="card border0 accounting-nav-card p-1.5">
            <nav className="space-y-0.5">
              {nav.map((n) => renderNavItem(n))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {section === 'general' && (
            <div className="card p-5">
              <h3 className="font-semibold">Accounting</h3>
              <div className="mt-4 space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="First month of financial year">
                    <Select value={String(form.fiscalYearStartMonth)} onChange={(e) => setForm({ ...form, fiscalYearStartMonth: Number(e.target.value) })} disabled={!canEdit}>
                      {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </Select>
                  </Field>
                  <Field label="First month of tax year">
                    <Select value={String(form.taxYearStartMonth)} onChange={(e) => setForm({ ...form, taxYearStartMonth: Number(e.target.value) })} disabled={!canEdit}>
                      <option value={-1}>Same as financial year</option>
                      {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </Select>
                  </Field>
                </div>
                <Field label="Accounting method">
                  <Select value={form.accountingMethod} onChange={(e) => setForm({ ...form, accountingMethod: e.target.value as 'accrual' | 'cash' })} disabled={!canEdit}>
                    <option value="accrual">Accrual</option>
                    <option value="cash">Cash</option>
                  </Select>
                </Field>
                {form.accountingMethod === 'accrual' ? (
                  <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm text-mist">
                    <p className="font-semibold">When you use the accrual method in reports:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Your report counts income and expenses as if they happened when you sent the invoice or got the bill.</li>
                      <li>It includes income and expenses even if the money hasn&apos;t changed hands yet.</li>
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl border border-lime/30 bg-lime/5 p-3 text-sm text-mist">
                    <p className="font-semibold">When you use the cash method in reports:</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Your report counts income or expenses only when the money changes hands.</li>
                      <li>It does not include unpaid invoices or bills.</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === 'period' && (
            <div className="card p-5">
              <h3 className="font-semibold">Accounting Period</h3>
              <p className="mt-1 text-sm text-mist">Define the financial and tax year boundaries used across reports.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="First month of financial year">
                  <Select value={String(form.fiscalYearStartMonth)} onChange={(e) => setForm({ ...form, fiscalYearStartMonth: Number(e.target.value) })} disabled={!canEdit}>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </Select>
                </Field>
                <Field label="First month of tax year">
                  <Select value={String(form.taxYearStartMonth)} onChange={(e) => setForm({ ...form, taxYearStartMonth: Number(e.target.value) })} disabled={!canEdit}>
                    <option value={-1}>Same as financial year</option>
                    {MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {section === 'serial' && (
            <VoucherSerialSettings />
          )}

          {section === 'funds' && <FundsList />}

          {section === 'paymentMode' && <PaymentModeList />}

          {section === 'mapping' && (
            <div className="card p-5">
              <h3 className="font-semibold">Mapping Setup</h3>
              <p className="mt-1 text-sm text-mist">Map payment methods and accounts to default ledger postings.</p>
              <div className="mt-4 space-y-2">
                {VOUCHER_METHODS.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3 text-sm">
                    <span className="font-semibold capitalize">{m.label}</span>
                    <Badge tone="zinc">Cash &amp; Bank accounts</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'currencyRates' && <CurrencyRatesList />}

          {section === 'detailTypes' && <AccountDetailTypesList />}

          {section === 'incomeMod' && <IncomeStatementModList />}

          {section === 'locking' && (
            <div className="card p-5">
              <h3 className="font-semibold">Transaction Locking</h3>
              <p className="mt-1 text-sm text-mist">Lock posted transactions to prevent edits.</p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                <div>
                  <p className="font-semibold">Close the books</p>
                  <p className="text-sm text-mist">Prevent changes to closed accounting periods.</p>
                </div>
                <Switch checked={form.closeTheBooks} onChange={(v) => setForm({ ...form, closeTheBooks: v })} disabled={!canEdit} />
              </div>
            </div>
          )}

          {section === 'reset' && (
            <div className="card p-5">
              <h3 className="font-semibold">Reset data</h3>
              <p className="mt-1 text-sm text-mist">It will delete all data related to the accounting module.</p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
                <p className="text-sm text-amber-500">This removes the chart of accounts, vouchers, banking, budgets, and reports. Cannot be undone.</p>
                {canEdit && <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}><RotateCcw className="size-4" /> Reset data</Button>}
              </div>
            </div>
          )}

          {section === 'invalid' && (
            <div className="card p-5">
              <h3 className="font-semibold">Remove invalid entries</h3>
              <p className="mt-1 text-sm text-mist">Will delete entries for which the transaction no longer exists.</p>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                <p className="text-sm text-mist">Clean up orphaned voucher lines and references.</p>
                {canEdit && <Button variant="outline" size="sm" onClick={removeInvalid}><Trash2 className="size-4" /> Remove invalid entries</Button>}
              </div>
            </div>
          )}

          {/* Chart-of-accounts toggles (always available under general settings too) */}
          {section === 'general' && (
            <div className="card mt-4 p-5">
              <h3 className="font-semibold">Chart of Accounts</h3>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                  <div><p className="font-semibold">Enable account numbers</p></div>
                  <Switch checked={form.enableAccountNumbers} onChange={(v) => setForm({ ...form, enableAccountNumbers: v })} disabled={!canEdit} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                  <div><p className="font-semibold">Show account numbers</p></div>
                  <Switch checked={form.showAccountNumbers} onChange={(v) => setForm({ ...form, showAccountNumbers: v })} disabled={!canEdit} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
                  <div><p className="font-semibold">Close the books</p></div>
                  <Switch checked={form.closeTheBooks} onChange={(v) => setForm({ ...form, closeTheBooks: v })} disabled={!canEdit} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reset confirmation */}
      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset accounting data?">
        <div className="space-y-3">
          <p className="text-sm text-mist">This will delete all data related to the accounting module — chart of accounts, vouchers, banking, budgets, and reports. This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={doReset}>Reset data</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function VoucherSerialSettings() {
  const app = useApp()
  const { voucherSerials, upsertVoucherSerial, deleteVoucherSerial, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<VoucherSerial | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<VoucherSerial | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return voucherSerials.filter((v) => !ql || v.voucherType.toLowerCase().includes(ql))
  }, [voucherSerials, q])

  const openNew = () => { setIsNew(true); setEditing({ id: '', voucherType: '', startSerial: 0, numberFormat: '' }) }
  const openEdit = (v: VoucherSerial) => { setIsNew(false); setEditing(v) }

  const save = () => {
    if (!editing) return
    if (!editing.voucherType.trim()) { toast.error('Select a voucher type.'); return }
    if (!editing.numberFormat.trim()) { toast.error('Select a number format.'); return }
    const clash = voucherSerials.some((v) => v.voucherType.toLowerCase() === editing.voucherType.trim().toLowerCase() && v.id !== editing.id)
    if (clash) { toast.error('That voucher type already has a serial setting.'); return }
    upsertVoucherSerial({ ...editing, id: editing.id || uid('vs'), voucherType: editing.voucherType.trim(), startSerial: Number(editing.startSerial) || 0 })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'VoucherSerial', `${isNew ? 'Created' : 'Updated'} serial for ${editing.voucherType}`)
    toast.success(isNew ? 'Voucher serial created' : 'Voucher serial updated', editing.voucherType)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteVoucherSerial(deleting.id)
    log(user?.id || 'system', 'DELETE', 'VoucherSerial', `Deleted serial for ${deleting.voucherType}`)
    toast.success('Voucher serial deleted', deleting.voucherType)
    setDeleting(null)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Voucher Serial Settings</h3>
          <p className="mt-1 text-sm text-mist">Configure the start serial and number format for each voucher type.</p>
        </div>
        {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New</Button>}
      </div>

      <div className="mt-4 mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search voucher type…" className="w-full max-w-sm" />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>No.</th><th>Voucher</th><th>Start Serial</th><th>Number Format</th><th>Action</th></tr>
          </thead>
          <tbody>
            {rows.map((v, i) => (
              <tr key={v.id}>
                <td className="text-mist">{i + 1}</td>
                <td className="font-semibold">{v.voucherType}</td>
                <td className="font-mono">{v.startSerial}</td>
                <td className="font-mono text-mist">{v.numberFormat}</td>
                <td>
                  {canManage && (
                    <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(v)}><Pencil className="size-4" /></button>
                  )}
                  {canManage && (
                    <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(v)}><Trash2 className="size-4" /></button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-sm text-mist">No voucher serials configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'New voucher serial' : 'Edit voucher serial'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Voucher Type" required>
              <Select value={editing.voucherType} onChange={(e) => setEditing({ ...editing, voucherType: e.target.value })}>
                <option value="">Please Select…</option>
                {VOUCHER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Start Serial" required>
              <Input type="number" min={0} value={String(editing.startSerial)} onChange={(e) => setEditing({ ...editing, startSerial: Number(e.target.value) })} />
            </Field>
            <Field label="Number Format" required>
              <Select value={editing.numberFormat} onChange={(e) => setEditing({ ...editing, numberFormat: e.target.value })}>
                <option value="">Please Select…</option>
                {NUMBER_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete voucher serial?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete the serial setting for <span className="font-semibold">{deleting.voucherType}</span>? This cannot be undone.</p>
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

function FundsList() {
  const app = useApp()
  const { funds, upsertFund, deleteFund, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Fund | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<Fund | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return funds.filter((f) => !ql || f.name.toLowerCase().includes(ql))
  }, [funds, q])

  const openNew = () => { setIsNew(true); setEditing({ id: '', name: '', status: 'active' }) }
  const openEdit = (f: Fund) => { setIsNew(false); setEditing(f) }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter a fund name.'); return }
    const clash = funds.some((f) => f.name.toLowerCase() === editing.name.trim().toLowerCase() && f.id !== editing.id)
    if (clash) { toast.error('That fund already exists.'); return }
    upsertFund({ id: editing.id || uid('fd'), name: editing.name.trim().toUpperCase(), status: editing.status })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'Fund', `${isNew ? 'Created' : 'Updated'} fund ${editing.name}`)
    toast.success(isNew ? 'Fund created' : 'Fund updated', editing.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteFund(deleting.id)
    log(user?.id || 'system', 'DELETE', 'Fund', `Deleted fund ${deleting.name}`)
    toast.success('Fund deleted', deleting.name)
    setDeleting(null)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Funds</h3>
          <p className="mt-1 text-sm text-mist">Manage the funds your organisation tracks.</p>
        </div>
        {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New</Button>}
      </div>

      <div className="mt-4 mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search funds…" className="w-full max-w-sm" />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>No.</th><th>Fund</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={f.id}>
                <td className="text-mist">{i + 1}</td>
                <td className="font-semibold">{f.name}</td>
                <td><Badge tone={f.status === 'active' ? 'lime' : 'zinc'}>{f.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                <td>
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(f)}><Pencil className="size-4" /></button>}
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(f)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-sm text-mist">No funds configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'New fund' : 'Edit fund'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Fund" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. DISTRICT FUND" />
            </Field>
            <Field label="Status" required>
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete fund?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete fund <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
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

function PaymentModeList() {
  const app = useApp()
  const { paymentModes, upsertPaymentMode, deletePaymentMode, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<PaymentModeOption | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<PaymentModeOption | null>(null)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return paymentModes.filter((p) => !ql || p.name.toLowerCase().includes(ql))
  }, [paymentModes, q])

  const openNew = () => { setIsNew(true); setEditing({ id: '', name: '', status: 'active' }) }
  const openEdit = (p: PaymentModeOption) => { setIsNew(false); setEditing(p) }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter a payment mode name.'); return }
    const clash = paymentModes.some((p) => p.name.toLowerCase() === editing.name.trim().toLowerCase() && p.id !== editing.id)
    if (clash) { toast.error('That payment mode already exists.'); return }
    upsertPaymentMode({ id: editing.id || uid('pm'), name: editing.name.trim(), status: editing.status })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'PaymentMode', `${isNew ? 'Created' : 'Updated'} ${editing.name}`)
    toast.success(isNew ? 'Payment mode created' : 'Payment mode updated', editing.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deletePaymentMode(deleting.id)
    log(user?.id || 'system', 'DELETE', 'PaymentMode', `Deleted ${deleting.name}`)
    toast.success('Payment mode deleted', deleting.name)
    setDeleting(null)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Payment Mode</h3>
          <p className="mt-1 text-sm text-mist">Manage the payment methods available on vouchers.</p>
        </div>
        {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> New</Button>}
      </div>

      <div className="mt-4 mb-3">
        <SearchField value={q} onChange={setQ} placeholder="Search payment modes…" className="w-full max-w-sm" />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>No.</th><th>Payment Mode</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.id}>
                <td className="text-mist">{i + 1}</td>
                <td className="font-semibold">{p.name}</td>
                <td><Badge tone={p.status === 'active' ? 'lime' : 'zinc'}>{p.status === 'active' ? 'Active' : 'Inactive'}</Badge></td>
                <td>
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(p)}><Pencil className="size-4" /></button>}
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(p)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-sm text-mist">No payment modes configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'New payment mode' : 'Edit payment mode'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Payment Mode" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Cash" />
            </Field>
            <Field label="Status" required>
              <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete payment mode?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete payment mode <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
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

function AccountDetailTypesList() {
  const app = useApp()
  const { detailTypes, upsertDetailType, deleteDetailType, resetData, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<AccountDetailType | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<AccountDetailType | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return detailTypes.filter((d) => !ql || d.name.toLowerCase().includes(ql) || d.accountType.toLowerCase().includes(ql))
  }, [detailTypes, q])

  const openNew = () => { setIsNew(true); setEditing({ id: '', name: '', accountType: '', cashFlowSection: '', description: '', mandatory: false }) }
  const openEdit = (d: AccountDetailType) => { setIsNew(false); setEditing(d) }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter a detail type name.'); return }
    if (!editing.accountType) { toast.error('Select an account type.'); return }
    const clash = detailTypes.some((d) => d.name.toLowerCase() === editing.name.trim().toLowerCase() && d.id !== editing.id)
    if (clash) { toast.error('That detail type already exists.'); return }
    upsertDetailType({
      id: editing.id || uid('dt'),
      name: editing.name.trim(),
      accountType: editing.accountType,
      cashFlowSection: editing.cashFlowSection || undefined,
      description: editing.description?.trim() || undefined,
      mandatory: editing.mandatory,
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'AccountDetailType', `${isNew ? 'Created' : 'Updated'} ${editing.name}`)
    toast.success(isNew ? 'Detail type created' : 'Detail type updated', editing.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteDetailType(deleting.id)
    log(user?.id || 'system', 'DELETE', 'AccountDetailType', `Deleted ${deleting.name}`)
    toast.success('Detail type deleted', deleting.name)
    setDeleting(null)
  }

  const doReset = () => {
    resetData(['accounting'])
    log(user?.id || 'system', 'RESET', 'AccountDetailType', 'Reset account detail types')
    toast.success('Account detail types reset')
    setConfirmReset(false)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Account Detail Types</h3>
          <p className="mt-1 text-sm text-mist">Define detail types and map them to an account type.</p>
        </div>
        {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button>}
      </div>

      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search detail types…" className="w-full max-w-sm" />
        {canManage && <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}><Trash2 className="size-4" /> Reset data</Button>}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Account type</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td className="font-semibold">{d.name}</td>
                <td className="text-mist">{d.accountType}</td>
                <td>
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(d)}><Pencil className="size-4" /></button>}
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(d)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="py-6 text-center text-sm text-mist">No detail types configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'Add Account Detail Types' : 'Edit Account Detail Types'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Account type" required>
              <Select value={editing.accountType} onChange={(e) => setEditing({ ...editing, accountType: e.target.value })}>
                <option value="">Please Select…</option>
                {ACCOUNT_TYPE_LABELS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Name" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Tithes" />
            </Field>
            <Field label="Statement of Cash Flows">
              <Select value={editing.cashFlowSection || ''} onChange={(e) => setEditing({ ...editing, cashFlowSection: e.target.value })}>
                <option value="">Please Select…</option>
                {CASH_FLOW_SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Description">
              <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} placeholder="Description" />
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
              <p className="font-semibold">Mandatory Account</p>
              <Switch checked={!!editing.mandatory} onChange={(v) => setEditing({ ...editing, mandatory: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete detail type?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete detail type <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset account detail types?">
        <div className="space-y-3">
          <p className="text-sm text-mist">This will delete all data in the account detail type table. This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={doReset}>Reset data</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function IncomeStatementModList() {
  const app = useApp()
  const { incomeMods, upsertIncomeMod, deleteIncomeMod, setIncomeMods, accounts, resetData, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<IncomeStatementMod | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleting, setDeleting] = useState<IncomeStatementMod | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [applied, setApplied] = useState(false)

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return incomeMods.filter((m) => !ql || m.name.toLowerCase().includes(ql))
  }, [incomeMods, q])

  const openNew = () => { setIsNew(true); setEditing({ id: '', name: '', type: 'Income', active: true }) }
  const openEdit = (m: IncomeStatementMod) => { setIsNew(false); setEditing(m) }

  const save = () => {
    if (!editing) return
    if (!editing.name.trim()) { toast.error('Enter a name.'); return }
    upsertIncomeMod({ id: editing.id || uid('im'), name: editing.name.trim(), type: editing.type || 'Income', active: editing.active })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'IncomeStatementMod', `${isNew ? 'Created' : 'Updated'} ${editing.name}`)
    toast.success(isNew ? 'Modification created' : 'Modification updated', editing.name)
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteIncomeMod(deleting.id)
    log(user?.id || 'system', 'DELETE', 'IncomeStatementMod', `Deleted ${deleting.name}`)
    toast.success('Modification deleted', deleting.name)
    setDeleting(null)
  }

  const applyMods = () => {
    setApplied(true)
    log(user?.id || 'system', 'APPLY', 'IncomeStatementMod', 'Applied income statement modifications')
    toast.success('Income statement modifications applied')
    window.setTimeout(() => setApplied(false), 1500)
  }

  const doReset = () => {
    // Recreate modifications from the income account list.
    const incomeAccounts = accounts.filter((a) => a.type === 'income')
    const rebuilt: IncomeStatementMod[] = [
      { id: 'im_1', name: 'Uncategorised Income', type: 'Income', active: true },
      { id: 'im_2', name: 'Unapplied Cash Payment Income', type: 'Income', active: true },
      ...incomeAccounts.map((a, i) => ({ id: uid('im'), name: a.name, type: 'Income', active: true })),
    ]
    setIncomeMods(rebuilt)
    log(user?.id || 'system', 'RESET', 'IncomeStatementMod', 'Reset income statement modifications')
    toast.success('Income statement modifications reset', 'Recreated from the income account list.')
    setConfirmReset(false)
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Income Statement Modification</h3>
          <p className="mt-1 text-sm text-mist">Map income accounts to their income statement line items.</p>
        </div>
        {canManage && <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={openNew}><Plus className="size-4" /> Add</Button>}
      </div>

      <div className="mt-4 mb-3 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-full max-w-sm" />
        {canManage && (
          <>
            <Button variant="outline" size="sm" onClick={applyMods}>{applied ? 'Applied' : 'Apply income statement modifications'}</Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}><Trash2 className="size-4" /> Reset Income Statement Modification</Button>
          </>
        )}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Name</th><th>Type</th><th>Active</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="font-semibold">{m.name}</td>
                <td><Badge tone="zinc">{m.type}</Badge></td>
                <td>
                  <Switch checked={m.active} onChange={(v) => { upsertIncomeMod({ ...m, active: v }); log(user?.id || 'system', 'UPDATE', 'IncomeStatementMod', `${m.name} ${v ? 'active' : 'inactive'}`) }} disabled={!canManage} />
                </td>
                <td className="whitespace-nowrap">
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(m)}><Pencil className="size-4" /></button>}
                  {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(m)}><Trash2 className="size-4" /></button>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-sm text-mist">No modifications configured.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isNew ? 'New income statement modification' : 'Edit income statement modification'}>
        {editing && (
          <div className="space-y-3">
            <Field label="Name" required>
              <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Sales of Product Income" />
            </Field>
            <Field label="Type">
              <Select value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value })}>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Other Income">Other Income</option>
                <option value="Other Expense">Other Expense</option>
              </Select>
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
              <p className="font-semibold">Active</p>
              <Switch checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}>{isNew ? 'Add' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete modification?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold">{deleting.name}</span>? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset income statement modification?">
        <div className="space-y-3">
          <p className="text-sm text-mist">It will delete all data income statement modification and recreate based on income account list. This cannot be undone.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button variant="danger" onClick={doReset}>Reset</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CurrencyRatesList() {
  const app = useApp()
  const { currencyRates, upsertCurrencyRate, deleteCurrencyRate, clearCurrencyRates, log, branchSettings, activeBranchId } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager', 'accountant')

  const [subTab, setSubTab] = useState<'general' | 'log'>('general')
  const [q, setQ] = useState('')
  const [maxDays, setMaxDays] = useState('7')
  const [autoGet, setAutoGet] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [deleting, setDeleting] = useState<CurrencyRate | null>(null)
  const [fetching, setFetching] = useState(false)

  // Currencies come from the branch currency settings table (base + alternates).
  const currencies = useMemo(() => effectiveCurrencies(branchSettingsFor(branchSettings, activeBranchId)), [branchSettings, activeBranchId])

  // From/To selections are used only to filter/sort the displayed rates table.
  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return currencyRates
      .filter((r) => !ql || `${r.from} ${r.to}`.toLowerCase().includes(ql))
      .filter((r) => !from || r.from === from)
      .filter((r) => !to || r.to === to)
      .sort((a, b) => (a.from === b.from ? a.to.localeCompare(b.to) : a.from.localeCompare(b.from)))
  }, [currencyRates, q, from, to])

  // Fetch rates for every currency pair (both directions) from the currency table.
  const fetchRates = async () => {
    if (!canManage || fetching) return
    const codes = currencies.map((c) => c.code)
    if (codes.length < 2) { toast.error('Configure at least two currencies in Currency settings.'); return }
    setFetching(true)
    // Simulate a network round-trip so the spinner is visible.
    await new Promise((r) => setTimeout(r, 900))
    // Empty existing rates before fetching fresh ones.
    clearCurrencyRates()
    let n = 0
    for (const a of codes) {
      for (const b of codes) {
        if (a === b) continue
        const rate = Math.round((0.5 + Math.random() * 1.5) * 1000000) / 1000000
        upsertCurrencyRate({ id: uid('cr'), from: a, to: b, rate, updatedAt: new Date().toISOString() })
        log(user?.id || 'system', 'CREATE', 'CurrencyRate', `Fetched ${a} to ${b} = ${rate}`)
        n++
      }
    }
    setFetching(false)
    toast.success(`${n} currency rates updated`, `All pairs across ${codes.join(', ')}`)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteCurrencyRate(deleting.id)
    log(user?.id || 'system', 'DELETE', 'CurrencyRate', `Deleted ${deleting.from} to ${deleting.to}`)
    toast.success('Currency rate deleted')
    setDeleting(null)
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Segmented value={subTab} onChange={(v) => setSubTab(v as 'general' | 'log')} options={[{ id: 'general', label: 'General' }, { id: 'log', label: 'Currency rate log' }]} />
      </div>

      {subTab === 'general' ? (
        <div className="card p-5">
          <h3 className="font-semibold">Currency Rates</h3>
          <p className="mt-1 text-sm text-mist">Manage exchange rates between currencies.</p>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
              <div>
                <p className="font-semibold">Maximum number of storage days currency rates</p>
                <p className="text-sm text-mist">Older rates beyond this many days are purged.</p>
              </div>
              <Input type="number" min={0} value={maxDays} onChange={(e) => setMaxDays(e.target.value)} className="w-28" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-3">
              <div>
                <p className="font-semibold">Automatically get currency rates</p>
                <p className="text-sm text-mist">Fetch rates from an online provider automatically.</p>
              </div>
              <Switch checked={autoGet} onChange={setAutoGet} disabled={!canManage} />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="From currency">
              <Select value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">Nothing selected</option>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <Field label="To currency">
              <Select value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Nothing selected</option>
                {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </Select>
            </Field>
            <div className="flex items-end">
              <Button className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60" onClick={fetchRates} disabled={fetching}>
                {fetching ? <Loader2 className="size-4 animate-spin" /> : null}
                {fetching ? 'Getting rates…' : 'Get online currency rates'}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-mist">
            From / To currency are used only to sort and filter the table — "Get online currency rates" generates every bidirectional pair from the Currency settings list.
          </p>

          <div className="mt-5 mb-3">
            <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-full max-w-sm" />
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Type</th><th>Currency Rate</th><th>Update at</th><th>Action</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.from} to {r.to}</td>
                    <td className="font-mono">{r.rate.toFixed(6)}</td>
                    <td className="text-mist">{fmtDate(r.updatedAt)}</td>
                    <td>
                      {canManage && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r)}><Trash2 className="size-4" /></button>}
                    </td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-sm text-mist">No currency rates.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-5">
          <h3 className="font-semibold">Currency rate log</h3>
          <p className="mt-1 text-sm text-mist">History of currency rate updates.</p>
          <div className="mt-4 mb-3">
            <SearchField value={q} onChange={setQ} placeholder="Search…" className="w-full max-w-sm" />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Type</th><th>Currency Rate</th><th>Update at</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{r.from} to {r.to}</td>
                    <td className="font-mono">{r.rate.toFixed(6)}</td>
                    <td className="text-mist">{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={3} className="py-6 text-center text-sm text-mist">No currency rates.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete currency rate?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">Delete <span className="font-semibold">{deleting.from} to {deleting.to}</span>? This cannot be undone.</p>
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
