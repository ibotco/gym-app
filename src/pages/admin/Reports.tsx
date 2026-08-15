import { PageHeader, Button } from '../../components/ui'
import { REVENUE_SERIES, ATTENDANCE_WEEK, RETENTION } from '../../data/seed'
import { useApp } from '../../context/AppContext'
import { downloadText, toCsv, formatGhs } from '../../lib/utils'
import { useToast } from '../../context/ToastContext'
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function Reports() {
  const { members, payments, attendance, trainers, staff } = useApp()
  const toast = useToast()

  const blocks = [
    { t: 'Revenue report', d: 'Monthly collected vs target', action: () => downloadText('revenue.csv', toCsv(REVENUE_SERIES as never)) },
    { t: 'Member report', d: `${members.length} records`, action: () => downloadText('members-report.csv', toCsv(members as never)) },
    { t: 'Attendance report', d: `${attendance.length} events`, action: () => downloadText('attendance.csv', toCsv(attendance as never)) },
    { t: 'Trainer report', d: `${trainers.length} coaches`, action: () => downloadText('trainers.csv', toCsv(trainers.map((t) => ({ id: t.id, rate: t.hourlyRate, clients: t.clientsCount, rating: t.rating })))) },
    { t: 'Payroll report', d: `${staff.length} employees`, action: () => downloadText('payroll.csv', toCsv(staff as never)) },
  ]

  return (
    <div>
      <PageHeader title="Reports" desc="Export PDF via print, or Excel-friendly CSV." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.t} className="card p-5">
            <h3 className="font-semibold">{b.t}</h3>
            <p className="mt-1 text-sm text-mist">{b.d}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={() => { b.action(); toast.success('CSV downloaded') }}>Excel / CSV</Button>
              <Button size="sm" variant="outline" onClick={() => { window.print(); toast.info('Use Print → Save as PDF') }}>PDF</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-sm font-semibold">Revenue</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SERIES}>
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
              <BarChart data={ATTENDANCE_WEEK}>
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                <Tooltip />
                <Bar dataKey="checkins" fill="#C8F542" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-mist">Retention last month: {RETENTION.at(-1)?.rate}%</p>
        </div>
      </div>
    </div>
  )
}
