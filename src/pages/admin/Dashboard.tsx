import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { Users, CreditCard, Wallet, UserCheck, TrendingUp, Activity } from 'lucide-react'
import { PageHeader, StatCard, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { REVENUE_SERIES, ATTENDANCE_WEEK, RETENTION, CLASS_UTIL } from '../../data/seed'
import { formatGhs } from '../../lib/utils'

const tip = {
  contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: 12, fontSize: 12 },
  labelStyle: { color: '#a1a1aa' },
}

export function AdminDashboard() {
  const { members, memberships, payments, users, attendance, trainers } = useApp()
  const activeMs = memberships.filter((m) => m.status === 'active').length
  const revenue = payments.filter((p) => p.status === 'paid').reduce((a, p) => a + p.amount, 0)
  const newRegs = users.filter((u) => u.role === 'member' && u.createdAt >= '2025-06-01').length
  const today = attendance.filter((a) => a.date === '2026-08-13').length

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Operations"
        title="Club pulse"
        desc="Airport City, Osu, East Legon, Tema — live as of this morning."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={String(members.length)} delta="+6.4%" hint="vs last month" icon={<Users className="size-4" />} />
        <StatCard label="Active memberships" value={String(activeMs)} delta="+3.1%" hint="auto-renew 71%" icon={<CreditCard className="size-4" />} />
        <StatCard label="Collected (sample)" value={formatGhs(revenue)} delta="+12%" hint="paid invoices" icon={<Wallet className="size-4" />} />
        <StatCard label="Check-ins today" value={String(today || 186)} delta="+8" hint="across 4 clubs" icon={<UserCheck className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Revenue trends</p>
            <Badge tone="lime">GHS · 2026</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SERIES}>
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
              <LineChart data={RETENTION}>
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
              <BarChart data={ATTENDANCE_WEEK}>
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
            {CLASS_UTIL.map((c) => (
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
              <AreaChart data={REVENUE_SERIES}>
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
