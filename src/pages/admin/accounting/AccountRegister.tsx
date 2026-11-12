import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Filter, Pencil } from 'lucide-react'
import { PageHeader, Badge, SearchField, Select, Empty, Field, DatePicker, Modal, Button } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { useAuth } from '../../../context/AuthContext'
import { formatGhsExact, formatDate } from '../../../lib/utils'
import { accountName, mappingLinkLabel, SEARCH_TYPES } from '../../../lib/accounting'
import { accountLabel } from './common'
import { invoiceEditable } from '../../../lib/procurement'
import type { AccountHistoryEntry } from '../../../types'

/** Human label per source document type (Perfex rel_type). */
const REL_TYPE_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  journal_entry: 'Journal Entry',
  invoice: 'Invoice',
  payment: 'Payment',
  goods_receipt: 'Goods Receipt',
  supplier_invoice: 'Supplier Invoice',
  supplier_payment: 'Supplier Payment',
  deposit: 'Deposit',
  banking: 'Banking',
  purchase_order: 'Purchase Order',
  bill: 'Bill',
  check: 'Check',
}
const relLabel = (t: string) => REL_TYPE_LABELS[t] || t

/**
 * Account History opens on the whole ledger — keep the date bounds empty by
 * default so older posted entries are not hidden. The shared presets provide
 * the same inclusive ranges as Income when the user wants to narrow the view.
 */
const defaultDateTo = () => ''
const defaultDateFrom = () => ''

function rangeFor(type: string): { start: string; end: string } {
  const now = new Date()
  const toIso = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  if (type === 'today') {
    const today = toIso(now)
    return { start: today, end: today }
  }
  if (type === 'this_week') {
    const day = now.getDay() || 7
    const start = new Date(now)
    start.setDate(now.getDate() - day + 1)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { start: toIso(start), end: toIso(end) }
  }
  if (type === 'this_month') {
    return {
      start: toIso(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toIso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }
  if (type === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    return {
      start: toIso(new Date(now.getFullYear(), quarter * 3, 1)),
      end: toIso(new Date(now.getFullYear(), quarter * 3 + 3, 0)),
    }
  }
  if (type === 'this_year') {
    return { start: toIso(new Date(now.getFullYear(), 0, 1)), end: toIso(new Date(now.getFullYear(), 11, 31)) }
  }
  if (type === 'last_year') {
    return { start: toIso(new Date(now.getFullYear() - 1, 0, 1)), end: toIso(new Date(now.getFullYear() - 1, 11, 31)) }
  }
  return { start: '', end: '' }
}

export function AccountRegister() {
  const app = useApp()
  const {
    accountHistory, accounts, receipts, paymentVouchers, journals,
    supplierInvoices, supplierPayments, goodsReceipts,
  } = app
  const toast = useToast()
  const navigate = useNavigate()
  const { hasRole } = useAuth()
  const canEditVouchers = hasRole('super_admin', 'gym_manager', 'accountant')
  const canManageProcurement = hasRole('super_admin', 'gym_manager', 'staff', 'company_admin')

  const [selectedTransaction, setSelectedTransaction] = useState<AccountHistoryEntry | null>(null)
  const [q, setQ] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [accountFilter, setAccountFilter] = useState('')
  const [relFilter, setRelFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [payeeFilter, setPayeeFilter] = useState('all')
  const [sideFilter, setSideFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [searchType, setSearchType] = useState('all')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const onSearchType = (type: string) => {
    setSearchType(type)
    if (type === 'all') {
      setDateFrom('')
      setDateTo('')
      return
    }
    if (type === 'custom') return
    const range = rangeFor(type)
    setDateFrom(range.start)
    setDateTo(range.end)
  }
  const onDateFromChange = (value: string) => {
    setDateFrom(value)
    setSearchType(value || dateTo ? 'custom' : 'all')
  }
  const onDateToChange = (value: string) => {
    setDateTo(value)
    setSearchType(value || dateFrom ? 'custom' : 'all')
  }

  /** Counterparty on a row — customer for income, vendor for purchases. */
  const payeeOf = (r: AccountHistoryEntry) => r.customer || r.vendor || ''
  const payeeOptions = useMemo(
    () => Array.from(new Set(accountHistory.map(payeeOf).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [accountHistory],
  )
  const branchOptions = useMemo(() => {
    const used = new Set(accountHistory.map((h) => h.branchId).filter(Boolean) as string[])
    return app.branches.filter((b) => used.has(b.id))
  }, [accountHistory, app.branches])

  // The register reads straight from the posted-transactions store
  // (accounting_account_history) — drafts and voids never appear here.
  const rows = useMemo<AccountHistoryEntry[]>(
    () => [...accountHistory].sort((a, b) => b.date.localeCompare(a.date) || b.dateCreated.localeCompare(a.dateCreated)),
    [accountHistory],
  )
  const relTypes = useMemo(() => Array.from(new Set(accountHistory.map((h) => h.relType))).sort(), [accountHistory])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    const min = minAmount.trim() === '' ? null : Number(minAmount)
    const max = maxAmount.trim() === '' ? null : Number(maxAmount)
    return rows.filter((r) => {
      if (accountFilter && r.account !== accountFilter) return false
      if (relFilter && r.relType !== relFilter) return false
      if (branchFilter !== 'all' && r.branchId !== branchFilter) return false
      if (payeeFilter !== 'all' && payeeOf(r) !== payeeFilter) return false
      if (sideFilter === 'debit' && !(r.debit > 0)) return false
      if (sideFilter === 'credit' && !(r.credit > 0)) return false
      if (dateFrom && r.date < dateFrom) return false
      if (dateTo && r.date > dateTo) return false
      // Amount range tests whichever side the row carries.
      const amount = r.debit || r.credit
      if (min != null && !Number.isNaN(min) && amount < min) return false
      if (max != null && !Number.isNaN(max) && amount > max) return false
      if (!ql) return true
      return `${r.number || ''} ${relLabel(r.relType)} ${r.description || ''} ${r.customer || ''} ${r.vendor || ''} ${accountName(accounts, r.account)}`.toLowerCase().includes(ql)
    })
  }, [rows, q, accountFilter, relFilter, branchFilter, payeeFilter, sideFilter, dateFrom, dateTo, minAmount, maxAmount, accounts])

  const activeFilterCount = [
    accountFilter !== '', relFilter !== '', branchFilter !== 'all', payeeFilter !== 'all',
    sideFilter !== 'all', dateFrom !== defaultDateFrom(), dateTo !== defaultDateTo(),
    minAmount !== '', maxAmount !== '',
  ].filter(Boolean).length

  /** Reset every filter, preserving the full-ledger default. */
  const clearFilters = () => {
    setAccountFilter(''); setRelFilter(''); setBranchFilter('all'); setPayeeFilter('all')
    setSideFilter('all'); setMinAmount(''); setMaxAmount('')
    setSearchType('all'); setDateFrom(defaultDateFrom()); setDateTo(defaultDateTo())
  }
  /** Drop the date bounds entirely to reach the full history. */
  const showAllDates = () => { setSearchType('all'); setDateFrom(''); setDateTo('') }
  const dateRangeIsDefault = dateFrom === defaultDateFrom() && dateTo === defaultDateTo()

  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0)
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0)
  const transactionLines = useMemo(() => {
    if (!selectedTransaction) return []
    if (!selectedTransaction.relId) return [selectedTransaction]
    const matching = accountHistory.filter((entry) =>
      entry.relType === selectedTransaction.relType &&
      entry.relId === selectedTransaction.relId &&
      (!selectedTransaction.companyId || entry.companyId === selectedTransaction.companyId),
    )
    return matching.length ? matching : [selectedTransaction]
  }, [accountHistory, selectedTransaction])
  const transactionDebit = transactionLines.reduce((sum, line) => sum + line.debit, 0)
  const transactionCredit = transactionLines.reduce((sum, line) => sum + line.credit, 0)
  const transactionCounterparty = transactionLines.find((line) => line.customer || line.vendor)
  const transactionPayee = transactionCounterparty?.customer || transactionCounterparty?.vendor || '—'
  const transactionBranch = selectedTransaction?.branchId
    ? app.branches.find((branch) => branch.id === selectedTransaction.branchId)?.name || selectedTransaction.branchId
    : '—'

  /** Native source record opened from the transaction number in this ledger. */
  const transactionHref = (row: AccountHistoryEntry): string | null => {
    if (!row.relId) return null
    const id = encodeURIComponent(row.relId)
    const voucherMode = canEditVouchers ? 'edit' : 'view'
    switch (row.relType) {
      case 'income': return `/admin/accounting/receipt-voucher?${voucherMode}=${id}`
      case 'expense': return `/admin/accounting/payment-voucher?${voucherMode}=${id}`
      case 'journal_entry': return `/admin/accounting/journal-voucher?${voucherMode}=${id}`
      case 'supplier_invoice': return `/admin/supplier-invoices?view=${id}`
      case 'supplier_payment': return `/admin/supplier-payments?view=${id}`
      case 'goods_receipt': return `/admin/goods-receipts?view=${id}`
      default: return null
    }
  }

  /** Editable source form, limited to the same roles and statuses as each source page. */
  const transactionEditHref = (row: AccountHistoryEntry): string | null => {
    if (!row.relId) return null
    const id = encodeURIComponent(row.relId)
    switch (row.relType) {
      case 'income':
        return canEditVouchers && receipts.some((receipt) => receipt.id === row.relId)
          ? `/admin/accounting/receipt-voucher?edit=${id}` : null
      case 'expense':
        return canEditVouchers && paymentVouchers.some((voucher) => voucher.id === row.relId)
          ? `/admin/accounting/payment-voucher?edit=${id}` : null
      case 'journal_entry':
        return canEditVouchers && journals.some((journal) => journal.id === row.relId)
          ? `/admin/accounting/journal-voucher?edit=${id}` : null
      case 'supplier_invoice': {
        const invoice = supplierInvoices.find((item) => item.id === row.relId)
        return canManageProcurement && invoice && invoiceEditable(invoice.status)
          ? `/admin/supplier-invoices?edit=${id}` : null
      }
      case 'supplier_payment': {
        const payment = supplierPayments.find((item) => item.id === row.relId)
        return canManageProcurement && payment?.status === 'draft'
          ? `/admin/supplier-payments?edit=${id}` : null
      }
      case 'goods_receipt': {
        const receipt = goodsReceipts.find((item) => item.id === row.relId)
        return canManageProcurement && receipt?.status === 'draft'
          ? `/admin/goods-receipts?edit=${id}` : null
      }
      default: return null
    }
  }
  const selectedEditHref = selectedTransaction ? transactionEditHref(selectedTransaction) : null

  const columns: Column<AccountHistoryEntry>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => <span className="text-mist">{formatDate(r.date)}</span> },
    {
      key: 'number', header: 'Number', sortValue: (r) => r.number || '',
      render: (r) => {
        const href = transactionHref(r)
        return r.number && href
          ? <Link to={href} onClick={(event) => event.stopPropagation()} aria-label={`Open ${relLabel(r.relType)} ${r.number}`} title={`Open ${relLabel(r.relType)} ${r.number}`} className="font-mono text-sm font-semibold text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-500 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-sky-300 dark:hover:text-sky-200">{r.number}</Link>
          : <span className="font-mono text-sm font-semibold">{r.number || '—'}</span>
      },
    },
    { key: 'rel', header: 'Type', sortValue: (r) => r.relType, render: (r) => <Badge tone="zinc">{relLabel(r.relType)}</Badge> },
    { key: 'journal', header: 'Journal', sortValue: (r) => r.journal || '', render: (r) => <span className="text-mist">{r.journal ? mappingLinkLabel('journal', r.journal) : '—'}</span> },
    { key: 'account', header: 'Account', sortValue: (r) => accountName(accounts, r.account), render: (r) => <span className="font-semibold">{accountName(accounts, r.account)}</span> },
    {
      key: 'desc', header: 'Description', sortValue: (r) => r.description || '',
      render: (r) => <span className="text-mist">{r.description || r.customer || r.vendor || '—'}</span>,
    },
    { key: 'split', header: 'Split', sortValue: (r) => (r.split ? accountName(accounts, r.split) : ''), render: (r) => <span className="text-mist">{r.split ? accountName(accounts, r.split) : '—'}</span> },
    { key: 'debit', header: 'Debit', sortValue: (r) => r.debit, align: 'right', render: (r) => (r.debit ? formatGhsExact(r.debit) : '—') },
    { key: 'credit', header: 'Credit', sortValue: (r) => r.credit, align: 'right', render: (r) => (r.credit ? formatGhsExact(r.credit) : '—') },
  ]

  return (
    <div>
      <PageHeader
        title="Account History"
        desc="All posted transactions — the general ledger. Every posted income, expense and journal entry stores its debit/credit rows here."
        actions={<ExportButtons filename="account-history" rows={filtered.map((r) => ({ Date: r.date, Number: r.number || '', Type: relLabel(r.relType), Journal: r.journal ? mappingLinkLabel('journal', r.journal) : '', Account: accountName(accounts, r.account), Description: r.description || '', Split: r.split ? accountName(accounts, r.split) : '', Debit: r.debit, Credit: r.credit }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />}
      />
      {/* Filters — same collapsible panel pattern as the Sales screen. */}
      <section className="mb-4 overflow-visible rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className="flex w-full items-center gap-2 border-b border-zinc-200 px-5 py-4 text-left text-[18px] font-semibold text-[#5bc0de] dark:border-zinc-700"
        >
          <Filter className="size-5" aria-hidden />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#5bc0de] px-2 py-0.5 text-xs font-bold text-white">{activeFilterCount}</span>
          )}
          <ChevronDown className={('ml-auto size-4 text-zinc-400 transition-transform ' + (filtersOpen ? 'rotate-180' : ''))} aria-hidden />
        </button>
        {filtersOpen && (
          <div className="grid gap-x-7 gap-y-4 p-5 lg:grid-cols-4">
            <Field label="Account">
              <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                <option value="">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
              </Select>
            </Field>
            <Field label="Transaction Type">
              <Select value={relFilter} onChange={(e) => setRelFilter(e.target.value)}>
                <option value="">All types</option>
                {relTypes.map((t) => <option key={t} value={t}>{relLabel(t)}</option>)}
              </Select>
            </Field>
            <Field label="Business Location">
              <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="all">All</option>
                {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Search Type">
              <Select value={searchType} onChange={(e) => onSearchType(e.target.value)}>
                <option value="all">All Dates</option>
                {SEARCH_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
              </Select>
            </Field>
            <Field label="Start Date">
              <DatePicker
                value={dateFrom}
                onChange={onDateFromChange}
                max={dateTo || undefined}
                aria-label="Filter from date"
              />
            </Field>
            <Field label="End Date">
              <DatePicker
                value={dateTo}
                onChange={onDateToChange}
                min={dateFrom || undefined}
                aria-label="Filter to date"
              />
            </Field>

            <Field label="Customer / Vendor">
              <Select value={payeeFilter} onChange={(e) => setPayeeFilter(e.target.value)}>
                <option value="all">All</option>
                {payeeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </Field>
            <Field label="Entry Side">
              <Select value={sideFilter} onChange={(e) => setSideFilter(e.target.value as 'all' | 'debit' | 'credit')}>
                <option value="all">All</option>
                <option value="debit">Debit only</option>
                <option value="credit">Credit only</option>
              </Select>
            </Field>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-800 dark:text-zinc-200">Amount Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" inputMode="decimal" min="0" step="0.01" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min" aria-label="Minimum amount" className="field min-w-0" />
                <input type="number" inputMode="decimal" min="0" step="0.01" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max" aria-label="Maximum amount" className="field min-w-0" />
              </div>
            </div>
            <div className="flex items-end gap-2">
              {!dateRangeIsDefault && (
                <button type="button" onClick={clearFilters} className="btn min-w-0 flex-1 font-semibold">Reset</button>
              )}
              {(dateFrom !== '' || dateTo !== '') && (
                <button type="button" onClick={showAllDates} className="btn min-w-0 flex-1 font-semibold">Show all dates</button>
              )}
              {dateRangeIsDefault && activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="btn min-w-0 flex-1 font-semibold">Clear filters</button>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search number, account, payee…" className="w-full max-w-sm" />
        <span className="text-sm text-mist">
          Showing {filtered.length} of {rows.length} entries
          {dateFrom || dateTo ? (
            <>
              {' · '}
              {dateFrom && dateTo
                ? <>{formatDate(dateFrom)} – {formatDate(dateTo)}</>
                : dateFrom ? <>from {formatDate(dateFrom)}</> : <>up to {formatDate(dateTo)}</>}

            </>
          ) : ' · all dates'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3 text-sm"><span className="text-mist">Total debits</span><p className="font-semibold">{formatGhsExact(totalDebit)}</p></div>
        <div className="card p-3 text-sm"><span className="text-mist">Total credits</span><p className="font-semibold">{formatGhsExact(totalCredit)}</p></div>
      </div>

      <div className="card">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          emptyTitle="No posted transactions"
          emptyDesc="Post an income, expense or journal entry and its ledger rows appear here."
          onRowClick={(row) => setSelectedTransaction(row)}
          rowAriaLabel={(row) => `View details for ${relLabel(row.relType)} ${row.number || 'transaction'}`}
        />
        {!filtered.length && <Empty title="No posted transactions" desc="Post an income, expense or journal entry to populate the ledger." />}
      </div>

      <Modal
        open={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        title={selectedTransaction
          ? `${relLabel(selectedTransaction.relType)}${selectedTransaction.number ? ` · ${selectedTransaction.number}` : ''}`
          : 'Transaction details'}
        wide
      >
        {selectedTransaction && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Date', formatDate(selectedTransaction.date)],
                ['Transaction number', selectedTransaction.number || '—'],
                ['Type', relLabel(selectedTransaction.relType)],
                ['Customer / vendor', transactionPayee],
                ['Business location', transactionBranch],
                ['Journal', selectedTransaction.journal ? mappingLinkLabel('journal', selectedTransaction.journal) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-line bg-black/[0.02] px-3 py-2.5 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-mist">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {selectedTransaction.description && (
              <div className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-mist">Description</p>
                <p className="mt-1 text-sm">{selectedTransaction.description}</p>
              </div>
            )}

            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">Posted ledger entries</h3>
                <p className="text-xs text-mist">All debit and credit lines linked to this source transaction.</p>
              </div>
              <Badge tone="zinc">Posted</Badge>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-black/[0.04] text-xs text-mist dark:bg-white/[0.04]">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Account</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Description</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Split</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Debit</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionLines.map((line, index) => (
                    <tr key={line.id} className={`border-t border-line ${line.id === selectedTransaction.id ? 'bg-lime/10' : ''}`}>
                      <td className="px-3 py-2.5 text-xs text-mist">{index + 1}</td>
                      <td className="px-3 py-2.5 font-semibold">{accountName(accounts, line.account)}</td>
                      <td className="px-3 py-2.5 text-mist">{line.description || line.item || line.customer || line.vendor || '—'}</td>
                      <td className="px-3 py-2.5 text-mist">{line.split ? accountName(accounts, line.split) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{line.debit ? formatGhsExact(line.debit) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right">{line.credit ? formatGhsExact(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-black/[0.03] font-semibold dark:bg-white/[0.03]">
                    <td colSpan={4} className="px-3 py-2.5 text-right">Total</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatGhsExact(transactionDebit)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatGhsExact(transactionCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-xs text-mist">Edit availability follows source-record status and your permissions.</span>
              <div className="ml-auto flex gap-2">
                {selectedEditHref && (
                  <Button onClick={() => {
                    setSelectedTransaction(null)
                    navigate(selectedEditHref)
                  }}>
                    <Pencil className="size-4" /> Edit transaction
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
