import { useMemo, useState } from 'react'
import { PageHeader, Badge, SearchField, Select, Empty } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhsExact, formatDate } from '../../../lib/utils'
import { accountName, voucherTotal } from '../../../lib/accounting'

interface LedgerRow {
  id: string
  date: string
  source: string
  ref: string
  accountId: string
  debit: number
  credit: number
}

export function AccountRegister() {
  const app = useApp()
  const { receipts, paymentVouchers, journals, accounts } = app
  const toast = useToast()

  const [q, setQ] = useState('')
  const [accountFilter, setAccountFilter] = useState('')

  const rows = useMemo<LedgerRow[]>(() => {
    const out: LedgerRow[] = []
    for (const r of receipts) {
      if (r.status !== 'void') {
        // Deposit account gets the debit (cash/bank in), income lines get credits.
        out.push({ id: r.id, date: r.date, source: 'Receipt', ref: r.number, accountId: r.depositAccountId, debit: r.amount, credit: 0 })
        for (const l of r.lines || []) {
          if (l.accountId) out.push({ id: `${r.id}-${l.accountId}`, date: r.date, source: 'Receipt', ref: r.number, accountId: l.accountId, debit: 0, credit: l.amount })
        }
      }
    }
    for (const p of paymentVouchers) {
      if (p.status !== 'void') {
        // Payment account gets the credit (cash/bank out), expense lines get debits.
        out.push({ id: p.id, date: p.date, source: 'Payment', ref: p.number, accountId: p.paymentAccountId, debit: 0, credit: p.amount })
        for (const l of p.lines || []) {
          if (l.accountId) out.push({ id: `${p.id}-${l.accountId}`, date: p.date, source: 'Payment', ref: p.number, accountId: l.accountId, debit: l.amount, credit: 0 })
        }
      }
    }
    for (const j of journals) {
      if (j.status === 'void') continue
      for (const l of j.lines) out.push({ id: `${j.id}-${l.accountId}`, date: j.date, source: 'Journal', ref: j.number, accountId: l.accountId, debit: l.debit, credit: l.credit })
    }
    return out.sort((a, b) => b.date.localeCompare(a.date))
  }, [receipts, paymentVouchers, journals])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (accountFilter && r.accountId !== accountFilter) return false
      if (!ql) return true
      return `${r.ref} ${r.source} ${accountName(accounts, r.accountId)}`.toLowerCase().includes(ql)
    })
  }, [rows, q, accountFilter, accounts])

  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0)
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0)

  const columns: Column<LedgerRow>[] = [
    { key: 'date', header: 'Date', sortValue: (r) => r.date, render: (r) => <span className="text-mist">{formatDate(r.date)}</span> },
    { key: 'ref', header: 'Reference', sortValue: (r) => r.ref, render: (r) => <span className="font-mono text-sm font-semibold">{r.ref}</span> },
    { key: 'source', header: 'Source', sortValue: (r) => r.source, render: (r) => <Badge tone="zinc">{r.source}</Badge> },
    { key: 'account', header: 'Account', sortValue: (r) => accountName(accounts, r.accountId), render: (r) => <span className="font-semibold">{accountName(accounts, r.accountId)}</span> },
    { key: 'debit', header: 'Debit', sortValue: (r) => r.debit, align: 'right', render: (r) => (r.debit ? formatGhsExact(r.debit) : '—') },
    { key: 'credit', header: 'Credit', sortValue: (r) => r.credit, align: 'right', render: (r) => (r.credit ? formatGhsExact(r.credit) : '—') },
  ]

  return (
    <div>
      <PageHeader
        title="Account register"
        desc="A running ledger of every debit and credit across your accounts."
        actions={<ExportButtons filename="account-register" rows={filtered.map((r) => ({ date: r.date, reference: r.ref, source: r.source, account: accountName(accounts, r.accountId), debit: r.debit, credit: r.credit }))} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} />}
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search reference, account…" className="w-full max-w-sm" />
        <Select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} className="w-auto">
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </Select>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="card p-3 text-sm"><span className="text-mist">Total debits</span><p className="font-semibold">{formatGhsExact(totalDebit)}</p></div>
        <div className="card p-3 text-sm"><span className="text-mist">Total credits</span><p className="font-semibold">{formatGhsExact(totalCredit)}</p></div>
      </div>

      <div className="card">
        <DataTable columns={columns} data={filtered} rowKey={(r) => r.id} emptyTitle="No ledger entries" emptyDesc="Entries appear here as you record vouchers and journals." />
        {!filtered.length && <Empty title="No ledger entries" desc="Record receipts, payments, or journals to populate the register." />}
      </div>
    </div>
  )
}
