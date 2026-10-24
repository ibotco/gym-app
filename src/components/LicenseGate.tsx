import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLicense } from '../context/LicenseContext'
import { ActivationScreen } from './ActivationScreen'

/**
 * Activation-based access control: tenant roles need an active subscription to
 * reach the admin area; the Super Admin (licensing authority) is exempt.
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { licenseActive } = useLicense()
  if (user?.role === 'super_admin' || licenseActive) return <>{children}</>
  return <ActivationScreen locked />
}
