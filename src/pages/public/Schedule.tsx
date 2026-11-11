import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Select, Badge, StatusBadge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { WEEKDAYS_FULL } from '../../lib/utils'

export function Schedule() {
  const { classes, trainers, users, branches, bookClass, members } = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [branch, setBranch] = useState('all')
  const [cat, setCat] = useState('all')

  const filtered = useMemo(
    () => classes.filter((c) => (branch === 'all' || c.branchId === branch) && (cat === 'all' || c.category === cat)),
    [classes, branch, cat],
  )
  const cats = Array.from(new Set(classes.map((c) => c.category)))
  const days = [1, 2, 3, 4, 5, 6, 0]

  const trainerName = (id: string) => {
    const t = trainers.find((x) => x.id === id)
    const u = users.find((x) => x.id === t?.userId)
    return u?.name || 'Coach'
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Timetable</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-5xl">This week on the floor.</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={branch} onChange={(e) => setBranch(e.target.value)} className="max-w-xs">
          <option value="all">All clubs</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="max-w-xs">
          <option value="all">All formats</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </div>

      <div className="mt-8 space-y-8">
        {days.map((d) => {
          const list = filtered.filter((c) => c.dayOfWeek === d).sort((a, b) => a.startTime.localeCompare(b.startTime))
          if (!list.length) return null
          return (
            <div key={d}>
              <h2 className="font-display text-xl">{WEEKDAYS_FULL[d]}</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {list.map((c) => {
                  const full = c.enrolled >= c.capacity
                  return (
                    <div key={c.id} className="card flex gap-4 p-4">
                      <img src={c.image} alt="" className="hidden h-24 w-24 rounded-xl object-cover sm:block" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{c.name}</p>
                            <p className="text-xs text-mist">{c.startTime}–{c.endTime} · {c.room} · {trainerName(c.trainerId)}</p>
                          </div>
                          <Badge tone={full ? 'rose' : 'lime'}>{c.enrolled}/{c.capacity}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-mist">{c.description}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-xs text-mist">{branches.find((b) => b.id === c.branchId)?.name} · {c.level}</span>
                          <Button
                            size="sm"
                            variant={full ? 'outline' : 'lime'}
                            onClick={() => {
                              if (!user) { nav('/login?next=/schedule'); return }
                              const m = members.find((x) => x.userId === user.id)
                              if (!m) { toast.info('Members only'); return }
                              const date = nextDateForDow(c.dayOfWeek)
                              const r = bookClass(c.id, m.id, date)
                              if (r.ok) toast.success(r.message, `${c.name} · ${date}`)
                              else toast.error(r.message)
                            }}
                          >
                            {full ? 'Join waitlist' : 'Book'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function nextDateForDow(dow: number) {
  const d = new Date()
  const diff = (dow + 7 - d.getDay()) % 7
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff))
  return d.toISOString().slice(0, 10)
}
