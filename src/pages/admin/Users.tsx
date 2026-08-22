import { useMemo, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader, Button, Input, Select, SearchInput, StatusBadge, Avatar, Modal, Field, Badge } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, uid } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { generateUsername, hashPassword, passwordPolicyError, takenUsernames } from '../../lib/password'
import { issueInitialPassword, saveReveal } from '../../lib/credentials'
import { roleName } from '../../lib/permissions'
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
  const { users, branches, roles, upsertUser, patchUser, deleteUser, log, upsertStaff, upsertTrainer, credentialSettings } = useApp()
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
  const [deleting, setDeleting] = useState<User | null>(null)

  const rows = useMemo(() => {
    return users.filter((u) => {
      if (role !== 'all' && u.role !== role) return false
      if (status !== 'all' && u.status !== status) return false
      const blob = `${u.name} ${u.email} ${u.phone} ${u.role}`.toLowerCase()
      return !q || blob.includes(q.toLowerCase())
    })
  }, [users, q, role, status])

  const columns: Column<User>[] = useMemo(() => [
    {
      key: 'name', header: 'User', sortValue: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-3">
          <Avatar src={u.avatar} name={u.name} />
          <div>
            <p className="font-semibold">{u.name}</p>
            <p className="text-xs text-mist">{u.email} · {u.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Role', sortValue: (u) => roleName(u.role, roles),
      render: (u) => <Badge>{roleName(u.role, roles)}</Badge>,
    },
    {
      key: 'branch', header: 'Club', sortValue: (u) => branches.find((b) => b.id === u.branchId)?.name || '',
      render: (u) => <span className="text-mist">{branches.find((b) => b.id === u.branchId)?.name || '—'}</span>,
    },
    {
      key: 'status', header: 'Status', sortValue: (u) => u.status,
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'email', header: 'Email', sortValue: (u) => u.email,
      render: (u) => u.emailVerified === false ? <Badge tone="amber">Unverified</Badge> : <Badge tone="lime">Verified</Badge>,
    },
    {
      key: 'joined', header: 'Joined', sortValue: (u) => u.createdAt,
      render: (u) => <span className="text-mist">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'actions', header: 'ACTIONS',
      render: (u) => (
        <span className="whitespace-nowrap">
          {canManage && (
            <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(u)} aria-label={`Edit ${u.name}`}>
              <Pencil className="size-4" />
            </button>
          )}
          {canDelete(u) && (
            <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => setDeleting(u)} aria-label={`Delete ${u.name}`}>
              <Trash2 className="size-4" />
            </button>
          )}
        </span>
      ),
    },
  ], [branches, roles, canManage])

  const canDelete = (u: User) => {
    if (u.role === 'super_admin') return false
    if (u.id === me?.id) return false
    return canManage
  }

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
      if (form.role === 'staff' || form.role === 'gym_manager' || form.role === 'receptionist' || form.role === 'branch_admin' || form.role === 'company_admin' || form.role === 'head_office') {
        const titles: Record<string, string> = { gym_manager: 'Gym Manager', staff: 'Staff', receptionist: 'Receptionist', branch_admin: 'Branch Admin', company_admin: 'Company Admin', head_office: 'Head Office' }
        upsertStaff({
          id: uid('st'),
          userId: id,
          department: form.role === 'gym_manager' ? 'Operations' : 'Front of House',
          salary: form.role === 'gym_manager' ? 9000 : form.role === 'receptionist' ? 3500 : 4000,
          hireDate: new Date().toISOString().slice(0, 10),
          leaveBalance: 15,
          title: titles[form.role] || 'Staff',
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

  const confirmDelete = () => {
    if (!deleting) return
    if (!canDelete(deleting)) {
      toast.error('Cannot delete this user')
      setDeleting(null)
      return
    }
    deleteUser(deleting.id)
    log(me?.id || 'admin', 'DELETE', 'User', `Deleted ${deleting.name} (${deleting.role})`)
    toast.success('User deleted', `${deleting.name} and their member/staff records were removed.`)
    setDeleting(null)
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
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="all">All statuses</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
          <option value="suspended">suspended</option>
        </Select>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(u) => u.id}
          emptyTitle="No users found"
          emptyDesc="Adjust your search or filters, or add a new user."
        />
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
              <option value="company_admin">company admin</option>
              <option value="head_office">head office</option>
              <option value="branch_admin">branch admin</option>
              <option value="receptionist">receptionist</option>
              <option value="accountant">accountant</option>
              <option value="staff">staff</option>
              <option value="trainer">trainer</option>
              <option value="member">member</option>
              <option value="customer">customer</option>
              <option value="supplier">supplier</option>
              {roles.filter((r) => !r.builtin).map((r) => (
                <option key={r.id} value={r.id}>{r.name} (custom)</option>
              ))}
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

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete user?">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              You are about to delete <span className="font-semibold text-inherit">{deleting.name}</span>{' '}
              (<span className="text-inherit">{roleName(deleting.role, roles)}</span>). Their member, staff, or trainer record will be removed too.
            </p>
            <p className="text-xs text-amber-500">This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
              <Button variant="danger" onClick={confirmDelete}>Delete user</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
