// Clearable data collections for the Settings → Data maintenance screen.
// AppContext can restore factory defaults or empty the selected collection groups.

import { downloadText } from './utils.ts'

export interface PersistedStore {
  /** Exact localStorage key, or a prefix for company-scoped/legacy key families. */
  key?: string
  prefix?: string
  excludeKeys?: string[]
  excludePrefixes?: string[]
  /** Table name shown in the collection preview. */
  label: string
  /** Optional path to the record array inside an object-valued store. */
  dataPath?: string
  /** Interpret a branch → table → rows map as separate preview tables. */
  shape?: 'nestedTables' | 'objectEntries'
  /** Derive a preview table name for each key matched by `prefix`. */
  labelForKey?: (key: string) => string
  /** Context-backed stores are previewed from AppContext and/or already in the app snapshot. */
  preview?: boolean
  backup?: boolean
}

export interface DataCollection {
  key: string
  /** Main sidebar module that owns this reset group. */
  module: string
  label: string
  desc: string
  persisted: boolean
  /** Additional standalone localStorage tables grouped under this reset checkbox. */
  stores?: PersistedStore[]
}

/** Preserve a settings object's shape while emptying every value it contains. */
export function emptyDataShape<T>(value: T): T {
  if (Array.isArray(value)) return [] as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, emptyDataShape(nested)])) as T
  }
  if (typeof value === 'string') return '' as T
  if (typeof value === 'number') return 0 as T
  if (typeof value === 'boolean') return false as T
  return value
}

function matchingStoreKeys(store: PersistedStore, storage?: Storage): string[] {
  if (!storage) return store.key ? [store.key] : []
  const excluded = (key: string) =>
    (store.excludeKeys ?? []).includes(key) || (store.excludePrefixes ?? []).some((prefix) => key.startsWith(prefix))
  if (store.key) return [store.key]
  if (!store.prefix) return []
  const keys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(store.prefix) && !excluded(key)) keys.push(key)
  }
  return keys.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function readStoredValue(storage: Storage | undefined, key: string): unknown {
  if (!storage) return undefined
  try {
    const raw = storage.getItem(key)
    if (raw === null) return undefined
    try { return JSON.parse(raw) as unknown } catch { return raw }
  } catch {
    return undefined
  }
}

function valueAtPath(value: unknown, path?: string): unknown {
  if (!path) return value
  return path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[part]
  }, value)
}

function rowsFromValue(value: unknown): unknown[] {
  if (value == null) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length ? [value] : []
  return [value]
}

/** Preview records from the standalone stores assigned to each collection. */
export function readPersistedCollectionGroups(storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): Record<string, { label: string; records: unknown[] }[]> {
  const result: Record<string, { label: string; records: unknown[] }[]> = {}
  for (const collection of DATA_COLLECTIONS) {
    const stores = (collection.stores ?? []).filter((store) => store.preview !== false)
    if (!stores.length) continue
    const groups = new Map<string, unknown[]>()
    for (const store of stores) {
      const keys = matchingStoreKeys(store, storage)
      if (!keys.length && store.key) keys.push(store.key)
      if (!keys.length) {
        if (store.prefix && store.label) groups.set(store.label, groups.get(store.label) ?? [])
        continue
      }
      for (const key of keys) {
        const value = readStoredValue(storage, key)
        const tableLabel = store.labelForKey?.(key) ?? store.label
        if (store.shape === 'nestedTables' && value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [branchId, tables] of Object.entries(value as Record<string, unknown>)) {
            if (!tables || typeof tables !== 'object' || Array.isArray(tables)) continue
            for (const [table, rows] of Object.entries(tables as Record<string, unknown>)) {
              if (!Array.isArray(rows)) continue
              const label = table.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase())
              const current = groups.get(label) ?? []
              current.push(...rows.map((row) => row && typeof row === 'object' ? { ...(row as Record<string, unknown>), branchId } : { value: row, branchId }))
              groups.set(label, current)
            }
          }
          continue
        }
        if (store.shape === 'objectEntries' && value && typeof value === 'object' && !Array.isArray(value)) {
          const records = Object.entries(value as Record<string, unknown>).map(([name, entry]) => ({ name, value: entry }))
          const current = groups.get(tableLabel) ?? []
          current.push(...records)
          groups.set(tableLabel, current)
          continue
        }
        const records = rowsFromValue(valueAtPath(value, store.dataPath))
        const current = groups.get(tableLabel) ?? []
        current.push(...records)
        groups.set(tableLabel, current)
      }
    }
    result[collection.key] = [...groups.entries()].map(([label, records]) => ({ label, records }))
  }
  return result
}

/** Full snapshot of the standalone stores that belong to clearable collections. */
export function snapshotPersistedCollections(storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  if (!storage) return result
  for (const collection of DATA_COLLECTIONS) {
    const stores = (collection.stores ?? []).filter((store) => store.backup !== false)
    if (!stores.length) continue
    const data: Record<string, unknown> = {}
    for (const store of stores) {
      for (const key of matchingStoreKeys(store, storage)) {
        const value = readStoredValue(storage, key)
        if (value !== undefined) data[key] = value
      }
    }
    result[collection.key] = data
  }
  return result
}

/** Remove every standalone store assigned to the selected collection keys. */
export function clearPersistedCollections(keys: string[], storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (!storage) return
  const selected = new Set(keys)
  for (const collection of DATA_COLLECTIONS) {
    if (!selected.has(collection.key)) continue
    for (const store of collection.stores ?? []) {
      for (const key of matchingStoreKeys(store, storage)) {
        try { storage.removeItem(key) } catch { /* ignore unavailable storage */ }
      }
    }
  }
}

function setPathValue(value: Record<string, unknown>, path: string, nextValue: unknown): Record<string, unknown> {
  const [head, ...tail] = path.split('.')
  if (!head) return value
  if (!tail.length) return { ...value, [head]: nextValue }
  const child = value[head] && typeof value[head] === 'object' && !Array.isArray(value[head])
    ? value[head] as Record<string, unknown>
    : {}
  return { ...value, [head]: setPathValue(child, tail.join('.'), nextValue) }
}

function emptyStoreValue(store: PersistedStore, current: unknown): unknown {
  if (store.shape === 'objectEntries') return {}
  if (store.shape === 'nestedTables') {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return {}
    return Object.fromEntries(Object.entries(current as Record<string, unknown>).map(([branch, tables]) => [
      branch,
      tables && typeof tables === 'object' && !Array.isArray(tables)
        ? Object.fromEntries(Object.entries(tables as Record<string, unknown>).map(([table, rows]) => [table, Array.isArray(rows) ? [] : rows]))
        : tables,
    ]))
  }
  if (store.dataPath) {
    const record = current && typeof current === 'object' && !Array.isArray(current)
      ? current as Record<string, unknown>
      : {}
    return setPathValue(record, store.dataPath, [])
  }
  if (Array.isArray(current)) return []
  if (current && typeof current === 'object') return {}
  return []
}

/** Empty, rather than delete, each selected standalone storage table. */
export function emptyPersistedCollections(keys: string[], storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (!storage) return
  const selected = new Set(keys)
  const emptyValues = new Map<string, unknown>()
  for (const collection of DATA_COLLECTIONS) {
    if (!selected.has(collection.key)) continue
    for (const store of collection.stores ?? []) {
      for (const key of matchingStoreKeys(store, storage)) {
        const current = emptyValues.has(key) ? emptyValues.get(key) : readStoredValue(storage, key)
        emptyValues.set(key, emptyStoreValue(store, current))
      }
    }
  }
  for (const [key, value] of emptyValues) {
    try { storage.setItem(key, JSON.stringify(value)) } catch { /* ignore unavailable storage */ }
  }
}

const CLEARED_COLLECTIONS_KEY = 'fitpro_cleared_data_collections_v1'

/** Remember intentionally empty seed-only collections that have no own store. */
export function setClearedCollectionMarkers(keys: string[], cleared: boolean, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (!storage || !keys.length) return
  try {
    const raw = storage.getItem(CLEARED_COLLECTIONS_KEY)
    const current = raw ? JSON.parse(raw) as unknown : []
    const markers = new Set(Array.isArray(current) ? current.filter((key): key is string => typeof key === 'string') : [])
    for (const key of keys) cleared ? markers.add(key) : markers.delete(key)
    if (markers.size) storage.setItem(CLEARED_COLLECTIONS_KEY, JSON.stringify([...markers]))
    else storage.removeItem(CLEARED_COLLECTIONS_KEY)
  } catch { /* ignore unavailable storage */ }
}

export function isCollectionMarkedCleared(key: string, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): boolean {
  if (!storage) return false
  try {
    const raw = storage.getItem(CLEARED_COLLECTIONS_KEY)
    const keys = raw ? JSON.parse(raw) as unknown : []
    return Array.isArray(keys) && keys.includes(key)
  } catch {
    return false
  }
}

const SEED_MERGE_SUPPRESSION_PREFIX = 'fitpro_seed_merge_suppressed:'

export function setSeedMergeSuppressed(storageKeys: string[], suppressed: boolean, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): void {
  if (!storage) return
  for (const key of storageKeys) {
    try {
      const marker = `${SEED_MERGE_SUPPRESSION_PREFIX}${key}`
      if (suppressed) storage.setItem(marker, '1')
      else storage.removeItem(marker)
    } catch { /* ignore unavailable storage */ }
  }
}

export function isSeedMergeSuppressed(storageKey: string, storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): boolean {
  if (!storage) return false
  try { return storage.getItem(`${SEED_MERGE_SUPPRESSION_PREFIX}${storageKey}`) === '1' } catch { return false }
}

/** Builds the JSON payload string for a backup snapshot. */
export function buildBackup(data: Record<string, unknown>): { filename: string; json: string } {
  const payload = {
    app: 'FitPro',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
  const stamp = new Date().toISOString().slice(0, 10)
  return { filename: `fitpro-backup-${stamp}.json`, json: JSON.stringify(payload, null, 2) }
}

/** Downloads a full JSON snapshot of the app data as a backup file. */
export function createBackup(data: Record<string, unknown>) {
  const { filename, json } = buildBackup(data)
  downloadText(filename, json, 'application/json')
}

const HRM_SETTING_TABLES: Record<string, string> = {
  designation: 'Designations',
  'job-title': 'Job titles',
  grades: 'Grades',
  'promotion-type': 'Promotion types',
  'employment-status': 'Employment statuses',
  appointment: 'Appointment types',
  'recruitment-status': 'Recruitment statuses',
  'job-categories': 'Job categories',
  'leave-period': 'Leave periods',
  'leave-type': 'Leave types',
  holidays: 'Holidays',
  'work-week': 'Work weeks',
  'work-shifts': 'HR work shifts',
  skills: 'Skills',
  education: 'Education qualifications',
  license: 'Licenses',
  languages: 'Languages',
  membership: 'Professional memberships',
  'promotion-grade-settings': 'Promotion grade settings',
}

function hrmSettingTableLabel(key: string): string {
  const pageKey = Object.keys(HRM_SETTING_TABLES).find((candidate) => key.endsWith(`_${candidate}`))
  return pageKey ? HRM_SETTING_TABLES[pageKey] : 'HR Admin settings'
}

export const DATA_COLLECTIONS: DataCollection[] = [
  { key: 'users', module: 'User Management', label: 'Users & accounts', desc: 'All user accounts and their login records.', persisted: true },
  { key: 'members', module: 'Gym Management', label: 'Members', desc: 'Member records, tags, goals, and medical notes.', persisted: false },
  { key: 'trainers', module: 'Gym Management', label: 'Trainers', desc: 'Trainer profiles and specialties.', persisted: false },
  { key: 'staff', module: 'Human Resource', label: 'Staff', desc: 'Employee profile and staff records.', persisted: false },
  { key: 'departments', module: 'Human Resource', label: 'Departments', desc: 'Human Resource departments.', persisted: true },
  { key: 'payslips', module: 'Human Resource', label: 'Payslips', desc: 'Generated staff payslips.', persisted: true },
  { key: 'jobs', module: 'Human Resource', label: 'Job postings', desc: 'Recruitment job postings.', persisted: true },
  { key: 'candidates', module: 'Human Resource', label: 'Candidates', desc: 'Recruitment candidate records.', persisted: true },
  { key: 'reviews', module: 'Human Resource', label: 'Performance reviews', desc: 'Staff performance review records.', persisted: true },
  { key: 'staffAttendance', module: 'Human Resource', label: 'Staff attendance', desc: 'Employee attendance records.', persisted: true },
  { key: 'plans', module: 'Gym Management', label: 'Plans & pricing', desc: 'Membership plans and features.', persisted: false },
  { key: 'memberships', module: 'Gym Management', label: 'Memberships', desc: 'Active, expired, and cancelled memberships.', persisted: true },
  { key: 'payments', module: 'Gym Management', label: 'Payments', desc: 'Payment history and pending charges.', persisted: true },
  { key: 'invoices', module: 'Sales', label: 'Invoices', desc: 'Issued invoices and invoice templates.', persisted: true },
  { key: 'proposals', module: 'Sales', label: 'Proposals', desc: 'Customer proposals and quote documents.', persisted: true },
  { key: 'estimates', module: 'Sales', label: 'Estimates', desc: 'Customer estimates and quotations.', persisted: true },
  { key: 'salesOrders', module: 'Sales', label: 'Sales orders', desc: 'Customer sales order records.', persisted: true },
  { key: 'shipments', module: 'Sales', label: 'Shipments', desc: 'Shipment and delivery records.', persisted: true },
  { key: 'discounts', module: 'Sales', label: 'Discounts', desc: 'Discount rules and records.', persisted: true },
  { key: 'salesReturns', module: 'Sales', label: 'Sales returns', desc: 'Returned sales and refunds.', persisted: true },
  { key: 'classes', module: 'Gym Management', label: 'Classes & timetable', desc: 'Group classes, rooms, and capacity.', persisted: false },
  { key: 'bookings', module: 'Gym Management', label: 'Class bookings', desc: 'Bookings and waitlists.', persisted: false },
  { key: 'attendance', module: 'Gym Management', label: 'Attendance', desc: 'Check-ins and class attendance.', persisted: false },
  { key: 'workouts', module: 'Gym Management', label: 'Workout plans', desc: 'Published workout programmes.', persisted: false },
  { key: 'progress', module: 'Gym Management', label: 'Progress logs', desc: 'Weigh-ins and measurements.', persisted: false },
  { key: 'notifications', module: 'Communications', label: 'Notifications', desc: 'In-app notifications and notification display preferences.', persisted: true, stores: [
    { key: 'fitpro_notify', label: 'Notification preferences', preview: false },
  ] },
  { key: 'branches', module: 'Organizations', label: 'Branches', desc: 'Club locations.', persisted: false },
  { key: 'companies', module: 'Organizations', label: 'Companies', desc: 'Company records, company profile settings, product mode, and active company selection.', persisted: true, stores: [
    { key: 'fitpro_company', label: 'Company profile settings', preview: false, backup: false },
    { key: 'fitpro_product_mode', label: 'Product mode', preview: false, backup: false },
  ] },
  { key: 'branchSettings', module: 'Organizations', label: 'Branch settings', desc: 'Branch-specific settings and overrides.', persisted: true },
  { key: 'customFields', module: 'Settings', label: 'Custom fields', desc: 'Custom field definitions and values.', persisted: true },
  { key: 'cms', module: 'Front CMS', label: 'Website content', desc: 'Front CMS pages and content.', persisted: true },
  { key: 'leads', module: 'People', label: 'Leads CRM', desc: 'Sales leads and consultations.', persisted: false },
  { key: 'messages', module: 'Communications', label: 'Messages', desc: 'Member ↔ coach messages.', persisted: false },
  { key: 'audit', module: 'User Management', label: 'Audit log', desc: 'System activity log.', persisted: false },
  { key: 'leaves', module: 'Human Resource', label: 'Leave requests', desc: 'Staff leave records.', persisted: false },
  { key: 'sessions', module: 'Gym Management', label: 'PT sessions', desc: 'Personal training bookings.', persisted: false },
  { key: 'inventory', module: 'Inventory', label: 'Inventory', desc: 'Stock items, suppliers, stock movements, purchases, and sales.', persisted: true },
  { key: 'purchaseOrders', module: 'Purchases', label: 'Purchase orders', desc: 'Purchase order records.', persisted: true },
  { key: 'purchaseReturns', module: 'Purchases', label: 'Purchase returns', desc: 'Returned purchases and supplier credits.', persisted: true },
  { key: 'assets', module: 'Assets Management', label: 'Assets', desc: 'Fixed assets, equipment, and depreciation entries.', persisted: true },
  { key: 'customers', module: 'People', label: 'Customers', desc: 'Walk-in and retail customer records.', persisted: true },
  { key: 'modules', module: 'Settings', label: 'Module visibility', desc: 'Which modules are shown in the sidebar.', persisted: true },
  { key: 'chartOfAccounts', module: 'Accounting', label: 'Chart of accounts', desc: 'Non-bank chart-of-account records, account notes, accounting settings, account detail types, and currency rates.', persisted: true, stores: [
    { key: 'fitpro_deleted_account_notes', label: 'Deleted account notes' },
  ] },
  { key: 'accountingVouchers', module: 'Accounting', label: 'Accounting vouchers', desc: 'Receipt, payment, and journal vouchers, templates, ledger history, voucher serials, funds, payment modes, and income-statement setup.', persisted: true },
  { key: 'bankingRecords', module: 'Accounting', label: 'Bank accounts and reconciliations', desc: 'Bank-type chart accounts, signatories, and reconciliation records.', persisted: true },
  { key: 'accountingBudgets', module: 'Accounting', label: 'Budgets', desc: 'Accounting budgets and budget allocations.', persisted: true },
  { key: 'valueBookRegisters', module: 'Accounting', label: 'Value-book registers', desc: 'Value-book entries and item, issued, and received registers.', persisted: true, stores: [
    { key: 'fitpro_valuebook_items_v1', label: 'Value-book item register' },
    { key: 'fitpro_valuebook_issued_v2', label: 'Value-book issued register' },
    { key: 'fitpro_valuebook_received_v2', label: 'Value-book received register' },
  ] },
  { key: 'cheques', module: 'Accounting', label: 'Cheques', desc: 'Accounting cheque records.', persisted: true },
  { key: 'credentialEvents', module: 'User Management', label: 'Credential events', desc: 'Issued and resent login credentials history.', persisted: true },
  { key: 'roles', module: 'User Management', label: 'Custom roles', desc: 'Custom roles (built-in roles are kept).', persisted: true },
  { key: 'permissions', module: 'User Management', label: 'Custom permissions', desc: 'Custom permissions (built-in ones are kept).', persisted: true },
  { key: 'integrations', module: 'Settings', label: 'Integrations', desc: 'Integration configs and activity logs.', persisted: true },
  { key: 'inventoryOperations', module: 'Inventory', label: 'Stock controls & catalogs', desc: 'Transfers, adjustments, stock counts, alerts, and inventory setup lists.', persisted: true, stores: [
    { key: 'fitpro_stock_transfers', label: 'Stock transfers', preview: false, backup: false },
    { key: 'fitpro_stock_adjustments', label: 'Stock adjustments', preview: false, backup: false },
    { key: 'fitpro_stock_counts', label: 'Stock counts', preview: false, backup: false },
    { key: 'fitpro_stock_alerts', label: 'Stock alerts', preview: false, backup: false },
    { key: 'fitpro_inv_variations', label: 'Item variations' },
    { key: 'fitpro_inv_categories', label: 'Inventory setup categories' },
    { key: 'fitpro_inv_brands', label: 'Brands' },
    { key: 'fitpro_inv_units', label: 'Units of measure' },
    { key: 'fitpro_inv_warranties', label: 'Warranties' },
    { key: 'fitpro_inv_price_groups', label: 'Price groups' },
  ] },
  { key: 'procurement', module: 'Purchases', label: 'Procurement', desc: 'Requisitions, procurement orders, receipts, supplier invoices, payments, returns, and purchase payments.', persisted: true, stores: [
    { key: 'fitpro_requisitions', label: 'Purchase requisitions', preview: false, backup: false },
    { key: 'fitpro_proc_purchase_orders', label: 'Procurement orders', preview: false, backup: false },
    { key: 'fitpro_goods_receipts', label: 'Goods receipts', preview: false, backup: false },
    { key: 'fitpro_supplier_invoices', label: 'Supplier invoices', preview: false, backup: false },
    { key: 'fitpro_supplier_payments', label: 'Supplier payments', preview: false, backup: false },
    { key: 'fitpro_proc_returns', label: 'Procurement returns', preview: false, backup: false },
  ] },
  { key: 'purchasePayments', module: 'Purchases', label: 'Purchase payments', desc: 'Payments recorded against purchase orders.', persisted: true, stores: [
    { key: 'fitpro_purchase_payments', label: 'Purchase payments', preview: false, backup: false },
  ] },
  { key: 'coupons', module: 'Sales', label: 'Coupons & assignments', desc: 'Coupon definitions and customer assignments.', persisted: true, stores: [
    { key: 'fitpro_coupons', label: 'Coupons' },
    { key: 'fitpro_coupon_assignments', label: 'Coupon assignments' },
  ] },
  { key: 'subscriptions', module: 'Organizations', label: 'Organization subscriptions', desc: 'Subscription packages, company access subscriptions, invoices, history, and audit entries.', persisted: true, stores: [
    { key: 'fitpro_sub_packages_v2', label: 'Subscription packages', preview: false },
    { key: 'fitpro_org_subscriptions_v1', label: 'Organization subscriptions', preview: false },
    { key: 'fitpro_sub_invoices_v1', label: 'Subscription invoices', preview: false },
    { key: 'fitpro_sub_history_v1', label: 'Subscription history', preview: false },
    { key: 'fitpro_package_audit_v1', label: 'Package audit entries', preview: false },
  ] },
  { key: 'assetSetup', module: 'Assets Management', label: 'Asset setup & audit', desc: 'Asset locations, assignments, maintenance, audit sessions, and setup lists.', persisted: true, stores: [
    { key: 'fitpro_asset_kind_categories_v1', label: 'Asset type categories', preview: false, backup: false },
    { key: 'fitpro_depreciation_policies_v1', label: 'Depreciation policies', preview: false, backup: false },
    { key: 'fitpro_asset_locations_v1', label: 'Asset locations' },
    { key: 'fitpro_asset_assignments_v1', label: 'Asset assignments' },
    { key: 'fitpro_asset_maintenance_v1', label: 'Asset maintenance records' },
    { key: 'fitpro_asset_audits_v1', label: 'Asset audits' },
    { key: 'fitpro_asset_audit_items_v1', label: 'Asset audit items' },
    { key: 'fitpro_asset_audit_log_v1', label: 'Asset audit log' },
  ] },
  { key: 'accountingPolicies', module: 'Accounting', label: 'Accounting policies & disclosures', desc: 'Accounting policies, custom report definitions, financial note templates, and banking reference lists.', persisted: true, stores: [
    { key: 'fitpro_accounting_policies_v1', label: 'Accounting policies' },
    { key: 'fitpro_custom_reports_v1', label: 'Custom reports' },
    { key: 'fitpro_financial_note_templates_v1', label: 'Financial note templates' },
    { key: 'fitpro_signatory_types_v2', label: 'Bank signatory types' },
    { key: 'fitpro_bank_names_v1', label: 'Bank name list' },
    { key: 'fitpro_bank_names_hidden_v1', label: 'Hidden bank names' },
    { key: 'fitpro_accounting_policies_seed_v1', label: 'Accounting policy seed marker', preview: false, backup: false },
    { key: 'fitpro_accounting_policies_depreciation_format_v1', label: 'Accounting policy format marker', preview: false, backup: false },
  ] },
  { key: 'bankFeeds', module: 'Accounting', label: 'Bank feeds', desc: 'Connected feed profiles, imported transactions, and matching rules.', persisted: true, stores: [
    { key: 'fitpro_bank_feeds_v1', label: 'Bank feed connections', dataPath: 'feeds' },
    { key: 'fitpro_bank_feeds_v1', label: 'Bank feed rules', dataPath: 'rules' },
    { key: 'fitpro_bank_feeds_v1', label: 'Bank feed transactions', dataPath: 'txns' },
  ] },
  { key: 'stakeholders', module: 'Accounting', label: 'Stakeholders', desc: 'Custom stakeholder classes and entities used by accounting records.', persisted: true, stores: [
    { key: 'fitpro_stakeholder_classes', label: 'Stakeholder classes', preview: false, backup: false },
    { key: 'fitpro_stakeholder_entities', label: 'Stakeholder entities', preview: false, backup: false },
  ] },
  { key: 'employeePromotions', module: 'Human Resource', label: 'Employee promotions', desc: 'Promotion, grade-change, approval, and payroll-link records.', persisted: true, stores: [
    { prefix: 'fitpro_hrm_employee_promotions_v1_', label: 'Employee promotion records' },
    { key: 'fitpro_hrm_promotions_v1', label: 'Legacy promotion and grade records' },
  ] },
  { key: 'employeeAppointments', module: 'Human Resource', label: 'Employee appointments', desc: 'Dated employee appointment records and history.', persisted: true, stores: [
    { prefix: 'fitpro_hrm_employee_appointments_v1_', label: 'Employee appointment records' },
  ] },
  { key: 'hrmSettings', module: 'Human Resource', label: 'HR Admin settings', desc: 'Company-scoped job, grade, promotion, leave, work, and qualification lists.', persisted: true, stores: [
    {
      prefix: 'fitpro_hrm_',
      excludeKeys: ['fitpro_hrm_promotions_v1'],
      excludePrefixes: ['fitpro_hrm_employee_promotions_v1_', 'fitpro_hrm_employee_appointments_v1_'],
      label: 'HR Admin settings',
      labelForKey: hrmSettingTableLabel,
    },
  ] },
  { key: 'payroll', module: 'Human Resource', label: 'Payroll & salary administration', desc: 'Salary benefits, structures, assignments, advances, loans, increases, payroll periods, and policies.', persisted: true, stores: [
    { key: 'fitpro_salary_benefits_v1', label: 'Salary benefits', preview: false, backup: false },
    { key: 'fitpro_salary_structures_v1', label: 'Salary structures', preview: false, backup: false },
    { key: 'fitpro_salary_assignments_v1', label: 'Salary assignments', preview: false, backup: false },
    { key: 'fitpro_payroll_adj_v1', label: 'Payroll adjustments', preview: false, backup: false },
    { key: 'fitpro_staff_loans_v1', label: 'Staff loans', preview: false, backup: false },
    { key: 'fitpro_loan_installments_v1', label: 'Loan installments', preview: false, backup: false },
    { key: 'fitpro_loan_policy_v1', label: 'Loan policy & products', preview: false, backup: false },
    { key: 'fitpro_advance_salary_v1', label: 'Salary advances' },
    { key: 'fitpro_salary_increases', label: 'Salary increases' },
    { key: 'fitpro_payroll_periods_v1', label: 'Payroll periods' },
    { key: 'fitpro_payroll_gratuities_v1', label: 'Gratuities' },
    { key: 'fitpro_tax_policies_v1', label: 'Tax policies' },
    { key: 'fitpro_ss_policies_v1', label: 'Social security policies' },
    { key: 'fitpro_payroll_state_transitions_v1', label: 'Payslip state transitions' },
  ] },
  { key: 'leaveSettings', module: 'Human Resource', label: 'Leave policies & settings', desc: 'Leave types, approval rules, balance transactions, and entitlement policies.', persisted: true, stores: [
    { key: 'fitpro_leave_types_v1', label: 'Leave types', preview: false, backup: false },
    { key: 'fitpro_leave_policies_v1', label: 'Leave policies' },
    { key: 'fitpro_leave_balance_txns_v1', label: 'Leave balance transactions' },
    { key: 'fitpro_leave_approval_rules_v1', label: 'Leave approval rules' },
  ] },
  { key: 'workSchedules', module: 'Human Resource', label: 'Work schedules', desc: 'Shift definitions, shift policies, and roster day-off assignments.', persisted: true, stores: [
    { key: 'fitpro_work_shifts_v1', label: 'Work shifts', preview: false, backup: false },
    { key: 'fitpro_shift_policies_v1', label: 'Shift policies' },
    { key: 'fitpro_roster_dayoffs_v1', label: 'Roster day-offs', shape: 'objectEntries' as const },
  ] },
  { key: 'projects', module: 'Projects', label: 'Projects & project records', desc: 'Projects, contracts, tasks, timesheets, invoices, files, notes, discussions, tickets, and setup lists.', persisted: true, stores: [
    { key: 'fitpro_projects_v1', label: 'Projects', preview: false, backup: false },
    { key: 'fitpro_contracts_v1', label: 'Contracts', preview: false, backup: false },
    { key: 'fitpro_tasks_v1', label: 'Project tasks', preview: false, backup: false },
    { key: 'fitpro_work_stages_v1', label: 'Work stages', preview: false, backup: false },
    { key: 'fitpro_task_templates_v1', label: 'Task templates', preview: false, backup: false },
    { key: 'fitpro_timesheets_v1', label: 'Timesheets', preview: false, backup: false },
    { key: 'fitpro_project_invoices_v1', label: 'Project invoices', preview: false, backup: false },
    { key: 'fitpro_project_types_v1', label: 'Project types', preview: false, backup: false },
    { key: 'fitpro_contract_types_v1', label: 'Contract types', preview: false, backup: false },
    { key: 'fitpro_project_statuses_v1', label: 'Project statuses', preview: false, backup: false },
    { key: 'fitpro_project_priorities_v1', label: 'Project priorities', preview: false, backup: false },
    { key: 'fitpro_project_categories_v1', label: 'Project categories', preview: false, backup: false },
    { key: 'fitpro_milestones', label: 'Milestones' },
    { key: 'fitpro_project_files', label: 'Project files' },
    { key: 'fitpro_project_notes', label: 'Project notes' },
    { key: 'fitpro_project_discussions', label: 'Project discussions' },
    { key: 'fitpro_project_tickets', label: 'Project tickets' },
    { key: 'fitpro_project_purchases', label: 'Project purchases' },
  ] },
  { key: 'educationRecords', module: 'Education', label: 'Education records', desc: 'Branch-scoped education records grouped by their table or submenu.', persisted: true, stores: [
    { key: 'fitpro_edu_records_v1', label: 'Education records', shape: 'nestedTables' as const },
    { key: 'fitpro_edu_seeded_v1', label: 'Education seed markers', preview: false, backup: false },
  ] },
  { key: 'trainingPrograms', module: 'Gym Management', label: 'Training programs', desc: 'Training programs, sessions, enrollments, and progress.', persisted: true, stores: [
    { key: 'fitpro_training_programs_v1', label: 'Training programs' },
  ] },
  { key: 'messageTemplates', module: 'Communications', label: 'Message templates', desc: 'Saved reusable communication templates.', persisted: true, stores: [
    { key: 'fitpro_message_templates', label: 'Message templates', preview: false, backup: false },
  ] },
  { key: 'fileSharing', module: 'Communications', label: 'File shares', desc: 'Shared file links and their activity records.', persisted: true, stores: [
    { key: 'fitpro_file_sharing', label: 'File shares' },
  ] },
  { key: 'mediaLibrary', module: 'Media Library', label: 'Media library', desc: 'Saved image-shop media, folders, and media-library settings.', persisted: true, stores: [
    { key: 'fitpro_imageshop_v1', label: 'Image-shop files' },
    { key: 'fitpro_imageshop_folders_v1', label: 'Image-shop folders' },
    { key: 'fitpro_media_settings', label: 'Media settings' },
  ] },
  { key: 'permissionMatrix', module: 'User Management', label: 'Permission matrix', desc: 'Granular module and action permission rules.', persisted: true, stores: [
    { key: 'fitpro_permission_matrix', label: 'Permission matrix' },
  ] },
  { key: 'systemSettings', module: 'Settings', label: 'System settings', desc: 'Developer-managed application version, release date, and release notes.', persisted: true, stores: [
    { key: 'fitpro_system_settings', label: 'System settings', preview: false, backup: false },
  ] },
  { key: 'paymentSettings', module: 'Settings', label: 'Payment settings', desc: 'Enabled payment methods and the default checkout gateway.', persisted: true, stores: [
    { key: 'fitpro_payment_settings', label: 'Payment settings', preview: false, backup: false },
  ] },
].sort((a, b) => a.module.localeCompare(b.module, undefined, { sensitivity: 'base' }) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
