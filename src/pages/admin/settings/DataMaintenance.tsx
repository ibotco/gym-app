import { useEffect, useMemo, useState } from 'react'
import { Trash2, AlertTriangle, Download, ShieldAlert, Copy, Check, Eye } from 'lucide-react'
import { Button, Modal, Badge, SearchField } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useLicense } from '../../../context/LicenseContext'
import { accountTypeName, loadAccountNotes } from '../../../lib/accounting'
import { DATA_COLLECTIONS, buildBackup, isCollectionMarkedCleared, readPersistedCollectionGroups, snapshotPersistedCollections } from '../../../lib/dataReset'
import { loadIntegrationLogs, loadIntegrations } from '../../../lib/integrations'
import { clearAllPromotionDocuments, exportPromotionDocuments, listPromotionDocumentPreviews, type PromotionDocumentPreview } from '../../../lib/promotionDocuments'
import { cn, downloadText, formatGhsExact } from '../../../lib/utils'

type CollectionPreviewGroup = { label: string; records: unknown[] }
type PreviewItem = { title: string; details: string[]; searchText: string }

const PRIVATE_PREVIEW_FIELD = /(password|token|secret|credential|pin|hash|private|authorization|api.?key|access.?key|refresh.?key|verify|reset|link.?code|data.?url|blob|^src$)/i
const PREVIEW_TITLE_FIELDS = ['name', 'fullName', 'title', 'fileName', 'code', 'number', 'referenceNo', 'reference', 'username', 'email', 'subject', 'label', 'id']
const ACCOUNT_CLASS_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', income: 'Income', expense: 'Expenses',
}

function previewScalar(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function previewLabel(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase())
}

function toPreviewItem(record: unknown, groupLabel: string, index: number): PreviewItem {
  const value = record && typeof record === 'object' ? record as Record<string, unknown> : { value: record }
  const entries = Object.entries(value)
    .filter(([key, field]) => !PRIVATE_PREVIEW_FIELD.test(key) && previewScalar(field) !== null)
    .map(([key, field]) => [key, previewScalar(field) as string] as const)
  const titleField = PREVIEW_TITLE_FIELDS.find((field) => entries.some(([key]) => key === field))
  const title = titleField
    ? entries.find(([key]) => key === titleField)?.[1] || `${groupLabel} ${index + 1}`
    : `${groupLabel} ${index + 1}`
  const details = entries
    .filter(([key]) => key !== titleField)
    .slice(0, 4)
    .map(([key, field]) => `${previewLabel(key)}: ${field.length > 140 ? `${field.slice(0, 137)}…` : field}`)
  const searchableValues = entries.map(([key, field]) => `${key} ${field}`).join(' ')
  return { title, details, searchText: `${title} ${searchableValues}`.toLowerCase() }
}

export function DataMaintenance() {
  const app = useApp()
  const { hasRole } = useAuth()
  const toast = useToast()
  const license = useLicense()
  const canClear = hasRole('super_admin')

  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [previewSearch, setPreviewSearch] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [withBackup, setWithBackup] = useState(true)
  const [backupView, setBackupView] = useState<{ filename: string; json: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [storedDataVersion, setStoredDataVersion] = useState(0)
  const [promotionDocumentRows, setPromotionDocumentRows] = useState<PromotionDocumentPreview[]>([])
  const [clearing, setClearing] = useState(false)
  const [backupLoading, setBackupLoading] = useState(false)

  useEffect(() => {
    let active = true
    void listPromotionDocumentPreviews().then((rows) => {
      if (active) setPromotionDocumentRows(rows)
    })
    return () => { active = false }
  }, [storedDataVersion])

  const previewGroupsByKey = useMemo<Record<string, CollectionPreviewGroup[]>>(() => {
    const storedGroups = readPersistedCollectionGroups() as Record<string, CollectionPreviewGroup[]>
    const categories = (values: string[]) => values.map((name, index) => ({ name, position: index + 1 }))
    const moduleEntries = Object.entries(app.modules).map(([module, enabled]) => ({ module, enabled }))
    const subModuleEntries = Object.entries(app.subModules).map(([module, items]) => ({
      module,
      submodules: Array.isArray(items) ? items.join(', ') : String(items),
    }))
    const subMenuEntries = Object.entries(app.subMenuOrder).map(([module, items]) => ({
      module,
      order: Array.isArray(items) ? items.join(', ') : String(items),
    }))
    const groups: Record<string, CollectionPreviewGroup[]> = {
      users: [{ label: 'User accounts', records: app.users }],
      members: [{ label: 'Members', records: app.members }],
      trainers: [{ label: 'Trainers', records: app.trainers }],
      staff: [{ label: 'Staff records', records: app.staff }],
      plans: [{ label: 'Plans', records: app.plans }],
      memberships: [{ label: 'Memberships', records: app.memberships }],
      payments: [{ label: 'Payments', records: app.payments }],
      invoices: [
        { label: 'Invoices', records: app.invoices },
        { label: 'Invoice templates', records: app.invoiceTemplates },
      ],
      proposals: [{ label: 'Proposals', records: app.proposals }],
      estimates: [{ label: 'Estimates', records: app.estimates }],
      salesOrders: [{ label: 'Sales orders', records: app.salesOrders }],
      shipments: [{ label: 'Shipments', records: app.shipments }],
      discounts: [{ label: 'Discounts', records: app.discounts }],
      salesReturns: [{ label: 'Sales returns', records: app.salesReturns }],
      classes: [{ label: 'Classes', records: app.classes }],
      bookings: [{ label: 'Bookings', records: app.bookings }],
      attendance: [{ label: 'Attendance records', records: app.attendance }],
      workouts: [{ label: 'Workout plans', records: app.workouts }],
      progress: [{ label: 'Progress logs', records: app.progress }],
      notifications: [
        { label: 'Notifications', records: app.notifications },
        { label: 'Notification preferences', records: [toast.prefs] },
      ],
      subscriptions: [
        { label: 'Subscription packages', records: license.packages },
        { label: 'Organization subscriptions', records: license.orgSubs },
        { label: 'Subscription invoices', records: license.subInvoices },
        { label: 'Subscription history', records: license.subHistory },
        { label: 'Package audit entries', records: license.packageAudit },
      ],
      branches: [{ label: 'Branches', records: app.branches }],
      companies: [
        { label: 'Companies', records: app.companies },
        { label: 'Company profile settings', records: isCollectionMarkedCleared('companies') ? [] : [app.company] },
        { label: 'Product mode', records: isCollectionMarkedCleared('companies') ? [] : [{ productMode: app.productMode }] },
        { label: 'Active organization selection', records: isCollectionMarkedCleared('companies') ? [] : [{ activeCompanyId: app.activeCompanyId, activeBranchId: app.activeBranchId }] },
      ],
      branchSettings: [{ label: 'Branch settings', records: app.branchSettings }],
      customFields: [{ label: 'Custom field definitions', records: app.customFields }],
      cms: [{ label: 'Website content', records: isCollectionMarkedCleared('cms') ? [] : [app.cms] }],
      leads: [{ label: 'Leads', records: app.leads }],
      messages: [{ label: 'Messages', records: app.messages }],
      audit: [{ label: 'Audit events', records: app.audit }],
      leaves: [{ label: 'Leave requests', records: app.leaves }],
      sessions: [{ label: 'PT sessions', records: app.sessions }],
      departments: [{ label: 'Departments', records: app.departments }],
      payslips: [{ label: 'Payslips', records: app.payslips }],
      jobs: [{ label: 'Job postings', records: app.jobs }],
      candidates: [{ label: 'Candidates', records: app.candidates }],
      reviews: [{ label: 'Performance reviews', records: app.reviews }],
      staffAttendance: [{ label: 'Staff attendance', records: app.staffAttendance }],
      inventory: [
        { label: 'Stock items', records: app.inventory },
        { label: 'Suppliers', records: app.suppliers },
        { label: 'Stock movements', records: app.stockMovements },
        { label: 'Inventory categories', records: categories(app.inventoryCategories) },
        { label: 'Purchases', records: app.purchases },
        { label: 'Sales', records: app.sales },
      ],
      purchaseOrders: [{ label: 'Purchase orders', records: app.purchaseOrders }],
      purchaseReturns: [{ label: 'Purchase returns', records: app.purchaseReturns }],
      assets: [
        { label: 'Assets', records: app.assets },
        { label: 'Depreciation entries', records: app.depreciation },
        { label: 'Asset transactions', records: app.assetTransactions },
        { label: 'Asset categories', records: categories(app.assetCategories) },
        { label: 'Asset conditions', records: categories(app.assetConditions) },
        { label: 'Depreciation policy', records: isCollectionMarkedCleared('assets') ? [] : [app.depreciationPolicy] },
      ],
      customers: [
        { label: 'Customers', records: app.customers },
        { label: 'Supplier categories', records: categories(app.supplierCategories) },
        { label: 'Customer categories', records: categories(app.customerCategories) },
      ],
      modules: [
        { label: 'Modules', records: moduleEntries },
        { label: 'Submodules', records: subModuleEntries },
        { label: 'Sidebar order', records: app.sidebarOrder.map((module, index) => ({ module, position: index + 1 })) },
        { label: 'Submenu order', records: subMenuEntries },
      ],
      chartOfAccounts: [
        { label: 'Chart of accounts', records: app.accounts.filter((account) => account.accountTypeId !== 16) },
        { label: 'Chart of accounts notes', records: loadAccountNotes() },
        { label: 'Accounting settings', records: isCollectionMarkedCleared('chartOfAccounts') ? [] : [app.accountingSettings] },
        { label: 'Account detail types', records: app.detailTypes },
        { label: 'Currency rates', records: app.currencyRates },
      ],
      accountingVouchers: [
        { label: 'Receipts', records: app.receipts },
        { label: 'Payment vouchers', records: app.paymentVouchers },
        { label: 'Journal entries', records: app.journals },
        { label: 'Journal templates', records: app.journalTemplates },
        { label: 'Account history', records: app.accountHistory },
        { label: 'Voucher serials', records: app.voucherSerials },
        { label: 'Funds', records: app.funds },
        { label: 'Payment modes', records: app.paymentModes },
        { label: 'Income statement modules', records: app.incomeMods },
      ],
      bankingRecords: [
        { label: 'Bank accounts', records: app.banks },
        { label: 'Bank signatories', records: app.signatories },
        { label: 'Reconciliations', records: app.reconciliations },
      ],
      accountingBudgets: [{ label: 'Budgets', records: app.budgets }],
      valueBookRegisters: [{ label: 'Value book entries', records: app.valueBook }],
      cheques: [{ label: 'Cheques', records: app.cheques }],
      inventoryOperations: [
        { label: 'Stock adjustments', records: app.stockAdjustments },
        { label: 'Stock alerts', records: app.stockAlerts },
        { label: 'Stock counts', records: app.stockCounts },
        { label: 'Stock transfers', records: app.stockTransfers },
      ],
      purchasePayments: [{ label: 'Purchase payments', records: app.purchasePayments }],
      procurement: [
        { label: 'Goods receipts', records: app.goodsReceipts },
        { label: 'Procurement orders', records: app.procPurchaseOrders },
        { label: 'Procurement returns', records: app.procReturns },
        { label: 'Purchase requisitions', records: app.requisitions },
        { label: 'Supplier invoices', records: app.supplierInvoices },
        { label: 'Supplier payments', records: app.supplierPayments },
      ],
      assetSetup: [
        { label: 'Asset type categories', records: Object.entries(app.assetKindCategories).flatMap(([type, names]) => names.map((name) => ({ type, name }))) },
        { label: 'Depreciation policies', records: app.depreciationPolicies },
      ],
      stakeholders: [
        { label: 'Stakeholder classes', records: app.stakeholderClasses },
        { label: 'Stakeholder entities', records: app.stakeholderEntities },
      ],
      payroll: [
        { label: 'Salary benefits', records: app.salaryBenefits },
        { label: 'Salary structures', records: app.salaryStructures },
        { label: 'Salary assignments', records: app.salaryAssignments },
        { label: 'Payroll adjustments', records: app.payrollAdj },
        { label: 'Staff loans', records: app.loans },
        { label: 'Loan installments', records: app.loanInstallments },
        { label: 'Loan policy', records: isCollectionMarkedCleared('payroll') ? [] : [app.loanPolicy] },
        { label: 'Loan products', records: app.loanPolicy.loanTypes ?? [] },
      ],
      leaveSettings: [{ label: 'Leave types', records: app.leaveTypes }],
      workSchedules: [{ label: 'Work shifts', records: app.shifts }],
      employeePromotions: [{ label: 'Promotion documents', records: promotionDocumentRows }],
      projects: [
        { label: 'Projects', records: app.projects },
        { label: 'Contracts', records: app.contracts },
        { label: 'Contract types', records: app.contractTypes },
        { label: 'Project tasks', records: app.tasks },
        { label: 'Work stages', records: app.workStages },
        { label: 'Task templates', records: app.taskTemplates },
        { label: 'Timesheets', records: app.timesheets },
        { label: 'Project invoices', records: app.projectInvoices },
        { label: 'Project types', records: app.projectTypes },
        { label: 'Project statuses', records: app.projectStatuses },
        { label: 'Project priorities', records: app.projectPriorities },
        { label: 'Project categories', records: app.projectCategories },
      ],
      messageTemplates: [{ label: 'Message templates', records: app.messageTemplates }],
      systemSettings: [{ label: 'System settings', records: isCollectionMarkedCleared('systemSettings') ? [] : [app.systemSettings] }],
      paymentSettings: [{ label: 'Payment settings', records: isCollectionMarkedCleared('paymentSettings') ? [] : [app.paymentSettings] }],
      credentialEvents: [{ label: 'Credential events', records: app.credentialEvents }],
      roles: [{ label: 'Custom roles', records: app.roles.filter((role) => !role.builtin) }],
      permissions: [{ label: 'Custom permissions', records: app.permissions.filter((permission) => !permission.builtin) }],
      integrations: [
        { label: 'Integration settings', records: loadIntegrations() },
        { label: 'Integration activity', records: loadIntegrationLogs() },
      ],
    }
    for (const [key, stored] of Object.entries(storedGroups)) {
      groups[key] = [...(groups[key] ?? []), ...stored]
    }
    return groups
  }, [app, license, toast, storedDataVersion, promotionDocumentRows])

  const counts = useMemo<Record<string, number>>(() => Object.fromEntries(
    DATA_COLLECTIONS.map((collection) => [
      collection.key,
      (previewGroupsByKey[collection.key] ?? []).reduce((total, group) => total + group.records.length, 0),
    ]),
  ), [previewGroupsByKey])

  const toggle = (key: string) => {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]))
  }

  const filteredCollections = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return DATA_COLLECTIONS
    return DATA_COLLECTIONS.filter((collection) =>
      `${collection.module} ${collection.label} ${collection.desc} ${collection.key}`.toLowerCase().includes(query),
    )
  }, [search])

  const filteredCollectionGroups = useMemo(() => {
    const grouped = new Map<string, typeof DATA_COLLECTIONS>()
    filteredCollections.forEach((collection) => {
      const current = grouped.get(collection.module) ?? []
      current.push(collection)
      grouped.set(collection.module, current)
    })
    return [...grouped.entries()]
      .map(([module, collections]) => ({
        module,
        collections: collections.slice().sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })),
      }))
      .sort((a, b) => a.module.localeCompare(b.module, undefined, { sensitivity: 'base' }))
  }, [filteredCollections])

  const selectedCollections = useMemo(
    () => DATA_COLLECTIONS.filter((collection) => selected.includes(collection.key)),
    [selected],
  )
  const selectedRecordCount = selectedCollections.reduce((total, collection) => total + (counts[collection.key] ?? 0), 0)
  const previewCollection = DATA_COLLECTIONS.find((collection) => collection.key === previewKey)

  const openPreview = (key: string) => {
    setPreviewKey(key)
    setPreviewSearch('')
  }

  const previewGroups = useMemo(() => {
    const query = previewSearch.trim().toLowerCase()
    const groups = (previewKey ? previewGroupsByKey[previewKey] ?? [] : [])
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    return groups.map((group) => ({
      ...group,
      items: group.records
        .map((record, index) => {
          const item = toPreviewItem(record, group.label, index)
          if (group.label !== 'Chart of accounts') return item
          const account = record as { accountTypeId?: number; type?: string }
          const accountType = accountTypeName(account.accountTypeId) ?? ''
          return { ...item, searchText: `${item.searchText} ${accountType} ${account.type ?? ''}`.toLowerCase() }
        })
        .filter((item) => !query || item.searchText.includes(query)),
    }))
  }, [previewKey, previewGroupsByKey, previewSearch])
  const previewRecordCount = previewGroups.reduce((total, group) => total + group.records.length, 0)
  const matchingPreviewCount = previewGroups.reduce((total, group) => total + group.items.length, 0)

  const previewAccounts = useMemo(() => {
    if (previewKey !== 'chartOfAccounts') return []
    const query = previewSearch.trim().toLowerCase()
    return app.accounts
      .filter((account, index) => {
        if (account.accountTypeId === 16) return false
        if (!query) return true
        const item = toPreviewItem(account, 'Chart of accounts', index)
        const accountType = accountTypeName(account.accountTypeId) ?? ''
        return `${item.searchText} ${accountType} ${account.type}`.toLowerCase().includes(query)
      })
      .slice()
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
  }, [previewKey, previewSearch, app.accounts])

  const allVisibleSelected = filteredCollections.length > 0 && filteredCollections.every((collection) => selected.includes(collection.key))

  const toggleAll = () => {
    const visibleKeys = new Set(filteredCollections.map((collection) => collection.key))
    setSelected((current) => {
      if (filteredCollections.length > 0 && filteredCollections.every((collection) => current.includes(collection.key))) {
        return current.filter((key) => !visibleKeys.has(key))
      }
      return [...new Set([...current, ...visibleKeys])]
    })
  }

  const snapshot = async () => ({
    company: app.company,
    companies: app.companies,
    activeCompanyId: app.activeCompanyId,
    activeBranchId: app.activeBranchId,
    productMode: app.productMode,
    users: app.users,
    members: app.members,
    trainers: app.trainers,
    staff: app.staff,
    plans: app.plans,
    memberships: app.memberships,
    payments: app.payments,
    invoices: app.invoices,
    invoiceTemplates: app.invoiceTemplates,
    classes: app.classes,
    bookings: app.bookings,
    attendance: app.attendance,
    workouts: app.workouts,
    progress: app.progress,
    notifications: app.notifications,
    branches: app.branches,
    branchSettings: app.branchSettings,
    customFields: app.customFields,
    cms: app.cms,
    leads: app.leads,
    messages: app.messages,
    audit: app.audit,
    leaves: app.leaves,
    sessions: app.sessions,
    inventory: app.inventory,
    inventoryCategories: app.inventoryCategories,
    suppliers: app.suppliers,
    stockMovements: app.stockMovements,
    stockTransfers: app.stockTransfers,
    stockAdjustments: app.stockAdjustments,
    stockCounts: app.stockCounts,
    stockAlerts: app.stockAlerts,
    purchases: app.purchases,
    purchasePayments: app.purchasePayments,
    purchaseOrders: app.purchaseOrders,
    requisitions: app.requisitions,
    procPurchaseOrders: app.procPurchaseOrders,
    goodsReceipts: app.goodsReceipts,
    supplierInvoices: app.supplierInvoices,
    supplierPayments: app.supplierPayments,
    procurementReturns: app.procReturns,
    purchaseReturns: app.purchaseReturns,
    sales: app.sales,
    proposals: app.proposals,
    estimates: app.estimates,
    salesOrders: app.salesOrders,
    shipments: app.shipments,
    salesReturns: app.salesReturns,
    discounts: app.discounts,
    departments: app.departments,
    payslips: app.payslips,
    jobs: app.jobs,
    candidates: app.candidates,
    reviews: app.reviews,
    staffAttendance: app.staffAttendance,
    messageTemplates: app.messageTemplates,
    leaveTypes: app.leaveTypes,
    workShifts: app.shifts,
    salaryBenefits: app.salaryBenefits,
    salaryStructures: app.salaryStructures,
    salaryAssignments: app.salaryAssignments,
    payrollAdjustments: app.payrollAdj,
    staffLoans: app.loans,
    loanInstallments: app.loanInstallments,
    loanPolicy: app.loanPolicy,
    projects: app.projects,
    contracts: app.contracts,
    projectTasks: app.tasks,
    workStages: app.workStages,
    taskTemplates: app.taskTemplates,
    timesheets: app.timesheets,
    projectInvoices: app.projectInvoices,
    projectTypes: app.projectTypes,
    contractTypes: app.contractTypes,
    projectStatuses: app.projectStatuses,
    projectPriorities: app.projectPriorities,
    projectCategories: app.projectCategories,
    assets: app.assets,
    depreciation: app.depreciation,
    assetTransactions: app.assetTransactions,
    assetKindCategories: app.assetKindCategories,
    depreciationPolicies: app.depreciationPolicies,
    stakeholders: { classes: app.stakeholderClasses, entities: app.stakeholderEntities },
    systemSettings: app.systemSettings,
    paymentSettings: app.paymentSettings,
    customers: app.customers,
    supplierCategories: app.supplierCategories,
    customerCategories: app.customerCategories,
    modules: app.modules,
    subModules: app.subModules,
    sidebarOrder: app.sidebarOrder,
    subMenuOrder: app.subMenuOrder,
    accounts: app.accounts,
    accountingSettings: app.accountingSettings,
    accountHistory: app.accountHistory,
    accountNotes: loadAccountNotes(),
    receipts: app.receipts,
    paymentVouchers: app.paymentVouchers,
    journals: app.journals,
    journalTemplates: app.journalTemplates,
    banks: app.banks,
    signatories: app.signatories,
    voucherSerials: app.voucherSerials,
    funds: app.funds,
    paymentModes: app.paymentModes,
    detailTypes: app.detailTypes,
    incomeMods: app.incomeMods,
    currencyRates: app.currencyRates,
    reconciliations: app.reconciliations,
    budgets: app.budgets,
    valueBook: app.valueBook,
    cheques: app.cheques,
    assetCategories: app.assetCategories,
    assetConditions: app.assetConditions,
    depreciationPolicy: app.depreciationPolicy,
    credentialEvents: app.credentialEvents,
    credentialSettings: app.credentialSettings,
    roles: app.roles,
    permissions: app.permissions,
    integrations: loadIntegrations(),
    integrationLogs: loadIntegrationLogs(),
    notificationPreferences: toast.prefs,
    organizationSubscriptions: {
      packages: license.packages,
      organizations: license.orgSubs,
      invoices: license.subInvoices,
      history: license.subHistory,
      packageAudit: license.packageAudit,
    },
    promotionDocumentMetadata: promotionDocumentRows,
    promotionDocumentFiles: await exportPromotionDocuments(),
    persistedCollections: snapshotPersistedCollections(),
  })

  const downloadBackup = async () => {
    if (backupLoading) return
    setBackupLoading(true)
    try {
      setBackupView(buildBackup(await snapshot()))
    } catch {
      toast.error('Could not prepare backup', 'Promotion-document storage could not be read. No backup was created.')
    } finally {
      setBackupLoading(false)
    }
  }

  const doDownload = async () => {
    if (backupLoading) return
    setBackupLoading(true)
    try {
      const { filename, json } = buildBackup(await snapshot())
      const ok = await downloadText(filename, json, 'application/json')
      if (ok) {
        toast.success('Download started', 'Check your browser downloads. If nothing appears, use Copy to clipboard.')
      } else {
        toast.error('Download blocked', 'Your browser blocked the download. Use Copy to clipboard instead.')
      }
    } catch {
      toast.error('Could not prepare backup', 'Promotion-document storage could not be read. No backup was created.')
    } finally {
      setBackupLoading(false)
    }
  }

  const copyBackup = async () => {
    if (!backupView) return
    try {
      await navigator.clipboard.writeText(backupView.json)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy', 'Select the text below and copy it manually.')
    }
  }

  const doClear = async () => {
    if (!canClear || clearing || !selected.length) return
    setClearing(true)
    let backupDownloadBlocked = false
    try {
      if (withBackup) {
        const backup = buildBackup(await snapshot())
        const downloaded = await downloadText(backup.filename, backup.json, 'application/json')
        if (!downloaded) {
          setBackupView(backup)
          backupDownloadBlocked = true
        }
      }
      if (selected.includes('employeePromotions')) {
        const documentsCleared = await clearAllPromotionDocuments()
        if (!documentsCleared) {
          toast.error('Could not clear promotion documents', 'The IndexedDB document store was unavailable, so the selected collections were left unchanged.')
          return
        }
      }
      app.resetData(selected, 'clear')
      if (selected.includes('subscriptions')) {
        const defaultCompanyId = selected.includes('companies')
          ? app.companies.find((company) => company.isDefault)?.id || app.companies[0]?.id || app.activeCompanyId
          : app.activeCompanyId
        license.resetOrganizationSubscriptionData(defaultCompanyId, 'clear')
      }
      if (selected.includes('notifications')) {
        try { toast.refreshPrefs() } catch { /* the data clear already reset persistent notification preferences */ }
      }
      setStoredDataVersion((version) => version + 1)
      const labels = selectedCollections.map((collection) => collection.label).join(', ')
      if (!selected.includes('audit')) {
        app.log('system', 'CLEAR', 'Data', `Cleared ${selected.length} collection(s): ${labels}${withBackup ? (backupDownloadBlocked ? ' · backup prepared; download blocked' : ' · backup created first') : ''}`)
      }
      if (backupDownloadBlocked) {
        toast.error('Data cleared; backup download blocked', 'The prepared backup is open. Copy it from the backup window if you still need a saved copy.')
      } else {
        toast.success('Data cleared', withBackup
          ? `${selected.length} collection(s) emptied. A backup was downloaded first.`
          : `${selected.length} collection(s) emptied.`)
      }
      setSelected([])
      setPreviewKey(null)
      setConfirm(false)
    } catch {
      toast.error('Could not clear data', 'The selected collections could not be emptied. Check browser storage access and try again.')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="card mt-4 max-w-3xl p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
          <AlertTriangle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Clear database</p>
          <p className="mt-1 text-sm text-mist">
            Select collection groups to permanently empty. On confirmation, their records are cleared instead of restoring demo rows. Some screens may need data re-entered before use. Create and save a backup first—this cannot be undone here.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void downloadBackup()} disabled={backupLoading || clearing}>
          <Download className="size-4" /> {backupLoading ? 'Preparing…' : 'Create backup'}
        </Button>
      </div>

      {!canClear && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <p className="text-sm">
            <span className="font-semibold">Super admin only.</span> You can create a backup, but clearing the database is reserved for the super admin role.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search modules or collections…"
          className="w-full sm:max-w-sm"
        />
        <span className="text-xs text-mist sm:text-right">Showing {filteredCollections.length} of {DATA_COLLECTIONS.length} collections</span>
      </div>

      <div className="mt-3 flex items-center justify-between border-b border-line pb-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="size-4 accent-[#c8f542]" checked={allVisibleSelected} onChange={toggleAll} disabled={!canClear || !filteredCollections.length} />
          {search.trim() ? 'Select matching' : 'Select all'}
        </label>
        {selected.length ? (
          <button
            type="button"
            onClick={() => openPreview(selected[0])}
            aria-label="Preview selected collections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime hover:underline"
          >
            <Eye className="size-3.5" /> {selected.length} selected · Preview data
          </button>
        ) : (
          <span className="text-xs text-mist">0 selected</span>
        )}
      </div>

      <div className="mt-2 max-h-[46vh] space-y-4 overflow-y-auto pr-1">
        {filteredCollectionGroups.map(({ module, collections }) => (
          <section key={module} className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line/70 px-2 pb-1 pt-2 first:pt-0">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime">{module}</h3>
              <span className="text-[11px] text-mist">{collections.filter((collection) => selected.includes(collection.key)).length} of {collections.length} selected</span>
            </div>
            {collections.map((c) => {
              const on = selected.includes(c.key)
              const n = counts[c.key] ?? 0
              return (
                <div
                  key={c.key}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl px-3 py-2.5 text-sm transition sm:flex-row sm:items-center sm:gap-3',
                    on ? 'bg-lime/10 ring-1 ring-lime' : 'hover:bg-white/5',
                    !canClear && 'opacity-60',
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" className="size-4 shrink-0 accent-[#c8f542]" checked={on} onChange={() => toggle(c.key)} disabled={!canClear} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{c.label}</span>
                      <span className="block truncate text-xs text-mist">{c.desc}</span>
                    </span>
                  </label>
                  <div className="flex items-center justify-between gap-2 pl-7 sm:pl-0">
                    <Badge tone={n > 0 ? 'lime' : 'zinc'}>{n} record{n === 1 ? '' : 's'}</Badge>
                    {on && (
                      <Button type="button" variant="outline" size="sm" onClick={() => openPreview(c.key)} aria-label={`Preview ${c.label}`}>
                        <Eye className="size-3.5" /> Preview
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        ))}
        {!filteredCollections.length && (
          <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mist">
            No collections match “{search}”. Try a different search.
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <p className="max-w-xl text-xs text-mist">Counts include records grouped under each checkbox. Confirming empties the selected groups; demo records are not restored.</p>
        <Button variant="danger" disabled={!selected.length || !canClear} onClick={() => setConfirm(true)}>
          <Trash2 className="size-4" /> Clear {selected.length || ''} selected
        </Button>
      </div>

      <Modal
        open={!!previewKey}
        onClose={() => setPreviewKey(null)}
        title={`${previewCollection?.label ?? 'Selected collection'} — preview`}
        xl
        zIndex={90}
      >
        <div className="space-y-3">
          <p className="text-sm text-mist">
            Read-only preview of current records. Credential, password, token, and secret fields are omitted.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              {selectedCollections.length > 1 && (
                <label className="block w-full text-xs font-semibold sm:max-w-xs">
                  Selected collection
                  <select
                    className="field mt-1 w-full"
                    value={previewKey ?? ''}
                    onChange={(event) => openPreview(event.target.value)}
                  >
                    {selectedCollections.map((collection) => (
                      <option key={collection.key} value={collection.key}>{collection.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <SearchField
                value={previewSearch}
                onChange={setPreviewSearch}
                placeholder="Search records…"
                className="w-full sm:max-w-sm"
              />
            </div>
            <span className="shrink-0 text-xs text-mist">Showing {matchingPreviewCount} of {previewRecordCount} records</span>
          </div>
          {matchingPreviewCount > 0 ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {previewGroups.map((group) => group.items.length > 0 && (
                <section key={group.label} className="rounded-xl border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-semibold">{group.label}</h4>
                    <span className="text-xs text-mist">{group.items.length} of {group.records.length} records</span>
                  </div>
                  {group.label === 'Chart of accounts' && previewKey === 'chartOfAccounts' ? (
                    <div className="max-h-[42vh] overflow-auto rounded-lg border border-line">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-black/10 text-xs font-bold uppercase tracking-wide dark:bg-white/10">
                            <th className="px-3 py-2.5">Code</th>
                            <th className="px-3 py-2.5">Account name</th>
                            <th className="px-3 py-2.5">Class</th>
                            <th className="px-3 py-2.5">Account type</th>
                            <th className="px-3 py-2.5">Detail type</th>
                            <th className="px-3 py-2.5 text-right">Primary balance</th>
                            <th className="px-3 py-2.5 text-right">Bank balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {previewAccounts.map((account) => (
                            <tr key={account.id} className="hover:bg-white/5">
                              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{account.code || '—'}</td>
                              <td className="min-w-48 px-3 py-2.5 font-medium">{account.name || '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5">{ACCOUNT_CLASS_LABELS[account.type] ?? account.type}</td>
                              <td className="px-3 py-2.5 text-mist">{accountTypeName(account.accountTypeId) || '—'}</td>
                              <td className="px-3 py-2.5 text-mist">{account.detailType || '—'}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">{formatGhsExact(account.primaryBalance ?? 0)}</td>
                              <td className="whitespace-nowrap px-3 py-2.5 text-right">{account.bankBalance == null ? '—' : formatGhsExact(account.bankBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="divide-y divide-line">
                      {group.items.slice(0, 50).map((item, index) => (
                        <div key={`${group.label}-${index}`} className="py-2 first:pt-1 last:pb-1">
                          <p className="break-words text-sm font-semibold">{item.title}</p>
                          {item.details.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
                              {item.details.map((detail) => <span key={detail}>{detail}</span>)}
                            </div>
                          )}
                        </div>
                      ))}
                      {group.items.length > 50 && (
                        <p className="pt-2 text-xs text-mist">Showing the first 50 matching records. Use search to narrow the preview.</p>
                      )}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-mist">
              {previewRecordCount ? `No records match “${previewSearch}”. Try a different search.` : 'There are no records in this collection to preview.'}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!backupView} onClose={() => setBackupView(null)} title="Backup created" wide>
        {backupView && (
          <div className="space-y-3">
            <p className="text-sm text-mist">
              Your backup snapshot (<span className="font-mono text-xs">{backupView.filename}</span>) is ready. It contains clearable records and uploaded promotion attachments, so it may be large; keep the JSON file private and secure.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void doDownload()} disabled={backupLoading}>
                <Download className="size-4" /> {backupLoading ? 'Preparing…' : 'Download .json'}
              </Button>
              <Button variant="outline" onClick={() => void copyBackup()}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy to clipboard'}
              </Button>
            </div>
            <p className="text-xs text-mist">
              If the download doesn&apos;t appear (some embedded/sandboxed windows block downloads), use <span className="font-semibold">Copy to clipboard</span> or select the text below and save it as a <span className="font-mono">.json</span> file.
            </p>
            <textarea
              readOnly
              value={backupView.json}
              rows={12}
              className="field w-full resize font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </div>
        )}
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Clear selected data?" wide>
        <div className="space-y-3">
          <p className="text-sm text-mist">
            You are about to permanently empty <span className="font-semibold text-inherit">{selected.length}</span> selected collection(s), including <span className="font-semibold text-inherit">{selectedRecordCount}</span> current record(s). No demo data will be restored.
          </p>
          <p className="text-xs text-mist">Review a collection&apos;s read-only data preview before confirming. Credential and secret fields are hidden.</p>
          {selected.includes('subscriptions') && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-500">
              Organization subscriptions affect package access. Clearing this group empties subscription packages, organization subscriptions, invoices, history, and package audit records. Separate time-based license plans, activation codes, license payments, and license logs remain untouched.
            </p>
          )}
          <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-line p-3 text-sm">
            {selectedCollections.map((collection) => {
              const count = counts[collection.key] ?? 0
              return (
                <li key={collection.key} className="flex flex-col gap-2 rounded-lg border border-line/70 p-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="size-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
                    <span className="truncate">{collection.label}</span>
                  </span>
                  <div className="flex items-center justify-between gap-2 pl-3 sm:pl-0">
                    <Badge tone={count > 0 ? 'lime' : 'zinc'}>{count} record{count === 1 ? '' : 's'}</Badge>
                    <Button type="button" variant="outline" size="sm" onClick={() => openPreview(collection.key)}>
                      <Eye className="size-3.5" /> Preview
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-[#c8f542]"
              checked={withBackup}
              onChange={(e) => setWithBackup(e.target.checked)}
            />
            <span>
              <span className="font-semibold">Create a backup before clearing</span>
              <span className="block text-xs text-mist">Download a full JSON snapshot of the clearable data first. It includes sensitive record data and uploaded promotion files; keep it secure.</span>
            </span>
          </label>
          <p className="text-xs text-amber-500">This permanently empties the selected groups, including their records and settings. No defaults or demo rows will be restored; this cannot be undone here.</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => void doClear()} disabled={clearing || !canClear || !selected.length}>
              <Trash2 className="size-4" /> {clearing ? 'Clearing…' : 'Clear selected data'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
