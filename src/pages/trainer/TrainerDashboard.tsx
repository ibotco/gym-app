import { Link } from 'react-router-dom'
import { PageHeader, StatCard, StatusBadge, Avatar, Button } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { WEEKDAYS_FULL } from '../../lib/utils'
import { CalendarDays, Users, MessageSquare, ClipboardList } from 'lucide-react'

export function TrainerDashboard() {
  const { user } = useAuth()
  const { trainers, members, users, sessions, classes, workouts, messages } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const myMembers = members.filter((m) => m.trainerId === me?.id)
  const mySessions = sessions.filter((s) => s.trainerId === me?.id).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
  const myClasses = classes.filter((c) => c.trainerId === me?.id)
  const myWorkouts = workouts.filter((w) => w.trainerId === me?.id)
  const myMessages = messages.filter((m) => m.fromId === user?.id || m.toId === user?.id)
  const unread = myMessages.filter((m) => m.toId === user?.id && !m.read).length
  const today = new Date().toISOString().slice(0, 10)
  const todaysSessions = mySessions.filter((s) => s.date === today)
  const upcoming = mySessions.filter((s) => s.date >= today && s.status === 'scheduled').slice(0, 6)

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title={`Good day, ${user?.name.split(' ')[0]}.`}
        desc={me ? `${me.specialties.join(' · ')}` : 'Trainer portal'}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions today" value={String(todaysSessions.length)} icon={<CalendarDays className="size-4" />} />
        <StatCard label="Assigned members" value={String(myMembers.length)} icon={<Users className="size-4" />} />
        <StatCard label="Active classes" value={String(myClasses.length)} icon={<ClipboardList className="size-4" />} />
        <StatCard label="Unread messages" value={String(unread)} icon={<MessageSquare className="size-4" />} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Upcoming sessions</h3>
            <Link to="/coach/schedule" className="text-sm font-semibold text-lime">Full schedule</Link>
          </div>
          <ul className="mt-3 space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={nameOf(s.memberId)} size="sm" />
                  <div>
                    <p className="font-semibold">{nameOf(s.memberId)}</p>
                    <p className="text-xs text-mist">{s.notes || 'PT session'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{s.date} · {s.time}</p>
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
            {!upcoming.length && <p className="text-sm text-mist">No upcoming sessions booked.</p>}
          </ul>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold">Your classes this week</h3>
            <ul className="mt-3 space-y-2">
              {myClasses.slice(0, 5).map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="text-mist">{WEEKDAYS_FULL[c.dayOfWeek]} {c.startTime}</span>
                </li>
              ))}
              {!myClasses.length && <p className="text-sm text-mist">No classes assigned.</p>}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Quick actions</h3>
            <div className="mt-3 grid gap-2">
              <Link to="/coach/workouts"><Button className="w-full" variant="outline">Write a workout plan</Button></Link>
              <Link to="/coach/members"><Button className="w-full" variant="soft">Review members</Button></Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
