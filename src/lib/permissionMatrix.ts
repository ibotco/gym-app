import type { RoleDef } from '../types'

// Granular permission matrix: each module (main menu) contains submenu rows,
// and each row can be granted View / Create / Edit / Delete independently.
// This is stored separately from the role.permissions[] string list.

export interface MatrixRow {
  key: string
  label: string
}

export interface MatrixModule {
  key: string
  label: string
  rows: MatrixRow[]
}

export const MATRIX_KEY = 'fitpro_permission_matrix'

export const PERMISSION_MATRIX: MatrixModule[] = [
  {
    key: 'system', label: 'System Management',
    rows: [
      { key: 'system.appDetails', label: 'App Details' },
      { key: 'system.branchSettings', label: 'Branch Settings' },
      { key: 'system.database', label: 'Database Utilities' },
      { key: 'system.language', label: 'Language' },
      { key: 'system.modules', label: 'Modules' },
      { key: 'system.sidebarMenu', label: 'Sidebar Menu' },
      { key: 'system.frontCms', label: 'Front CMS Setting' },
    ],
  },
  {
    key: 'organization', label: 'Organization',
    rows: [
      { key: 'org.state', label: 'State/Region' },
      { key: 'org.company', label: 'Company' },
      { key: 'org.branch', label: 'Branch' },
      { key: 'org.department', label: 'Department' },
      { key: 'org.location', label: 'Location' },
    ],
  },
  {
    key: 'users', label: 'User Management',
    rows: [
      { key: 'users.list', label: 'All users' },
      { key: 'users.roles', label: 'Roles & permissions' },
    ],
  },
  {
    key: 'people', label: 'People',
    rows: [
      { key: 'people.members', label: 'Members' },
      { key: 'people.suppliers', label: 'Supplier Management' },
      { key: 'people.supplierCategories', label: 'Supplier Categories' },
      { key: 'people.customers', label: 'Customer Management' },
      { key: 'people.customerCategories', label: 'Customer Categories' },
    ],
  },
  {
    key: 'accounting', label: 'Accounting',
    rows: [
      { key: 'acct.settings', label: 'Accounting Settings' },
      { key: 'acct.receiptVoucher', label: 'Receipt Voucher' },
      { key: 'acct.paymentVoucher', label: 'Payment Voucher' },
      { key: 'acct.journalVoucher', label: 'Journal Voucher' },
      { key: 'acct.banking', label: 'Banking' },
      { key: 'acct.register', label: 'Account Register' },
      { key: 'acct.chartOfAccounts', label: 'Chart of Accounts' },
      { key: 'acct.reconciliation', label: 'Bank Reconciliation' },
      { key: 'acct.budget', label: 'Budget' },
      { key: 'acct.valueBook', label: 'Value Book Register' },
      { key: 'acct.reports', label: 'Accounting Reports' },
    ],
  },
  {
    key: 'approvals', label: 'Approvals',
    rows: [{ key: 'approvals.requests', label: 'Approval Requests' }],
  },
  {
    key: 'inventory', label: 'Inventory',
    rows: [
      { key: 'inventory.items', label: 'Items' },
      { key: 'inventory.suppliers', label: 'Suppliers' },
      { key: 'inventory.categories', label: 'Categories' },
      { key: 'inventory.movements', label: 'Movements' },
    ],
  },
  {
    key: 'subscriptions', label: 'Subscriptions',
    rows: [
      { key: 'subs.plans', label: 'Memberships' },
      { key: 'subs.pricing', label: 'Pricing' },
    ],
  },
  {
    key: 'sales', label: 'Sales',
    rows: [
      { key: 'sales.history', label: 'Sales History' },
      { key: 'sales.pos', label: 'Point of Sale' },
      { key: 'sales.proposals', label: 'Proposals' },
      { key: 'sales.estimates', label: 'Estimates' },
      { key: 'sales.orders', label: 'Sales Orders' },
      { key: 'sales.invoices', label: 'Invoices' },
      { key: 'sales.shipments', label: 'Shipments' },
      { key: 'sales.discounts', label: 'Discounts' },
      { key: 'sales.returns', label: 'Sales Returns' },
      { key: 'sales.reports', label: 'Sales Reports' },
    ],
  },
  {
    key: 'purchases', label: 'Purchases',
    rows: [
      { key: 'pur.orders', label: 'Purchase Orders' },
      { key: 'pur.history', label: 'Purchases History' },
      { key: 'pur.returns', label: 'Purchase Returns' },
      { key: 'pur.reports', label: 'Purchase Reports' },
    ],
  },
  {
    key: 'hrm', label: 'Human Resource',
    rows: [
      { key: 'hrm.employees', label: 'Employees' },
      { key: 'hrm.departments', label: 'Departments' },
      { key: 'hrm.leave', label: 'Leave' },
      { key: 'hrm.attendance', label: 'Staff Attendance' },
      { key: 'hrm.payroll', label: 'Payroll' },
      { key: 'hrm.recruitment', label: 'Recruitment' },
      { key: 'hrm.performance', label: 'Performance' },
    ],
  },
  {
    key: 'assets', label: 'Asset Management',
    rows: [
      { key: 'assets.register', label: 'Asset Register' },
      { key: 'assets.depreciation', label: 'Asset Depreciation' },
      { key: 'assets.transactions', label: 'Asset Transactions' },
      { key: 'assets.setup', label: 'Asset Setup' },
      { key: 'assets.reports', label: 'Asset Reports' },
    ],
  },
  {
    key: 'communication', label: 'Communication',
    rows: [
      { key: 'comm.notifications', label: 'Notifications' },
      { key: 'comm.messages', label: 'Messages' },
    ],
  },
  {
    key: 'reports', label: 'Reports',
    rows: [
      { key: 'reports.dashboard', label: 'Reports Dashboard' },
      { key: 'reports.financial', label: 'Financial Reports' },
    ],
  },
]

export type MatrixActions = {
  view: boolean
  create: boolean
  edit: boolean
  delete: boolean
}

export type MatrixState = Record<string, Record<string, MatrixActions>>

export function defaultMatrixState(): MatrixState {
  return {}
}

type MatrixStore = {
  global: MatrixState
  scopes: Record<string, MatrixState>
}

function isMatrixStore(value: unknown): value is MatrixStore {
  return Boolean(value && typeof value === 'object' && 'global' in value && 'scopes' in value)
}

/**
 * Matrix settings use the same tenant boundary as role definitions. The old
 * flat format is retained as the global Super Admin matrix during migration;
 * tenant admins get a separate scope instead of inheriting another company's
 * matrix edits.
 */
export function loadMatrix(scope = 'global'): MatrixState {
  try {
    const raw = localStorage.getItem(MATRIX_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (isMatrixStore(parsed)) return scope === 'global' ? parsed.global || {} : parsed.scopes[scope] || {}
    return scope === 'global' ? parsed as MatrixState : {}
  } catch { /* ignore */ }
  return {}
}

export function saveMatrix(state: MatrixState, scope = 'global') {
  try {
    const raw = localStorage.getItem(MATRIX_KEY)
    const parsed = raw ? JSON.parse(raw) as unknown : undefined
    const store: MatrixStore = isMatrixStore(parsed)
      ? { global: parsed.global || {}, scopes: { ...parsed.scopes } }
      : { global: parsed ? parsed as MatrixState : {}, scopes: {} }
    if (scope === 'global') store.global = state
    else store.scopes[scope] = state
    localStorage.setItem(MATRIX_KEY, JSON.stringify(store))
  } catch { /* ignore */ }
}

/** Empty action set. */
export function emptyActions(): MatrixActions {
  return { view: false, create: false, edit: false, delete: false }
}

/** True if the signed-in role may manage the company-scoped matrix. */
export function canEditMatrix(role: RoleDef | null | undefined): boolean {
  return !!role && (role.id === 'super_admin' || role.id === 'company_admin' || (!!role.companyId && role.permissions.includes('roles.manage')))
}
