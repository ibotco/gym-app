import { useState } from 'react'
import { CreditCard, Wallet, Check, Star, ShieldAlert } from 'lucide-react'
import { Button, Badge } from '../../components/ui'
import { useApp } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { ONLINE_GATEWAYS, MANUAL_METHODS, gatewayIntegrationStatus } from '../../lib/payments'
import { cn } from '../../lib/utils'
import type { PaymentMethod, PaymentSettings } from '../../types'

export function PaymentSettingsForm() {
  const { paymentSettings, setPaymentSettings } = useApp()
  const toast = useToast()
  const [s, setS] = useState<PaymentSettings>(paymentSettings)

  const toggleGateway = (id: PaymentMethod) => {
    setS((prev) => {
      const enabled = prev.enabledGateways.includes(id)
        ? prev.enabledGateways.filter((g) => g !== id)
        : [...prev.enabledGateways, id]
      const defaultGateway = enabled.includes(prev.defaultGateway)
        ? prev.defaultGateway
        : enabled[0] || 'paystack'
      return { ...prev, enabledGateways: enabled, defaultGateway }
    })
  }

  const setDefault = (id: PaymentMethod) => setS((prev) => ({ ...prev, defaultGateway: id }))

  const save = () => {
    if (!s.enabledGateways.length) {
      toast.error('Enable at least one gateway')
      return
    }
    setPaymentSettings(s)
    toast.success('Payment settings saved')
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="card max-w-2xl space-y-5 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime/10 text-lime">
            <CreditCard className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Online payment gateways</p>
            <p className="mt-1 text-sm text-mist">
              Gateways are driven by the Integrations page — only payment integrations that are <span className="font-semibold text-inherit">active</span> there can be enabled here. Pick your default for new payments.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {ONLINE_GATEWAYS.map((g) => {
            const status = gatewayIntegrationStatus(g.id)
            const activeInIntegrations = status?.active ?? false
            const on = s.enabledGateways.includes(g.id)
            const isDefault = s.defaultGateway === g.id
            const disabled = !activeInIntegrations

            return (
              <div
                key={g.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition',
                  on && !disabled ? 'border-lime/50 bg-lime/5' : 'border-line',
                  disabled && 'opacity-60',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[#c8f542]"
                  checked={on}
                  disabled={disabled}
                  onChange={() => toggleGateway(g.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{g.label}</p>
                    {isDefault && !disabled && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                        <Star className="size-3" /> Default
                      </span>
                    )}
                    {status && status.active && status.connected && (
                      <Badge tone="lime">Connected</Badge>
                    )}
                    {status && status.active && !status.connected && (
                      <Badge tone="amber">Demo / not configured</Badge>
                    )}
                    {!activeInIntegrations && (
                      <Badge tone="zinc">Inactive in Integrations</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-mist">{g.desc}</p>
                  {!activeInIntegrations && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                      <ShieldAlert className="size-3.5" /> Activate this payment integration first to offer it here.
                    </p>
                  )}
                </div>
                {on && !disabled && (
                  <Button size="sm" variant={isDefault ? 'soft' : 'outline'} onClick={() => setDefault(g.id)} disabled={isDefault}>
                    {isDefault ? <Check className="size-4" /> : 'Make default'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="card max-w-2xl space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-400">
            <Wallet className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Manual collection</p>
            <p className="mt-1 text-sm text-mist">Allow front-desk staff to record cash or card-at-desk payments alongside online gateways.</p>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[#c8f542]"
            checked={s.allowManual}
            onChange={(e) => setS({ ...s, allowManual: e.target.checked })}
          />
          <span>
            <span className="font-semibold">Enable manual payments</span>
            <span className="block text-xs text-mist">{MANUAL_METHODS.map((m) => m.label).join(' · ')}</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save}>Save payment settings</Button>
        <Button variant="outline" onClick={() => setS(paymentSettings)}>Discard changes</Button>
      </div>
    </div>
  )
}
