import { useMemo, useState } from 'react'
import { KeyRound, Wifi, WifiOff, Sparkles, CreditCard, Clock } from 'lucide-react'
import { Button, Field, Input, Select } from './ui'
import { GatewayPayButton } from './GatewayPayButton'
import { useLicense } from '../context/LicenseContext'
import { useApp } from '../context/AppContext'
import { ONLINE_GATEWAYS } from '../lib/payments'
import { daysRemaining, effectiveStatus } from '../lib/license'
import type { Payment, SubscriptionPlan } from '../types'

/**
 * Modern activation / renewal screen. Online: pick a plan and pay through an
 * integrated gateway (auto-activation on confirmation). Offline: redeem a
 * Super-Admin issued activation code.
 */
export function ActivationScreen({ locked, showHistory }: { locked: boolean; showHistory?: boolean }) {
  const app = useApp()
  const lic = useLicense()
  const { sessionUser, company } = app
  const [tab, setTab] = useState<'online' | 'offline'>('online')
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [planId, setPlanId] = useState<string>('')
  const [gateway, setGateway] = useState<string>(ONLINE_GATEWAYS[0]?.id || 'paystack')
  const online = typeof navigator === 'undefined' ? true : navigator.onLine

  const activePlans = lic.plans.filter((p) => p.active)
  const plan = activePlans.find((p) => p.id === planId) || activePlans[0]
  const status = lic.license ? effectiveStatus(lic.license) : 'expired'
  const left = lic.license ? daysRemaining(lic.license) : 0

  const payment: Payment | undefined = useMemo(() => plan && ({
    id: `licpay_${plan.id}`,
    memberId: sessionUser?.id || 'license',
    amount: plan.price,
    method: gateway as Payment['method'],
    status: 'pending',
    invoiceId: `LIC-${plan.id}`,
    date: new Date().toISOString().slice(0, 10),
    description: `Subscription renewal — ${plan.name}`,
  }), [plan, gateway, sessionUser])

  const redeem = () => {
    const res = lic.redeemCode(code.trim())
    if (res.ok) setCodeMsg({ ok: true, text: `Activation successful — subscription now expires on ${res.expiry}.` })
    else setCodeMsg({ ok: false, text: res.error })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-zinc-950 via-zinc-900 to-[#12233d] p-4 text-zinc-100">
      <div className="w-full max-w-3xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-lime text-black"><Sparkles className="size-7" /></div>
          <h1 className="text-2xl font-extrabold tracking-tight">{locked ? 'Subscription required' : 'Subscription & Activation'}</h1>
          <p className="mt-1 text-sm text-zinc-400">{company?.name || 'Your organisation'} — keep your FitPro licence active to continue.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl backdrop-blur">
          {/* status strip */}
          <div className="grid gap-3 border-b border-white/10 bg-white/5 px-5 py-4 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Status</p>
              <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-rose-500/20 text-rose-400'}`}>{status.toUpperCase()}</span>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Activated</p>
              <p className="mt-1 text-sm font-bold">{lic.license?.lastActivatedAt || lic.license?.startDate || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Expires</p>
              <p className="mt-1 text-sm font-bold">{lic.license?.expiryDate || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Days left</p>
              <p className={`mt-1 flex items-center gap-1 text-sm font-bold ${left <= 7 ? 'text-rose-400' : 'text-lime'}`}><Clock className="size-3.5" /> {lic.license ? Math.max(0, left) : 0}</p>
            </div>
          </div>

          {/* tabs */}
          <div className="flex border-b border-white/10 text-sm font-bold">
            <button onClick={() => setTab('online')} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 ${tab === 'online' ? 'border-b-2 border-lime text-lime' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />} Renew online
            </button>
            <button onClick={() => setTab('offline')} className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 ${tab === 'offline' ? 'border-b-2 border-lime text-lime' : 'text-zinc-400 hover:text-zinc-200'}`}>
              <KeyRound className="size-4" /> Activation code
            </button>
          </div>

          <div className="p-5">
            {tab === 'online' ? (
              online ? (
                <div className="grid gap-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activePlans.map((p: SubscriptionPlan) => (
                      <button key={p.id} onClick={() => setPlanId(p.id)} className={`rounded-xl border px-4 py-3 text-left transition ${plan?.id === p.id ? 'border-lime bg-lime/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                        <p className="text-sm font-extrabold">{p.name}</p>
                        <p className="text-[11px] text-zinc-400">{p.days} days · {p.price} {p.currency || 'GHS'}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Payment gateway">
                      <Select value={gateway} onChange={(e) => setGateway(e.target.value)}>
                        {ONLINE_GATEWAYS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                      </Select>
                    </Field>
                    <div className="flex items-end">
                      {plan && payment && (
                        <GatewayPayButton
                          payment={payment}
                          email={sessionUser?.email || ''}
                          name={sessionUser?.name}
                          label={`Pay ${plan.price} ${plan.currency || 'GHS'} & activate`}
                          size="md"
                          onDone={(r) => {
                            if (r.ok) lic.renewOnline(plan, gateway, r.reference || r.demo ? (r.reference || `demo_${Date.now()}`) : `ref_${Date.now()}`, plan.price)
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">Payment is verified automatically; your subscription and expiry update instantly and a receipt is issued.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
                  <p className="flex items-center gap-2 font-bold"><WifiOff className="size-4" /> You are offline</p>
                  <p className="mt-1 text-[12px]">Online renewal needs a connection. Use an activation code instead — your subscription syncs once you are back online.</p>
                </div>
              )
            ) : (
              <div className="grid gap-3">
                <Field label="Activation code">
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FITPRO-…" className="font-mono" />
                </Field>
                <Button onClick={redeem} disabled={!code.trim()}><KeyRound className="size-4" /> Activate</Button>
                {codeMsg && (
                  <p className={`rounded-lg px-3 py-2 text-[12px] font-semibold ${codeMsg.ok ? 'bg-green-500/15 text-green-400' : 'bg-rose-500/15 text-rose-400'}`}>{codeMsg.text}</p>
                )}
                <p className="text-[11px] text-zinc-500">Codes are issued by your Super Admin after payment verification. Each code is signed, unique and single-use.</p>
              </div>
            )}
          </div>
        </div>
        {showHistory && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80">
            <p className="border-b border-white/10 px-5 py-3 text-sm font-extrabold">Payment history</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    <th className="px-4 py-2">Date</th><th className="px-4 py-2">Receipt</th><th className="px-4 py-2">Plan</th><th className="px-4 py-2">Gateway</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lic.payments.filter((x) => x.companyId === app.activeCompanyId).map((x) => (
                    <tr key={x.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2">{x.date}</td>
                      <td className="px-4 py-2 font-mono">{x.receiptNo}</td>
                      <td className="px-4 py-2">{x.planName}</td>
                      <td className="px-4 py-2 capitalize">{x.gateway}</td>
                      <td className="px-4 py-2 text-right font-bold">{x.amount.toFixed(2)} {x.currency}</td>
                      <td className="px-4 py-2 text-center"><span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-extrabold text-green-400">{x.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                  {!lic.payments.some((x) => x.companyId === app.activeCompanyId) && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-zinc-500">No renewal payments yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-4 text-center text-[11px] text-zinc-500">Need help? Contact your FitPro provider to renew or obtain an activation code.</p>
      </div>
    </div>
  )
}
