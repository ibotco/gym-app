import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, BadgeCheck } from 'lucide-react'
import { Button, Modal, Field, Input, Select } from '../../components/ui'
import { TRAINERS, USERS } from '../../data/seed'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs } from '../../lib/utils'
import { uid } from '../../lib/utils'

const names: Record<string, string> = {
  u_trainer: 'Kojo Mensah',
  u_trainer2: 'Amara Cole',
  u_trainer3: 'Erik Holm',
  u_trainer4: 'Priya Nair',
}

export function Trainers() {
  const [sel, setSel] = useState<string | null>(null)
  const [date, setDate] = useState('2026-08-20')
  const [time, setTime] = useState('07:00')
  const app = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const tr = TRAINERS.find((t) => t.id === sel)

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Coaches</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">The floor staff.</h1>
      <p className="mt-4 max-w-2xl text-mist">Book a consult. First session is complimentary on Quarterly and above.</p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {TRAINERS.map((t) => {
          const u = USERS.find((x) => x.id === t.userId)!
          return (
            <article key={t.id} className="card grid overflow-hidden sm:grid-cols-[220px_1fr]">
              <img src={t.photo} alt={names[t.userId]} className="h-64 w-full object-cover object-top sm:h-full" />
              <div className="p-6">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-2xl">{names[t.userId]}</h2>
                    <p className="text-sm text-mist">{t.experienceYears} years · {t.clientsCount} active clients</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-lime">
                    <Star className="size-4 fill-lime" /> {t.rating}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-zinc-300">{t.bio}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.specialties.map((s) => <span key={s} className="chip bg-white/5">{s}</span>)}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.certifications.map((s) => (
                    <span key={s} className="chip bg-lime/10 text-lime"><BadgeCheck className="size-3" />{s}</span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-sm text-mist">{formatGhs(t.hourlyRate)} / hour</p>
                  <Button onClick={() => setSel(t.id)}>Book a session</Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={`Book ${tr ? names[tr.userId] : ''}`}>
        <div className="space-y-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time">
            <Select value={time} onChange={(e) => setTime(e.target.value)}>
              {['06:00', '07:00', '08:00', '12:00', '17:00', '18:00'].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Button
            className="w-full"
            onClick={() => {
              if (!user) {
                nav('/login?next=/trainers')
                return
              }
              const member = app.members.find((m) => m.userId === user.id)
              if (!member || !sel) {
                toast.info('Create a membership first.', 'Join a plan to book PT.')
                nav('/register')
                return
              }
              app.upsertSession({
                id: uid('ss'),
                trainerId: sel,
                memberId: member.id,
                date,
                time,
                status: 'scheduled',
                notes: 'Booked from public trainers page',
              })
              toast.success('Session reserved', `${date} at ${time}`)
              setSel(null)
            }}
          >
            Confirm booking
          </Button>
        </div>
      </Modal>
    </div>
  )
}
