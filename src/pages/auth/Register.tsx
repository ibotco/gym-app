import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Logo, Select } from '../../components/ui'
import { PLANS } from '../../data/seed'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { formatGhs } from '../../lib/utils'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { emailError } from '../../lib/validate'
import { sendVerificationEmail } from '../../lib/mail'

export function Register() {
  const [params] = useSearchParams()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'demo123',
    planId: params.get('plan') || 'pl_month',
  })
  const [emailTouched, setEmailTouched] = useState(false)
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const { register } = useAuth()
  const { users } = useApp()
  const toast = useToast()
  const { t } = useI18n()
  const nav = useNavigate()
  const plan = PLANS.find((p) => p.id === form.planId)

  const liveEmailError = useMemo(() => {
    if (!emailTouched && !form.email) return ''
    const format = emailError(form.email)
    if (format) return format
    const taken = users.some((u) => u.email.toLowerCase() === form.email.trim().toLowerCase())
    if (taken) return 'An account with that email already exists.'
    return ''
  }, [form.email, emailTouched, users])

  return (
    <div className="mesh min-h-screen px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center justify-between">
            <Link to="/"><Logo /></Link>
            <LanguageSwitcher compact />
          </div>
          <h1 className="font-display mt-8 text-3xl font-semibold md:text-4xl">{t('auth.joinTitle')}</h1>
          <p className="mt-2 text-mist">{t('auth.joinSub')}</p>
          <p className="mt-2 text-sm text-lime">{t('auth.verifyHint')}</p>
          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setEmailTouched(true)
              if (liveEmailError) {
                setErr(liveEmailError)
                return
              }
              const r = await register(form)
              if (!r.ok) {
                setErr(r.error || t('auth.failed'))
                return
              }
              if (r.needsVerification) {
                setSending(true)
                const mail = r.code && r.email
                  ? await sendVerificationEmail({ to: r.email, name: form.name, code: r.code })
                  : { ok: false, live: false, error: 'Could not create a code.' }
                setSending(false)
                sessionStorage.setItem('fitpro_pending_verify', JSON.stringify({
                  email: r.email,
                  code: mail.ok ? undefined : r.code,
                  live: mail.ok,
                }))
                if (mail.ok) toast.success('Code sent', `Check ${r.email}`)
                else toast.error('Email was not sent', mail.error)
                nav(`/verify-email?email=${encodeURIComponent(r.email || form.email)}`)
                return
              }
              toast.success(t('auth.welcomeClub'), plan?.name)
              nav('/app')
            }}
          >
            <Field label={t('auth.fullName')}><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Field label={t('auth.email')}>
                  <Input
                    required
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    aria-invalid={!!liveEmailError}
                    onChange={(e) => {
                      setEmailTouched(true)
                      setErr('')
                      setForm({ ...form, email: e.target.value })
                    }}
                    onBlur={() => setEmailTouched(true)}
                  />
                </Field>
                {liveEmailError && <p className="mt-1 text-xs text-ember">{liveEmailError}</p>}
                {!liveEmailError && form.email && <p className="mt-1 text-xs text-lime">Email looks valid.</p>}
              </div>
              <Field label={t('auth.phone')}><Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            </div>
            <Field label={t('auth.password')}><Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label={t('auth.plan')}>
              <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                {PLANS.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatGhs(p.price)}</option>)}
              </Select>
            </Field>
            {err && <p className="text-sm text-ember">{err}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={!!liveEmailError || sending}>{sending ? 'Sending code…' : t('auth.createBtn')}</Button>
            <p className="text-xs text-mist">{t('auth.accept')}</p>
          </form>
          <p className="mt-4 text-sm text-mist">{t('auth.already')} <Link to="/login" className="text-lime">{t('signIn')}</Link></p>
        </div>
        <aside className="card h-fit p-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-lime">{t('auth.selecting')}</p>
          <h2 className="font-display mt-2 text-2xl">{plan?.name}</h2>
          <p className="stat-num mt-2 text-4xl">{plan ? formatGhs(plan.price) : ''}</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {plan?.features.map((f) => <li key={f}>· {f}</li>)}
          </ul>
          <img src="/images/gym-floor.jpg" alt="" className="mt-6 h-40 w-full rounded-xl object-cover" />
        </aside>
      </div>
    </div>
  )
}
