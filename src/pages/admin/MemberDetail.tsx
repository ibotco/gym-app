import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PageHeader, Button, Badge, StatusBadge, Field, Input, Textarea, Avatar, Modal, Select } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatDate, formatGhs, bmi, bmiLabel } from '../../lib/utils'
import { isEmail, isPhone } from '../../lib/validate'
import { CredentialsPanel } from '../../components/CredentialsPanel'
import { PaystackPayButton } from '../../components/PaystackCheckout'
import { methodLabel } from '../../lib/paystack'
import { KeyRound } from 'lucide-react'

export function MemberDetail() {
  const { id } = useParams()
  const app = useApp()
  const { hasRole } = useAuth()
  const toast = useToast()
  const canEdit = hasRole('super_admin', 'gym_manager', 'staff')
  const canConfirmPay = hasRole('super_admin', 'gym_manager', 'staff')
  const m = app.members.find((x) => x.id === id)
  const u = app.users.find((x) => x.id === m?.userId)
  const ms = app.memberships.find((x) => x.id === m?.membershipId)
  const plan = app.plans.find((x) => x.id === (ms?.planId || m?.planId))
  const pays = app.payments.filter((p) => p.memberId === id)
  const atts = app.attendance.filter((a) => a.memberId === id).slice(0, 8)
  const [notes, setNotes] = useState(m?.medicalNotes || '')
  const [tags, setTags] = useState(m?.tags.join(', ') || '')
  const [editOpen, setEditOpen] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', address: '', dob: '', gender: 'female' as 'female' | 'male' | 'other',
    branchId: '', planId: '', trainerId: '', emName: '', emPhone: '', emRel: '',
    heightCm: '', weightKg: '', goals: '',
  })

  useEffect(() => {
    if (window.location.hash === '#credentials') {
      document.getElementById('credentials')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [id])

  if (!m || !u) return <p>Member not found. <Link to="/admin/members" className="text-lime">Back</Link></p>

  const b = bmi(m.weightKg, m.heightCm)

  return (
    <div>
      <PageHeader
        eyebrow="Member profile"
        title={u.name}
        desc={u.email}
        actions={
          <>
            {canEdit && (
              <Button variant="outline" onClick={() => {
                document.getElementById('credentials')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}><KeyRound className="size-4" /> Credentials</Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => {
                setForm({
                  name: u.name, email: u.email, phone: u.phone, address: m.address, dob: m.dob, gender: m.gender,
                  branchId: u.branchId || '', planId: ms?.planId || m.planId, trainerId: m.trainerId || '',
                  emName: m.emergency.name, emPhone: m.emergency.phone, emRel: m.emergency.relation,
                  heightCm: String(m.heightCm), weightKg: String(m.weightKg), goals: m.goals.join(', '),
                })
                setErr('')
                setEditOpen(true)
              }}>Edit member</Button>
            )}
            <Button variant="outline" onClick={() => {
              const r = app.requestMembershipRenewal(m.id)
              if (!r.ok) { toast.error(r.error || 'Could not raise invoice'); return }
              toast.info('Unpaid renewal invoice created', 'Membership dates change only after payment is recorded.')
            }}>Renew</Button>
            <Button variant="soft" onClick={() => { app.patchUser(u.id, { status: u.status === 'suspended' ? 'active' : 'suspended' }); toast.info('Status updated') }}>
              {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="card flex items-center gap-4 p-5">
            <Avatar src={u.avatar} name={u.name} size="xl" />
            <div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={ms?.status || u.status} />
                {u.mustChangePassword && <Badge tone="amber">Password change required</Badge>}
                {m.tags.map((t) => <Badge key={t} tone="zinc">{t}</Badge>)}
              </div>
              <p className="mt-2 text-sm text-mist">{plan?.name} · QR {m.qrCode}</p>
              <p className="text-sm text-mist">Home club: {app.branches.find((b) => b.id === u.branchId)?.name}</p>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Personal</h3>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <Item k="Phone" v={u.phone} />
              <Item k="Username" v={u.username || u.email.split('@')[0]} />
              <Item k="DOB" v={formatDate(m.dob)} />
              <Item k="Gender" v={m.gender} />
              <Item k="Address" v={m.address} />
              <Item k="Joined" v={formatDate(m.joinDate)} />
              <Item k="Auto-renew" v={ms?.autoRenew ? 'On' : 'Off'} />
            </dl>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Emergency contact</h3>
            <p className="mt-2 text-sm">{m.emergency.name || '—'} · {m.emergency.relation} · {m.emergency.phone}</p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Medical notes</h3>
            <Textarea className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Field label="Tags">
              <Input className="mt-2" value={tags} onChange={(e) => setTags(e.target.value)} />
            </Field>
            {canEdit && (
              <Button className="mt-3" size="sm" onClick={() => {
                app.upsertMember({ ...m, medicalNotes: notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })
                toast.success('Profile saved')
              }}>Save notes</Button>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold">Body metrics</h3>
            <p className="stat-num mt-2 text-3xl">{b} <span className="text-base text-mist">BMI · {bmiLabel(b)}</span></p>
            <p className="mt-1 text-sm text-mist">{m.weightKg} kg · {m.heightCm} cm</p>
            <p className="mt-2 text-sm">Goals: {m.goals.join(', ') || '—'}</p>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Payment history</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {pays.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span>
                    {p.description}
                    <span className="mt-0.5 block text-[11px] text-mist">{methodLabel(p.method)}{p.reference ? ` · ${p.reference}` : ''}</span>
                  </span>
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    <span className="text-mist">{formatGhs(p.amount)}</span>
                    <StatusBadge status={p.status} />
                    {(p.status === 'pending' || p.status === 'failed') && canConfirmPay && (
                      <>
                        <PaystackPayButton
                          payment={p}
                          email={u.email}
                          name={u.name}
                          phone={u.phone}
                          returnTo={`/admin/members/${m.id}`}
                          label="Paystack"
                        />
                        <Button size="sm" onClick={() => {
                          const r = app.settlePayment(p.id)
                          if (!r.ok) { toast.error(r.error || 'Could not confirm'); return }
                          toast.success('Payment confirmed')
                        }}>Confirm</Button>
                      </>
                    )}
                  </span>
                </li>
              ))}
              {!pays.length && <li className="text-mist">No payments</li>}
            </ul>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold">Recent attendance</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {atts.map((a) => (
                <li key={a.id} className="flex justify-between text-mist">
                  <span>{a.date} {a.time}</span>
                  <span>{a.type}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="mt-4">
          <CredentialsPanel member={m} user={u} />
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit member" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Date of birth"><Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as typeof form.gender })}>
              <option value="female">female</option>
              <option value="male">male</option>
              <option value="other">other</option>
            </Select>
          </Field>
          <Field label="Home club">
            <Select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {app.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Plan">
            <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
              {app.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Trainer">
            <Select value={form.trainerId} onChange={(e) => setForm({ ...form, trainerId: e.target.value })}>
              <option value="">Unassigned</option>
              {app.trainers.map((t) => {
                const tu = app.users.find((x) => x.id === t.userId)
                return <option key={t.id} value={t.id}>{tu?.name}</option>
              })}
            </Select>
          </Field>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Height cm"><Input type="number" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} /></Field>
          <Field label="Weight kg"><Input type="number" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} /></Field>
          <Field label="Goals"><Input value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></Field>
          <Field label="Emergency name"><Input value={form.emName} onChange={(e) => setForm({ ...form, emName: e.target.value })} /></Field>
          <Field label="Emergency phone"><Input value={form.emPhone} onChange={(e) => setForm({ ...form, emPhone: e.target.value })} /></Field>
          <Field label="Relation"><Input value={form.emRel} onChange={(e) => setForm({ ...form, emRel: e.target.value })} /></Field>
        </div>
        {err && <p className="mt-3 text-sm text-ember">{err}</p>}
        <Button className="mt-4 w-full" onClick={() => {
          if (form.name.trim().length < 2) { setErr('Name must be at least 2 characters.'); return }
          if (!isEmail(form.email)) { setErr('Enter a valid email address.'); return }
          if (!isPhone(form.phone)) { setErr('Enter a valid phone number.'); return }
          const height = Number(form.heightCm)
          const weight = Number(form.weightKg)
          if (!height || height < 80 || height > 250) { setErr('Height must be between 80 and 250 cm.'); return }
          if (!weight || weight < 25 || weight > 300) { setErr('Weight must be between 25 and 300 kg.'); return }
          app.patchUser(u.id, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), branchId: form.branchId })
          app.upsertMember({
            ...m,
            planId: form.planId,
            address: form.address.trim(),
            dob: form.dob || m.dob,
            gender: form.gender,
            heightCm: height,
            weightKg: weight,
            goals: form.goals.split(',').map((g) => g.trim()).filter(Boolean),
            trainerId: form.trainerId || undefined,
            emergency: { name: form.emName.trim(), phone: form.emPhone.trim(), relation: form.emRel.trim() },
          })
          if (ms) app.upsertMembership({ ...ms, planId: form.planId, branchId: form.branchId })
          toast.success('Member updated')
          setEditOpen(false)
        }}>Save changes</Button>
      </Modal>
    </div>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-mist">{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}
