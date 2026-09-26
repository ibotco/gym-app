import { ActivationScreen } from '../../components/ActivationScreen'

/** Tenant-facing subscription dashboard: status, renewal (online/offline) and payment history. */
export function SubscriptionAccount() {
  return <ActivationScreen locked={false} showHistory />
}
