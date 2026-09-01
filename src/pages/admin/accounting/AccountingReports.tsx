import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Wallet, Scale, Printer } from 'lucide-react'
import { PageHeader, Button, StatCard, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { formatGhs, formatGhsExact, formatDate } from '../../../lib/utils'
import { accountName, voucherTotal, budgetTotal } from '../../../lib/accounting'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart, Legend } from 'recharts'

const PIE_COLORS = ['#C8F542', '#38BDF8', '#A78BFA', '#FBBF24', '#FB7185', '#34D399']

export function AccountingReportsPage() {
  const app = useApp()
  const { accounts, receipts, paymentVouchers, journals, banks, budgets, accountingSettings } = app
  const toast = useToast()

  const totalIncome = receipts.filter((r) => r.status !== 'void').reduce((s, r) => s + r.amount, 0)
  const totalExpense = paymentVouchers.filter((p) => p.status !== 'void').reduce((s, p) => s + p.amount, 0)
  const netProfit = totalIncome - totalExpense
  const totalBank = banks.reduce((s, b) => s + b.balance, 0)

  const byType = useMemo(() => {
    const map = new Map<string, { count: number; debit: number; credit: number }>()
    const init = (id: string) => map.get(id) || { count: 0, debit: 0, credit: 0 }
    for (const r of receipts) if (r.status !== 'void') {
      const e = init(r.depositAccountId); e.debit += r.amount; e.count++; map.set(r.depositAccountId, e)
      for (const l of r.lines || []) { const le = init(l.accountId); le.credit += l.amount; le.count++; map.set(l.accountId, le) }
    }
    for (const p of paymentVouchers) if (p.status !== 'void') {
      const pe = init(p.paymentAccountId); pe.credit += p.amount; pe.count++; map.set(p.paymentAccountId, pe)
      for (const l of p.lines || []) { const le = init(l.accountId); le.debit += l.amount; le.count++; map.set(l.accountId, le) }
    }
    for (const j of journals) if (j.status !== 'void') for (const l of j.lines) { const e = init(l.accountId); e.debit += l.debit; e.credit += l.credit; e.count++; map.set(l.accountId, e) }
    return Array.from(map.entries())
      .map(([id, v]) => ({ id, name: accountName(accounts, id), count: v.count, debit: v.debit, credit: v.credit, net: v.debit - v.credit }))
      .filter((e) => e.count > 0)
  }, [receipts, paymentVouchers, journals, accounts])

  const incomeByAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of receipts) if (r.status !== 'void') for (const l of r.lines || []) map.set(l.accountId, (map.get(l.accountId) || 0) + l.amount)
    return Array.from(map.entries()).map(([id, value]) => ({ name: accountName(accounts, id), value })).sort((a, b) => b.value - a.value)
  }, [receipts, accounts])

  const expenseByAccount = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of paymentVouchers) if (p.status !== 'void') for (const l of p.lines || []) map.set(l.accountId, (map.get(l.accountId) || 0) + l.amount)
    return Array.from(map.entries()).map(([id, value]) => ({ name: accountName(accounts, id), value })).sort((a, b) => b.value - a.value)
  }, [paymentVouchers, accounts])

  const monthly = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    const init = (k: string) => map.get(k) || { income: 0, expense: 0 }
    for (const r of receipts) if (r.status !== 'void') { const e = init(r.date.slice(0, 7)); e.income += r.amount; map.set(r.date.slice(0, 7), e) }
    for (const p of paymentVouchers) if (p.status !== 'void') { const e = init(p.date.slice(0, 7)); e.expense += p.amount; map.set(p.date.slice(0, 7), e) }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }))
  }, [receipts, paymentVouchers])

  const blocks = [
    { t: 'Trial balance', d: `${byType.length} accounts`, filename: 'trial-balance', rows: byType.map((e) => ({ account: e.name, entries: e.count, debit: e.debit, credit: e.credit, net: e.net })) },
    { t: 'Income statement', d: `${formatGhs(netProfit)} net`, filename: 'income-statement', rows: [{ income: totalIncome, expense: totalExpense, netProfit }] },
    { t: 'Budget vs actual', d: `${budgets.length} budgets`, filename: 'budget-vs-actual', rows: budgets.map((b) => ({ year: b.year, account: accountName(accounts, b.accountId), budgeted: budgetTotal(b), actual: 0, variance: -budgetTotal(b) })) },
  ]

  return (
    <div>
      <PageHeader
        title="Accounting reports"
        desc="Financial summary across income, expenses, banks, and budgets."
        actions={<Button variant="outline" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}><Printer className="size-5" style={{ width: 20, height: 20 }} /> Print / PDF</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total income" value={formatGhs(totalIncome)} icon={<TrendingUp className="size-4" />} />
        <StatCard label="Total expense" value={formatGhs(totalExpense)} icon={<TrendingDown className="size-4" />} />
        <StatCard label="Net profit" value={formatGhs(netProfit)} icon={<Scale className="size-4" />} />
        <StatCard label="Bank balances" value={formatGhs(totalBank)} icon={<Wallet className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Monthly income vs expense</p>
          {monthly.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Legend />
                  <Bar dataKey="income" fill="#C8F542" name="Income" />
                  <Bar dataKey="expense" fill="#FB7185" name="Expense" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-mist">No data yet.</p>}
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Income by account</p>
          {incomeByAccount.length ? (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={incomeByAccount} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label>
                    {incomeByAccount.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatGhs(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-sm text-mist">No income recorded.</p>}
        </div>
      </div>

      {expenseByAccount.length > 0 && (
        <div className="card mt-4 p-4">
          <p className="mb-3 text-sm font-semibold">Top expense accounts</p>
          <div className="grid gap-2 md:grid-cols-2">
            {expenseByAccount.slice(0, 6).map((e, i) => (
              <div key={e.name} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Badge tone="zinc">#{i + 1}</Badge><span className="truncate">{e.name}</span></span>
                <span className="font-semibold">{formatGhs(e.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display mt-8 text-xl">Export reports</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.t} className="card p-5">
            <h3 className="font-semibold">{b.t}</h3>
            <p className="mt-1 text-sm text-mist">{b.d}</p>
            <div className="mt-4"><ExportButtons filename={b.filename} rows={b.rows} onDone={(l, ok) => ok ? toast.success(`${l} export started`) : toast.error('Export blocked')} /></div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist">
        VAT rate {accountingSettings.vatRate}% · {accountingSettings.accountingMethod} method. Generated {formatDate(new Date().toISOString())}.
      </p>
    </div>
  )
}
