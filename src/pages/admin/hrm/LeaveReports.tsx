import { useMemo, useState } from 'react'
import { PageHeader, Select, Badge } from '../../../components/ui'
import { ExportButtons } from '../../../components/ExportButtons'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import { leaveDays } from '../../../lib/leaveExtras'

export function LeaveReportsPage() {
  const { leaves, leaveTypes, users } = useApp()
  const toast = useToast()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)

  const years = useMemo(() => {
    const ys = new Set<number>([thisYear, thisYear - 1])
    leaves.forEach((l) => ys.add(Number(l.from.slice(0, 4))))
    return [...ys].filter(Number.isFinite).sort((a, b) => b - a)
  }, [leaves, thisYear])

  const inYear = useMemo(() => leaves.filter((l) => Number(l.from.slice(0, 4)) === year), [leaves, year])

  const stats = useMemo(() => {
    const approved = inYear.filter((l) => l.status === 'approved')
    return {
      total: inYear.length,
      pending: inYear.filter((l) => l.status === 'pending').length,
      rejected: inYear.filter((l) => l.status === 'rejected').length,
      approvedCount: approved.length,
      approvedDays: approved.reduce((n, l) => n + leaveDays(l), 0),
    }
  }, [inYear])

  const byType = useMemo(() => leaveTypes.map((t) => {
    const rows = inYear.filter((l) => l.type === t.id)
    const appr = rows.filter((l) => l.status === 'approved')
    return { type: t, requests: rows.length, approved: appr.length, days: appr.reduce((n, l) => n + leaveDays(l), 0) }
  }).filter((r) => r.requests > 0), [leaveTypes, inYear])

  const byStaff = useMemo(() => {
    const map = new Map<string, { staffId: string; requests: number; approved: number; days: number }>()
    for (const l of inYear) {
      const m = map.get(l.staffUserId) || { staffId: l.staffUserId, requests: 0, approved: 0, days: 0 }
      m.requests++
      if (l.status === 'approved') { m.approved++; m.days += leaveDays(l) }
      map.set(l.staffUserId, m)
    }
    return [...map.values()].sort((a, b) => b.days - a.days)
  }, [inYear])

  const staffName = (id: string) => users.find((u) => u.id === id)?.name || id

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resources</span><span>/</span><span>Leave</span><span>/</span><span className="font-semibold text-inherit">Reports</span>
      </div>
      <PageHeader
        title="Leave Reports"
        desc={`Utilisation and approval analytics for ${year}.`}
        actions={<span className="flex items-center gap-2">
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="w-28" aria-label="Year">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
          <ExportButtons
            filename={`leave-report-${year}`}
            rows={inYear.map((l) => ({ Staff: staffName(l.staffUserId), Type: leaveTypes.find((t) => t.id === l.type)?.name || l.type, From: l.from, To: l.to, Days: leaveDays(l), Status: l.status, Reason: l.reason || '' }))}
            onDone={(label, ok) => (ok ? toast.success(`${label} export started`) : toast.error('Export blocked'))}
          />
        </span>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="card p-4"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Requests</p><p className="mt-1 text-xl font-extrabold">{stats.total}</p></div>
        <div className="card p-4"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Approved</p><p className="mt-1 text-xl font-extrabold text-lime">{stats.approvedCount}</p></div>
        <div className="card p-4"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Days taken</p><p className="mt-1 text-xl font-extrabold">{stats.approvedDays}</p></div>
        <div className="card p-4"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Pending</p><p className="mt-1 text-xl font-extrabold text-amber-500">{stats.pending}</p></div>
        <div className="card p-4"><p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Rejected</p><p className="mt-1 text-xl font-extrabold text-ember">{stats.rejected}</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-extrabold">By leave type</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-[10px] font-bold uppercase tracking-wider text-mist">
              <th className="px-4 py-2">Type</th><th className="px-4 py-2 text-right">Requests</th><th className="px-4 py-2 text-right">Approved</th><th className="px-4 py-2 text-right">Days taken</th>
            </tr></thead>
            <tbody>
              {byType.map((r) => (
                <tr key={r.type.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2"><span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold" style={{ background: `${r.type.color}22`, color: r.type.color }}>{r.type.name}</span></td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.requests}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.approved}</td>
                  <td className="px-4 py-2 text-right font-extrabold tabular-nums">{r.days}</td>
                </tr>
              ))}
              {!byType.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-mist">No leave activity in {year}.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-extrabold">By employee</p>
          <table className="w-full text-xs">
            <thead><tr className="border-b border-line text-left text-[10px] font-bold uppercase tracking-wider text-mist">
              <th className="px-4 py-2">Employee</th><th className="px-4 py-2 text-right">Requests</th><th className="px-4 py-2 text-right">Approved</th><th className="px-4 py-2 text-right">Days taken</th>
            </tr></thead>
            <tbody>
              {byStaff.map((r) => (
                <tr key={r.staffId} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 font-bold">{staffName(r.staffId)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.requests}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.approved}</td>
                  <td className="px-4 py-2 text-right font-extrabold tabular-nums">{r.days}</td>
                </tr>
              ))}
              {!byStaff.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-mist">No leave activity in {year}.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-mist"><Badge tone="zinc">TIP</Badge> Balances and the full movement ledger live under Leave → Leave Balances / Balance Transactions.</p>
    </div>
  )
}
