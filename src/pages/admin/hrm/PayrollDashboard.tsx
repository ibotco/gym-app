import { useMemo } from 'react'
import { Wallet, Users, FileSpreadsheet, Banknote, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Badge, StatCard } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function PayrollDashboard() {
  const { payslips, staff, users, salaryStructures, salaryAssignments } = useApp()

  const now = new Date()
  const thisPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const stats = useMemo(() => {
    const period = payslips.filter((p) => p.period === thisPeriod)
    const totalNet = period.reduce((s, p) => s + p.net, 0)
    const paid = period.filter((p) => p.status === 'paid')
    const draft = period.filter((p) => p.status === 'draft')
    return {
      totalNet,
      paidNet: paid.reduce((s, p) => s + p.net, 0),
      paidCount: paid.length,
      draftCount: draft.length,
      assigned: salaryAssignments.length,
      staffCount: staff.length,
    }
  }, [payslips, thisPeriod, salaryAssignments, staff])

  /* last 6 periods net trend */
  const trend = useMemo(() => {
    const out: { period: string; net: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      out.push({ period: key, net: payslips.filter((p) => p.period === key).reduce((s, p) => s + p.net, 0) })
    }
    return out
  }, [payslips]) // eslint-disable-line react-hooks/exhaustive-deps
  const maxNet = Math.max(1, ...trend.map((t) => t.net))

  const recent = useMemo(() => [...payslips].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 8), [payslips])

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Human Resource</span><span>/</span><span>Payroll</span><span>/</span>
        <span className="font-semibold text-inherit">Dashboard</span>
      </div>
      <PageHeader
        title="Payroll Dashboard"
        desc={`Payroll health for period ${thisPeriod} — totals, trends and recent slips.`}
        actions={<Link to="/admin/hrm/payroll/generate-salary" className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-lime px-4 text-sm font-bold text-black transition hover:brightness-110"><FileSpreadsheet className="size-4" /> Run payroll <ArrowRight className="size-4" /></Link>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Net payroll · ${thisPeriod}`} value={ghs(stats.totalNet)} icon={<Wallet className="size-4" />} />
        <StatCard label="Paid out" value={ghs(stats.paidNet)} icon={<Banknote className="size-4" />} hint={`${stats.paidCount} slip(s)`} />
        <StatCard label="Draft slips" value={String(stats.draftCount)} icon={<FileSpreadsheet className="size-4" />} hint="awaiting payment" />
        <StatCard label="Salary assigned" value={`${stats.assigned}/${stats.staffCount}`} icon={<Users className="size-4" />} hint="staff with structure" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Trend */}
        <div className="card p-4">
          <p className="mb-3 text-sm font-extrabold">Net payroll — last 6 periods</p>
          <div className="flex h-40 items-end gap-2">
            {trend.map((t) => (
              <div key={t.period} className="group relative flex-1">
                <div className="w-full rounded-t-md bg-lime/70 transition group-hover:bg-lime" style={{ height: `${Math.max(4, (t.net / maxNet) * 140)}px` }} />
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">{ghs(t.net)}</span>
                <p className="mt-1 text-center text-[10px] font-bold text-mist">{t.period}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent payslips */}
        <div className="card overflow-hidden">
          <p className="border-b border-line px-4 py-3 text-sm font-extrabold">Recent payslips</p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2">Period</th><th className="px-3 py-2">Staff</th><th className="px-3 py-2 text-right">Net</th><th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 text-mist">{p.period}</td>
                  <td className="px-3 py-2 font-bold">{users.find((u) => u.id === p.staffUserId)?.name || p.staffUserId}</td>
                  <td className="px-3 py-2 text-right font-bold">{ghs(p.net)}</td>
                  <td className="px-3 py-2"><Badge tone={p.status === 'paid' ? 'lime' : 'amber'}>{p.status}</Badge></td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-mist">No payslips yet — run payroll to create them.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Structures overview */}
      <div className="card mt-4 p-4">
        <p className="mb-3 text-sm font-extrabold">Salary structures in use</p>
        <div className="flex flex-wrap gap-2">
          {salaryStructures.map((st) => (
            <span key={st.id} className="rounded-xl border border-line px-3 py-2 text-xs font-bold">
              {st.name} · <span className="text-lime">{ghs(st.basic)}</span>
              <span className="ml-1 text-[10px] font-semibold text-mist">({salaryAssignments.filter((a) => a.structureId === st.id).length} staff)</span>
            </span>
          ))}
          {!salaryStructures.length && <p className="text-sm text-mist">No structures defined yet.</p>}
        </div>
      </div>
    </div>
  )
}
