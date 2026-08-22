import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import { useAuth, roleHome } from '../context/AuthContext'

export function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, impersonating } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  if (!roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />
  if (user.mustChangePassword && !impersonating && loc.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}
