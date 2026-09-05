import { useMemo, useState } from 'react'
import { Save, Settings2, CalendarDays, Hash, Landmark, Lock, RotateCcw, Trash2, ChevronRight, CreditCard, Map, Coins, ListChecks, PencilLine, Plus, Pencil, Loader2, Handshake, HelpCircle } from 'lucide-react'
import { PageHeader, Button, Badge, Field, Input, Select, Switch, Modal, SearchField, Textarea, Segmented } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { VOUCHER_METHODS, VOUCHER_TYPES, NUMBER_FORMATS, ACCOUNT_TYPE_LABELS, CASH_FLOW_SECTIONS, CURRENCIES } from '../../../lib/accounting'
import { MAPPING_VOUCHER_TYPES, MAPPING_JOURNALS, MAPPING_POSTING_PROFILES, DEFAULT_MAPPING_LINKS } from '../../../lib/accounting'
import { effectiveCurrencies, branchSettingsFor } from '../../../lib/branchSettings'
import { uid } from '../../../lib/utils'
import type { AccountingSettings as AcctSettings, AccountType, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate, StakeholderClassDef, StakeholderEntity, Account, AutoMapping, AutoMappingLine, MappingVoucherType, MappingJournal, MappingPostingProfile } from '../../../types'
import { STAKEHOLDER_CLASSES } from '../../../lib/accounting'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type Section = 'general' | 'period' | 'serial' | 'funds' | 'paymentMode' | 'stakeholders' | 'mapping' | 'currencyRates' | 'detailTypes' | 'incomeMod' | 'locking' | 'reset' | 'invalid'

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
    { id: 'stakeholders', label: 'Stakeholder Classes', icon: Handshake },
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
        title={nav.find((n) => n.id === section)?.label || 'Accounting settings'}
        desc={{
          general: 'Base accounting behaviour — posting, negatives, and defaults.',
          period: 'Financial year start and accounting period rules.',
          serial: 'Voucher numbering formats and next serials per voucher type.',
          funds: 'Funds used to segment accounts and vouchers.',
          paymentMode: 'Payment modes offered on vouchers and receipts.',
          stakeholders: 'Custom stakeholder classes and their subclasses for vouchers.',
          mapping: 'Map operational events to ledger accounts.',
          detailTypes: 'Detail types available per account type.',
          incomeMod: 'Reclassify accounts on the income statement.',
          currencyRates: 'Exchange rates used for voucher conversion.',
          locking: 'Lock transactions before a chosen date.',
          reset: 'Reset accounting data to a clean state.',
          invalid: 'Clean up entries pointing at missing accounts.',
        }[section] || 'Configure the accounting period, vouchers, funds, chart of accounts, and transaction rules.'}
        actions={canEdit ? <Button data-acct-save-btn className="bg-blue-600 text-white hover:bg-blue-700" onClick={save}><Save className="size-4" /> Save</Button> : undefined}
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
          {section === 'stakeholders' && <StakeholderClassesPanel />}

          {section === 'paymentMode' && <PaymentModeList />}

          {section === 'mapping' && <AutoMappingPanel form={form} setForm={setForm} accounts={accounts} onSubmit={save} />}

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

// ---------------------------------------------------------------------------
// Stakeholder Classes — create custom classes (e.g. "Ministry") and manage
// their members (e.g. Children Ministry, Youth Ministry). Custom classes and
// members feed the Stakeholder Class / Received From / Paid To dropdowns in
// the receipt, payment and journal voucher forms.
// ---------------------------------------------------------------------------
function StakeholderClassesPanel() {
  const app = useApp()
  const { stakeholderClasses, stakeholderEntities, upsertStakeholderClass, deleteStakeholderClass, upsertStakeholderEntity, deleteStakeholderEntity, log } = app
  const { user, hasRole } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'accountant')

  const [selectedId, setSelectedId] = useState<string>(stakeholderClasses[0]?.id || '')
  const selected = stakeholderClasses.find((c) => c.id === selectedId) || null
  const members = stakeholderEntities.filter((e) => e.classId === selectedId)

  const [classForm, setClassForm] = useState<{ id?: string; name: string; description: string } | null>(null)
  const [memberForm, setMemberForm] = useState<{ id?: string; name: string; phone: string; email: string; status: 'active' | 'inactive' } | null>(null)
  const [deletingClass, setDeletingClass] = useState<StakeholderClassDef | null>(null)
  const [deletingMember, setDeletingMember] = useState<StakeholderEntity | null>(null)

  const saveClass = () => {
    if (!classForm) return
    const name = classForm.name.trim()
    if (!name) { toast.error('Enter a class name.'); return }
    const clash = [...STAKEHOLDER_CLASSES.map((c) => c.label), ...stakeholderClasses.filter((c) => c.id !== classForm.id).map((c) => c.name)]
      .some((n) => n.toLowerCase() === name.toLowerCase())
    if (clash) { toast.error('A stakeholder class with this name already exists.'); return }
    const isNew = !classForm.id
    const rec: StakeholderClassDef = {
      id: classForm.id || uid('sc'),
      name,
      description: classForm.description.trim() || undefined,
      createdAt: classForm.id ? (stakeholderClasses.find((c) => c.id === classForm.id)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    }
    upsertStakeholderClass(rec)
    if (isNew) setSelectedId(rec.id)
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'StakeholderClass', `${isNew ? 'Created' : 'Updated'} class "${name}"`)
    toast.success(isNew ? 'Stakeholder class created' : 'Stakeholder class updated')
    setClassForm(null)
  }

  const saveMember = () => {
    if (!memberForm || !selected) return
    const name = memberForm.name.trim()
    if (!name) { toast.error('Enter a subclass name.'); return }
    if (members.some((m) => m.id !== memberForm.id && m.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" already exists in ${selected.name}.`); return
    }
    const isNew = !memberForm.id
    upsertStakeholderEntity({
      id: memberForm.id || uid('se'),
      classId: selected.id,
      name,
      phone: memberForm.phone.trim() || undefined,
      email: memberForm.email.trim() || undefined,
      status: memberForm.status,
      createdAt: memberForm.id ? (members.find((m) => m.id === memberForm.id)?.createdAt) : new Date().toISOString(),
    })
    log(user?.id || 'system', isNew ? 'CREATE' : 'UPDATE', 'StakeholderEntity', `${isNew ? 'Added' : 'Updated'} "${name}" in ${selected.name}`)
    toast.success(isNew ? 'Subclass added' : 'Subclass updated')
    setMemberForm(null)
  }

  const confirmDeleteClass = () => {
    if (!deletingClass) return
    if (memberCount(deletingClass.id) > 0) {
      toast.error('Class has subclasses', `Remove all subclasses from ${deletingClass.name} before deleting it.`)
      setDeletingClass(null)
      return
    }
    deleteStakeholderClass(deletingClass.id)
    if (selectedId === deletingClass.id) setSelectedId(stakeholderClasses.find((c) => c.id !== deletingClass.id)?.id || '')
    log(user?.id || 'system', 'DELETE', 'StakeholderClass', `Deleted class "${deletingClass.name}" and its subclasses`)
    toast.success('Stakeholder class deleted')
    setDeletingClass(null)
  }

  const confirmDeleteMember = () => {
    if (!deletingMember) return
    deleteStakeholderEntity(deletingMember.id)
    log(user?.id || 'system', 'DELETE', 'StakeholderEntity', `Deleted "${deletingMember.name}"`)
    toast.success('Subclass deleted')
    setDeletingMember(null)
  }

  const memberCount = (classId: string) => stakeholderEntities.filter((e) => e.classId === classId).length

  return (
    <div className="space-y-4">
      {/* System classes */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Stakeholder Classes</h3>
            <p className="mt-1 text-sm text-mist">
              Voucher payer/payee categories. System classes take their members from the app registers;
              custom classes carry their own subclasses and appear in income, expense and journal entry forms.
            </p>
          </div>
          {canEdit && (
            <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => setClassForm({ name: '', description: '' })}>
              <Plus className="size-4" /> Add Class
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {STAKEHOLDER_CLASSES.map((c) => (
            <Badge key={c.id} tone="zinc">{c.label} · system</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(240px,1fr)_2fr]">
        {/* Custom classes */}
        <div className="card p-0">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Custom classes <span className="ml-1 text-xs font-normal text-mist">({stakeholderClasses.length})</span></p>
          </div>
          <div className="divide-y divide-line">
            {stakeholderClasses.map((c) => (
              <div
                key={c.id}
                className={`flex cursor-pointer items-center justify-between gap-2 px-4 py-3 transition ${selectedId === c.id ? 'bg-lime/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                onClick={() => setSelectedId(c.id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="truncate text-xs text-mist">{memberCount(c.id)} subclass{memberCount(c.id) === 1 ? '' : 'es'}{c.description ? ` — ${c.description}` : ''}</p>
                </div>
                {canEdit && (
                  <span className="flex shrink-0 items-center">
                    <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit class" onClick={(e) => { e.stopPropagation(); setClassForm({ id: c.id, name: c.name, description: c.description || '' }) }}><Pencil className="size-4" /></button>
                    <button
                      className={memberCount(c.id) > 0 ? 'cursor-not-allowed rounded-lg p-1.5 text-mist/40' : 'rounded-lg p-1.5 text-mist hover:text-ember'}
                      title={memberCount(c.id) > 0 ? `Cannot delete — ${c.name} has ${memberCount(c.id)} subclass(es). Remove them first.` : 'Delete class'}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (memberCount(c.id) > 0) {
                          toast.error('Class has subclasses', `Remove all ${memberCount(c.id)} subclass(es) from ${c.name} before deleting it.`)
                          return
                        }
                        setDeletingClass(c)
                      }}
                    ><Trash2 className="size-4" /></button>
                  </span>
                )}
              </div>
            ))}
            {!stakeholderClasses.length && <p className="px-4 py-6 text-center text-sm text-mist">No custom classes yet. Add one — e.g. “Ministry”.</p>}
          </div>
        </div>

        {/* Members of the selected class */}
        <div className="card p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">
              {selected ? `${selected.name} Subclasses` : 'Subclasses'}
              <span className="ml-1 text-xs font-normal text-mist">({members.length})</span>
            </p>
            {canEdit && selected && (
              <Button size="sm" onClick={() => setMemberForm({ name: '', phone: '', email: '', status: 'active' })}>
                <Plus className="size-4" /> Add Subclass
              </Button>
            )}
          </div>
          {selected ? (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-mist">
                  <th className="px-4 py-2">Name</th><th className="px-4 py-2">Phone</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2.5 font-semibold">{m.name}</td>
                    <td className="px-4 py-2.5 text-mist">{m.phone || '—'}</td>
                    <td className="px-4 py-2.5"><Badge tone={m.status === 'active' ? 'lime' : 'zinc'}>{m.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      {canEdit && (
                        <span className="whitespace-nowrap">
                          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Edit" onClick={() => setMemberForm({ id: m.id, name: m.name, phone: m.phone || '', email: m.email || '', status: m.status })}><Pencil className="size-4" /></button>
                          <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Delete" onClick={() => setDeletingMember(m)}><Trash2 className="size-4" /></button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!members.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-mist">No subclasses yet. Add your first {selected?.name || 'class'} subclass.</td></tr>}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-mist">Select a custom class to manage its subclasses.</p>
          )}
        </div>
      </div>

      {/* Class modal */}
      <Modal open={!!classForm} onClose={() => setClassForm(null)} title={classForm?.id ? 'Edit stakeholder class' : 'Add stakeholder class'}>
        {classForm && (
          <div className="space-y-3">
            <Field label="Class name" required><Input value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} placeholder="e.g. Ministry" /></Field>
            <Field label="Description"><Textarea rows={2} value={classForm.description} onChange={(e) => setClassForm({ ...classForm, description: e.target.value })} placeholder="e.g. Church ministries / departments" /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setClassForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveClass}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Member modal */}
      <Modal open={!!memberForm} onClose={() => setMemberForm(null)} title={memberForm?.id ? `Edit ${selected?.name} Subclass` : `Add ${selected?.name} Subclass`}>
        {memberForm && (
          <div className="space-y-3">
            <Field label="Name" required><Input value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder={`${selected?.name || ''} name`.trim()} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone"><Input value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} /></Field>
            </div>
            <Field label="Status">
              <Select value={memberForm.status} onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value as 'active' | 'inactive' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMemberForm(null)}>Cancel</Button>
              <Button className="bg-blue-600 text-white hover:bg-blue-700" onClick={saveMember}>Save</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmations */}
      <Modal open={!!deletingClass} onClose={() => setDeletingClass(null)} title="Delete stakeholder class?">
        <p className="text-sm text-mist">Delete <span className="font-semibold text-zinc-900 dark:text-white">{deletingClass?.name}</span>? This class has no members. Vouchers already saved keep their recorded names.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeletingClass(null)}>Cancel</Button>
          <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={confirmDeleteClass}>Delete</Button>
        </div>
      </Modal>
      <Modal open={!!deletingMember} onClose={() => setDeletingMember(null)} title="Delete subclass?">
        <p className="text-sm text-mist">Delete <span className="font-semibold text-zinc-900 dark:text-white">{deletingMember?.name}</span>? Vouchers already saved keep the recorded name.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeletingMember(null)}>Cancel</Button>
          <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={confirmDeleteMember}>Delete</Button>
        </div>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Automatic mapping setup — lets the accountant choose which ledger accounts
// are automatically debited/credited when invoices, payments, credit notes,
// expenses and taxes are posted. Mirrors the classic Perfex-style mapping
// screen with General / Payslips / Purchase / Inventory / Manufacturing tabs.
// ---------------------------------------------------------------------------

type MappingTabId = 'general' | 'payslips' | 'purchase' | 'inventory' | 'manufacturing' | 'fixedequipment' | 'procurement'

type MappingLineDef = {
  /** Section label (e.g. "Invoice", "Payment", "Credit Note"). */
  section: string
  /** Stable key used in autoMapping.lines. */
  key: string
  /** Small grey sub-label shown under the toggle, e.g. "Default for all item". */
  hint?: string
  /** Label above the LEFT ("Payment account") dropdown. */
  leftLabel: string
  /** Label above the RIGHT ("Deposit to") dropdown. */
  rightLabel: string
  /** Whether this line has its own enable/disable toggle. */
  hasToggle: boolean
}

const PAYSLIP_LINES: MappingLineDef[] = [
  { section: 'Total insurance', key: 'payslip.insurance', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Income tax paye', key: 'payslip.tax', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Net pay', key: 'payslip.netpay', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
]

const PURCHASE_LINES: MappingLineDef[] = [
  { section: 'Purchase Order', key: 'purchase.order', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Good receipts', key: 'purchase.goodsreceipt', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Purchase Invoice', key: 'purchase.invoice', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Supplier Payment', key: 'purchase.payment', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Purchase Order Return', key: 'purchase.return', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Refund', key: 'purchase.refund', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
  { section: 'Tax default', key: 'purchase.tax', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
]

type MappingGroupDef = {
  section: string
  /** If set, a single toggle at the section header controls all rows (uses this line's `enabled` flag). */
  masterToggleKey?: string
  rows: (MappingLineDef & { subLabel?: string })[]
}

/**
 * General tab layout.
 *
 * Two shapes, matching the agreed design:
 *  - `masterToggleKey` set   -> a single toggle on the group header; rows show
 *    only their sub-label (Invoice, Expense default, Tax default).
 *  - `masterToggleKey` unset -> plain group header; each row carries its own
 *    toggle (Payment, Credit Note).
 */
const GENERAL_GROUPS: MappingGroupDef[] = [
  {
    section: 'Invoice',
    masterToggleKey: 'invoice.default',
    rows: [
      { section: 'Invoice', key: 'invoice.default', subLabel: 'Default for all item', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
      { section: 'Discount', key: 'invoice.discount', subLabel: 'Discount', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
    ],
  },
  {
    section: 'Payment',
    rows: [
      { section: 'Sales', key: 'payment.sales', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
      { section: 'Expenses', key: 'payment.expenses', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
  {
    section: 'Credit Note',
    rows: [
      { section: 'Sales', key: 'creditnote.sales', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
      { section: 'Refund', key: 'creditnote.refund', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
  {
    section: 'Expense default',
    masterToggleKey: 'expense.default',
    rows: [
      { section: 'Expense default', key: 'expense.default', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
    ],
  },
  {
    section: 'Tax default',
    masterToggleKey: 'tax.sales',
    rows: [
      { section: 'Sales', key: 'tax.sales', subLabel: 'Sales', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
      { section: 'Expenses', key: 'tax.expenses', subLabel: 'Expenses', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
    ],
  },
]

const INVENTORY_GROUPS: MappingGroupDef[] = [
  {
    section: 'Inventory receiving voucher',
    rows: [
      { section: 'Inventory receiving voucher', key: 'inventory.receiving', subLabel: 'default', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
      { section: 'Inventory receiving voucher for return order', key: 'inventory.return', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
  {
    section: 'Inventory delivery voucher',
    rows: [
      { section: 'Inventory delivery voucher', key: 'inventory.delivery', subLabel: 'Inventory', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
      { section: 'profit', key: 'inventory.profit', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
  {
    section: 'Loss & adjustment',
    rows: [
      { section: 'Increase', key: 'inventory.increase', subLabel: 'Increase', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
      { section: 'Decrease', key: 'inventory.decrease', subLabel: 'Decrease', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
  {
    section: 'Opening Stock',
    rows: [
      { section: 'Opening Stock', key: 'inventory.openingstock', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true },
    ],
  },
]

const MANUFACTURING_GROUPS: MappingGroupDef[] = [
  {
    section: 'Manufacturing order',
    masterToggleKey: 'mfg.material',
    rows: [
      { section: 'Manufacturing order', key: 'mfg.material', subLabel: 'Material cost', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
      { section: 'Labour cost', key: 'mfg.labour', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: false },
    ],
  },
]

/**
 * Fixed equipment tab: one self-contained group per asset category, each with
 * its own toggle. Depreciation credits accumulated depreciation rather than
 * cash, since no money moves when an asset is written down.
 */
const FIXED_EQUIPMENT_GROUPS: MappingGroupDef[] = [
  { section: 'Asset', rows: [{ section: 'Asset', key: 'fixedequip.asset', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'License', rows: [{ section: 'License', key: 'fixedequip.license', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Component', rows: [{ section: 'Component', key: 'fixedequip.component', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Consumables', rows: [{ section: 'Consumables', key: 'fixedequip.consumables', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Maintenance', rows: [{ section: 'Maintenance', key: 'fixedequip.maintenance', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Depreciation', rows: [{ section: 'Depreciation', key: 'fixedequip.depreciation', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
]

/**
 * Procurement tab: the GRN-based purchasing chain. Receiving goods credits GRNI
 * rather than Accounts Payable, because the supplier has not invoiced yet; the
 * purchase invoice then clears GRNI into the real payable.
 */
const PROCUREMENT_GROUPS: MappingGroupDef[] = [
  { section: 'Goods receipt (GRN)', rows: [{ section: 'Goods receipt (GRN)', key: 'procurement.goodsreceipt', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Purchase invoice', rows: [{ section: 'Purchase invoice', key: 'procurement.supplierinvoice', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Supplier payment', rows: [{ section: 'Supplier payment', key: 'procurement.supplierpayment', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
  { section: 'Purchase return', rows: [{ section: 'Purchase return', key: 'procurement.purchasereturn', leftLabel: 'Payment account', rightLabel: 'Deposit to', hasToggle: true }] },
]

const MAPPING_TABS: { id: MappingTabId; label: string; icon: string }[] = [
  { id: 'general', label: 'General', icon: '▤' },
  { id: 'payslips', label: 'Payslips', icon: '🧾' },
  { id: 'purchase', label: 'Purchase', icon: '🛒' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'manufacturing', label: 'Manufacturing', icon: '🏭' },
  { id: 'fixedequipment', label: 'Fixed equipment', icon: '⚙' },
  { id: 'procurement', label: 'Procurement', icon: '🚚' },
]

function accountOptionLabel(a: Account): string {
  return a.code ? `${a.code} - ${a.name}` : a.name
}

function AutoMappingPanel({
  form,
  setForm,
  accounts,
  onSubmit,
}: {
  form: AcctSettings
  setForm: (f: AcctSettings) => void
  accounts: Account[]
  onSubmit?: () => void
}) {
  const [tab, setTab] = useState<MappingTabId>('general')

  const mapping = form.autoMapping ?? { enabled: true, lines: {} }
  const lines = mapping.lines ?? {}

  const setMapping = (patch: Partial<AutoMapping>) => {
    setForm({ ...form, autoMapping: { ...mapping, ...patch, lines: { ...lines, ...(patch.lines ?? {}) } } })
  }

  const setLine = (key: string, patch: Partial<AutoMappingLine>) => {
    const existing = lines[key] ?? { paymentAccountId: '', depositToAccountId: '' }
    setForm({
      ...form,
      autoMapping: {
        ...mapping,
        lines: { ...lines, [key]: { ...existing, ...patch } },
      },
    })
  }

  /**
   * The voucher / journal / posting-profile link row for a mapping record.
   * Values fall back to the reviewed defaults so every record always shows a
   * concrete link, and any change the user makes is persisted per record.
   */
  const linkRow = (key: string) => {
    const line = (lines[key] ?? {}) as AutoMappingLine
    const def = DEFAULT_MAPPING_LINKS[key] ?? {}
    const voucherType = line.voucherType || def.voucherType || 'journal'
    const journal = line.journal || def.journal || 'general'
    const profile = line.postingProfile || def.postingProfile || 'auto_post'
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-mist">Voucher type</label>
          <Select value={voucherType} onChange={(e) => setLine(key, { voucherType: e.target.value as MappingVoucherType })}>
            {MAPPING_VOUCHER_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-mist">Journal</label>
          <Select value={journal} onChange={(e) => setLine(key, { journal: e.target.value as MappingJournal })}>
            {MAPPING_JOURNALS.map((j) => <option key={j.value} value={j.value}>{j.label}</option>)}
          </Select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-bold text-mist">Posting profile</label>
          <Select
            value={profile}
            onChange={(e) => setLine(key, { postingProfile: e.target.value as MappingPostingProfile })}
            title={MAPPING_POSTING_PROFILES.find((p) => p.value === profile)?.hint}
          >
            {MAPPING_POSTING_PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Select>
        </div>
      </div>
    )
  }


  return (
    <div className="card p-5">
      {/* Tabs (General | Payslips | Purchase | Inventory | Manufacturing) */}
      <div className="flex flex-wrap items-end gap-0 border-b border-line bg-[#f4f5f7] px-2 pt-2 dark:bg-white/3">
        {MAPPING_TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`-mb-px flex items-center gap-1.5 rounded-t-md border border-b-0 px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-line bg-white text-[#3c8dbc] dark:bg-[#0e0e11]'
                  : 'border-transparent text-mist hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span className="text-[11px]" aria-hidden>{t.icon}</span>{t.label}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className="rounded-b-lg border border-t-0 border-line bg-white p-5 dark:bg-white/2">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between gap-3">
          {tab === 'general' ? (
            <>
              <h3 className="flex items-center gap-1.5 text-base font-semibold">
                Automatic mapping
                <span title="When enabled, the system automatically posts transactions using the accounts chosen below." className="cursor-help text-mist">
                  <HelpCircle className="size-4" />
                </span>
              </h3>
              <Switch checked={!!mapping.enabled} onChange={(v) => setMapping({ enabled: v })} />
            </>
          ) : (
            <h3 className="text-base font-semibold">Automatic mapping</h3>
          )}
        </div>

        {(tab === 'payslips' || tab === 'purchase') && (() => {
          const defs = tab === 'payslips' ? PAYSLIP_LINES : PURCHASE_LINES
          return (
            <>
              <div className="space-y-4">
                {defs.map((def) => {
                  const line = (lines[def.key] as { paymentAccountId?: string; depositToAccountId?: string; enabled?: boolean }) ?? {}
                  const enabled = line.enabled !== false
                  return (
                    <div key={def.key} className="rounded-md border border-line p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold">{def.section}</p>
                        <Switch
                          checked={enabled}
                          onChange={(v) => setLine(def.key, { enabled: v })}
                          aria-label={`Toggle ${def.section}`}
                        />
                      </div>
                      <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${!enabled ? 'pointer-events-none opacity-50' : ''}`}>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold text-mist">{def.leftLabel}</label>
                          <Select value={line.paymentAccountId || ''} onChange={(e) => setLine(def.key, { paymentAccountId: e.target.value })}>
                            <option value="">Please Select…</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>
                            ))}
                          </Select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold text-mist">{def.rightLabel}</label>
                          <Select value={line.depositToAccountId || ''} onChange={(e) => setLine(def.key, { depositToAccountId: e.target.value })}>
                            <option value="">Please Select…</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>
                            ))}
                          </Select>
                        </div>
                      </div>
                      {linkRow(def.key)}
                    </div>
                  )
                })}
              </div>
              <div className="mt-5 flex justify-end border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => onSubmit?.()}
                  className="rounded-lg bg-[#217ac0] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a639c]"
                >
                  Submit
                </button>
              </div>
            </>
          )
        })()}

        {(tab === 'general' || tab === 'inventory' || tab === 'manufacturing' || tab === 'fixedequipment' || tab === 'procurement') && (() => {
          const groups = tab === 'general'
            ? GENERAL_GROUPS
            : tab === 'inventory'
              ? INVENTORY_GROUPS
              : tab === 'manufacturing'
                ? MANUFACTURING_GROUPS
                : tab === 'fixedequipment'
                  ? FIXED_EQUIPMENT_GROUPS
                  : PROCUREMENT_GROUPS
          return (
            <>
              <div className={`space-y-4 ${tab === 'general' && !mapping.enabled ? 'pointer-events-none opacity-50' : ''}`}>
                {groups.map((group) => {
                  const masterKey = group.masterToggleKey
                  const masterLine = masterKey
                    ? (lines[masterKey] as { enabled?: boolean } | undefined)
                    : undefined
                  const groupEnabled = !masterKey || masterLine?.enabled !== false
                  return (
                    <div key={group.section} className="rounded-md border border-line p-4">
                      {masterKey && (
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold">{group.section}</p>
                          <Switch
                            checked={groupEnabled}
                            onChange={(v) => setLine(masterKey, { enabled: v })}
                            aria-label={`Toggle ${group.section}`}
                          />
                        </div>
                      )}
                      <div className={`space-y-4 ${!groupEnabled ? 'pointer-events-none opacity-50' : ''}`}>
                        {group.rows.map((def, idx) => {
                          const line = (lines[def.key] as { paymentAccountId?: string; depositToAccountId?: string; enabled?: boolean }) ?? {}
                          const rowEnabled = masterKey ? groupEnabled : line.enabled !== false
                          return (
                            <div key={def.key} className={idx > 0 ? 'border-t border-line pt-4' : ''}>
                              {!masterKey && (
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    {idx === 0 ? (
                                      <p className="text-sm font-semibold">{group.section}</p>
                                    ) : (
                                      <p className="text-sm font-semibold">{def.section}</p>
                                    )}
                                    {def.subLabel && <p className="text-[11px] font-semibold text-mist">{def.subLabel}</p>}
                                  </div>
                                  {def.hasToggle && (
                                    <Switch
                                      checked={rowEnabled}
                                      onChange={(v) => setLine(def.key, { enabled: v })}
                                      aria-label={`Toggle ${def.section}${def.subLabel ? ' – ' + def.subLabel : ''}`}
                                    />
                                  )}
                                </div>
                              )}
                              {masterKey && def.subLabel && (
                                <p className="text-sm font-semibold">{def.subLabel}</p>
                              )}
                              <div className={`${masterKey || idx > 0 ? 'mt-3' : ''} grid gap-3 sm:grid-cols-2 ${!rowEnabled ? 'pointer-events-none opacity-50' : ''}`}>
                                <div>
                                  <label className="mb-1.5 block text-[11px] font-bold text-mist">{def.leftLabel}</label>
                                  <Select value={line.paymentAccountId || ''} onChange={(e) => setLine(def.key, { paymentAccountId: e.target.value })}>
                                    <option value="">Please Select…</option>
                                    {accounts.map((a) => (
                                      <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>
                                    ))}
                                  </Select>
                                </div>
                                <div>
                                  <label className="mb-1.5 block text-[11px] font-bold text-mist">{def.rightLabel}</label>
                                  <Select value={line.depositToAccountId || ''} onChange={(e) => setLine(def.key, { depositToAccountId: e.target.value })}>
                                    <option value="">Please Select…</option>
                                    {accounts.map((a) => (
                                      <option key={a.id} value={a.id}>{accountOptionLabel(a)}</option>
                                    ))}
                                  </Select>
                                </div>
                              </div>
                              {linkRow(def.key)}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-5 flex justify-end border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => onSubmit?.()}
                  className="rounded-lg bg-[#217ac0] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1a639c]"
                >
                  Submit
                </button>
              </div>
            </>
          )
        })()}

        {tab !== 'general' && tab !== 'payslips' && tab !== 'purchase' && tab !== 'inventory' && tab !== 'manufacturing' && tab !== 'fixedequipment' && tab !== 'procurement' && (
          <div className="rounded-md border border-dashed border-line bg-black/[0.02] p-8 text-center text-sm text-mist dark:bg-white/[0.02]">
            Automatic mapping for <strong>{MAPPING_TABS.find((t) => t.id === tab)?.label}</strong> will appear here.
            Use the General tab to configure invoice, payment, credit note, expense and tax accounts.
          </div>
        )}
      </div>
    </div>
  )
}
