import { useState } from 'react'
import { PageHeader, Modal, Button, Badge, Field, Input, Textarea, Select, StatusBadge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { uid, formatDate } from '../../lib/utils'
import { Plus, Trash2 , X} from 'lucide-react'
import type { Exercise, WorkoutPlan } from '../../types'

export function TrainerWorkouts() {
  const { user } = useAuth()
  const toast = useToast()
  const { trainers, members, users, workouts, upsertWorkout } = useApp()
  const me = trainers.find((t) => t.userId === user?.id)
  const mine = workouts.filter((w) => w.trainerId === me?.id)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [memberId, setMemberId] = useState('')
  const [notes, setNotes] = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([{ name: '', sets: 3, reps: '10' }])

  const nameOf = (mid: string) => users.find((u) => u.id === members.find((m) => m.id === mid)?.userId)?.name ?? 'Member'

  const reset = () => { setName(''); setMemberId(''); setNotes(''); setExercises([{ name: '', sets: 3, reps: '10' }]) }

  const submit = () => {
    if (!name.trim()) { toast.error('Name the plan first.'); return }
    if (!memberId) { toast.error('Pick a member.'); return }
    const ex = exercises.filter((e) => e.name.trim())
    if (!ex.length) { toast.error('Add at least one exercise.'); return }
    const plan: WorkoutPlan = {
      id: uid('wo'),
      memberId,
      trainerId: me?.id ?? '',
      name: name.trim(),
      startDate: new Date().toISOString().slice(0, 10),
      status: 'active',
      notes: notes.trim() || undefined,
      exercises: ex,
    }
    upsertWorkout(plan)
    toast.success('Workout published', name)
    setOpen(false)
    reset()
  }

  return (
    <div>
      <PageHeader
        eyebrow="Coach"
        title="Workout plans"
        desc="Programmes you publish for your members."
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" /> New plan</Button>}
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {mine.map((w) => (
          <li key={w.id} className="card p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{w.name}</p>
              <StatusBadge status={w.status} />
            </div>
            <p className="mt-1 text-xs text-mist">{nameOf(w.memberId)} · since {formatDate(w.startDate)}</p>
            {w.notes && <p className="mt-2 text-sm text-mist">{w.notes}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {w.exercises.map((e, i) => <Badge key={i} tone="zinc">{e.name}</Badge>)}
            </div>
          </li>
        ))}
      </ul>
      {!mine.length && <p className="text-mist">No plans yet. Publish your first one.</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="New workout plan" wide>
        <div className="grid gap-3">
          <Field label="Plan name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Strength base · Block 1" /></Field>
          <Field label="Member" required>
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} placeholder="Select member…">
              {members.filter((m) => m.trainerId === me?.id).map((m) => (
                <option key={m.id} value={m.id}>{users.find((u) => u.id === m.userId)?.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[13px] font-bold text-[#16325c] dark:text-zinc-200">Exercises</p>
              <Button size="sm" variant="ghost" onClick={() => setExercises((s) => [...s, { name: '', sets: 3, reps: '10' }])}><Plus className="size-4" /> Add</Button>
            </div>
            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="flex-1" value={ex.name} placeholder="Exercise name" onChange={(e) => setExercises((s) => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <Input className="w-20" type="number" value={ex.sets} onChange={(e) => setExercises((s) => s.map((x, j) => j === i ? { ...x, sets: Number(e.target.value) } : x))} />
                  <Input className="w-24" value={ex.reps} placeholder="reps" onChange={(e) => setExercises((s) => s.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                  <button type="button" className="grid size-8 place-items-center rounded-lg text-mist transition hover:bg-rose-500/10 hover:text-ember" title="Remove line" aria-label="Remove line" onClick={() => setExercises((s) => s.filter((_, j) => j !== i))}><X className="size-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Publish plan</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
