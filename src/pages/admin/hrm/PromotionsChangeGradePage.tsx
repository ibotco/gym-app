import { Navigate } from 'react-router-dom'

/** Compatibility wrapper for older imports; promotion and grade changes now share one governed workflow. */
export function PromotionsChangeGradePage() {
  return <Navigate to="/admin/hrm/payroll/promotions" replace />
}
