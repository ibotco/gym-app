import { Link } from 'react-router-dom'
import { PageHeader, StatCard, StatusBadge, Button } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { daysUntil, formatDate, formatGhs } from '../../lib/utils'
import { CreditCard, CalendarDays, Activity, Wallet } from 'lucide-react'

export function MemberDashboard() {
  const { user } = useAuth()
  const { members, memberships, plans, bookings, classes, payments, attendance, progress } = useApp()
  const m = members.find((x) => x.userId === user?.id)
  const ms = memberships.find((x) => x.id === m?.membershipId)
  const plan = plans.find((p) => p.id === (ms?.planId || m?.planId))
  const myBooks = bookings.filter((b) => b.memberId === m?.id && b.status === 'booked')
  const lastPay = payments.filter((p) => p.memberId === m?.id && p.status === 'paid').at(-1)
  const visits = attendance.filter((a) => a.memberId === m?.id)
  const last = progress.filter((p) => p.memberId === m?.id).at(-1)
  const first = progress.filter((p) => p.memberId === m?.id)[0]

  return (
    <div>
      <PageHeader eyebrow="Member" title={`Welcome back, ${user?.name.split(' ')[0]}.`} desc={plan ? `${plan.name} · renews ${ms ? formatDate(ms.endDate) : ''}` : 'No active plan'} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Membership" value={ms?.status === 'active' ? 'Active' : ms?.status || '—'} hint={ms ? `${daysUntil(ms.endDate)} days left` : ''} icon={<CreditCard className="size-4" />} />
        <StatCard label="Upcoming classes" value={String(myBooks.length)} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Check-ins" value={String(visits.length)} hint="in sample window" icon={<Activity className="size-4" />} />
        <StatCard label="Last payment" value={lastPay ? formatGhs(lastPay.amount) : '—'} icon={<Wallet className="size-4" />} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h3 className="font-semibold">Your week</h3>
          <ul className="mt-3 space-y-2">
            {myBooks.map((b) => {
              const c = classes.find((x) => x.id === b.classId)
              return (
                <li key={b.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                  <span>{c?.name} · {b.date} · {c?.startTime}</span>
                  <StatusBadge status={b.status} />
                </li>
              )
            })}
            {!myBooks.length && <p className="text-sm text-mist">No upcoming bookings. <Link to="/app/classes" className="text-lime">Browse classes</Link></p>}
          </ul>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">Fitness snapshot</h3>
          {first && last ? (
            <>
              <p className="stat-num mt-2 text-4xl">{last.weight} kg</p>
              <p className="text-sm text-lime">{(last.weight - first.weight).toFixed(1)} kg since {first.date}</p>
              <p className="mt-2 text-sm text-mist">Body fat {last.bodyFat ?? '—'}%</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-mist">Log your first weigh-in in tracking.</p>
          )}
          <Link to="/app/progress"><Button className="mt-4 w-full" variant="outline">Open tracking</Button></Link>
        </div>
      </div>
    </div>
  )
}
