import { useMemo, useState } from 'react'
import { PageHeader, Button, Select, Badge, StatusBadge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { WEEKDAYS } from '../../lib/utils'

export function MemberClasses() {
  const { user } = useAuth()
  const { members, classes, bookings, bookClass, cancelBooking, branches, trainers, users } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const [branch, setBranch] = useState('all')
  const list = useMemo(() => classes.filter((c) => branch === 'all' || c.branchId === branch), [classes, branch])
  const mine = bookings.filter((b) => b.memberId === m?.id && b.status !== 'cancelled')

  const tname = (id: string) => users.find((u) => u.id === trainers.find((t) => t.id === id)?.userId)?.name

  return (
    <div>
      <PageHeader title="Class bookings" desc="Book, cancel, or join a waitlist." />
      <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="mb-4 max-w-xs">
        <option value="all">All clubs</option>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((c) => {
          const full = c.enrolled >= c.capacity
          return (
            <div key={c.id} className="card p-4">
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-mist">{WEEKDAYS[c.dayOfWeek]} {c.startTime} · {tname(c.trainerId)} · {c.room}</p>
                </div>
                <Badge tone={full ? 'rose' : 'lime'}>{c.enrolled}/{c.capacity}</Badge>
              </div>
              <p className="mt-2 text-sm text-mist">{c.description}</p>
              <Button
                className="mt-3"
                size="sm"
                variant={full ? 'outline' : 'lime'}
                onClick={() => {
                  if (!m) return
                  const d = new Date()
                  d.setDate(d.getDate() + ((c.dayOfWeek + 7 - d.getDay()) % 7 || 7))
                  const r = bookClass(c.id, m.id, d.toISOString().slice(0, 10))
                  r.ok ? toast.success(r.message) : toast.error(r.message)
                }}
              >
                {full ? 'Waitlist' : 'Book'}
              </Button>
            </div>
          )
        })}
      </div>
      <h2 className="font-display mt-8 text-xl">Your bookings</h2>
      <ul className="mt-3 space-y-2">
        {mine.map((b) => {
          const c = classes.find((x) => x.id === b.classId)
          return (
            <li key={b.id} className="card flex items-center justify-between p-3 text-sm">
              <span>{c?.name} · {b.date} · {c?.startTime}</span>
              <span className="flex items-center gap-2">
                <StatusBadge status={b.status} />
                {(b.status === 'booked' || b.status === 'waitlist') && (
                  <Button size="sm" variant="ghost" onClick={() => { cancelBooking(b.id); toast.info('Cancelled') }}>Cancel</Button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
