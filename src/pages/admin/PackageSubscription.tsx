import { useState } from 'react'
import { Check, X, Sparkles, RefreshCw, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, Button, Modal, Select, Badge } from '../../components/ui'
import { useLicense } from '../../context/LicenseContext'
import { useToast } from '../../context/ToastContext'
import { cycleDays, cyclePrice, limitRows, PACKAGE_MODULES, PACKAGE_MODULE_GROUPS, pkgModuleLabel } from '../../lib/packages'
import type { OrganizationSubscription, SubscriptionPackage } from '../../types'

const STATUS_TONE: Record<string, 'lime' | 'zinc' | 'amber' | 'rose' | 'sky' | 'violet' | 'orange'> = {
  trial: 'sky', active: 'lime', grace: 'amber', expired: 'rose', suspended: 'orange', cancelled: 'zinc',
}

export function PackageSubscription() {
  const lic = useLicense()
  const toast = useToast()
  const [wizard, setWizard] = useState<SubscriptionPackage | null>(null)
  const [cycle, setCycle] = useState<OrganizationSubscription['billingCycle']>(lic.orgSub?.billingCycle || 'monthly')

  const pkg = lic.currentPackage
  const rows = pkg ? limitRows(pkg.limits) : []

  const confirmChange = () => {
    if (!wizard || !lic.orgSub) return
    const res = lic.changePackage(lic.orgSub.companyId, wizard.id, cycle)
    if (!res.ok) { toast.error('Change blocked', res.blockers.join(' ')); return }
    toast.success(`Switched to ${wizard.name}`, 'Your modules and limits updated immediately.')
    setWizard(null)
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Administration</span><span>/</span><span className="font-semibold text-inherit">Subscription Package</span>
      </div>
      <PageHeader title="Subscription Package" desc="Your current package, usage against its limits, and upgrade options." />

      {/* current package */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-mist">Current package</p>
              <h2 className="mt-1 text-xl font-extrabold">{pkg?.name || '—'}</h2>
              <p className="mt-1 text-sm text-mist">{pkg?.description}</p>
            </div>
            {lic.pkgStatus && <Badge tone={STATUS_TONE[lic.pkgStatus]}>{lic.pkgStatus.toUpperCase()}</Badge>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-[10px] font-extrabold uppercase text-mist">Activated</p><p className="font-bold">{lic.orgSub?.activationDate || '—'}</p></div>
            <div><p className="text-[10px] font-extrabold uppercase text-mist">Renewal / expiry</p><p className="font-bold">{lic.orgSub?.renewalDate || '—'}</p></div>
            <div><p className="text-[10px] font-extrabold uppercase text-mist">Billing cycle</p><p className="font-bold capitalize">{lic.orgSub?.billingCycle || '—'}</p></div>
            <div><p className="text-[10px] font-extrabold uppercase text-mist">Modules included</p><p className="font-bold">{pkg?.modules.length || 0}</p></div>
          </div>
          {lic.orgSub && pkg && (
            <Button className="mt-4 w-full" onClick={() => { lic.renewOrgSub(lic.orgSub!.companyId, cycle); toast.success('Subscription renewed', `${pkg.name} · ${cycle}`) }}>
              <RefreshCw className="size-4" /> Renew now ({cycle})
            </Button>
          )}
        </div>

        {/* usage */}
        <div className="card p-5 xl:col-span-2">
          <p className="mb-3 text-sm font-extrabold">Usage vs package limits</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => {
              const used = lic.usage[r.key]
              const pct = r.limit === -1 ? Math.min(100, used) : Math.min(100, Math.round((used / Math.max(1, r.limit)) * 100))
              const over = r.limit !== -1 && used > r.limit
              return (
                <div key={r.key}>
                  <div className="flex justify-between text-[11px] font-semibold text-mist">
                    <span>{r.label}</span>
                    <span className={over ? 'font-extrabold text-rose-600' : ''}>{used} / {r.limit === -1 ? '∞' : r.limit}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div className={`h-full rounded-full ${over ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-[#1f4e79] dark:bg-lime'}`} style={{ width: `${r.limit === -1 ? 8 : pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {PACKAGE_MODULES.filter((m) => pkg?.modules.includes(m.id)).map((m) => (
              <span key={m.id} className="rounded-full bg-black/5 px-2.5 py-1 text-[10px] font-extrabold dark:bg-white/10">{m.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* comparison / upgrade */}
      <h3 className="mb-3 mt-8 text-sm font-extrabold">Compare packages & upgrade</h3>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {lic.packages.filter((p) => p.active).map((p) => {
          const current = p.id === pkg?.id
          return (
            <div key={p.id} className={`card flex flex-col p-5 ${current ? 'border-lime' : ''}`}>
              <div className="flex items-start justify-between">
                <p className="font-extrabold">{p.name}</p>
                {current && <Badge tone="lime">CURRENT</Badge>}
              </div>
              <p className="mt-1 min-h-10 text-[12px] text-mist">{p.description}</p>
              <p className="mt-2 text-lg font-extrabold">{p.pricing.monthly} {p.pricing.monthly ? 'GHS/mo' : ''}</p>
              <ul className="mt-3 space-y-1.5 text-[12px]">
                {p.perks.map((perk) => <li key={perk} className="flex items-center gap-1.5"><Check className="size-3.5 text-green-600" /> {perk}</li>)}
                <li className="flex items-center gap-1.5"><Check className="size-3.5 text-green-600" /> {p.modules.length} modules</li>
              </ul>
              <div className="mt-auto pt-4">
                {!current && (
                  <Button variant={p.pricing.monthly >= (pkg?.pricing.monthly ?? 0) ? 'primary' : 'outline'} className="w-full" onClick={() => { setWizard(p); setCycle(lic.orgSub?.billingCycle || 'monthly') }}>
                    {p.pricing.monthly >= (pkg?.pricing.monthly ?? 0) ? 'Upgrade' : 'Downgrade'}
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* feature matrix */}
      <div className="card mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                <th className="px-3 py-2.5">Module</th>
                {lic.packages.filter((p) => p.active).map((p) => <th key={p.id} className="px-3 py-2.5 text-center">{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {PACKAGE_MODULE_GROUPS.map((g) => (
                <>
                  <tr key={g.label} className="border-b border-line bg-black/[0.03] dark:bg-white/[0.04]">
                    <td colSpan={lic.packages.filter((p) => p.active).length + 1} className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-mist">{g.label}</td>
                  </tr>
                  {g.modules.map((m) => (
                    <tr key={m.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-1.5 font-bold">{m.label}</td>
                      {lic.packages.filter((p) => p.active).map((p) => (
                        <td key={p.id} className="px-3 py-1.5 text-center">
                          {p.modules.includes(m.id) ? <Check className="mx-auto size-4 text-green-600" /> : <X className="mx-auto size-4 text-zinc-400" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* upgrade/downgrade wizard */}
      <Modal open={!!wizard} onClose={() => setWizard(null)} title={`Switch to ${wizard?.name || ''}`}>
        {wizard && lic.orgSub && (
          <div className="grid gap-3">
            <p className="text-sm text-mist">{wizard.description}</p>
            <div className="grid grid-cols-3 gap-2">
              {(['monthly', 'quarterly', 'annual'] as const).map((c) => (
                <button key={c} onClick={() => setCycle(c)} className={`rounded-xl border px-3 py-2 text-sm font-extrabold capitalize ${cycle === c ? 'border-lime bg-lime/10' : 'border-line'}`}>{c}<p className="text-[11px] font-bold text-mist">{cyclePrice(wizard, c)} GHS / {cycleDays(c)}d</p></button>
              ))}
            </div>
            <p className="rounded-lg bg-black/5 px-3 py-2 text-[12px] dark:bg-white/5">
              Due today: <span className="font-extrabold">{cyclePrice(wizard, cycle)} GHS</span> (unused time on your current plan is credited on mid-cycle changes).
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={confirmChange}><Sparkles className="size-4" /> Confirm change</Button>
              <Button variant="ghost" onClick={() => setWizard(null)}>Cancel</Button>
            </div>
            <p className="flex items-center gap-1.5 text-[11px] text-mist"><Lock className="size-3" /> Downgrades are validated against your current usage — you cannot move to a package below what you already store.</p>
          </div>
        )}
      </Modal>
      <p className="mt-4 text-[11px] text-mist">Billing & activation codes are managed by your provider — see <Link className="underline" to="/admin/subscription">Subscription & Activation</Link>.</p>
    </div>
  )
}
