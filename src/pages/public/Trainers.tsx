import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, BadgeCheck } from 'lucide-react'
import { Button, Modal, Field, Input, Select, DatePicker } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs } from '../../lib/utils'
import { uid } from '../../lib/utils'

type FloorCard = {
  id: string
  userId: string
  name: string
  photo?: string
  subtitle: string
  bio?: string
  tags: string[]
  certs: string[]
  hourlyRate?: number
  rating?: number
  bookable: boolean
}

export function Trainers() {
  const [sel, setSel] = useState<string | null>(null)
  const [date, setDate] = useState('2026-08-20')
  const [time, setTime] = useState('07:00')
  const app = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  // Floor staff = trainers (default visible) + staff records flagged "show on website".
  const trainerUserIds = new Set(app.trainers.map((t) => t.userId))
  const cards: FloorCard[] = [
    ...app.trainers
      .filter((t) => t.showOnWebsite !== false)
      .map((t) => {
        const u = app.users.find((x) => x.id === t.userId)
        return {
          id: t.id,
          userId: t.userId,
          name: u?.name || 'Coach',
          photo: t.photo || u?.avatar,
          subtitle: `${t.experienceYears} years · ${t.clientsCount} active clients`,
          bio: t.bio,
          tags: t.specialties,
          certs: t.certifications,
          hourlyRate: t.hourlyRate,
          rating: t.rating,
          bookable: true,
        }
      }),
    ...app.staff
      // Skip staff records that belong to a trainer (already shown above) to
      // avoid a person appearing twice on the floor-staff page.
      .filter((s) => s.showOnWebsite && !trainerUserIds.has(s.userId))
      .map((s) => {
        const u = app.users.find((x) => x.id === s.userId)
        return {
          id: s.id,
          userId: s.userId,
          name: u?.name || 'Staff',
          photo: u?.avatar,
          subtitle: `${s.title} · ${s.department}`,
          bio: undefined,
          tags: [s.title, s.department],
          certs: [],
          hourlyRate: undefined,
          rating: undefined,
          bookable: false,
        }
      }),
  ]

  const tr = cards.find((t) => t.id === sel)

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Coaches</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">The floor staff.</h1>
      <p className="mt-4 max-w-2xl text-mist">Book a consult. First session is complimentary on Quarterly and above.</p>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {cards.map((t) => (
          <article key={t.id} className="card grid overflow-hidden sm:grid-cols-[220px_1fr]">
            <img src={t.photo || '/images/member-ava-6.jpg'} alt={t.name} className="h-64 w-full object-cover object-top sm:h-full" />
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl">{t.name}</h2>
                  <p className="text-sm text-mist">{t.subtitle}</p>
                </div>
                {typeof t.rating === 'number' && (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-lime">
                    <Star className="size-4 fill-lime" /> {t.rating}
                  </span>
                )}
              </div>
              {t.bio && <p className="mt-3 text-sm leading-relaxed text-zinc-300">{t.bio}</p>}
              {t.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.tags.map((s) => <span key={s} className="chip bg-white/5">{s}</span>)}
                </div>
              )}
              {t.certs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.certs.map((s) => (
                    <span key={s} className="chip bg-lime/10 text-lime"><BadgeCheck className="size-3" />{s}</span>
                  ))}
                </div>
              )}
              <div className="mt-5 flex items-center justify-between">
                {typeof t.hourlyRate === 'number' ? (
                  <p className="text-sm text-mist">{formatGhs(t.hourlyRate)} / hour</p>
                ) : (
                  <span />
                )}
                {t.bookable && <Button onClick={() => setSel(t.id)}>Book a session</Button>}
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal open={!!sel} onClose={() => setSel(null)} title={`Book ${tr ? tr.name : ''}`}>
        <div className="space-y-3">
          <Field label="Date"><DatePicker value={date} onChange={setDate} min={new Date().toISOString().slice(0, 10)} /></Field>
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
