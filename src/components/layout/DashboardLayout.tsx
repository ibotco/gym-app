import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, UserCog, Building2, CreditCard, CalendarDays, Wallet,
  BarChart3, Bell, Settings, Shield, ClipboardList, Dumbbell, MessageSquare,
  Activity, QrCode, Target, LogOut, Moon, Sun, Search, Menu, X, Sparkles,
  ChevronDown, Briefcase, FileText, ScanLine, Plug,
} from 'lucide-react'
import { Avatar, Logo, Badge } from '../ui'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useApp } from '../../context/AppContext'
import { useI18n } from '../../context/I18nContext'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { cn } from '../../lib/utils'
import type { Role } from '../../types'

type Item = { to: string; key: string; icon: typeof LayoutDashboard; roles: Role[] }

const NAV: Item[] = [
  { to: '/admin', key: 'nav.overview', icon: LayoutDashboard, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/users', key: 'nav.users', icon: UserCog, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/members', key: 'nav.members', icon: Users, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/staff', key: 'nav.staff', icon: UserCog, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/branches', key: 'nav.branches', icon: Building2, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/plans', key: 'nav.plans', icon: CreditCard, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/classes', key: 'nav.classes', icon: CalendarDays, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/payments', key: 'nav.payments', icon: Wallet, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/reports', key: 'nav.reports', icon: BarChart3, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/leads', key: 'nav.leads', icon: Briefcase, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/notifications', key: 'nav.notifications', icon: Bell, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/checkin', key: 'nav.checkin', icon: ScanLine, roles: ['super_admin', 'gym_manager', 'staff'] },
  { to: '/admin/audit', key: 'nav.audit', icon: Shield, roles: ['super_admin'] },
  { to: '/admin/integrations', key: 'nav.integrations', icon: Plug, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/settings', key: 'nav.settings', icon: Settings, roles: ['super_admin', 'gym_manager'] },
  { to: '/admin/profile', key: 'nav.profile', icon: Target, roles: ['super_admin', 'gym_manager', 'staff'] },

  { to: '/coach', key: 'nav.today', icon: LayoutDashboard, roles: ['trainer'] },
  { to: '/coach/schedule', key: 'nav.schedule', icon: CalendarDays, roles: ['trainer'] },
  { to: '/coach/members', key: 'nav.assigned', icon: Users, roles: ['trainer'] },
  { to: '/coach/classes', key: 'nav.myClasses', icon: Dumbbell, roles: ['trainer'] },
  { to: '/coach/workouts', key: 'nav.workouts', icon: ClipboardList, roles: ['trainer'] },
  { to: '/coach/messages', key: 'nav.messages', icon: MessageSquare, roles: ['trainer'] },
  { to: '/coach/profile', key: 'nav.profile', icon: Target, roles: ['trainer'] },

  { to: '/app', key: 'nav.home', icon: LayoutDashboard, roles: ['member'] },
  { to: '/app/classes', key: 'nav.bookClasses', icon: CalendarDays, roles: ['member'] },
  { to: '/app/training', key: 'nav.training', icon: Dumbbell, roles: ['member'] },
  { to: '/app/progress', key: 'nav.progress', icon: Activity, roles: ['member'] },
  { to: '/app/ai', key: 'nav.ai', icon: Sparkles, roles: ['member'] },
  { to: '/app/payments', key: 'nav.payments', icon: Wallet, roles: ['member'] },
  { to: '/app/card', key: 'nav.card', icon: QrCode, roles: ['member'] },
  { to: '/app/profile', key: 'nav.profile', icon: Target, roles: ['member'] },
]

export function DashboardLayout() {
  const { user, logout, impersonate, hasRole } = useAuth()
  const { theme, toggle } = useTheme()
  const { users, notifications, markAllNotifRead } = useApp()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [showNotif, setShowNotif] = useState(false)
  const [showUser, setShowUser] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  const items = useMemo(() => NAV.filter((i) => user && i.roles.includes(user.role)), [user])
  const unread = notifications.filter((n) => n.userId === user?.id && !n.read)
  const myNotifs = notifications.filter((n) => n.userId === user?.id).slice(0, 6)

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#f4f4ef] text-zinc-900 dark:bg-[#0b0b0d] dark:text-zinc-100">
      <div className="dash-shell flex min-h-screen">
        <aside className={cn(
          'fixed inset-y-0 left-0 z-40 w-[260px] border-r border-black/5 bg-white transition-transform dark:border-white/5 dark:bg-[#0e0e11] lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}>
          <div className="flex h-16 items-center justify-between px-4">
            <Link to="/" onClick={() => setOpen(false)}><Logo /></Link>
            <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button>
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-xl border border-black/5 bg-zinc-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-mist">{t('signedIn')}</p>
              <p className="truncate text-sm font-semibold">{user.name}</p>
              <p className="text-[11px] text-lime">{t(`role.${user.role}`)}</p>
            </div>
          </div>
          <nav className="h-[calc(100vh-180px)] space-y-0.5 overflow-y-auto px-2 pb-8">
            {items.map((i) => {
              const Icon = i.icon
              const active = loc.pathname === i.to || (i.to !== '/admin' && i.to !== '/coach' && i.to !== '/app' && loc.pathname.startsWith(i.to))
              return (
                <NavLink
                  key={i.to}
                  to={i.to}
                  end={i.to === '/admin' || i.to === '/coach' || i.to === '/app'}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition',
                    active ? 'bg-lime text-lime-ink' : 'text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {t(i.key)}
                </NavLink>
              )
            })}
          </nav>
        </aside>

        {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-black/5 bg-[#f4f4ef]/80 px-3 backdrop-blur-xl dark:border-white/5 dark:bg-[#0b0b0d]/80 md:px-6">
            <button className="grid size-9 place-items-center rounded-lg hover:bg-white/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <div className="relative hidden min-w-0 flex-1 items-center md:flex">
              <Search className="pointer-events-none absolute left-3 size-4 text-mist" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="field max-w-md pl-9"
              />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <LanguageSwitcher compact />
              <button onClick={toggle} className="grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" aria-label="Theme">
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <div className="relative">
                <button onClick={() => { setShowNotif((v) => !v); setShowUser(false) }} className="relative grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" aria-label="Notifications">
                  <Bell className="size-4" />
                  {unread.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ember" />}
                </button>
                {showNotif && (
                  <div className="menu-pop absolute right-0 mt-2 w-80 rounded-2xl p-2">
                    <div className="flex items-center justify-between px-2 py-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-mist">{t('inbox')}</p>
                      <button className="text-[11px] font-semibold text-lime" onClick={() => markAllNotifRead(user.id)}>{t('markAllRead')}</button>
                    </div>
                    {myNotifs.length === 0 && <p className="p-4 text-sm text-mist">{t('caughtUp')}</p>}
                    {myNotifs.map((n) => (
                      <div key={n.id} className={cn('rounded-xl px-3 py-2', !n.read && 'bg-lime/5')}>
                        <p className="text-sm font-semibold">{n.title}</p>
                        <p className="text-xs text-mist">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowUser((v) => !v); setShowNotif(false) }} className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-white/5">
                  <Avatar src={user.avatar} name={user.name} size="sm" />
                  <ChevronDown className="hidden size-3 text-mist sm:block" />
                </button>
                {showUser && (
                  <div className="menu-pop absolute right-0 mt-2 w-64 rounded-2xl p-2">
                    <div className="px-2 py-2">
                      <p className="text-sm font-semibold">{user.name}</p>
                      <p className="text-xs text-mist">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowUser(false)
                        nav(user.role === 'member' ? '/app/profile' : user.role === 'trainer' ? '/coach/profile' : '/admin/profile')
                      }}
                      className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold"
                    >
                      {t('editProfile')}
                    </button>
                    {hasRole('super_admin') && (
                      <div className="menu-pop-divider border-t p-2">
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-mist">{t('impersonate')}</p>
                        {users.filter((u) => u.id !== user.id).slice(0, 6).map((u) => (
                          <button
                            key={u.id}
                            onClick={() => {
                              impersonate(u.id)
                              setShowUser(false)
                              nav(u.role === 'member' ? '/app' : u.role === 'trainer' ? '/coach' : '/admin')
                            }}
                            className="menu-pop-item flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs"
                          >
                            <Avatar src={u.avatar} name={u.name} size="sm" />
                            <span className="truncate">{u.name}</span>
                            <Badge tone="zinc" className="ml-auto">{u.role.replace('_', ' ')}</Badge>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => { logout(); nav('/') }}
                      className="menu-pop-item mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ember"
                    >
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex-1 px-3 py-6 md:px-6">
            {q && (
              <SearchResults q={q} onPick={() => setQ('')} />
            )}
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}

function SearchResults({ q, onPick }: { q: string; onPick: () => void }) {
  const { members, users, classes, invoices } = useApp()
  const nav = useNavigate()
  const ql = q.toLowerCase()
  const ms = members.filter((m) => {
    const u = users.find((x) => x.id === m.userId)
    return u?.name.toLowerCase().includes(ql) || u?.email.toLowerCase().includes(ql)
  }).slice(0, 4)
  const cs = classes.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 3)
  const inv = invoices.filter((i) => i.number.toLowerCase().includes(ql)).slice(0, 3)
  if (!ms.length && !cs.length && !inv.length) return null
  return (
    <div className="card mb-4 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-mist">Results</p>
      {ms.map((m) => {
        const u = users.find((x) => x.id === m.userId)!
        return (
          <button key={m.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav(`/admin/members/${m.id}`); onPick() }}>
            <Users className="size-4 text-lime" /> {u.name}
          </button>
        )
      })}
      {cs.map((c) => (
        <button key={c.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav('/admin/classes'); onPick() }}>
          <CalendarDays className="size-4 text-lime" /> {c.name} · {c.startTime}
        </button>
      ))}
      {inv.map((i) => (
        <button key={i.id} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5" onClick={() => { nav('/admin/payments'); onPick() }}>
          <FileText className="size-4 text-lime" /> {i.number}
        </button>
      ))}
    </div>
  )
}
