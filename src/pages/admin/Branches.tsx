import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { PageHeader, Badge, Button, Modal, Field, Input, Select } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { REVENUE_SERIES } from '../../data/seed'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { uid } from '../../lib/utils'
import { isPhone } from '../../lib/validate'
import { userCompanyId, visibleBranches } from '../../lib/accessScope'
import type { Branch } from '../../types'

type BranchForm = {
  name: string
  address: string
  city: string
  phone: string
  hours: string
  capacity: string
  members: string
  managerId: string
  lat: string
  lng: string
}

const blank = (): BranchForm => ({
  name: '', address: '', city: 'Accra', phone: '+233 ', hours: '06:00 – 22:00',
  capacity: '600', members: '0', managerId: 'u_manager', lat: '5.6037', lng: '-0.1870',
})

export function Branches() {
  const { branches, users, classes, activeCompanyId, upsertBranch, log } = useApp()
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'company_admin')
  const accessibleBranches = user?.role === 'super_admin' ? branches : visibleBranches(user, branches, activeCompanyId)
  const scopedCompanyId = user && (user.role === 'company_admin' || user.role === 'head_office' || user.role === 'branch_admin')
    ? userCompanyId(user, branches)
    : activeCompanyId
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BranchForm>(blank())
  const [err, setErr] = useState('')

  const managers = users.filter((u) => u.role === 'gym_manager' || u.role === 'super_admin')

  const openCreate = () => {
    setEditingId(null)
    setForm(blank())
    setErr('')
    setOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditingId(b.id)
    setForm({
      name: b.name,
      address: b.address,
      city: b.city,
      phone: b.phone,
      hours: b.hours,
      capacity: String(b.capacity),
      members: String(b.members),
      managerId: b.managerId,
      lat: String(b.lat),
      lng: String(b.lng),
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 3) return 'Branch name must be at least 3 characters.'
    if (form.address.trim().length < 4) return 'Address is required.'
    if (!form.city.trim()) return 'City is required.'
    if (!isPhone(form.phone)) return 'Enter a valid phone number.'
    if (!form.hours.trim()) return 'Opening hours are required.'
    const capacity = Number(form.capacity)
    const members = Number(form.members)
    if (!capacity || capacity < 1) return 'Capacity must be at least 1.'
    if (Number.isNaN(members) || members < 0) return 'Member count cannot be negative.'
    if (members > capacity) return 'Reported members cannot exceed capacity.'
    if (!form.managerId) return 'Select a manager.'
    const lat = Number(form.lat)
    const lng = Number(form.lng)
    if (Number.isNaN(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.'
    if (Number.isNaN(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.'
    const dup = branches.some((b) => b.name.toLowerCase() === form.name.trim().toLowerCase() && b.id !== editingId)
    if (dup) return 'A branch with that name already exists.'
    return ''
  }

  const save = () => {
    if (!canEdit) { toast.error('Only managers and super admins can change branches.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const record: Branch = {
      id: editingId || uid('br'),
      companyId: branches.find((branch) => branch.id === editingId)?.companyId || scopedCompanyId,
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      hours: form.hours.trim(),
      capacity: Number(form.capacity),
      members: Number(form.members),
      managerId: form.managerId,
      lat: Number(form.lat),
      lng: Number(form.lng),
    }
    upsertBranch(record)
    log(user?.id || 'admin', editingId ? 'UPDATE' : 'CREATE', 'Branch', `${editingId ? 'Edited' : 'Created'} ${record.name}`)
    toast.success(editingId ? 'Branch updated' : 'Branch created')
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Branches"
        desc="Multi-club performance and allocation."
        actions={canEdit ? <Button onClick={openCreate}><Plus className="size-4" /> Create branch</Button> : undefined}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {accessibleBranches.map((b) => {
          const headcount = users.filter((u) => u.branchId === b.id && u.role === 'member').length
          const cls = classes.filter((c) => c.branchId === b.id).length
          const util = Math.round((b.members / Math.max(b.capacity, 1)) * 100)
          return (
            <article key={b.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-xl">{b.name}</h2>
                  <p className="text-sm text-mist">{b.address} · {b.city}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={util > 85 ? 'rose' : 'lime'}>{util}% full</Badge>
                  {canEdit && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(b)} aria-label="Edit branch">
                      <Pencil className="size-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div><p className="text-mist">Members</p><p className="stat-num text-2xl">{b.members}</p></div>
                <div><p className="text-mist">Capacity</p><p className="stat-num text-2xl">{b.capacity}</p></div>
                <div><p className="text-mist">Classes</p><p className="stat-num text-2xl">{cls}</p></div>
              </div>
              <div className="mt-4 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={REVENUE_SERIES}>
                    <XAxis dataKey="month" hide />
                    <Tooltip />
                    <Bar dataKey="visits" fill="#C8F542" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-3 text-xs text-mist">{b.hours} · {b.phone} · sample roster {headcount}</p>
            </article>
          )
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit branch' : 'Create branch'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Branch name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field></div>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Hours"><Input value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></Field>
          <Field label="Capacity"><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></Field>
          <Field label="Current members"><Input type="number" value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} /></Field>
          <Field label="Manager">
            <Select value={form.managerId} onChange={(e) => setForm({ ...form, managerId: e.target.value })}>
              {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Latitude"><Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create branch'}</Button>
      </Modal>
    </div>
  )
}
