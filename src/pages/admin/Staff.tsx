import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound, Pencil } from 'lucide-react'
import { PageHeader, Button, Avatar, StatusBadge, Badge, Modal, Field, Input, Select, DatePicker, Switch } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs, formatDate, uid } from '../../lib/utils'
import { visibleBranches } from '../../lib/accessScope'
import { isEmail, isPhone } from '../../lib/validate'
import { generateUsername, hashPassword, takenUsernames } from '../../lib/password'
import { issueInitialPassword, saveReveal } from '../../lib/credentials'
import { ProfilePictureInput } from '../../components/ProfilePictureInput'
import type { LeaveRequest, Role, StaffRecord, Status } from '../../types'

type StaffForm = {
  name: string
  email: string
  phone: string
  title: string
  department: string
  salary: string
  leaveBalance: string
  hireDate: string
  role: Role
  status: Status
  branchId: string
  photo: string
  showOnWebsite: boolean
}

const blank = (): StaffForm => ({
  name: '', email: '', phone: '', title: 'Membership Concierge', department: 'Front of House',
  salary: '4200', leaveBalance: '15', hireDate: new Date().toISOString().slice(0, 10),
  role: 'staff', status: 'active', branchId: 'br_airport', photo: '', showOnWebsite: false,
})

export function StaffPage() {
  const app = useApp()
  const { staff, users, trainers, leaves, upsertLeave, upsertStaff, upsertTrainer, patchUser, upsertUser, log, branches, credentialSettings } = app
  const { hasRole, user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const canEdit = hasRole('super_admin', 'gym_manager')
  const branchOptions = visibleBranches(user, branches, app.activeCompanyId).filter((branch) => branch.status !== 'inactive')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(blank())
  const [err, setErr] = useState('')

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...blank(), branchId: app.activeBranchId || branchOptions[0]?.id || 'br_airport' })
    setErr('')
    setOpen(true)
  }

  const openEdit = (s: StaffRecord) => {
    const u = users.find((x) => x.id === s.userId)
    setEditingId(s.id)
    setForm({
      name: u?.name || '',
      email: u?.email || '',
      phone: u?.phone || '',
      title: s.title,
      department: s.department,
      salary: String(s.salary),
      leaveBalance: String(s.leaveBalance),
      hireDate: s.hireDate,
      role: u?.role && u.role !== 'member' ? u.role : 'staff',
      status: u?.status || 'active',
      branchId: s.branchId || u?.branchId || app.activeBranchId || branchOptions[0]?.id || '',
      photo: u?.avatar || '',
      showOnWebsite: !!s.showOnWebsite,
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 2) return 'Name must be at least 2 characters.'
    if (!isEmail(form.email)) return 'Enter a valid email address.'
    if (!isPhone(form.phone)) return 'Enter a valid phone number.'
    if (!form.title.trim()) return 'Title is required.'
    if (!form.department.trim()) return 'Department is required.'
    const salary = Number(form.salary)
    const leave = Number(form.leaveBalance)
    if (!salary || salary < 0) return 'Salary must be a positive number.'
    if (Number.isNaN(leave) || leave < 0) return 'Leave balance cannot be negative.'
    if (!form.hireDate) return 'Hire date is required.'
    if (!form.branchId || !branchOptions.some((branch) => branch.id === form.branchId)) return 'Select a permitted home branch.'
    const existing = users.find((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())
    if (!editingId && existing && staff.some((s) => s.userId === existing.id)) {
      return 'That person already has a staff record.'
    }
    if (editingId && existing) {
      const rec = staff.find((s) => s.id === editingId)
      if (existing.id !== rec?.userId) return 'That email is already in use.'
    }
    return ''
  }

  const save = async () => {
    if (!canEdit) { toast.error('Only managers and super admins can edit staff.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const salary = Number(form.salary)
    const leaveBalance = Number(form.leaveBalance)
    const role = form.role === 'member' ? 'staff' : form.role

    if (!editingId) {
      const existing = users.find((x) => x.email.toLowerCase() === form.email.trim().toLowerCase())
      const userId = existing?.id || uid('u')
      const staffId = uid('st')
      if (!existing) {
        const issued = issueInitialPassword(credentialSettings.initialPasswordMode || 'auto', form.phone.trim(), credentialSettings.policy)
        if (!issued.ok) { setErr(issued.error); return }
        const hashed = await hashPassword(issued.password)
        const username = generateUsername(form.name.trim(), takenUsernames(users))
        upsertUser({
          id: userId,
          email: form.email.trim(),
          password: hashed,
          name: form.name.trim(),
          role,
          avatar: form.photo || '/images/member-ava-6.jpg',
          phone: form.phone.trim(),
          branchId: form.branchId,
          status: form.status,
          createdAt: new Date().toISOString().slice(0, 10),
          emailVerified: true,
          username,
          mustChangePassword: true,
        })
        saveReveal(userId, username, issued.password)
      } else {
        patchUser(userId, {
          companyId: branches.find((branch) => branch.id === form.branchId)?.companyId,
          name: form.name.trim(),
          phone: form.phone.trim(),
          role,
          status: form.status,
          branchId: form.branchId,
        })
      }
      const assignedBranch = branches.find((branch) => branch.id === form.branchId)
      upsertStaff({
        id: staffId,
        companyId: assignedBranch?.companyId,
        branchId: form.branchId,
        userId,
        department: form.department.trim(),
        salary,
        hireDate: form.hireDate,
        leaveBalance,
        title: form.title.trim(),
        showOnWebsite: form.showOnWebsite,
      })
      const linkedTrainer = trainers.find((trainer) => trainer.userId === userId)
      if (linkedTrainer) upsertTrainer({ ...linkedTrainer, companyId: assignedBranch?.companyId || linkedTrainer.companyId, branchId: form.branchId })
      log(user?.id || 'admin', 'CREATE', 'Staff', `Created ${form.name.trim()}`)
      toast.success(
        'Staff record created',
        existing
          ? 'Linked to existing login'
          : credentialSettings.initialPasswordMode === 'phone'
            ? 'Initial password is their phone number. Send it from the credentials panel.'
            : 'Send the temporary login from the credentials panel.',
      )
      setOpen(false)
      nav(`/admin/staff/${staffId}#credentials`)
      return
    } else {
      const rec = staff.find((s) => s.id === editingId)
      if (!rec) { setErr('Staff record not found.'); return }
      const assignedBranch = branches.find((branch) => branch.id === form.branchId)
      patchUser(rec.userId, {
        companyId: assignedBranch?.companyId,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role,
        status: form.status,
        branchId: form.branchId,
        ...(form.photo ? { avatar: form.photo } : {}),
      })
      upsertStaff({
        ...rec,
        companyId: assignedBranch?.companyId || rec.companyId,
        branchId: form.branchId,
        department: form.department.trim(),
        salary,
        hireDate: form.hireDate,
        leaveBalance,
        title: form.title.trim(),
        showOnWebsite: form.showOnWebsite,
      })
      const linkedTrainer = trainers.find((trainer) => trainer.userId === rec.userId)
      if (linkedTrainer) upsertTrainer({ ...linkedTrainer, companyId: assignedBranch?.companyId || linkedTrainer.companyId, branchId: form.branchId })
      log(user?.id || 'admin', 'UPDATE', 'Staff', `Edited ${form.name.trim()}`)
      toast.success('Staff record updated')
    }
    setOpen(false)
  }

  const staffColumns: Column<StaffRecord>[] = [
    {
      key: 'name', header: 'Employee', sortValue: (s) => users.find((x) => x.id === s.userId)?.name || '',
      render: (s) => {
        const u = users.find((x) => x.id === s.userId)
        return (
          <Link to={`/admin/staff/${s.id}`} className="flex items-center gap-3">
            <Avatar src={u?.avatar} name={u?.name || ''} />
            <div>
              <p className="font-semibold">{u?.name}</p>
              <p className="text-xs text-mist">{u?.email}{u?.username ? ` · ${u.username}` : ''}</p>
              {u?.mustChangePassword && <p className="text-[11px] font-semibold text-amber-500">Password change required</p>}
            </div>
          </Link>
        )
      },
    },
    { key: 'title', header: 'Title', sortValue: (s) => s.title, render: (s) => s.title },
    { key: 'dept', header: 'Dept', sortValue: (s) => s.department, render: (s) => s.department },
    { key: 'branch', header: 'Branch', sortValue: (s) => branches.find((branch) => branch.id === (s.branchId || users.find((u) => u.id === s.userId)?.branchId))?.name || '', render: (s) => branches.find((branch) => branch.id === (s.branchId || users.find((u) => u.id === s.userId)?.branchId))?.name || '—' },
    { key: 'frontend', header: 'Frontend', sortValue: (s) => (s.showOnWebsite ? 1 : 0), render: (s) => <Badge tone={s.showOnWebsite ? 'lime' : 'zinc'}>{s.showOnWebsite ? 'On site' : 'Hidden'}</Badge> },
    { key: 'salary', header: 'Salary', sortValue: (s) => s.salary, render: (s) => formatGhs(s.salary) },
    { key: 'leave', header: 'Leave', sortValue: (s) => s.leaveBalance, render: (s) => `${s.leaveBalance} days` },
    { key: 'hired', header: 'Hired', sortValue: (s) => s.hireDate, render: (s) => <span className="text-mist">{formatDate(s.hireDate)}</span> },
    { key: 'role', header: 'Role', sortValue: (s) => users.find((x) => x.id === s.userId)?.role || '', render: (s) => <Badge>{users.find((x) => x.id === s.userId)?.role.replace('_', ' ')}</Badge> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (s) => (
        <span className="whitespace-nowrap">
          {canEdit && (
            <Link to={`/admin/staff/${s.id}#credentials`} className="inline-flex rounded-lg p-2 text-mist hover:text-lime" aria-label="Login credentials">
              <KeyRound className="size-4" />
            </Link>
          )}
          {canEdit && (
            <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(s)} aria-label="Edit staff">
              <Pencil className="size-4" />
            </button>
          )}
        </span>
      ),
    },
  ]

  const leaveColumns: Column<LeaveRequest>[] = [
    { key: 'staff', header: 'Staff', sortValue: (l) => users.find((x) => x.id === l.staffUserId)?.name || '', render: (l) => users.find((x) => x.id === l.staffUserId)?.name },
    { key: 'type', header: 'Type', sortValue: (l) => l.type, render: (l) => l.type },
    { key: 'from', header: 'From', sortValue: (l) => l.from, render: (l) => l.from },
    { key: 'to', header: 'To', sortValue: (l) => l.to, render: (l) => l.to },
    { key: 'status', header: 'Status', sortValue: (l) => l.status, render: (l) => <StatusBadge status={l.status} /> },
    {
      key: 'actions', header: 'ACTIONS',
      render: (l) => (
        <span className="space-x-2">
          {l.status === 'pending' && canEdit && (
            <>
              <Button size="sm" onClick={() => { upsertLeave({ ...l, status: 'approved' }); toast.success('Approved') }}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => upsertLeave({ ...l, status: 'rejected' })}>Reject</Button>
            </>
          )}
        </span>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Staff & payroll"
        desc="Roles, leave, payroll, and staff login credentials."
        actions={canEdit ? <Button onClick={openCreate}>Add record</Button> : undefined}
      />
      <div className="card">
        <DataTable
          columns={staffColumns}
          data={staff}
          rowKey={(s) => s.id}
          emptyTitle="No staff"
          emptyDesc="Add your first staff record with the Add record button."
        />
      </div>

      <h2 className="font-display mt-8 text-xl">Leave management</h2>
      <div className="mt-3 card">
        <DataTable
          columns={leaveColumns}
          data={leaves}
          rowKey={(l) => l.id}
          emptyTitle="No leave requests"
          emptyDesc="Leave requests appear here when staff submit them."
        />
      </div>

      <h2 className="font-display mt-8 text-xl">Trainer performance</h2>
      <p className="mt-1 text-sm text-mist">Every trainer is also an employee in the list above. Toggle “Floor staff” to show or hide them on the public site.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {trainers.map((t) => {
          const u = users.find((x) => x.id === t.userId)
          const rec = staff.find((s) => s.userId === t.userId)
          return (
            <div key={t.id} className="card p-4">
              <div className="flex items-center gap-3">
                <Avatar src={t.photo} name={u?.name || ''} />
                <div>
                  <p className="font-semibold">{u?.name}</p>
                  <p className="text-xs text-mist">{t.rating}★ · {t.clientsCount} clients</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-mist">{t.specialties.join(' · ')}</p>
              <p className="mt-1 text-sm">{formatGhs(t.hourlyRate)} / hr</p>
              <p className="mt-2 text-xs text-mist">
                {rec ? `${rec.title} · ${rec.department}` : <span className="text-amber-500">No employee record — add via the list above.</span>}
              </p>
              <label className="mt-3 flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5">
                <span className="text-xs font-semibold">Floor staff</span>
                <Switch
                  checked={t.showOnWebsite !== false}
                  onChange={(v) => {
                    app.upsertTrainer({ ...t, showOnWebsite: v })
                    if (rec) app.upsertStaff({ ...rec, showOnWebsite: v })
                    toast.success(v ? 'Shown on website' : 'Hidden from website')
                  }}
                  aria-label="Show on website"
                />
              </label>
            </div>
          )
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit staff' : 'Add staff'} wide>
        <ProfilePictureInput value={form.photo} onChange={(photo) => setForm({ ...form, photo: photo || '' })} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={credentialSettings.initialPasswordMode === 'phone' && !editingId ? 'Phone (used as first password)' : 'Phone'}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Home club">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branchOptions.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
          <Field label="Salary GHS"><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></Field>
          <Field label="Leave days"><Input type="number" value={form.leaveBalance} onChange={(e) => setForm({ ...form, leaveBalance: e.target.value })} /></Field>
          <Field label="Hire date"><DatePicker value={form.hireDate} onChange={(v) => setForm({ ...form, hireDate: v })} max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="staff">staff</option>
              <option value="trainer">trainer</option>
              <option value="gym_manager">gym manager</option>
            </Select>
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 sm:col-span-2">
            <div>
              <p className="text-sm font-semibold">Show on website</p>
              <p className="text-xs text-mist">Display this person on the public site as part of the floor staff.</p>
            </div>
            <Switch checked={form.showOnWebsite} onChange={(v) => setForm({ ...form, showOnWebsite: v })} aria-label="Show on website" />
          </div>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create staff'}</Button>
      </Modal>
    </div>
  )
}
