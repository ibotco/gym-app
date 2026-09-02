import { useMemo, useState } from 'react'
import { ChevronDown, Filter } from 'lucide-react'
import { PageHeader, Badge, SearchField, Select, Empty, Field } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../../lib/utils'
import { accountName } from '../../../lib/accounting'
import { accountLabel } from './common'
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
/**
 * The register opens on the last month of activity: one month back from today
 * through today inclusive. Widen or clear the dates to reach older entries.
 */
const defaultDateTo = () => isoDate(new Date())
const defaultDateFrom = () => {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return isoDate(d)
}

export function AccountRegister() {
  const app = useApp()
  const { accountHistory, accounts } = app
  const toast = useToast()

  const [q, setQ] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [accountFilter, setAccountFilter] = useState('')
  const [relFilter, setRelFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('all')
  const [payeeFilter, setPayeeFilter] = useState('all')
  const [sideFilter, setSideFilter] = useState<'all' | 'debit' | 'credit'>('all')
  const [dateFrom, setDateFrom] = useState(defaultDateFrom)
  const [dateTo, setDateTo] = useState(defaultDateTo)
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

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

  /** Reset every filter, returning the date window to the default last month. */
  const clearFilters = () => {
    setAccountFilter(''); setRelFilter(''); setBranchFilter('all'); setPayeeFilter('all')
    setSideFilter('all'); setMinAmount(''); setMaxAmount('')
    setDateFrom(defaultDateFrom()); setDateTo(defaultDateTo())
  }
  /** Drop the date bounds entirely to reach the full history. */
  const showAllDates = () => { setDateFrom(''); setDateTo('') }
  const dateRangeIsDefault = dateFrom === defaultDateFrom() && dateTo === defaultDateTo()

  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0)
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0)

  const columns: Column<AccountHistoryEntry>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => <span className="text-mist">{formatDate(r.date)}</span> },
    { key: 'number', header: 'Number', sortValue: (r) => r.number || '', render: (r) => <span className="font-mono text-sm font-semibold">{r.number || '—'}</span> },
    { key: 'rel', header: 'Type', sortValue: (r) => r.relType, render: (r) => <Badge tone="zinc">{relLabel(r.relType)}</Badge> },
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
        actions={<ExportButtons filename="account-history" rows={filtered.map((r) => ({ Date: r.date, Number: r.number || '', Type: relLabel(r.relType), Account: accountName(accounts, r.account), Description: r.description || '', Split: r.split ? accountName(accounts, r.split) : '', Debit: r.debit, Credit: r.credit }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />}
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
            <div>
              <label className="mb-1.5 block text-xs font-bold text-zinc-800 dark:text-zinc-200">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Start date
                  <input
                    type="date"
                    value={dateFrom}
                    // Never let the start run past the end.
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Start date"
                    className="field mt-1 block w-full min-w-0 font-normal"
                  />
                </label>
                <label className="min-w-0 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  End date
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="End date"
                    className="field mt-1 block w-full min-w-0 font-normal"
                  />
                </label>
              </div>
            </div>

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
              {dateRangeIsDefault && ' (last month)'}
            </>
          ) : ' · all dates'}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3 text-sm"><span className="text-mist">Total debits</span><p className="font-semibold">{formatGhsExact(totalDebit)}</p></div>
        <div className="card p-3 text-sm"><span className="text-mist">Total credits</span><p className="font-semibold">{formatGhsExact(totalCredit)}</p></div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} emptyTitle="No posted transactions" emptyDesc="Post an income, expense or journal entry and its ledger rows appear here." />
        {!filtered.length && <Empty title="No posted transactions" desc="Post an income, expense or journal entry to populate the ledger." />}
      </div>
    </div>
  )
}
