import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { PageHeader, Button, Input, Select, SearchInput, StatusBadge, Avatar, Modal, Field, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, uid } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { generateUsername, hashPassword, passwordPolicyError, takenUsernames } from '../../lib/password'
import { issueInitialPassword, saveReveal } from '../../lib/credentials'
import type { Role, Status, User } from '../../types'

type Form = {
  name: string
  email: string
  phone: string
  role: Role
  status: Status
  branchId: string
  password: string
}

const blank = (): Form => ({
  name: '', email: '', phone: '', role: 'staff', status: 'active', branchId: 'br_airport', password: '',
})

export function UsersAdmin() {
  const { users, branches, upsertUser, patchUser, log, upsertStaff, upsertTrainer, credentialSettings } = useApp()
  const { user: me, hasRole } = useAuth()
  const toast = useToast()
  const canManage = hasRole('super_admin', 'gym_manager')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(blank())
  const [err, setErr] = useState('')

  const rows = useMemo(() => {
    return users.filter((u) => {
      if (role !== 'all' && u.role !== role) return false
      if (status !== 'all' && u.status !== status) return false
      const blob = `${u.name} ${u.email} ${u.phone} ${u.role}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    })
  }, [users, q, role, status])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...blank(), branchId: branches[0]?.id || '' })
    setErr('')
    setOpen(true)
  }

  const openEdit = (u: User) => {
    setEditingId(u.id)
    setForm({
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      branchId: u.branchId || branches[0]?.id || '',
      password: '',
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 2) return 'Name must be at least 2 characters.'
    if (!isEmail(form.email)) return 'Enter a valid email address.'
    if (!isPhone(form.phone)) return 'Enter a valid phone number.'
    if (!form.role) return 'Select a role.'
    if (form.role === 'super_admin' && !hasRole('super_admin')) {
      return 'Only a super admin can assign the super admin role.'
    }
    const taken = users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase() && u.id !== editingId)
    if (taken) return 'That email is already in use.'
    if (!editingId && form.password.trim() && form.password.trim() !== 'demo123') {
      const pe = passwordPolicyError(form.password, credentialSettings.policy)
      if (pe) return pe
    }
    if (editingId && form.password) {
      const pe = passwordPolicyError(form.password, credentialSettings.policy)
      if (pe) return pe
    }
    if (editingId === me?.id && form.status !== 'active') return 'You cannot deactivate your own account.'
    if (editingId === me?.id && form.role !== me.role) return 'You cannot change your own role.'
    return ''
  }

  const save = async () => {
    if (!canManage) { toast.error('Not authorised.'); return }
    const v = validate()
    if (v) { setErr(v); return }

    if (!editingId) {
      const id = uid('u')
      const username = generateUsername(form.name.trim(), takenUsernames(users))
      const custom = form.password.trim() && form.password.trim() !== 'demo123'
      let plain = form.password.trim()
      if (!custom) {
        const issued = issueInitialPassword(credentialSettings.initialPasswordMode || 'auto', form.phone.trim(), credentialSettings.policy)
        if (!issued.ok) { setErr(issued.error); return }
        plain = issued.password
      }
      const hashed = await hashPassword(plain)
      upsertUser({
        id,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        status: form.status,
        branchId: form.branchId || undefined,
        password: hashed,
        avatar: '/images/member-ava-6.jpg',
        createdAt: new Date().toISOString().slice(0, 10),
        emailVerified: true,
        username,
        mustChangePassword: true,
      })
      saveReveal(id, username, plain)
      if (form.role === 'staff' || form.role === 'gym_manager') {
        upsertStaff({
          id: uid('st'),
          userId: id,
          department: form.role === 'gym_manager' ? 'Operations' : 'Front of House',
          salary: form.role === 'gym_manager' ? 9000 : 4000,
          hireDate: new Date().toISOString().slice(0, 10),
          leaveBalance: 15,
          title: form.role === 'gym_manager' ? 'Gym Manager' : 'Staff',
        })
      }
      if (form.role === 'trainer') {
        upsertTrainer({
          id: uid('tr'),
          userId: id,
          specialties: ['General'],
          certifications: [],
          experienceYears: 1,
          bio: '',
          hourlyRate: 150,
          rating: 5,
          clientsCount: 0,
          photo: '/images/trainer-1.jpg',
        })
      }
      log(me?.id || 'admin', 'CREATE', 'User', `Created ${form.name.trim()} (${form.role})`)
      toast.success('User created')
    } else {
      const current = users.find((u) => u.id === editingId)
      if (!current) { setErr('User not found.'); return }
      const hashed = form.password.trim() ? await hashPassword(form.password.trim()) : ''
      patchUser(current.id, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role,
        status: form.status,
        branchId: form.branchId || undefined,
        ...(hashed ? { password: hashed, mustChangePassword: true, passwordChangedAt: new Date().toISOString() } : {}),
      })
      log(me?.id || 'admin', 'UPDATE', 'User', `Updated ${form.name.trim()}`)
      toast.success('User updated')
    }
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="All users"
        desc="Add or update any account — admin, manager, staff, trainer, or member."
        actions={canManage ? <Button onClick={openCreate}><Plus className="size-4" /> Add user</Button> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search users…" />
        <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-44">
          <option value="all">All roles</option>
          {['super_admin', 'gym_manager', 'staff', 'trainer', 'member'].map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="all">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="suspended">suspended</option>
        </Select>
      </div>
      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr><th>User</th><th>Role</th><th>Club</th><th>Status</th><th>Email</th><th>Joined</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatar} name={u.name} />
                    <div>
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-mist">{u.email} · {u.phone}</p>
                    </div>
                  </div>
                </td>
                <td><Badge>{u.role.replace('_', ' ')}</Badge></td>
                <td className="text-mist">{branches.find((b) => b.id === u.branchId)?.name || '—'}</td>
                <td><StatusBadge status={u.status} /></td>
                <td>{u.emailVerified === false ? <Badge tone="amber">Unverified</Badge> : <Badge tone="lime">Verified</Badge>}</td>
                <td className="text-mist">{formatDate(u.createdAt)}</td>
                <td>
                  {canManage && (
                    <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
                      <Pencil className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit user' : 'Add user'} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Home club">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              <option value="">None</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {hasRole('super_admin') && <option value="super_admin">super admin</option>}
              <option value="gym_manager">gym manager</option>
              <option value="staff">staff</option>
              <option value="trainer">trainer</option>
              <option value="member">member</option>
            </Select>
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={editingId ? 'New password (leave blank to keep)' : 'Password (optional)'}>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingId ? 'Unchanged' : 'Leave blank to use club default'} />
            </Field>
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create user'}</Button>
      </Modal>
    </div>
  )
}
