import { useState } from 'react'
import { PageHeader, Button, Field, Input, Select } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { NotifySettings } from '../../components/NotifySettings'
import { isPhone } from '../../lib/validate'
import { hashPassword, passwordPolicyError } from '../../lib/password'
import { clearReveal } from '../../lib/credentials'

export function AccountProfile() {
  const { user } = useAuth()
  const { branches, patchUser, staff, upsertStaff, credentialSettings } = useApp()
  const toast = useToast()
  const rec = staff.find((s) => s.userId === user?.id)
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [branchId, setBranchId] = useState(user?.branchId || '')
  const [password, setPassword] = useState('')
  const [title, setTitle] = useState(rec?.title || '')
  const [err, setErr] = useState('')

  if (!user) return null

  const save = async () => {
    if (name.trim().length < 2) { setErr('Name must be at least 2 characters.'); return }
    if (!isPhone(phone)) { setErr('Enter a valid phone number.'); return }
    if (password.trim()) {
      const pe = passwordPolicyError(password, credentialSettings.policy)
      if (pe) { setErr(pe); return }
    }
    const hashed = password.trim() ? await hashPassword(password.trim()) : ''
    patchUser(user.id, {
      name: name.trim(),
      phone: phone.trim(),
      branchId: branchId || undefined,
      ...(hashed ? { password: hashed, mustChangePassword: false, passwordChangedAt: new Date().toISOString() } : {}),
    })
    if (hashed) clearReveal(user.id)
    if (rec && title.trim()) upsertStaff({ ...rec, title: title.trim() })
    setPassword('')
    setErr('')
    toast.update('Profile updated', 'Your details were saved.')
  }

  return (
    <div>
      <PageHeader title="My profile" desc="Update your name, phone, club, and password." />
      <div className="card grid max-w-2xl gap-3 p-5 sm:grid-cols-2">
        <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Email"><Input value={user.email} disabled /></Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Home club">
          <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">None</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
        </Field>
        {rec && <Field label="Job title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>}
        <Field label="New password (optional)"><Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep" /></Field>
        <div className="sm:col-span-2">
          {err && <p className="mb-3 text-sm text-ember">{err}</p>}
          <Button onClick={save}>Save profile</Button>
        </div>
      </div>
      <div className="mt-6">
        <NotifySettings />
      </div>
    </div>
  )
}
