import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Pencil, KeyRound } from 'lucide-react'
import { PageHeader, Button, Input, Select, SearchInput, StatusBadge, Avatar, Modal, Field, DatePicker } from '../../components/ui'
import { DataTable, type Column } from '../../components/DataTable'
import { ExportButtons } from '../../components/ExportButtons'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { generateUsername, hashPassword, takenUsernames } from '../../lib/password'
import { issueInitialPassword, saveReveal } from '../../lib/credentials'
import { ProfilePictureInput } from '../../components/ProfilePictureInput'
import { CustomFields } from '../../components/CustomFields'
import type { Member, Membership, MembershipStatus, Plan, Status, User, CustomFieldValues } from '../../types'

type MemberForm = {
  name: string
  email: string
  phone: string
  planId: string
  branchId: string
  status: Status
  gender: 'female' | 'male' | 'other'
  dob: string
  address: string
  tags: string
  goals: string
  medicalNotes: string
  emName: string
  emPhone: string
  emRel: string
  heightCm: string
  weightKg: string
  trainerId: string
  photo: string
  customFields: CustomFieldValues
}

const emptyForm = (planId = 'pl_month', branchId = 'br_airport'): MemberForm => ({
  name: '', email: '', phone: '', planId, branchId, status: 'active',
  gender: 'female', dob: '', address: '', tags: '', goals: '', medicalNotes: '',
  emName: '', emPhone: '', emRel: '', heightCm: '170', weightKg: '70', trainerId: '', photo: '',
  customFields: {},
})

export function Members() {
  const app = useApp()
  const { members, users, plans, memberships, branches, trainers, createMemberAccount, upsertMember, upsertMembership, patchUser, deleteMember, log, credentialSettings } = app
  const { hasPermission, user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const canEdit = hasPermission('members.manage')
  const canDelete = hasPermission('members.delete')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [plan, setPlan] = useState('all')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MemberForm>(emptyForm())
  const [err, setErr] = useState('')

  const rows = useMemo(() => {
    return members
      .map((m) => {
        const u = users.find((x) => x.id === m.userId)
        const ms = memberships.find((x) => x.id === m.membershipId)
        const pl = plans.find((x) => x.id === (ms?.planId || m.planId))
        return { m, u, ms, pl }
      })
      .filter((r) => {
        const blob = `${r.u?.name} ${r.u?.email} ${r.m.tags.join(' ')}`.toLowerCase()
        if (q && !blob.includes(q.toLowerCase())) return false
        if (status !== 'all' && r.u?.status !== status && r.ms?.status !== status) return false
        if (plan !== 'all' && r.pl?.id !== plan) return false
        return true
      })
  }, [members, users, memberships, plans, q, status, plan])

  type Row = { m: Member; u?: User; ms?: Membership; pl?: Plan }

  const columns: Column<Row>[] = [
    {
      key: 'name', header: 'Member', sortValue: (r) => r.u?.name || '',
      render: ({ m, u }) => (
        <Link to={`/admin/members/${m.id}`} className="flex items-center gap-3">
          <Avatar src={u?.avatar} name={u?.name || ''} />
          <div>
            <p className="font-semibold">{u?.name}</p>
            <p className="text-xs text-mist">{u?.email}{u?.username ? ` · ${u.username}` : ''}</p>
            {u?.mustChangePassword && <p className="text-[11px] font-semibold text-amber-500">Password change required</p>}
          </div>
        </Link>
      ),
    },
    { key: 'plan', header: 'Plan', sortValue: (r) => r.pl?.name || '', render: (r) => r.pl?.name },
    {
      key: 'status', header: 'Status', sortValue: (r) => r.ms?.status || r.u?.status || '',
      render: (r) => <StatusBadge status={r.ms?.status || r.u?.status || 'active'} />,
    },
    {
      key: 'tags', header: 'Tags', sortValue: (r) => r.m.tags.join(','),
      render: ({ m }) => (
        <div className="flex max-w-[180px] flex-wrap gap-1">{m.tags.map((t) => <span key={t} className="chip bg-white/5 text-[10px]">{t}</span>)}</div>
      ),
    },
    { key: 'joined', header: 'Joined', sortValue: (r) => r.m.joinDate, render: ({ m }) => <span className="text-mist">{formatDate(m.joinDate)}</span> },
    { key: 'renews', header: 'Renews', sortValue: (r) => r.ms?.endDate || '', render: (r) => <span className="text-mist">{r.ms ? formatDate(r.ms.endDate) : '—'}</span> },
    {
      key: 'actions', header: 'ACTIONS',
      render: ({ m }) => (
        <span className="whitespace-nowrap">
          {canEdit && (
            <Link to={`/admin/members/${m.id}#credentials`} className="inline-flex rounded-lg p-2 text-mist hover:text-lime" aria-label="Login credentials">
              <KeyRound className="size-4" />
            </Link>
          )}
          {canEdit && (
            <button className="rounded-lg p-2 text-mist hover:text-lime" onClick={() => openEdit(m)} aria-label="Edit member">
              <Pencil className="size-4" />
            </button>
          )}
          {canDelete && (
            <button className="rounded-lg p-2 text-mist hover:text-ember" onClick={() => { deleteMember(m.id); toast.info('Member archived') }} aria-label="Delete">
              <Trash2 className="size-4" />
            </button>
          )}
        </span>
      ),
    },
  ]

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm(plans[0]?.id, branches[0]?.id))
    setErr('')
    setOpen(true)
  }

  const openEdit = (m: Member) => {
    const u = users.find((x) => x.id === m.userId)
    const ms = memberships.find((x) => x.id === m.membershipId)
    setEditingId(m.id)
    setForm({
      name: u?.name || '',
      email: u?.email || '',
      phone: u?.phone || '',
      planId: ms?.planId || m.planId,
      branchId: u?.branchId || ms?.branchId || branches[0]?.id || '',
      status: u?.status || 'active',
      gender: m.gender,
      dob: m.dob,
      address: m.address,
      tags: m.tags.join(', '),
      goals: m.goals.join(', '),
      medicalNotes: m.medicalNotes,
      emName: m.emergency.name,
      emPhone: m.emergency.phone,
      emRel: m.emergency.relation,
      heightCm: String(m.heightCm),
      weightKg: String(m.weightKg),
      trainerId: m.trainerId || '',
      photo: u?.avatar || '',
      customFields: m.customFields || {},
    })
    setErr('')
    setOpen(true)
  }

  const validate = () => {
    if (form.name.trim().length < 2) return 'Name must be at least 2 characters.'
    if (!isEmail(form.email)) return 'Enter a valid email address.'
    if (!isPhone(form.phone)) return 'Enter a valid phone number.'
    if (!form.planId) return 'Select a membership plan.'
    if (!form.branchId) return 'Select a home club.'
    const height = Number(form.heightCm)
    const weight = Number(form.weightKg)
    if (!height || height < 80 || height > 250) return 'Height must be between 80 and 250 cm.'
    if (!weight || weight < 25 || weight > 300) return 'Weight must be between 25 and 300 kg.'
    const emailTaken = users.some((u) => {
      if (u.email.toLowerCase() !== form.email.trim().toLowerCase()) return false
      if (!editingId) return true
      const current = members.find((m) => m.id === editingId)
      return current?.userId !== u.id
    })
    if (emailTaken) return 'That email is already in use.'
    return ''
  }

  const save = async () => {
    if (!canEdit) { toast.error('You are not authorised to edit members.'); return }
    const v = validate()
    if (v) { setErr(v); return }
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const goals = form.goals.split(',').map((t) => t.trim()).filter(Boolean)
    const heightCm = Number(form.heightCm)
    const weightKg = Number(form.weightKg)

    if (!editingId) {
      const username = generateUsername(form.name.trim(), takenUsernames(users))
      const issued = issueInitialPassword(credentialSettings.initialPasswordMode || 'auto', form.phone.trim(), credentialSettings.policy)
      if (!issued.ok) { setErr(issued.error); return }
      const temp = issued.password
      const hashed = await hashPassword(temp)
      const created = createMemberAccount({
        name: form.name.trim(),
        email: form.email.trim(),
        password: hashed,
        phone: form.phone.trim(),
        planId: form.planId,
        branchId: form.branchId,
        gender: form.gender,
        dob: form.dob || '1995-01-01',
        address: form.address.trim() || 'Accra',
        tags: tags.length ? tags : ['New'],
        goals,
        medicalNotes: form.medicalNotes,
        emergency: { name: form.emName.trim(), phone: form.emPhone.trim(), relation: form.emRel.trim() },
        heightCm,
        weightKg,
        trainerId: form.trainerId || undefined,
        status: form.status,
        username,
        mustChangePassword: true,
        avatar: form.photo || undefined,
        customFields: form.customFields,
      })
      saveReveal(created.userId, username, temp)
      log(user?.id || 'admin', 'CREATE', 'Member', `Created ${form.name.trim()} · temp login issued`)
      toast.success(
        'Member created',
        issued.mode === 'phone'
          ? 'Initial password is their phone number. Send it from the credentials panel.'
          : 'Send the temporary login from the credentials panel.',
      )
      setOpen(false)
      nav(`/admin/members/${created.memberId}#credentials`)
      return
    } else {
      const m = members.find((x) => x.id === editingId)
      if (!m) { setErr('Member not found.'); return }
      patchUser(m.userId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        branchId: form.branchId,
        status: form.status,
        ...(form.photo ? { avatar: form.photo } : {}),
      })
      upsertMember({
        ...m,
        planId: form.planId,
        emergency: { name: form.emName.trim(), phone: form.emPhone.trim(), relation: form.emRel.trim() },
        medicalNotes: form.medicalNotes,
        tags,
        goals,
        heightCm,
        weightKg,
        dob: form.dob || m.dob,
        gender: form.gender,
        address: form.address.trim(),
        trainerId: form.trainerId || undefined,
        customFields: form.customFields,
      })
      const ms = memberships.find((x) => x.id === m.membershipId)
      if (ms) {
        const nextStatus: MembershipStatus = form.status === 'suspended' ? 'frozen' : ms.status
        upsertMembership({ ...ms, planId: form.planId, branchId: form.branchId, status: nextStatus })
      }
      log(user?.id || 'admin', 'UPDATE', 'Member', `Edited ${form.name.trim()}`)
      toast.success('Member updated')
    }
    setOpen(false)
  }

  return (
    <div>
      <PageHeader
        title="Members"
        desc="Add, edit, and manage member records."
        actions={
          <>
            <ExportButtons
              filename="members"
              rows={rows.map((r) => ({
                name: r.u?.name, email: r.u?.email, plan: r.pl?.name, status: r.ms?.status, join: r.m.joinDate,
              }))}
              onDone={(label, ok) => ok ? toast.success(`${label} export started`) : toast.error('Export blocked')}
            />
            {canEdit && <Button onClick={openCreate}><Plus className="size-4" /> Add member</Button>}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email, tag…" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="all">All statuses</option>
          {['active', 'inactive', 'suspended', 'expired', 'frozen'].map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-48">
          <option value="all">All plans</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>
      <div className="card">
        <DataTable
          columns={columns}
          data={rows}
          rowKey={(r) => r.m.id}
          emptyTitle="No members found"
          emptyDesc="Adjust your search or filters, or add a new member."
        />
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Edit member' : 'Add member'} wide>
        <ProfilePictureInput value={form.photo} onChange={(photo) => setForm({ ...form, photo: photo || '' })} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={credentialSettings.initialPasswordMode === 'phone' && !editingId ? 'Phone (used as first password)' : 'Phone'}>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Status" required>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="suspended">suspended</option>
            </Select>
          </Field>
          <Field label="Plan">
            <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Home club">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as MemberForm['gender'] })}>
              <option value="female">female</option>
              <option value="male">male</option>
              <option value="other">other</option>
            </Select>
          </Field>
          <Field label="Date of birth"><DatePicker value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Assigned trainer">
            <Select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
              <option value="">Unassigned</option>
              {trainers.map((t) => {
                const tu = users.find((x) => x.id === t.userId)
                return <option key={t.id} value={t.id}>{tu?.name}</option>
              })}
            </Select>
          </Field>
          <Field label="Height cm"><Input type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} /></Field>
          <Field label="Weight kg"><Input type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></Field>
          <Field label="Emergency name"><Input value={form.emName} onChange={(e) => setForm({ ...form, emName: e.target.value })} /></Field>
          <Field label="Emergency phone"><Input value={form.emPhone} onChange={(e) => setForm({ ...form, emPhone: e.target.value })} /></Field>
          <Field label="Relation"><Input value={form.emRel} onChange={(e) => setForm({ ...form, emRel: e.target.value })} /></Field>
          <Field label="Tags"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="VIP, AM regular" /></Field>
          <div className="sm:col-span-2"><Field label="Goals"><Input value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><Field label="Medical notes"><Input value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} /></Field></div>
          <div className="sm:col-span-2"><CustomFields module="member" values={form.customFields} onChange={(v) => setForm({ ...form, customFields: v })} /></div>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={save}>{editingId ? 'Save changes' : 'Create member'}</Button>
      </Modal>
    </div>
  )
}
