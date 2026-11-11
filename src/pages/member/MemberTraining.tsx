import { useState } from 'react'
import { PageHeader, Button, Select, Field, Input, StatusBadge, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, uid } from '../../lib/utils'

export function MemberTraining() {
  const { user } = useAuth()
  const { members, trainers, users, sessions, workouts, upsertSession } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const mySessions = sessions.filter((s) => s.memberId === m?.id)
  const myPlans = workouts.filter((w) => w.memberId === m?.id)
  const [trainerId, setTrainerId] = useState(trainers[0].id)
  const [date, setDate] = useState('2026-08-20')
  const [time, setTime] = useState('07:00')
  const trUser = (id: string) => users.find((u) => u.id === trainers.find((t) => t.id === id)?.userId)

  return (
    <div>
      <PageHeader title="Personal training" desc="Book a coach. Review your current block." />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-5">
          <h3 className="font-semibold">Book a trainer</h3>
          <Field label="Coach">
            <Select value={trainerId} onChange={(e) => setTrainerId(e.target.value)}>
              {trainers.map((t) => <option key={t.id} value={t.id}>{trUser(t.id)?.name} · {formatGhs(t.hourlyRate)}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><DatePicker value={date} onChange={setDate} /></Field>
            <Field label="Time"><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
          </div>
          <Button onClick={() => {
            if (!m) return
            upsertSession({ id: uid('ss'), trainerId, memberId: m.id, date, time, status: 'scheduled', notes: 'Member booked' })
            toast.success('Session booked')
          }}>Confirm</Button>
          <ul className="mt-4 space-y-2 text-sm">
            {mySessions.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.date} {s.time} · {trUser(s.trainerId)?.name}</span>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          {myPlans.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {p.exercises.map((e) => (
                  <li key={e.name} className="flex justify-between border-b border-white/5 py-1">
                    <span>{e.name}</span>
                    <span className="text-mist">{e.sets} × {e.reps}</span>
                  </li>
                ))}
              </ul>
              {p.notes && <p className="mt-2 text-xs text-mist">{p.notes}</p>}
            </div>
          ))}
          {!myPlans.length && <p className="text-sm text-mist">Your coach hasn’t published a plan yet.</p>}
        </div>
      </div>
    </div>
  )
}
