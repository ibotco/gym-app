import { useMemo, useState } from 'react'
import { Users, CalendarRange, Gauge, Wallet } from 'lucide-react'
import { PageHeader, Select, SearchField } from '../../../components/ui'
import { DataTable, type Column } from '../../../components/DataTable'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { balanceLine, loadLeavePolicies, loadLeaveTxns } from '../../../lib/leaveExtras'

interface BalanceRow {
  id: string
  staffId: string
  staffName: string
  typeId: string
  typeName: string
  typeColor: string
  allocated: number
  used: number
  remaining: number
  year: number
}

export function LeaveBalancesPage() {
  const { users, leaves, leaveTypes } = useApp()
  const toast = useToast()
  const thisYear = new Date().getFullYear()

  const [year, setYear] = useState(thisYear)
  const [staffId, setStaffId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [q, setQ] = useState('')

  const policies = useMemo(() => loadLeavePolicies(leaveTypes), [leaveTypes])
  const txns = useMemo(() => loadLeaveTxns(), [])

  const rows = useMemo<BalanceRow[]>(() => {
    const out: BalanceRow[] = []
    for (const u of users) {
      for (const t of leaveTypes) {
        const b = balanceLine(txns, leaves, policies.find((p) => p.leaveTypeId === t.id), t, u.id, year, thisYear)
        if (b.allocation === 0 && b.used === 0 && b.adjustments === 0) continue
        out.push({
          id: `${u.id}_${t.id}_${year}`, staffId: u.id, staffName: u.name, typeId: t.id, typeName: t.name, typeColor: t.color,
          allocated: b.allocation + b.adjustments, used: b.used, remaining: b.remaining, year,
        })
      }
    }
    return out
  }, [users, leaveTypes, txns, leaves, policies, year, thisYear])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return rows.filter((r) =>
      (!staffId || r.staffId === staffId) &&
      (!typeId || r.typeId === typeId) &&
      (!ql || `${r.staffName} ${r.typeName}`.toLowerCase().includes(ql)),
    )
  }, [rows, staffId, typeId, q])

  const totals = useMemo(() => ({
    employees: new Set(filtered.map((r) => r.staffId)).size,
    allocated: filtered.reduce((n, r) => n + r.allocated, 0),
    used: filtered.reduce((n, r) => n + r.used, 0),
    remaining: filtered.reduce((n, r) => n + r.remaining, 0),
  }), [filtered])

  const columns: Column<BalanceRow>[] = [
    { key: 'employee', header: 'Employee', sortValue: (r) => r.staffName, render: (r) => <span className="font-semibold">{r.staffName}</span> },
    {
      key: 'type', header: 'Leave Type', sortValue: (r) => r.typeName,
      render: (r) => <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${r.typeColor}22`, color: r.typeColor }}>{r.typeName}</span>,
    },
    { key: 'allocated', header: 'Allocated Days', align: 'right', sortValue: (r) => r.allocated, render: (r) => <span className="font-semibold tabular-nums">{r.allocated}</span> },
    { key: 'used', header: 'Used Days', align: 'right', sortValue: (r) => r.used, render: (r) => <span className="tabular-nums">{r.used}</span> },
    {
      key: 'remaining', header: 'Remaining Days', align: 'right', sortValue: (r) => r.remaining,
      render: (r) => (
        <span className={`inline-flex min-w-10 justify-center rounded-lg px-2 py-1 text-[11px] font-extrabold tabular-nums ${r.remaining < 0 ? 'bg-rose-500/10 text-ember' : r.remaining === 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-lime/15 text-green-700 dark:text-lime'}`}>
          {r.remaining}
        </span>
      ),
    },
    { key: 'year', header: 'Year', align: 'right', sortValue: (r) => r.year, render: (r) => <span className="text-mist">{r.year}</span> },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span>Leave</span><span>/</span><span className="font-semibold text-inherit">Leave Balances</span>
      </div>
      <PageHeader
        title="Leave Balances"
        desc={`Allocated vs used vs remaining days per employee and leave type for ${year}.`}
        actions={<ExportButtons
          filename={`leave-balances-${year}`}
          rows={filtered.map((r) => ({ Employee: r.staffName, 'Leave Type': r.typeName, 'Allocated Days': r.allocated, 'Used Days': r.used, 'Remaining Days': r.remaining, Year: r.year }))}
          onDone={(label, ok) => (ok ? toast.success(`${label} export started`) : toast.error('Export blocked'))}
        />}
      />

      {/* summary cards */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/5 dark:bg-white/10"><Users className="size-5" /></span>
          <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Employees tracked</p><p className="text-xl font-extrabold">{totals.employees}</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime"><Wallet className="size-5" /></span>
          <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Total allocated</p><p className="text-xl font-extrabold">{totals.allocated} days</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600"><CalendarRange className="size-5" /></span>
          <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Total used</p><p className="text-xl font-extrabold">{totals.used} days</p></div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${totals.remaining < 0 ? 'bg-rose-500/10 text-ember' : 'bg-sky-500/10 text-sky-600'}`}><Gauge className="size-5" /></span>
          <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Total remaining</p><p className={`text-xl font-extrabold ${totals.remaining < 0 ? 'text-ember' : ''}`}>{totals.remaining} days</p></div>
        </div>
      </div>

      {/* the balances card */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <p className="mr-2 text-sm font-extrabold">Balances · {year}</p>
          <SearchField value={q} onChange={setQ} placeholder="Search employee or type…" className="w-full sm:w-60" />
          <Select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="w-48" aria-label="Employee filter">
            <option value="">All employees</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="w-44" aria-label="Leave type filter">
            <option value="">All leave types</option>
            {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28" aria-label="Year filter">
            {[thisYear, thisYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
        <div className="p-3 pt-1">
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(r) => r.id}
            pageSize={10}
            emptyTitle="No leave balances for this selection"
            emptyDesc="Set allocations in Leave → Leave Policies, or record accruals in Balance Transactions."
          />
        </div>
      </div>
    </div>
  )
}
