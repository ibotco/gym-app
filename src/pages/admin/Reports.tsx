import { PageHeader } from '../../components/ui'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { formatGhs } from '../../lib/utils'
import { useMemo } from 'react'
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function Reports() {
  const { members, memberships, payments, users, attendance, trainers, staff, classes, activeBranch } = useApp()
  const revenueSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index), 1)
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, month: date.toLocaleString('en-GB', { month: 'short' }) }
    })
    return months.map(({ key, month }) => ({
      month,
      revenue: payments.filter((payment) => payment.status === 'paid' && payment.date?.slice(0, 7) === key).reduce((sum, payment) => sum + payment.amount, 0),
      members: users.filter((user) => user.role === 'member' && user.createdAt?.slice(0, 7) === key).length,
    }))
  }, [payments, users])
  const attendanceSeries = useMemo(() => {
    const dates = Array.from(new Set(attendance.map((event) => event.date))).sort().slice(-7)
    return (dates.length ? dates : Array.from({ length: 7 }, (_, index) => `Day ${index + 1}`)).map((date) => ({
      day: date.length > 8 ? date.slice(5) : date,
      checkins: date.length > 8 ? attendance.filter((event) => event.date === date).length : 0,
      classes: classes.length,
    }))
  }, [attendance, classes])
  const retention = useMemo(() => {
    const rate = members.length ? Math.round((memberships.filter((membership) => membership.status === 'active').length / members.length) * 100) : 0
    return ['May', 'Jun', 'Jul', 'Aug'].map((month) => ({ month, rate }))
  }, [members.length, memberships])

  const blocks = [
    { t: 'Revenue report', d: `${activeBranch?.name || 'Selected context'} · monthly collected`, filename: 'revenue', rows: revenueSeries as unknown as Record<string, unknown>[] },
    { t: 'Member report', d: `${members.length} records · selected branch`, filename: 'members-report', rows: members as unknown as Record<string, unknown>[] },
    { t: 'Attendance report', d: `${attendance.length} events · selected branch`, filename: 'attendance', rows: attendance as unknown as Record<string, unknown>[] },
    { t: 'Trainer report', d: `${trainers.length} coaches · selected branch`, filename: 'trainers', rows: trainers.map((t) => ({ id: t.id, rate: t.hourlyRate, clients: t.clientsCount, rating: t.rating })) },
    { t: 'Payroll report', d: `${staff.length} employees · selected branch`, filename: 'payroll', rows: staff as unknown as Record<string, unknown>[] },
  ]

  return (
    <div>
      <PageHeader title="Reports" desc="Export to Excel, CSV, or PDF." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.t} className="card p-5">
            <h3 className="font-semibold">{b.t}</h3>
            <p className="mt-1 text-sm text-mist">{b.d}</p>
            <div className="mt-4">
              <ExportButtons filename={b.filename} rows={b.rows} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Revenue</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip formatter={(v) => formatGhs(Number(v))} />
                <Area dataKey="revenue" stroke="#C8F542" fill="#C8F54233" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Attendance + retention</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceSeries}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                <Tooltip />
                <Bar dataKey="checkins" fill="#C8F542" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-mist">Retention last month: {retention.at(-1)?.rate}%</p>
        </div>
      </div>
    </div>
  )
}
