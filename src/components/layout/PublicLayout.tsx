import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, Moon, Sun, MessageCircle, ChevronRight } from 'lucide-react'
import { Logo, Button } from '../ui'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { useTheme } from '../../context/ThemeContext'
import { useI18n } from '../../context/I18nContext'
import { useAuth } from '../../context/AuthContext'
import { roleHome } from '../../context/AuthContext'
import { COMPANY } from '../../data/seed'

const links = [
  { to: '/about', key: 'nav.about' as const },
  { to: '/services', key: 'nav.services' as const },
  { to: '/membership', key: 'nav.membership' as const },
  { to: '/trainers', key: 'nav.trainers' as const },
  { to: '/schedule', key: 'nav.schedule' as const },
  { to: '/blog', key: 'nav.blog' as const },
  { to: '/contact', key: 'nav.contact' as const },
]

export function PublicLayout() {
  const [open, setOpen] = useState(false)
  const { theme, toggle } = useTheme()
  const { t } = useI18n()
  const { user } = useAuth()
  const nav = useNavigate()

  return (
    <div className="min-h-screen bg-paper text-zinc-900 dark:bg-ink dark:text-zinc-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-lime focus:px-3 focus:py-2 focus:text-lime-ink">
        {t('skip')}
      </a>
      <div className="pointer-events-none fixed inset-0 mesh opacity-80" />
      <header className="sticky top-0 z-50 border-b border-black/5 bg-paper/80 backdrop-blur-xl dark:border-white/5 dark:bg-ink/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to="/" className="relative z-10" aria-label="FitPro home">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-[13px] font-semibold transition ${isActive ? 'text-lime-dim dark:text-lime' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'}`
                }
              >
                {t(l.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:block"><LanguageSwitcher compact /></div>
            <button onClick={toggle} className="grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" aria-label={t('theme')}>
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            {user ? (
              <Button size="sm" onClick={() => nav(roleHome(user.role))}>
                {t('dashboard')}
              </Button>
            ) : (
              <>
                <Link to="/login" className="hidden text-sm font-semibold text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white sm:inline">
                  {t('signIn')}
                </Link>
                <Link to="/register">
                  <Button size="sm">{t('join')}</Button>
                </Link>
              </>
            )}
            <button className="grid size-9 place-items-center rounded-lg lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-black/5 bg-paper px-4 py-4 dark:border-white/5 dark:bg-ink lg:hidden">
            <div className="mb-3"><LanguageSwitcher /></div>
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-white/5">
                  {t(l.key)}
                </NavLink>
              ))}
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold">
                {t('signIn')}
              </Link>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="relative">
        <Outlet />
      </main>

      <footer className="relative mt-20 border-t border-white/5 bg-ink-2 text-zinc-100">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4 md:px-6">
          <div className="md:col-span-1">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed text-mist">{t('footer.blurb')}</p>
            <p className="mt-4 text-xs text-mist">{COMPANY.legalName} · TIN {COMPANY.taxId}</p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">{t('footer.club')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/about" className="hover:text-lime">{t('nav.about')}</Link></li>
              <li><Link to="/trainers" className="hover:text-lime">{t('footer.coaches')}</Link></li>
              <li><Link to="/schedule" className="hover:text-lime">{t('footer.timetable')}</Link></li>
              <li><Link to="/blog" className="hover:text-lime">{t('footer.journal')}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">{t('footer.membership')}</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link to="/membership" className="hover:text-lime">{t('footer.plans')}</Link></li>
              <li><Link to="/services" className="hover:text-lime">{t('nav.services')}</Link></li>
              <li><Link to="/register" className="hover:text-lime">{t('footer.joinOnline')}</Link></li>
              <li><Link to="/contact" className="hover:text-lime">{t('footer.corporate')}</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-mist">{t('footer.visit')}</p>
            <p className="mt-3 text-sm text-zinc-300">{COMPANY.address}</p>
            <p className="mt-1 text-sm text-mist">{COMPANY.phone}</p>
            <p className="text-sm text-mist">{COMPANY.email}</p>
            <Link to="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-lime">
              {t('footer.directions')} <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/5 px-4 py-5 text-center text-xs text-mist">
          © {new Date().getFullYear()} FitPro. {t('footer.legal')}
        </div>
      </footer>

      <a
        href={`https://wa.me/${COMPANY.whatsapp}?text=${encodeURIComponent('Hi FitPro — I’d like to book a consultation.')}`}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-lg pulse-ring"
        aria-label={t('whatsapp')}
      >
        <MessageCircle className="size-4" />
        <span className="hidden sm:inline">{t('whatsapp')}</span>
      </a>
    </div>
  )
}
