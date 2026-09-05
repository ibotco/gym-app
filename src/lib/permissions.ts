import type { Permission, RoleDef } from '../types'

export const ROLE_STORE_KEY = 'fitpro_roles'
export const PERM_STORE_KEY = 'fitpro_permissions'

// Ordered permission groups used to render the matrix.
export const PERMISSION_GROUPS = [
  'Dashboard',
  'Users',
  'Roles & Permissions',
  'People',
  'Human Resources',
  'Companies',
  'Branches',
  'Memberships',
  'Accounting',
  'Inventory',
  'Assets',
  'Sales',
  'Purchases',
  'Classes',
  'Payments',
  'Reports',
  'Leads',
  'Notifications',
  'Check-in',
  'Audit',
  'Settings',
  'Coach portal',
  'Member portal',
  'Customer portal',
  'Supplier portal',
]

/** Portal-specific permission group names. */
const PORTAL_GROUP_NAMES: Record<RoleDef['portal'], string> = {
  admin: '',
  coach: 'Coach portal',
  member: 'Member portal',
  customer: 'Customer portal',
  supplier: 'Supplier portal',
}

/**
 * Which permission groups are relevant to a given portal.
 * - Admin shows everything except other portals' groups.
 * - Other portals show only their own group.
 */
export function portalGroups(portal: RoleDef['portal']): string[] {
  if (portal === 'admin') {
    const portalGroups = new Set(['Coach portal', 'Member portal', 'Customer portal', 'Supplier portal'])
    return PERMISSION_GROUPS.filter((g) => !portalGroups.has(g))
  }
  const own = PORTAL_GROUP_NAMES[portal]
  return own ? [own] : []
}

export const BUILTIN_PERMISSIONS: Permission[] = [
  // Dashboard
  { key: 'dashboard.view', label: 'View dashboard', group: 'Dashboard', builtin: true },
  { key: 'analytics.view', label: 'View analytics', group: 'Dashboard', builtin: true },

  // Users
  { key: 'users.view', label: 'View users', group: 'Users', builtin: true },
  { key: 'users.manage', label: 'Manage users', group: 'Users', builtin: true },
  { key: 'users.delete', label: 'Delete users', group: 'Users', builtin: true },

  // Roles & permissions
  { key: 'roles.view', label: 'View roles & permissions', group: 'Roles & Permissions', builtin: true },
  { key: 'roles.manage', label: 'Manage roles & permissions', group: 'Roles & Permissions', builtin: true },

  // People — members
  { key: 'members.view', label: 'View members', group: 'People', builtin: true },
  { key: 'members.manage', label: 'Manage members', group: 'People', builtin: true },
  { key: 'members.delete', label: 'Delete members', group: 'People', builtin: true },
  { key: 'members.credentials', label: 'Manage member credentials', group: 'People', builtin: true },
  // People — suppliers
  { key: 'suppliers.view', label: 'View suppliers', group: 'People', builtin: true },
  { key: 'suppliers.manage', label: 'Manage suppliers', group: 'People', builtin: true },
  { key: 'suppliers.delete', label: 'Delete suppliers', group: 'People', builtin: true },
  // People — supplier categories
  { key: 'supplierCategories.view', label: 'View supplier categories', group: 'People', builtin: true },
  { key: 'supplierCategories.manage', label: 'Manage supplier categories', group: 'People', builtin: true },
  { key: 'supplierCategories.delete', label: 'Delete supplier categories', group: 'People', builtin: true },
  // People — customers
  { key: 'customers.view', label: 'View customers', group: 'People', builtin: true },
  { key: 'customers.manage', label: 'Manage customers', group: 'People', builtin: true },
  { key: 'customers.delete', label: 'Delete customers', group: 'People', builtin: true },
  // People — customer categories
  { key: 'customerCategories.view', label: 'View customer categories', group: 'People', builtin: true },
  { key: 'customerCategories.manage', label: 'Manage customer categories', group: 'People', builtin: true },
  { key: 'customerCategories.delete', label: 'Delete customer categories', group: 'People', builtin: true },

  // Human Resources — employees
  { key: 'staff.view', label: 'View employees', group: 'Human Resources', builtin: true },
  { key: 'staff.manage', label: 'Manage employees', group: 'Human Resources', builtin: true },
  // Human Resources — departments
  { key: 'departments.view', label: 'View departments', group: 'Human Resources', builtin: true },
  { key: 'departments.manage', label: 'Manage departments', group: 'Human Resources', builtin: true },
  // Human Resources — leave
  { key: 'leave.view', label: 'View leave requests', group: 'Human Resources', builtin: true },
  { key: 'leave.manage', label: 'Manage leave requests', group: 'Human Resources', builtin: true },
  // Human Resources — attendance
  { key: 'attendance.view', label: 'View staff attendance', group: 'Human Resources', builtin: true },
  { key: 'attendance.manage', label: 'Manage staff attendance', group: 'Human Resources', builtin: true },
  // Human Resources — payroll
  { key: 'payroll.view', label: 'View payroll', group: 'Human Resources', builtin: true },
  { key: 'payroll.manage', label: 'Manage payroll', group: 'Human Resources', builtin: true },
  // Human Resources — recruitment
  { key: 'recruitment.view', label: 'View recruitment', group: 'Human Resources', builtin: true },
  { key: 'recruitment.manage', label: 'Manage recruitment', group: 'Human Resources', builtin: true },
  // Human Resources — performance
  { key: 'performance.view', label: 'View performance reviews', group: 'Human Resources', builtin: true },
  { key: 'performance.manage', label: 'Manage performance reviews', group: 'Human Resources', builtin: true },

  // Companies (multi-tenant)
  { key: 'companies.view', label: 'View companies', group: 'Companies', builtin: true },
  { key: 'companies.manage', label: 'Manage companies', group: 'Companies', builtin: true },
  { key: 'companies.delete', label: 'Delete companies', group: 'Companies', builtin: true },

  // Branches
  { key: 'branches.view', label: 'View branches', group: 'Branches', builtin: true },
  { key: 'branches.manage', label: 'Manage branches', group: 'Branches', builtin: true },
  // Cost Centers
  { key: 'costCenters.view', label: 'View cost centers', group: 'Cost Centers', builtin: true },
  { key: 'costCenters.manage', label: 'Manage cost centers', group: 'Cost Centers', builtin: true },
  // Memberships (plans)
  { key: 'plans.view', label: 'View memberships', group: 'Memberships', builtin: true },
  { key: 'plans.manage', label: 'Manage memberships & pricing', group: 'Memberships', builtin: true },

  // Accounting submenus
  { key: 'accounting.settings', label: 'Accounting settings', group: 'Accounting', builtin: true },
  { key: 'accounting.receiptVoucher', label: 'Receipt voucher', group: 'Accounting', builtin: true },
  { key: 'accounting.paymentVoucher', label: 'Payment voucher', group: 'Accounting', builtin: true },
  { key: 'accounting.journalVoucher', label: 'Journal voucher', group: 'Accounting', builtin: true },
  { key: 'accounting.banking', label: 'Banking', group: 'Accounting', builtin: true },
  { key: 'accounting.register', label: 'Account register', group: 'Accounting', builtin: true },
  { key: 'accounting.chartOfAccounts', label: 'Chart of accounts', group: 'Accounting', builtin: true },
  { key: 'accounting.reconciliation', label: 'Bank reconciliation', group: 'Accounting', builtin: true },
  { key: 'accounting.budget', label: 'Budget', group: 'Accounting', builtin: true },
  { key: 'accounting.valueBook', label: 'Value book register', group: 'Accounting', builtin: true },
  { key: 'accounting.reports', label: 'Accounting reports', group: 'Accounting', builtin: true },

  // Inventory
  { key: 'inventory.view', label: 'View inventory', group: 'Inventory', builtin: true },
  { key: 'inventory.manage', label: 'Manage inventory & stock', group: 'Inventory', builtin: true },
  { key: 'pos.use', label: 'Use point of sale', group: 'Inventory', builtin: true },

  // Assets submenus
  { key: 'assets.register', label: 'Asset register', group: 'Assets', builtin: true },
  { key: 'assets.depreciation', label: 'Asset depreciation', group: 'Assets', builtin: true },
  { key: 'assets.transactions', label: 'Asset transactions', group: 'Assets', builtin: true },
  { key: 'assets.setup', label: 'Asset setup', group: 'Assets', builtin: true },
  { key: 'assets.reports', label: 'Asset reports', group: 'Assets', builtin: true },

  // Sales submenus
  { key: 'sales.list', label: 'Sales history', group: 'Sales', builtin: true },
  { key: 'sales.pos', label: 'Point of sale', group: 'Sales', builtin: true },
  { key: 'sales.proposals', label: 'Proposals', group: 'Sales', builtin: true },
  { key: 'sales.estimates', label: 'Estimates', group: 'Sales', builtin: true },
  { key: 'sales.orders', label: 'Sales orders', group: 'Sales', builtin: true },
  { key: 'sales.invoices', label: 'Invoices', group: 'Sales', builtin: true },
  { key: 'sales.shipments', label: 'Shipments', group: 'Sales', builtin: true },
  { key: 'sales.discounts', label: 'Discounts', group: 'Sales', builtin: true },
  { key: 'sales.returns', label: 'Sales returns', group: 'Sales', builtin: true },
  { key: 'sales.reports', label: 'Sales reports', group: 'Sales', builtin: true },

  // Purchases submenus
  { key: 'purchases.orders', label: 'Purchase orders', group: 'Purchases', builtin: true },
  { key: 'purchases.requisitions', label: 'Purchase requisitions', group: 'Purchases', builtin: true },
  { key: 'purchases.goodsreceipts', label: 'Goods receipts (GRN)', group: 'Purchases', builtin: true },
  { key: 'purchases.supplierinvoices', label: 'Purchase invoices', group: 'Purchases', builtin: true },
  { key: 'purchases.supplierpayments', label: 'Supplier payments', group: 'Purchases', builtin: true },
  { key: 'purchases.list', label: 'Purchases history', group: 'Purchases', builtin: true },
  { key: 'purchases.returns', label: 'Purchase returns', group: 'Purchases', builtin: true },
  { key: 'purchases.reports', label: 'Purchase reports', group: 'Purchases', builtin: true },

  // Classes
  { key: 'classes.view', label: 'View classes', group: 'Classes', builtin: true },
  { key: 'classes.manage', label: 'Manage classes & timetable', group: 'Classes', builtin: true },

  // Payments
  { key: 'payments.view', label: 'View payments', group: 'Payments', builtin: true },
  { key: 'payments.manage', label: 'Record payments', group: 'Payments', builtin: true },
  { key: 'payments.refund', label: 'Process refunds', group: 'Payments', builtin: true },

  // Reports
  { key: 'reports.view', label: 'View reports & export', group: 'Reports', builtin: true },

  // Leads
  { key: 'leads.view', label: 'View leads', group: 'Leads', builtin: true },
  { key: 'leads.manage', label: 'Manage leads CRM', group: 'Leads', builtin: true },

  // Notifications
  { key: 'notifications.manage', label: 'Send notifications & batch expiry', group: 'Notifications', builtin: true },

  // Check-in
  { key: 'checkin.use', label: 'QR check-in desk', group: 'Check-in', builtin: true },

  // Audit
  { key: 'audit.view', label: 'View audit log', group: 'Audit', builtin: true },

  // Integrations
  { key: 'integrations.manage', label: 'Manage integrations', group: 'Settings', builtin: true },

  // Settings
  { key: 'settings.manage', label: 'Manage system settings', group: 'Settings', builtin: true },

  // Coach portal
  { key: 'coach.dashboard', label: 'Coach dashboard', group: 'Coach portal', builtin: true },
  { key: 'coach.members', label: 'Assigned members', group: 'Coach portal', builtin: true },
  { key: 'coach.workouts', label: 'Publish workouts', group: 'Coach portal', builtin: true },
  { key: 'coach.classes', label: 'Class attendance', group: 'Coach portal', builtin: true },
  { key: 'coach.messages', label: 'Member messaging', group: 'Coach portal', builtin: true },

  // Member portal
  { key: 'member.dashboard', label: 'Member dashboard', group: 'Member portal', builtin: true },
  { key: 'member.classes', label: 'Book classes', group: 'Member portal', builtin: true },
  { key: 'member.training', label: 'Training & progress', group: 'Member portal', builtin: true },
  { key: 'member.payments', label: 'Payments & invoices', group: 'Member portal', builtin: true },
  { key: 'member.card', label: 'Digital membership card', group: 'Member portal', builtin: true },

  // Customer portal
  { key: 'customer.dashboard', label: 'Customer dashboard', group: 'Customer portal', builtin: true },
  { key: 'customer.invoices', label: 'View invoices & statements', group: 'Customer portal', builtin: true },

  // Supplier portal
  { key: 'supplier.dashboard', label: 'Supplier dashboard', group: 'Supplier portal', builtin: true },
  { key: 'supplier.orders', label: 'View purchase orders', group: 'Supplier portal', builtin: true },
]

const ALL_KEYS = BUILTIN_PERMISSIONS.map((p) => p.key)
const PORTAL_GROUPS = new Set(['Coach portal', 'Member portal', 'Customer portal', 'Supplier portal'])
const ADMIN_KEYS = BUILTIN_PERMISSIONS.filter((p) => !PORTAL_GROUPS.has(p.group)).map((p) => p.key)

export const BUILTIN_ROLES: RoleDef[] = [
  {
    id: 'super_admin',
    name: 'Super Admin',
    description: 'Full platform control, including audit and roles.',
    portal: 'admin',
    builtin: true,
    color: '#C8F542',
    permissions: [...ALL_KEYS],
  },
  {
    id: 'gym_manager',
    name: 'Gym Manager',
    description: 'Operations and analytics — view, create and edit, without delete or audit.',
    portal: 'admin',
    builtin: true,
    color: '#38BDF8',
    permissions: ADMIN_KEYS.filter((k) => k !== 'audit.view' && !k.endsWith('.delete')),
  },
  {
    id: 'company_admin',
    name: 'Company Admin',
    description: 'Full control over a single company, including its branches and settings.',
    portal: 'admin',
    builtin: true,
    color: '#22C55E',
    permissions: [...ADMIN_KEYS],
  },
  {
    id: 'head_office',
    name: 'Head Office',
    description: 'Consolidated, read-mostly view across every branch of the company.',
    portal: 'admin',
    builtin: true,
    color: '#0EA5E9',
    permissions: ADMIN_KEYS.filter((k) => k !== 'audit.view' && !k.endsWith('.delete')),
  },
  {
    id: 'branch_admin',
    name: 'Branch Admin',
    description: 'Manages a single assigned branch — sees only that branch\'s data.',
    portal: 'admin',
    builtin: true,
    color: '#8B5CF6',
    permissions: ADMIN_KEYS.filter(
      (k) => k !== 'audit.view' && !k.endsWith('.delete') && !k.startsWith('companies.'),
    ),
  },
  {
    id: 'receptionist',
    name: 'Receptionist',
    description: 'Front desk — member records, check-in, classes and payments.',
    portal: 'admin',
    builtin: true,
    color: '#F43F5E',
    permissions: [
      'dashboard.view',
      'members.view',
      'members.manage',
      'members.credentials',
      'classes.view',
      'payments.view',
      'leads.view',
      'leads.manage',
      'checkin.use',
      'inventory.view',
      'pos.use',
    ],
  },
  {
    id: 'accountant',
    name: 'Accountant',
    description: 'Finance — view members, manage suppliers and customers.',
    portal: 'admin',
    builtin: true,
    color: '#F59E0B',
    permissions: [
      'dashboard.view',
      'analytics.view',
      'members.view',
      'suppliers.view',
      'suppliers.manage',
      'customers.view',
      'customers.manage',
      'supplierCategories.view',
      'supplierCategories.manage',
      'customerCategories.view',
      'customerCategories.manage',
      'accounting.settings',
      'accounting.receiptVoucher',
      'accounting.paymentVoucher',
      'accounting.journalVoucher',
      'accounting.banking',
      'accounting.register',
      'accounting.chartOfAccounts',
      'accounting.reconciliation',
      'accounting.budget',
      'accounting.valueBook',
      'accounting.reports',
      'assets.register',
      'assets.depreciation',
      'assets.transactions',
      'assets.setup',
      'assets.reports',
      'payments.view',
      'payments.manage',
      'payments.refund',
      'reports.view',
      'inventory.view',
    ],
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Front desk, member records, and check-in.',
    portal: 'admin',
    builtin: true,
    color: '#FBBF24',
    permissions: [
      'dashboard.view',
      'members.view',
      'members.manage',
      'members.credentials',
      'classes.view',
      'payments.view',
      'leads.view',
      'leads.manage',
      'checkin.use',
      'inventory.view',
      'inventory.manage',
      'pos.use',
    ],
  },
  {
    id: 'trainer',
    name: 'Trainer',
    description: 'Coaching portal — schedule, members, workouts, messaging.',
    portal: 'coach',
    builtin: true,
    color: '#A78BFA',
    permissions: ['coach.dashboard', 'coach.members', 'coach.workouts', 'coach.classes', 'coach.messages'],
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Member app — booking, progress, payments, digital card.',
    portal: 'member',
    builtin: true,
    color: '#34D399',
    permissions: ['member.dashboard', 'member.classes', 'member.training', 'member.payments', 'member.card'],
  },
  {
    id: 'customer',
    name: 'Customer',
    description: 'Customer portal — invoices and statements.',
    portal: 'customer',
    builtin: true,
    color: '#FB7185',
    permissions: ['customer.dashboard', 'customer.invoices'],
  },
  {
    id: 'supplier',
    name: 'Supplier',
    description: 'Supplier portal — purchase orders and deliveries.',
    portal: 'supplier',
    builtin: true,
    color: '#22D3EE',
    permissions: ['supplier.dashboard', 'supplier.orders'],
  },
]

export function loadPermissions(): Permission[] {
  try {
    const raw = localStorage.getItem(PERM_STORE_KEY)
    const saved = raw ? (JSON.parse(raw) as Permission[]) : []
    const byKey = new Map(saved.map((p) => [p.key, p]))
    // Platform permissions are always global and protected. A stale or
    // hand-edited localStorage entry must not turn a built-in permission into
    // a tenant-owned record or remove its built-in flag.
    const merged: Permission[] = BUILTIN_PERMISSIONS.map((b) => ({ ...b, ...(byKey.get(b.key) || {}), builtin: true, companyId: undefined }))
    for (const p of saved) if (!BUILTIN_PERMISSIONS.some((b) => b.key === p.key)) merged.push(p)
    return merged
  } catch {
    return [...BUILTIN_PERMISSIONS]
  }
}

export function loadRoles(): RoleDef[] {
  try {
    const raw = localStorage.getItem(ROLE_STORE_KEY)
    const saved = raw ? (JSON.parse(raw) as RoleDef[]) : []
    const byId = new Map(saved.map((r) => [r.id, r]))
    // Platform roles are global and protected. Custom records keep their
    // companyId so the application can isolate them by the signed-in user's
    // company without losing older global custom roles.
    const merged: RoleDef[] = BUILTIN_ROLES.map((b) => ({ ...b, ...(byId.get(b.id) || {}), builtin: true, companyId: undefined }))
    for (const r of saved) if (!BUILTIN_ROLES.some((b) => b.id === r.id)) merged.push(r)
    return merged
  } catch {
    return [...BUILTIN_ROLES]
  }
}

export function savePermissions(list: Permission[]) {
  try { localStorage.setItem(PERM_STORE_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function saveRoles(list: RoleDef[]) {
  try { localStorage.setItem(ROLE_STORE_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

export function slugifyRole(name: string) {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
  return `role_${base || 'custom'}`
}

export function roleName(roleId: string, roles: RoleDef[] = []): string {
  const def = roles.find((r) => r.id === roleId)
  if (def) return def.name
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    gym_manager: 'Gym Manager',
    company_admin: 'Company Admin',
    branch_admin: 'Branch Admin',
    head_office: 'Head Office',
    receptionist: 'Receptionist',
    accountant: 'Accountant',
    staff: 'Staff',
    trainer: 'Trainer',
    member: 'Member',
    customer: 'Customer',
    supplier: 'Supplier',
  }
  return map[roleId] || roleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
