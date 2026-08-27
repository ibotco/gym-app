// System module registry — controls which top-level modules appear in the
// sidebar. Each module maps to one or more sidebar nav keys; disabling a
// module hides those nav entries for every user.

export interface ModuleDef {
  id: string
  label: string
  description: string
  /** Sidebar nav keys this module controls (top-level links/groups or children). */
  navKeys: string[]
  defaultEnabled: boolean
}

export const MODULES_KEY = 'fitpro_modules'
export const SIDEBAR_ORDER_KEY = 'fitpro_sidebar_order'

export const MODULES: ModuleDef[] = [
  { id: 'overview', label: 'Overview', description: 'Dashboard and key performance metrics.', navKeys: ['nav.overview'], defaultEnabled: true },
  { id: 'branches', label: 'Branches', description: 'Club locations and multi-club performance.', navKeys: ['nav.branches'], defaultEnabled: true },
  { id: 'people', label: 'People', description: 'Members, suppliers, customers, and their categories.', navKeys: ['nav.people'], defaultEnabled: true },
  { id: 'users', label: 'All users', description: 'User accounts and access management.', navKeys: ['nav.users'], defaultEnabled: true },
  { id: 'roles', label: 'Roles & permissions', description: 'Roles, permissions, and access control.', navKeys: ['nav.roles'], defaultEnabled: true },
  { id: 'hrm', label: 'Human Resources', description: 'Employees, departments, leave, payroll, and recruitment.', navKeys: ['nav.hrm'], defaultEnabled: true },
  { id: 'plans', label: 'Memberships', description: 'Membership plans and pricing.', navKeys: ['nav.plans'], defaultEnabled: true },
  { id: 'accounting', label: 'Accounting', description: 'Vouchers, banking, chart of accounts, budget, and reports.', navKeys: ['nav.accounting'], defaultEnabled: true },
  { id: 'inventory', label: 'Inventory', description: 'Stock levels, suppliers, and movements.', navKeys: ['nav.inventory'], defaultEnabled: true },
  { id: 'assets', label: 'Assets', description: 'Asset register, depreciation, transactions, and reports.', navKeys: ['nav.assets'], defaultEnabled: true },
  { id: 'sales', label: 'Sales', description: 'Point of sale, quotes, invoices, orders, and reports.', navKeys: ['nav.sales'], defaultEnabled: true },
  { id: 'purchases', label: 'Purchases', description: 'Purchase orders, history, returns, and reports.', navKeys: ['nav.purchases'], defaultEnabled: true },
  { id: 'projects', label: 'Project Management', description: 'Projects, contracts, tasks, timesheets, and project invoices.', navKeys: ['nav.projects'], defaultEnabled: true },
  { id: 'classes', label: 'Classes', description: 'Class schedule, instructors, and capacity.', navKeys: ['nav.classes'], defaultEnabled: true },
  { id: 'payments', label: 'Payments', description: 'Payments and invoices.', navKeys: ['nav.payments'], defaultEnabled: true },
  { id: 'reports', label: 'Reports', description: 'Revenue, member, and attendance reports.', navKeys: ['nav.reports'], defaultEnabled: true },
  { id: 'leads', label: 'Leads CRM', description: 'Sales leads and consultations.', navKeys: ['nav.leads'], defaultEnabled: true },
  { id: 'notifications', label: 'Notifications', description: 'Announcements and notification history.', navKeys: ['nav.notifications'], defaultEnabled: true },
  { id: 'checkin', label: 'QR Check-in', description: 'Front-desk check-in and attendance.', navKeys: ['nav.checkin'], defaultEnabled: true },
  { id: 'audit', label: 'Audit logs', description: 'System activity and audit trail.', navKeys: ['nav.audit'], defaultEnabled: true },
  { id: 'settings', label: 'Settings', description: 'System settings and configuration.', navKeys: ['nav.settings'], defaultEnabled: true },
]

export type ModuleState = Record<string, boolean>

export function defaultModuleState(): ModuleState {
  const out: ModuleState = {}
  for (const m of MODULES) out[m.id] = m.defaultEnabled
  return out
}

export function loadModules(): ModuleState {
  const base = defaultModuleState()
  try {
    const raw = localStorage.getItem(MODULES_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as ModuleState
    const out: ModuleState = { ...base }
    for (const m of MODULES) {
      if (typeof saved[m.id] === 'boolean') out[m.id] = saved[m.id]
    }
    return out
  } catch {
    return base
  }
}

export function saveModules(state: ModuleState) {
  try { localStorage.setItem(MODULES_KEY, JSON.stringify(state)) } catch { /* ignore */ }
}

/** Set of nav keys hidden by the current module state. */
export function hiddenNavKeys(state: ModuleState): Set<string> {
  const hidden = new Set<string>()
  for (const m of MODULES) {
    if (state[m.id] === false) m.navKeys.forEach((k) => hidden.add(k))
  }
  return hidden
}

// ---- Sidebar ordering ----

/** Default order = module definition order. */
export function defaultSidebarOrder(): string[] {
  return MODULES.map((m) => m.id)
}

export function loadSidebarOrder(): string[] {
  const base = defaultSidebarOrder()
  try {
    const raw = localStorage.getItem(SIDEBAR_ORDER_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as string[]
    if (!Array.isArray(saved)) return base
    const known = new Set(base)
    const filtered = saved.filter((id) => known.has(id))
    // Append any modules that were added since the order was saved.
    for (const id of base) if (!filtered.includes(id)) filtered.push(id)
    return filtered
  } catch {
    return base
  }
}

export function saveSidebarOrder(order: string[]) {
  try { localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(order)) } catch { /* ignore */ }
}

/** Map a module id -> nav key (its primary/top-level key). */
export function moduleNavKey(id: string): string | undefined {
  return MODULES.find((m) => m.id === id)?.navKeys[0]
}

/** Rank (0-based) of a nav key according to the sidebar order. */
export function navRank(order: string[], navKey: string): number {
  const idx = order.findIndex((id) => moduleNavKey(id) === navKey)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}
