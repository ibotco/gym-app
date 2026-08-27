import { useState } from 'react'
import { PageHeader, Button, Field, Input, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { NotifySettings } from '../../components/NotifySettings'
import { hashPassword, passwordPolicyError } from '../../lib/password'
import { clearReveal } from '../../lib/credentials'

export function MemberProfile() {
  const { user } = useAuth()
  const { members, upsertMember, patchUser, credentialSettings } = useApp()
  const toast = useToast()
  const m = members.find((x) => x.userId === user?.id)
  const [name, setName] = useState(user?.name || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [address, setAddress] = useState(m?.address || '')
  const [emName, setEmName] = useState(m?.emergency.name || '')
  const [emPhone, setEmPhone] = useState(m?.emergency.phone || '')
  const [emRel, setEmRel] = useState(m?.emergency.relation || '')
  const [med, setMed] = useState(m?.medicalNotes || '')
  const [goals, setGoals] = useState(m?.goals.join(', ') || '')
  const [height, setHeight] = useState(String(m?.heightCm || 170))
  const [weight, setWeight] = useState(String(m?.weightKg || 70))
  const [newPw, setNewPw] = useState('')

  if (!m || !user) return null

  return (
    <div>
      <PageHeader title="Profile" desc="Personal, emergency, health, goals. GDPR: you can export or request deletion." />
      <div className="grid max-w-3xl gap-4">
        <div className="card grid gap-3 p-5 sm:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Email"><Input value={user.email} disabled /></Field>
          <Field label="Username"><Input value={user.username || user.email.split('@')[0]} disabled /></Field>
          <Field label="New password (optional)"><Input type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Leave blank to keep" /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field label="Height cm"><Input value={height} onChange={(e) => setHeight(e.target.value)} /></Field>
          <Field label="Weight kg"><Input value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        </div>
        <div className="card grid gap-3 p-5 sm:grid-cols-3">
          <Field label="Emergency name"><Input value={emName} onChange={(e) => setEmName(e.target.value)} /></Field>
          <Field label="Emergency phone"><Input value={emPhone} onChange={(e) => setEmPhone(e.target.value)} /></Field>
          <Field label="Relation"><Input value={emRel} onChange={(e) => setEmRel(e.target.value)} /></Field>
        </div>
        <div className="card space-y-3 p-5">
          <Field label="Health information"><Textarea value={med} onChange={(e) => setMed(e.target.value)} /></Field>
          <Field label="Goals"><Input value={goals} onChange={(e) => setGoals(e.target.value)} /></Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => {
            if (newPw.trim()) {
              const pe = passwordPolicyError(newPw, credentialSettings.policy)
              if (pe) { toast.error(pe); return }
              const hashed = await hashPassword(newPw.trim())
              patchUser(user.id, { name, phone, password: hashed, mustChangePassword: false, passwordChangedAt: new Date().toISOString() })
              clearReveal(user.id)
              setNewPw('')
            } else {
              patchUser(user.id, { name, phone })
            }
            upsertMember({
              ...m,
              address,
              heightCm: Number(height),
              weightKg: Number(weight),
              medicalNotes: med,
              goals: goals.split(',').map((g) => g.trim()).filter(Boolean),
              emergency: { name: emName, phone: emPhone, relation: emRel },
            })
            toast.update('Profile updated', 'Your details were saved.')
          }}>Save</Button>
          <Button variant="outline" onClick={() => {
            const blob = JSON.stringify({ user, member: m }, null, 2)
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([blob], { type: 'application/json' }))
            a.download = 'fitpro-gdpr-export.json'
            a.click()
            toast.success('Export downloaded')
          }}>GDPR export</Button>
          <Button variant="ghost" onClick={() => toast.warning('Deletion request filed', 'The data officer will confirm by email.')}>Request deletion</Button>
        </div>
        <NotifySettings />
      </div>
    </div>
  )
}
