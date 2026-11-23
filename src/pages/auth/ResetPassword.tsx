import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'

export function ResetPassword() {
  const [params] = useSearchParams()
  let demo = ''
  try {
    const raw = sessionStorage.getItem('fitpro_pending_reset')
    if (raw) {
      const p = JSON.parse(raw) as { email?: string; code?: string; live?: boolean }
      demo = p.live ? '' : (p.code || '')
    }
  } catch { /* ignore */ }

  const [email, setEmail] = useState(params.get('email') || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const { resetPassword } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  return (
    <div className="mesh grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <LanguageSwitcher compact />
        </div>
        <h1 className="font-display text-3xl font-semibold">Reset password</h1>
        <p className="mt-2 text-sm text-mist">Enter the 6-digit code and choose a new password.</p>
        {demo && <p className="mt-2 text-sm text-lime">Demo code: {demo}</p>}
        <form
          className="mt-8 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            if (password !== confirm) { setErr('Passwords do not match.'); return }
            const r = await resetPassword(email, code, password)
            if (!r.ok) { setErr(r.error || 'Could not reset password.'); return }
            sessionStorage.removeItem('fitpro_pending_reset')
            toast.success('Password updated', 'Sign in with your new password.')
            nav('/login')
          }}
        >
          <Field label="Email">
            <Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Reset code">
            <Input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" />
          </Field>
          <Field label="New password">
            <Input type="password" required autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr('') }} />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setErr('') }} />
          </Field>
          {err && <p className="text-sm text-ember">{err}</p>}
          <Button type="submit" className="w-full" size="lg">Save new password</Button>
        </form>
        <p className="mt-6 text-sm text-mist">
          <Link to="/forgot-password" className="text-lime">Request a new code</Link>
          {' · '}
          <Link to="/login" className="text-lime">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
