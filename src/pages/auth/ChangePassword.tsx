import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth, roleHome } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { policyChecks } from '../../lib/password'

export function ChangePassword() {
  const { user, completePasswordChange } = useAuth()
  const { credentialSettings } = useApp()
  const toast = useToast()
  const nav = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const policy = credentialSettings.policy
  const checks = policyChecks(next, policy)

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="mesh grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <LanguageSwitcher compact />
        </div>
        <h1 className="font-display text-3xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-mist">
          {user.mustChangePassword
            ? 'Your club issued a temporary password. Replace it now to keep using FitPro.'
            : 'Update the password on this account.'}
        </p>
        <p className="mt-2 text-sm text-mist">Signed in as <span className="font-semibold text-inherit">{user.username || user.email}</span></p>
        <form
          className="mt-8 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (next !== confirm) { setErr('New passwords do not match.'); return }
            setBusy(true)
            const r = await completePasswordChange(current, next)
            setBusy(false)
            if (!r.ok) { setErr(r.error || 'Could not update password.'); return }
            toast.success('Password updated', 'Your temporary password no longer works.')
            nav(roleHome(user.role), { replace: true })
          }}
        >
          <Field label="Current / temporary password">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); setErr('') }} required />
          </Field>
          <Field label="New password">
            <Input type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); setErr('') }} required />
          </Field>
          <ul className="space-y-1 text-xs">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? 'text-lime' : 'text-mist'}>{c.ok ? '✓' : '○'} {c.label}</li>
            ))}
          </ul>
          <Field label="Confirm new password">
            <Input type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr('') }} required />
          </Field>
          {err && <p className="text-sm text-ember">{err}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</Button>
        </form>
      </div>
    </div>
  )
}
