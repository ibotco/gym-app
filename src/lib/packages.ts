import type { OrganizationSubscription, PackageLimits, SubscriptionPackage } from '../types'
import { addDays, todayIso } from './license'

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
export const PACKAGES_KEY = 'fitpro_sub_packages_v2'
export const ORG_SUBS_KEY = 'fitpro_org_subscriptions_v1'
export const SUB_INVOICES_KEY = 'fitpro_sub_invoices_v1'
export const SUB_HISTORY_KEY = 'fitpro_sub_history_v1'
export const PACKAGE_AUDIT_KEY = 'fitpro_package_audit_v1'

// ---------------------------------------------------------------------------
// Route → module enforcement map (longest prefix wins; paths under /admin)
// ---------------------------------------------------------------------------
export interface PackageModuleDef {
  id: string
  label: string
  group: string
  /** Sidebar keys hidden when the package excludes this module. */
  navKeys: string[]
  /** Admin route prefixes (relative to /admin) governed by this module. */
  routes: string[]
}

/**
 * Full module catalogue of the app — every sidebar area is individually
 * assignable to a package. Grouped for the Package Builder / comparison matrix.
 */
export const PACKAGE_MODULES: PackageModuleDef[] = [
  // Core
  { id: 'overview', label: 'Overview', group: 'Core', navKeys: ['nav.overview'], routes: [] },

  // Organization Management
  { id: 'organizations', label: 'Companies', group: 'Organization Management', navKeys: ['nav.companies'], routes: ['companies'] },
  { id: 'branches', label: 'Branches', group: 'Organization Management', navKeys: ['nav.branches'], routes: ['branches'] },
  { id: 'costCenters', label: 'Cost Centers', group: 'Organization Management', navKeys: ['nav.costCenters'], routes: ['cost-centers'] },

  // People & CRM
  { id: 'members', label: 'Members', group: 'People & CRM', navKeys: ['nav.members', 'nav.imageshop'], routes: ['members', 'imageshop'] },
  { id: 'suppliers', label: 'Suppliers', group: 'People & CRM', navKeys: ['nav.suppliers', 'nav.supplierCategories'], routes: ['suppliers', 'supplier-categories'] },
  { id: 'customers', label: 'Customers', group: 'People & CRM', navKeys: ['nav.customers', 'nav.customerCategories'], routes: ['customers', 'customer-categories'] },
  { id: 'leads', label: 'Leads CRM', group: 'People & CRM', navKeys: ['nav.leads'], routes: ['leads'] },

  // User & Access Management
  { id: 'users', label: 'Users', group: 'User & Access Management', navKeys: ['nav.users'], routes: ['users'] },
  { id: 'roles', label: 'Roles & Permissions', group: 'User & Access Management', navKeys: ['nav.roles'], routes: ['roles'] },
  { id: 'audit', label: 'Audit Logs', group: 'User & Access Management', navKeys: ['nav.audit'], routes: ['audit'] },

  // Human Resources
  { id: 'hrm', label: 'HR Core (Staff & Departments)', group: 'Human Resources', navKeys: ['nav.hrAdmin', 'nav.hrEmployeeAccount', 'nav.employees', 'nav.hrEmployeeProfile', 'nav.departments'], routes: ['hrm', 'staff', 'education', 'employment-status'] },
  { id: 'hrmAttendance', label: 'HR Attendance', group: 'Human Resources', navKeys: ['nav.hrEmployeeAttendance', 'nav.hrAttendanceDashboard', 'nav.hrMarkAttendance', 'nav.staffAttendance', 'nav.hrAttendanceReport'], routes: ['hrm/attendance'] },
  { id: 'hrmShifts', label: 'Shift Management', group: 'Human Resources', navKeys: ['nav.hrShiftManagement', 'nav.hrAssignShift', 'nav.hrShiftPolicies'], routes: ['hrm/attendance/shifts', 'hrm/attendance/shift-policies', 'holidays'] },
  { id: 'hrmTraining', label: 'Training & Trainers', group: 'Human Resources', navKeys: ['nav.hrTraining', 'nav.hrTrainingList', 'nav.trainers', 'nav.hrTrainingFeedback'], routes: ['hrm/training', 'trainers'] },
  { id: 'hrmRecruitment', label: 'Recruitment', group: 'Human Resources', navKeys: ['nav.recruitment'], routes: ['hrm/recruitment'] },
  { id: 'hrmLeave', label: 'Leave Management', group: 'Human Resources', navKeys: ['nav.hrLeaveManagement', 'nav.hrLeaveTypes', 'nav.leave', 'nav.hrLeaveCalendar'], routes: ['hrm/leave'] },
  { id: 'hrmPayroll', label: 'Payroll', group: 'Human Resources', navKeys: ['nav.hrPayroll', 'nav.hrPayrollDashboard', 'nav.hrSalaryBenefits', 'nav.hrSalaryStructure', 'nav.hrAssignSalary', 'nav.hrGenerateSalary', 'nav.hrPaymentCheque', 'nav.hrSalaryPayment'], routes: ['hrm/payroll'] },
  { id: 'hrmPerformance', label: 'Performance', group: 'Human Resources', navKeys: ['nav.performance'], routes: ['hrm/performance'] },
  { id: 'hrmAdvanceSalary', label: 'Advance Salary', group: 'Human Resources', navKeys: ['nav.advanceSalary', 'nav.advanceSalaryManagement', 'nav.advanceSalaryMy'], routes: ['hrm/advance-salary', 'hrm/advance-salary/my'] },
  { id: 'hrmLoans', label: 'Employee Loans', group: 'Human Resources', navKeys: ['nav.hrLoanManagement', 'nav.hrLoanApplications', 'nav.hrLoanInstallments', 'nav.hrLoanSettings'], routes: ['hrm/loans'] },

  // Programs
  { id: 'plans', label: 'Memberships', group: 'Gym Management', navKeys: ['nav.plans'], routes: ['plans'] },
  { id: 'classes', label: 'Classes', group: 'Gym Management', navKeys: ['nav.classes'], routes: ['classes'] },
  { id: 'checkin', label: 'QR Check-in', group: 'Gym Management', navKeys: ['nav.checkin'], routes: ['checkin'] },

  // Finance
  { id: 'accounting', label: 'Accounting', group: 'Finance', navKeys: ['nav.accounting', 'nav.acctSettings', 'nav.receiptVoucher', 'nav.paymentVoucher', 'nav.journalVoucher', 'nav.banking', 'nav.checks', 'nav.accountRegister', 'nav.chartOfAccounts', 'nav.acctMasterAccounts', 'nav.acctAccountsNote', 'nav.bankReconciliation', 'nav.budget', 'nav.valueBook', 'nav.acctReports', 'nav.acctPreviewList', 'nav.acctAccountsReports', 'nav.acctReceiptCashbook', 'nav.acctPaymentCashbook'], routes: ['accounting'] },
  { id: 'payments', label: 'Payments & Invoices', group: 'Finance', navKeys: ['nav.invoices', 'nav.receivePayments'], routes: ['invoices', 'payments', 'receive-payments'] },

  // Sales
  { id: 'pos', label: 'Point of Sale', group: 'Sales', navKeys: ['nav.pos', 'nav.pos2'], routes: ['pos', 'pos2'] },
  { id: 'sales', label: 'Sales & Reports', group: 'Sales', navKeys: ['nav.sales', 'nav.salesList', 'nav.salesReports'], routes: ['sales', 'sales-reports'] },
  { id: 'estimates', label: 'Estimates', group: 'Sales', navKeys: ['nav.estimates'], routes: ['estimates'] },
  { id: 'proposals', label: 'Proposals', group: 'Sales', navKeys: ['nav.proposals'], routes: ['proposals'] },
  { id: 'salesOrders', label: 'Sales Orders', group: 'Sales', navKeys: ['nav.salesOrders'], routes: ['sales-orders'] },
  { id: 'discounts', label: 'Discounts', group: 'Sales', navKeys: ['nav.discounts'], routes: ['discounts'] },
  { id: 'coupons', label: 'Coupons', group: 'Sales', navKeys: ['nav.coupons', 'nav.assignCoupon', 'nav.couponMaster'], routes: ['coupons'] },
  { id: 'fulfillment', label: 'Shipments & Sales Returns', group: 'Sales', navKeys: ['nav.shipments', 'nav.salesReturns'], routes: ['shipments', 'sales-returns'] },

  // Procurement
  { id: 'requisitions', label: 'Purchase Requisitions', group: 'Procurement', navKeys: ['nav.requisitions'], routes: ['purchase-requisitions'] },
  { id: 'procurementOrders', label: 'Procurement Orders', group: 'Procurement', navKeys: ['nav.procurementOrders'], routes: ['procurement-orders'] },
  { id: 'goodsReceipts', label: 'Goods Receipts', group: 'Procurement', navKeys: ['nav.goodsReceipts'], routes: ['goods-receipts'] },
  { id: 'supplierInvoices', label: 'Supplier Invoices', group: 'Procurement', navKeys: ['nav.supplierInvoices'], routes: ['supplier-invoices'] },
  { id: 'supplierPayments', label: 'Supplier Payments', group: 'Procurement', navKeys: ['nav.supplierPayments'], routes: ['supplier-payments'] },
  { id: 'procurementReturns', label: 'Procurement Returns', group: 'Procurement', navKeys: ['nav.procurementReturns'], routes: ['procurement-returns'] },
  { id: 'procurementReports', label: 'Procurement Reports', group: 'Procurement', navKeys: ['nav.procurementReports'], routes: ['procurement-reports', 'purchase-reports'] },

  // Inventory & Assets
  { id: 'inventory', label: 'Inventory', group: 'Inventory & Assets', navKeys: ['nav.inventory', 'nav.invProducts', 'nav.invUpdatePrice', 'nav.invUnits', 'nav.invWarranties', 'nav.invStockTransfer', 'nav.invStockAdjust', 'nav.invStockCount', 'nav.invStockAlerts', 'nav.invReports'], routes: ['inventory'] },
  { id: 'assets', label: 'Assets', group: 'Inventory & Assets', navKeys: ['nav.assets', 'nav.assetsRegister', 'nav.assetDepreciation', 'nav.assetAudit', 'nav.assetTransactions', 'nav.assetConditionSettings', 'nav.assetCategorySettings', 'nav.assetDepreciationPolicy', 'nav.assetReports'], routes: ['assets'] },

  // Projects
  { id: 'projects', label: 'Project Management', group: 'Projects', navKeys: ['nav.projects', 'nav.projectsList', 'nav.projectsContracts', 'nav.projectsTasksAssign', 'nav.projectsTasksTemplate', 'nav.projectsTimesheet', 'nav.projectsInvoice', 'nav.projectsReports', 'nav.projectsSettings', 'nav.projTypes', 'nav.projStatuses', 'nav.projPriorities', 'nav.projCategories', 'nav.projArchive'], routes: ['projects'] },

  // Analytics
  { id: 'reports', label: 'Reports', group: 'Analytics', navKeys: ['nav.reports'], routes: ['reports'] },

  // Communications
  { id: 'notifications', label: 'Notifications', group: 'Communications', navKeys: ['nav.notifications'], routes: ['notifications'] },
  { id: 'events', label: 'Events', group: 'Communications', navKeys: ['nav.events'], routes: ['cms/events'] },
  { id: 'emailTemplates', label: 'Email Templates', group: 'Communications', navKeys: ['nav.emailTemplates'], routes: ['email-templates'] },
  { id: 'smsTemplates', label: 'SMS Templates', group: 'Communications', navKeys: ['nav.smsTemplates'], routes: ['sms-templates'] },

  // Website
  { id: 'frontCms', label: 'Front CMS & Website', group: 'Website', navKeys: ['nav.frontCms', 'nav.cmsSettings', 'nav.cmsMenus', 'nav.cmsSections', 'nav.cmsPages', 'nav.cmsSliders', 'nav.cmsNews', 'nav.cmsServices', 'nav.cmsFeatures', 'nav.cmsTestimonials', 'nav.cmsFaqs', 'nav.cmsGallery', 'nav.cmsSeo'], routes: ['cms'] },

  // Administration
  { id: 'settings', label: 'Settings', group: 'Administration', navKeys: ['nav.settings', 'nav.systemSettings', 'nav.companySettings', 'nav.branchSettings'], routes: ['settings'] },
]

/** Modules grouped in catalogue order — used by the Package Builder and matrix. */
export const PACKAGE_MODULE_GROUPS: { label: string; modules: PackageModuleDef[] }[] = (() => {
  const out: { label: string; modules: PackageModuleDef[] }[] = []
  for (const m of PACKAGE_MODULES) {
    let g = out.find((x) => x.label === m.group)
    if (!g) { g = { label: m.group, modules: [] }; out.push(g) }
    g.modules.push(m)
  }
  return out
})()

export const pkgModuleLabel = (id: string) => PACKAGE_MODULES.find((m) => m.id === id)?.label || id

/** Route → module enforcement map derived from the catalogue (longest prefix wins). */
export const ROUTE_MODULES: [string, string][] = PACKAGE_MODULES.flatMap((m) =>
  m.routes.map((r): [string, string] => [r, m.id]))

/** Module id governing an admin path, or undefined when not module-scoped. */
export function moduleForPath(path: string): string | undefined {
  const rel = path.replace(/^\/admin\//, '').replace(/\/+$/, '')
  let best: string | undefined
  let bestLen = -1
  for (const [prefix, mod] of ROUTE_MODULES) {
    if ((rel === prefix || rel.startsWith(`${prefix}/`)) && prefix.length > bestLen) {
      best = mod
      bestLen = prefix.length
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Limits & seeds
// ---------------------------------------------------------------------------
const UNL = -1
const limits = (over: Partial<PackageLimits>): PackageLimits => ({
  maxUsers: 5, maxEmployees: 10, maxMembers: 200, maxBranches: 1, maxProjects: 3,
  maxInventoryItems: 100, maxAssets: 25, maxMonthlyTransactions: 300, storageMb: 500, ...over,
})

export const SEED_PACKAGES: SubscriptionPackage[] = [
  {
    id: 'pkg_starter', name: 'Starter Package', tier: 'starter',
    description: 'Everything a single club needs to run members and payments.',
    modules: ['overview', 'organizations', 'members', 'customers', 'plans', 'payments', 'reports', 'notifications', 'settings'],
    limits: limits({}),
    pricing: { monthly: 300, quarterly: 810, annual: 3000, setupFee: 150, trialDays: 14, graceDays: 7 },
    perks: ['1 branch', '200 members', 'Email support'],
    active: true, createdAt: '2024-01-01',
  },
  {
    id: 'pkg_professional', name: 'Professional Package', tier: 'professional',
    description: 'Starter plus full finance, stock and sales operations.',
    modules: [...['overview', 'organizations', 'members', 'customers', 'plans', 'payments', 'reports', 'notifications', 'settings'], 'users', 'roles', 'audit', 'accounting', 'inventory', 'pos', 'sales', 'estimates', 'proposals', 'salesOrders', 'discounts', 'coupons', 'fulfillment', 'requisitions', 'procurementOrders', 'goodsReceipts', 'supplierInvoices', 'supplierPayments', 'procurementReturns', 'procurementReports', 'suppliers', 'checkin'],
    limits: limits({ maxUsers: 15, maxEmployees: 40, maxMembers: 1000, maxBranches: 3, maxProjects: 10, maxInventoryItems: 1000, maxAssets: 100, maxMonthlyTransactions: 2000, storageMb: 2048 }),
    pricing: { monthly: 650, quarterly: 1750, annual: 6500, setupFee: 250, trialDays: 14, graceDays: 7 },
    perks: ['3 branches', 'POS, sales & procurement', 'QR check-in', 'Audit logs'],
    active: true, createdAt: '2024-01-01',
  },
  {
    id: 'pkg_business', name: 'Business Package', tier: 'business',
    description: 'Professional plus HR, assets, classes and CRM.',
    modules: [...['overview', 'organizations', 'members', 'customers', 'plans', 'payments', 'reports', 'notifications', 'settings'], 'users', 'roles', 'audit', 'accounting', 'inventory', 'pos', 'sales', 'estimates', 'proposals', 'salesOrders', 'discounts', 'coupons', 'fulfillment', 'requisitions', 'procurementOrders', 'goodsReceipts', 'supplierInvoices', 'supplierPayments', 'procurementReturns', 'procurementReports', 'suppliers', 'checkin', 'branches', 'costCenters', 'leads', 'classes', 'assets', 'projects', 'hrm', 'hrmAttendance', 'hrmShifts', 'hrmTraining', 'hrmRecruitment', 'hrmLeave', 'hrmPayroll', 'hrmPerformance', 'hrmAdvanceSalary', 'hrmLoans', 'events', 'emailTemplates', 'smsTemplates'],
    limits: limits({ maxUsers: 50, maxEmployees: 150, maxMembers: 5000, maxBranches: 10, maxProjects: 50, maxInventoryItems: 5000, maxAssets: 500, maxMonthlyTransactions: 10000, storageMb: 10240 }),
    pricing: { monthly: 1100, quarterly: 2970, annual: 11000, setupFee: 400, trialDays: 14, graceDays: 14 },
    perks: ['10 branches', 'Full HR & payroll', 'Leads CRM', 'Projects & assets'],
    active: true, createdAt: '2024-01-01',
  },
  {
    id: 'pkg_enterprise', name: 'Enterprise Package', tier: 'enterprise',
    description: 'Full access to all modules with unlimited scale.',
    modules: PACKAGE_MODULES.map((m) => m.id),
    limits: limits({ maxUsers: UNL, maxEmployees: UNL, maxMembers: UNL, maxBranches: UNL, maxProjects: UNL, maxInventoryItems: UNL, maxAssets: UNL, maxMonthlyTransactions: UNL, storageMb: 102400 }),
    pricing: { monthly: 2200, quarterly: 5940, annual: 22000, setupFee: 0, trialDays: 30, graceDays: 30 },
    perks: ['Unlimited users & branches', 'Advanced reports', 'Full audit tracking', 'API access'],
    active: true, createdAt: '2024-01-01',
  },
]

export function seedOrgSubscription(companyId: string): OrganizationSubscription {
  const start = todayIso()
  return {
    id: `orgsub_${companyId}`, companyId, packageId: 'pkg_enterprise', packageName: 'Enterprise Package',
    status: 'active', billingCycle: 'annual', activationDate: start,
    expiryDate: addDays(start, 365), renewalDate: addDays(start, 365),
  }
}

// ---------------------------------------------------------------------------
// Lifecycle math
// ---------------------------------------------------------------------------
export function effectiveOrgStatus(sub: OrganizationSubscription, graceDays: number): OrganizationSubscription['status'] {
  if (sub.status === 'suspended' || sub.status === 'cancelled') return sub.status
  const t = todayIso()
  if (sub.expiryDate >= t) return sub.status === 'trial' ? 'trial' : 'active'
  if (sub.status === 'trial') return 'expired'
  return addDays(sub.expiryDate, graceDays) >= t ? 'grace' : 'expired'
}

export const ORG_SUB_ACTIVE: ReadonlyArray<OrganizationSubscription['status']> = ['trial', 'active', 'grace']

// ---------------------------------------------------------------------------
// Usage & downgrade validation
// ---------------------------------------------------------------------------
export interface UsageSnapshot {
  users: number; employees: number; members: number; branches: number; projects: number
  inventoryItems: number; assets: number; monthlyTransactions: number; storageMb: number
}

export interface LimitRow { key: keyof UsageSnapshot; label: string; limit: number }

export function limitRows(l: PackageLimits): LimitRow[] {
  return [
    { key: 'users', label: 'Users', limit: l.maxUsers },
    { key: 'employees', label: 'Employees', limit: l.maxEmployees },
    { key: 'members', label: 'Members', limit: l.maxMembers },
    { key: 'branches', label: 'Branches', limit: l.maxBranches },
    { key: 'projects', label: 'Projects', limit: l.maxProjects },
    { key: 'inventoryItems', label: 'Inventory items', limit: l.maxInventoryItems },
    { key: 'assets', label: 'Assets', limit: l.maxAssets },
    { key: 'monthlyTransactions', label: 'Monthly transactions', limit: l.maxMonthlyTransactions },
    { key: 'storageMb', label: 'Storage (MB)', limit: l.storageMb },
  ]
}

/** Reasons a downgrade (or any package change) must be blocked. */
export function downgradeBlockers(usage: UsageSnapshot, target: SubscriptionPackage): string[] {
  const out: string[] = []
  for (const row of limitRows(target.limits)) {
    const used = usage[row.key]
    if (row.limit !== -1 && used > row.limit) out.push(`${row.label}: using ${used}, ${target.name} allows ${row.limit}.`)
  }
  return out
}

/** Simple proration credit for the unused part of the current cycle. */
export function prorationCredit(cyclePrice: number, cycleDays: number, daysLeft: number): number {
  return Math.round((cyclePrice / cycleDays) * Math.max(0, daysLeft) * 100) / 100
}

export const cycleDays = (cycle: 'monthly' | 'quarterly' | 'annual') => (cycle === 'monthly' ? 30 : cycle === 'quarterly' ? 90 : 365)
export const cyclePrice = (p: SubscriptionPackage, cycle: 'monthly' | 'quarterly' | 'annual') =>
  cycle === 'monthly' ? p.pricing.monthly : cycle === 'quarterly' ? p.pricing.quarterly : p.pricing.annual

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------
function load<T>(key: string, seed: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) return JSON.parse(raw) as T
  } catch { /* fall through */ }
  return seed
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

export const loadPackages = () => load<SubscriptionPackage[]>(PACKAGES_KEY, SEED_PACKAGES)
export const savePackages = (v: SubscriptionPackage[]) => save(PACKAGES_KEY, v)
export const loadOrgSubs = (defaultCompanyId: string) => load<OrganizationSubscription[]>(ORG_SUBS_KEY, [seedOrgSubscription(defaultCompanyId)])
export const saveOrgSubs = (v: OrganizationSubscription[]) => save(ORG_SUBS_KEY, v)
export const loadSubInvoices = () => load<import('../types').SubscriptionInvoice[]>(SUB_INVOICES_KEY, [])
export const saveSubInvoices = (v: import('../types').SubscriptionInvoice[]) => save(SUB_INVOICES_KEY, v)
export const loadSubHistory = () => load<import('../types').SubscriptionHistoryEvent[]>(SUB_HISTORY_KEY, [])
export const saveSubHistory = (v: import('../types').SubscriptionHistoryEvent[]) => save(SUB_HISTORY_KEY, v)
export const loadPackageAudit = () => load<import('../types').PackageAuditLog[]>(PACKAGE_AUDIT_KEY, [])
export const savePackageAudit = (v: import('../types').PackageAuditLog[]) => save(PACKAGE_AUDIT_KEY, v)
