import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { Users, CreditCard, Wallet, UserCheck, TrendingUp, Activity } from 'lucide-react'
import { PageHeader, StatCard, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { formatGhs } from '../../lib/utils'
import { useMemo } from 'react'

const tip = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#a1a1aa' },
}

export function AdminDashboard() {
  const { members, memberships, payments, users, attendance, trainers, classes, branches, activeBranch } = useApp()
  const { user } = useAuth()
  const scopeDescription = user?.role === 'branch_admin'
    ? `${branches.find((branch) => branch.id === user.branchId)?.name || 'Assigned branch'} only`
    : user?.role === 'company_admin'
      ? 'All branches in your company'
      : user?.role === 'super_admin'
        ? 'All companies and branches'
        : 'All club operations'
  const revenueSeries = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (5 - index), 1)
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, month: date.toLocaleString('en-GB', { month: 'short' }) }
    })
    return months.map(({ key, month }) => ({
      month,
      revenue: payments.filter((payment) => payment.status === 'paid' && payment.date?.slice(0, 7) === key).reduce((sum, payment) => sum + payment.amount, 0),
      members: users.filter((candidate) => candidate.role === 'member' && candidate.createdAt?.slice(0, 7) === key).length,
    }))
  }, [payments, users])
  const attendanceSeries = useMemo(() => {
    const dates = Array.from(new Set(attendance.map((event) => event.date))).sort().slice(-7)
    return (dates.length ? dates : Array.from({ length: 7 }, (_, index) => `Day ${index + 1}`)).map((date) => ({
      day: date.length > 8 ? date.slice(5) : date,
      checkins: date.length > 8 ? attendance.filter((event) => event.date === date).length : 0,
      classes: classes.filter((item) => item.dayOfWeek != null).length,
    }))
  }, [attendance, classes])
  const retentionSeries = useMemo(() => {
    const rate = members.length ? Math.round((memberships.filter((membership) => membership.status === 'active').length / members.length) * 100) : 0
    return ['May', 'Jun', 'Jul', 'Aug'].map((month) => ({ month, rate }))
  }, [members.length, memberships])
  const classUtilisation = useMemo(() => classes.slice(0, 6).map((item) => ({ name: item.name, util: item.capacity ? Math.min(100, Math.round((item.enrolled / item.capacity) * 100)) : 0 })), [classes])
  const activeMs = memberships.filter((m) => m.status === 'active').length
  const revenue = payments.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0)
  const newRegs = users.filter((u) => u.role === 'member' && u.createdAt >= '2025-06-01').length
  const latestAttendanceDate = attendance.map((event) => event.date).sort().at(-1)
  const today = latestAttendanceDate ? attendance.filter((event) => event.date === latestAttendanceDate).length : 0

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Operations"
        title="Club pulse"
        desc={`${scopeDescription} — live as of this morning.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={String(members.length)} delta="+6.4%" hint="vs last month" icon={<Users className="size-4" />} />
        <StatCard label="Active memberships" value={String(activeMs)} delta="+3.1%" hint="auto-renew 71%" icon={<CreditCard className="size-4" />} />
        <StatCard label="Collected (sample)" value={formatGhs(revenue)} delta="+12%" hint="paid invoices" icon={<Wallet className="size-4" />} />
        <StatCard label="Latest check-ins" value={String(today)} delta={latestAttendanceDate ? latestAttendanceDate.slice(5) : '—'} hint={activeBranch ? activeBranch.name : 'selected context'} icon={<UserCheck className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Revenue trends</p>
            <Badge tone="lime">GHS · 2026</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <defs>
                  <linearGradient id="rv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8F542" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#C8F542" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip {...tip} formatter={(v) => formatGhs(Number(v))} />
                <Area type="monotone" dataKey="revenue" stroke="#C8F542" fill="url(#rv)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-3 text-sm font-semibold">Retention rate</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionSeries}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis domain={[85, 100]} stroke="#71717a" fontSize={12} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="rate" stroke="#C8F542" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <p className="mb-3 text-sm font-semibold">Attendance analytics</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceSeries}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip {...tip} />
                <Bar dataKey="checkins" fill="#C8F542" radius={[6, 6, 0, 0]} />
                <Bar dataKey="classes" fill="#3f3f46" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-3 text-sm font-semibold">Class utilisation</p>
          <div className="space-y-3">
            {classUtilisation.map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{c.name}</span>
                  <span className="text-mist">{c.util}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-lime" style={{ width: `${c.util}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><TrendingUp className="size-4 text-lime" /> Membership growth</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueSeries}>
                <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                <Tooltip {...tip} />
                <Area dataKey="members" stroke="#60a5fa" fill="#60a5fa22" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-3 text-sm font-semibold">Trainer performance</p>
          <ul className="space-y-3">
            {trainers.map((t) => {
              const u = users.find((x) => x.id === t.userId)
              return (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span>{u?.name}</span>
                  <span className="text-mist">{t.clientsCount} clients · {t.rating}★</span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="card p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Activity className="size-4 text-lime" /> New registrations</p>
          <p className="stat-num text-4xl">{newRegs}</p>
          <p className="mt-1 text-sm text-mist">Members joined since mid-2025 in this dataset.</p>
          <p className="mt-4 text-xs text-mist">AI retention: 3 members flagged as churn-risk this week.</p>
        </div>
      </div>
    </div>
  )
}
