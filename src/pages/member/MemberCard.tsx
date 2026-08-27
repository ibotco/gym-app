import { PageHeader, Badge } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { QRCodeSVG } from 'qrcode.react'
import { Barcode } from '../../components/Barcode'
import { formatDate } from '../../lib/utils'

export function MemberCard() {
  const { user } = useAuth()
  const { members, memberships, plans, branches, users, company } = useApp()
  const m = members.find((x) => x.userId === user?.id)
  const ms = memberships.find((x) => x.id === m?.membershipId)
  const plan = plans.find((p) => p.id === (ms?.planId || m?.planId))
  const u = users.find((x) => x.id === m?.userId)
  const branch = branches.find((b) => b.id === (ms?.branchId || u?.branchId))

  const code = m?.qrCode || 'FITPRO'
  const format = company.cardCodeFormat || 'both'
  const showQr = format === 'qr' || format === 'both'
  const showBarcode = format === 'barcode' || format === 'both'

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

          {showQr && (
            <div className="mt-8 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display truncate text-2xl">{user?.name}</p>
                <p className="text-xs text-mist">{code}</p>
                <p className="mt-2 text-xs text-mist">
                  Valid through {ms ? formatDate(ms.endDate) : '—'}
                  {branch ? ` · ${branch.name}` : ''}
                </p>
              </div>
              <div className="size-28 shrink-0 rounded-xl bg-white p-2">
                <QRCodeSVG value={code} size={96} level="M" marginSize={0} />
              </div>
            </div>
          )}

          {showBarcode && (
            <div className={showQr ? 'mt-6' : 'mt-8'}>
              {!showQr && (
                <div className="mb-4">
                  <p className="font-display truncate text-2xl">{user?.name}</p>
                  <p className="mt-2 text-xs text-mist">
                    Valid through {ms ? formatDate(ms.endDate) : '—'}
                    {branch ? ` · ${branch.name}` : ''}
                  </p>
                </div>
              )}
              <p className="text-[10px] uppercase tracking-[0.16em] text-mist">Scan me</p>
              <div className="mt-1 overflow-hidden rounded bg-white px-2 py-1">
                <Barcode value={code} height={44} moduleWidth={2} quietZone={8} />
              </div>
            </div>
          )}

          <p className="mt-3 text-center font-mono text-[10px] tracking-[0.3em] text-mist">{code}</p>
        </div>
        <p className="mt-4 text-center text-xs text-mist">
          Screenshot works offline. Your code is unique to you — don&apos;t share it.
        </p>
      </div>
    </div>
  )
}
