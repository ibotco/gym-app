import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { sendVerificationEmail } from '../../lib/mail'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const { requestPasswordReset } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  return (
    <div className="mesh grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <LanguageSwitcher compact />
        </div>
        <h1 className="font-display text-3xl font-semibold">Forgot password</h1>
        <p className="mt-2 text-sm text-mist">Enter the email on your FitPro account. We’ll send a 6-digit reset code.</p>
        <form
          className="mt-8 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setSending(true)
            const r = requestPasswordReset(email)
            if (!r.ok || !r.code || !r.email) {
              setSending(false)
              setErr(r.error || 'Could not start a reset.')
              return
            }
            const mail = await sendVerificationEmail({ to: r.email, name: 'FitPro member', code: r.code })
            setSending(false)
            sessionStorage.setItem('fitpro_pending_reset', JSON.stringify({
              email: r.email,
              code: mail.ok ? undefined : r.code,
              live: mail.ok,
            }))
            if (mail.ok) toast.success('Reset code sent', `Check ${r.email}`)
            else toast.warning('Email was not sent', mail.error || 'Use the code shown on the next screen.')
            nav(`/reset-password?email=${encodeURIComponent(r.email)}`)
          }}
        >
          <Field label="Email">
            <Input type="email" required autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} />
          </Field>
          {err && <p className="text-sm text-ember">{err}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={sending}>{sending ? 'Sending…' : 'Send reset code'}</Button>
        </form>
        <p className="mt-6 text-sm text-mist">
          Remembered it? <Link to="/login" className="font-semibold text-lime">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
