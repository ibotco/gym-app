import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Avatar, Badge, Button, Field, Input, Textarea, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { uid, bmi, bmiLabel, formatDate } from '../../lib/utils'
import { ArrowLeft, Dumbbell, TrendingUp } from 'lucide-react'

export function TrainerMemberDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const { trainers, members, users, memberships, plans, progress, workouts, addProgress } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const m = members.find((x) => x.id === id)
  const u = users.find((x) => x.id === m?.userId)
  const ms = memberships.find((x) => x.id === m?.membershipId)
  const plan = plans.find((p) => p.id === (ms?.planId || m?.planId))
  const logs = progress.filter((p) => p.memberId === m?.id).sort((a, b) => a.date.localeCompare(b.date))
  const plans_ = workouts.filter((w) => w.memberId === m?.id)

  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [notes, setNotes] = useState('')

  if (!m || !u) {
    return (
      <div>
        <Link to="/coach/members" className="inline-flex items-center gap-1 text-sm font-semibold text-lime"><ArrowLeft className="size-4" /> Back</Link>
        <p className="mt-4 text-mist">Member not found.</p>
      </div>
    )
  }

  const b = bmi(m.weightKg ?? logs.at(-1)?.weight ?? 0, m.heightCm ?? 0)

  const submit = () => {
    const w = Number(weight)
    if (!w || w <= 0) { toast.error('Enter a valid weight.'); return }
    addProgress({
      id: uid('pr'),
      memberId: m.id,
      date: new Date().toISOString().slice(0, 10),
      weight: w,
      bodyFat: bodyFat ? Number(bodyFat) : undefined,
      notes: notes.trim() || undefined,
    })
    setWeight(''); setBodyFat(''); setNotes('')
    toast.success('Progress logged', `${u.name} updated.`)
  }

  return (
    <div>
      <Link to="/coach/members" className="inline-flex items-center gap-1 text-sm font-semibold text-lime"><ArrowLeft className="size-4" /> Back to members</Link>
      <PageHeader eyebrow="Coach" title={u.name} desc={plan ? `${plan.name} · ${u.email}` : u.email} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar src={u.avatar} name={u.name} size="xl" />
            <div>
              <p className="font-display text-lg font-semibold">{u.name}</p>
              <p className="text-sm text-mist">{u.phone}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-mist">Status</dt><dd><StatusBadge status={u.status} /></dd></div>
            <div className="flex justify-between"><dt className="text-mist">Joined</dt><dd>{formatDate(m.joinDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-mist">Height</dt><dd>{m.heightCm ? `${m.heightCm} cm` : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-mist">BMI</dt><dd>{b ? `${b} (${bmiLabel(b)})` : '—'}</dd></div>
          </dl>
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-mist">Goals</p>
            <div className="flex flex-wrap gap-1.5">{m.goals.map((g) => <Badge key={g} tone="lime">{g}</Badge>)}</div>
          </div>
          {m.medicalNotes && (
            <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <span className="font-bold">Medical:</span> {m.medicalNotes}
            </p>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="size-4 text-lime" /> Progress</h3>
          </div>
          <ul className="mt-3 space-y-2">
            {logs.slice(-6).reverse().map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm">
                <span className="text-mist">{l.date}</span>
                <span className="font-semibold">{l.weight} kg</span>
                <span className="text-mist">{l.bodyFat != null ? `${l.bodyFat}%` : ''}</span>
              </li>
            ))}
            {!logs.length && <p className="text-sm text-mist">No measurements yet.</p>}
          </ul>

          <div className="mt-4 grid gap-3 border-t border-line pt-4">
            <Field label="Weight (kg)"><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 64.2" /></Field>
            <Field label="Body fat % (optional)"><Input type="number" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="e.g. 24" /></Field>
            <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
            <Button onClick={submit}>Log measurement</Button>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Dumbbell className="size-4 text-lime" /> Workout plans</h3>
          <ul className="mt-3 space-y-2">
            {plans_.map((w) => (
              <li key={w.id}>
                <Link to="/coach/workouts" className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5 text-sm hover:border-lime/40">
                  <span className="font-semibold">{w.name}</span>
                  <StatusBadge status={w.status} />
                </Link>
              </li>
            ))}
            {!plans_.length && <p className="text-sm text-mist">No plans authored for this member yet.</p>}
          </ul>
          <Link to="/coach/workouts" className="mt-4 block"><Button className="w-full" variant="outline">Open workout publisher</Button></Link>
        </div>
      </div>
    </div>
  )
}
