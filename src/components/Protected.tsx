import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '../types'
import { useAuth, roleHome } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

export function Protected({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, impersonating } = useAuth()
  const app = useApp()
  const loc = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />
  const definition = app.roles.find((role) => role.id === user.role)
  const customRoutePermissions: Array<{ prefix: string; permissions: string[] }> = [
    { prefix: '/admin/roles', permissions: ['roles.view', 'roles.manage'] },
    { prefix: '/admin/users', permissions: ['users.view', 'users.manage'] },
    { prefix: '/admin/members', permissions: ['members.view', 'members.manage'] },
    { prefix: '/admin/suppliers', permissions: ['suppliers.view', 'suppliers.manage'] },
    { prefix: '/admin/supplier-categories', permissions: ['supplierCategories.view', 'supplierCategories.manage'] },
    { prefix: '/admin/customers', permissions: ['customers.view', 'customers.manage'] },
    { prefix: '/admin/customer-categories', permissions: ['customerCategories.view', 'customerCategories.manage'] },
    { prefix: '/admin/companies', permissions: ['companies.view', 'companies.manage'] },
    { prefix: '/admin/branches', permissions: ['branches.view', 'branches.manage'] },
    { prefix: '/admin/plans', permissions: ['plans.view', 'plans.manage'] },
    { prefix: '/admin/classes', permissions: ['classes.view', 'classes.manage'] },
    { prefix: '/admin/inventory', permissions: ['inventory.view', 'inventory.manage', 'pos.use'] },
    { prefix: '/admin/pos', permissions: ['pos.use', 'sales.pos'] },
    { prefix: '/admin/sales', permissions: ['sales.list', 'sales.pos', 'sales.reports'] },
    { prefix: '/admin/invoices', permissions: ['sales.invoices', 'sales.list'] },
    { prefix: '/admin/receive-payments', permissions: ['payments.view', 'payments.manage'] },
    { prefix: '/admin/shipments', permissions: ['sales.shipments', 'sales.list'] },
    { prefix: '/admin/discounts', permissions: ['sales.discounts', 'sales.list'] },
    { prefix: '/admin/proposals', permissions: ['sales.proposals', 'sales.list'] },
    { prefix: '/admin/estimates', permissions: ['sales.estimates', 'sales.list'] },
    { prefix: '/admin/purchases', permissions: ['purchases.list', 'purchases.orders', 'purchases.reports'] },
    { prefix: '/admin/purchase-orders', permissions: ['purchases.orders'] },
    { prefix: '/admin/purchase-requisitions', permissions: ['purchases.requisitions'] },
    { prefix: '/admin/procurement-orders', permissions: ['purchases.orders'] },
    { prefix: '/admin/goods-receipts', permissions: ['purchases.goodsreceipts'] },
    { prefix: '/admin/supplier-invoices', permissions: ['purchases.supplierinvoices'] },
    { prefix: '/admin/supplier-payments', permissions: ['purchases.supplierpayments'] },
    { prefix: '/admin/procurement-returns', permissions: ['purchases.returns'] },
    { prefix: '/admin/procurement-reports', permissions: ['purchases.reports'] },
    { prefix: '/admin/purchase-returns', permissions: ['purchases.returns'] },
    { prefix: '/admin/purchase-reports', permissions: ['purchases.reports'] },
    { prefix: '/admin/reports', permissions: ['reports.view'] },
    { prefix: '/admin/notifications', permissions: ['notifications.manage'] },
    { prefix: '/admin/checkin', permissions: ['checkin.use'] },
    { prefix: '/admin/audit', permissions: ['audit.view'] },
    { prefix: '/admin/settings', permissions: ['settings.manage'] },
    { prefix: '/admin/cms', permissions: ['settings.manage'] },
    { prefix: '/admin/accounting', permissions: ['accounting.settings', 'accounting.reports', 'accounting.receiptVoucher', 'accounting.paymentVoucher', 'accounting.journalVoucher'] },
    { prefix: '/admin/assets', permissions: ['assets.register', 'assets.depreciation', 'assets.transactions', 'assets.setup', 'assets.reports'] },
    { prefix: '/admin/hrm', permissions: ['staff.view', 'departments.view', 'leave.view', 'attendance.view', 'payroll.view', 'recruitment.view', 'performance.view'] },
    { prefix: '/admin/staff', permissions: ['staff.view', 'staff.manage'] },
    { prefix: '/admin/trainers', permissions: ['staff.view', 'staff.manage'] },
    { prefix: '/admin/leads', permissions: ['leads.view', 'leads.manage'] },
    { prefix: '/admin/profile', permissions: ['dashboard.view'] },
  ]
  const customRouteAllowed = Boolean(definition && !definition.builtin && definition.permissions.length > 0 && (
    (definition.portal === 'admin' && (
      loc.pathname === '/admin'
      || customRoutePermissions.some((route) => loc.pathname.startsWith(route.prefix) && route.permissions.some((permission) => definition.permissions.includes(permission)))
    ))
    || (definition.portal === 'coach' && loc.pathname.startsWith('/coach') && (
      loc.pathname === '/coach' || definition.permissions.some((permission) => permission.startsWith('coach.'))
    ))
    || (definition.portal === 'member' && loc.pathname.startsWith('/app') && (
      loc.pathname === '/app' || definition.permissions.some((permission) => permission.startsWith('member.'))
    ))
    || (definition.portal === 'customer' && loc.pathname.startsWith('/customer') && (
      loc.pathname === '/customer' || definition.permissions.some((permission) => permission.startsWith('customer.'))
    ))
    || (definition.portal === 'supplier' && loc.pathname.startsWith('/supplier') && (
      loc.pathname === '/supplier' || definition.permissions.some((permission) => permission.startsWith('supplier.'))
    ))
  ))
  const customRouteMayBypass = !(roles.length === 1 && roles[0] === 'super_admin')
  if (!roles.includes(user.role) && (!customRouteMayBypass || !customRouteAllowed)) return <Navigate to={roleHome(user.role)} replace />
  if (user.mustChangePassword && !impersonating && loc.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <>{children}</>
}
