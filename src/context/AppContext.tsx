import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Attendance, AuditLog, Booking, Branch, GymClass, Invoice, Lead, LeaveRequest,
  Member, Membership, Message, NotificationItem, Payment, Plan, ProgressLog,
  SessionBooking, StaffRecord, Trainer, User, WorkoutPlan, CompanySettings,
  CredentialEvent, CredentialSettings, CredentialScope, CredentialChannel,
  CredentialDeliveryResult, InitialPasswordMode, GatewayPaymentInput, PaymentMethod,
  Permission, RoleDef, PaymentSettings, InventoryItem, Supplier, StockTransaction, StockMovementType,
  Purchase, Sale, PurchaseLine, SaleLine, PurchaseStatus, SaleStatus,
  Proposal, Estimate, SalesOrder, PurchaseOrder, PurchaseReturn, Shipment, Discount, SalesReturn,
  Department, Payslip, JobPosting, Candidate, PerformanceReview, StaffAttendance,
  Asset,
  DepreciationEntry,
  AssetTransaction,
  DepreciationPolicy,
  Customer,
  Account, AccountingSettings, ReceiptVoucher, PaymentVoucher, JournalVoucher,
  BankAccount, BankReconciliation, BankSignatory, Budget, ValueBookEntry, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate,
  Company, ProductMode,
  BranchSettings,
  CustomField, CustomFieldValues,
} from '../types'
import {
  loadCompanies, saveCompanies, loadActiveCompanyId, saveActiveCompanyId,
  loadActiveBranchId, saveActiveBranchId, loadProductMode, saveProductMode,
  DEFAULT_COMPANY, COMPANIES_KEY, ACTIVE_COMPANY_KEY, ACTIVE_BRANCH_KEY,
} from '../lib/companies'
import { loadBranchSettings, saveBranchSettings, BRANCH_SETTINGS_KEY } from '../lib/branchSettings'
import { loadCustomFields, saveCustomFields, CUSTOM_FIELDS_KEY } from '../lib/customFields'
import { loadCms, saveCms, CMS_KEY, DEFAULT_CMS_DATA, type CmsData } from '../lib/cms'
import {
  ATTENDANCE, AUDIT, BOOKINGS, BRANCHES, CLASSES, COMPANY, INVOICES, LEADS, LEAVES,
  MEMBERS, MEMBERSHIPS, MESSAGES, NOTIFICATIONS, PAYMENTS, PLANS, PROGRESS,
  SESSIONS, STAFF, TRAINERS, USERS, WORKOUTS,
} from '../data/seed'
import { uid } from '../lib/utils'
import { generateUsername, hashPassword, takenUsernames } from '../lib/password'
import {
  CRED_EVENTS_KEY, USERS_KEY, issueInitialPassword, loadCredentialSettings, loadReveal,
  saveCredentialSettings, saveReveal,
} from '../lib/credentials'
import { applyBrandColor, applyButtonColor, applyChromeColors, normalizeHex } from '../lib/color'
import { loadPermissions, loadRoles, savePermissions, saveRoles, BUILTIN_PERMISSIONS, BUILTIN_ROLES, ROLE_STORE_KEY, PERM_STORE_KEY } from '../lib/permissions'
import { INT_LOG_KEY, INT_STORE_KEY } from '../lib/integrations'
import { loadPaymentSettings, savePaymentSettings, defaultPaymentMethod } from '../lib/payments'
import { loadInventory, saveInventory, loadSuppliers, saveSuppliers, loadStockMovements, saveStockMovements, loadCategories, saveCategories, loadPurchases, savePurchases, loadSales, saveSales, loadPurchaseOrders, savePurchaseOrders, loadPurchaseReturns, savePurchaseReturns, nextPurchaseNumber, nextSaleNumber, INVENTORY, SUPPLIERS, STOCK_MOVEMENTS, PURCHASES, SALES, PURCHASE_ORDERS, PURCHASE_RETURNS, DEFAULT_INVENTORY_CATEGORIES, INVENTORY_KEY, SUPPLIERS_KEY, STOCK_MOVEMENTS_KEY, CATEGORIES_KEY, PURCHASES_KEY, SALES_KEY, PURCHASE_ORDERS_KEY, PURCHASE_RETURNS_KEY } from '../lib/inventory'
import { loadProposals, saveProposals, loadEstimates, saveEstimates, loadSalesOrders, saveSalesOrders, PROPOSALS, ESTIMATES, SALES_ORDERS, PROPOSALS_KEY, ESTIMATES_KEY, ORDERS_KEY } from '../lib/quotes'
import { loadShipments, saveShipments, SHIPMENTS, SHIPMENTS_KEY } from '../lib/shipments'
import { loadDiscounts, saveDiscounts, DISCOUNTS, DISCOUNTS_KEY } from '../lib/discounts'
import { loadSalesReturns, saveSalesReturns, SALES_RETURNS, SALES_RETURNS_KEY } from '../lib/salesReturns'
import { loadDepartments, saveDepartments, loadPayslips, savePayslips, loadJobs, saveJobs, loadCandidates, saveCandidates, loadReviews, saveReviews, loadStaffAttendance, saveStaffAttendance, DEPARTMENTS, PAYSLIPS, JOBS, CANDIDATES, REVIEWS, STAFF_ATTENDANCE, DEPARTMENTS_KEY, PAYSLIPS_KEY, JOBS_KEY, CANDIDATES_KEY, REVIEWS_KEY, STAFF_ATTENDANCE_KEY } from '../lib/hrm'
import { loadAssets, saveAssets, ASSETS, ASSETS_KEY } from '../lib/assets'
import { loadDepreciation, saveDepreciation, DEPRECIATION_ENTRIES, DEPRECIATION_KEY } from '../lib/depreciation'
import { loadAssetTransactions, saveAssetTransactions, ASSET_TRANSACTIONS, ASSET_TRANSACTIONS_KEY } from '../lib/assetTransactions'
import { loadCustomers, saveCustomers, CUSTOMERS, CUSTOMERS_KEY } from '../lib/customers'
import { loadModules, saveModules, defaultModuleState, loadSidebarOrder, saveSidebarOrder, defaultSidebarOrder, MODULES_KEY, SIDEBAR_ORDER_KEY, type ModuleState } from '../lib/modules'
import {
  loadAccounts, saveAccounts, loadAccountingSettings, saveAccountingSettings,
  loadReceipts, saveReceipts, loadPayments, savePayments, loadJournals, saveJournals,
  loadBanks, saveBanks, loadReconciliations, saveReconciliations, loadBudgets, saveBudgets,
  loadValueBook, saveValueBook, loadSignatories, saveSignatories, loadSerials, saveSerials, loadFunds, saveFunds, loadPaymentModes, savePaymentModes, loadDetailTypes, saveDetailTypes, loadIncomeMods, saveIncomeMods, loadCurrencyRates, saveCurrencyRates, ACCOUNTS, RECEIPTS, PAYMENTS as PAYMENT_VOUCHERS, JOURNALS, BANKS, RECONCILIATIONS, BUDGETS, VALUE_BOOK, SIGNATORIES, SERIALS, FUNDS, PAYMENT_MODES, DETAIL_TYPES, INCOME_MODS, CURRENCY_RATES, DEFAULT_ACCOUNTING_SETTINGS,
  ACCOUNTS_KEY, ACCT_SETTINGS_KEY, RECEIPTS_KEY, PAYMENTS_KEY, JOURNALS_KEY, BANKS_KEY, RECON_KEY, BUDGETS_KEY, VALUEBOOK_KEY, SIGNATORIES_KEY, SERIALS_KEY, FUNDS_KEY, PAYMENT_MODES_KEY, DETAIL_TYPES_KEY, INCOME_MODS_KEY, CURRENCY_RATES_KEY,
} from '../lib/accounting'
import {
  loadSupplierCategories, saveSupplierCategories, loadCustomerCategories, saveCustomerCategories,
  DEFAULT_SUPPLIER_CATEGORIES, DEFAULT_CUSTOMER_CATEGORIES, SUPPLIER_CATEGORIES_KEY, CUSTOMER_CATEGORIES_KEY,
} from '../lib/peopleCategories'
import {
  loadAssetCategories, saveAssetCategories, loadAssetConditions, saveAssetConditions,
  loadDepreciationPolicy, saveDepreciationPolicy, DEFAULT_ASSET_CATEGORIES, DEFAULT_ASSET_CONDITIONS, DEFAULT_DEPRECIATION_POLICY,
  ASSET_CATEGORIES_KEY, ASSET_CONDITIONS_KEY, DEPRECIATION_POLICY_KEY,
} from '../lib/assetSettings'

interface CreateMemberInput {
  name: string
  email: string
  password: string
  phone: string
  planId?: string
  branchId?: string
  gender?: Member['gender']
  dob?: string
  address?: string
  tags?: string[]
  goals?: string[]
  medicalNotes?: string
  emergency?: Member['emergency']
  heightCm?: number
  weightKg?: number
  trainerId?: string
  avatar?: string
  customFields?: CustomFieldValues
  status?: User['status']
  emailVerified?: boolean
  emailVerifyToken?: string
  emailVerifyExpires?: string
  username?: string
  mustChangePassword?: boolean
}

export interface RegenerateCredentialsInput {
  memberId?: string
  userId?: string
  adminId: string
  adminName: string
  scope: CredentialScope
  channels: CredentialChannel[]
  passwordMode?: InitialPasswordMode
}

export interface RegenerateCredentialsResult {
  ok: boolean
  error?: string
  event?: CredentialEvent
  username?: string
  tempPassword?: string
  passwordChanged?: boolean
  usernameChanged?: boolean
}

interface AppStore {
  users: User[]
  members: Member[]
  trainers: Trainer[]
  staff: StaffRecord[]
  plans: Plan[]
  memberships: Membership[]
  payments: Payment[]
  invoices: Invoice[]
  classes: GymClass[]
  bookings: Booking[]
  attendance: Attendance[]
  workouts: WorkoutPlan[]
  progress: ProgressLog[]
  notifications: NotificationItem[]
  branches: Branch[]
  leads: Lead[]
  messages: Message[]
  audit: AuditLog[]
  leaves: LeaveRequest[]
  sessions: SessionBooking[]
  companies: Company[]
  activeCompanyId: string
  activeBranchId: string
  activeCompany: Company | null
  activeBranch: Branch | null
  productMode: ProductMode
  branchSettings: BranchSettings[]
  customFields: CustomField[]
  cms: CmsData
  inventory: InventoryItem[]
  suppliers: Supplier[]
  stockMovements: StockTransaction[]
  inventoryCategories: string[]
  purchases: Purchase[]
  sales: Sale[]
  purchaseOrders: PurchaseOrder[]
  purchaseReturns: PurchaseReturn[]
  shipments: Shipment[]
  discounts: Discount[]
  salesReturns: SalesReturn[]
  departments: Department[]
  payslips: Payslip[]
  jobs: JobPosting[]
  candidates: Candidate[]
  reviews: PerformanceReview[]
  staffAttendance: StaffAttendance[]
  assets: Asset[]
  depreciation: DepreciationEntry[]
  assetTransactions: AssetTransaction[]
  assetCategories: string[]
  assetConditions: string[]
  depreciationPolicy: DepreciationPolicy
  customers: Customer[]
  supplierCategories: string[]
  customerCategories: string[]
  modules: ModuleState
  sidebarOrder: string[]
  accounts: Account[]
  accountingSettings: AccountingSettings
  receipts: ReceiptVoucher[]
  paymentVouchers: PaymentVoucher[]
  journals: JournalVoucher[]
  banks: BankAccount[]
  signatories: BankSignatory[]
  voucherSerials: VoucherSerial[]
  funds: Fund[]
  paymentModes: PaymentModeOption[]
  detailTypes: AccountDetailType[]
  incomeMods: IncomeStatementMod[]
  currencyRates: CurrencyRate[]
  reconciliations: BankReconciliation[]
  budgets: Budget[]
  valueBook: ValueBookEntry[]
  proposals: Proposal[]
  estimates: Estimate[]
  salesOrders: SalesOrder[]
  company: CompanySettings
  setCompany: (c: CompanySettings) => void
  credentialEvents: CredentialEvent[]
  credentialSettings: CredentialSettings
  setCredentialSettings: (s: CredentialSettings) => void
  paymentSettings: PaymentSettings
  setPaymentSettings: (s: PaymentSettings) => void
  regenerateMemberCredentials: (input: RegenerateCredentialsInput) => Promise<RegenerateCredentialsResult>
  recordCredentialDelivery: (eventId: string, deliveries: CredentialDeliveryResult[]) => void
  appendCredentialEvent: (event: CredentialEvent) => void
  patchUser: (id: string, patch: Partial<User>) => void
  upsertUser: (u: User) => void
  deleteUser: (id: string) => void
  upsertMember: (m: Member) => void
  deleteMember: (id: string) => void
  upsertStaff: (s: StaffRecord) => void
  upsertTrainer: (t: Trainer) => void
  deleteTrainer: (id: string) => void
  upsertPlan: (p: Plan) => void
  deletePlan: (id: string) => void
  upsertClass: (c: GymClass) => void
  deleteClass: (id: string) => void
  upsertLead: (l: Lead) => void
  deleteLead: (id: string) => void
  upsertPayment: (p: Payment) => void
  upsertInvoice: (i: Invoice) => void
  deleteInvoice: (id: string) => void
  upsertProposal: (p: Proposal) => void
  deleteProposal: (id: string) => void
  upsertEstimate: (e: Estimate) => void
  deleteEstimate: (id: string) => void
  upsertSalesOrder: (o: SalesOrder) => void
  deleteSalesOrder: (id: string) => void
  upsertPurchaseOrder: (o: PurchaseOrder) => void
  deletePurchaseOrder: (id: string) => void
  upsertPurchaseReturn: (r: PurchaseReturn) => void
  deletePurchaseReturn: (id: string) => void
  upsertShipment: (s: Shipment) => void
  deleteShipment: (id: string) => void
  upsertDiscount: (d: Discount) => void
  deleteDiscount: (id: string) => void
  upsertSalesReturn: (r: SalesReturn) => void
  deleteSalesReturn: (id: string) => void
  upsertDepartment: (d: Department) => void
  deleteDepartment: (id: string) => void
  upsertPayslip: (p: Payslip) => void
  deletePayslip: (id: string) => void
  upsertJob: (j: JobPosting) => void
  deleteJob: (id: string) => void
  upsertCandidate: (c: Candidate) => void
  deleteCandidate: (id: string) => void
  upsertReview: (r: PerformanceReview) => void
  deleteReview: (id: string) => void
  upsertStaffAttendance: (a: StaffAttendance) => void
  deleteStaffAttendance: (id: string) => void
  upsertAsset: (a: Asset) => void
  deleteAsset: (id: string) => void
  upsertDepreciation: (d: DepreciationEntry) => void
  deleteDepreciation: (id: string) => void
  upsertAssetTransaction: (t: AssetTransaction) => void
  deleteAssetTransaction: (id: string) => void
  addAssetCategory: (name: string) => { ok: boolean; error?: string }
  renameAssetCategory: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteAssetCategory: (name: string) => { ok: boolean; error?: string }
  addAssetCondition: (name: string) => { ok: boolean; error?: string }
  renameAssetCondition: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteAssetCondition: (name: string) => { ok: boolean; error?: string }
  setDepreciationPolicy: (p: DepreciationPolicy) => void
  upsertCustomer: (c: Customer) => void
  deleteCustomer: (id: string) => void
  addSupplierCategory: (name: string) => { ok: boolean; error?: string }
  renameSupplierCategory: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteSupplierCategory: (name: string) => { ok: boolean; error?: string }
  addCustomerCategory: (name: string) => { ok: boolean; error?: string }
  renameCustomerCategory: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteCustomerCategory: (name: string) => { ok: boolean; error?: string }
  setModuleEnabled: (id: string, enabled: boolean) => void
  setSidebarOrder: (order: string[]) => void
  upsertAccount: (a: Account) => void
  deleteAccount: (id: string) => void
  setAccountingSettings: (s: AccountingSettings) => void
  upsertReceipt: (v: ReceiptVoucher) => void
  deleteReceipt: (id: string) => void
  upsertPaymentVoucher: (v: PaymentVoucher) => void
  deletePaymentVoucher: (id: string) => void
  upsertJournal: (v: JournalVoucher) => void
  deleteJournal: (id: string) => void
  upsertBank: (b: BankAccount) => void
  deleteBank: (id: string) => void
  upsertSignatory: (s: BankSignatory) => void
  deleteSignatory: (id: string) => void
  upsertVoucherSerial: (v: VoucherSerial) => void
  deleteVoucherSerial: (id: string) => void
  upsertFund: (f: Fund) => void
  deleteFund: (id: string) => void
  upsertPaymentMode: (p: PaymentModeOption) => void
  deletePaymentMode: (id: string) => void
  upsertDetailType: (d: AccountDetailType) => void
  deleteDetailType: (id: string) => void
  upsertIncomeMod: (m: IncomeStatementMod) => void
  deleteIncomeMod: (id: string) => void
  setIncomeMods: (m: IncomeStatementMod[]) => void
  upsertCurrencyRate: (r: CurrencyRate) => void
  deleteCurrencyRate: (id: string) => void
  clearCurrencyRates: () => void
  upsertReconciliation: (r: BankReconciliation) => void
  deleteReconciliation: (id: string) => void
  upsertBudget: (b: Budget) => void
  deleteBudget: (id: string) => void
  upsertValueBookEntry: (v: ValueBookEntry) => void
  deleteValueBookEntry: (id: string) => void
  upsertMembership: (m: Membership) => void
  bookClass: (classId: string, memberId: string, date: string) => { ok: boolean; status: Booking['status']; message: string }
  cancelBooking: (id: string) => void
  checkIn: (memberId: string, branchId: string) => Attendance
  addProgress: (p: ProgressLog) => void
  upsertWorkout: (w: WorkoutPlan) => void
  sendMessage: (m: Omit<Message, 'id' | 'createdAt' | 'read'>) => void
  markMessagesRead: (ids: string[]) => void
  notify: (n: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => void
  markNotifRead: (id: string) => void
  markAllNotifRead: (userId: string) => void
  log: (userId: string, action: string, entity: string, details: string) => void
  upsertLeave: (l: LeaveRequest) => void
  upsertSession: (s: SessionBooking) => void
  createMemberAccount: (input: CreateMemberInput) => { userId: string; memberId: string }
  takeAttendance: (classId: string, memberId: string, present: boolean) => void
  refundPayment: (id: string) => void
  cancelPayment: (id: string) => { ok: boolean; error?: string }
  requestMembershipRenewal: (memberId: string, planId?: string) => { ok: boolean; paymentId?: string; invoiceId?: string; error?: string }
  createPayment: (input: { memberId: string; amount: number; description: string; method?: PaymentMethod }) => {
    ok: boolean
    error?: string
    payment?: Payment
    invoice?: Invoice
  }
  settlePayment: (paymentId: string) => { ok: boolean; error?: string }
  applyGatewayPayment: (input: GatewayPaymentInput) => { ok: boolean; error?: string; settled?: boolean }
  upsertBranch: (b: Branch) => void
  deleteBranch: (id: string) => void
  upsertCompany: (c: Company) => void
  deleteCompany: (id: string) => void
  setCompanyStatus: (id: string, status: Company['status']) => void
  setActiveCompany: (id: string) => void
  setActiveBranch: (id: string) => void
  setProductMode: (mode: ProductMode) => void
  upsertBranchSettings: (s: BranchSettings) => void
  resetBranchSettings: (branchId: string) => void
  upsertCustomField: (f: CustomField) => void
  deleteCustomField: (id: string) => void
  setCms: (c: CmsData) => void
  upsertInventoryItem: (i: InventoryItem) => void
  deleteInventoryItem: (id: string) => void
  adjustStock: (itemId: string, type: StockMovementType, quantity: number, reason: string) => { ok: boolean; error?: string }
  upsertSupplier: (s: Supplier) => void
  deleteSupplier: (id: string) => void
  addInventoryCategory: (name: string) => { ok: boolean; error?: string }
  renameInventoryCategory: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteInventoryCategory: (name: string) => { ok: boolean; error?: string }
  recordPurchase: (input: { supplierId: string; lines: PurchaseLine[]; status?: PurchaseStatus; notes?: string; userId: string; date?: string }) => { ok: boolean; error?: string; purchase?: Purchase }
  recordSale: (input: { memberId?: string; customerName?: string; lines: SaleLine[]; method: PaymentMethod; userId: string; date?: string }) => { ok: boolean; error?: string; sale?: Sale }
  updatePurchaseStatus: (id: string, status: PurchaseStatus) => void
  refundSale: (id: string) => { ok: boolean; error?: string }
  deletePurchase: (id: string) => void
  deleteSale: (id: string) => void
  roles: RoleDef[]
  permissions: Permission[]
  upsertRole: (r: RoleDef) => void
  deleteRole: (id: string) => void
  setRolePermissions: (roleId: string, permissions: string[]) => void
  upsertPermission: (p: Permission) => void
  deletePermission: (key: string) => void
  resetData: (keys: string[]) => void
}

const Ctx = createContext<AppStore | null>(null)

function normalizeUser(u: User): User {
  return {
    ...u,
    username: u.username || u.email.split('@')[0].toLowerCase(),
  }
}

function loadPersistedUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return USERS.map(normalizeUser)
    const saved = JSON.parse(raw) as User[]
    const byId = new Map(saved.map((u) => [u.id, u]))
    const merged = USERS.map((seed) => normalizeUser({ ...seed, ...(byId.get(seed.id) || {}) }))
    for (const u of saved) {
      if (!USERS.some((s) => s.id === u.id)) merged.push(normalizeUser(u))
    }
    return merged
  } catch {
    return USERS.map(normalizeUser)
  }
}

function persistUsers(list: User[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
}

function loadCredentialEvents(): CredentialEvent[] {
  try {
    const raw = localStorage.getItem(CRED_EVENTS_KEY)
    if (raw) return JSON.parse(raw) as CredentialEvent[]
  } catch {
    /* ignore */
  }
  return []
}

function persistCredentialEvents(events: CredentialEvent[]) {
  try {
    localStorage.setItem(CRED_EVENTS_KEY, JSON.stringify(events.slice(0, 500)))
  } catch {
    /* quota */
  }
}

const PAY_KEY = 'fitpro_payments'
const INV_KEY = 'fitpro_invoices'
const MS_KEY = 'fitpro_memberships'
const TRAINERS_KEY = 'fitpro_trainers'
const STAFF_KEY = 'fitpro_staff'

function loadMerged<T extends { id: string }>(key: string, seed: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return seed
    const saved = JSON.parse(raw) as T[]
    const byId = new Map(saved.map((x) => [x.id, x]))
    const merged = seed.map((s) => ({ ...s, ...(byId.get(s.id) || {}) }))
    for (const x of saved) {
      if (!seed.some((s) => s.id === x.id)) merged.push(x)
    }
    return merged
  } catch {
    return seed
  }
}

function persistJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [users, setUsersState] = useState<User[]>(loadPersistedUsers)
  const setUsers = useCallback((action: User[] | ((prev: User[]) => User[])) => {
    setUsersState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistUsers(next)
      return next
    })
  }, [])
  const [credentialEvents, setCredentialEventsState] = useState<CredentialEvent[]>(loadCredentialEvents)
  const setCredentialEvents = useCallback((action: CredentialEvent[] | ((prev: CredentialEvent[]) => CredentialEvent[])) => {
    setCredentialEventsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistCredentialEvents(next)
      return next
    })
  }, [])
  const [credentialSettings, setCredentialSettingsState] = useState<CredentialSettings>(() => loadCredentialSettings())
  const setCredentialSettings = useCallback((s: CredentialSettings) => {
    setCredentialSettingsState(s)
    saveCredentialSettings(s)
  }, [])
  const [paymentSettings, setPaymentSettingsState] = useState<PaymentSettings>(() => loadPaymentSettings())
  const setPaymentSettings = useCallback((s: PaymentSettings) => {
    setPaymentSettingsState(s)
    savePaymentSettings(s)
  }, [])
  const [members, setMembers] = useState(MEMBERS)
  const [trainers, setTrainersState] = useState<Trainer[]>(() => loadMerged(TRAINERS_KEY, TRAINERS))
  const setTrainers = useCallback((action: Trainer[] | ((prev: Trainer[]) => Trainer[])) => {
    setTrainersState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(TRAINERS_KEY, next)
      return next
    })
  }, [])
  const [staff, setStaffState] = useState<StaffRecord[]>(() => loadMerged(STAFF_KEY, STAFF))
  const setStaff = useCallback((action: StaffRecord[] | ((prev: StaffRecord[]) => StaffRecord[])) => {
    setStaffState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(STAFF_KEY, next)
      return next
    })
  }, [])
  const [plans, setPlans] = useState(PLANS)
  const [memberships, setMembershipsState] = useState(() => loadMerged(MS_KEY, MEMBERSHIPS))
  const setMemberships = useCallback((action: Membership[] | ((prev: Membership[]) => Membership[])) => {
    setMembershipsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(MS_KEY, next)
      return next
    })
  }, [])
  const [payments, setPaymentsState] = useState(() => loadMerged(PAY_KEY, PAYMENTS))
  const setPayments = useCallback((action: Payment[] | ((prev: Payment[]) => Payment[])) => {
    setPaymentsState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(PAY_KEY, next)
      return next
    })
  }, [])
  const [invoices, setInvoicesState] = useState(() => loadMerged(INV_KEY, INVOICES))
  const setInvoices = useCallback((action: Invoice[] | ((prev: Invoice[]) => Invoice[])) => {
    setInvoicesState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action
      persistJson(INV_KEY, next)
      return next
    })
  }, [])
  const [classes, setClasses] = useState(CLASSES)
  const [bookings, setBookings] = useState(BOOKINGS)
  const [attendance, setAttendance] = useState(ATTENDANCE)
  const [workouts, setWorkouts] = useState(WORKOUTS)
  const [progress, setProgress] = useState(PROGRESS)
  const [notifications, setNotifications] = useState(NOTIFICATIONS)
  const [branches, setBranches] = useState(BRANCHES)
  const [companies, setCompaniesState] = useState<Company[]>(() => loadCompanies())
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => loadActiveCompanyId(loadCompanies()))
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => loadActiveBranchId(BRANCHES))
  const [productMode, setProductModeState] = useState<ProductMode>(() => loadProductMode())
  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) || companies.find((c) => c.isDefault) || companies[0] || null,
    [companies, activeCompanyId],
  )
  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) || branches[0] || null,
    [branches, activeBranchId],
  )
  const setActiveCompany = useCallback((id: string) => {
    setActiveCompanyIdState(id)
    saveActiveCompanyId(id)
  }, [])
  const setActiveBranch = useCallback((id: string) => {
    setActiveBranchIdState(id)
    saveActiveBranchId(id)
  }, [])
  const upsertCompany = useCallback((c: Company) => {
    setCompaniesState((s) => {
      const next = s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c]
      saveCompanies(next)
      return next
    })
  }, [])
  const deleteCompany = useCallback((id: string) => {
    setCompaniesState((s) => {
      const next = s.filter((c) => c.id !== id)
      saveCompanies(next)
      return next
    })
  }, [])
  const setCompanyStatus = useCallback((id: string, status: Company['status']) => {
    setCompaniesState((s) => {
      const next = s.map((c) => (c.id === id ? { ...c, status } : c))
      saveCompanies(next)
      return next
    })
  }, [])
  const setProductMode = useCallback((mode: ProductMode) => {
    setProductModeState(mode)
    saveProductMode(mode)
  }, [])
  const [branchSettings, setBranchSettingsState] = useState<BranchSettings[]>(() => loadBranchSettings())
  const upsertBranchSettings = useCallback((s: BranchSettings) => {
    setBranchSettingsState((prev) => {
      const next = prev.some((x) => x.branchId === s.branchId)
        ? prev.map((x) => (x.branchId === s.branchId ? s : x))
        : [...prev, s]
      saveBranchSettings(next)
      return next
    })
  }, [])
  const resetBranchSettings = useCallback((branchId: string) => {
    setBranchSettingsState((prev) => {
      const next = prev.filter((x) => x.branchId !== branchId)
      saveBranchSettings(next)
      return next
    })
  }, [])
  const [customFields, setCustomFieldsState] = useState<CustomField[]>(() => loadCustomFields())
  const upsertCustomField = useCallback((f: CustomField) => {
    setCustomFieldsState((prev) => {
      const next = prev.some((x) => x.id === f.id) ? prev.map((x) => (x.id === f.id ? f : x)) : [...prev, f]
      saveCustomFields(next)
      return next
    })
  }, [])
  const deleteCustomField = useCallback((id: string) => {
    setCustomFieldsState((prev) => {
      const next = prev.filter((x) => x.id !== id)
      saveCustomFields(next)
      return next
    })
  }, [])
  const [cms, setCmsState] = useState<CmsData>(() => loadCms())
  const setCms = useCallback((c: CmsData) => {
    setCmsState(c)
    saveCms(c)
  }, [])
  const [leads, setLeads] = useState(LEADS)
  const [messages, setMessages] = useState(MESSAGES)
  const [audit, setAudit] = useState(AUDIT)
  const [leaves, setLeaves] = useState(LEAVES)
  const [sessions, setSessions] = useState(SESSIONS)
  const [inventory, setInventoryState] = useState<InventoryItem[]>(() => loadInventory())
  const [suppliers, setSuppliersState] = useState<Supplier[]>(() => loadSuppliers())
  const [stockMovements, setStockMovementsState] = useState<StockTransaction[]>(() => loadStockMovements())
  const [inventoryCategories, setInventoryCategoriesState] = useState<string[]>(() => loadCategories())
  const [purchases, setPurchasesState] = useState<Purchase[]>(() => loadPurchases())
  const [sales, setSalesState] = useState<Sale[]>(() => loadSales())
  const [proposals, setProposalsState] = useState<Proposal[]>(() => loadProposals())
  const [estimates, setEstimatesState] = useState<Estimate[]>(() => loadEstimates())
  const [salesOrders, setSalesOrdersState] = useState<SalesOrder[]>(() => loadSalesOrders())
  const [purchaseOrders, setPurchaseOrdersState] = useState<PurchaseOrder[]>(() => loadPurchaseOrders())
  const [purchaseReturns, setPurchaseReturnsState] = useState<PurchaseReturn[]>(() => loadPurchaseReturns())
  const [shipments, setShipmentsState] = useState<Shipment[]>(() => loadShipments())
  const [discounts, setDiscountsState] = useState<Discount[]>(() => loadDiscounts())
  const [salesReturns, setSalesReturnsState] = useState<SalesReturn[]>(() => loadSalesReturns())
  const [departments, setDepartmentsState] = useState<Department[]>(() => loadDepartments())
  const [payslips, setPayslipsState] = useState<Payslip[]>(() => loadPayslips())
  const [jobs, setJobsState] = useState<JobPosting[]>(() => loadJobs())
  const [candidates, setCandidatesState] = useState<Candidate[]>(() => loadCandidates())
  const [reviews, setReviewsState] = useState<PerformanceReview[]>(() => loadReviews())
  const [staffAttendance, setStaffAttendanceState] = useState<StaffAttendance[]>(() => loadStaffAttendance())
  const [assets, setAssetsState] = useState<Asset[]>(() => loadAssets())
  const [depreciation, setDepreciationState] = useState<DepreciationEntry[]>(() => loadDepreciation())
  const [assetTransactions, setAssetTransactionsState] = useState<AssetTransaction[]>(() => loadAssetTransactions())
  const [assetCategories, setAssetCategoriesState] = useState<string[]>(() => loadAssetCategories())
  const [assetConditions, setAssetConditionsState] = useState<string[]>(() => loadAssetConditions())
  const [depreciationPolicy, setDepreciationPolicyState] = useState<DepreciationPolicy>(() => loadDepreciationPolicy())
  const [customers, setCustomersState] = useState<Customer[]>(() => loadCustomers())
  const [supplierCategories, setSupplierCategoriesState] = useState<string[]>(() => loadSupplierCategories())
  const [customerCategories, setCustomerCategoriesState] = useState<string[]>(() => loadCustomerCategories())
  const [modules, setModulesState] = useState<ModuleState>(() => loadModules())
  const [sidebarOrder, setSidebarOrderState] = useState<string[]>(() => loadSidebarOrder())
  const [accounts, setAccountsState] = useState<Account[]>(() => loadAccounts())
  const [accountingSettings, setAccountingSettingsState] = useState<AccountingSettings>(() => loadAccountingSettings())
  const [receipts, setReceiptsState] = useState<ReceiptVoucher[]>(() => loadReceipts())
  const [paymentVouchers, setPaymentVouchersState] = useState<PaymentVoucher[]>(() => loadPayments())
  const [journals, setJournalsState] = useState<JournalVoucher[]>(() => loadJournals())
  const [banks, setBanksState] = useState<BankAccount[]>(() => loadBanks())
  const [signatories, setSignatoriesState] = useState<BankSignatory[]>(() => loadSignatories())
  const [voucherSerials, setVoucherSerialsState] = useState<VoucherSerial[]>(() => loadSerials())
  const [funds, setFundsState] = useState<Fund[]>(() => loadFunds())
  const [paymentModes, setPaymentModesState] = useState<PaymentModeOption[]>(() => loadPaymentModes())
  const [detailTypes, setDetailTypesState] = useState<AccountDetailType[]>(() => loadDetailTypes())
  const [incomeMods, setIncomeModsState] = useState<IncomeStatementMod[]>(() => loadIncomeMods())
  const [currencyRates, setCurrencyRatesState] = useState<CurrencyRate[]>(() => loadCurrencyRates())
  const [reconciliations, setReconciliationsState] = useState<BankReconciliation[]>(() => loadReconciliations())
  const [budgets, setBudgetsState] = useState<Budget[]>(() => loadBudgets())
  const [valueBook, setValueBookState] = useState<ValueBookEntry[]>(() => loadValueBook())
  const [roles, setRolesState] = useState<RoleDef[]>(() => loadRoles())
  const [permissions, setPermissionsState] = useState<Permission[]>(() => loadPermissions())
  const [company, setCompanyState] = useState<CompanySettings>(() => {
    try {
      const raw = localStorage.getItem('fitpro_company')
      if (raw) return { ...COMPANY, ...JSON.parse(raw) }
    } catch {
      /* keep defaults */
    }
    return COMPANY
  })
  const setCompany = (c: CompanySettings) => {
    const next = {
      ...c,
      brandPrimary: normalizeHex(c.brandPrimary || '#C8F542'),
      buttonPrimary: c.buttonPrimary ? normalizeHex(c.buttonPrimary) : undefined,
    }
    setCompanyState(next)
    applyBrandColor(next.brandPrimary)
    applyButtonColor(next.buttonPrimary)
    try {
      localStorage.setItem('fitpro_company', JSON.stringify(next))
    } catch {
      /* ignore quota */
    }
  }

  useEffect(() => {
    applyBrandColor(company.brandPrimary || '#C8F542')
    applyButtonColor(company.buttonPrimary)
    applyChromeColors(company.sidebarColor, company.headerColor)
  }, [company.brandPrimary, company.buttonPrimary, company.sidebarColor, company.headerColor])

  const log = useCallback((userId: string, action: string, entity: string, details: string) => {
    setAudit((a) => [{ id: uid('au'), userId, action, entity, details, createdAt: new Date().toISOString() }, ...a])
  }, [])

  const patchUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((s) => s.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }, [setUsers])

  const createMemberAccount = useCallback((input: CreateMemberInput) => {
    const userId = uid('u')
    const memberId = uid('mb')
    const membershipId = uid('ms')
    const planId = input.planId || 'pl_month'
    const branchId = input.branchId || 'br_airport'
    const plan = plans.find((p) => p.id === planId) || plans[0]
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + plan.durationDays)
    const user: User = {
      id: userId,
      email: input.email,
      password: input.password,
      name: input.name,
      role: 'member',
      avatar: input.avatar || '/images/member-ava-5.jpg',
      phone: input.phone,
      branchId,
      status: input.status || 'active',
      createdAt: start.toISOString().slice(0, 10),
      emailVerified: input.emailVerified,
      emailVerifyToken: input.emailVerifyToken,
      emailVerifyExpires: input.emailVerifyExpires,
      username: input.username || input.email.split('@')[0].toLowerCase(),
      mustChangePassword: !!input.mustChangePassword,
    }
    const member: Member = {
      id: memberId,
      userId,
      membershipId,
      planId,
      joinDate: start.toISOString().slice(0, 10),
      emergency: input.emergency || { name: '', phone: '', relation: '' },
      medicalNotes: input.medicalNotes || '',
      tags: input.tags?.length ? input.tags : ['New'],
      goals: input.goals || [],
      heightCm: input.heightCm || 170,
      weightKg: input.weightKg || 70,
      dob: input.dob || '1995-01-01',
      gender: input.gender || 'other',
      address: input.address || 'Accra',
      qrCode: `FITPRO-${memberId.toUpperCase()}`,
      trainerId: input.trainerId,
      customFields: input.customFields,
    }
    const ms: Membership = {
      id: membershipId,
      memberId,
      planId,
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      status: 'active',
      autoRenew: true,
      branchId,
    }
    setUsers((s) => [...s, user])
    setMembers((s) => [...s, member])
    setMemberships((s) => [...s, ms])
    setBranches((s) => s.map((b) => (b.id === branchId ? { ...b, members: b.members + 1 } : b)))
    log(userId, 'CREATE', 'Member', `Created ${input.name}`)
    return { userId, memberId }
  }, [plans, log, setUsers])

  const regenerateMemberCredentials = useCallback(async (input: RegenerateCredentialsInput): Promise<RegenerateCredentialsResult> => {
    const member = input.memberId ? members.find((m) => m.id === input.memberId) : members.find((m) => m.userId === input.userId)
    const staffRec = input.userId ? staff.find((s) => s.userId === input.userId) : undefined
    const target = input.userId
      ? users.find((u) => u.id === input.userId)
      : member
        ? users.find((u) => u.id === member.userId)
        : undefined
    if (!target) return { ok: false, error: 'Account not found.' }
    if (target.status === 'suspended') return { ok: false, error: 'Reactivate the account before issuing new login details.' }

    const recordId = member?.id || staffRec?.id || target.id
    const who = target.role === 'member' ? 'member' : 'staff'

    const scope = input.scope
    const changePassword = scope === 'password' || scope === 'both'
    const changeUsername = scope === 'username' || scope === 'both'
    if (!changePassword && !changeUsername) return { ok: false, error: 'Choose what to regenerate.' }

    const policy = credentialSettings.policy
    let nextUsername = target.username || target.email.split('@')[0].toLowerCase()
    let tempPassword: string | undefined
    const patch: Partial<User> = {
      credentialsRegeneratedAt: new Date().toISOString(),
      credentialsRegeneratedBy: input.adminId,
    }

    if (changeUsername) {
      nextUsername = generateUsername(target.name || nextUsername, takenUsernames(users, target.id))
      patch.username = nextUsername
    }
    if (changePassword) {
      const issued = issueInitialPassword(
        input.passwordMode || credentialSettings.initialPasswordMode || 'auto',
        target.phone || '',
        policy,
      )
      if (!issued.ok) return { ok: false, error: issued.error }
      tempPassword = issued.password
      patch.password = await hashPassword(tempPassword)
      patch.mustChangePassword = true
      patch.tempPasswordIssuedAt = new Date().toISOString()
      patch.passwordResetToken = undefined
      patch.passwordResetExpires = undefined
    }

    setUsers((s) => s.map((u) => (u.id === target.id ? { ...u, ...patch } : u)))

    if (tempPassword) saveReveal(target.id, nextUsername, tempPassword)
    else {
      const live = loadReveal(target.id)
      if (live?.password) saveReveal(target.id, nextUsername, live.password)
    }

    const event: CredentialEvent = {
      id: uid('ce'),
      memberId: recordId,
      userId: target.id,
      adminId: input.adminId,
      adminName: input.adminName,
      action: 'regenerate',
      scope,
      usernameAfter: nextUsername,
      passwordChanged: changePassword,
      usernameChanged: changeUsername,
      channels: input.channels,
      deliveries: [],
      createdAt: new Date().toISOString(),
    }
    setCredentialEvents((s) => [event, ...s])
    log(
      input.adminId,
      'REGENERATE',
      'Credentials',
      `${input.adminName} regenerated ${scope} for ${who} ${target.name} (${nextUsername})${changePassword ? ` · password: ${input.passwordMode || credentialSettings.initialPasswordMode || 'auto'}` : ''}`,
    )
    setNotifications((s) => [{
      id: uid('nt'),
      userId: target.id,
      title: 'Login details updated',
      message: changePassword
        ? 'Your club issued a new temporary password. Sign in and choose a new one.'
        : 'Your FitPro username was updated. Use the new username at the next sign-in.',
      channel: 'in-app',
      read: false,
      createdAt: new Date().toISOString(),
    }, ...s])
    return {
      ok: true,
      event,
      username: nextUsername,
      tempPassword,
      passwordChanged: changePassword,
      usernameChanged: changeUsername,
    }
  }, [members, staff, users, credentialSettings.policy, credentialSettings.initialPasswordMode, setUsers, setCredentialEvents, log])

  const recordCredentialDelivery = useCallback((eventId: string, deliveries: CredentialDeliveryResult[]) => {
    setCredentialEvents((s) => s.map((e) => (e.id === eventId ? { ...e, deliveries } : e)))
    const summary = deliveries.map((d) => `${d.channel}:${d.status}`).join(', ')
    log('system', 'DELIVER', 'Credentials', summary || 'No channels')
  }, [setCredentialEvents, log])

  const appendCredentialEvent = useCallback((event: CredentialEvent) => {
    setCredentialEvents((s) => [event, ...s])
  }, [setCredentialEvents])

  const upsertRole = useCallback((r: RoleDef) => {
    setRolesState((s) => {
      const next = s.some((x) => x.id === r.id) ? s.map((x) => (x.id === r.id ? r : x)) : [...s, r]
      saveRoles(next)
      return next
    })
  }, [])

  const deleteRole = useCallback((id: string) => {
    setRolesState((s) => {
      const next = s.filter((r) => r.id === id || r.builtin)
      saveRoles(next)
      return next
    })
  }, [])

  const setRolePermissions = useCallback((roleId: string, perms: string[]) => {
    setRolesState((s) => {
      const next = s.map((r) => (r.id === roleId ? { ...r, permissions: perms } : r))
      saveRoles(next)
      return next
    })
  }, [])

  const upsertPermission = useCallback((p: Permission) => {
    setPermissionsState((s) => {
      const next = s.some((x) => x.key === p.key) ? s.map((x) => (x.key === p.key ? p : x)) : [...s, p]
      savePermissions(next)
      return next
    })
  }, [])

  const deletePermission = useCallback((key: string) => {
    setPermissionsState((s) => {
      const next = s.filter((p) => p.key === key || p.builtin)
      savePermissions(next)
      return next
    })
    setRolesState((s) => {
      const next = s.map((r) => ({ ...r, permissions: r.permissions.filter((k) => k !== key) }))
      saveRoles(next)
      return next
    })
  }, [])

  const upsertInventoryItem = useCallback((i: InventoryItem) => {
    setInventoryState((s) => {
      const next = s.some((x) => x.id === i.id) ? s.map((x) => (x.id === i.id ? i : x)) : [...s, i]
      saveInventory(next)
      return next
    })
  }, [])

  const deleteInventoryItem = useCallback((id: string) => {
    setInventoryState((s) => {
      const next = s.filter((i) => i.id !== id)
      saveInventory(next)
      return next
    })
    setStockMovementsState((s) => {
      const next = s.filter((m) => m.itemId !== id)
      saveStockMovements(next)
      return next
    })
  }, [])

  const adjustStock = useCallback((itemId: string, type: StockMovementType, quantity: number, reason: string) => {
    let error = ''
    setInventoryState((s) => {
      const item = s.find((i) => i.id === itemId)
      if (!item) { error = 'Item not found'; return s }
      const signed = type === 'in' ? Math.abs(quantity) : type === 'out' ? -Math.abs(quantity) : quantity
      const nextQty = item.quantity + signed
      if (nextQty < 0) { error = 'Not enough stock for this issue.'; return s }
      const now = new Date().toISOString().slice(0, 10)
      const next = s.map((i) => (i.id === itemId ? { ...i, quantity: nextQty, updatedAt: now } : i))
      saveInventory(next)
      return next
    })
    if (error) return { ok: false, error }
    const signed = type === 'in' ? Math.abs(quantity) : type === 'out' ? -Math.abs(quantity) : quantity
    setStockMovementsState((s) => {
      const next = [{
        id: uid('sm'),
        itemId,
        type,
        quantity: signed,
        reason: reason.trim() || (type === 'in' ? 'Stock received' : type === 'out' ? 'Stock issued' : 'Manual adjustment'),
        userId: 'system',
        createdAt: new Date().toISOString(),
      }, ...s]
      saveStockMovements(next)
      return next
    })
    return { ok: true }
  }, [])

  const upsertSupplier = useCallback((sup: Supplier) => {
    setSuppliersState((s) => {
      const next = s.some((x) => x.id === sup.id) ? s.map((x) => (x.id === sup.id ? sup : x)) : [...s, sup]
      saveSuppliers(next)
      return next
    })
  }, [])

  const deleteSupplier = useCallback((id: string) => {
    setSuppliersState((s) => {
      const next = s.filter((x) => x.id !== id)
      saveSuppliers(next)
      return next
    })
    setInventoryState((s) => {
      const next = s.map((i) => (i.supplierId === id ? { ...i, supplierId: undefined } : i))
      saveInventory(next)
      return next
    })
  }, [])

  const addInventoryCategory = useCallback((name: string) => {
    const clean = name.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setInventoryCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = [...s, clean]
      saveCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    return { ok: true }
  }, [])

  const renameInventoryCategory = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setInventoryCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) {
        err = 'That category already exists.'
        return s
      }
      const next = s.map((c) => (c === oldName ? clean : c))
      saveCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    setInventoryState((s) => {
      const next = s.map((i) => (i.category === oldName ? { ...i, category: clean } : i))
      saveInventory(next)
      return next
    })
    return { ok: true }
  }, [])

  const deleteInventoryCategory = useCallback((name: string) => {
    const inUse = inventory.some((i) => i.category === name)
    if (inUse) return { ok: false, error: `"${name}" is used by ${inventory.filter((i) => i.category === name).length} item(s). Reassign those items first.` }
    setInventoryCategoriesState((s) => {
      const next = s.filter((c) => c !== name)
      saveCategories(next)
      return next
    })
    return { ok: true }
  }, [inventory])

  const addAssetCategory = useCallback((name: string) => {
    const clean = name.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setAssetCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = [...s, clean]
      saveAssetCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    return { ok: true }
  }, [])

  const renameAssetCategory = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setAssetCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = s.map((c) => (c === oldName ? clean : c))
      saveAssetCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    setAssetsState((s) => {
      const next = s.map((a) => (a.category === oldName ? { ...a, category: clean } : a))
      saveAssets(next)
      return next
    })
    return { ok: true }
  }, [])

  const deleteAssetCategory = useCallback((name: string) => {
    const inUse = assets.some((a) => a.category === name)
    if (inUse) return { ok: false, error: `"${name}" is used by ${assets.filter((a) => a.category === name).length} asset(s). Reassign those assets first.` }
    setAssetCategoriesState((s) => {
      const next = s.filter((c) => c !== name)
      saveAssetCategories(next)
      return next
    })
    return { ok: true }
  }, [assets])

  const addAssetCondition = useCallback((name: string) => {
    const clean = name.trim()
    if (clean.length < 2) return { ok: false, error: 'Condition name must be at least 2 characters.' }
    let err = ''
    setAssetConditionsState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase())) { err = 'That condition already exists.'; return s }
      const next = [...s, clean]
      saveAssetConditions(next)
      return next
    })
    if (err) return { ok: false, error: err }
    return { ok: true }
  }, [])

  const renameAssetCondition = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim()
    if (clean.length < 2) return { ok: false, error: 'Condition name must be at least 2 characters.' }
    let err = ''
    setAssetConditionsState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) { err = 'That condition already exists.'; return s }
      const next = s.map((c) => (c === oldName ? clean : c))
      saveAssetConditions(next)
      return next
    })
    if (err) return { ok: false, error: err }
    setAssetsState((s) => {
      const next = s.map((a) => (a.condition === oldName ? { ...a, condition: clean } : a))
      saveAssets(next)
      return next
    })
    return { ok: true }
  }, [])

  const deleteAssetCondition = useCallback((name: string) => {
    const inUse = assets.some((a) => a.condition === name)
    if (inUse) return { ok: false, error: `"${name}" is used by ${assets.filter((a) => a.condition === name).length} asset(s). Reassign those assets first.` }
    setAssetConditionsState((s) => {
      const next = s.filter((c) => c !== name)
      saveAssetConditions(next)
      return next
    })
    return { ok: true }
  }, [assets])

  const setDepreciationPolicy = useCallback((p: DepreciationPolicy) => {
    setDepreciationPolicyState(p)
    saveDepreciationPolicy(p)
  }, [])

  const upsertCustomer = useCallback((c: Customer) => {
    setCustomersState((s) => { const n = s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c]; saveCustomers(n); return n })
  }, [])

  const deleteCustomer = useCallback((id: string) => {
    setCustomersState((s) => { const n = s.filter((c) => c.id !== id); saveCustomers(n); return n })
  }, [])

  const addSupplierCategory = useCallback((name: string) => {
    const clean = name.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setSupplierCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = [...s, clean]
      saveSupplierCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    return { ok: true }
  }, [])

  const renameSupplierCategory = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setSupplierCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = s.map((c) => (c === oldName ? clean : c))
      saveSupplierCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    // Keep suppliers in sync on rename.
    setSuppliersState((s) => {
      const next = s.map((x) => (x.category === oldName ? { ...x, category: clean } : x))
      saveSuppliers(next)
      return next
    })
    return { ok: true }
  }, [])

  const deleteSupplierCategory = useCallback((name: string) => {
    const inUse = suppliers.some((s) => s.category === name)
    if (inUse) return { ok: false, error: `"${name}" is used by ${suppliers.filter((s) => s.category === name).length} supplier(s). Reassign them first.` }
    setSupplierCategoriesState((s) => {
      const next = s.filter((c) => c !== name)
      saveSupplierCategories(next)
      return next
    })
    return { ok: true }
  }, [suppliers])

  const addCustomerCategory = useCallback((name: string) => {
    const clean = name.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setCustomerCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = [...s, clean]
      saveCustomerCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    return { ok: true }
  }, [])

  const renameCustomerCategory = useCallback((oldName: string, newName: string) => {
    const clean = newName.trim()
    if (clean.length < 2) return { ok: false, error: 'Category name must be at least 2 characters.' }
    let err = ''
    setCustomerCategoriesState((s) => {
      if (s.some((c) => c.toLowerCase() === clean.toLowerCase() && c.toLowerCase() !== oldName.toLowerCase())) { err = 'That category already exists.'; return s }
      const next = s.map((c) => (c === oldName ? clean : c))
      saveCustomerCategories(next)
      return next
    })
    if (err) return { ok: false, error: err }
    setCustomersState((s) => {
      const next = s.map((c) => (c.category === oldName ? { ...c, category: clean } : c))
      saveCustomers(next)
      return next
    })
    return { ok: true }
  }, [])

  const deleteCustomerCategory = useCallback((name: string) => {
    const inUse = customers.some((c) => c.category === name)
    if (inUse) return { ok: false, error: `"${name}" is used by ${customers.filter((c) => c.category === name).length} customer(s). Reassign them first.` }
    setCustomerCategoriesState((s) => {
      const next = s.filter((c) => c !== name)
      saveCustomerCategories(next)
      return next
    })
    return { ok: true }
  }, [customers])

  const setModuleEnabled = useCallback((id: string, enabled: boolean) => {
    setModulesState((s) => {
      const next = { ...s, [id]: enabled }
      saveModules(next)
      return next
    })
  }, [])

  const setSidebarOrder = useCallback((order: string[]) => {
    setSidebarOrderState(order)
    saveSidebarOrder(order)
  }, [])

  // Generic list upsert/delete helpers for the accounting collections.
  const makeUpsert = <T extends { id: string }>(setter: (fn: (s: T[]) => T[]) => void, persist: (s: T[]) => void) =>
    useCallback((item: T) => {
      setter((s) => { const n = s.some((x) => x.id === item.id) ? s.map((x) => (x.id === item.id ? item : x)) : [...s, item]; persist(n); return n })
    }, [setter, persist])
  const makeDelete = <T extends { id: string }>(setter: (fn: (s: T[]) => T[]) => void, persist: (s: T[]) => void) =>
    useCallback((id: string) => {
      setter((s) => { const n = s.filter((x) => x.id !== id); persist(n); return n })
    }, [setter, persist])

  const upsertAccount = makeUpsert<Account>(setAccountsState, saveAccounts)
  const deleteAccount = makeDelete<Account>(setAccountsState, saveAccounts)
  const upsertReceipt = makeUpsert<ReceiptVoucher>(setReceiptsState, saveReceipts)
  const deleteReceipt = makeDelete<ReceiptVoucher>(setReceiptsState, saveReceipts)
  const upsertPaymentVoucher = makeUpsert<PaymentVoucher>(setPaymentVouchersState, savePayments)
  const deletePaymentVoucher = makeDelete<PaymentVoucher>(setPaymentVouchersState, savePayments)
  const upsertJournal = makeUpsert<JournalVoucher>(setJournalsState, saveJournals)
  const deleteJournal = makeDelete<JournalVoucher>(setJournalsState, saveJournals)
  const upsertBank = makeUpsert<BankAccount>(setBanksState, saveBanks)
  const deleteBank = makeDelete<BankAccount>(setBanksState, saveBanks)
  const upsertSignatory = makeUpsert<BankSignatory>(setSignatoriesState, saveSignatories)
  const deleteSignatory = makeDelete<BankSignatory>(setSignatoriesState, saveSignatories)
  const upsertVoucherSerial = makeUpsert<VoucherSerial>(setVoucherSerialsState, saveSerials)
  const deleteVoucherSerial = makeDelete<VoucherSerial>(setVoucherSerialsState, saveSerials)
  const upsertFund = makeUpsert<Fund>(setFundsState, saveFunds)
  const deleteFund = makeDelete<Fund>(setFundsState, saveFunds)
  const upsertPaymentMode = makeUpsert<PaymentModeOption>(setPaymentModesState, savePaymentModes)
  const deletePaymentMode = makeDelete<PaymentModeOption>(setPaymentModesState, savePaymentModes)
  const upsertDetailType = makeUpsert<AccountDetailType>(setDetailTypesState, saveDetailTypes)
  const deleteDetailType = makeDelete<AccountDetailType>(setDetailTypesState, saveDetailTypes)
  const upsertIncomeMod = makeUpsert<IncomeStatementMod>(setIncomeModsState, saveIncomeMods)
  const deleteIncomeMod = makeDelete<IncomeStatementMod>(setIncomeModsState, saveIncomeMods)
  const setIncomeMods = useCallback((m: IncomeStatementMod[]) => { setIncomeModsState(m); saveIncomeMods(m) }, [])
  const upsertCurrencyRate = makeUpsert<CurrencyRate>(setCurrencyRatesState, saveCurrencyRates)
  const deleteCurrencyRate = makeDelete<CurrencyRate>(setCurrencyRatesState, saveCurrencyRates)
  const clearCurrencyRates = useCallback(() => { setCurrencyRatesState([]); saveCurrencyRates([]) }, [])
  const upsertReconciliation = makeUpsert<BankReconciliation>(setReconciliationsState, saveReconciliations)
  const deleteReconciliation = makeDelete<BankReconciliation>(setReconciliationsState, saveReconciliations)
  const upsertBudget = makeUpsert<Budget>(setBudgetsState, saveBudgets)
  const deleteBudget = makeDelete<Budget>(setBudgetsState, saveBudgets)
  const upsertValueBookEntry = makeUpsert<ValueBookEntry>(setValueBookState, saveValueBook)
  const deleteValueBookEntry = makeDelete<ValueBookEntry>(setValueBookState, saveValueBook)

  const setAccountingSettings = useCallback((s: AccountingSettings) => {
    setAccountingSettingsState(s)
    saveAccountingSettings(s)
  }, [])

  const recordPurchase = useCallback((input: { supplierId: string; lines: PurchaseLine[]; status?: PurchaseStatus; notes?: string; userId: string; date?: string }) => {    if (!input.supplierId) return { ok: false, error: 'Select a supplier.' }
    const lines = input.lines.filter((l) => l.itemId && l.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }
    const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0)
    const now = new Date().toISOString()
    const purchase: Purchase = {
      id: uid('po'),
      number: nextPurchaseNumber(purchases),
      supplierId: input.supplierId,
      lines,
      total,
      status: input.status || 'received',
      notes: input.notes?.trim() || undefined,
      userId: input.userId,
      date: input.date || now.slice(0, 10),
      createdAt: now,
    }
    setPurchasesState((s) => {
      const next = [purchase, ...s]
      savePurchases(next)
      return next
    })
    // A received purchase adds stock.
    if (purchase.status === 'received') {
      setInventoryState((s) => {
        const next = s.map((item) => {
          const line = lines.find((l) => l.itemId === item.id)
          if (!line) return item
          return { ...item, quantity: item.quantity + line.quantity, updatedAt: now.slice(0, 10) }
        })
        saveInventory(next)
        return next
      })
      setStockMovementsState((s) => {
        const movements: StockTransaction[] = lines.map((l) => ({
          id: uid('sm'),
          itemId: l.itemId,
          type: 'in',
          quantity: l.quantity,
          reason: `Purchase ${purchase.number}`,
          userId: input.userId,
          createdAt: now,
        }))
        const next = [...movements, ...s]
        saveStockMovements(next)
        return next
      })
    }
    return { ok: true, purchase }
  }, [purchases])

  const recordSale = useCallback((input: { memberId?: string; customerName?: string; lines: SaleLine[]; method: PaymentMethod; userId: string; date?: string }) => {
    const lines = input.lines.filter((l) => l.itemId && l.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }
    // Validate stock.
    for (const l of lines) {
      const item = inventory.find((i) => i.id === l.itemId)
      if (!item) return { ok: false, error: 'Item not found.' }
      if (item.quantity < l.quantity) return { ok: false, error: `Not enough stock of "${item.name}" (${item.quantity} left).` }
    }
    const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)
    const now = new Date().toISOString()
    const saleDate = input.date || now.slice(0, 10)
    // Build a matching invoice for the sale.
    const invoice: Invoice = {
      id: uid('inv'),
      memberId: input.memberId,
      customerName: input.customerName?.trim() || undefined,
      saleId: undefined,
      number: `INV-${saleDate.slice(0, 4)}-${String(invoices.length + 9000).padStart(4, '0')}`,
      items: lines.map((l) => ({
        desc: inventory.find((i) => i.id === l.itemId)?.name || l.itemId,
        amount: l.quantity * l.unitPrice,
        qty: l.quantity,
        unitPrice: l.unitPrice,
      })),
      total,
      status: 'paid',
      issuedAt: saleDate,
      dueAt: saleDate,
    }
    const sale: Sale = {
      id: uid('sa'),
      number: nextSaleNumber(sales),
      memberId: input.memberId,
      customerName: input.customerName?.trim() || undefined,
      lines,
      total,
      method: input.method,
      status: 'completed',
      userId: input.userId,
      date: saleDate,
      invoiceId: invoice.id,
      createdAt: now,
    }
    invoice.saleId = sale.id
    setSalesState((s) => {
      const next = [sale, ...s]
      saveSales(next)
      return next
    })
    setInvoices((s) => [invoice, ...s])
    setInventoryState((s) => {
      const next = s.map((item) => {
        const line = lines.find((l) => l.itemId === item.id)
        if (!line) return item
        return { ...item, quantity: Math.max(0, item.quantity - line.quantity), updatedAt: now.slice(0, 10) }
      })
      saveInventory(next)
      return next
    })
    setStockMovementsState((s) => {
      const movements: StockTransaction[] = lines.map((l) => ({
        id: uid('sm'),
        itemId: l.itemId,
        type: 'out',
        quantity: -l.quantity,
        reason: `Sale ${sale.number}`,
        userId: input.userId,
        createdAt: now,
      }))
      const next = [...movements, ...s]
      saveStockMovements(next)
      return next
    })
    return { ok: true, sale }
  }, [inventory, sales])

  const updatePurchaseStatus = useCallback((id: string, status: PurchaseStatus) => {
    setPurchasesState((s) => {
      const purchase = s.find((p) => p.id === id)
      if (!purchase || purchase.status === status) return s
      const next = s.map((p) => (p.id === id ? { ...p, status } : p))
      savePurchases(next)
      return next
    })
    // If a purchase moves to received, add its stock (once).
    const purchase = purchases.find((p) => p.id === id)
    if (purchase && purchase.status !== 'received' && status === 'received') {
      const now = new Date().toISOString()
      setInventoryState((s) => {
        const next = s.map((item) => {
          const line = purchase.lines.find((l) => l.itemId === item.id)
          if (!line) return item
          return { ...item, quantity: item.quantity + line.quantity, updatedAt: now.slice(0, 10) }
        })
        saveInventory(next)
        return next
      })
      setStockMovementsState((s) => {
        const movements: StockTransaction[] = purchase.lines.map((l) => ({
          id: uid('sm'),
          itemId: l.itemId,
          type: 'in',
          quantity: l.quantity,
          reason: `Purchase ${purchase.number}`,
          userId: purchase.userId,
          createdAt: now,
        }))
        const next = [...movements, ...s]
        saveStockMovements(next)
        return next
      })
    }
  }, [purchases])

  const refundSale = useCallback((id: string) => {
    const sale = sales.find((s) => s.id === id)
    if (!sale) return { ok: false, error: 'Sale not found.' }
    if (sale.status === 'refunded') return { ok: false, error: 'This sale is already refunded.' }
    setSalesState((s) => {
      const next = s.map((x) => (x.id === id ? { ...x, status: 'refunded' as SaleStatus } : x))
      saveSales(next)
      return next
    })
    // Return the stock.
    const now = new Date().toISOString()
    setInventoryState((s) => {
      const next = s.map((item) => {
        const line = sale.lines.find((l) => l.itemId === item.id)
        if (!line) return item
        return { ...item, quantity: item.quantity + line.quantity, updatedAt: now.slice(0, 10) }
      })
      saveInventory(next)
      return next
    })
    setStockMovementsState((s) => {
      const movements: StockTransaction[] = sale.lines.map((l) => ({
        id: uid('sm'),
        itemId: l.itemId,
        type: 'adjust',
        quantity: l.quantity,
        reason: `Refund ${sale.number}`,
        userId: sale.userId,
        createdAt: now,
      }))
      const next = [...movements, ...s]
      saveStockMovements(next)
      return next
    })
    return { ok: true }
  }, [sales])

  const deletePurchase = useCallback((id: string) => {
    setPurchasesState((s) => {
      const next = s.filter((p) => p.id !== id)
      savePurchases(next)
      return next
    })
  }, [])

  const deleteSale = useCallback((id: string) => {
    setSalesState((s) => {
      const next = s.filter((x) => x.id !== id)
      saveSales(next)
      return next
    })
  }, [])

  const resetData = useCallback((keys: string[]) => {
    const want = new Set(keys)
    const rm = (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } }
    if (want.has('users')) { setUsers(USERS); rm(USERS_KEY) }
    if (want.has('members')) setMembers(MEMBERS)
    if (want.has('trainers')) { setTrainers(TRAINERS); rm(TRAINERS_KEY) }
    if (want.has('staff')) { setStaff(STAFF); rm(STAFF_KEY) }
    if (want.has('plans')) setPlans(PLANS)
    if (want.has('memberships')) { setMemberships(MEMBERSHIPS); rm(MS_KEY) }
    if (want.has('payments')) { setPayments(PAYMENTS); rm(PAY_KEY) }
    if (want.has('invoices')) { setInvoices(INVOICES); rm(INV_KEY) }
    if (want.has('classes')) setClasses(CLASSES)
    if (want.has('bookings')) setBookings(BOOKINGS)
    if (want.has('attendance')) setAttendance(ATTENDANCE)
    if (want.has('workouts')) setWorkouts(WORKOUTS)
    if (want.has('progress')) setProgress(PROGRESS)
    if (want.has('notifications')) setNotifications(NOTIFICATIONS)
    if (want.has('branches')) setBranches(BRANCHES)
    if (want.has('companies')) { setCompaniesState([DEFAULT_COMPANY]); setActiveCompanyIdState(DEFAULT_COMPANY.id); rm(COMPANIES_KEY); rm(ACTIVE_COMPANY_KEY); rm(ACTIVE_BRANCH_KEY) }
    if (want.has('branchSettings')) { setBranchSettingsState([]); rm(BRANCH_SETTINGS_KEY) }
    if (want.has('customFields')) { setCustomFieldsState([]); rm(CUSTOM_FIELDS_KEY) }
    if (want.has('cms')) { setCmsState(DEFAULT_CMS_DATA); rm(CMS_KEY) }
    if (want.has('leads')) setLeads(LEADS)
    if (want.has('messages')) setMessages(MESSAGES)
    if (want.has('audit')) setAudit(AUDIT)
    if (want.has('leaves')) setLeaves(LEAVES)
    if (want.has('sessions')) setSessions(SESSIONS)
    if (want.has('credentialEvents')) { setCredentialEvents([]); rm(CRED_EVENTS_KEY) }
    if (want.has('roles')) { setRolesState(BUILTIN_ROLES); rm(ROLE_STORE_KEY) }
    if (want.has('permissions')) { setPermissionsState(BUILTIN_PERMISSIONS); rm(PERM_STORE_KEY) }
    if (want.has('integrations')) { rm(INT_STORE_KEY); rm(INT_LOG_KEY) }
    if (want.has('inventory')) { setInventoryState(INVENTORY); setSuppliersState(SUPPLIERS); setStockMovementsState(STOCK_MOVEMENTS); setInventoryCategoriesState([...DEFAULT_INVENTORY_CATEGORIES]); setPurchasesState(PURCHASES); setSalesState(SALES); rm(INVENTORY_KEY); rm(SUPPLIERS_KEY); rm(STOCK_MOVEMENTS_KEY); rm(CATEGORIES_KEY); rm(PURCHASES_KEY); rm(SALES_KEY) }
    if (want.has('proposals')) { setProposalsState(PROPOSALS); rm(PROPOSALS_KEY) }
    if (want.has('estimates')) { setEstimatesState(ESTIMATES); rm(ESTIMATES_KEY) }
    if (want.has('salesOrders')) { setSalesOrdersState(SALES_ORDERS); rm(ORDERS_KEY) }
    if (want.has('purchaseOrders')) { setPurchaseOrdersState(PURCHASE_ORDERS); rm(PURCHASE_ORDERS_KEY) }
    if (want.has('purchaseReturns')) { setPurchaseReturnsState(PURCHASE_RETURNS); rm(PURCHASE_RETURNS_KEY) }
    if (want.has('shipments')) { setShipmentsState(SHIPMENTS); rm(SHIPMENTS_KEY) }
    if (want.has('discounts')) { setDiscountsState(DISCOUNTS); rm(DISCOUNTS_KEY) }
    if (want.has('salesReturns')) { setSalesReturnsState(SALES_RETURNS); rm(SALES_RETURNS_KEY) }
    if (want.has('departments')) { setDepartmentsState(DEPARTMENTS); rm(DEPARTMENTS_KEY) }
    if (want.has('payslips')) { setPayslipsState(PAYSLIPS); rm(PAYSLIPS_KEY) }
    if (want.has('jobs')) { setJobsState(JOBS); rm(JOBS_KEY) }
    if (want.has('candidates')) { setCandidatesState(CANDIDATES); rm(CANDIDATES_KEY) }
    if (want.has('reviews')) { setReviewsState(REVIEWS); rm(REVIEWS_KEY) }
    if (want.has('staffAttendance')) { setStaffAttendanceState(STAFF_ATTENDANCE); rm(STAFF_ATTENDANCE_KEY) }
    if (want.has('assets')) { setAssetsState(ASSETS); setDepreciationState(DEPRECIATION_ENTRIES); setAssetTransactionsState(ASSET_TRANSACTIONS); setAssetCategoriesState(DEFAULT_ASSET_CATEGORIES); setAssetConditionsState(DEFAULT_ASSET_CONDITIONS); setDepreciationPolicyState(DEFAULT_DEPRECIATION_POLICY); rm(ASSETS_KEY); rm(DEPRECIATION_KEY); rm(ASSET_TRANSACTIONS_KEY); rm(ASSET_CATEGORIES_KEY); rm(ASSET_CONDITIONS_KEY); rm(DEPRECIATION_POLICY_KEY) }
    if (want.has('customers')) { setCustomersState(CUSTOMERS); setSupplierCategoriesState(DEFAULT_SUPPLIER_CATEGORIES); setCustomerCategoriesState(DEFAULT_CUSTOMER_CATEGORIES); rm(CUSTOMERS_KEY); rm(SUPPLIER_CATEGORIES_KEY); rm(CUSTOMER_CATEGORIES_KEY) }
    if (want.has('modules')) { setModulesState(defaultModuleState()); setSidebarOrderState(defaultSidebarOrder()); rm(MODULES_KEY); rm(SIDEBAR_ORDER_KEY) }
    if (want.has('accounting')) {
      setAccountsState(ACCOUNTS); setAccountingSettingsState(DEFAULT_ACCOUNTING_SETTINGS)
      setReceiptsState(RECEIPTS); setPaymentVouchersState(PAYMENT_VOUCHERS); setJournalsState(JOURNALS)
      setBanksState(BANKS); setSignatoriesState(SIGNATORIES); setVoucherSerialsState(SERIALS); setFundsState(FUNDS); setPaymentModesState(PAYMENT_MODES); setDetailTypesState(DETAIL_TYPES); setIncomeModsState(INCOME_MODS); setCurrencyRatesState(CURRENCY_RATES); setReconciliationsState(RECONCILIATIONS); setBudgetsState(BUDGETS); setValueBookState(VALUE_BOOK)
      rm(ACCOUNTS_KEY); rm(ACCT_SETTINGS_KEY); rm(RECEIPTS_KEY); rm(PAYMENTS_KEY); rm(JOURNALS_KEY)
      rm(BANKS_KEY); rm(SIGNATORIES_KEY); rm(SERIALS_KEY); rm(FUNDS_KEY); rm(PAYMENT_MODES_KEY); rm(DETAIL_TYPES_KEY); rm(INCOME_MODS_KEY); rm(CURRENCY_RATES_KEY); rm(RECON_KEY); rm(BUDGETS_KEY); rm(VALUEBOOK_KEY)
    }
  }, [])

  const value = useMemo<AppStore>(
    () => ({
      users, members, trainers, staff, plans, memberships, payments, invoices, classes, bookings,
      attendance, workouts, progress, notifications, branches, leads, messages, audit, leaves, sessions, company,
      companies, activeCompanyId, activeBranchId, activeCompany, activeBranch, productMode,
      branchSettings, upsertBranchSettings, resetBranchSettings,
      customFields, upsertCustomField, deleteCustomField,
      cms, setCms,
      upsertCompany, deleteCompany, setCompanyStatus, setActiveCompany, setActiveBranch, setProductMode,
      inventory, suppliers, stockMovements, inventoryCategories, purchases, sales, purchaseOrders, purchaseReturns, shipments, discounts, salesReturns, departments, payslips, jobs, candidates, reviews, staffAttendance, assets, depreciation, assetTransactions, assetCategories, assetConditions, depreciationPolicy, customers, supplierCategories, customerCategories, modules, sidebarOrder, accounts, accountingSettings, receipts, paymentVouchers, journals, banks, signatories, voucherSerials, funds, paymentModes, detailTypes, incomeMods, currencyRates, reconciliations, budgets, valueBook, proposals, estimates, salesOrders,
      upsertInventoryItem, deleteInventoryItem, adjustStock, upsertSupplier, deleteSupplier,
      addInventoryCategory, renameInventoryCategory, deleteInventoryCategory,
      recordPurchase, recordSale, updatePurchaseStatus, refundSale, deletePurchase, deleteSale,
      setCompany,
      roles, permissions,
      upsertRole, deleteRole, setRolePermissions, upsertPermission, deletePermission,
      resetData,
      credentialEvents,
      credentialSettings,
      setCredentialSettings,
      paymentSettings,
      setPaymentSettings,
      regenerateMemberCredentials,
      recordCredentialDelivery,
      appendCredentialEvent,
      patchUser,
      upsertUser: (u) => setUsers((s) => (s.some((x) => x.id === u.id) ? s.map((x) => (x.id === u.id ? u : x)) : [...s, u])),
      deleteUser: (id) => {
        setUsers((s) => s.filter((u) => u.id !== id))
        const member = members.find((m) => m.userId === id)
        if (member) setMembers((s) => s.filter((m) => m.id !== member.id))
        setStaff((s) => s.filter((st) => st.userId !== id))
        setTrainers((s) => s.filter((t) => t.userId !== id))
      },
      upsertMember: (m) => setMembers((s) => (s.some((x) => x.id === m.id) ? s.map((x) => (x.id === m.id ? m : x)) : [...s, m])),
      deleteMember: (id) => {
        setMembers((s) => s.filter((m) => m.id !== id))
                const u = members.find((m) => m.id === id)
        if (u) setUsers((s) => s.map((x) => (x.id === u.userId ? { ...x, status: 'inactive' } : x)))
      },
      upsertStaff: (st) => setStaff((s) => (s.some((x) => x.id === st.id) ? s.map((x) => (x.id === st.id ? st : x)) : [...s, st])),
      upsertTrainer: (t) => setTrainers((s) => (s.some((x) => x.id === t.id) ? s.map((x) => (x.id === t.id ? t : x)) : [...s, t])),
      deleteTrainer: (id) => setTrainers((s) => s.filter((t) => t.id !== id)),
      upsertPlan: (p) => setPlans((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p])),
      deletePlan: (id) => setPlans((s) => s.filter((p) => p.id !== id)),
      upsertClass: (c) => setClasses((s) => (s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c])),
      deleteClass: (id) => setClasses((s) => s.filter((c) => c.id !== id)),
      upsertLead: (l) => setLeads((s) => (s.some((x) => x.id === l.id) ? s.map((x) => (x.id === l.id ? l : x)) : [...s, l])),
      deleteLead: (id) => setLeads((s) => s.filter((l) => l.id !== id)),
      upsertPayment: (p) => setPayments((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p])),
      upsertInvoice: (i) => setInvoices((s) => (s.some((x) => x.id === i.id) ? s.map((x) => (x.id === i.id ? i : x)) : [...s, i])),
      deleteInvoice: (id) => setInvoices((s) => s.filter((i) => i.id !== id)),
      upsertProposal: (p) => setProposalsState((s) => { const n = s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p]; saveProposals(n); return n }),
      deleteProposal: (id) => setProposalsState((s) => { const n = s.filter((p) => p.id !== id); saveProposals(n); return n }),
      upsertEstimate: (e) => setEstimatesState((s) => { const n = s.some((x) => x.id === e.id) ? s.map((x) => (x.id === e.id ? e : x)) : [...s, e]; saveEstimates(n); return n }),
      deleteEstimate: (id) => setEstimatesState((s) => { const n = s.filter((e) => e.id !== id); saveEstimates(n); return n }),
      upsertSalesOrder: (o) => setSalesOrdersState((s) => { const n = s.some((x) => x.id === o.id) ? s.map((x) => (x.id === o.id ? o : x)) : [...s, o]; saveSalesOrders(n); return n }),
      deleteSalesOrder: (id) => setSalesOrdersState((s) => { const n = s.filter((o) => o.id !== id); saveSalesOrders(n); return n }),
      upsertPurchaseOrder: (o) => setPurchaseOrdersState((s) => { const n = s.some((x) => x.id === o.id) ? s.map((x) => (x.id === o.id ? o : x)) : [...s, o]; savePurchaseOrders(n); return n }),
      deletePurchaseOrder: (id) => setPurchaseOrdersState((s) => { const n = s.filter((o) => o.id !== id); savePurchaseOrders(n); return n }),
      upsertPurchaseReturn: (r) => setPurchaseReturnsState((s) => { const n = s.some((x) => x.id === r.id) ? s.map((x) => (x.id === r.id ? r : x)) : [...s, r]; savePurchaseReturns(n); return n }),
      deletePurchaseReturn: (id) => setPurchaseReturnsState((s) => { const n = s.filter((r) => r.id !== id); savePurchaseReturns(n); return n }),
      upsertShipment: (sh) => setShipmentsState((s) => { const n = s.some((x) => x.id === sh.id) ? s.map((x) => (x.id === sh.id ? sh : x)) : [...s, sh]; saveShipments(n); return n }),
      deleteShipment: (id) => setShipmentsState((s) => { const n = s.filter((sh) => sh.id !== id); saveShipments(n); return n }),
      upsertDiscount: (d) => setDiscountsState((s) => { const n = s.some((x) => x.id === d.id) ? s.map((x) => (x.id === d.id ? d : x)) : [...s, d]; saveDiscounts(n); return n }),
      deleteDiscount: (id) => setDiscountsState((s) => { const n = s.filter((d) => d.id !== id); saveDiscounts(n); return n }),
      upsertSalesReturn: (r) => setSalesReturnsState((s) => { const n = s.some((x) => x.id === r.id) ? s.map((x) => (x.id === r.id ? r : x)) : [...s, r]; saveSalesReturns(n); return n }),
      deleteSalesReturn: (id) => setSalesReturnsState((s) => { const n = s.filter((r) => r.id !== id); saveSalesReturns(n); return n }),
      upsertDepartment: (d) => setDepartmentsState((s) => { const n = s.some((x) => x.id === d.id) ? s.map((x) => (x.id === d.id ? d : x)) : [...s, d]; saveDepartments(n); return n }),
      deleteDepartment: (id) => setDepartmentsState((s) => { const n = s.filter((d) => d.id !== id); saveDepartments(n); return n }),
      upsertPayslip: (p) => setPayslipsState((s) => { const n = s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p]; savePayslips(n); return n }),
      deletePayslip: (id) => setPayslipsState((s) => { const n = s.filter((p) => p.id !== id); savePayslips(n); return n }),
      upsertJob: (j) => setJobsState((s) => { const n = s.some((x) => x.id === j.id) ? s.map((x) => (x.id === j.id ? j : x)) : [...s, j]; saveJobs(n); return n }),
      deleteJob: (id) => setJobsState((s) => { const n = s.filter((j) => j.id !== id); saveJobs(n); return n }),
      upsertCandidate: (c) => setCandidatesState((s) => { const n = s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c]; saveCandidates(n); return n }),
      deleteCandidate: (id) => setCandidatesState((s) => { const n = s.filter((c) => c.id !== id); saveCandidates(n); return n }),
      upsertReview: (r) => setReviewsState((s) => { const n = s.some((x) => x.id === r.id) ? s.map((x) => (x.id === r.id ? r : x)) : [...s, r]; saveReviews(n); return n }),
      deleteReview: (id) => setReviewsState((s) => { const n = s.filter((r) => r.id !== id); saveReviews(n); return n }),
      upsertStaffAttendance: (a) => setStaffAttendanceState((s) => { const n = s.some((x) => x.id === a.id) ? s.map((x) => (x.id === a.id ? a : x)) : [...s, a]; saveStaffAttendance(n); return n }),
      deleteStaffAttendance: (id) => setStaffAttendanceState((s) => { const n = s.filter((a) => a.id !== id); saveStaffAttendance(n); return n }),
      upsertAsset: (a) => setAssetsState((s) => { const n = s.some((x) => x.id === a.id) ? s.map((x) => (x.id === a.id ? a : x)) : [...s, a]; saveAssets(n); return n }),
      deleteAsset: (id) => setAssetsState((s) => { const n = s.filter((a) => a.id !== id); saveAssets(n); return n }),
      upsertDepreciation: (d) => setDepreciationState((s) => { const n = s.some((x) => x.id === d.id) ? s.map((x) => (x.id === d.id ? d : x)) : [...s, d]; saveDepreciation(n); return n }),
      deleteDepreciation: (id) => setDepreciationState((s) => { const n = s.filter((d) => d.id !== id); saveDepreciation(n); return n }),
      upsertAssetTransaction: (t) => setAssetTransactionsState((s) => { const n = s.some((x) => x.id === t.id) ? s.map((x) => (x.id === t.id ? t : x)) : [...s, t]; saveAssetTransactions(n); return n }),
      deleteAssetTransaction: (id) => setAssetTransactionsState((s) => { const n = s.filter((t) => t.id !== id); saveAssetTransactions(n); return n }),
      addAssetCategory, renameAssetCategory, deleteAssetCategory,
      addAssetCondition, renameAssetCondition, deleteAssetCondition,
      setDepreciationPolicy,
      upsertCustomer, deleteCustomer,
      addSupplierCategory, renameSupplierCategory, deleteSupplierCategory,
      addCustomerCategory, renameCustomerCategory, deleteCustomerCategory,
      setModuleEnabled, setSidebarOrder,
      upsertAccount, deleteAccount, setAccountingSettings,
      upsertReceipt, deleteReceipt, upsertPaymentVoucher, deletePaymentVoucher, upsertJournal, deleteJournal,
      upsertBank, deleteBank, upsertSignatory, deleteSignatory, upsertVoucherSerial, deleteVoucherSerial, upsertFund, deleteFund, upsertPaymentMode, deletePaymentMode, upsertDetailType, deleteDetailType, upsertIncomeMod, deleteIncomeMod, setIncomeMods, upsertCurrencyRate, deleteCurrencyRate, clearCurrencyRates, upsertReconciliation, deleteReconciliation, upsertBudget, deleteBudget,
      upsertValueBookEntry, deleteValueBookEntry,
      upsertMembership: (m) => setMemberships((s) => (s.some((x) => x.id === m.id) ? s.map((x) => (x.id === m.id ? m : x)) : [...s, m])),
      bookClass: (classId, memberId, date) => {
        const cl = classes.find((c) => c.id === classId)
        if (!cl) return { ok: false, status: 'cancelled', message: 'Class not found' }
        const exists = bookings.find((b) => b.classId === classId && b.memberId === memberId && b.date === date && b.status !== 'cancelled')
        if (exists) return { ok: false, status: exists.status, message: 'Already booked' }
        const full = cl.enrolled >= cl.capacity
        const status: Booking['status'] = full ? 'waitlist' : 'booked'
        setBookings((s) => [...s, { id: uid('bk'), classId, memberId, date, status }])
        setClasses((s) => s.map((c) => (c.id === classId ? { ...c, enrolled: full ? c.enrolled : c.enrolled + 1, waitlist: full ? c.waitlist + 1 : c.waitlist } : c)))
        return { ok: true, status, message: full ? 'Added to waitlist' : 'Booked' }
      },
      cancelBooking: (id) => {
        const bk = bookings.find((b) => b.id === id)
        setBookings((s) => s.map((b) => (b.id === id ? { ...b, status: 'cancelled' } : b)))
        if (bk && bk.status === 'booked') {
          setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, enrolled: Math.max(0, c.enrolled - 1) } : c)))
        }
        if (bk && bk.status === 'waitlist') {
          setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, waitlist: Math.max(0, c.waitlist - 1) } : c)))
        }
      },
      checkIn: (memberId, branchId) => {
        const rec: Attendance = {
          id: uid('at'),
          memberId,
          type: 'checkin',
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          branchId,
        }
        setAttendance((s) => [rec, ...s])
        return rec
      },
      addProgress: (p) => setProgress((s) => [...s, p]),
      upsertWorkout: (w) => setWorkouts((s) => (s.some((x) => x.id === w.id) ? s.map((x) => (x.id === w.id ? w : x)) : [...s, w])),
      sendMessage: (m) => setMessages((s) => [...s, { ...m, id: uid('msg'), createdAt: new Date().toISOString(), read: false }]),
      markMessagesRead: (ids) => setMessages((s) => s.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m))),
      notify: (n) => setNotifications((s) => [{ ...n, id: uid('nt'), createdAt: new Date().toISOString(), read: false }, ...s]),
      markNotifRead: (id) => setNotifications((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllNotifRead: (userId) => setNotifications((s) => s.map((n) => (n.userId === userId ? { ...n, read: true } : n))),
      log,
      upsertLeave: (l) => setLeaves((s) => (s.some((x) => x.id === l.id) ? s.map((x) => (x.id === l.id ? l : x)) : [...s, l])),
      upsertSession: (s0) => setSessions((s) => (s.some((x) => x.id === s0.id) ? s.map((x) => (x.id === s0.id ? s0 : x)) : [...s, s0])),
      createMemberAccount,
      takeAttendance: (classId, memberId, present) => {
        setBookings((s) => s.map((b) => (b.classId === classId && b.memberId === memberId ? { ...b, status: present ? 'attended' : 'no-show' } : b)))
        if (present) {
          const cl = classes.find((c) => c.id === classId)
          setAttendance((s) => [
            {
              id: uid('at'),
              memberId,
              type: 'class',
              date: new Date().toISOString().slice(0, 10),
              time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              branchId: cl?.branchId || 'br_airport',
              classId,
            },
            ...s,
          ])
        }
      },
      refundPayment: (id) => {
        setPayments((s) => s.map((p) => (p.id === id ? { ...p, status: 'refunded' } : p)))
      },
      cancelPayment: (id) => {
        const target = payments.find((p) => p.id === id)
        if (!target) return { ok: false, error: 'Payment not found' }
        if (target.status === 'paid') return { ok: false, error: 'Paid payments cannot be cancelled. Use refund instead.' }
        if (target.status === 'refunded') return { ok: false, error: 'Refunded payments cannot be cancelled.' }
        if (target.status === 'cancelled') return { ok: true }
        setPayments((s) => s.map((p) => (p.id === id ? { ...p, status: 'cancelled' } : p)))
        if (target.invoiceId) {
          setInvoices((s) => s.map((i) => (i.id === target.invoiceId ? { ...i, status: 'cancelled' } : i)))
        }
        return { ok: true }
      },
      requestMembershipRenewal: (memberId, planId) => {
        const member = members.find((x) => x.id === memberId)
        if (!member) return { ok: false, error: 'Member not found' }
        const ms = memberships.find((x) => x.id === member.membershipId)
        const plan = plans.find((p) => p.id === (planId || ms?.planId || member.planId))
        if (!ms || !plan) return { ok: false, error: 'No active plan to renew' }

        const desc = `${plan.name} renewal`
        const existing = payments.find(
          (p) => p.memberId === memberId && p.description === desc && (p.status === 'pending' || p.status === 'failed'),
        )
        if (existing) return { ok: true, paymentId: existing.id, invoiceId: existing.invoiceId }

        const invoiceId = uid('inv')
        const paymentId = uid('pay')
        const today = new Date()
        const due = new Date()
        due.setDate(due.getDate() + 7)
        const number = `FP-${today.getFullYear()}-${String(invoices.length + 3000).padStart(4, '0')}`

        setInvoices((s) => [
          {
            id: invoiceId,
            memberId,
            number,
            items: [{ desc, amount: plan.price }],
            total: plan.price,
            status: 'unpaid',
            issuedAt: today.toISOString().slice(0, 10),
            dueAt: due.toISOString().slice(0, 10),
          },
          ...s,
        ])
        setPayments((s) => [
          {
            id: paymentId,
            memberId,
            amount: plan.price,
            method: defaultPaymentMethod(paymentSettings),
            status: 'pending',
            invoiceId,
            date: today.toISOString().slice(0, 10),
            description: desc,
            planId: plan.id,
          },
          ...s,
        ])
        return { ok: true, paymentId, invoiceId }
      },
      createPayment: (input) => {
        const member = members.find((x) => x.id === input.memberId)
        if (!member) return { ok: false, error: 'Member not found' }
        const amount = Math.round(Number(input.amount) * 100) / 100
        if (!amount || amount <= 0) return { ok: false, error: 'Amount must be greater than zero.' }
        const desc = input.description.trim()
        if (!desc) return { ok: false, error: 'A description is required.' }

        const invoiceId = uid('inv')
        const paymentId = uid('pay')
        const today = new Date()
        const due = new Date()
        due.setDate(due.getDate() + 7)
        const number = `FP-${today.getFullYear()}-${String(invoices.length + 3000).padStart(4, '0')}`
        const method: PaymentMethod = input.method || defaultPaymentMethod(paymentSettings)

        const invoice: Invoice = {
          id: invoiceId,
          memberId: input.memberId,
          number,
          items: [{ desc, amount }],
          total: amount,
          status: 'unpaid',
          issuedAt: today.toISOString().slice(0, 10),
          dueAt: due.toISOString().slice(0, 10),
        }
        const payment: Payment = {
          id: paymentId,
          memberId: input.memberId,
          amount,
          method,
          status: 'pending',
          invoiceId,
          date: today.toISOString().slice(0, 10),
          description: desc,
        }
        setInvoices((s) => [invoice, ...s])
        setPayments((s) => [payment, ...s])
        return { ok: true, payment, invoice }
      },
      applyGatewayPayment: (input) => {
        let target: Payment | undefined
        let alreadyPaid = false
        setPayments((s) => {
          target = s.find((p) => p.id === input.paymentId)
            || (input.reference ? s.find((p) => p.reference === input.reference) : undefined)
          if (target?.status === 'paid') {
            alreadyPaid = true
            return s
          }
          if (target?.status === 'refunded') return s
          if (!target && input.memberId && input.amount) {
            const invoiceId = input.invoiceId || uid('inv')
            const paymentId = input.paymentId || uid('pay')
            target = {
              id: paymentId,
              memberId: input.memberId,
              amount: input.amount,
              method: input.method,
              status: input.autoSettle ? 'paid' : 'pending',
              invoiceId,
              date: new Date().toISOString().slice(0, 10),
              description: input.description || 'Paystack payment',
              reference: input.reference,
              gatewayRef: input.gatewayRef,
              gatewayChannel: input.gatewayChannel,
            }
            return [target, ...s]
          }
          if (!target) return s
          return s.map((p) => (p.id === target!.id ? {
            ...p,
            method: input.method,
            status: input.autoSettle ? 'paid' : (p.status === 'failed' ? 'pending' : p.status),
            reference: input.reference,
            gatewayRef: input.gatewayRef || p.gatewayRef,
            gatewayChannel: input.gatewayChannel || p.gatewayChannel,
          } : p))
        })
        if (!target) return { ok: false, error: 'Payment not found.' }
        if (target.status === 'refunded') return { ok: false, error: 'Refunded payments cannot be settled.' }
        if (alreadyPaid) return { ok: true, settled: true }
        if (input.autoSettle) {
          setInvoices((s) => {
            if (s.some((i) => i.id === target!.invoiceId)) {
              return s.map((i) => (i.id === target!.invoiceId ? { ...i, status: 'paid' } : i))
            }
            if (!input.memberId) return s
            const today = new Date().toISOString().slice(0, 10)
            return [{
              id: target!.invoiceId,
              memberId: input.memberId,
              number: `FP-${new Date().getFullYear()}-PS${String(s.length + 1).padStart(3, '0')}`,
              items: [{ desc: target!.description, amount: target!.amount }],
              total: target!.amount,
              status: 'paid',
              issuedAt: today,
              dueAt: today,
            }, ...s]
          })
          setMemberships((s) => {
            const member = members.find((x) => x.id === target!.memberId)
            const ms = s.find((x) => x.id === member?.membershipId)
            const plan = plans.find((p) => p.id === (target!.planId || ms?.planId || member?.planId))
            if (!ms || !plan || !/renew/i.test(target!.description)) return s
            const end = new Date(ms.endDate)
            const today = new Date()
            const base = end > today ? end : today
            base.setDate(base.getDate() + plan.durationDays)
            return s.map((x) => (x.id === ms.id ? { ...x, planId: plan.id, endDate: base.toISOString().slice(0, 10), status: 'active' } : x))
          })
          log('system', 'PAYSTACK', 'Payment', `${target.description} · ${input.reference} · ${input.gatewayChannel || 'paystack'}`)
        }
        return { ok: true, settled: input.autoSettle }
      },
      settlePayment: (paymentId) => {
        const payment = payments.find((p) => p.id === paymentId)
        if (!payment) return { ok: false, error: 'Payment not found' }
        if (payment.status === 'paid') return { ok: false, error: 'This payment is already settled' }
        if (payment.status === 'refunded') return { ok: false, error: 'Refunded payments cannot be settled' }

        setPayments((s) => s.map((p) => (p.id === paymentId ? { ...p, status: 'paid' } : p)))
        setInvoices((s) => s.map((i) => (i.id === payment.invoiceId ? { ...i, status: 'paid' } : i)))

        const member = members.find((x) => x.id === payment.memberId)
        const ms = memberships.find((x) => x.id === member?.membershipId)
        const plan = plans.find((p) => p.id === (payment.planId || ms?.planId || member?.planId))
        if (ms && plan && /renewal/i.test(payment.description)) {
          const end = new Date(ms.endDate)
          const today = new Date()
          const base = end > today ? end : today
          base.setDate(base.getDate() + plan.durationDays)
          setMemberships((s) =>
            s.map((x) => (x.id === ms.id ? { ...x, planId: plan.id, endDate: base.toISOString().slice(0, 10), status: 'active' } : x)),
          )
        }
        return { ok: true }
      },
      upsertBranch: (b) => setBranches((s) => (s.some((x) => x.id === b.id) ? s.map((x) => (x.id === b.id ? b : x)) : [...s, b])),
      deleteBranch: (id) => setBranches((s) => s.filter((b) => b.id !== id)),
    }),
    [
      users, members, trainers, staff, plans, memberships, payments, invoices, classes, bookings,
      attendance, workouts, progress, notifications, branches, leads, messages, audit, leaves, sessions, company,
      companies, activeCompanyId, activeBranchId, activeCompany, activeBranch, productMode,
      branchSettings, upsertBranchSettings, resetBranchSettings,
      customFields, upsertCustomField, deleteCustomField,
      cms, setCms,
      upsertCompany, deleteCompany, setCompanyStatus, setActiveCompany, setActiveBranch, setProductMode,
      inventory, suppliers, stockMovements, inventoryCategories, purchases, sales, purchaseOrders, purchaseReturns, shipments, discounts, salesReturns, departments, payslips, jobs, candidates, reviews, staffAttendance, assets, depreciation, assetTransactions, assetCategories, assetConditions, depreciationPolicy, customers, supplierCategories, customerCategories, modules, sidebarOrder, accounts, accountingSettings, receipts, paymentVouchers, journals, banks, signatories, voucherSerials, funds, paymentModes, detailTypes, incomeMods, currencyRates, reconciliations, budgets, valueBook, proposals, estimates, salesOrders,
      upsertInventoryItem, deleteInventoryItem, adjustStock, upsertSupplier, deleteSupplier,
      addInventoryCategory, renameInventoryCategory, deleteInventoryCategory,
      addAssetCategory, renameAssetCategory, deleteAssetCategory, addAssetCondition, renameAssetCondition, deleteAssetCondition, setDepreciationPolicy, upsertCustomer, deleteCustomer,
      addSupplierCategory, renameSupplierCategory, deleteSupplierCategory, addCustomerCategory, renameCustomerCategory, deleteCustomerCategory, setModuleEnabled, setSidebarOrder,
      upsertAccount, deleteAccount, setAccountingSettings, upsertReceipt, deleteReceipt, upsertPaymentVoucher, deletePaymentVoucher, upsertJournal, deleteJournal,
      upsertBank, deleteBank, upsertSignatory, deleteSignatory, upsertVoucherSerial, deleteVoucherSerial, upsertFund, deleteFund, upsertPaymentMode, deletePaymentMode, upsertDetailType, deleteDetailType, upsertIncomeMod, deleteIncomeMod, setIncomeMods, upsertCurrencyRate, deleteCurrencyRate, clearCurrencyRates, upsertReconciliation, deleteReconciliation, upsertBudget, deleteBudget, upsertValueBookEntry, deleteValueBookEntry,
      recordPurchase, recordSale, updatePurchaseStatus, refundSale, deletePurchase, deleteSale,
      roles, permissions, upsertRole, deleteRole, setRolePermissions, upsertPermission, deletePermission, resetData,
      credentialEvents, credentialSettings, setCredentialSettings, paymentSettings, setPaymentSettings,
      regenerateMemberCredentials, recordCredentialDelivery, appendCredentialEvent, patchUser, log, createMemberAccount,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp')
  return v
}

export function useUserById(id?: string) {
  const { users } = useApp()
  return users.find((u) => u.id === id)
}

export function useMemberProfile(userId?: string) {
  const { members, users, memberships, plans } = useApp()
  const user = users.find((u) => u.id === userId)
  const member = members.find((m) => m.userId === userId)
  const membership = memberships.find((ms) => ms.id === member?.membershipId)
  const plan = plans.find((p) => p.id === (membership?.planId || member?.planId))
  return { user, member, membership, plan }
}
