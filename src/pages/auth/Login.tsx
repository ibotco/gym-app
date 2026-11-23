import { resolveWebsiteType, websiteTypeInfo } from '../../lib/websiteType'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth, roleHome } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { DEMO_ACCOUNTS } from '../../data/seed'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../../components/LanguageSwitcher'
import { useApp } from '../../context/AppContext'
import { emailError } from '../../lib/validate'

export function Login() {
  const { company } = useApp()
  const siteType = resolveWebsiteType(company.websiteType)
  const site = websiteTypeInfo(siteType)
  const gym = siteType === 'gym'
  const [email, setEmail] = useState(gym ? 'member@fitpro.gym' : '')
  const [password, setPassword] = useState(gym ? 'demo123' : '')
  const [err, setErr] = useState('')
  const { login } = useAuth()
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
        {gym ? <img src="/images/gym-weights.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-zinc-900 to-sky-950" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/"><Logo text={gym ? undefined : company.logoText||company.name} logoImage={gym ? undefined : company.logoImage}/></Link>
          <div>
            <p className="font-display text-4xl font-semibold leading-tight">{gym ? t('auth.door') : site.headline}</p>
            <p className="mt-3 max-w-sm text-zinc-300">{gym ? t('auth.oneAccount') : site.subheading}</p>
          </div>
        </div>
      </div>
      <div className="mesh grid place-items-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 md:hidden"><Link to="/"><Logo text={gym ? undefined : company.logoText||company.name} logoImage={gym ? undefined : company.logoImage}/></Link></div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-mist transition hover:border-lime hover:text-zinc-900 dark:hover:text-white"
            >
              <ArrowLeft className="size-4" /> Back to website
            </Link>
            <LanguageSwitcher compact />
          </div>
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

          <div className="mt-8 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-mist">Demo seats</p>
            {DEMO_ACCOUNTS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => { setEmail(d.email); setPassword(d.password); setErr('') }}
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
          {gym && <p className="mt-6 text-sm text-mist">
            {t('auth.newHere')} <Link to="/register" className="font-semibold text-lime">{t('auth.createMembership')}</Link>
          </p>}
        </div>
      </div>
    </div>
  )
}
