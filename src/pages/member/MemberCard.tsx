import { PageHeader, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { QrFake } from '../admin/CheckIn'
import { formatDate } from '../../lib/utils'

export function MemberCard() {
  const { user } = useAuth()
  const { members, memberships, plans } = useApp()
  const m = members.find((x) => x.userId === user?.id)
  const ms = memberships.find((x) => x.id === m?.membershipId)
  const plan = plans.find((p) => p.id === (ms?.planId || m?.planId))

  return (
    <div>
      <PageHeader title="Digital membership card" desc="Show this at the door or let the desk scan your code." />
      <div className="mx-auto max-w-md">
        <div className="shine relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-6 text-white shadow-2xl ring-1 ring-white/10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-bold">FitPro<span className="text-lime">.</span></p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-mist">Member</p>
            </div>
            <Badge tone="lime">{plan?.name || 'Member'}</Badge>
          </div>
          <div className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p className="font-display text-2xl">{user?.name}</p>
              <p className="text-xs text-mist">{m?.qrCode}</p>
              <p className="mt-2 text-xs text-mist">Valid through {ms ? formatDate(ms.endDate) : '—'}</p>
            </div>
            <div className="size-28 rounded-xl bg-white p-2">
              <QrFake value={m?.qrCode || 'FITPRO'} />
            </div>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.16em] text-mist">Barcode · {m?.id.toUpperCase()}</p>
          <div className="mt-1 h-10 overflow-hidden bg-white">
            <svg viewBox="0 0 200 40" className="h-full w-full">
              {Array.from({ length: 60 }).map((_, i) => (
                <rect key={i} x={i * 3.3} y="0" width={i % 3 === 0 ? 1 : 2} height="40" fill="#111" />
              ))}
            </svg>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-mist">Screenshot works offline. Lost phone? Front desk can reprint a day pass.</p>
      </div>
    </div>
  )
}
