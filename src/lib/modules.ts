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
export const SIDEBAR_ORDER_KEY = 'fitpro_sidebar_order_v3'

export const MODULES: ModuleDef[] = [
  // Mirrors the current main sidebar menu (top-level entries) — this
  // exact arrangement is the default/reset order.
  { id: 'overview', label: 'Overview', description: 'Dashboard and key performance metrics.', navKeys: ['nav.overview'], defaultEnabled: true },
  { id: 'organizations', label: 'Organizations', description: 'Companies, branches, cost centers, licensing and subscriptions.', navKeys: ['nav.organizations'], defaultEnabled: true },
  { id: 'people', label: 'People', description: 'Leads, members, suppliers and customers.', navKeys: ['nav.people'], defaultEnabled: true },
  { id: 'userManagement', label: 'User Management', description: 'User accounts, roles & permissions and audit logs.', navKeys: ['nav.userManagement'], defaultEnabled: true },
  { id: 'hrm', label: 'Human Resource', description: 'Employees, attendance, shifts, training, leave, payroll and performance.', navKeys: ['nav.hrm'], defaultEnabled: true },
  { id: 'accounting', label: 'Accounting', description: 'Vouchers, banking, chart of accounts, budget and reports.', navKeys: ['nav.accounting'], defaultEnabled: true },
  { id: 'inventory', label: 'Inventory', description: 'Stock levels, suppliers and movements.', navKeys: ['nav.inventory'], defaultEnabled: true },
  { id: 'assets', label: 'Assets', description: 'Asset register, depreciation, transactions and reports.', navKeys: ['nav.assets'], defaultEnabled: true },
  { id: 'sales', label: 'Sales', description: 'Point of sale, quotes, invoices, orders and reports.', navKeys: ['nav.sales'], defaultEnabled: true },
  { id: 'purchases', label: 'Purchases', description: 'Purchase history, returns and reports.', navKeys: ['nav.purchases'], defaultEnabled: true },
  { id: 'projects', label: 'Project Management', description: 'Projects, contracts, tasks, timesheets and project invoices.', navKeys: ['nav.projects'], defaultEnabled: true },
  { id: 'communications', label: 'Communications', description: 'Announcements, notifications and messages.', navKeys: ['nav.communications'], defaultEnabled: true },
  { id: 'programs', label: 'Gym Management', description: 'Gym programs, memberships, classes and schedules.', navKeys: ['nav.programs'], defaultEnabled: true },
  { id: 'educationManagement', label: 'Education Management', description: 'Education industry workspace.', navKeys: ['nav.educationManagement'], defaultEnabled: true },
  { id: 'churchManagement', label: 'Church Management', description: 'Church industry workspace.', navKeys: ['nav.churchManagement'], defaultEnabled: true },
  { id: 'mediaLibrary', label: 'Media Library', description: 'Central storage for uploaded images, documents and other media files.', navKeys: ['nav.mediaLibrary', 'nav.mediaUploads', 'nav.fileSharing', 'nav.mediaSettings'], defaultEnabled: true },
  { id: 'frontCms', label: 'Front CMS', description: 'Public website pages and media.', navKeys: ['nav.frontCms'], defaultEnabled: true },
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

/**
 * Set of nav keys hidden by the current module state, plus any individual
 * menu items hidden through sub-module toggles (`fitpro_submodules`).
 */
export function hiddenNavKeys(state: ModuleState, subHidden?: SubModuleState): Set<string> {
  const hidden = new Set<string>()
  for (const m of MODULES) {
    if (state[m.id] === false) m.navKeys.forEach((k) => hidden.add(k))
  }
  if (subHidden) {
    for (const [k, v] of Object.entries(subHidden)) {
      if (v === true) hidden.add(k)
    }
  }
  return hidden
}

// ---- Sub-module (individual menu item) visibility ----

export const SUBMODULES_KEY = 'fitpro_submodules'

/** Individual sidebar menu items hidden inside their module (nav key -> true = hidden). */
export type SubModuleState = Record<string, boolean>

export function loadSubModules(): SubModuleState {
  try {
    const raw = localStorage.getItem(SUBMODULES_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as SubModuleState
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    return v
  } catch {
    return {}
  }
}

export function saveSubModules(s: SubModuleState) {
  try { localStorage.setItem(SUBMODULES_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

// ---- Industry presets ----

export interface ModulePreset {
  id: string
  label: string
  desc: string
  /** Module ids turned ON by the preset; every other module is turned off. */
  modules: string[]
}

export const MODULE_PRESETS: ModulePreset[] = [
  {
    id: 'gym', label: 'Gym / Fitness', desc: 'Members, programs, classes, POS and billing.',
    modules: ['overview', 'organizations', 'people', 'userManagement', 'accounting', 'inventory', 'sales', 'purchases', 'communications', 'programs', 'mediaLibrary', 'settings'],
  },
  {
    id: 'education', label: 'School / Education', desc: 'Students, classes, exams, fees and finance.',
    modules: ['overview', 'organizations', 'people', 'userManagement', 'accounting', 'sales', 'communications', 'educationManagement', 'mediaLibrary', 'settings'],
  },
  {
    id: 'church', label: 'Church / Ministry', desc: 'Congregation, events, giving and media.',
    modules: ['overview', 'organizations', 'people', 'userManagement', 'accounting', 'communications', 'churchManagement', 'mediaLibrary', 'settings'],
  },
  {
    id: 'business', label: 'Business / Enterprise', desc: 'HR, inventory, assets, projects and sales.',
    modules: ['overview', 'organizations', 'people', 'userManagement', 'hrm', 'accounting', 'inventory', 'assets', 'sales', 'purchases', 'projects', 'communications', 'mediaLibrary', 'frontCms', 'settings'],
  },
]

// ---- Sidebar ordering ----

/** Default order = the current main sidebar menu arrangement. */
export const SIDEBAR_DEFAULT_KEY = 'fitpro_sidebar_default_v4'

/**
 * The default sidebar arrangement restored by every reset. If the user saved
 * the current arrangement as the default ("Set current as default"), that
 * captured order is used; otherwise the main sidebar menu arrangement.
 */
export function defaultSidebarOrder(): string[] {
  const base = MODULES.map((m) => m.id)
  try {
    const raw = localStorage.getItem(SIDEBAR_DEFAULT_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw) as string[]
    if (!Array.isArray(saved)) return base
    const known = new Set(base)
    const filtered = saved.filter((id) => known.has(id))
    for (const id of base) if (!filtered.includes(id)) filtered.push(id)
    return filtered
  } catch {
    return base
  }
}

/** Save the current sidebar arrangement as the default restored by resets. */
export function captureSidebarDefault(order: string[]) {
  try { localStorage.setItem(SIDEBAR_DEFAULT_KEY, JSON.stringify(order)) } catch { /* ignore quota */ }
}

export const SUBMENU_ORDER_KEY = 'fitpro_submenu_order_v1'

/** Saved submenu arrangement per top-level nav key (child nav keys in order). */
export type SubMenuOrder = Record<string, string[]>

/** Business rule: under People, Leads CRM always sits directly above
    Customer management — enforced over any saved arrangement. */
export function normalizePeopleOrder(keys: string[]): string[] {
  if (!keys.includes('nav.leads')) return keys
  const out = keys.filter((k) => k !== 'nav.leads')
  const at = out.indexOf('nav.customers')
  if (at === -1) return [...out, 'nav.leads']
  out.splice(at, 0, 'nav.leads')
  return out
}

export function loadSubMenuOrder(): SubMenuOrder {
  try {
    const raw = localStorage.getItem(SUBMENU_ORDER_KEY)
    if (!raw) return {}
    const v = JSON.parse(raw) as SubMenuOrder
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
    const out: SubMenuOrder = { ...v }
    if (Array.isArray(out['nav.people'])) out['nav.people'] = normalizePeopleOrder(out['nav.people'])
    return out
  } catch {
    return {}
  }
}

export function saveSubMenuOrder(o: SubMenuOrder) {
  try { localStorage.setItem(SUBMENU_ORDER_KEY, JSON.stringify(o)) } catch { /* ignore quota */ }
}

/** Forget the captured default (full data resets return to the menu order). */
export function clearSidebarDefault() {
  try { localStorage.removeItem(SIDEBAR_DEFAULT_KEY) } catch { /* ignore */ }
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
    const hadOrganizations = filtered.includes('organizations')
    const hadMediaLibrary = filtered.includes('mediaLibrary')
    // Append any modules that were added since the order was saved.
    for (const id of base) if (!filtered.includes(id)) filtered.push(id)
    // Migrate older saved orders so Organizations appears directly after Overview.
    if (!hadOrganizations) {
      const organizationIndex = filtered.indexOf('organizations')
      if (organizationIndex >= 0) filtered.splice(organizationIndex, 1)
      const overviewIndex = filtered.indexOf('overview')
      filtered.splice(overviewIndex >= 0 ? overviewIndex + 1 : 0, 0, 'organizations')
    }
    // Migrate older saved orders so Media Library sits directly above Front CMS.
    if (!hadMediaLibrary) {
      const mediaIndex = filtered.indexOf('mediaLibrary')
      if (mediaIndex >= 0) filtered.splice(mediaIndex, 1)
      const frontCmsIndex = filtered.indexOf('frontCms')
      filtered.splice(frontCmsIndex >= 0 ? frontCmsIndex : filtered.length, 0, 'mediaLibrary')
    }
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
