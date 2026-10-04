import { useMemo, useState } from 'react'
import { Users, Wallet, TrendingDown, BadgeCheck } from 'lucide-react'
import { PageHeader, Badge, Select } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { formatGhsExact } from '../../../lib/utils'
import type { Payslip } from '../../../types'

const PILL = { draft: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-300', paid: 'bg-lime/15 text-green-700 dark:text-lime' }

export function PayrollReportsPage() {
  const { payslips, users } = useApp()
  const [period, setPeriod] = useState('all')
  const [status, setStatus] = useState('all')

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id
  const periods = useMemo(() => Array.from(new Set(payslips.map((p) => p.period))).sort().reverse(), [payslips])
  const rows = useMemo(
    () => payslips.filter((p) => (period === 'all' || p.period === period) && (status === 'all' || p.status === status))
      .sort((a, b) => b.period.localeCompare(a.period) || a.staffUserId.localeCompare(b.staffUserId)),
    [payslips, period, status],
  )

  const gross = rows.reduce((n, p) => n + p.basic + p.allowances, 0)
  const deductions = rows.reduce((n, p) => n + p.deductions, 0)
  const net = rows.reduce((n, p) => n + p.net, 0)
  const paidCount = rows.filter((p) => p.status === 'paid').length

  const columns: Column<Payslip>[] = [
    { key: 'employee', header: 'Employee', sortValue: (p) => staffName(p.staffUserId), render: (p) => <span className="font-semibold">{staffName(p.staffUserId)}</span> },
    { key: 'period', header: 'Period', sortValue: (p) => p.period, render: (p) => <span className="font-mono text-[11px]">{p.period}</span> },
    { key: 'basic', header: 'Basic', align: 'right', sortValue: (p) => p.basic, render: (p) => formatGhsExact(p.basic) },
    { key: 'allowances', header: 'Allowances', align: 'right', sortValue: (p) => p.allowances, render: (p) => <span className="text-green-700 dark:text-lime">{formatGhsExact(p.allowances)}</span> },
    { key: 'deductions', header: 'Deductions', align: 'right', sortValue: (p) => p.deductions, render: (p) => <span className="text-ember">{formatGhsExact(p.deductions)}</span> },
    { key: 'net', header: 'Net pay', align: 'right', sortValue: (p) => p.net, render: (p) => <span className="font-extrabold">{formatGhsExact(p.net)}</span> },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, render: (p) => <Badge tone={p.status === 'paid' ? 'lime' : 'zinc'}>{p.status}</Badge> },
  ]

  const exportRows = rows.map((p) => ({ Employee: staffName(p.staffUserId), Period: p.period, Basic: p.basic, Allowances: p.allowances, Deductions: p.deductions, Net: p.net, Status: p.status }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Human Resources</span><span>/</span><span>Payroll</span><span>/</span><span className="font-semibold text-inherit">Reports</span></div>
      <PageHeader title="Payroll Reports" desc="Gross, deductions and net totals across every payslip, by period."
        actions={<ExportButtons filename="payroll-report" rows={exportRows} />} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: <Users className="size-5" />, label: 'Payslips', value: String(rows.length) },
          { icon: <Wallet className="size-5" />, label: 'Total gross', value: formatGhsExact(gross) },
          { icon: <TrendingDown className="size-5" />, label: 'Total deductions', value: formatGhsExact(deductions) },
          { icon: <BadgeCheck className="size-5" />, label: 'Paid / net', value: `${paidCount} · ${formatGhsExact(net)}` },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime">{s.icon}</span>
            <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">{s.label}</p><p className="truncate text-lg font-extrabold">{s.value}</p></div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40">
            <option value="all">All periods</option>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36">
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="paid">Paid</option>
          </Select>
          <span className="ml-auto text-[11px] font-bold text-mist">Gross {formatGhsExact(gross)} − deductions {formatGhsExact(deductions)} = net {formatGhsExact(net)}</span>
        </div>
        <DataTable data={rows} columns={columns} rowKey={(p) => p.id} pageSize={10}
          emptyTitle="No payslips in range" emptyDesc="Generate salaries first, or clear the filters." />
      </div>
    </div>
  )
}
