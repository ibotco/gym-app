import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, BarChart3 } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useLicense } from '../../context/LicenseContext'
import { useToast } from '../../context/ToastContext'
import { uid } from '../../lib/utils'
import { effectiveOrgStatus, limitRows, PACKAGE_MODULE_GROUPS, pkgModuleLabel } from '../../lib/packages'
import { todayIso } from '../../lib/license'
import type { UsageSnapshot } from '../../lib/packages'
import type { PackageLimits, SubscriptionPackage } from '../../types'

type Tab = 'packages' | 'builder' | 'subs' | 'reports'

const LIMIT_FIELD: Record<keyof UsageSnapshot, keyof PackageLimits> = {
  users: 'maxUsers', employees: 'maxEmployees', members: 'maxMembers', branches: 'maxBranches',
  projects: 'maxProjects', inventoryItems: 'maxInventoryItems', assets: 'maxAssets',
  monthlyTransactions: 'maxMonthlyTransactions', storageMb: 'storageMb',
}

const blankLimits = (): PackageLimits => ({ maxUsers: 10, maxEmployees: 25, maxMembers: 500, maxBranches: 2, maxProjects: 5, maxInventoryItems: 250, maxAssets: 50, maxMonthlyTransactions: 1000, storageMb: 1024 })

interface PkgForm {
  name: string; tier: SubscriptionPackage['tier']; description: string; modules: string[];
  limits: PackageLimits; perks: string
  monthly: string; quarterly: string; annual: string; setupFee: string; trialDays: string; graceDays: string
  active: boolean
}

const toForm = (p: SubscriptionPackage): PkgForm => ({
  name: p.name, tier: p.tier, description: p.description || '', modules: [...p.modules], limits: { ...p.limits },
  perks: p.perks.join(', '), monthly: String(p.pricing.monthly), quarterly: String(p.pricing.quarterly),
  annual: String(p.pricing.annual), setupFee: String(p.pricing.setupFee), trialDays: String(p.pricing.trialDays),
  graceDays: String(p.pricing.graceDays), active: p.active,
})

export function PackageManager() {
  const { companies } = useApp()
  const lic = useLicense()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('packages')
  const [form, setForm] = useState<{ id: string | null; f: PkgForm } | null>(null)
  const [del, setDel] = useState<SubscriptionPackage | null>(null)
  const [subCompany, setSubCompany] = useState('')
  const [subPackage, setSubPackage] = useState('')
  const [subCycle, setSubCycle] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [subTrial, setSubTrial] = useState(false)

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name || id

  const save = () => {
    if (!form) return
    const name = form.f.name.trim()
    if (!name) { toast.error('Package name is required.'); return }
    if (!form.f.modules.length) { toast.error('Pick at least one module.'); return }
    const num = (v: string, d = 0) => Math.max(0, Number(v) || d)
    lic.upsertPackage({
      id: form.id || uid('pkg'), name, tier: form.f.tier, description: form.f.description.trim() || undefined,
      modules: form.f.modules, limits: form.f.limits,
      pricing: { monthly: num(form.f.monthly), quarterly: num(form.f.quarterly), annual: num(form.f.annual), setupFee: num(form.f.setupFee), trialDays: num(form.f.trialDays, 14), graceDays: num(form.f.graceDays, 7) },
      perks: form.f.perks.split(',').map((x) => x.trim()).filter(Boolean),
      active: form.f.active, createdAt: todayIso(),
    })
    toast.success(form.id ? 'Package updated' : 'Package created', name)
    setForm(null)
  }

  const revenueByPackage = useMemo(() => {
    const map = new Map<string, number>()
    for (const inv of lic.subInvoices) map.set(inv.packageName, (map.get(inv.packageName) || 0) + inv.amount + inv.setupFee)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [lic.subInvoices])

  const moduleUsage = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of lic.packages) for (const m of p.modules) map.set(m, (map.get(m) || 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [lic.packages])

  const TABS: { id: Tab; label: string }[] = [
    { id: 'packages', label: `Packages (${lic.packages.length})` },
    { id: 'builder', label: 'Package builder' },
    { id: 'subs', label: `Subscriptions (${lic.orgSubs.length})` },
    { id: 'reports', label: 'Reports & analytics' },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Platform</span><span>/</span><span className="font-semibold text-inherit">Subscription Packages</span>
      </div>
      <PageHeader title="Subscription Packages" desc="Build packages from modules, set limits and pricing, and monitor every organisation's subscription." />

      <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-white p-1 dark:bg-zinc-900">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'builder' && !form) setForm({ id: null, f: { name: '', tier: 'custom', description: '', modules: [], limits: blankLimits(), perks: '', monthly: '', quarterly: '', annual: '', setupFee: '', trialDays: '14', graceDays: '7', active: true } }) }}
            className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${tab === t.id ? 'bg-black text-white dark:bg-lime dark:text-black' : 'text-mist hover:text-inherit'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'packages' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {lic.packages.map((p) => (
            <div key={p.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between">
                <p className="font-extrabold">{p.name}</p>
                <Badge tone={p.active ? 'lime' : 'zinc'}>{p.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
              </div>
              <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-mist">{p.tier}</p>
              <p className="mt-2 min-h-10 text-[12px] text-mist">{p.description}</p>
              <p className="mt-2 text-lg font-extrabold">{p.pricing.monthly} GHS<span className="text-[11px] font-bold text-mist">/mo</span></p>
              <p className="text-[11px] text-mist">{p.modules.length} modules · {p.limits.maxBranches === -1 ? '∞' : p.limits.maxBranches} branches · {p.limits.maxMembers === -1 ? '∞' : p.limits.maxMembers} members</p>
              <div className="mt-auto flex gap-1 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => { setForm({ id: p.id, f: toForm(p) }); setTab('builder') }}><Pencil className="size-4" /> Edit</Button>
                <Button variant="ghost" onClick={() => setDel(p)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'builder' && form && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="card p-5 xl:col-span-1">
            <p className="mb-3 text-sm font-extrabold">Details & pricing</p>
            <div className="grid gap-3">
              <Field label="Package name" required><Input value={form.f.name} onChange={(e) => setForm({ ...form, f: { ...form.f, name: e.target.value } })} placeholder="e.g. Starter Package" /></Field>
              <Field label="Tier">
                <Select value={form.f.tier} onChange={(e) => setForm({ ...form, f: { ...form.f, tier: e.target.value as SubscriptionPackage['tier'] } })}>
                  {['starter', 'professional', 'business', 'enterprise', 'custom'].map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Description"><Input value={form.f.description} onChange={(e) => setForm({ ...form, f: { ...form.f, description: e.target.value } })} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Monthly"><Input type="number" value={form.f.monthly} onChange={(e) => setForm({ ...form, f: { ...form.f, monthly: e.target.value } })} /></Field>
                <Field label="Quarterly"><Input type="number" value={form.f.quarterly} onChange={(e) => setForm({ ...form, f: { ...form.f, quarterly: e.target.value } })} /></Field>
                <Field label="Annual"><Input type="number" value={form.f.annual} onChange={(e) => setForm({ ...form, f: { ...form.f, annual: e.target.value } })} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Setup fee"><Input type="number" value={form.f.setupFee} onChange={(e) => setForm({ ...form, f: { ...form.f, setupFee: e.target.value } })} /></Field>
                <Field label="Trial days"><Input type="number" value={form.f.trialDays} onChange={(e) => setForm({ ...form, f: { ...form.f, trialDays: e.target.value } })} /></Field>
                <Field label="Grace days"><Input type="number" value={form.f.graceDays} onChange={(e) => setForm({ ...form, f: { ...form.f, graceDays: e.target.value } })} /></Field>
              </div>
              <Field label="Perks (comma separated)"><Input value={form.f.perks} onChange={(e) => setForm({ ...form, f: { ...form.f, perks: e.target.value } })} placeholder="Unlimited users, API access" /></Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={form.f.active} onChange={(e) => setForm({ ...form, f: { ...form.f, active: e.target.checked } })} className="accent-[#c8f542]" /> Package available</label>
              <Button onClick={save}>{form.id ? 'Save package' : 'Create package'}</Button>
            </div>
          </div>
          <div className="card p-5 xl:col-span-1">
            <p className="mb-3 text-sm font-extrabold">Module access ({form.f.modules.length} selected)</p>
            <div className="max-h-[560px] space-y-4 overflow-y-auto pr-1">
              {PACKAGE_MODULE_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-mist">{g.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.modules.map((mm) => {
                      const id = mm.id
                      const on = form.f.modules.includes(id)
                      const label = mm.label
                      return (
                        <button key={id} onClick={() => setForm({ ...form, f: { ...form.f, modules: on ? form.f.modules.filter((x) => x !== id) : [...form.f.modules, id] } })}
                          className={`rounded-lg border-2 px-2.5 py-1 text-[11px] font-extrabold transition ${on ? 'border-lime bg-lime text-black' : 'border-line text-mist'}`}>{label}</button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5 xl:col-span-1">
            <p className="mb-3 text-sm font-extrabold">Usage limits (-1 = unlimited)</p>
            <div className="grid grid-cols-2 gap-2">
              {limitRows(form.f.limits).map((r) => (
                <Field key={r.key} label={r.label}>
                  <Input type="number" min={-1} value={String(form.f.limits[LIMIT_FIELD[r.key]])} onChange={(e) => setForm({ ...form, f: { ...form.f, limits: { ...form.f.limits, [LIMIT_FIELD[r.key]]: Number(e.target.value) } } })} />
                </Field>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'subs' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="card p-5">
            <p className="mb-3 text-sm font-extrabold">Subscribe an organisation</p>
            <div className="grid gap-3">
              <Field label="Organisation">
                <Select value={subCompany} onChange={(e) => setSubCompany(e.target.value)}>
                  <option value="">Choose company…</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Package">
                <Select value={subPackage} onChange={(e) => setSubPackage(e.target.value)}>
                  <option value="">Choose package…</option>
                  {lic.packages.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Billing cycle">
                <Select value={subCycle} onChange={(e) => setSubCycle(e.target.value as typeof subCycle)}>
                  <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
                </Select>
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={subTrial} onChange={(e) => setSubTrial(e.target.checked)} className="accent-[#c8f542]" /> Start as trial</label>
              <Button disabled={!subCompany || !subPackage} onClick={() => { lic.subscribeCompany(subCompany, subPackage, subCycle, subTrial); toast.success(subTrial ? 'Trial started' : 'Organisation subscribed', companyName(subCompany)); }}>Subscribe</Button>
            </div>
          </div>
          <div className="card overflow-hidden xl:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                    <th className="px-3 py-2.5">Organisation</th><th className="px-3 py-2.5">Package</th><th className="px-3 py-2.5">Cycle</th><th className="px-3 py-2.5">Expires</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lic.orgSubs.map((s) => {
                    const pkg = lic.packages.find((p) => p.id === s.packageId)
                    const st = effectiveOrgStatus(s, pkg?.pricing.graceDays ?? 7)
                    return (
                      <tr key={s.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2 font-bold">{companyName(s.companyId)}</td>
                        <td className="px-3 py-2">{s.packageName}</td>
                        <td className="px-3 py-2 capitalize">{s.billingCycle}</td>
                        <td className="px-3 py-2">{s.expiryDate}</td>
                        <td className="px-3 py-2 text-center"><Badge tone={st === 'active' ? 'lime' : st === 'trial' ? 'sky' : st === 'grace' ? 'amber' : 'rose'}>{st.toUpperCase()}</Badge></td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold hover:bg-black/5 dark:hover:bg-white/5" onClick={() => { lic.renewOrgSub(s.companyId, s.billingCycle); toast.success('Renewed', companyName(s.companyId)) }}>Renew</button>
                            {st !== 'suspended'
                              ? <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-amber-600" onClick={() => lic.setOrgSubStatus(s.companyId, 'suspended')}>Suspend</button>
                              : <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-green-600" onClick={() => lic.setOrgSubStatus(s.companyId, 'active')}>Reactivate</button>}
                            <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-rose-600" onClick={() => lic.setOrgSubStatus(s.companyId, 'cancelled')}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {!lic.orgSubs.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-mist">No organisation subscriptions yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="card p-5">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><BarChart3 className="size-4 text-lime" /> Subscriptions</p>
            {(() => {
              const counts = new Map<string, number>()
              for (const s of lic.orgSubs) {
                const pkg = lic.packages.find((p) => p.id === s.packageId)
                const st = effectiveOrgStatus(s, pkg?.pricing.graceDays ?? 7)
                counts.set(st, (counts.get(st) || 0) + 1)
              }
              return (
                <div className="space-y-2 text-sm">
                  {['active', 'trial', 'grace', 'expired', 'suspended', 'cancelled'].map((k) => (
                    <div key={k} className="flex justify-between"><span className="capitalize text-mist">{k}</span><span className="font-extrabold">{counts.get(k) || 0}</span></div>
                  ))}
                </div>
              )
            })()}
            <p className="mb-2 mt-5 text-sm font-extrabold">Revenue by package</p>
            <div className="space-y-2 text-sm">
              {revenueByPackage.map(([name, amt]) => (
                <div key={name} className="flex justify-between"><span className="text-mist">{name}</span><span className="font-extrabold">{amt.toFixed(2)} GHS</span></div>
              ))}
              {!revenueByPackage.length && <p className="text-[12px] text-mist">No invoices yet.</p>}
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-extrabold">Most included modules</p>
            <div className="space-y-2">
              {moduleUsage.map(([id, n]) => (
                <div key={id}>
                  <div className="flex justify-between text-[11px] font-semibold text-mist"><span>{pkgModuleLabel(id)}</span><span>{n} packages</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700"><div className="h-full rounded-full bg-[#1f4e79] dark:bg-lime" style={{ width: `${(n / Math.max(1, lic.packages.length)) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <p className="mb-3 text-sm font-extrabold">Upgrade trends & history</p>
            <div className="max-h-72 space-y-1.5 overflow-y-auto text-[12px]">
              {lic.subHistory.slice(0, 30).map((h) => (
                <p key={h.id}><span className="font-extrabold">{h.action}</span> · {companyName(h.companyId)} — {h.detail} <span className="text-mist">({h.at.slice(0, 10)})</span></p>
              ))}
              {!lic.subHistory.length && <p className="text-mist">No lifecycle events yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* delete confirm */}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete package?">
        {del && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{del.name}</span>? Organisations already on it keep their subscription until changed.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { lic.deletePackage(del.id); toast.success('Package deleted', del.name); setDel(null) }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>

    </div>
  )
}
