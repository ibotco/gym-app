import type { IntegrationHealth, PaymentMethod, PaymentSettings } from '../types'
import { loadIntegrations } from './integrations'

export const PAYMENT_SETTINGS_KEY = 'fitpro_payment_settings'

/** Maps integration catalogue ids to payment methods. */
export const INTEGRATION_GATEWAY_MAP: Record<string, PaymentMethod> = {
  int_paystack: 'paystack',
  int_stripe: 'stripe',
  int_paypal: 'paypal',
  int_momo: 'momo',
  int_payaza: 'payaza',
  int_flutterwave: 'flutterwave',
  int_hubtel: 'hubtel',
}

/** Payment gateways that are active in the Integrations catalogue. */
export function activePaymentGateways(): PaymentMethod[] {
  return loadIntegrations()
    .filter((i) => i.category === 'payments' && i.active)
    .map((i) => INTEGRATION_GATEWAY_MAP[i.id])
    .filter((g): g is PaymentMethod => !!g)
}

export interface GatewayIntegrationStatus {
  active: boolean
  connected: boolean
  health: IntegrationHealth
  apiStatus: string
}

/** Integration status for a gateway, or null if it has no integration record. */
export function gatewayIntegrationStatus(method: PaymentMethod): GatewayIntegrationStatus | null {
  const id = Object.keys(INTEGRATION_GATEWAY_MAP).find((k) => INTEGRATION_GATEWAY_MAP[k] === method)
  if (!id) return null
  const rec = loadIntegrations().find((i) => i.id === id)
  if (!rec) return null
  return { active: rec.active, connected: rec.connected, health: rec.health, apiStatus: rec.apiStatus }
}

/** Online gateways a club can enable. */
export interface GatewayDef {
  id: PaymentMethod
  label: string
  desc: string
}

export const ONLINE_GATEWAYS: GatewayDef[] = [
  { id: 'paystack', label: 'Paystack', desc: 'Ghana checkout — Visa, Mastercard, and MTN / Telecel / AirtelTigo MoMo.' },
  { id: 'payaza', label: 'Payaza', desc: 'Nigeria & Ghana collections — card, bank transfer, and mobile money via hosted checkout.' },
  { id: 'flutterwave', label: 'Flutterwave', desc: 'Pan-African checkout — card, bank transfer, mobile money, and USSD.' },
  { id: 'hubtel', label: 'Hubtel', desc: 'Ghana collections — MTN / Telecel / AirtelTigo MoMo and online checkout.' },
  { id: 'stripe', label: 'Stripe', desc: 'Cards and subscriptions for Black Card and Annual plans.' },
  { id: 'paypal', label: 'PayPal', desc: 'Wallet checkout for diaspora members paying in GHS.' },
  { id: 'momo', label: 'Mobile Money', desc: 'MTN / Telecel / AirtelTigo collections via Hubtel.' },
]

export const MANUAL_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card (at desk)' },
]

export function defaultPaymentSettings(): PaymentSettings {
  return {
    enabledGateways: ['paystack', 'momo'],
    defaultGateway: 'paystack',
    allowManual: true,
  }
}

export function loadPaymentSettings(): PaymentSettings {
  const base = defaultPaymentSettings()
  const active = activePaymentGateways()
  try {
    const raw = localStorage.getItem(PAYMENT_SETTINGS_KEY)
    if (!raw) return { ...base, enabledGateways: base.enabledGateways.filter((g) => active.includes(g)) }
    const parsed = JSON.parse(raw) as Partial<PaymentSettings>
    const enabled = Array.isArray(parsed.enabledGateways)
      ? parsed.enabledGateways.filter((g) => ONLINE_GATEWAYS.some((o) => o.id === g) && active.includes(g))
      : base.enabledGateways.filter((g) => active.includes(g))
    const def = enabled.includes(parsed.defaultGateway as PaymentMethod)
      ? (parsed.defaultGateway as PaymentMethod)
      : enabled[0] || base.defaultGateway
    return {
      enabledGateways: enabled,
      defaultGateway: def,
      allowManual: parsed.allowManual !== false,
    }
  } catch {
    return base
  }
}

export function savePaymentSettings(s: PaymentSettings) {
  try { localStorage.setItem(PAYMENT_SETTINGS_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

/** The gateway to pre-select for a new online payment. */
export function defaultPaymentMethod(s: PaymentSettings): PaymentMethod {
  if (s.enabledGateways.includes(s.defaultGateway)) return s.defaultGateway
  if (s.enabledGateways.length) return s.enabledGateways[0]
  return 'paystack'
}

export function gatewayLabel(id: PaymentMethod) {
  return ONLINE_GATEWAYS.find((g) => g.id === id)?.label || id
}
