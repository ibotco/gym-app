import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Field, Input, Logo, Divider } from '../../components/ui'
import { useAuth, roleHome } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { DEMO_ACCOUNTS } from '../../data/seed'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useApp } from '../../context/AppContext'
import { emailError } from '../../lib/validate'

export function Login() {
  const [email, setEmail] = useState('member@fitpro.gym')
  const [password, setPassword] = useState('demo123')
  const [err, setErr] = useState('')
  const { login, loginOAuth } = useAuth()
  const { company } = useApp()
  const toast = useToast()
  const { t } = useI18n()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next')
  const validationOn = !!company.emailLoginValidation
  const loginEmailHint = validationOn && email.includes('@') ? emailError(email) : ''

  return (
    <div className="relative grid min-h-screen md:grid-cols-2">
      <div className="relative hidden overflow-hidden md:block">
        <img src="/images/gym-weights.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/"><Logo /></Link>
          <div>
            <p className="font-display text-4xl font-semibold leading-tight">{t('auth.door')}</p>
            <p className="mt-3 max-w-sm text-zinc-300">{t('auth.oneAccount')}</p>
          </div>
        </div>
      </div>
      <div className="mesh grid place-items-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 md:hidden"><Link to="/"><Logo /></Link></div>
          <div className="mb-4 flex justify-end"><LanguageSwitcher compact /></div>
          <h1 className="font-display text-3xl font-semibold">{t('auth.welcome')}</h1>
          <p className="mt-1 text-sm text-mist">{t('auth.demoPw', { pw: 'demo123' })}</p>

          <form
            className="mt-8 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const r = await login(email, password)
              if (r.needsVerification) {
                nav(`/verify-email?email=${encodeURIComponent(r.email || email)}`)
                return
              }
              if (!r.ok || !r.user) { setErr(r.error || t('auth.failed')); return }
              toast.success(t('auth.signedIn'))
              if (r.mustChangePassword) {
                nav('/change-password')
                return
              }
              nav(next || roleHome(r.user.role))
            }}
          >
            <div>
              <Field label="Email or username">
                <Input type="text" value={email} onChange={(e) => { setEmail(e.target.value); setErr('') }} autoComplete="username" aria-invalid={!!loginEmailHint} />
              </Field>
              {loginEmailHint && <p className="mt-1 text-xs text-ember">{loginEmailHint}</p>}
            </div>
            <Field label={t('auth.password')}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
            <p className="text-right text-sm">
              <Link to="/forgot-password" className="font-semibold text-lime">Forgot password?</Link>
            </p>
            {err && <p className="text-sm text-ember">{err}</p>}
            <Button type="submit" className="w-full" size="lg">{t('auth.signIn')}</Button>
          </form>

          <Divider label={t('or')} />
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { loginOAuth('google'); toast.success('Google session'); nav('/app') }}>Google</Button>
            <Button variant="outline" onClick={() => { loginOAuth('apple'); toast.success('Apple session'); nav('/app') }}>Apple</Button>
          </div>

          <div className="mt-8 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-mist">Demo seats</p>
            {DEMO_ACCOUNTS.map((d) => (
              <button
                key={d.email}
                onClick={() => { setEmail(d.email); setPassword(d.password) }}
                className="flex w-full items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-left text-sm hover:bg-white/5"
              >
                <span>
                  <span className="font-semibold">{d.role}</span>
                  <span className="ml-2 text-mist">{d.email}</span>
                </span>
                <span className="text-[11px] text-lime">{d.hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-mist">
            {t('auth.newHere')} <Link to="/register" className="font-semibold text-lime">{t('auth.createMembership')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
