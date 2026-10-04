import { useState } from 'react'
import { Plus, Pencil, Trash2, Copy, Power, KeyRound, RefreshCw, Send } from 'lucide-react'
import { PageHeader, Button, Modal, Field, Input, Select, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useLicense } from '../../context/LicenseContext'
import { useToast } from '../../context/ToastContext'
import { cn, uid } from '../../lib/utils'
import { daysRemaining, effectiveStatus, todayIso } from '../../lib/license'
import type { SubscriptionPlan, SubscriptionStatus } from '../../types'

type Tab = 'subs' | 'plans' | 'codes' | 'payments' | 'logs'

interface PlanForm { name: string; days: string; price: string; currency: string; description: string; active: boolean }

export function SubscriptionAdmin() {
  const { companies, sessionUser } = useApp()
  const lic = useLicense()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('subs')
  const [planEdit, setPlanEdit] = useState<{ id: string | null; form: PlanForm } | null>(null)
  const [planDel, setPlanDel] = useState<SubscriptionPlan | null>(null)
  const [genCompany, setGenCompany] = useState('')
  const [genPlan, setGenPlan] = useState('')
  const [genDays, setGenDays] = useState('30')
  const [genSingle, setGenSingle] = useState(true)
  const [genVia, setGenVia] = useState<'in-app' | 'email' | 'sms'>('in-app')
  const [issued, setIssued] = useState<string | null>(null)

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name || id
  const activePlans = lic.plans.filter((p) => p.active)
  const selPlan = activePlans.find((p) => p.id === genPlan) || activePlans[0]

  const savePlan = () => {
    if (!planEdit) return
    const name = planEdit.form.name.trim()
    const days = Math.max(1, Number(planEdit.form.days) || 30)
    if (!name) { toast.error('Plan name is required.'); return }
    lic.upsertPlan({
      id: planEdit.id || uid('plan'), name, days,
      price: Math.max(0, Number(planEdit.form.price) || 0),
      currency: planEdit.form.currency || 'GHS',
      description: planEdit.form.description.trim() || undefined,
      custom: true, active: planEdit.form.active, createdAt: todayIso(),
    })
    toast.success(planEdit.id ? 'Plan updated' : 'Plan created', name)
    setPlanEdit(null)
  }

  const generate = () => {
    const plan = selPlan
    const days = plan ? plan.days : Math.max(1, Number(genDays) || 30)
    const rec = lic.generateCode({ companyId: genCompany, days, planName: plan?.name || 'Custom', singleUse: genSingle, sendVia: genVia })
    setIssued(rec.code)
    toast.success('Activation code generated', `${plan?.name || 'Custom'} · ${days} days`)
  }

  const setStatus = (id: string, status: SubscriptionStatus) => {
    lic.setSubscriptionStatus(id, status)
    toast.success(`Subscription ${status}`, companyName(id))
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'subs', label: `Subscriptions (${lic.subscriptions.length})` },
    { id: 'plans', label: `Plans (${lic.plans.length})` },
    { id: 'codes', label: `Activation codes (${lic.codes.length})` },
    { id: 'payments', label: `Payments (${lic.payments.length})` },
    { id: 'logs', label: `License logs (${lic.logs.length})` },
  ]

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs text-mist">
        <span>Platform</span><span>/</span><span className="font-semibold text-inherit">Licensing & Subscriptions</span>
      </div>
      <PageHeader title="Licensing & Subscriptions" desc="Manage subscription plans, generate signed activation codes, and control every company's licence." />

      {/* Section bar — same format as the System settings category bar */}
      <div className="settings-catbar segmented-shell mb-4 flex max-w-full flex-wrap items-center gap-0.5 rounded-xl border border-line bg-white p-1 dark:bg-ink-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-bold transition',
              tab === t.id
                ? 'bg-lime text-lime-ink'
                : 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'subs' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-3 py-2.5">Company</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Activated</th><th className="px-3 py-2.5">Expires</th><th className="px-3 py-2.5 text-center">Days left</th><th className="px-3 py-2.5 text-center">Source</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lic.subscriptions.map((s) => {
                  const st = effectiveStatus(s)
                  const left = daysRemaining(s)
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-bold">{companyName(s.companyId)}</td>
                      <td className="px-3 py-2">{s.planName}</td>
                      <td className="px-3 py-2">{s.lastActivatedAt || s.startDate}</td>
                      <td className="px-3 py-2">{s.expiryDate}</td>
                      <td className={`px-3 py-2 text-center font-bold ${left <= 7 ? 'text-rose-600' : left <= 30 ? 'text-amber-600' : 'text-green-600'}`}>{left}</td>
                      <td className="px-3 py-2 text-center capitalize">{s.source}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${st === 'active' ? 'bg-green-600/15 text-green-700 dark:text-green-400' : st === 'expired' ? 'bg-rose-600/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}`}>{st.toUpperCase()}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold hover:bg-black/5 dark:hover:bg-white/5" title="Extend 30 days" onClick={() => { lic.extendSubscription(s.id, 30); toast.success('Extended +30 days', companyName(s.companyId)) }}>+30d</button>
                          {st !== 'suspended' && st !== 'revoked'
                            ? <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-amber-600 hover:bg-amber-500/10" onClick={() => setStatus(s.id, 'suspended')}>Suspend</button>
                            : <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-green-600 hover:bg-green-500/10" onClick={() => setStatus(s.id, 'active')}>Reactivate</button>}
                          {st !== 'revoked'
                            ? <button className="rounded border border-line px-2 py-1 text-[10px] font-extrabold text-rose-600 hover:bg-rose-500/10" onClick={() => setStatus(s.id, 'revoked')}>Revoke</button>
                            : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!lic.subscriptions.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-mist">No subscriptions yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'plans' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-extrabold">Subscription plans</p>
            <Button onClick={() => setPlanEdit({ id: null, form: { name: '', days: '30', price: '', currency: 'GHS', description: '', active: true } })}><Plus className="size-4" /> New plan</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5 text-center">Days</th><th className="px-3 py-2.5 text-right">Price</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lic.plans.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2"><p className="font-bold">{p.name}</p>{p.description && <p className="text-[11px] text-mist">{p.description}</p>}</td>
                    <td className="px-3 py-2 text-center font-bold">{p.days}</td>
                    <td className="px-3 py-2 text-right font-bold">{p.price} {p.currency}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => { lic.upsertPlan({ ...p, active: !p.active }); toast.success(p.active ? 'Plan disabled' : 'Plan enabled', p.name) }}>
                        <Badge tone={p.active ? 'lime' : 'zinc'}>{p.active ? 'Active' : 'Disabled'}</Badge>
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button className="rounded-lg p-1.5 text-mist hover:text-lime" onClick={() => setPlanEdit({ id: p.id, form: { name: p.name, days: String(p.days), price: String(p.price), currency: p.currency || 'GHS', description: p.description || '', active: p.active } })}><Pencil className="size-4" /></button>
                        <button className="rounded-lg p-1.5 text-mist hover:text-ember" onClick={() => setPlanDel(p)}><Trash2 className="size-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'codes' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-extrabold"><KeyRound className="size-4 text-lime" /> Generate activation code</p>
            <div className="grid gap-3">
              <Field label="Company">
                <Select value={genCompany} onChange={(e) => setGenCompany(e.target.value)}>
                  <option value="">Any company</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Plan">
                <Select value={selPlan?.id || ''} onChange={(e) => setGenPlan(e.target.value)}>
                  {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.days}d)</option>)}
                  <option value="__custom">Custom duration</option>
                </Select>
              </Field>
              {genPlan === '__custom' && <Field label="Duration (days)"><Input type="number" min="1" value={genDays} onChange={(e) => setGenDays(e.target.value)} /></Field>}
              <Field label="Deliver via">
                <Select value={genVia} onChange={(e) => setGenVia(e.target.value as typeof genVia)}>
                  <option value="in-app">In-app notification</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </Select>
              </Field>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={genSingle} onChange={(e) => setGenSingle(e.target.checked)} className="accent-[#c8f542]" /> Single-use code</label>
              <Button onClick={generate}><Send className="size-4" /> Generate & send</Button>
            </div>
          </div>
          <div className="card overflow-hidden lg:col-span-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                    <th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Company</th><th className="px-3 py-2.5">Issued</th><th className="px-3 py-2.5">Used</th><th className="px-3 py-2.5 text-center">Status</th><th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lic.codes.map((c) => (
                    <tr key={c.id} className="border-b border-line last:border-0">
                      <td className="px-3 py-2 font-bold">{c.planName} · {c.planDays}d</td>
                      <td className="px-3 py-2">{c.companyId ? companyName(c.companyId) : 'Any'}</td>
                      <td className="px-3 py-2">{c.issuedAt}<p className="text-[10px] text-mist">by {c.issuedBy}</p></td>
                      <td className="px-3 py-2">{c.usedAt ? `${c.usedAt} · ${companyName(c.usedByCompanyId || '')}` : '—'}</td>
                      <td className="px-3 py-2 text-center"><span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${c.status === 'available' ? 'bg-green-600/15 text-green-700 dark:text-green-400' : c.status === 'used' ? 'bg-zinc-500/15 text-zinc-500' : 'bg-rose-600/15 text-rose-600'}`}>{c.status.toUpperCase()}</span></td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="rounded-lg p-1.5 text-mist hover:text-lime" title="Copy code" onClick={() => { navigator.clipboard?.writeText(c.code).catch(() => undefined); toast.success('Code copied') }}><Copy className="size-4" /></button>
                          {c.status === 'available' && <button className="rounded-lg p-1.5 text-mist hover:text-ember" title="Revoke" onClick={() => lic.revokeCode(c.id)}><Power className="size-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!lic.codes.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-mist">No codes generated yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Receipt</th><th className="px-3 py-2.5">Company</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Gateway</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {lic.payments.map((x) => (
                  <tr key={x.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{x.date}</td>
                    <td className="px-3 py-2 font-mono">{x.receiptNo}</td>
                    <td className="px-3 py-2 font-bold">{companyName(x.companyId)}</td>
                    <td className="px-3 py-2">{x.planName}</td>
                    <td className="px-3 py-2 capitalize">{x.gateway}</td>
                    <td className="px-3 py-2 text-right font-bold">{x.amount.toFixed(2)} {x.currency}</td>
                    <td className="px-3 py-2 text-center"><span className="rounded-full bg-green-600/15 px-2 py-0.5 text-[10px] font-extrabold text-green-700 dark:text-green-400">{x.status.toUpperCase()}</span></td>
                  </tr>
                ))}
                {!lic.payments.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-mist">No renewal payments recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-extrabold">Activation & licensing audit log</p>
            <Button variant="outline" onClick={() => { const n = lic.syncLogs(); toast.success(n ? `${n} log entries synced` : 'All logs already synced') }}><RefreshCw className="size-4" /> Sync now</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-line bg-black/[0.02] text-left text-[10px] font-bold uppercase tracking-wider text-mist dark:bg-white/[0.03]">
                  <th className="px-3 py-2.5">At</th><th className="px-3 py-2.5">Actor</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Detail</th><th className="px-3 py-2.5 text-center">Synced</th>
                </tr>
              </thead>
              <tbody>
                {lic.logs.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(l.at).toLocaleString('en-GB')}</td>
                    <td className="px-3 py-2 font-bold">{l.actor}</td>
                    <td className="px-3 py-2"><span className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px] font-bold dark:bg-white/10">{l.action}</span></td>
                    <td className="px-3 py-2 text-mist">{l.detail}</td>
                    <td className="px-3 py-2 text-center">{l.synced ? '✔' : '…'}</td>
                  </tr>
                ))}
                {!lic.logs.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-mist">No licensing activity yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* plan form */}
      <Modal open={!!planEdit} onClose={() => setPlanEdit(null)} title={planEdit?.id ? 'Edit plan' : 'New plan'}>
        {planEdit && (
          <div className="grid gap-3">
            <Field label="Plan name" required><Input value={planEdit.form.name} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, name: e.target.value } })} placeholder="e.g. Bi-Annual Plan" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Days"><Input type="number" min="1" value={planEdit.form.days} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, days: e.target.value } })} /></Field>
              <Field label="Price"><Input type="number" min="0" value={planEdit.form.price} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, price: e.target.value } })} /></Field>
              <Field label="Currency"><Input value={planEdit.form.currency} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, currency: e.target.value } })} /></Field>
            </div>
            <Field label="Description"><Input value={planEdit.form.description} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, description: e.target.value } })} /></Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={planEdit.form.active} onChange={(e) => setPlanEdit({ ...planEdit, form: { ...planEdit.form, active: e.target.checked } })} className="accent-[#c8f542]" /> Plan available for renewal</label>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={savePlan}>{planEdit.id ? 'Save changes' : 'Create plan'}</Button>
              <Button variant="ghost" onClick={() => setPlanEdit(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* issued code */}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="Activation code ready">
        {issued && (
          <div className="grid gap-3">
            <p className="text-sm text-mist">Send this signed code to the customer. It validates offline and is checked against reuse.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg border border-line bg-black/5 px-3 py-2 font-mono text-[11px] dark:bg-white/5">{issued}</code>
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(issued).catch(() => undefined); toast.success('Code copied') }}><Copy className="size-4" /></Button>
            </div>
            <Button onClick={() => setIssued(null)}>Done</Button>
          </div>
        )}
      </Modal>

      {/* delete plan */}
      <Modal open={!!planDel} onClose={() => setPlanDel(null)} title="Delete plan?">
        {planDel && (
          <>
            <p className="text-sm text-mist">Delete <span className="font-semibold text-inherit">{planDel.name}</span>? Existing subscriptions keep their terms.</p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setPlanDel(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => { lic.deletePlan(planDel.id); toast.success('Plan deleted', planDel.name); setPlanDel(null) }}><Trash2 className="size-4" /> Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
