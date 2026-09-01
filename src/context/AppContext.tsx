import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Attendance, AuditLog, Booking, Branch, GymClass, Invoice, Lead, LeaveRequest,
  Member, Membership, Message, NotificationItem, Payment, Plan, ProgressLog,
  SessionBooking, StaffRecord, Trainer, User, WorkoutPlan, CompanySettings,
  CredentialEvent, CredentialSettings, CredentialScope, CredentialChannel,
  CredentialDeliveryResult, InitialPasswordMode, GatewayPaymentInput, PaymentMethod, PurchasePayment,
  Permission, RoleDef, PaymentSettings, InventoryItem, Supplier, StockTransaction, StockMovementType,
  StockTransfer, StockAdjustment, StockCount, StockAlert, StockTransferStatus, StockAdjustmentType,
  Purchase, Sale, SaleInput, PurchaseLine, SaleLine, PurchaseStatus, SaleStatus,
  Proposal, Estimate, SalesOrder, PurchaseOrder, PurchaseReturn, Shipment, Discount, SalesReturn,
  Department, Payslip, JobPosting, Candidate, PerformanceReview, StaffAttendance,
  Asset,
  DepreciationEntry,
  AssetTransaction,
  DepreciationPolicy,
  Customer,
  StakeholderClassDef,
  StakeholderEntity,
  SystemSettings,
  AccountHistoryEntry,
  Account, AccountingSettings, ReceiptVoucher, PaymentVoucher, JournalVoucher,
  BankAccount, BankReconciliation, BankSignatory, Budget, ValueBookEntry, VoucherSerial, Fund, PaymentModeOption, AccountDetailType, IncomeStatementMod, CurrencyRate, ChequeEntry,
  Company, ProductMode,
  BranchSettings,
  CustomField, CustomFieldValues,
} from '../types'
import {
  loadCompanies, saveCompanies, loadActiveCompanyId, saveActiveCompanyId,
  loadActiveBranchId, saveActiveBranchId, loadProductMode, saveProductMode,
  DEFAULT_COMPANY, COMPANIES_KEY, ACTIVE_COMPANY_KEY, ACTIVE_BRANCH_KEY,
} from '../lib/companies'
import { canAccessBranch, canAccessCompany, canAccessOrgRecord, userCompanyId } from '../lib/accessScope'
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
import { loadInventory, saveInventory, loadSuppliers, saveSuppliers, loadStockMovements, saveStockMovements, loadCategories, saveCategories, loadPurchases, savePurchases, loadSales, saveSales, loadPurchaseOrders, savePurchaseOrders, loadPurchaseReturns, savePurchaseReturns, nextPurchaseNumber, nextSaleNumber, INVENTORY, SUPPLIERS, STOCK_MOVEMENTS, PURCHASES, SALES, PURCHASE_ORDERS, PURCHASE_RETURNS, DEFAULT_INVENTORY_CATEGORIES, INVENTORY_KEY, SUPPLIERS_KEY, STOCK_MOVEMENTS_KEY, CATEGORIES_KEY, PURCHASES_KEY, SALES_KEY, PURCHASE_ORDERS_KEY, PURCHASE_RETURNS_KEY,
  loadStockTransfers, saveStockTransfers, loadStockAdjustments, saveStockAdjustments, loadStockAlerts, saveStockAlerts,
  STOCK_TRANSFERS, STOCK_ADJUSTMENTS, STOCK_ALERTS, STOCK_TRANSFERS_KEY, STOCK_ADJUSTMENTS_KEY, STOCK_ALERTS_KEY,
  loadStockCounts, saveStockCounts, STOCK_COUNTS, STOCK_COUNTS_KEY,
  loadPurchasePayments, savePurchasePayments, nextPurchasePaymentNumber,
} from '../lib/inventory'
import { loadProposals, saveProposals, loadEstimates, saveEstimates, loadSalesOrders, saveSalesOrders, PROPOSALS, ESTIMATES, SALES_ORDERS, PROPOSALS_KEY, ESTIMATES_KEY, ORDERS_KEY } from '../lib/quotes'
import { loadShipments, saveShipments, SHIPMENTS, SHIPMENTS_KEY } from '../lib/shipments'
import { loadDiscounts, saveDiscounts, DISCOUNTS, DISCOUNTS_KEY } from '../lib/discounts'
import { loadSalesReturns, saveSalesReturns, SALES_RETURNS, SALES_RETURNS_KEY } from '../lib/salesReturns'
import { loadDepartments, saveDepartments, loadPayslips, savePayslips, loadJobs, saveJobs, loadCandidates, saveCandidates, loadReviews, saveReviews, loadStaffAttendance, saveStaffAttendance, DEPARTMENTS, PAYSLIPS, JOBS, CANDIDATES, REVIEWS, STAFF_ATTENDANCE, DEPARTMENTS_KEY, PAYSLIPS_KEY, JOBS_KEY, CANDIDATES_KEY, REVIEWS_KEY, STAFF_ATTENDANCE_KEY } from '../lib/hrm'
import { loadAssets, saveAssets, ASSETS, ASSETS_KEY } from '../lib/assets'
import { loadDepreciation, saveDepreciation, DEPRECIATION_ENTRIES, DEPRECIATION_KEY } from '../lib/depreciation'
import { loadAssetTransactions, saveAssetTransactions, ASSET_TRANSACTIONS, ASSET_TRANSACTIONS_KEY } from '../lib/assetTransactions'
import { loadCustomers, saveCustomers, CUSTOMERS, CUSTOMERS_KEY } from '../lib/customers'
import { loadStakeholderClasses, saveStakeholderClasses, loadStakeholderEntities, saveStakeholderEntities } from '../lib/stakeholders'
import { loadSystemSettings, saveSystemSettings } from '../lib/systemSettings'
import { loadAccountHistory, saveAccountHistory, historyRowsForReceipt, historyRowsForPayment, historyRowsForJournal } from '../lib/accounting'
import { loadModules, saveModules, defaultModuleState, loadSidebarOrder, saveSidebarOrder, defaultSidebarOrder, MODULES_KEY, SIDEBAR_ORDER_KEY, type ModuleState } from '../lib/modules'
import {
  loadAccounts, saveAccounts, loadAccountingSettings, saveAccountingSettings,
  loadReceipts, saveReceipts, loadPayments, savePayments, loadJournals, saveJournals,
  loadBanks, saveBanks, loadReconciliations, saveReconciliations, loadBudgets, saveBudgets,
  loadValueBook, saveValueBook, loadCheques, saveCheques, loadSignatories, saveSignatories, loadSerials, saveSerials, loadFunds, saveFunds, loadPaymentModes, savePaymentModes, loadDetailTypes, saveDetailTypes, loadIncomeMods, saveIncomeMods, loadCurrencyRates, saveCurrencyRates, ACCOUNTS, RECEIPTS, PAYMENTS as PAYMENT_VOUCHERS, JOURNALS, BANKS, RECONCILIATIONS, BUDGETS, VALUE_BOOK, CHEQUES, SIGNATORIES, SERIALS, FUNDS, PAYMENT_MODES, DETAIL_TYPES, INCOME_MODS, CURRENCY_RATES, DEFAULT_ACCOUNTING_SETTINGS,
  ACCOUNTS_KEY, ACCT_SETTINGS_KEY, RECEIPTS_KEY, PAYMENTS_KEY, JOURNALS_KEY, BANKS_KEY, RECON_KEY, BUDGETS_KEY, VALUEBOOK_KEY, CHECKS_KEY, SIGNATORIES_KEY, SERIALS_KEY, FUNDS_KEY, PAYMENT_MODES_KEY, DETAIL_TYPES_KEY, INCOME_MODS_KEY, CURRENCY_RATES_KEY,
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

export type PurchaseInput = {
  companyId?: string
  branchId?: string
  supplierId: string
  lines: PurchaseLine[]
  status?: PurchaseStatus
  referenceNo?: string
  discount?: number
  shippingCharges?: number
  shippingDetails?: string
  paymentMethod?: PaymentMethod
  paidOn?: string
  notes?: string
  userId: string
  date?: string
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
  /** Full catalogue across branches — for pickers like POS that scope themselves. */
  inventoryUnscoped: InventoryItem[]
  suppliers: Supplier[]
  stockMovements: StockTransaction[]
  stockTransfers: StockTransfer[]
  stockAdjustments: StockAdjustment[]
  stockCounts: StockCount[]
  stockAlerts: StockAlert[]
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
  stakeholderClasses: StakeholderClassDef[]
  stakeholderEntities: StakeholderEntity[]
  systemSettings: SystemSettings
  setSystemSettings: (s: SystemSettings) => void
  /** General ledger — all posted transactions (accounting_account_history). */
  accountHistory: AccountHistoryEntry[]
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
  cheques: ChequeEntry[]
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
  upsertStakeholderClass: (c: StakeholderClassDef) => void
  deleteStakeholderClass: (id: string) => void
  upsertStakeholderEntity: (e: StakeholderEntity) => void
  deleteStakeholderEntity: (id: string) => void
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
  upsertCheque: (c: ChequeEntry) => void
  deleteCheque: (id: string) => void
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
  upsertStockTransfer: (t: StockTransfer) => void
  deleteStockTransfer: (id: string) => void
  upsertStockAdjustment: (a: StockAdjustment) => void
  deleteStockAdjustment: (id: string) => void
  upsertStockCount: (c: StockCount) => void
  deleteStockCount: (id: string) => void
  upsertStockAlert: (a: StockAlert) => void
  deleteStockAlert: (id: string) => void
  upsertSupplier: (s: Supplier) => void
  deleteSupplier: (id: string) => void
  addInventoryCategory: (name: string) => { ok: boolean; error?: string }
  renameInventoryCategory: (oldName: string, newName: string) => { ok: boolean; error?: string }
  deleteInventoryCategory: (name: string) => { ok: boolean; error?: string }
  recordPurchase: (input: PurchaseInput) => { ok: boolean; error?: string; purchase?: Purchase }
  updatePurchase: (id: string, input: PurchaseInput) => { ok: boolean; error?: string }
  purchasePayments: PurchasePayment[]
  addPurchasePayment: (purchaseId: string, input: { amount: number; method: PaymentMethod; paidOn: string; note?: string; account?: string }) => { ok: boolean; error?: string; payment?: PurchasePayment }
  updatePurchasePayment: (id: string, patch: { amount?: number; method?: PaymentMethod; paidOn?: string; note?: string; account?: string }) => { ok: boolean; error?: string }
  deletePurchasePayment: (id: string) => { ok: boolean; error?: string }
  recordSale: (input: SaleInput) => { ok: boolean; error?: string; sale?: Sale }
  updateSale: (id: string, input: SaleInput) => { ok: boolean; error?: string; sale?: Sale }
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
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
    try { return localStorage.getItem('fitpro_session') } catch { return null }
  })
  useEffect(() => {
    const syncSession = () => {
      try { setSessionUserId(localStorage.getItem('fitpro_session')) } catch { setSessionUserId(null) }
    }
    window.addEventListener('fitpro-session-change', syncSession)
    window.addEventListener('storage', syncSession)
    return () => {
      window.removeEventListener('fitpro-session-change', syncSession)
      window.removeEventListener('storage', syncSession)
    }
  }, [])
  const sessionUser = useMemo(() => users.find((candidate) => candidate.id === sessionUserId) || null, [sessionUserId, users])
  // The role definition can be tenant-owned even when its id is not one of
  // the built-in role names. Read the persisted definition here (before the
  // main definition state is declared) so custom-role users inherit the same
  // company boundary as Company Admin users.
  const sessionRoleDefinition = sessionUser ? loadRoles().find((role) => role.id === sessionUser.role) : undefined
  const customRoleIsFixedBranch = Boolean(sessionRoleDefinition && !sessionRoleDefinition.builtin && sessionRoleDefinition.portal !== 'admin')
  const roleIsTenantScoped = sessionUser?.role === 'branch_admin' || sessionUser?.role === 'company_admin' || sessionUser?.role === 'head_office'
    || Boolean(sessionRoleDefinition && !sessionRoleDefinition.builtin && !customRoleIsFixedBranch && (sessionRoleDefinition.companyId || sessionUser?.companyId))
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
  const [suppliers, setSuppliersState] = useState<Supplier[]>(() => loadSuppliers())
  const [customers, setCustomersState] = useState<Customer[]>(() => loadCustomers())
  const [companies, setCompaniesState] = useState<Company[]>(() => loadCompanies())
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>(() => loadActiveCompanyId(loadCompanies()))
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => loadActiveBranchId(BRANCHES))
  const [productMode, setProductModeState] = useState<ProductMode>(() => loadProductMode())
  const fixedBranchUser = sessionUser?.role === 'staff' || sessionUser?.role === 'trainer' || sessionUser?.role === 'member' || sessionUser?.role === 'supplier' || sessionUser?.role === 'customer' || customRoleIsFixedBranch
  const assignedBranchId = fixedBranchUser
    ? sessionUser?.branchId
      || (sessionUser ? members.find((record) => record.userId === sessionUser.id)?.branchId : undefined)
      || (sessionUser ? suppliers.find((record) => record.userId === sessionUser.id)?.branchId : undefined)
      || (sessionUser ? customers.find((record) => record.userId === sessionUser.id)?.branchId : undefined)
      || (sessionUser ? staff.find((record) => record.userId === sessionUser.id)?.branchId : undefined)
      || (sessionUser ? trainers.find((record) => record.userId === sessionUser.id)?.branchId : undefined)
    : undefined
  const assignedBranchCompanyId = branches.find((branch) => branch.id === assignedBranchId)?.companyId
  const branchContextEnabled = Boolean(sessionUser && (
    roleIsTenantScoped || fixedBranchUser || ['super_admin', 'gym_manager'].includes(sessionUser.role) || productMode === 'advance'
  ))
  const activeCompany = useMemo(() => {
    const scopedId = sessionUser && (roleIsTenantScoped || fixedBranchUser)
      ? (roleIsTenantScoped ? userCompanyId(sessionUser, branches) : assignedBranchCompanyId || activeCompanyId)
      : activeCompanyId
    return companies.find((c) => c.id === scopedId) || companies.find((c) => c.isDefault) || companies[0] || null
  }, [activeCompanyId, assignedBranchCompanyId, companies, branches, fixedBranchUser, roleIsTenantScoped, sessionUser])
  const activeBranch = useMemo(() => {
    if (!branchContextEnabled || !sessionUser) return branches.find((b) => b.id === activeBranchId) || branches[0] || null
    const companyId = roleIsTenantScoped
      ? userCompanyId(sessionUser, branches)
      : fixedBranchUser
        ? assignedBranchCompanyId || activeCompanyId
        : activeCompanyId
    const allowed = sessionUser.role === 'branch_admin' || fixedBranchUser
      ? branches.filter((branch) => branch.id === (sessionUser.role === 'branch_admin' ? sessionUser.branchId : assignedBranchId))
      : branches.filter((branch) => (branch.companyId || DEFAULT_COMPANY.id) === companyId)
    const selected = allowed.find((branch) => branch.id === activeBranchId) || allowed[0]
    return selected || null
  }, [activeBranchId, activeCompanyId, assignedBranchCompanyId, assignedBranchId, branchContextEnabled, branches, fixedBranchUser, roleIsTenantScoped, sessionUser])
  const effectiveActiveCompanyId = sessionUser && (roleIsTenantScoped || fixedBranchUser)
    ? (roleIsTenantScoped ? userCompanyId(sessionUser, branches) : assignedBranchCompanyId || activeCompanyId)
    : activeCompanyId
  const effectiveActiveBranchId = branchContextEnabled ? activeBranch?.id || '' : activeBranchId

  // New and edited branch-owned records inherit the same context shown in the
  // header unless the form explicitly supplies a permitted company/branch.
  // This prevents a record created in one module from appearing in every
  // branch after the user switches modules.
  const stampSelectedOrg = useCallback(<T extends object>(record: T): T => {
    const current = record as T & ScopedRecord
    const requestedBranch = current.branchId
    // '' is an explicit "no branch" marker (e.g. bulk "Remove from location"):
    // keep the record branch-less / company-wide instead of re-stamping the
    // active branch the way unassigned new records are.
    const explicitNoBranch = requestedBranch === ''
    const requestedBranchRecord = requestedBranch ? branches.find((branch) => branch.id === requestedBranch) : undefined
    const branchIsPermitted = !requestedBranchRecord || !sessionUser || (
      sessionUser.role === 'branch_admin' || fixedBranchUser
        ? requestedBranchRecord.id === (sessionUser.role === 'branch_admin' ? sessionUser.branchId : assignedBranchId)
        : !branchContextEnabled || !effectiveActiveCompanyId || (requestedBranchRecord.companyId || DEFAULT_COMPANY.id) === effectiveActiveCompanyId
    )
    const branchId = explicitNoBranch
      ? undefined
      : branchIsPermitted
        ? requestedBranch || (branchContextEnabled ? effectiveActiveBranchId || undefined : undefined)
        : (branchContextEnabled ? effectiveActiveBranchId || undefined : undefined)
    return {
      ...record,
      companyId: (roleIsTenantScoped || fixedBranchUser)
        ? (effectiveActiveCompanyId || DEFAULT_COMPANY.id)
        : (current.companyId || effectiveActiveCompanyId || DEFAULT_COMPANY.id),
      branchId,
    } as T
  }, [assignedBranchId, branchContextEnabled, branches, effectiveActiveBranchId, effectiveActiveCompanyId, fixedBranchUser, roleIsTenantScoped, sessionUser])

  const stampCompany = useCallback(<T extends object>(record: T): T => {
    const current = record as T & { companyId?: string }
    return {
      ...record,
      companyId: (roleIsTenantScoped || fixedBranchUser)
        ? (effectiveActiveCompanyId || DEFAULT_COMPANY.id)
        : (current.companyId || effectiveActiveCompanyId || DEFAULT_COMPANY.id),
    } as T
  }, [effectiveActiveCompanyId, fixedBranchUser, roleIsTenantScoped])

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
    const branch = branches.find((candidate) => candidate.id === s.branchId)
    if (!branch || (sessionUser && !canAccessBranch(sessionUser, branch.id, branches, effectiveActiveCompanyId))) return
    const scoped = { ...s, companyId: branch.companyId || s.companyId || DEFAULT_COMPANY.id }
    setBranchSettingsState((prev) => {
      const next = prev.some((x) => x.branchId === scoped.branchId)
        ? prev.map((x) => (x.branchId === scoped.branchId ? scoped : x))
        : [...prev, scoped]
      saveBranchSettings(next)
      return next
    })
  }, [branches, effectiveActiveCompanyId, sessionUser])
  const resetBranchSettings = useCallback((branchId: string) => {
    const branch = branches.find((candidate) => candidate.id === branchId)
    if (!branch || (sessionUser && !canAccessBranch(sessionUser, branch.id, branches, effectiveActiveCompanyId))) return
    setBranchSettingsState((prev) => {
      const next = prev.filter((x) => x.branchId !== branchId)
      saveBranchSettings(next)
      return next
    })
  }, [branches, effectiveActiveCompanyId, sessionUser])
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
  const [stockMovements, setStockMovementsState] = useState<StockTransaction[]>(() => loadStockMovements())
  const [stockTransfers, setStockTransfersState] = useState<StockTransfer[]>(() => loadStockTransfers())
  const [stockAdjustments, setStockAdjustmentsState] = useState<StockAdjustment[]>(() => loadStockAdjustments())
  const [stockCounts, setStockCountsState] = useState<StockCount[]>(() => loadStockCounts())
  const [stockAlerts, setStockAlertsState] = useState<StockAlert[]>(() => loadStockAlerts())
  const [inventoryCategories, setInventoryCategoriesState] = useState<string[]>(() => loadCategories())
  const [purchases, setPurchasesState] = useState<Purchase[]>(() => loadPurchases())
  const [purchasePayments, setPurchasePaymentsState] = useState<PurchasePayment[]>(() => loadPurchasePayments())
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
  const [stakeholderClasses, setStakeholderClassesState] = useState<StakeholderClassDef[]>(() => loadStakeholderClasses())
  const [stakeholderEntities, setStakeholderEntitiesState] = useState<StakeholderEntity[]>(() => loadStakeholderEntities())
  const [systemSettings, setSystemSettingsState] = useState<SystemSettings>(() => loadSystemSettings())
  const [accountHistory, setAccountHistoryState] = useState<AccountHistoryEntry[]>(() => loadAccountHistory())
  const [supplierCategories, setSupplierCategoriesState] = useState<string[]>(() => loadSupplierCategories())
  const [customerCategories, setCustomerCategoriesState] = useState<string[]>(() => loadCustomerCategories())
  const [modules, setModulesState] = useState<ModuleState>(() => loadModules())
  const [sidebarOrder, setSidebarOrderState] = useState<string[]>(() => loadSidebarOrder())
  const [accounts, setAccountsState] = useState<Account[]>(() => loadAccounts())
  const [accountingSettings, setAccountingSettingsState] = useState<AccountingSettings>(() => loadAccountingSettings())
  const [receipts, setReceiptsState] = useState<ReceiptVoucher[]>(() => loadReceipts())
  const [paymentVouchers, setPaymentVouchersState] = useState<PaymentVoucher[]>(() => loadPayments())
  const [journals, setJournalsState] = useState<JournalVoucher[]>(() => loadJournals())
  // Bank accounts are a VIEW over the chart of accounts (accounting_accounts
  // type 16 = Bank) — one database table, Perfex-style. No separate store.
  const banks = useMemo<BankAccount[]>(
    () => accounts
      .filter((a) => a.accountTypeId === 16)
      .map((a) => ({
        id: a.id,
        code: a.code || undefined,
        name: a.name,
        bank: a.bank || '',
        accountNumber: a.accountNumber || '',
        branch: a.bankBranch,
        parentId: a.parentId,
        type: a.bankAccountType || 'current',
        detailType: a.detailType,
        noteNo: a.noteNo,
        fundId: a.fundId,
        description: a.description,
        routing: a.routing,
        contactNo: a.contactNo,
        email: a.email,
        country: a.country,
        openingBalance: a.primaryBalance ?? 0,
        balance: a.bankBalance ?? a.primaryBalance ?? 0,
        status: a.status === 'inactive' ? 'inactive' as const : 'active' as const,
      })),
    [accounts],
  )
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
  const [cheques, setChequesState] = useState<ChequeEntry[]>(() => loadCheques())
  const [roles, setRolesState] = useState<RoleDef[]>(() => loadRoles())
  const [permissions, setPermissionsState] = useState<Permission[]>(() => loadPermissions())

  // Role and permission definitions follow the signed-in user's company. Built-in
  // platform definitions are global; custom definitions with a companyId are
  // tenant records. A Super Admin intentionally receives the unfiltered set so
  // platform support and cross-company administration continue to work.
  const definitionCompanyId = sessionUser && sessionUser.role !== 'super_admin'
    ? userCompanyId(sessionUser, branches)
    : undefined
  const visibleDefinitionRoles = useMemo(() => {
    if (!sessionUser || sessionUser.role === 'super_admin') return roles
    const companyOnly = sessionUser.role === 'company_admin'
    return roles.filter((role) => role.builtin || role.companyId === definitionCompanyId || (!companyOnly && !role.companyId))
  }, [definitionCompanyId, roles, sessionUser])
  const visibleDefinitionPermissions = useMemo(() => {
    if (!sessionUser || sessionUser.role === 'super_admin') return permissions
    const companyOnly = sessionUser.role === 'company_admin'
    return permissions.filter((permission) => permission.builtin || permission.companyId === definitionCompanyId || (!companyOnly && !permission.companyId))
  }, [definitionCompanyId, permissions, sessionUser])

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

  const roleAllowedForSession = (roleId: string, existingRoleId?: string) => {
    if (!sessionUser || sessionUser.role === 'super_admin' || roleId === existingRoleId) return true
    if (roleId === 'super_admin') return false
    const definition = roles.find((role) => role.id === roleId)
    if (!definition) return false
    if (definition.builtin || definition.companyId === definitionCompanyId) return true
    return sessionUser.role !== 'company_admin' && !definition.companyId
  }

  const patchUser = useCallback((id: string, patch: Partial<User>) => {
    setUsers((s) => {
      const target = s.find((candidate) => candidate.id === id)
      if (!target) return s
      if (sessionUser && sessionUser.role !== 'super_admin' && userCompanyId(target, branches) !== definitionCompanyId) return s
      if (patch.role && !roleAllowedForSession(patch.role, target.role)) return s
      return s.map((user) => (user.id === id ? stampSelectedOrg({ ...user, ...patch }) : user))
    })
  }, [branches, definitionCompanyId, roleAllowedForSession, sessionUser, setUsers, stampSelectedOrg])

  const upsertUser = useCallback((user: User) => {
    const scoped = stampSelectedOrg(user)
    setUsers((s) => {
      const existing = s.find((item) => item.id === scoped.id)
      if (existing && sessionUser && sessionUser.role !== 'super_admin' && userCompanyId(existing, branches) !== definitionCompanyId) return s
      if (!roleAllowedForSession(scoped.role, existing?.role)) return s
      return existing ? s.map((item) => (item.id === scoped.id ? scoped : item)) : [...s, scoped]
    })
  }, [branches, definitionCompanyId, roleAllowedForSession, sessionUser, setUsers, stampSelectedOrg])

  const createMemberAccount = useCallback((input: CreateMemberInput) => {
    const userId = uid('u')
    const memberId = uid('mb')
    const membershipId = uid('ms')
    const planId = input.planId || 'pl_month'
    const requestedBranchId = input.branchId || effectiveActiveBranchId || activeBranchId || 'br_airport'
    const requestedBranch = branches.find((branch) => branch.id === requestedBranchId)
    const branchId = sessionUser?.role === 'branch_admin'
      ? effectiveActiveBranchId || sessionUser.branchId || requestedBranchId
      : branchContextEnabled && requestedBranch && (requestedBranch.companyId || DEFAULT_COMPANY.id) !== effectiveActiveCompanyId
        ? effectiveActiveBranchId || requestedBranchId
        : requestedBranchId
    const companyId = branches.find((branch) => branch.id === branchId)?.companyId || effectiveActiveCompanyId || activeCompanyId || DEFAULT_COMPANY.id
    const plan = plans.find((p) => p.id === planId) || plans[0]
    const start = new Date()
    const end = new Date()
    end.setDate(end.getDate() + plan.durationDays)
    const user: User = {
      id: userId,
      companyId,
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
      companyId,
      branchId,
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
      companyId,
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

    // Bill the approved plan: raise an unpaid invoice + pending payment so the
    // plan fee appears under Receive Payments → Outstanding immediately.
    if (plan.price > 0) {
      const invoiceId = uid('inv')
      const due = new Date()
      due.setDate(due.getDate() + 7)
      const isoToday = start.toISOString().slice(0, 10)
      setInvoices((s) => [
        {
          id: invoiceId,
          companyId,
          branchId,
          memberId,
          number: `FP-${start.getFullYear()}-${String(s.length + 3000).padStart(4, '0')}`,
          items: [{ desc: `${plan.name} plan — new membership`, amount: plan.price }],
          total: plan.price,
          status: 'unpaid',
          issuedAt: isoToday,
          dueAt: due.toISOString().slice(0, 10),
        },
        ...s,
      ])
      setPayments((s) => [
        {
          id: uid('pay'),
          companyId,
          branchId,
          memberId,
          amount: plan.price,
          method: defaultPaymentMethod(paymentSettings),
          status: 'pending',
          invoiceId,
          date: isoToday,
          description: `${plan.name} plan — new membership`,
          planId: plan.id,
        },
        ...s,
      ])
    }

    log(userId, 'CREATE', 'Member', `Created ${input.name}${plan.price > 0 ? ` — ${plan.name} invoiced` : ''}`)
    return { userId, memberId }
  }, [activeBranchId, activeCompanyId, branchContextEnabled, branches, effectiveActiveBranchId, effectiveActiveCompanyId, plans, log, roleIsTenantScoped, sessionUser, setUsers, setInvoices, setPayments, paymentSettings])

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
    const isSuperAdmin = sessionUser?.role === 'super_admin'
    setRolesState((s) => {
      const existing = s.find((role) => role.id === r.id)
      // A tenant administrator can only mutate definitions owned by the
      // current company. Built-in roles are platform records and are never
      // replaced by a tenant write.
      if (sessionUser && !isSuperAdmin && (r.builtin || existing?.builtin || (existing && existing.companyId !== definitionCompanyId))) return s
      const allowedPermissionKeys = isSuperAdmin
        ? new Set(permissions.map((permission) => permission.key))
        : new Set(permissions
          .filter((permission) => permission.builtin || permission.companyId === definitionCompanyId || (sessionUser?.role !== 'company_admin' && !permission.companyId))
          .map((permission) => permission.key))
      const scoped: RoleDef = r.builtin
        ? { ...r, companyId: undefined }
        : {
            ...r,
            companyId: isSuperAdmin || !sessionUser ? r.companyId : definitionCompanyId,
            permissions: r.permissions.filter((key) => allowedPermissionKeys.has(key)),
          }
      const next = existing
        ? s.map((role) => (role.id === r.id ? scoped : role))
        : [...s, scoped]
      saveRoles(next)
      return next
    })
  }, [definitionCompanyId, permissions, sessionUser])

  const deleteRole = useCallback((id: string) => {
    const isSuperAdmin = sessionUser?.role === 'super_admin'
    setRolesState((s) => {
      const target = s.find((role) => role.id === id)
      if (!target || target.builtin || (sessionUser && !isSuperAdmin && target.companyId !== definitionCompanyId)) return s
      const next = s.filter((role) => role.id !== id)
      saveRoles(next)
      return next
    })
  }, [definitionCompanyId, sessionUser])

  const setRolePermissions = useCallback((roleId: string, perms: string[]) => {
    const isSuperAdmin = sessionUser?.role === 'super_admin'
    setRolesState((s) => {
      const target = s.find((role) => role.id === roleId)
      if (!target || (target.builtin && !isSuperAdmin) || (sessionUser && !isSuperAdmin && target.companyId !== definitionCompanyId)) return s
      const allowedPermissionKeys = isSuperAdmin
        ? new Set(permissions.map((permission) => permission.key))
        : new Set(permissions
          .filter((permission) => permission.builtin || permission.companyId === definitionCompanyId || (sessionUser?.role !== 'company_admin' && !permission.companyId))
          .map((permission) => permission.key))
      const safePermissions = perms.filter((key) => allowedPermissionKeys.has(key))
      const next = s.map((role) => (role.id === roleId ? { ...role, permissions: safePermissions } : role))
      saveRoles(next)
      return next
    })
  }, [definitionCompanyId, permissions, sessionUser])

  const upsertPermission = useCallback((p: Permission) => {
    const isSuperAdmin = sessionUser?.role === 'super_admin'
    setPermissionsState((s) => {
      const existing = s.find((permission) => permission.key === p.key)
      // Built-in permissions are immutable from tenant context. Custom keys
      // are globally unique so a role permission string can never resolve to
      // another company's definition.
      if (p.builtin || existing?.builtin) return s
      if (sessionUser && !isSuperAdmin && existing && existing.companyId !== definitionCompanyId) return s
      if (!existing && s.some((permission) => permission.key === p.key)) return s
      const scoped: Permission = {
        ...p,
        builtin: false,
        companyId: isSuperAdmin || !sessionUser ? p.companyId : definitionCompanyId,
      }
      const next = existing
        ? s.map((permission) => (permission.key === p.key ? scoped : permission))
        : [...s, scoped]
      savePermissions(next)
      return next
    })
  }, [definitionCompanyId, sessionUser])

  const deletePermission = useCallback((key: string) => {
    const isSuperAdmin = sessionUser?.role === 'super_admin'
    const canDelete = permissions.some((permission) => (
      permission.key === key
      && !permission.builtin
      && (!sessionUser || isSuperAdmin || permission.companyId === definitionCompanyId)
    ))
    if (!canDelete) return
    setPermissionsState((s) => {
      const next = s.filter((permission) => {
        if (permission.key !== key || permission.builtin) return true
        return !(!sessionUser || isSuperAdmin || permission.companyId === definitionCompanyId)
      })
      savePermissions(next)
      return next
    })
    setRolesState((s) => {
      const next = s.map((role) => {
        const belongsToUser = !sessionUser || isSuperAdmin || role.builtin || role.companyId === definitionCompanyId
        return belongsToUser ? { ...role, permissions: role.permissions.filter((permissionKey) => permissionKey !== key) } : role
      })
      saveRoles(next)
      return next
    })
  }, [definitionCompanyId, permissions, sessionUser])

  const upsertInventoryItem = useCallback((i: InventoryItem) => {
    const scoped = stampSelectedOrg(i)
    setInventoryState((s) => {
      const next = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]
      saveInventory(next)
      return next
    })
  }, [stampSelectedOrg])

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
    let itemOrg: Pick<InventoryItem, 'companyId' | 'branchId'> = {}
    setInventoryState((s) => {
      const item = s.find((i) => i.id === itemId)
      if (!item) { error = 'Item not found'; return s }
      itemOrg = { companyId: item.companyId, branchId: item.branchId }
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
      const next = [stampSelectedOrg({
        id: uid('sm'),
        itemId,
        ...itemOrg,
        type,
        quantity: signed,
        reason: reason.trim() || (type === 'in' ? 'Stock received' : type === 'out' ? 'Stock issued' : 'Manual adjustment'),
        userId: 'system',
        createdAt: new Date().toISOString(),
      }), ...s]
      saveStockMovements(next)
      return next
    })
    return { ok: true }
  }, [stampSelectedOrg])

  const upsertStockTransfer = useCallback((transfer: StockTransfer) => {
    const scoped = {
      ...transfer,
      companyId: transfer.companyId || effectiveActiveCompanyId || DEFAULT_COMPANY.id,
      fromBranchId: transfer.fromBranchId || branches.find((branch) => branch.name === transfer.from)?.id,
      toBranchId: transfer.toBranchId || branches.find((branch) => branch.name === transfer.to)?.id,
    }
    setStockTransfersState((s) => {
      const next = s.some((item) => item.id === scoped.id) ? s.map((item) => (item.id === scoped.id ? scoped : item)) : [...s, scoped]
      saveStockTransfers(next)
      return next
    })
  }, [branches, effectiveActiveCompanyId])

  const deleteStockTransfer = useCallback((id: string) => {
    setStockTransfersState((s) => {
      const next = s.filter((item) => item.id !== id)
      saveStockTransfers(next)
      return next
    })
  }, [])

  const upsertStockAdjustment = useCallback((adjustment: StockAdjustment) => {
    const scoped = stampSelectedOrg(adjustment)
    setStockAdjustmentsState((s) => {
      const next = s.some((item) => item.id === scoped.id) ? s.map((item) => (item.id === scoped.id ? scoped : item)) : [...s, scoped]
      saveStockAdjustments(next)
      return next
    })
  }, [stampSelectedOrg])

  const deleteStockAdjustment = useCallback((id: string) => {
    setStockAdjustmentsState((s) => {
      const next = s.filter((item) => item.id !== id)
      saveStockAdjustments(next)
      return next
    })
  }, [])

  const upsertStockCount = useCallback((count: StockCount) => {
    const scoped = stampSelectedOrg(count)
    setStockCountsState((s) => {
      const next = s.some((item) => item.id === scoped.id) ? s.map((item) => (item.id === scoped.id ? scoped : item)) : [...s, scoped]
      saveStockCounts(next)
      return next
    })
  }, [stampSelectedOrg])

  const deleteStockCount = useCallback((id: string) => {
    setStockCountsState((s) => {
      const next = s.filter((item) => item.id !== id)
      saveStockCounts(next)
      return next
    })
  }, [])

  const upsertStockAlert = useCallback((alert: StockAlert) => {
    const scoped = stampSelectedOrg(alert)
    setStockAlertsState((s) => {
      const next = s.some((item) => item.id === scoped.id) ? s.map((item) => (item.id === scoped.id ? scoped : item)) : [...s, scoped]
      saveStockAlerts(next)
      return next
    })
  }, [stampSelectedOrg])

  const deleteStockAlert = useCallback((id: string) => {
    setStockAlertsState((s) => {
      const next = s.filter((item) => item.id !== id)
      saveStockAlerts(next)
      return next
    })
  }, [])

  const upsertSupplier = useCallback((sup: Supplier) => {
    const scoped = stampSelectedOrg(sup)
    setSuppliersState((s) => {
      const next = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]
      saveSuppliers(next)
      return next
    })
  }, [stampSelectedOrg])

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
    const scoped = stampSelectedOrg(c)
    setCustomersState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveCustomers(n); return n })
  }, [stampSelectedOrg])

  const deleteCustomer = useCallback((id: string) => {
    setCustomersState((s) => { const n = s.filter((c) => c.id !== id); saveCustomers(n); return n })
  }, [])

  const setSystemSettings = useCallback((s: SystemSettings) => {
    setSystemSettingsState(s)
    saveSystemSettings(s)
  }, [])

  const upsertStakeholderClass = useCallback((c: StakeholderClassDef) => {
    setStakeholderClassesState((s) => { const n = s.some((x) => x.id === c.id) ? s.map((x) => (x.id === c.id ? c : x)) : [...s, c]; saveStakeholderClasses(n); return n })
  }, [])

  const deleteStakeholderClass = useCallback((id: string) => {
    setStakeholderClassesState((s) => { const n = s.filter((c) => c.id !== id); saveStakeholderClasses(n); return n })
    setStakeholderEntitiesState((s) => { const n = s.filter((e) => e.classId !== id); saveStakeholderEntities(n); return n })
  }, [])

  const upsertStakeholderEntity = useCallback((e: StakeholderEntity) => {
    const scoped = stampSelectedOrg(e)
    setStakeholderEntitiesState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveStakeholderEntities(n); return n })
  }, [stampSelectedOrg])

  const deleteStakeholderEntity = useCallback((id: string) => {
    setStakeholderEntitiesState((s) => { const n = s.filter((e) => e.id !== id); saveStakeholderEntities(n); return n })
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

  const upsertAccountBase = makeUpsert<Account>(setAccountsState, saveAccounts)
  const upsertAccount = useCallback((account: Account) => upsertAccountBase(stampCompany(account)), [stampCompany, upsertAccountBase])
  const deleteAccount = makeDelete<Account>(setAccountsState, saveAccounts)
  // ---- Posting engine ---------------------------------------------------
  // Perfex-style general ledger: saving a voucher REPLACES its rows in
  // accounting_account_history; deleting (or reverting to draft/void)
  // removes them. Reports read this store — never the documents directly.
  const syncHistory = useCallback((relType: string, relId: string, rows: AccountHistoryEntry[]) => {
    setAccountHistoryState((s) => {
      const n = [...s.filter((h) => !(h.relType === relType && h.relId === relId)), ...rows]
      saveAccountHistory(n)
      return n
    })
  }, [])

  const upsertReceiptBase = makeUpsert<ReceiptVoucher>(setReceiptsState, saveReceipts)
  const upsertReceipt = useCallback((rv: ReceiptVoucher) => {
    const scoped = stampSelectedOrg(rv)
    upsertReceiptBase(scoped)
    syncHistory('income', scoped.id, historyRowsForReceipt(scoped))
  }, [stampSelectedOrg, upsertReceiptBase, syncHistory])
  const deleteReceiptBase = makeDelete<ReceiptVoucher>(setReceiptsState, saveReceipts)
  const deleteReceipt = useCallback((id: string) => {
    deleteReceiptBase(id)
    syncHistory('income', id, [])
  }, [deleteReceiptBase, syncHistory])

  const upsertPaymentVoucherBase = makeUpsert<PaymentVoucher>(setPaymentVouchersState, savePayments)
  const upsertPaymentVoucher = useCallback((pv: PaymentVoucher) => {
    const scoped = stampSelectedOrg(pv)
    upsertPaymentVoucherBase(scoped)
    syncHistory('expense', scoped.id, historyRowsForPayment(scoped))
  }, [stampSelectedOrg, upsertPaymentVoucherBase, syncHistory])
  const deletePaymentVoucherBase = makeDelete<PaymentVoucher>(setPaymentVouchersState, savePayments)
  const deletePaymentVoucher = useCallback((id: string) => {
    deletePaymentVoucherBase(id)
    syncHistory('expense', id, [])
  }, [deletePaymentVoucherBase, syncHistory])

  const upsertJournalBase = makeUpsert<JournalVoucher>(setJournalsState, saveJournals)
  const upsertJournal = useCallback((jv: JournalVoucher) => {
    const scoped = stampSelectedOrg(jv)
    upsertJournalBase(scoped)
    syncHistory('journal_entry', scoped.id, historyRowsForJournal(scoped))
  }, [stampSelectedOrg, upsertJournalBase, syncHistory])
  const deleteJournalBase = makeDelete<JournalVoucher>(setJournalsState, saveJournals)
  const deleteJournal = useCallback((id: string) => {
    deleteJournalBase(id)
    syncHistory('journal_entry', id, [])
  }, [deleteJournalBase, syncHistory])
  const upsertBank = useCallback((b: BankAccount) => {
    const id = b.id.replace(/^bk_/, 'ac_')
    const existing = accounts.find((a) => a.id === id)
    upsertAccount({
      ...(existing || {}),
      id,
      code: b.code || existing?.code || '',
      name: b.name,
      type: 'asset',
      accountTypeId: 16,
      detailType: b.detailType || existing?.detailType || 'Bank',
      parentId: b.parentId ? b.parentId.replace(/^bk_/, 'ac_') : undefined,
      primaryBalance: b.openingBalance,
      bankBalance: b.balance,
      description: b.description,
      noteNo: b.noteNo,
      fundId: b.fundId,
      bank: b.bank,
      accountNumber: b.accountNumber,
      bankBranch: b.branch,
      bankAccountType: b.type,
      routing: b.routing,
      contactNo: b.contactNo,
      email: b.email,
      country: b.country,
      status: b.status,
    })
  }, [accounts, upsertAccount])
  const deleteBank = useCallback((id: string) => {
    deleteAccount(id.replace(/^bk_/, 'ac_'))
  }, [deleteAccount])
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
  const upsertReconciliationBase = makeUpsert<BankReconciliation>(setReconciliationsState, saveReconciliations)
  const upsertReconciliation = useCallback((item: BankReconciliation) => upsertReconciliationBase(stampSelectedOrg(item)), [stampSelectedOrg, upsertReconciliationBase])
  const deleteReconciliation = makeDelete<BankReconciliation>(setReconciliationsState, saveReconciliations)
  const upsertBudgetBase = makeUpsert<Budget>(setBudgetsState, saveBudgets)
  const upsertBudget = useCallback((item: Budget) => upsertBudgetBase(stampSelectedOrg(item)), [stampSelectedOrg, upsertBudgetBase])
  const deleteBudget = makeDelete<Budget>(setBudgetsState, saveBudgets)
  const upsertValueBookEntryBase = makeUpsert<ValueBookEntry>(setValueBookState, saveValueBook)
  const upsertValueBookEntry = useCallback((item: ValueBookEntry) => upsertValueBookEntryBase(stampSelectedOrg(item)), [stampSelectedOrg, upsertValueBookEntryBase])
  const deleteValueBookEntry = makeDelete<ValueBookEntry>(setValueBookState, saveValueBook)
  const upsertChequeBase = makeUpsert<ChequeEntry>(setChequesState, saveCheques)
  const upsertCheque = useCallback((item: ChequeEntry) => upsertChequeBase(stampSelectedOrg(item)), [stampSelectedOrg, upsertChequeBase])
  const deleteCheque = makeDelete<ChequeEntry>(setChequesState, saveCheques)

  const setAccountingSettings = useCallback((s: AccountingSettings) => {
    setAccountingSettingsState(s)
    saveAccountingSettings(s)
  }, [])

  const recordPurchase = useCallback((input: PurchaseInput) => {
    if (!input.supplierId) return { ok: false, error: 'Select a supplier.' }
    if (!input.branchId && !effectiveActiveBranchId) return { ok: false, error: 'Select a business location.' }
    const lines = input.lines.filter((l) => l.itemId && l.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }
    const lineTotal = (l: PurchaseLine) => l.quantity * l.unitCost * (1 - Math.min(Math.max(l.discountPercent || 0, 0), 100) / 100)
    const net = lines.reduce((sum, l) => sum + lineTotal(l), 0)
    const discount = Math.min(Math.max(input.discount || 0, 0), net)
    const shipping = Math.max(input.shippingCharges || 0, 0)
    const total = Math.round(Math.max(0, net - discount + shipping) * 100) / 100
    const now = new Date().toISOString()
    const purchase: Purchase = stampSelectedOrg({
      id: uid('po'),
      companyId: input.companyId,
      branchId: input.branchId,
      number: input.referenceNo?.trim() || nextPurchaseNumber(purchases),
      referenceNo: input.referenceNo?.trim() || undefined,
      supplierId: input.supplierId,
      lines,
      total,
      status: input.status || 'received',
      discount: discount || undefined,
      shippingCharges: shipping || undefined,
      shippingDetails: input.shippingDetails?.trim() || undefined,
      paymentMethod: input.paymentMethod || undefined,
      paidOn: input.paidOn || undefined,
      notes: input.notes?.trim() || undefined,
      userId: input.userId,
      date: input.date || now.slice(0, 10),
      createdAt: now,
    })
    setPurchasesState((s) => {
      const next = [purchase, ...s]
      savePurchases(next)
      return next
    })
    // Paid at creation -> keep a matching settlement payment record.
    if (purchase.status === 'paid') {
      const nowIso = new Date().toISOString()
      const payment: PurchasePayment = stampSelectedOrg({
        id: uid('pp'),
        purchaseId: purchase.id,
        referenceNo: nextPurchasePaymentNumber(purchasePayments),
        amount: total,
        method: purchase.paymentMethod || 'cash',
        paidOn: purchase.paidOn ? `${purchase.paidOn}T${nowIso.slice(11, 16)}` : nowIso,
        userId: input.userId,
        createdAt: nowIso,
      })
      setPurchasePaymentsState((s) => { const n = [payment, ...s]; savePurchasePayments(n); return n })
    }
    // A received purchase adds stock.
    if (purchase.status === 'received') {
      setInventoryState((s) => {
        const next = s.map((item) => {
          const line = lines.find((l) => l.itemId === item.id)
          if (!line) return item
          return { ...item, quantity: item.quantity + line.quantity, sellPrice: typeof line.sellPrice === 'number' && line.sellPrice > 0 ? line.sellPrice : item.sellPrice, updatedAt: now.slice(0, 10) }
        })
        saveInventory(next)
        return next
      })
      setStockMovementsState((s) => {
        const movements: StockTransaction[] = lines.map((l) => ({
          id: uid('sm'),
          companyId: purchase.companyId,
          branchId: purchase.branchId,
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
  }, [activeBranchId, activeCompanyId, effectiveActiveBranchId, effectiveActiveCompanyId, purchases, stampSelectedOrg])

  // Edits header/lines/metadata of an existing purchase. Stock effects are NOT
  // re-applied here — received quantities only change through status updates.
  const updatePurchase = useCallback((id: string, input: PurchaseInput) => {
    const existing = purchases.find((p) => p.id === id)
    if (!existing) return { ok: false, error: 'Purchase not found.' }
    if (!input.supplierId) return { ok: false, error: 'Select a supplier.' }
    const lines = input.lines.filter((l) => l.itemId && l.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }
    const lineTotal = (l: PurchaseLine) => l.quantity * l.unitCost * (1 - Math.min(Math.max(l.discountPercent || 0, 0), 100) / 100)
    const net = lines.reduce((sum, l) => sum + lineTotal(l), 0)
    const discount = Math.min(Math.max(input.discount || 0, 0), net)
    const shipping = Math.max(input.shippingCharges || 0, 0)
    const total = Math.round(Math.max(0, net - discount + shipping) * 100) / 100
    setPurchasesState((s) => s.map((p) => (p.id === id ? {
      ...p,
      branchId: input.branchId || p.branchId,
      referenceNo: input.referenceNo?.trim() || undefined,
      supplierId: input.supplierId,
      lines,
      total,
      status: input.status || p.status,
      discount: discount || undefined,
      shippingCharges: shipping || undefined,
      shippingDetails: input.shippingDetails?.trim() || undefined,
      paymentMethod: input.paymentMethod || undefined,
      paidOn: input.paidOn || undefined,
      notes: input.notes?.trim() || undefined,
      date: input.date || p.date,
      ...(input.status === 'paid' ? {} : { paymentMethod: undefined, paidOn: undefined }),
    } : p)))
    // Keep payment records in step with the Paid flag.
    if ((input.status || existing.status) === 'paid') {
      setPurchasePaymentsState((s) => {
        if (s.some((pp) => pp.purchaseId === id)) return s
        const nowIso = new Date().toISOString()
        const payment: PurchasePayment = stampSelectedOrg({
          id: uid('pp'),
          purchaseId: id,
          referenceNo: nextPurchasePaymentNumber(s),
          amount: total,
          method: input.paymentMethod || 'cash',
          paidOn: input.paidOn ? `${input.paidOn}T${nowIso.slice(11, 16)}` : nowIso,
          userId: input.userId,
          createdAt: nowIso,
        })
        const n = [payment, ...s]; savePurchasePayments(n); return n
      })
    } else if (existing.status === 'paid') {
      setPurchasePaymentsState((s) => { const n = s.filter((pp) => pp.purchaseId !== id); if (n.length !== s.length) savePurchasePayments(n); return n })
    }
    return { ok: true }
  }, [purchases, purchasePayments])

  const recordSale = useCallback((input: SaleInput) => {
    const lines = input.lines.filter((l) => l.itemId && l.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }
    // Validate stock.
    for (const l of lines) {
      const item = inventory.find((i) => i.id === l.itemId)
      if (!item) return { ok: false, error: 'Item not found.' }
      if (item.quantity < l.quantity) return { ok: false, error: `Not enough stock of "${item.name}" (${item.quantity} left).` }
    }
    const total = typeof input.total === 'number'
      ? Math.max(0, input.total)
      : lines.reduce((sum, l) => sum + Math.max(0, l.quantity * l.unitPrice - (l.discount || 0)), 0)
    const now = new Date().toISOString()
    const saleDate = input.date || now.slice(0, 10)
    // Build a matching invoice for the sale.
    const invoice: Invoice = stampSelectedOrg({
      id: uid('inv'),
      companyId: input.companyId,
      branchId: input.branchId,
      memberId: input.memberId,
      customerName: input.customerName?.trim() || undefined,
      saleId: undefined,
      number: `INV-${saleDate.slice(0, 4)}-${String(invoices.length + 9000).padStart(4, '0')}`,
      items: lines.map((l) => ({
        desc: inventory.find((i) => i.id === l.itemId)?.name || l.itemId,
        amount: Math.max(0, l.quantity * l.unitPrice - (l.discount || 0)),
        qty: l.quantity,
        unitPrice: l.unitPrice,
      })),
      total,
      status: 'paid',
      issuedAt: saleDate,
      dueAt: saleDate,
    })
    const sale: Sale = stampSelectedOrg({
      id: uid('sa'),
      companyId: input.companyId,
      branchId: input.branchId,
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
      details: input.details,
      createdAt: now,
    })
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
        companyId: sale.companyId,
        branchId: sale.branchId,
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
  }, [activeBranchId, activeCompanyId, effectiveActiveBranchId, effectiveActiveCompanyId, inventory, sales, stampSelectedOrg])

  const updateSale = useCallback((id: string, input: SaleInput) => {
    const existing = sales.find((sale) => sale.id === id)
    if (!existing) return { ok: false, error: 'Sale not found.' }
    if (existing.status === 'refunded') return { ok: false, error: 'A refunded sale cannot be edited.' }
    const lines = input.lines.filter((line) => line.itemId && line.quantity > 0)
    if (!lines.length) return { ok: false, error: 'Add at least one item.' }

    // Restore the original quantities first, then reserve the edited quantities.
    // This lets an edit increase or decrease a sale without double-counting stock.
    const available = new Map(inventory.map((item) => [item.id, item.quantity]))
    for (const line of existing.lines) {
      if (available.has(line.itemId)) available.set(line.itemId, (available.get(line.itemId) || 0) + line.quantity)
    }
    for (const line of lines) {
      const item = inventory.find((candidate) => candidate.id === line.itemId)
      if (!item) return { ok: false, error: 'Item not found.' }
      const remaining = (available.get(line.itemId) || 0) - line.quantity
      if (remaining < 0) return { ok: false, error: `Not enough stock of "${item.name}" (${available.get(line.itemId) || 0} left).` }
      available.set(line.itemId, remaining)
    }

    const total = typeof input.total === 'number'
      ? Math.max(0, input.total)
      : lines.reduce((sum, line) => sum + Math.max(0, line.quantity * line.unitPrice - (line.discount || 0)), 0)
    const now = new Date().toISOString()
    const updated: Sale = stampSelectedOrg({
      ...existing,
      companyId: input.companyId || existing.companyId,
      branchId: input.branchId || existing.branchId,
      memberId: input.memberId,
      customerName: input.customerName?.trim() || undefined,
      lines,
      total,
      method: input.method,
      date: input.date || existing.date || now.slice(0, 10),
      details: input.details,
    })

    setSalesState((current) => {
      const next = current.map((sale) => sale.id === id ? updated : sale)
      saveSales(next)
      return next
    })
    setInventoryState((current) => {
      const next = current.map((item) => available.has(item.id) ? { ...item, quantity: available.get(item.id) || 0, updatedAt: now.slice(0, 10) } : item)
      saveInventory(next)
      return next
    })
    setStockMovementsState((current) => {
      const oldQuantities = new Map<string, number>()
      const newQuantities = new Map<string, number>()
      existing.lines.forEach((line) => oldQuantities.set(line.itemId, (oldQuantities.get(line.itemId) || 0) + line.quantity))
      lines.forEach((line) => newQuantities.set(line.itemId, (newQuantities.get(line.itemId) || 0) + line.quantity))
      const ids = new Set([...oldQuantities.keys(), ...newQuantities.keys()])
      const movements: StockTransaction[] = Array.from(ids).flatMap((itemId) => {
        const delta = (newQuantities.get(itemId) || 0) - (oldQuantities.get(itemId) || 0)
        if (!delta) return []
        return [{
          id: uid('sm'),
          companyId: updated.companyId,
          branchId: updated.branchId,
          itemId,
          type: delta > 0 ? 'out' as const : 'adjust' as const,
          quantity: -delta,
          reason: `Edit ${updated.number}`,
          userId: input.userId,
          createdAt: now,
        }]
      })
      if (!movements.length) return current
      const next = [...movements, ...current]
      saveStockMovements(next)
      return next
    })
    if (existing.invoiceId) {
      setInvoices((current) => current.map((invoice) => invoice.id === existing.invoiceId ? {
        ...invoice,
        companyId: updated.companyId,
        branchId: updated.branchId,
        memberId: updated.memberId,
        customerName: updated.customerName,
        items: lines.map((line) => ({
          desc: inventory.find((item) => item.id === line.itemId)?.name || line.itemId,
          amount: Math.max(0, line.quantity * line.unitPrice - (line.discount || 0)),
          qty: line.quantity,
          unitPrice: line.unitPrice,
        })),
        total,
        issuedAt: updated.date,
        dueAt: updated.date,
      } : invoice))
    }
    return { ok: true, sale: updated }
  }, [activeBranchId, activeCompanyId, effectiveActiveBranchId, effectiveActiveCompanyId, inventory, sales, setInvoices, stampSelectedOrg])

  const updatePurchaseStatus = useCallback((id: string, status: PurchaseStatus) => {
    setPurchasesState((s) => {
      const purchase = s.find((p) => p.id === id)
      if (!purchase || purchase.status === status) return s
      const next = s.map((p) => (p.id === id ? { ...p, status, ...(status === 'paid' ? {} : { paymentMethod: undefined, paidOn: undefined }) } : p))
      savePurchases(next)
      return next
    })
    // Keep settlement records in step with the Paid flag: paying creates a
    // full-amount payment, un-paying clears them.
    const settlePurchase = purchases.find((p) => p.id === id)
    if (settlePurchase && status === 'paid' && settlePurchase.status !== 'paid') {
      setPurchasePaymentsState((s) => {
        if (s.some((pp) => pp.purchaseId === id)) return s
        const nowIso = new Date().toISOString()
        const payment: PurchasePayment = stampSelectedOrg({
          id: uid('pp'),
          purchaseId: id,
          referenceNo: nextPurchasePaymentNumber(s),
          amount: settlePurchase.total,
          method: settlePurchase.paymentMethod || 'cash',
          paidOn: settlePurchase.paidOn ? `${settlePurchase.paidOn}T${nowIso.slice(11, 16)}` : nowIso,
          userId: sessionUser?.id,
          createdAt: nowIso,
        })
        const n = [payment, ...s]; savePurchasePayments(n); return n
      })
    } else if (settlePurchase && status !== 'paid' && settlePurchase.status === 'paid') {
      setPurchasePaymentsState((s) => { const n = s.filter((pp) => pp.purchaseId !== id); if (n.length !== s.length) savePurchasePayments(n); return n })
    }
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
          companyId: purchase.companyId || effectiveActiveCompanyId || DEFAULT_COMPANY.id,
          branchId: purchase.branchId || effectiveActiveBranchId || undefined,
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
  }, [effectiveActiveBranchId, effectiveActiveCompanyId, purchases])

  const addPurchasePayment = useCallback((purchaseId: string, input: { amount: number; method: PaymentMethod; paidOn: string; note?: string; account?: string }) => {
    const purchase = purchases.find((p) => p.id === purchaseId)
    if (!purchase) return { ok: false, error: 'Purchase not found.' }
    const amount = Math.round(Math.max(0, input.amount || purchase.total) * 100) / 100
    if (amount <= 0) return { ok: false, error: 'Enter a payment amount.' }
    const now = new Date().toISOString()
    const payment: PurchasePayment = stampSelectedOrg({
      id: uid('pp'),
      purchaseId,
      referenceNo: nextPurchasePaymentNumber(purchasePayments),
      amount,
      method: input.method,
      paidOn: input.paidOn || now,
      note: input.note?.trim() || undefined,
      account: input.account?.trim() || undefined,
      userId: sessionUser?.id,
      createdAt: now,
    })
    setPurchasePaymentsState((s) => { const n = [payment, ...s]; savePurchasePayments(n); return n })
    setPurchasesState((s) => {
      const next = s.map((p) => (p.id === purchaseId ? { ...p, status: 'paid' as PurchaseStatus, paymentMethod: input.method, paidOn: input.paidOn.slice(0, 10) } : p))
      savePurchases(next)
      return next
    })
    return { ok: true, payment }
  }, [purchases, purchasePayments, sessionUser])

  const updatePurchasePayment = useCallback((id: string, patch: { amount?: number; method?: PaymentMethod; paidOn?: string; note?: string; account?: string }) => {
    const payment = purchasePayments.find((pp) => pp.id === id)
    if (!payment) return { ok: false, error: 'Payment not found.' }
    setPurchasePaymentsState((s) => s.map((pp) => (pp.id === id ? {
      ...pp,
      ...(patch.amount !== undefined ? { amount: Math.round(Math.max(0, patch.amount) * 100) / 100 } : {}),
      ...(patch.method ? { method: patch.method } : {}),
      ...(patch.paidOn ? { paidOn: patch.paidOn } : {}),
      note: patch.note?.trim() || undefined,
      account: patch.account?.trim() || undefined,
    } : pp)))
    setPurchasesState((s) => s.map((p) => (p.id === payment.purchaseId ? {
      ...p,
      ...(patch.method ? { paymentMethod: patch.method } : {}),
      ...(patch.paidOn ? { paidOn: patch.paidOn.slice(0, 10) } : {}),
    } : p)))
    return { ok: true }
  }, [purchasePayments])

  const deletePurchasePayment = useCallback((id: string) => {
    const payment = purchasePayments.find((pp) => pp.id === id)
    if (!payment) return { ok: false, error: 'Payment not found.' }
    setPurchasePaymentsState((s) => { const n = s.filter((pp) => pp.id !== id); savePurchasePayments(n); return n })
    const remaining = purchasePayments.filter((pp) => pp.purchaseId === payment.purchaseId && pp.id !== id)
    if (!remaining.length) {
      setPurchasesState((s) => {
        const next = s.map((p) => (p.id === payment.purchaseId ? { ...p, status: 'received' as PurchaseStatus, paymentMethod: undefined, paidOn: undefined } : p))
        savePurchases(next)
        return next
      })
    }
    return { ok: true }
  }, [purchasePayments])

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
          companyId: sale.companyId || effectiveActiveCompanyId || DEFAULT_COMPANY.id,
          branchId: sale.branchId || effectiveActiveBranchId || undefined,
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
  }, [effectiveActiveBranchId, effectiveActiveCompanyId, sales])

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
      setSignatoriesState(SIGNATORIES); setVoucherSerialsState(SERIALS); setFundsState(FUNDS); setPaymentModesState(PAYMENT_MODES); setDetailTypesState(DETAIL_TYPES); setIncomeModsState(INCOME_MODS); setCurrencyRatesState(CURRENCY_RATES); setReconciliationsState(RECONCILIATIONS); setBudgetsState(BUDGETS); setValueBookState(VALUE_BOOK); setChequesState(CHEQUES)
      rm(ACCOUNTS_KEY); rm(ACCT_SETTINGS_KEY); rm(RECEIPTS_KEY); rm(PAYMENTS_KEY); rm(JOURNALS_KEY)
      rm(BANKS_KEY); rm(SIGNATORIES_KEY); rm(SERIALS_KEY); rm(FUNDS_KEY); rm(PAYMENT_MODES_KEY); rm(DETAIL_TYPES_KEY); rm(INCOME_MODS_KEY); rm(CURRENCY_RATES_KEY); rm(RECON_KEY); rm(BUDGETS_KEY); rm(VALUEBOOK_KEY); rm(CHECKS_KEY)
    }
  }, [])

  type ScopedRecord = { companyId?: string; branchId?: string }
  type ScopeLink = {
    userId?: string
    memberId?: string
    assetId?: string
    classId?: string
    trainerId?: string
    staffUserId?: string
    supplierId?: string
    customerId?: string
    jobId?: string
    saleId?: string
    salesOrderId?: string
    invoiceId?: string
    itemId?: string
    branchId?: string
    companyId?: string
  }

  /**
   * Resolve organisation ownership for both modern records and older seed or
   * localStorage records that pre-date company/branch metadata.  A module does
   * not have to know how another module stores its relationship: a booking can
   * resolve through its class, a depreciation row through its asset, a stock
   * movement through its item, a purchase through its supplier, a sale through
   * its customer, and accounting history through its source voucher. This keeps
   * the header branch selector authoritative everywhere.
   */
  const resolveOrg = useCallback((record: ScopedRecord & Record<string, unknown>, link?: ScopeLink): ScopedRecord => {
    const getString = (value: Record<string, unknown>, key: string) => {
      const candidate = value[key]
      return typeof candidate === 'string' && candidate ? candidate : undefined
    }
    const asRecord = (value: unknown): Record<string, unknown> | undefined => (
      value && typeof value === 'object' ? value as Record<string, unknown> : undefined
    )
    const branchFor = (id?: string) => id ? branches.find((branch) => branch.id === id) : undefined
    const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const branchFromText = (values: unknown[]) => {
      const text = normalizeText(values.filter((value): value is string => typeof value === 'string').join(' '))
      if (!text) return undefined
      // Prefer a complete branch name/address/code, then use a distinctive
      // name token (Airport, Osu, Legon, Tema, etc.) for legacy locations.
      return branches.find((branch) => {
        const aliases = [branch.id, branch.name, branch.address, branch.code]
          .filter((value): value is string => Boolean(value))
          .map(normalizeText)
        if (aliases.some((alias) => alias && text.includes(alias))) return true
        const tokens = normalizeText(branch.name)
          .split(' ')
          .filter((token) => token.length >= 3 && !['city', 'flagship', 'branch', 'community'].includes(token))
        return tokens.some((token) => text.includes(token))
      })
    }
    const orgOf = (value: Record<string, unknown> | undefined): ScopedRecord => {
      if (!value) return {}
      const branchId = getString(value, 'branchId')
      return {
        companyId: getString(value, 'companyId') || branchFor(branchId)?.companyId,
        branchId,
      }
    }
    const addCandidate = (list: ScopedRecord[], value: Record<string, unknown> | undefined) => {
      const org = orgOf(value)
      if (org.companyId || org.branchId) list.push(org)
    }

    const directBranchId = link?.branchId || getString(record, 'branchId')
    const direct: ScopedRecord = {
      companyId: link?.companyId || getString(record, 'companyId') || branchFor(directBranchId)?.companyId,
      branchId: directBranchId,
    }
    const candidates: ScopedRecord[] = []
    if (direct.companyId || direct.branchId) candidates.push(direct)

    const memberId = link?.memberId || getString(record, 'memberId')
    const linkedMember = memberId ? members.find((member) => member.id === memberId) : undefined
    const memberUser = linkedMember ? users.find((user) => user.id === linkedMember.userId) : undefined
    const memberOrg: ScopedRecord = {
      companyId: linkedMember?.companyId || memberUser?.companyId || branchFor(linkedMember?.branchId || memberUser?.branchId)?.companyId,
      branchId: linkedMember?.branchId || memberUser?.branchId,
    }

    const supplierId = link?.supplierId || getString(record, 'supplierId')
    const linkedSupplier = supplierId ? suppliers.find((supplier) => supplier.id === supplierId) : undefined
    const supplierUser = linkedSupplier ? users.find((user) => user.id === linkedSupplier.userId) : undefined
    const supplierOrg: ScopedRecord = {
      companyId: linkedSupplier?.companyId || supplierUser?.companyId || branchFor(linkedSupplier?.branchId || supplierUser?.branchId)?.companyId,
      branchId: linkedSupplier?.branchId || supplierUser?.branchId,
    }

    const customerId = link?.customerId || getString(record, 'customerId')
    const customerName = getString(record, 'customerName')
    const normalizedCustomerName = customerName ? normalizeText(customerName) : ''
    const linkedCustomer = customerId
      ? customers.find((customer) => customer.id === customerId)
      : normalizedCustomerName
        ? customers.find((customer) => [customer.name, customer.company].filter(Boolean).some((value) => normalizeText(value as string) === normalizedCustomerName))
        : undefined
    const customerUser = linkedCustomer ? users.find((user) => user.id === linkedCustomer.userId) : undefined
    const customerOrg: ScopedRecord = {
      companyId: linkedCustomer?.companyId || customerUser?.companyId || branchFor(linkedCustomer?.branchId || customerUser?.branchId)?.companyId,
      branchId: linkedCustomer?.branchId || customerUser?.branchId,
    }

    const userIds = [
      link?.userId,
      link?.staffUserId,
      getString(record, 'userId'),
      getString(record, 'staffUserId'),
      getString(record, 'createdBy'),
      getString(record, 'addedFrom'),
      getString(record, 'reviewerId'),
      getString(record, 'headUserId'),
    ].filter((value): value is string => Boolean(value))
    const linkedUsers = userIds
      .map((id) => users.find((user) => user.id === id))
      .filter((user): user is User => Boolean(user))
    const userOrg = linkedUsers.reduce<ScopedRecord>((found, user) => found.branchId ? found : {
      companyId: user.companyId || branchFor(user.branchId)?.companyId || found.companyId,
      branchId: user.branchId || found.branchId,
    }, {})

    const trainerId = link?.trainerId || getString(record, 'trainerId')
    const linkedTrainer = trainerId ? trainers.find((trainer) => trainer.id === trainerId) : undefined
    const trainerUser = linkedTrainer ? users.find((user) => user.id === linkedTrainer.userId) : undefined
    const trainerOrg: ScopedRecord = {
      companyId: linkedTrainer?.companyId || trainerUser?.companyId || branchFor(linkedTrainer?.branchId || trainerUser?.branchId)?.companyId,
      branchId: linkedTrainer?.branchId || trainerUser?.branchId,
    }

    const classId = link?.classId || getString(record, 'classId')
    const linkedClass = classId ? classes.find((gymClass) => gymClass.id === classId) : undefined
    const classOrg = orgOf(linkedClass as unknown as Record<string, unknown> | undefined)

    const assetId = link?.assetId || getString(record, 'assetId')
    const linkedAsset = assetId ? assets.find((asset) => asset.id === assetId) : undefined
    const assetOrg = orgOf(linkedAsset as unknown as Record<string, unknown> | undefined)

    const lineItemIds = Array.isArray(record.lines)
      ? record.lines.map((line) => getString(asRecord(line) || {}, 'itemId')).filter((id): id is string => Boolean(id))
      : []
    const itemIds = [link?.itemId, getString(record, 'itemId'), ...lineItemIds]
      .filter((id): id is string => Boolean(id))
    const linkedItem = itemIds
      .map((id) => inventory.find((item) => item.id === id))
      .find((item): item is InventoryItem => Boolean(item))
    const itemOrg: ScopedRecord = {
      companyId: linkedItem?.companyId || branchFor(linkedItem?.branchId)?.companyId,
      branchId: linkedItem?.branchId,
    }

    const jobId = link?.jobId || getString(record, 'jobId')
    const linkedJob = jobId ? jobs.find((job) => job.id === jobId) : undefined
    const jobOrg = orgOf(linkedJob as unknown as Record<string, unknown> | undefined)

    const saleId = link?.saleId || getString(record, 'saleId')
    const linkedSale = saleId ? sales.find((sale) => sale.id === saleId) : undefined
    const saleOrg = orgOf(linkedSale as unknown as Record<string, unknown> | undefined)
    const salesOrderId = link?.salesOrderId || getString(record, 'salesOrderId')
    const linkedSalesOrder = salesOrderId ? salesOrders.find((order) => order.id === salesOrderId) : undefined
    const salesOrderOrg = orgOf(linkedSalesOrder as unknown as Record<string, unknown> | undefined)
    const invoiceId = link?.invoiceId || getString(record, 'invoiceId')
    const linkedInvoice = invoiceId ? invoices.find((invoice) => invoice.id === invoiceId) : undefined
    const invoiceOrg = orgOf(linkedInvoice as unknown as Record<string, unknown> | undefined)

    // Account-history rows carry the source id rather than a direct branch.
    const relId = getString(record, 'relId')
    const linkedSource = relId
      ? [
          ...receipts, ...paymentVouchers, ...journals,
          ...sales, ...purchases, ...purchaseOrders, ...purchaseReturns,
          ...proposals, ...estimates, ...salesOrders,
        ].find((source) => source.id === relId)
      : undefined
    const sourceOrg = orgOf(linkedSource as unknown as Record<string, unknown> | undefined)

    // Prefer the record's own branch, then the most specific relationship. A
    // member's branch takes precedence over a generic creator branch for sales
    // and invoices; item/class/asset relations handle records without members.
    if (memberOrg.companyId || memberOrg.branchId) candidates.push(memberOrg)
    if (supplierOrg.companyId || supplierOrg.branchId) candidates.push(supplierOrg)
    if (customerOrg.companyId || customerOrg.branchId) candidates.push(customerOrg)
    if (assetOrg.companyId || assetOrg.branchId) candidates.push(assetOrg)
    if (classOrg.companyId || classOrg.branchId) candidates.push(classOrg)
    if (itemOrg.companyId || itemOrg.branchId) candidates.push(itemOrg)
    if (saleOrg.companyId || saleOrg.branchId) candidates.push(saleOrg)
    if (salesOrderOrg.companyId || salesOrderOrg.branchId) candidates.push(salesOrderOrg)
    if (invoiceOrg.companyId || invoiceOrg.branchId) candidates.push(invoiceOrg)
    if (jobOrg.companyId || jobOrg.branchId) candidates.push(jobOrg)
    if (trainerOrg.companyId || trainerOrg.branchId) candidates.push(trainerOrg)
    if (userOrg.companyId || userOrg.branchId) candidates.push(userOrg)
    if (sourceOrg.companyId || sourceOrg.branchId) candidates.push(sourceOrg)

    // Legacy seed records sometimes only contain a human-readable location.
    const details = asRecord(record.details)
    const textBranch = branchFromText([
      getString(record, 'location'),
      getString(record, 'address'),
      getString(record, 'from'),
      getString(record, 'to'),
      getString(record, 'notes'),
      getString(record, 'description'),
      getString(record, 'customerName'),
      getString(record, 'receivedFrom'),
      getString(record, 'paidTo'),
      getString(record, 'vendor'),
      getString(record, 'customer'),
      getString(record, 'stakeholder'),
      details?.businessLocation,
      details?.shippingDetails,
    ])
    if (textBranch) candidates.push({ companyId: textBranch.companyId, branchId: textBranch.id })

    const branchCandidate = candidates.find((candidate) => candidate.branchId)
    const companyCandidate = candidates.find((candidate) => candidate.companyId)
    return {
      companyId: direct.companyId || companyCandidate?.companyId,
      branchId: direct.branchId || branchCandidate?.branchId,
    }
  }, [assets, branches, classes, customers, estimates, inventory, invoices, jobs, journals, members, paymentVouchers, proposals, purchaseOrders, purchases, purchaseReturns, receipts, sales, salesOrders, staff, suppliers, trainers, users])

  const branchSelectionEnabled = branchContextEnabled
  const selectedCompanyScopeId = branchContextEnabled && sessionUser ? effectiveActiveCompanyId : ''
  const selectedBranchScopeId = branchSelectionEnabled ? effectiveActiveBranchId : ''

  const scopeCompanyRecords = useCallback(function scopeCompanyRecords<T extends object>(records: T[]): T[] {
    if (!sessionUser) return records
    return records.filter((record) => {
      const org = resolveOrg(record as ScopedRecord & Record<string, unknown>)
      const companyId = org.companyId || DEFAULT_COMPANY.id
      if (roleIsTenantScoped && !canAccessCompany(sessionUser, companyId, branches)) return false
      if (!roleIsTenantScoped && selectedCompanyScopeId && companyId !== selectedCompanyScopeId) return false
      if (selectedBranchScopeId && org.branchId && org.branchId !== selectedBranchScopeId) return false
      return true
    })
  }, [branches, resolveOrg, roleIsTenantScoped, selectedBranchScopeId, selectedCompanyScopeId, sessionUser])

  const scopeOrgRecords = useCallback(function scopeOrgRecords<T extends object>(
    records: T[],
    link?: (record: T) => ScopeLink,
    respectActiveBranch = true,
  ): T[] {
    if (!sessionUser || (!roleIsTenantScoped && !selectedBranchScopeId)) return records
    return records.filter((record) => {
      const linked = link ? link(record) : undefined
      const org = resolveOrg(record as ScopedRecord & Record<string, unknown>, linked)
      if (roleIsTenantScoped && !canAccessOrgRecord(sessionUser, org, branches)) return false
      if (respectActiveBranch && selectedBranchScopeId && org.branchId && org.branchId !== selectedBranchScopeId) {
        // Records available at multiple branches (e.g. inventory branchIds)
        // stay visible at any of their branches.
        const extraBranches = (record as { branchIds?: unknown }).branchIds
        const multiBranch = Array.isArray(extraBranches) && extraBranches.includes(selectedBranchScopeId)
        if (!multiBranch) return false
      }
      return true
    })
  }, [branches, resolveOrg, roleIsTenantScoped, selectedBranchScopeId, sessionUser])

  const scopeStockTransfers = useCallback((records: StockTransfer[]): StockTransfer[] => {
    if (!sessionUser) return records
    return records.filter((transfer) => {
      const companyId = transfer.companyId || branches.find((branch) => branch.id === transfer.fromBranchId || branch.id === transfer.toBranchId)?.companyId || DEFAULT_COMPANY.id
      if (roleIsTenantScoped && !canAccessCompany(sessionUser, companyId, branches)) return false
      if (!roleIsTenantScoped && selectedCompanyScopeId && companyId !== selectedCompanyScopeId) return false
      if (!selectedBranchScopeId) return true
      return transfer.fromBranchId === selectedBranchScopeId || transfer.toBranchId === selectedBranchScopeId
    })
  }, [branches, roleIsTenantScoped, selectedBranchScopeId, selectedCompanyScopeId, sessionUser])

  useEffect(() => {
    if (!sessionUser) return
    const companyId = roleIsTenantScoped
      ? userCompanyId(sessionUser, branches)
      : fixedBranchUser
        ? assignedBranchCompanyId || activeCompanyId
        : activeCompanyId
    if (roleIsTenantScoped && activeCompanyId !== companyId) setActiveCompany(companyId)
    const allowedBranches = sessionUser.role === 'branch_admin' || fixedBranchUser
      ? branches.filter((branch) => branch.id === (sessionUser.role === 'branch_admin' ? sessionUser.branchId : assignedBranchId))
      : branches.filter((branch) => (branch.companyId || DEFAULT_COMPANY.id) === companyId)
    // Changing the company always moves the active branch into that company.
    // This keeps branch-scoped lists synchronized with the two selectors.
    if (!allowedBranches.some((branch) => branch.id === activeBranchId)) {
      setActiveBranch(allowedBranches[0]?.id || '')
    }
  }, [activeBranchId, activeCompanyId, assignedBranchCompanyId, assignedBranchId, branches, fixedBranchUser, roleIsTenantScoped, sessionUser, setActiveBranch, setActiveCompany])

  const resolvedTrainerRecords = useMemo(() => trainers.map((trainer) => {
    const linkedUser = users.find((user) => user.id === trainer.userId)
    const branchId = trainer.branchId || linkedUser?.branchId
    return {
      ...trainer,
      companyId: trainer.companyId || linkedUser?.companyId || branches.find((branch) => branch.id === branchId)?.companyId,
      branchId,
    }
  }), [branches, trainers, users])
  const resolvedStaffRecords = useMemo(() => staff.map((record) => {
    const linkedUser = users.find((user) => user.id === record.userId)
    const branchId = record.branchId || linkedUser?.branchId
    return {
      ...record,
      companyId: record.companyId || linkedUser?.companyId || branches.find((branch) => branch.id === branchId)?.companyId,
      branchId,
    }
  }), [branches, staff, users])

  const value = useMemo<AppStore>(
    () => ({
      users: scopeOrgRecords(users),
      members: scopeOrgRecords(members),
      trainers: scopeOrgRecords(resolvedTrainerRecords),
      staff: scopeOrgRecords(resolvedStaffRecords),
      plans: scopeCompanyRecords(plans),
      memberships: scopeOrgRecords(memberships),
      payments: scopeOrgRecords(payments),
      invoices: scopeOrgRecords(invoices),
      classes: scopeOrgRecords(classes),
      bookings: scopeOrgRecords(bookings),
      attendance: scopeOrgRecords(attendance),
      workouts: scopeOrgRecords(workouts),
      progress: scopeOrgRecords(progress),
      notifications: scopeOrgRecords(notifications),
      // Keep the full permitted branch directory available so the header,
      // organization pages, and branch settings can switch within the user's
      // boundary. Branch records are themselves branch directories, so they
      // cannot be resolved through a record.branchId field.
      branches: !sessionUser ? branches : branches.filter((branch) => {
        if (sessionUser.role === 'branch_admin' || fixedBranchUser) {
          return branch.id === (sessionUser.role === 'branch_admin' ? sessionUser.branchId : assignedBranchId)
        }
        if (sessionUser.role === 'company_admin' || sessionUser.role === 'head_office') {
          return (branch.companyId || DEFAULT_COMPANY.id) === userCompanyId(sessionUser, branches)
        }
        return true
      }),
      leads: scopeOrgRecords(leads),
      messages: scopeOrgRecords(messages, (message) => ({ userId: message.fromId })),
      audit: scopeOrgRecords(audit),
      leaves: scopeOrgRecords(leaves),
      sessions: scopeOrgRecords(sessions),
      company,
      companies: fixedBranchUser && sessionUser
        ? companies.filter((candidate) => candidate.id === effectiveActiveCompanyId)
        : roleIsTenantScoped && sessionUser
          ? companies.filter((candidate) => canAccessCompany(sessionUser, candidate.id, branches))
          : companies,
      activeCompanyId: effectiveActiveCompanyId,
      activeBranchId: effectiveActiveBranchId,
      activeCompany, activeBranch, productMode,
      // Branch settings has its own permitted-branch selector, so retain all
      // accessible settings records while ordinary operational data follows
      // the active branch.
      branchSettings: scopeOrgRecords(branchSettings, undefined, false), upsertBranchSettings, resetBranchSettings,
      customFields, upsertCustomField, deleteCustomField,
      cms, setCms,
      upsertCompany, deleteCompany, setCompanyStatus, setActiveCompany, setActiveBranch, setProductMode,
      inventory: scopeOrgRecords(inventory),
      inventoryUnscoped: inventory,
      suppliers: scopeOrgRecords(suppliers),
      stockMovements: scopeOrgRecords(stockMovements),
      stockTransfers: scopeStockTransfers(stockTransfers),
      stockAdjustments: scopeOrgRecords(stockAdjustments),
      stockCounts: scopeOrgRecords(stockCounts),
      stockAlerts: scopeOrgRecords(stockAlerts),
      inventoryCategories,
      purchases: scopeOrgRecords(purchases),
      sales: scopeOrgRecords(sales),
      purchaseOrders: scopeOrgRecords(purchaseOrders),
      purchaseReturns: scopeOrgRecords(purchaseReturns),
      shipments: scopeOrgRecords(shipments),
      discounts: scopeCompanyRecords(discounts),
      salesReturns: scopeOrgRecords(salesReturns),
      departments: scopeOrgRecords(departments),
      payslips: scopeOrgRecords(payslips),
      jobs: scopeOrgRecords(jobs),
      candidates: scopeOrgRecords(candidates),
      reviews: scopeOrgRecords(reviews),
      staffAttendance: scopeOrgRecords(staffAttendance),
      assets: scopeOrgRecords(assets),
      depreciation: scopeOrgRecords(depreciation),
      assetTransactions: scopeOrgRecords(assetTransactions),
      assetCategories, assetConditions, depreciationPolicy,
      customers: scopeOrgRecords(customers),
      supplierCategories, customerCategories, modules, sidebarOrder,
      accounts: scopeCompanyRecords(accounts),
      accountingSettings,
      receipts: scopeOrgRecords(receipts, (receipt) => ({ userId: receipt.createdBy })),
      paymentVouchers: scopeOrgRecords(paymentVouchers, (voucher) => ({ userId: voucher.createdBy })),
      journals: scopeOrgRecords(journals, (journal) => ({ userId: journal.createdBy })),
      banks: scopeCompanyRecords(banks),
      signatories: scopeCompanyRecords(signatories),
      voucherSerials: scopeCompanyRecords(voucherSerials),
      funds: scopeCompanyRecords(funds),
      paymentModes: scopeCompanyRecords(paymentModes),
      detailTypes: scopeCompanyRecords(detailTypes),
      incomeMods: scopeCompanyRecords(incomeMods),
      currencyRates: scopeCompanyRecords(currencyRates),
      reconciliations: scopeCompanyRecords(reconciliations),
      budgets: scopeCompanyRecords(budgets),
      valueBook: scopeCompanyRecords(valueBook),
      cheques: scopeCompanyRecords(cheques),
      accountHistory: scopeOrgRecords(accountHistory, (history) => ({ userId: history.addedFrom })),
      proposals: scopeOrgRecords(proposals),
      estimates: scopeOrgRecords(estimates),
      salesOrders: scopeOrgRecords(salesOrders),
      upsertInventoryItem, deleteInventoryItem, adjustStock, updatePurchase, purchasePayments, addPurchasePayment, updatePurchasePayment, deletePurchasePayment,
      upsertStockTransfer, deleteStockTransfer, upsertStockAdjustment, deleteStockAdjustment, upsertStockCount, deleteStockCount, upsertStockAlert, deleteStockAlert,
      upsertSupplier, deleteSupplier,
      addInventoryCategory, renameInventoryCategory, deleteInventoryCategory,
      recordPurchase, recordSale, updateSale, updatePurchaseStatus, refundSale, deletePurchase, deleteSale,
      setCompany,
      roles: visibleDefinitionRoles, permissions: visibleDefinitionPermissions,
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
      upsertUser,
      deleteUser: (id) => {
        setUsers((s) => s.filter((u) => u.id !== id))
        const member = members.find((m) => m.userId === id)
        if (member) setMembers((s) => s.filter((m) => m.id !== member.id))
        setStaff((s) => s.filter((st) => st.userId !== id))
        setTrainers((s) => s.filter((t) => t.userId !== id))
      },
      upsertMember: (m) => { const scoped = stampSelectedOrg(m); setMembers((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      deleteMember: (id) => {
        setMembers((s) => s.filter((m) => m.id !== id))
                const u = members.find((m) => m.id === id)
        if (u) setUsers((s) => s.map((x) => (x.id === u.userId ? { ...x, status: 'inactive' } : x)))
      },
      upsertStaff: (st) => { const scoped = stampSelectedOrg(st); setStaff((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      upsertTrainer: (t) => { const scoped = stampSelectedOrg(t); setTrainers((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      deleteTrainer: (id) => setTrainers((s) => s.filter((t) => t.id !== id)),
      upsertPlan: (p) => setPlans((s) => (s.some((x) => x.id === p.id) ? s.map((x) => (x.id === p.id ? p : x)) : [...s, p])),
      deletePlan: (id) => setPlans((s) => s.filter((p) => p.id !== id)),
      upsertClass: (c) => { const scoped = stampSelectedOrg(c); setClasses((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      deleteClass: (id) => setClasses((s) => s.filter((c) => c.id !== id)),
      upsertLead: (l) => { const scoped = stampSelectedOrg(l); setLeads((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      deleteLead: (id) => setLeads((s) => s.filter((l) => l.id !== id)),
      upsertPayment: (p) => { const scoped = stampSelectedOrg(p); setPayments((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      upsertInvoice: (i) => { const scoped = stampSelectedOrg(i); setInvoices((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      deleteInvoice: (id) => setInvoices((s) => s.filter((i) => i.id !== id)),
      upsertProposal: (p) => { const scoped = stampSelectedOrg(p); setProposalsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveProposals(n); return n }) },
      deleteProposal: (id) => setProposalsState((s) => { const n = s.filter((p) => p.id !== id); saveProposals(n); return n }),
      upsertEstimate: (e) => { const scoped = stampSelectedOrg(e); setEstimatesState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveEstimates(n); return n }) },
      deleteEstimate: (id) => setEstimatesState((s) => { const n = s.filter((e) => e.id !== id); saveEstimates(n); return n }),
      upsertSalesOrder: (o) => { const scoped = stampSelectedOrg(o); setSalesOrdersState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveSalesOrders(n); return n }) },
      deleteSalesOrder: (id) => setSalesOrdersState((s) => { const n = s.filter((o) => o.id !== id); saveSalesOrders(n); return n }),
      upsertPurchaseOrder: (o) => { const scoped = stampSelectedOrg(o); setPurchaseOrdersState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; savePurchaseOrders(n); return n }) },
      deletePurchaseOrder: (id) => setPurchaseOrdersState((s) => { const n = s.filter((o) => o.id !== id); savePurchaseOrders(n); return n }),
      upsertPurchaseReturn: (r) => { const scoped = stampSelectedOrg(r); setPurchaseReturnsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; savePurchaseReturns(n); return n }) },
      deletePurchaseReturn: (id) => setPurchaseReturnsState((s) => { const n = s.filter((r) => r.id !== id); savePurchaseReturns(n); return n }),
      upsertShipment: (sh) => { const scoped = stampSelectedOrg(sh); setShipmentsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveShipments(n); return n }) },
      deleteShipment: (id) => setShipmentsState((s) => { const n = s.filter((sh) => sh.id !== id); saveShipments(n); return n }),
      upsertDiscount: (d) => { const scoped = stampSelectedOrg(d); setDiscountsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveDiscounts(n); return n }) },
      deleteDiscount: (id) => setDiscountsState((s) => { const n = s.filter((d) => d.id !== id); saveDiscounts(n); return n }),
      upsertSalesReturn: (r) => { const scoped = stampSelectedOrg(r); setSalesReturnsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveSalesReturns(n); return n }) },
      deleteSalesReturn: (id) => setSalesReturnsState((s) => { const n = s.filter((r) => r.id !== id); saveSalesReturns(n); return n }),
      upsertDepartment: (d) => { const scoped = stampSelectedOrg(d); setDepartmentsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveDepartments(n); return n }) },
      deleteDepartment: (id) => setDepartmentsState((s) => { const n = s.filter((d) => d.id !== id); saveDepartments(n); return n }),
      upsertPayslip: (p) => { const scoped = stampSelectedOrg(p); setPayslipsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; savePayslips(n); return n }) },
      deletePayslip: (id) => setPayslipsState((s) => { const n = s.filter((p) => p.id !== id); savePayslips(n); return n }),
      upsertJob: (j) => { const scoped = stampSelectedOrg(j); setJobsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveJobs(n); return n }) },
      deleteJob: (id) => setJobsState((s) => { const n = s.filter((j) => j.id !== id); saveJobs(n); return n }),
      upsertCandidate: (c) => { const scoped = stampSelectedOrg(c); setCandidatesState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveCandidates(n); return n }) },
      deleteCandidate: (id) => setCandidatesState((s) => { const n = s.filter((c) => c.id !== id); saveCandidates(n); return n }),
      upsertReview: (r) => { const scoped = stampSelectedOrg(r); setReviewsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveReviews(n); return n }) },
      deleteReview: (id) => setReviewsState((s) => { const n = s.filter((r) => r.id !== id); saveReviews(n); return n }),
      upsertStaffAttendance: (a) => { const scoped = stampSelectedOrg(a); setStaffAttendanceState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveStaffAttendance(n); return n }) },
      deleteStaffAttendance: (id) => setStaffAttendanceState((s) => { const n = s.filter((a) => a.id !== id); saveStaffAttendance(n); return n }),
      upsertAsset: (a) => { const scoped = stampSelectedOrg(a); setAssetsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveAssets(n); return n }) },
      deleteAsset: (id) => setAssetsState((s) => { const n = s.filter((a) => a.id !== id); saveAssets(n); return n }),
      upsertDepreciation: (d) => { const scoped = stampSelectedOrg(d); setDepreciationState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveDepreciation(n); return n }) },
      deleteDepreciation: (id) => setDepreciationState((s) => { const n = s.filter((d) => d.id !== id); saveDepreciation(n); return n }),
      upsertAssetTransaction: (t) => { const scoped = stampSelectedOrg(t); setAssetTransactionsState((s) => { const n = s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped]; saveAssetTransactions(n); return n }) },
      deleteAssetTransaction: (id) => setAssetTransactionsState((s) => { const n = s.filter((t) => t.id !== id); saveAssetTransactions(n); return n }),
      addAssetCategory, renameAssetCategory, deleteAssetCategory,
      addAssetCondition, renameAssetCondition, deleteAssetCondition,
      setDepreciationPolicy,
      upsertCustomer, deleteCustomer,
      stakeholderClasses, stakeholderEntities: scopeOrgRecords(stakeholderEntities), upsertStakeholderClass, deleteStakeholderClass, upsertStakeholderEntity, deleteStakeholderEntity,
      systemSettings, setSystemSettings,
      addSupplierCategory, renameSupplierCategory, deleteSupplierCategory,
      addCustomerCategory, renameCustomerCategory, deleteCustomerCategory,
      setModuleEnabled, setSidebarOrder,
      upsertAccount, deleteAccount, setAccountingSettings,
      upsertReceipt, deleteReceipt, upsertPaymentVoucher, deletePaymentVoucher, upsertJournal, deleteJournal,
      upsertBank, deleteBank, upsertSignatory, deleteSignatory, upsertVoucherSerial, deleteVoucherSerial, upsertFund, deleteFund, upsertPaymentMode, deletePaymentMode, upsertDetailType, deleteDetailType, upsertIncomeMod, deleteIncomeMod, setIncomeMods, upsertCurrencyRate, deleteCurrencyRate, clearCurrencyRates, upsertReconciliation, deleteReconciliation, upsertBudget, deleteBudget,
      upsertValueBookEntry, deleteValueBookEntry, upsertCheque, deleteCheque,
      upsertMembership: (m) => { const scoped = stampSelectedOrg(m); setMemberships((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      bookClass: (classId, memberId, date) => {
        const cl = classes.find((c) => c.id === classId)
        if (!cl) return { ok: false, status: 'cancelled', message: 'Class not found' }
        const exists = bookings.find((b) => b.classId === classId && b.memberId === memberId && b.date === date && b.status !== 'cancelled')
        if (exists) return { ok: false, status: exists.status, message: 'Already booked' }
        const full = cl.enrolled >= cl.capacity
        const status: Booking['status'] = full ? 'waitlist' : 'booked'
        setBookings((s) => [...s, stampSelectedOrg({ id: uid('bk'), classId, memberId, date, status })])
        setClasses((s) => s.map((c) => (c.id === classId ? { ...c, enrolled: full ? c.enrolled : c.enrolled + 1, waitlist: full ? c.waitlist + 1 : c.waitlist } : c)))
        return { ok: true, status, message: full ? 'Added to waitlist' : 'Booked' }
      },
      cancelBooking: (id) => {
        const bk = bookings.find((b) => b.id === id)
        setBookings((s) => {
          const target = s.find((b) => b.id === id)
          if (!target) return s
          const next = s.map((b) => (b.id === id ? { ...b, status: 'cancelled' as const } : b))
          if (target.status !== 'booked') return next
          // A seat just freed up: promote the earliest person still waitlisted
          // for the same class & session date (first-come, first-served).
          const promotee = next.find((b) => b.classId === target.classId && b.date === target.date && b.status === 'waitlist')
          if (!promotee) return next
          return next.map((b) => (b.id === promotee.id ? { ...b, status: 'booked' as const } : b))
        })
        if (bk && bk.status === 'booked') {
          const promoted =
            bookings.find((b) => b.classId === bk.classId && b.date === bk.date && b.status === 'waitlist')
          if (promoted) {
            // The freed seat is immediately refilled: enrolled stays, waitlist shrinks.
            setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, enrolled: Math.max(1, c.enrolled), waitlist: Math.max(0, c.waitlist - 1) } : c)))
            const member = members.find((m) => m.id === promoted.memberId)
            const promotedUser = users.find((u) => u.id === member?.userId)
            const cl = classes.find((c) => c.id === bk.classId)
            if (promotedUser) {
              setNotifications((s) => [
                stampSelectedOrg({
                  id: uid('nt'),
                  userId: promotedUser.id,
                  title: 'Spot confirmed',
                  message: `A spot opened in ${cl?.name || 'your class'} — you've been promoted off the waitlist for ${promoted.date}.`,
                  channel: 'in-app',
                  read: false,
                  createdAt: new Date().toISOString(),
                }),
                ...s,
              ])
            }
          } else {
            setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, enrolled: Math.max(0, c.enrolled - 1) } : c)))
          }
        }
        if (bk && bk.status === 'waitlist') {
          setClasses((s) => s.map((c) => (c.id === bk.classId ? { ...c, waitlist: Math.max(0, c.waitlist - 1) } : c)))
        }
      },
      checkIn: (memberId, branchId) => {
        const rec: Attendance = stampSelectedOrg({
          id: uid('at'),
          memberId,
          type: 'checkin',
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          branchId: branchId || effectiveActiveBranchId || 'br_airport',
        })
        setAttendance((s) => [rec, ...s])
        return rec
      },
      addProgress: (p) => setProgress((s) => [...s, stampSelectedOrg(p)]),
      upsertWorkout: (w) => { const scoped = stampSelectedOrg(w); setWorkouts((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      sendMessage: (m) => setMessages((s) => [...s, stampSelectedOrg({ ...m, id: uid('msg'), createdAt: new Date().toISOString(), read: false })]),
      markMessagesRead: (ids) => setMessages((s) => s.map((m) => (ids.includes(m.id) ? { ...m, read: true } : m))),
      notify: (n) => setNotifications((s) => [stampSelectedOrg({ ...n, id: uid('nt'), createdAt: new Date().toISOString(), read: false }), ...s]),
      markNotifRead: (id) => setNotifications((s) => s.map((n) => (n.id === id ? { ...n, read: true } : n))),
      markAllNotifRead: (userId) => setNotifications((s) => s.map((n) => (n.userId === userId ? { ...n, read: true } : n))),
      log,
      upsertLeave: (l) => { const scoped = stampSelectedOrg(l); setLeaves((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      upsertSession: (s0) => { const scoped = stampSelectedOrg(s0); setSessions((s) => (s.some((x) => x.id === scoped.id) ? s.map((x) => (x.id === scoped.id ? scoped : x)) : [...s, scoped])) },
      createMemberAccount,
      takeAttendance: (classId, memberId, present) => {
        setBookings((s) => s.map((b) => (b.classId === classId && b.memberId === memberId ? { ...b, status: present ? 'attended' : 'no-show' } : b)))
        if (present) {
          const cl = classes.find((c) => c.id === classId)
          setAttendance((s) => [
            stampSelectedOrg({
              id: uid('at'),
              memberId,
              type: 'class',
              date: new Date().toISOString().slice(0, 10),
              time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
              branchId: cl?.branchId || effectiveActiveBranchId || 'br_airport',
              classId,
            }),
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
          stampSelectedOrg({
            id: invoiceId,
            memberId,
            number,
            items: [{ desc, amount: plan.price }],
            total: plan.price,
            status: 'unpaid',
            issuedAt: today.toISOString().slice(0, 10),
            dueAt: due.toISOString().slice(0, 10),
          }),
          ...s,
        ])
        setPayments((s) => [
          stampSelectedOrg({
            id: paymentId,
            memberId,
            amount: plan.price,
            method: defaultPaymentMethod(paymentSettings),
            status: 'pending',
            invoiceId,
            date: today.toISOString().slice(0, 10),
            description: desc,
            planId: plan.id,
          }),
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

        const invoice: Invoice = stampSelectedOrg({
          id: invoiceId,
          memberId: input.memberId,
          number,
          items: [{ desc, amount }],
          total: amount,
          status: 'unpaid',
          issuedAt: today.toISOString().slice(0, 10),
          dueAt: due.toISOString().slice(0, 10),
        })
        const payment: Payment = stampSelectedOrg({
          id: paymentId,
          memberId: input.memberId,
          amount,
          method,
          status: 'pending',
          invoiceId,
          date: today.toISOString().slice(0, 10),
          description: desc,
        })
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
            const created = stampSelectedOrg({
              id: paymentId,
              memberId: input.memberId,
              amount: input.amount,
              method: input.method,
              status: (input.autoSettle ? 'paid' : 'pending') as Payment['status'],
              invoiceId,
              date: new Date().toISOString().slice(0, 10),
              description: input.description || 'Paystack payment',
              reference: input.reference,
              gatewayRef: input.gatewayRef,
              gatewayChannel: input.gatewayChannel,
            }) as Payment
            target = created
            return [created, ...s]
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
            return [stampSelectedOrg({
              id: target!.invoiceId,
              memberId: input.memberId,
              number: `FP-${new Date().getFullYear()}-PS${String(s.length + 1).padStart(3, '0')}`,
              items: [{ desc: target!.description, amount: target!.amount }],
              total: target!.amount,
              status: 'paid',
              issuedAt: today,
              dueAt: today,
            }), ...s]
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
      scopeCompanyRecords, scopeOrgRecords, stampSelectedOrg, roleIsTenantScoped, fixedBranchUser, assignedBranchId, assignedBranchCompanyId, effectiveActiveCompanyId, effectiveActiveBranchId, sessionUser,
      users, members, trainers, staff, resolvedTrainerRecords, resolvedStaffRecords, plans, memberships, payments, invoices, classes, bookings,
      attendance, workouts, progress, notifications, branches, leads, messages, audit, leaves, sessions, company,
      companies, activeCompanyId, activeBranchId, activeCompany, activeBranch, productMode,
      branchSettings, upsertBranchSettings, resetBranchSettings,
      customFields, upsertCustomField, deleteCustomField,
      cms, setCms,
      upsertCompany, deleteCompany, setCompanyStatus, setActiveCompany, setActiveBranch, setProductMode,
      inventory, suppliers, stockMovements, stockTransfers, stockAdjustments, stockCounts, stockAlerts, inventoryCategories, purchases, sales, purchaseOrders, purchaseReturns, shipments, discounts, salesReturns, departments, payslips, jobs, candidates, reviews, staffAttendance, assets, depreciation, assetTransactions, assetCategories, assetConditions, depreciationPolicy, customers, supplierCategories, customerCategories, modules, sidebarOrder, accounts, accountingSettings, receipts, paymentVouchers, journals, banks, signatories, voucherSerials, funds, paymentModes, detailTypes, incomeMods, currencyRates, reconciliations, budgets, valueBook, cheques, proposals, estimates, salesOrders,
      scopeStockTransfers, upsertInventoryItem, deleteInventoryItem, adjustStock, updatePurchase, purchasePayments, addPurchasePayment, updatePurchasePayment, deletePurchasePayment, upsertStockTransfer, deleteStockTransfer, upsertStockAdjustment, deleteStockAdjustment, upsertStockCount, deleteStockCount, upsertStockAlert, deleteStockAlert, upsertSupplier, deleteSupplier,
      addInventoryCategory, renameInventoryCategory, deleteInventoryCategory,
      addAssetCategory, renameAssetCategory, deleteAssetCategory, addAssetCondition, renameAssetCondition, deleteAssetCondition, setDepreciationPolicy, upsertCustomer, deleteCustomer,
      stakeholderClasses, stakeholderEntities, upsertStakeholderClass, deleteStakeholderClass, upsertStakeholderEntity, deleteStakeholderEntity,
      systemSettings, setSystemSettings, accountHistory,
      addSupplierCategory, renameSupplierCategory, deleteSupplierCategory, addCustomerCategory, renameCustomerCategory, deleteCustomerCategory, setModuleEnabled, setSidebarOrder,
      upsertAccount, deleteAccount, setAccountingSettings, upsertReceipt, deleteReceipt, upsertPaymentVoucher, deletePaymentVoucher, upsertJournal, deleteJournal,
      upsertBank, deleteBank, upsertSignatory, deleteSignatory, upsertVoucherSerial, deleteVoucherSerial, upsertFund, deleteFund, upsertPaymentMode, deletePaymentMode, upsertDetailType, deleteDetailType, upsertIncomeMod, deleteIncomeMod, setIncomeMods, upsertCurrencyRate, deleteCurrencyRate, clearCurrencyRates, upsertReconciliation, deleteReconciliation, upsertBudget, deleteBudget, upsertValueBookEntry, deleteValueBookEntry, upsertCheque, deleteCheque,
      recordPurchase, recordSale, updatePurchaseStatus, refundSale, deletePurchase, deleteSale,
      roles, permissions, visibleDefinitionRoles, visibleDefinitionPermissions, upsertRole, deleteRole, setRolePermissions, upsertPermission, deletePermission, resetData,
      credentialEvents, credentialSettings, setCredentialSettings, paymentSettings, setPaymentSettings,
      regenerateMemberCredentials, recordCredentialDelivery, appendCredentialEvent, patchUser, upsertUser, log, createMemberAccount,
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
