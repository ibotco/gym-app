import {
  ATTENDANCE, AUDIT, BOOKINGS, BRANCHES, CLASSES, COMPANY, COST_CENTERS,
  INVOICES, INVOICE_TEMPLATES, LEADS, LEAVES, MEMBERS, MEMBERSHIPS, MESSAGES,
  NOTIFICATIONS, PAYMENTS, PLANS, PROGRESS, SESSIONS, STAFF, TRAINERS, USERS, WORKOUTS,
} from '../data/seed'
import { loadCompanies, DEFAULT_COMPANY } from './companies'
import { loadBranchSettings } from './branchSettings'
import { loadCustomFields } from './customFields'
import { loadCms } from './cms'
import { loadRoles, loadPermissions } from './permissions'
import { loadCredentialSettings } from './credentials'
import { loadPaymentSettings } from './payments'
import { loadIntegrations, loadIntegrationLogs } from './integrations'
import { loadModules, loadSubModules, loadSidebarOrder, loadSubMenuOrder } from './modules'
import { loadSystemSettings } from './systemSettings'
import {
  loadInventory, loadSuppliers, loadStockMovements, loadCategories,
  loadPurchases, loadSales, loadPurchaseOrders, loadPurchaseReturns,
  loadStockTransfers, loadStockAdjustments, loadStockCounts, loadStockAlerts,
  loadPurchasePayments,
} from './inventory'
import {
  loadRequisitions, loadProcPurchaseOrders, loadGoodsReceipts,
  loadSupplierInvoices, loadSupplierPayments, loadProcReturns,
} from './procurement'
import { loadProposals, loadEstimates, loadSalesOrders } from './quotes'
import { loadShipments } from './shipments'
import { loadDiscounts } from './discounts'
import { loadCoupons, loadCouponAssignments } from './coupons'
import { loadSalesReturns } from './salesReturns'
import { loadCustomers } from './customers'
import { loadSupplierCategories, loadCustomerCategories } from './peopleCategories'
import {
  loadDepartments, loadPayslips, loadJobs, loadCandidates, loadReviews, loadStaffAttendance,
} from './hrm'
import { loadLeaveTypes } from './leaveTypes'
import { loadWorkShifts } from './workShifts'
import {
  loadSalaryBenefits, loadSalaryStructures, loadSalaryAssignments, loadPayrollAdj,
} from './payroll'
import { loadLoans, loadLoanInstallments, loadLoanPolicy } from './loans'
import { loadSalaryAdvances } from './advanceSalary'
import { loadProjects } from './projects'
import { loadContracts } from './contracts'
import { loadTasks } from './tasks'
import { loadWorkStages, loadTaskTemplates } from './taskTemplates'
import { loadTimesheets } from './timesheets'
import { loadProjectInvoices } from './projectInvoices'
import { loadProjectTypes, loadContractTypes } from './projectTypes'
import { loadProjectStatuses, loadProjectPriorities, loadProjectCategories } from './projectSettings'
import { loadMilestones } from './milestones'
import { loadAssets } from './assets'
import { loadDepreciation } from './depreciation'
import { loadAssetTransactions } from './assetTransactions'
import { loadAssetLocations } from './assetLocations'
import {
  loadAssetCategories, loadAssetConditions, loadDepreciationPolicy, loadDepreciationPolicies,
} from './assetSettings'
import {
  loadAccounts, loadAccountingSettings, loadReceipts, loadPayments, loadJournals,
  loadJournalTemplates, loadReconciliations, loadBudgets, loadValueBook, loadCheques,
  loadSignatories, loadSerials, loadFunds, loadPaymentModes, loadDetailTypes,
  loadIncomeMods, loadCurrencyRates, loadAccountHistory,
} from './accounting'
import { loadStakeholderClasses, loadStakeholderEntities } from './stakeholders'
import { loadApprovalDocTypes, loadApprovalData, approvalStorageKey } from './approvals'
import { loadSubPlans, loadSubscriptions, loadActivationCodes, loadLicensePayments, loadLicenseLogs } from './license'
import { loadPackages, loadOrgSubs, loadSubInvoices, loadSubHistory, loadPackageAudit } from './packages'
import { loadTrainingPrograms } from './trainingPrograms'
import { loadMessageTemplates } from './messageTemplates'
import { loadEduRecords, EDU_RECORDS_KEY } from './eduRecords'
import { ensureCompleteEduBranchSeed } from './eduCompleteSeed'
import { loadCardStore, CARDS_KEY } from './cardStore'
import { loadChurchRecords, CHURCH_RECORDS_KEY } from './churchRecords'
import { loadMediaSettings } from './mediaSettings'
import { isCollectionMarkedCleared } from './dataReset'

/**
 * Populates localStorage with default seed datasets across all 21 modules on a
 * brand-new database so every MySQL module table starts cleanly initialized.
 */
export function collectInitialSeedStores(
  setRaw: (key: string, val: string) => void = (k, v) => localStorage.setItem(k, v),
): Record<string, string> {
  const put = (key: string, value: unknown) => {
    const encoded = typeof value === 'string' ? value : JSON.stringify(value)
    setRaw(key, encoded)
  }

  // Organizations & Subscriptions
  const companies = loadCompanies()
  put('fitpro_companies', companies)
  put('fitpro_company', COMPANY)
  put('fitpro_branches', BRANCHES)
  put('fitpro_branch_settings', loadBranchSettings())
  put('fitpro_cost_centers', COST_CENTERS)
  put('fitpro_active_company', DEFAULT_COMPANY.id)
  put('fitpro_active_branch', BRANCHES[0]?.id || 'br_airport')
  put('fitpro_product_mode', 'fitpro')
  put('fitpro_sub_plans_v1', loadSubPlans())
  put('fitpro_subscriptions_v1', loadSubscriptions(DEFAULT_COMPANY.id))
  put('fitpro_activation_codes_v1', loadActivationCodes())
  put('fitpro_license_payments_v1', loadLicensePayments())
  put('fitpro_license_logs_v1', loadLicenseLogs())
  put('fitpro_sub_packages_v2', loadPackages())
  put('fitpro_org_subscriptions_v1', loadOrgSubs(DEFAULT_COMPANY.id))
  put('fitpro_sub_invoices_v1', loadSubInvoices())
  put('fitpro_sub_history_v1', loadSubHistory())
  put('fitpro_package_audit_v1', loadPackageAudit())

  // Users & RBAC
  put('fitpro_users', USERS)
  put('fitpro_roles', loadRoles())
  put('fitpro_permissions', loadPermissions())
  put('fitpro_cred', loadCredentialSettings())
  put('fitpro_cred_events', [])
  put('fitpro_audit_logs', AUDIT)

  // People & Gym Management
  put('fitpro_leads', LEADS)
  put('fitpro_customers', loadCustomers())
  put('fitpro_suppliers', loadSuppliers())
  put('fitpro_supplier_categories', loadSupplierCategories())
  put('fitpro_customer_categories', loadCustomerCategories())
  put('fitpro_members', MEMBERS)
  put('fitpro_trainers', TRAINERS)
  put('fitpro_plans', PLANS)
  put('fitpro_memberships', MEMBERSHIPS)
  put('fitpro_classes', CLASSES)
  put('fitpro_bookings', BOOKINGS)
  put('fitpro_session_bookings', SESSIONS)
  put('fitpro_attendance', ATTENDANCE)
  put('fitpro_workouts', WORKOUTS)
  put('fitpro_progress', PROGRESS)
  put('fitpro_training_programs_v1', loadTrainingPrograms())
  put('fitpro_payments', PAYMENTS)

  // HRM & Payroll
  put('fitpro_staff', STAFF)
  put('fitpro_departments', loadDepartments())
  put('fitpro_staff_attendance', loadStaffAttendance())
  put('fitpro_leave_types_v1', loadLeaveTypes())
  put('fitpro_leave_requests', LEAVES)
  put('fitpro_work_shifts_v1', loadWorkShifts())
  put('fitpro_salary_benefits_v1', loadSalaryBenefits())
  put('fitpro_salary_structures_v1', loadSalaryStructures())
  put('fitpro_salary_assignments_v1', loadSalaryAssignments())
  put('fitpro_payroll_adj_v1', loadPayrollAdj())
  put('fitpro_payslips', loadPayslips())
  put('fitpro_staff_loans_v1', loadLoans())
  put('fitpro_loan_installments_v1', loadLoanInstallments())
  put('fitpro_loan_policy_v1', loadLoanPolicy())
  put('fitpro_advance_salary_v1', loadSalaryAdvances())
  put('fitpro_jobs', loadJobs())
  put('fitpro_candidates', loadCandidates())
  put('fitpro_reviews', loadReviews())

  // Inventory, Sales, Purchases & Procurement
  put('fitpro_inventory', loadInventory())
  put('fitpro_stock_movements', loadStockMovements())
  put('fitpro_stock_transfers', loadStockTransfers())
  put('fitpro_stock_adjustments', loadStockAdjustments())
  put('fitpro_stock_counts', loadStockCounts())
  put('fitpro_stock_alerts', loadStockAlerts())
  put('fitpro_inventory_categories', loadCategories())
  put('fitpro_sales', loadSales())
  put('fitpro_invoices', INVOICES)
  put('fitpro_invoice_templates', INVOICE_TEMPLATES)
  put('fitpro_proposals', loadProposals())
  put('fitpro_estimates', loadEstimates())
  put('fitpro_sales_orders', loadSalesOrders())
  put('fitpro_sales_returns', loadSalesReturns())
  put('fitpro_shipments', loadShipments())
  put('fitpro_discounts', loadDiscounts())
  put('fitpro_coupons', loadCoupons())
  put('fitpro_coupon_assignments', loadCouponAssignments())
  put('fitpro_purchases', loadPurchases())
  put('fitpro_purchase_orders', loadPurchaseOrders())
  put('fitpro_purchase_returns', loadPurchaseReturns())
  put('fitpro_purchase_payments', loadPurchasePayments())
  put('fitpro_requisitions', loadRequisitions())
  put('fitpro_proc_purchase_orders', loadProcPurchaseOrders())
  put('fitpro_goods_receipts', loadGoodsReceipts())
  put('fitpro_supplier_invoices', loadSupplierInvoices())
  put('fitpro_supplier_payments', loadSupplierPayments())
  put('fitpro_proc_returns', loadProcReturns())

  // Accounting & Banking
  put('fitpro_accounts_v4', loadAccounts())
  put('fitpro_accounting_settings', loadAccountingSettings())
  put('fitpro_receipt_vouchers', loadReceipts())
  put('fitpro_payment_vouchers', loadPayments())
  put('fitpro_journal_vouchers', loadJournals())
  put('fitpro_journal_templates', loadJournalTemplates())
  put('fitpro_account_history', loadAccountHistory())
  put('fitpro_bank_reconciliations', loadReconciliations())
  put('fitpro_bank_signatories', loadSignatories())
  put('fitpro_budgets', loadBudgets())
  put('fitpro_value_book', loadValueBook())
  put('fitpro_cheques', loadCheques())
  put('fitpro_funds', loadFunds())
  put('fitpro_payment_modes', loadPaymentModes())
  put('fitpro_voucher_serials', loadSerials())
  put('fitpro_account_detail_types_v2', loadDetailTypes())
  put('fitpro_income_statement_mods', loadIncomeMods())
  put('fitpro_currency_rates', loadCurrencyRates())
  put('fitpro_stakeholder_classes', loadStakeholderClasses())
  put('fitpro_stakeholder_entities', loadStakeholderEntities())

  // Approvals
  put('fitpro_approval_doc_types_v1', loadApprovalDocTypes())
  put(approvalStorageKey(DEFAULT_COMPANY.id), loadApprovalData(DEFAULT_COMPANY.id))

  // Projects
  put('fitpro_projects_v1', loadProjects())
  put('fitpro_contracts_v1', loadContracts())
  put('fitpro_tasks_v1', loadTasks())
  put('fitpro_work_stages_v1', loadWorkStages())
  put('fitpro_task_templates_v1', loadTaskTemplates())
  put('fitpro_timesheets_v1', loadTimesheets())
  put('fitpro_project_invoices_v1', loadProjectInvoices())
  put('fitpro_project_types_v1', loadProjectTypes())
  put('fitpro_contract_types_v1', loadContractTypes())
  put('fitpro_project_statuses_v1', loadProjectStatuses())
  put('fitpro_project_priorities_v1', loadProjectPriorities())
  put('fitpro_project_categories_v1', loadProjectCategories())
  put('fitpro_milestones', loadMilestones())

  // Assets
  put('fitpro_assets', loadAssets())
  put('fitpro_depreciation', loadDepreciation())
  put('fitpro_asset_transactions', loadAssetTransactions())
  put('fitpro_asset_locations_v1', loadAssetLocations())
  put('fitpro_asset_categories', loadAssetCategories())
  put('fitpro_asset_conditions', loadAssetConditions())
  put('fitpro_depreciation_policy', loadDepreciationPolicy())
  put('fitpro_depreciation_policies_v1', loadDepreciationPolicies())

  // Communications, CMS, Media & Settings
  put('fitpro_notifications', NOTIFICATIONS)
  put('fitpro_messages', MESSAGES)
  put('fitpro_message_templates', loadMessageTemplates())
  put('fitpro_cms', loadCms())
  put('fitpro_custom_fields', loadCustomFields())
  put('fitpro_integrations', loadIntegrations())
  put('fitpro_int_logs', loadIntegrationLogs())
  put('fitpro_modules', loadModules())
  put('fitpro_submodules', loadSubModules())
  put('fitpro_sidebar_order_v3', loadSidebarOrder())
  put('fitpro_submenu_order_v1', loadSubMenuOrder())
  put('fitpro_system_settings', loadSystemSettings())
  put('fitpro_payment_settings', loadPaymentSettings())
  put('fitpro_media_settings', loadMediaSettings())
  put('fitpro_imageshop_folders_v1', ['Main Folder', 'Gym Equipment', 'Member Avatars', 'ID Cards & Certificates'])

  // Education, Certificates, Card Management & Church Management (per branch)
  for (const br of BRANCHES) {
    loadEduRecords(br.id, br.name)
    ensureCompleteEduBranchSeed(br.id, br.name)
    loadCardStore(br.id)
    loadChurchRecords(br.id)
  }

  // Snapshot all resulting persisted keys from localStorage
  const out: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k) continue
    if (k === 'fitpro_session' || k === 'fitpro_impersonator' || k === 'fitpro_theme' || k === 'fitpro_lang' || k === 'fitpro_db_engine_pref') continue
    if (k.startsWith('fitpro_') || k.startsWith('cert_')) {
      const v = localStorage.getItem(k)
      if (v !== null) out[k] = v
    }
  }
  return out
}

function hasPopulatedNestedSlices(raw: string | null): boolean {
  if (!raw || raw.trim() === '' || raw.trim() === '{}') return false
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false
    for (const branchVal of Object.values(parsed as Record<string, unknown>)) {
      if (branchVal && typeof branchVal === 'object' && !Array.isArray(branchVal)) {
        for (const arr of Object.values(branchVal as Record<string, unknown>)) {
          if (Array.isArray(arr) && arr.length > 0) return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Ensures branch-scoped modules that are not mounted inside <AppProvider />
 * (Education Management 121 sub-menus, Certificate Management 8 sub-menus,
 * Card Management 4 sub-menus, and Church Management 4 sub-menus) are always
 * attached and populated in localStorage (unless explicitly cleared in Data Reset).
 *
 * Returns a map of store keys that were newly attached or repaired.
 */
export function ensureAttachedModuleStores(): Record<string, string> {
  const repaired: Record<string, string> = {}
  if (typeof window === 'undefined') return repaired

  let activeBranches: Array<{ id: string; name?: string }> = BRANCHES.map((b) => ({ id: b.id, name: b.name }))
  try {
    const rawBr = window.localStorage.getItem('fitpro_branches')
    if (rawBr) {
      const parsed = JSON.parse(rawBr)
      if (Array.isArray(parsed) && parsed.length > 0) {
        activeBranches = parsed
          .filter((b): b is { id: string; name?: string } => Boolean(b && typeof b.id === 'string'))
      }
    }
  } catch {
    /* keep default branches */
  }

  const prevEdu = window.localStorage.getItem(EDU_RECORDS_KEY)
  const prevCards = window.localStorage.getItem(CARDS_KEY)
  const prevChurch = window.localStorage.getItem(CHURCH_RECORDS_KEY)

  const eduMissing = !isCollectionMarkedCleared('educationRecords') && !hasPopulatedNestedSlices(prevEdu)
  const cardsMissing = !isCollectionMarkedCleared('cardManagement') && !hasPopulatedNestedSlices(prevCards)
  const churchMissing = !isCollectionMarkedCleared('churchRecords') && !hasPopulatedNestedSlices(prevChurch)

  // Also check if Education has fewer than 100 populated sub-menu collections on the primary branch
  let eduIncomplete = false
  if (!eduMissing && !isCollectionMarkedCleared('educationRecords') && prevEdu) {
    try {
      const parsedEdu = JSON.parse(prevEdu) as Record<string, Record<string, unknown[]>>
      const firstBranch = activeBranches[0]?.id || 'br_airport'
      const bMap = parsedEdu?.[firstBranch]
      if (!bMap || Object.keys(bMap).length < 100) {
        eduIncomplete = true
      }
    } catch {
      eduIncomplete = true
    }
  }

  if (!eduMissing && !eduIncomplete && !cardsMissing && !churchMissing) {
    return repaired
  }

  for (const br of activeBranches) {
    if (eduMissing || eduIncomplete) {
      loadEduRecords(br.id, br.name || 'Main Campus')
      ensureCompleteEduBranchSeed(br.id, br.name || 'Main Campus')
    }
    if (cardsMissing) {
      loadCardStore(br.id)
    }
    if (churchMissing) {
      loadChurchRecords(br.id)
    }
  }

  const nextEdu = window.localStorage.getItem(EDU_RECORDS_KEY)
  if (nextEdu && nextEdu !== prevEdu) repaired[EDU_RECORDS_KEY] = nextEdu

  const nextCards = window.localStorage.getItem(CARDS_KEY)
  if (nextCards && nextCards !== prevCards) repaired[CARDS_KEY] = nextCards

  const nextChurch = window.localStorage.getItem(CHURCH_RECORDS_KEY)
  if (nextChurch && nextChurch !== prevChurch) repaired[CHURCH_RECORDS_KEY] = nextChurch

  for (const metaKey of ['fitpro_edu_seeded_v1', 'fitpro_cards_migrated_v1']) {
    const v = window.localStorage.getItem(metaKey)
    if (v) repaired[metaKey] = v
  }

  return repaired
}

