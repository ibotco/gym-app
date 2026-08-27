import { useMemo, useState } from 'react'
import { PageHeader, Badge, SearchField, Select, Empty } from '../../../components/ui'
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
  deposit: 'Deposit',
  banking: 'Banking',
  purchase_order: 'Purchase Order',
  bill: 'Bill',
  check: 'Check',
}
const relLabel = (t: string) => REL_TYPE_LABELS[t] || t

export function AccountRegister() {
  const app = useApp()
  const { accountHistory, accounts } = app
  const toast = useToast()

  const [q, setQ] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [relFilter, setRelFilter] = useState('')

  // The register reads straight from the posted-transactions store
  // (accounting_account_history) — drafts and voids never appear here.
  const rows = useMemo<AccountHistoryEntry[]>(
    () => [...accountHistory].sort((a, b) => b.date.localeCompare(a.date) || b.dateCreated.localeCompare(a.dateCreated)),
    [accountHistory],
  )
  const relTypes = useMemo(() => Array.from(new Set(accountHistory.map((h) => h.relType))).sort(), [accountHistory])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (accountFilter && r.account !== accountFilter) return false
      if (relFilter && r.relType !== relFilter) return false
      if (!ql) return true
      return `${r.number || ''} ${relLabel(r.relType)} ${r.description || ''} ${r.customer || ''} ${r.vendor || ''} ${accountName(accounts, r.account)}`.toLowerCase().includes(ql)
    })
  }, [rows, q, accountFilter, relFilter, accounts])

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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search number, account, payee…" className="w-full max-w-sm" />
        <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="w-auto">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </Select>
        <Select value={relFilter} onChange={(e) => setRelFilter(e.target.value)} className="w-auto">
          <option value="">All types</option>
          {relTypes.map((t) => <option key={t} value={t}>{relLabel(t)}</option>)}
        </Select>
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
