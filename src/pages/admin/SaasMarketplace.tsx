import { useState } from 'react'
import { Check, Sparkles, Store, ArrowRight } from 'lucide-react'
import { PageHeader, Button, Badge, Modal, Segmented } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useLicense } from '../../context/LicenseContext'
import { useToast } from '../../context/ToastContext'
import { formatGhsExact } from '../../lib/utils'
import { effectiveOrgStatus, pkgModuleLabel } from '../../lib/packages'
import type { SubscriptionPackage } from '../../types'
import type { OrganizationSubscription } from '../../types'

type Cycle = OrganizationSubscription['billingCycle']

const TIER_TONE: Record<SubscriptionPackage['tier'], 'zinc' | 'sky' | 'violet' | 'lime' | 'orange'> = {
  starter: 'zinc', professional: 'sky', business: 'violet', enterprise: 'lime', custom: 'orange',
}

/**
 * App Marketplace — the catalogue of marketplace apps is built entirely in
 * the Package Builder (Subscription Packages → Package Builder). Every active
 * package appears here as a subscribable app.
 */
export function SaasMarketplace() {
  const { activeCompanyId } = useApp()
  const lic = useLicense()
  const toast = useToast()

  const [picking, setPicking] = useState<{ pkg: SubscriptionPackage; cycle: Cycle } | null>(null)

  const apps = lic.packages.filter((p) => p.active)
  const current = lic.currentPackage
  const status = lic.orgSub && current ? effectiveOrgStatus(lic.orgSub, current.pricing.graceDays) : undefined

  const cyclePrice = (pkg: SubscriptionPackage, cycle: Cycle) =>
    cycle === 'monthly' ? pkg.pricing.monthly : cycle === 'quarterly' ? pkg.pricing.quarterly : pkg.pricing.annual

  const confirmSubscribe = () => {
    if (!picking) return
    const res = lic.changePackage(activeCompanyId, picking.pkg.id, picking.cycle)
    if (res.ok) {
      toast.success(`Subscribed to ${picking.pkg.name}`, `${picking.cycle} · ${formatGhsExact(cyclePrice(picking.pkg, picking.cycle))}`)
      setPicking(null)
    } else {
      toast.error('Subscription blocked', res.blockers.join(' · '))
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist"><span>Organization</span><span>/</span><span className="font-semibold text-inherit">App Marketplace</span></div>
      <PageHeader title="App Marketplace" desc="Apps built in the Package Builder. Pick the package that fits your organization — upgrade, downgrade or switch anytime."
        actions={<span className="flex items-center gap-2 text-[12px] font-bold text-mist"><Store className="size-4" /> {apps.length} apps available</span>} />

      {current && (
        <div className="card mb-4 flex items-center gap-3 border-lime/40 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime/15 text-green-700 dark:text-lime"><Check className="size-5" /></span>
          <div>
            <p className="text-sm font-extrabold">Current app: {current.name} {status && <Badge tone={status === 'active' ? 'lime' : status === 'trial' ? 'sky' : 'amber'}>{status}</Badge>}</p>
            <p className="text-[12px] text-mist">{lic.orgSub?.billingCycle} billing · renews {lic.orgSub?.renewalDate?.slice(0, 10)}</p>
          </div>
        </div>
      )}

      {!apps.length && (
        <div className="card p-10 text-center">
          <Sparkles className="mx-auto size-8 text-mist" />
          <p className="mt-2 text-sm font-extrabold">No marketplace apps yet</p>
          <p className="text-[12px] text-mist">Build a package in Subscription Packages → Package Builder and it appears here automatically.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {apps.map((pkg) => {
          const isCurrent = current?.id === pkg.id
          return (
            <div key={pkg.id} className={`card flex flex-col p-4 ${isCurrent ? 'ring-2 ring-lime' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold">{pkg.name}</p>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-mist">{pkg.tier}</p>
                </div>
                <Badge tone={TIER_TONE[pkg.tier]}>{isCurrent ? 'Current app' : pkg.tier}</Badge>
              </div>
              {pkg.description && <p className="mt-2 text-[12px] text-mist">{pkg.description}</p>}

              <ul className="mt-2 flex flex-wrap gap-1">
                {pkg.modules.slice(0, 6).map((m) => (
                  <li key={m} className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-extrabold dark:bg-white/10">{pkgModuleLabel(m)}</li>
                ))}
                {pkg.modules.length > 6 && <li className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-extrabold dark:bg-white/10">+{pkg.modules.length - 6}</li>}
              </ul>

              {!!pkg.perks.length && (
                <ul className="mt-2 space-y-0.5">
                  {pkg.perks.slice(0, 3).map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[11px] text-mist"><Check className="mt-0.5 size-3 shrink-0 text-green-700 dark:text-lime" /> {perk}</li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-sm font-extrabold">
                {formatGhsExact(pkg.pricing.monthly)}<span className="text-[11px] font-bold text-mist">/mo</span>
                <span className="ml-2 text-[11px] font-bold text-mist">· {formatGhsExact(pkg.pricing.quarterly)}/qtr · {formatGhsExact(pkg.pricing.annual)}/yr</span>
              </p>
              {pkg.pricing.trialDays > 0 && <p className="mt-0.5 text-[11px] font-bold text-mist">{pkg.pricing.trialDays}-day free trial</p>}

              <Button className="mt-3 w-full justify-center" disabled={isCurrent} onClick={() => setPicking({ pkg, cycle: 'monthly' })}>
                {isCurrent ? 'Current app' : current ? <>Switch to this app <ArrowRight className="size-4" /></> : 'Subscribe'}
              </Button>
            </div>
          )
        })}
      </div>

      {/* cycle picker */}
      <Modal open={!!picking} onClose={() => setPicking(null)} title={`Subscribe — ${picking?.pkg.name || ''}`}>
        {picking && (
          <div className="grid gap-3">
            <Field0 label="Billing cycle">
              <Segmented value={picking.cycle} onChange={(v) => setPicking({ ...picking, cycle: v as Cycle })}
                options={[{ id: 'monthly', label: 'Monthly' }, { id: 'quarterly', label: 'Quarterly' }, { id: 'annual', label: 'Annual' }]} />
            </Field0>
            <div className="rounded-xl bg-black/5 p-3 text-sm dark:bg-white/5">
              <div className="flex justify-between"><span className="text-mist">Price</span><span className="font-extrabold">{formatGhsExact(cyclePrice(picking.pkg, picking.cycle))}</span></div>
              {picking.pkg.pricing.setupFee > 0 && <div className="flex justify-between"><span className="text-mist">Setup fee</span><span className="font-bold">{formatGhsExact(picking.pkg.pricing.setupFee)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-line pt-1 text-base font-extrabold">
                <span>Due today</span>
                <span>{formatGhsExact(cyclePrice(picking.pkg, picking.cycle) + picking.pkg.pricing.setupFee)}</span>
              </div>
              <p className="mt-1 text-[11px] text-mist">{picking.pkg.pricing.trialDays > 0 ? `${picking.pkg.pricing.trialDays}-day trial included. ` : ''}{picking.pkg.pricing.graceDays}-day grace after expiry.</p>
            </div>
            <div className="flex gap-2"><Button className="flex-1" onClick={confirmSubscribe}>Confirm subscription</Button><Button variant="ghost" onClick={() => setPicking(null)}>Cancel</Button></div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Minimal inline label wrapper (Field expects children only). */
function Field0({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-extrabold uppercase tracking-wider text-mist">{label}</span>
      {children}
    </label>
  )
}
