import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Select, Textarea } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { WEEKDAYS, uid } from '../../lib/utils'
import type { GymClass } from '../../types'

type ClassForm = {
  name: string
  category: string
  trainerId: string
  branchId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  capacity: string
  room: string
  level: GymClass['level']
  description: string
}

const blank = (): ClassForm => ({
  name: '', category: 'HIIT', trainerId: 'tr_1', branchId: 'br_airport',
  dayOfWeek: 1, startTime: '07:00', endTime: '07:45', capacity: '20',
  room: 'Studio A', level: 'All', description: '',
})

export function ClassesAdmin() {
  const { classes, trainers, users, branches, upsertClass, deleteClass, log } = useApp()
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClassForm>(blank())
  const [err, setErr] = useState('')

  const tname = (id: string) => users.find((u) => u.id === trainers.find((t) => t.id === id)?.userId)?.name || '—'
  const editing = classes.find((c) => c.id === editingId)

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...blank(), trainerId: trainers[0]?.id || '', branchId: branches[0]?.id || '' })
    setErr('')
    setOpen(true)
  }

  const openEdit = (c: GymClass) => {
    setEditingId(c.id)
    setForm({
      name: c.name,
      category: c.category,
      trainerId: c.trainerId,
      branchId: c.branchId,
      dayOfWeek: c.dayOfWeek,
      startTime: c.startTime,
      endTime: c.endTime,
      capacity: String(c.capacity),
      room: c.room,
      level: c.level,
      description: c.description,
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 2) return 'Class name is required.'
    if (!form.category.trim()) return 'Category is required.'
    if (!form.trainerId) return 'Assign a coach.'
    if (!form.branchId) return 'Select a club.'
    if (!form.room.trim()) return 'Room is required.'
    if (!/^\d{2}:\d{2}$/.test(form.startTime) || !/^\d{2}:\d{2}$/.test(form.endTime)) {
      return 'Use 24-hour times like 07:00.'
    }
    if (form.endTime <= form.startTime) return 'End time must be after start time.'
    const capacity = Number(form.capacity)
    if (!capacity || capacity < 1) return 'Capacity must be at least 1.'
    const enrolled = editing?.enrolled || 0
    if (capacity < enrolled) return `Capacity cannot be below current enrolment (${enrolled}).`
    return ''
  }

  const save = () => {
    if (!canEdit) { toast.error('Only managers and super admins can edit classes.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const base = editing
    const record: GymClass = {
      id: editingId || uid('cl'),
      name: form.name.trim(),
      category: form.category.trim(),
      trainerId: form.trainerId,
      branchId: form.branchId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      capacity: Number(form.capacity),
      enrolled: base?.enrolled || 0,
      waitlist: base?.waitlist || 0,
      room: form.room.trim(),
      level: form.level,
      image: base?.image || '/images/program-hiit.jpg',
      description: form.description.trim() || `${form.name.trim()} at ${form.startTime}.`,
    }
    upsertClass(record)
    log(user?.id || 'admin', editingId ? 'UPDATE' : 'CREATE', 'Class', `${editingId ? 'Edited' : 'Created'} ${record.name}`)
    toast.success(editingId ? 'Class updated' : 'Class created')
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Class management"
        desc="Schedule, instructors, capacity, waitlists."
        actions={canEdit ? <Button onClick={openCreate}>Create class</Button> : undefined}
      />
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>Class</th><th>When</th><th>Coach</th><th>Club</th><th>Fill</th><th>Wait</th><th></th></tr>
          </thead>
          <tbody>
            {classes.map((c) => (
              <tr key={c.id}>
                <td>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-mist">{c.category} · {c.room} · {c.level}</p>
                </td>
                <td>{WEEKDAYS[c.dayOfWeek]} {c.startTime}–{c.endTime}</td>
                <td>{tname(c.trainerId)}</td>
                <td className="text-mist">{branches.find((b) => b.id === c.branchId)?.name}</td>
                <td>
                  <Badge tone={c.enrolled >= c.capacity ? 'rose' : 'lime'}>{c.enrolled}/{c.capacity}</Badge>
                </td>
                <td>{c.waitlist}</td>
                <td className="whitespace-nowrap">
                  {canEdit && (
                    <>
                      <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(c)} aria-label="Edit class">
                        <Pencil className="size-4" />
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => { deleteClass(c.id); toast.info('Class removed') }}>Remove</Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit class' : 'New class'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Coach">
            <Select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
              {trainers.map((t) => <option key={t.id} value={t.id}>{tname(t.id)}</option>)}
            </Select>
          </Field>
          <Field label="Club">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Day">
            <Select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Room"><Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} /></Field>
          <Field label="Start"><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
          <Field label="End"><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Level">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as GymClass['level'] })}>
              <option>All</option>
              <option>Beginner</option>
              <option>Intermediate</option>
              <option>Advanced</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        </div>
        {editing && <p className="mt-2 text-xs text-mist">{editing.enrolled} currently enrolled · {editing.waitlist} waitlist</p>}
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create class'}</Button>
      </Modal>
    </div>
  )
}
