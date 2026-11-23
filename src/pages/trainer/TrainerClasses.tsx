import { useState } from 'react'
import { PageHeader, Modal, Button, Badge, Avatar } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { WEEKDAYS_FULL } from '../../lib/utils'
import { UserCheck } from 'lucide-react'

export function TrainerClasses() {
  const { user } = useAuth()
  const toast = useToast()
  const { trainers, classes, branches, bookings, users, members, takeAttendance } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const mine = classes.filter((c) => c.trainerId === me?.id)
  const [roster, setRoster] = useState<string | null>(null)

  const sel = mine.find((c) => c.id === roster)
  const rosterBookings = sel ? bookings.filter((b) => b.classId === sel.id) : []
  const branchOf = (id: string) => branches.find((b) => b.id === id)?.name ?? ''
  const nameOf = (mid: string) => users.find((u) => u.id === members.find((m) => m.id === mid)?.userId)?.name ?? 'Member'

  const mark = (classId: string, memberId: string, present: boolean) => {
    takeAttendance(classId, memberId, present)
    toast.success(present ? 'Marked attended' : 'Marked no-show', nameOf(memberId))
  }

  return (
    <div>
      <PageHeader eyebrow="Coach" title="My classes" desc="Your group classes and attendance." />
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {mine.map((c) => {
          const pct = c.capacity ? Math.round((c.enrolled / c.capacity) * 100) : 0
          return (
            <li key={c.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-mist">{c.category} · {c.room}</p>
                </div>
                <Badge tone={pct >= 100 ? 'amber' : 'lime'}>{c.enrolled}/{c.capacity}</Badge>
              </div>
              <p className="mt-2 text-sm text-mist">
                {WEEKDAYS_FULL[c.dayOfWeek]} · {c.startTime} – {c.endTime} · {branchOf(c.branchId)}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setRoster(c.id)}>
                  <UserCheck className="size-4" /> Attendance
                </Button>
                {c.waitlist > 0 && <span className="text-xs text-amber-400">{c.waitlist} waitlist</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {!mine.length && <p className="text-mist">No classes are assigned to you.</p>}

      <Modal open={!!sel} onClose={() => setRoster(null)} title={sel ? `${sel.name} — roster` : ''} wide>
        {sel && (
          <div>
            {rosterBookings.length === 0 && <p className="text-sm text-mist">No bookings for this class in the sample data.</p>}
            <ul className="space-y-2">
              {rosterBookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Avatar name={nameOf(b.memberId)} size="sm" />
                    <div>
                      <p className="text-sm font-semibold">{nameOf(b.memberId)}</p>
                      <p className="text-xs text-mist">{b.date} · {b.status}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="soft" disabled={b.status === 'attended'} onClick={() => mark(sel.id, b.memberId, true)}>Present</Button>
                    <Button size="sm" variant="ghost" disabled={b.status === 'no-show'} onClick={() => mark(sel.id, b.memberId, false)}>No-show</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
