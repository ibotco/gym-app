import { useState } from 'react'
import { PageHeader, StatusBadge, Avatar, Segmented } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { WEEKDAYS_FULL } from '../../lib/utils'

export function TrainerSchedule() {
  const { user } = useAuth()
  const { trainers, members, users, sessions, classes, branches } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const mySessions = sessions.filter((s) => s.trainerId === me?.id)
  const myClasses = classes.filter((c) => c.trainerId === me?.id)

  const today = new Date().getDay()
  const [day, setDay] = useState(today)

  const dayClasses = myClasses.filter((c) => c.dayOfWeek === day)
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const branchOf = (id: string) => branches.find((b) => b.id === id)?.name ?? ''
  const memberOf = (id: string) => members.find((m) => m.id === id)

  const options = WEEKDAYS_FULL.map((label, i) => ({ id: String(i), label: label.slice(0, 3) }))

  return (
    <div>
      <PageHeader eyebrow="Coach" title="Schedule" desc="Your weekly classes and personal-training sessions." />
      <div className="mb-4">
        <Segmented value={String(day)} onChange={(v) => setDay(Number(v))} options={options} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">Classes · {WEEKDAYS_FULL[day]}</h3>
          <ul className="mt-3 space-y-2">
            {dayClasses.map((c) => (
              <li key={c.id} className="rounded-xl border border-white/5 px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{c.name}</p>
                  <StatusBadge status={c.enrolled >= c.capacity ? 'waitlist' : 'booked'} />
                </div>
                <p className="mt-1 text-xs text-mist">
                  {c.startTime} – {c.endTime} · {branchOf(c.branchId)} · {c.room}
                </p>
                <p className="text-xs text-mist">{c.enrolled}/{c.capacity} enrolled · {c.waitlist} waitlist</p>
              </li>
            ))}
            {!dayClasses.length && <p className="text-sm text-mist">No classes on this day.</p>}
          </ul>
        </div>

        <div className="card p-5">
          <h3 className="font-semibold">PT sessions</h3>
          <ul className="mt-3 space-y-2">
            {mySessions.slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)).map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={nameOf(s.memberId)} size="sm" />
                  <div>
                    <p className="font-semibold">{nameOf(s.memberId)}</p>
                    <p className="text-xs text-mist">{s.notes}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{s.date} · {s.time}</p>
                  <StatusBadge status={s.status} />
                </div>
              </li>
            ))}
            {!mySessions.length && <p className="text-sm text-mist">No sessions yet.</p>}
          </ul>
        </div>
      </div>
    </div>
  )
}
