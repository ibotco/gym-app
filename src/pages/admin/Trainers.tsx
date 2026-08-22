import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, BadgeCheck } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Field, Input, Textarea, Avatar, Select, SearchField } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, uid } from '../../lib/utils'
import type { Trainer } from '../../types'

type TrainerForm = {
  id?: string
  staffId: string
  specialties: string
  certifications: string
  experienceYears: string
  hourlyRate: string
  bio: string
  rating: string
  clientsCount: string
  showOnWebsite: boolean
}

const blank = (): TrainerForm => ({
  staffId: '', specialties: '', certifications: '', experienceYears: '1',
  hourlyRate: '150', bio: '', rating: '5', clientsCount: '0', showOnWebsite: true,
})

export function TrainersAdmin() {
  const app = useApp()
  const { trainers, users, staff, upsertTrainer, deleteTrainer, log } = app
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager')

  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<TrainerForm | null>(null)
  const [deleting, setDeleting] = useState<Trainer | null>(null)
  const [err, setErr] = useState('')

  // Resolve a trainer's basic details from the employee (staff) table.
  const basicOf = (t: Trainer) => {
    const rec = staff.find((s) => s.userId === t.userId)
    const u = users.find((x) => x.id === t.userId)
    return { rec, u, name: u?.name || '—', photo: u?.avatar || t.photo, title: rec?.title, department: rec?.department }
  }

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return trainers.map((t) => {
      const b = basicOf(t)
      return { t, ...b }
    }).filter((r) => !ql || `${r.name} ${r.title || ''} ${r.department || ''} ${r.t.specialties.join(' ')}`.toLowerCase().includes(ql))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainers, users, staff, q])

  // Employees eligible to be trainers (not already a trainer unless editing).
  const eligibleStaff = useMemo(
    () => staff.filter((s) => {
      if (editing?.id) {
        const current = trainers.find((t) => t.id === editing.id)
        if (current?.userId === s.userId) return true
      }
      return !trainers.some((t) => t.userId === s.userId)
    }),
    [staff, trainers, editing?.id],
  )

  const openCreate = () => { setEditing(blank()); setErr('') }

  const openEdit = (t: Trainer) => {
    setEditing({
      id: t.id,
      staffId: staff.find((s) => s.userId === t.userId)?.id || '',
      specialties: t.specialties.join(', '),
      certifications: t.certifications.join(', '),
      experienceYears: String(t.experienceYears),
      hourlyRate: String(t.hourlyRate),
      bio: t.bio,
      rating: String(t.rating),
      clientsCount: String(t.clientsCount),
      showOnWebsite: t.showOnWebsite !== false,
    })
    setErr('')
  }

  const save = () => {
    if (!editing) return
    if (!canEdit) { toast.error('You are not authorised to edit trainers.'); return }
    const specialties = editing.specialties.split(',').map((s) => s.trim()).filter(Boolean)
    const certifications = editing.certifications.split(',').map((s) => s.trim()).filter(Boolean)
    if (!editing.staffId) { setErr('Select an employee to link this trainer to.'); return }
    if (!specialties.length) { setErr('Enter at least one specialty (comma separated).'); return }
    const rate = Number(editing.hourlyRate)
    if (!rate || rate < 0) { setErr('Hourly rate must be a positive number.'); return }

    const rec = staff.find((s) => s.id === editing.staffId)
    if (!rec) { setErr('Employee record not found.'); return }
    const existing = trainers.find((t) => t.id === editing.id)

    const record: Trainer = {
      id: existing?.id || uid('tr'),
      userId: rec.userId,
      specialties,
      certifications,
      experienceYears: Number(editing.experienceYears) || 1,
      hourlyRate: rate,
      bio: editing.bio.trim(),
      rating: Number(editing.rating) || 5,
      clientsCount: Number(editing.clientsCount) || 0,
      photo: undefined, // basic details (photo/name) come from the employee record
      showOnWebsite: editing.showOnWebsite,
    }
    upsertTrainer(record)
    log(user?.id || 'admin', existing ? 'UPDATE' : 'CREATE', 'Trainer', `${existing ? 'Edited' : 'Created'} ${users.find((u) => u.id === rec.userId)?.name || rec.userId}`)
    toast.success(existing ? 'Trainer updated' : 'Trainer created')
    setEditing(null)
  }

  const doDelete = () => {
    if (!deleting) return
    deleteTrainer(deleting.id)
    log(user?.id || 'admin', 'DELETE', 'Trainer', `Deleted ${users.find((u) => u.id === deleting.userId)?.name || deleting.id}`)
    toast.success('Trainer deleted')
    setDeleting(null)
  }

  const columns: Column<{ t: Trainer; name: string; photo?: string; title?: string; department?: string }>[] = [
    {
      key: 'name', header: 'Trainer', sortValue: (r) => r.name,
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar src={r.photo} name={r.name} />
          <div>
            <p className="font-semibold">{r.name}</p>
            <p className="text-xs text-mist">{r.title ? `${r.title} · ${r.department}` : 'No employee record linked'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'specialties', header: 'Specialties',
      render: (r) => <div className="flex max-w-[240px] flex-wrap gap-1">{r.t.specialties.map((s) => <span key={s} className="chip bg-white/5 text-[10px]">{s}</span>)}</div>,
    },
    {
      key: 'certs', header: 'Certifications',
      render: (r) => <div className="flex max-w-[200px] flex-wrap gap-1">{r.t.certifications.map((c) => <span key={c} className="chip bg-lime/10 text-[10px] text-lime"><BadgeCheck className="size-3" />{c}</span>)}</div>,
    },
    { key: 'exp', header: 'Experience', sortValue: (r) => r.t.experienceYears, render: (r) => `${r.t.experienceYears} yrs` },
    { key: 'rate', header: 'Rate / hr', sortValue: (r) => r.t.hourlyRate, render: (r) => <span className="font-semibold">{formatGhs(r.t.hourlyRate)}</span> },
    { key: 'rating', header: 'Rating', sortValue: (r) => r.t.rating, render: (r) => `${r.t.rating}★` },
    { key: 'website', header: 'Floor staff', sortValue: (r) => (r.t.showOnWebsite === false ? 0 : 1), render: (r) => <Badge tone={r.t.showOnWebsite === false ? 'zinc' : 'lime'}>{r.t.showOnWebsite === false ? 'Hidden' : 'On site'}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (r) => (
        <span className="flex items-center justify-end gap-1 whitespace-nowrap">
          {canEdit && <button className="rounded-lg p-2 text-mist hover:text-lime" title="Edit" onClick={() => openEdit(r.t)}><Pencil className="size-4" /></button>}
          {canEdit && <button className="rounded-lg p-2 text-mist hover:text-ember" title="Delete" onClick={() => setDeleting(r.t)}><Trash2 className="size-4" /></button>}
        </span>
      ),
    },
  ]

  const selectedStaff = editing ? staff.find((s) => s.id === editing.staffId) : undefined
  const selectedUser = selectedStaff ? users.find((u) => u.id === selectedStaff.userId) : undefined

  return (
    <div>
      <PageHeader
        title="Trainers"
        desc="Coaching profiles — link an employee and manage specialties, certifications and rate."
        actions={canEdit ? <Button onClick={openCreate}><Plus className="size-4" /> New trainer</Button> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField value={q} onChange={setQ} placeholder="Search trainers…" className="max-w-sm" />
        <div className="ml-auto"><ExportButtons filename="trainers" rows={rows.map((r) => ({ name: r.name, title: r.title || '', department: r.department || '', specialties: r.t.specialties.join(', '), hourlyRate: r.t.hourlyRate, rating: r.t.rating, clients: r.t.clientsCount }))} /></div>
      </div>

      <DataTable columns={columns} data={rows} rowKey={(r) => r.t.id} emptyTitle="No trainers" emptyDesc="Link your first employee to a coaching profile with the New trainer button." />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit trainer' : 'New trainer'} wide>
        {editing && (
          <>
            <Field label="Employee" required>
              <Select value={editing.staffId} onChange={(e) => setEditing({ ...editing, staffId: e.target.value })}>
                <option value="">Select an employee…</option>
                {eligibleStaff.map((s) => {
                  const u = users.find((x) => x.id === s.userId)
                  return <option key={s.id} value={s.id}>{u?.name || s.id} — {s.title} ({s.department})</option>
                })}
              </Select>
            </Field>

            {selectedStaff && selectedUser && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-black/5 p-3 dark:bg-white/5">
                <Avatar src={selectedUser.avatar} name={selectedUser.name} />
                <div>
                  <p className="text-sm font-semibold">{selectedUser.name}</p>
                  <p className="text-xs text-mist">{selectedStaff.title} · {selectedStaff.department} · {selectedUser.email}</p>
                </div>
              </div>
            )}
            <p className="mt-1 text-xs text-mist">Name, photo and department are pulled from the employee record.</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Specialties (comma separated)"><Input value={editing.specialties} onChange={(e) => setEditing({ ...editing, specialties: e.target.value })} placeholder="Strength, Fat loss, Athletic performance" /></Field></div>
              <div className="sm:col-span-2"><Field label="Certifications (comma separated)"><Input value={editing.certifications} onChange={(e) => setEditing({ ...editing, certifications: e.target.value })} placeholder="NASM-CPT, CSCS" /></Field></div>
              <Field label="Experience (years)"><Input type="number" value={editing.experienceYears} onChange={(e) => setEditing({ ...editing, experienceYears: e.target.value })} /></Field>
              <Field label="Hourly rate (GHS)"><Input type="number" value={editing.hourlyRate} onChange={(e) => setEditing({ ...editing, hourlyRate: e.target.value })} /></Field>
              <Field label="Rating (1–5)"><Input type="number" step="0.1" min="1" max="5" value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: e.target.value })} /></Field>
              <Field label="Active clients"><Input type="number" value={editing.clientsCount} onChange={(e) => setEditing({ ...editing, clientsCount: e.target.value })} /></Field>
              <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 sm:col-span-2">
                <div><p className="text-sm font-semibold">Floor staff</p><p className="text-xs text-mist">Show on the public site.</p></div>
                <input type="checkbox" className="size-4 accent-[#c8f542]" checked={editing.showOnWebsite} onChange={(e) => setEditing({ ...editing, showOnWebsite: e.target.checked })} />
              </div>
              <div className="sm:col-span-2"><Field label="Bio"><Textarea value={editing.bio} onChange={(e) => setEditing({ ...editing, bio: e.target.value })} rows={3} /></Field></div>
            </div>
            {err && <p className="mt-3 text-sm text-ember">{err}</p>}
            <Button className="mt-4 w-full" onClick={save}>{editing.id ? 'Save changes' : 'Create trainer'}</Button>
          </>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete trainer?">
        {deleting && (
          <>
            <p className="text-sm text-mist">Delete the coaching profile for <span className="font-semibold text-inherit">{users.find((u) => u.id === deleting.userId)?.name}</span>? This does not delete their employee record or user account.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={doDelete}>Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
