import { DEFAULT_COMPANY_ID } from './companies'
import { uid } from './utils'
import type { Role } from '../types'

export interface ApprovalDocType {
  id: number
  sidemenu: number
  name: string
  documentType: string
  docTypeTable: string
  isActive: boolean
}

/** The global document catalogue transcribed from approval_db.pdf. */
export const APPROVAL_DOC_TYPES: ApprovalDocType[] = [
  { id: 1, sidemenu: 5, name: 'INCOME', documentType: 'RECEIPT', docTypeTable: 'accounting_receipts', isActive: true },
  { id: 2, sidemenu: 5, name: 'EXPENSES', documentType: 'PAYMENT', docTypeTable: 'accounting_payment', isActive: true },
  { id: 3, sidemenu: 5, name: 'JOURNAL', documentType: 'JOURNAL', docTypeTable: 'accounting_journal', isActive: true },
  { id: 4, sidemenu: 5, name: 'BUDGET PROPOSAL', documentType: 'BUDGET_PROPOSAL', docTypeTable: 'budget_details', isActive: true },
  { id: 5, sidemenu: 5, name: 'BANK RECONCILIATION', documentType: 'BANK_RECONCILIATION', docTypeTable: 'bank_reconciliation', isActive: true },
  { id: 6, sidemenu: 6, name: 'PRICE CHANGE APPROVAL', documentType: 'PRICE_CHANGE_APPROVAL', docTypeTable: 'price_change_approval', isActive: true },
  { id: 7, sidemenu: 6, name: 'INVENTORY ADJUSTMENT', documentType: 'INVENTORY_ADJUSTMENT', docTypeTable: 'inventory_adjustment', isActive: true },
  { id: 8, sidemenu: 6, name: 'STOCK TRANSFER REQUEST', documentType: 'STOCK_TRANSFER_REQUEST', docTypeTable: 'stock_transfer_request', isActive: true },
  { id: 9, sidemenu: 8, name: 'SALES', documentType: 'SALES', docTypeTable: 'accounting_sales', isActive: true },
  { id: 10, sidemenu: 8, name: 'PROPOSAL', documentType: 'PROPOSAL', docTypeTable: 'accounting_sales_proposal', isActive: true },
  { id: 11, sidemenu: 8, name: 'SALES ESTIMATE', documentType: 'SALES_ESTIMATE', docTypeTable: 'accounting_sales_estimate', isActive: true },
  { id: 12, sidemenu: 8, name: 'SALES ORDER', documentType: 'SALES_ORDER', docTypeTable: 'accounting_sales_order', isActive: true },
  { id: 13, sidemenu: 8, name: 'INVOICE', documentType: 'INVOICE', docTypeTable: 'accounting_inovice', isActive: true },
  { id: 14, sidemenu: 8, name: 'SHIPPING', documentType: 'SHIPPING', docTypeTable: 'accounting_shipping', isActive: true },
  { id: 15, sidemenu: 8, name: 'DISCOUNT APPROVAL (SPECIAL PRICING)', documentType: 'DISCOUNT', docTypeTable: 'accounting_discount', isActive: true },
  { id: 16, sidemenu: 8, name: 'CREDIT NOTE', documentType: 'CREDIT NOTE', docTypeTable: 'accounting_credit_note', isActive: true },
  { id: 17, sidemenu: 9, name: 'COUPON APPROVAL', documentType: 'COUPON_APPROVAL', docTypeTable: 'accounting_coupons', isActive: true },
  { id: 18, sidemenu: 10, name: 'PURCHASE', documentType: 'PURCHASE', docTypeTable: 'accounting_purchase', isActive: true },
  { id: 19, sidemenu: 10, name: 'PURCHASE ORDER', documentType: 'PURCHASE_ORDER', docTypeTable: 'accounting_purchase_order', isActive: true },
  { id: 20, sidemenu: 10, name: 'DEBIT NOTE', documentType: 'DEBIT_NOTE', docTypeTable: 'accounting_debit_note', isActive: true },
  { id: 21, sidemenu: 11, name: 'EMPLOYEE DETAILS', documentType: 'EMPLOYEE_DETAILS', docTypeTable: 'hrm_employee_details', isActive: true },
  { id: 22, sidemenu: 11, name: 'PROMOTION/APPOINTMENT', documentType: 'APPOINTMENT', docTypeTable: 'hrm_appoiontment', isActive: true },
  { id: 23, sidemenu: 11, name: 'DISCIPLINARY ACTION APPROVAL', documentType: 'DISCIPLINARY_ACTION', docTypeTable: 'hrm_disciplinary_action', isActive: true },
  { id: 24, sidemenu: 11, name: 'LEAVE REQUEST', documentType: 'LEAVE_REQUEST', docTypeTable: 'hrm_leave_request', isActive: true },
  { id: 25, sidemenu: 11, name: 'LOAN APPLICATION APPROVALS', documentType: 'LOAN_REQUEST', docTypeTable: 'hrm_loan_request', isActive: true },
  { id: 26, sidemenu: 11, name: 'TRAINING REQUEST', documentType: 'TRAINING_REQUEST', docTypeTable: 'hrm_training', isActive: true },
  { id: 27, sidemenu: 11, name: 'SALARY APPROVAL', documentType: 'SALARY_APPROVAL', docTypeTable: 'hrm_salary', isActive: true },
  { id: 28, sidemenu: 11, name: 'SALARY INCREMENT/BONUS APPROVAL', documentType: 'SALARY_INCREMENT', docTypeTable: 'hrm_salary_increment', isActive: true },
  { id: 29, sidemenu: 11, name: 'MONTHLY SALARY APPROVAL', documentType: 'MONTHLY_SALARY', docTypeTable: 'hrm_generate_salary', isActive: true },
  { id: 30, sidemenu: 11, name: 'PERFORMANCE APPROVAL', documentType: 'PERFORMANCE_APPROVAL', docTypeTable: 'hrm_performance', isActive: true },
  { id: 31, sidemenu: 12, name: 'ASSET ACQUISITION REQUEST', documentType: 'ASSET_ACQUISITION_REQUEST', docTypeTable: 'asset_acquisition', isActive: true },
  { id: 32, sidemenu: 12, name: 'ASSET SERVICE APPROVAL', documentType: 'ASSET_SERVICE', docTypeTable: 'asset_service', isActive: true },
  { id: 33, sidemenu: 12, name: 'ASSET DISPOSAL APPROVAL', documentType: 'ASSET_DISPOSAL', docTypeTable: 'asset_disposal', isActive: true },
  { id: 34, sidemenu: 14, name: 'PROJECT CONTRACT / AGREEMENT', documentType: 'PROJECT_CONTRACT', docTypeTable: 'project_contract', isActive: true },
  { id: 35, sidemenu: 14, name: 'PROJECT INVOICE APPROVAL', documentType: 'PROJECT_INVOICE', docTypeTable: 'project_invoice', isActive: true },
  { id: 36, sidemenu: 14, name: 'PROJECT TIMESHEET APPROVAL', documentType: 'PROJECT_TIMESHEET', docTypeTable: 'project_timesheet', isActive: true },
]

const APPROVAL_DOC_TYPES_STORAGE_KEY = 'fitpro_approval_doc_types_v1'

/**
 * Load the shared document-type catalogue. The shipped base entries mirror
 * approval_doc_type; user-added entries and active-state changes are stored in
 * browser storage until an approval-document-type API is available.
 */
export function loadApprovalDocTypes(): ApprovalDocType[] {
  const cloneBase = () => APPROVAL_DOC_TYPES.map((item) => ({ ...item }))
  try {
    const raw = localStorage.getItem(APPROVAL_DOC_TYPES_STORAGE_KEY)
    if (!raw) return cloneBase()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return cloneBase()
    const valid = parsed.filter((item): item is ApprovalDocType =>
      !!item && typeof item === 'object' && Number.isInteger(item.id) &&
      Number.isInteger(item.sidemenu) && typeof item.name === 'string' &&
      typeof item.documentType === 'string' && typeof item.docTypeTable === 'string' &&
      typeof item.isActive === 'boolean')
    const byCode = new Map(valid.map((item) => [item.documentType.trim().toUpperCase(), item]))
    const legacyBaseNames: Record<string, string> = { RECEIPT: 'RECEIPT', PAYMENT: 'PAYMENT' }
    const base = cloneBase().map((item) => {
      const stored = byCode.get(item.documentType.trim().toUpperCase())
      if (!stored) return item
      const legacyName = legacyBaseNames[item.documentType.trim().toUpperCase()]
      return { ...stored, name: stored.name === legacyName ? item.name : stored.name }
    })
    const baseCodes = new Set(base.map((item) => item.documentType.trim().toUpperCase()))
    const extras = valid.filter((item) => !baseCodes.has(item.documentType.trim().toUpperCase()))
    return [...base, ...extras].sort((a, b) => a.id - b.id)
  } catch {
    return cloneBase()
  }
}

/** Human-readable accounting paths for voucher types routed through approval. */
export function approvalDocumentTypeLabel(documentType: string): string {
  const code = documentType.trim().toUpperCase()
  if (code === 'RECEIPT') return 'Accounting Income / Receipt Voucher'
  if (code === 'PAYMENT') return 'Accounting Expenses / Payment Voucher'
  if (code === 'JOURNAL') return 'Accounting / Journal Voucher'
  return loadApprovalDocTypes().find((item) => item.documentType.trim().toUpperCase() === code)?.name || documentType
}

/** Persist the shared catalogue locally; true means browser storage accepted it. */
export function saveApprovalDocTypes(documentTypes: ApprovalDocType[]): boolean {
  try {
    localStorage.setItem(APPROVAL_DOC_TYPES_STORAGE_KEY, JSON.stringify(documentTypes))
    window.dispatchEvent(new Event('approval-config-updated'))
    return true
  } catch {
    return false
  }
}

export const APPROVAL_MENUS = [
  { id: 5, label: 'Accounting' },
  { id: 6, label: 'Inventory' },
  { id: 8, label: 'Sales' },
  { id: 9, label: 'Coupons' },
  { id: 10, label: 'Purchases' },
  { id: 11, label: 'Human Resource' },
  { id: 12, label: 'Asset Management' },
  { id: 14, label: 'Project Management' },
] as const

export interface ApprovalSettings {
  id: string
  companyId: string
  branchId: string
  enableApproval: boolean
  enableAutomatic: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

export interface ApprovalWorkflow {
  id: string
  companyId: string
  /** Null means this workflow is shared by every branch in the company. */
  branchId: string | null
  menuId: number
  documentType: string
  title: string
  description: string
  useAmountRange: boolean
  sequential: boolean
  minAmount: number | null
  maxAmount: number | null
  email: boolean
  sms: boolean
  whatsapp: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type ApprovalRuleCondition = {
  id: string
  kind: 'condition'
  field: string
  operator: string
  value: string
  rule_action: string | null
}

export type ApprovalRuleGroup = {
  id: string
  kind: 'group'
  join: 'AND' | 'OR'
  children: ApprovalRuleNode[]
  name?: string
}

export type ApprovalRuleNode = ApprovalRuleCondition | ApprovalRuleGroup

export type ApprovalRuleJsonCondition = {
  type: 'condition'
  field: string
  operator: string
  value: string
  rule_action: string | null
}
export type ApprovalRuleJsonGroup = {
  type: 'group'
  logic: 'AND' | 'OR'
  rules: ApprovalRuleJsonNode[]
}
export type ApprovalRuleJsonNode = ApprovalRuleJsonCondition | ApprovalRuleJsonGroup
export type ApprovalRuleJson = { logic: 'AND' | 'OR'; rules: ApprovalRuleJsonNode[]; name?: string }

export interface ApprovalStep {
  id: string
  workflowId: string
  level: number
  stepName: string
  roleId: Role
  slaHours: number
  escalationHours: number
  escalationRoleId: Role | ''
  rejectToStepId: string | null
  approvalMode: 'approve_all' | 'approve_any_one'
  isActive: boolean
  assignedUserIds: string[]
  ruleJson: ApprovalRuleJson | null
  createdAt: string
  updatedAt: string
}

export interface ApprovalRuleAction {
  id: string
  companyId: string
  branchId: string
  field: string
  operator: string
  value: string
  action: 'auto_approve' | 'approve' | 'reject' | 'escalate'
  label: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ApprovalModuleData {
  settings: ApprovalSettings[]
  workflows: ApprovalWorkflow[]
  steps: ApprovalStep[]
  ruleActions: ApprovalRuleAction[]
}

export function blankApprovalData(): ApprovalModuleData {
  return { settings: [], workflows: [], steps: [], ruleActions: [] }
}

export function approvalStorageKey(companyId?: string): string {
  return `fitpro_approval_module_v1_${companyId || DEFAULT_COMPANY_ID}`
}

export function loadApprovalData(companyId?: string): ApprovalModuleData {
  try {
    const raw = localStorage.getItem(approvalStorageKey(companyId))
    if (!raw) return blankApprovalData()
    const value = JSON.parse(raw) as Partial<ApprovalModuleData>
    return {
      settings: Array.isArray(value.settings) ? value.settings : [],
      workflows: Array.isArray(value.workflows) ? value.workflows : [],
      steps: Array.isArray(value.steps) ? value.steps : [],
      ruleActions: Array.isArray(value.ruleActions) ? value.ruleActions : [],
    }
  } catch {
    return blankApprovalData()
  }
}

export function saveApprovalData(companyId: string | undefined, value: ApprovalModuleData): void {
  try {
    localStorage.setItem(approvalStorageKey(companyId), JSON.stringify(value))
    window.dispatchEvent(new Event('approval-config-updated'))
  } catch {
    /* Browser storage can be full or disabled. */
  }
}

const SAMPLE_RULE_ACTIONS: Array<Pick<ApprovalRuleAction, 'field' | 'operator' | 'value' | 'action' | 'label'>> = [
  { field: 'amount', operator: '<=', value: '1000', action: 'auto_approve', label: 'Sample · Auto-approve low value (≤ GHS 1,000)' },
  { field: 'amount', operator: '>=', value: '10000', action: 'escalate', label: 'Sample · Escalate high value (≥ GHS 10,000)' },
  { field: 'status', operator: '=', value: 'invalid', action: 'reject', label: 'Sample · Reject invalid requests' },
  { field: 'status', operator: '=', value: 'pending', action: 'approve', label: 'Sample · Approve valid pending requests' },
]

function sampleAutoApprovalRule(): ApprovalRuleJson {
  return {
    name: 'Sample · Low-value auto approval',
    logic: 'AND',
    rules: [
      { type: 'condition', field: 'amount', operator: '<=', value: '1000', rule_action: 'auto_approve' },
      { type: 'condition', field: 'status', operator: '=', value: 'pending', rule_action: null },
    ],
  }
}

const SAMPLE_VOUCHER_RANGE_TYPES = new Set(['RECEIPT', 'PAYMENT'])
const DEFAULT_SAMPLE_WORKFLOW_DESCRIPTION = 'Two-step approval: Accountant review, then Gym Manager approval. The final step auto-approves only pending requests up to GHS 1,000 after 72 escalation hours.'

function sampleWorkflowDescription(documentType: string): string {
  return SAMPLE_VOUCHER_RANGE_TYPES.has(documentType)
    ? 'Two-step approval: Accountant review, then Gym Manager approval. This sample workflow applies to GHS 1,000–2,000; its final-step auto rule matches pending requests up to GHS 1,000 after 72 escalation hours.'
    : DEFAULT_SAMPLE_WORKFLOW_DESCRIPTION
}

function buildSampleApprovalSetup(companyId: string, branchId: string): ApprovalModuleData {
  const now = new Date().toISOString()
  const workflows: ApprovalWorkflow[] = loadApprovalDocTypes().filter((documentType) => documentType.isActive).map((documentType) => ({
    id: uid('apsample_wf'),
    companyId,
    // Shared across the company, so a sample configured at one branch is
    // available at each branch without copying workflow and step records.
    branchId: null,
    menuId: documentType.sidemenu,
    documentType: documentType.documentType,
    title: `${SAMPLE_VOUCHER_RANGE_TYPES.has(documentType.documentType) ? documentType.documentType : documentType.name} Approval`,
    description: sampleWorkflowDescription(documentType.documentType),
    useAmountRange: SAMPLE_VOUCHER_RANGE_TYPES.has(documentType.documentType),
    sequential: true,
    minAmount: SAMPLE_VOUCHER_RANGE_TYPES.has(documentType.documentType) ? 1000 : null,
    maxAmount: SAMPLE_VOUCHER_RANGE_TYPES.has(documentType.documentType) ? 2000 : null,
    email: true,
    sms: false,
    whatsapp: false,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))

  const steps: ApprovalStep[] = workflows.flatMap((workflow) => {
    const firstStepId = uid('apsample_step')
    const finalStepId = uid('apsample_step')
    const shared = {
      workflowId: workflow.id,
      approvalMode: 'approve_any_one' as const,
      isActive: true,
      assignedUserIds: [],
      createdAt: now,
      updatedAt: now,
    }
    return [
      {
        ...shared,
        id: firstStepId,
        level: 1,
        stepName: 'Sample · Initial review',
        roleId: 'accountant',
        slaHours: 8,
        escalationHours: 24,
        escalationRoleId: 'gym_manager',
        rejectToStepId: null,
        ruleJson: null,
      },
      {
        ...shared,
        id: finalStepId,
        level: 2,
        stepName: 'Sample · Final approval',
        roleId: 'gym_manager',
        slaHours: 24,
        escalationHours: 72,
        escalationRoleId: 'company_admin',
        rejectToStepId: firstStepId,
        ruleJson: sampleAutoApprovalRule(),
      },
    ]
  })

  const ruleActions: ApprovalRuleAction[] = SAMPLE_RULE_ACTIONS.map((action) => ({
    ...action,
    id: uid('apsample_action'),
    companyId,
    // Rule actions are reusable samples for every branch in this company.
    branchId: '*',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }))

  return {
    settings: [{
      id: uid('apsample_settings'),
      companyId,
      branchId,
      enableApproval: true,
      enableAutomatic: true,
      userId: 'sample-setup',
      createdAt: now,
      updatedAt: now,
    }],
    workflows,
    steps,
    ruleActions,
  }
}

const samplePrefix = (value: string) => value.startsWith('Sample ·') ? value : `Sample · ${value}`
const removeSamplePrefix = (value: string) => value.startsWith('Sample ·') ? value.slice('Sample ·'.length).trimStart() : value
const sampleActionSignature = (action: Pick<ApprovalRuleAction, 'field' | 'operator' | 'value' | 'action'>) =>
  [action.field, action.operator, action.value, action.action].join('|')
const isSampleWorkflow = (workflow: ApprovalWorkflow) => workflow.id.startsWith('apsample_wf_')

function normalizeSampleApprovalLabels(current: ApprovalModuleData): { data: ApprovalModuleData; changed: boolean } {
  let changed = false
  const sampleWorkflowIds = new Set(current.workflows.filter(isSampleWorkflow).map((workflow) => workflow.id))
  const workflows = current.workflows.map((workflow) => {
    if (!sampleWorkflowIds.has(workflow.id)) return workflow
    const title = removeSamplePrefix(workflow.title)
    const oldDescription = removeSamplePrefix(workflow.description)
    const wasDefaultSampleDescription = oldDescription === DEFAULT_SAMPLE_WORKFLOW_DESCRIPTION ||
      oldDescription.startsWith('Two-step sample: Accountant review, then Gym Manager approval.')
    const description = wasDefaultSampleDescription ? sampleWorkflowDescription(workflow.documentType) : oldDescription
    const useAmountRange = SAMPLE_VOUCHER_RANGE_TYPES.has(workflow.documentType)
    const minAmount = useAmountRange ? 1000 : null
    const maxAmount = useAmountRange ? 2000 : null
    if (title === workflow.title && description === workflow.description &&
      useAmountRange === workflow.useAmountRange && minAmount === workflow.minAmount && maxAmount === workflow.maxAmount) return workflow
    changed = true
    return { ...workflow, title, description, useAmountRange, minAmount, maxAmount }
  })
  const steps = current.steps.map((step) => {
    if (!sampleWorkflowIds.has(step.workflowId)) return step
    const stepName = samplePrefix(step.stepName)
    const ruleJson = step.ruleJson && !step.ruleJson.name
      ? { ...step.ruleJson, name: 'Sample · Low-value auto approval' }
      : step.ruleJson
    if (stepName === step.stepName && ruleJson === step.ruleJson) return step
    changed = true
    return { ...step, stepName, ruleJson }
  })
  const sampleActionLabels = new Map(SAMPLE_RULE_ACTIONS.map((action) => [sampleActionSignature(action), action.label]))
  const ruleActions = current.ruleActions.map((action) => {
    if (action.branchId !== '*') return action
    const label = sampleActionLabels.get(sampleActionSignature(action))
    const legacyLabel = label?.replace(/^Sample ·\s*/, '')
    if (!label || action.label === label || action.label !== legacyLabel) return action
    changed = true
    return { ...action, label }
  })
  return { data: changed ? { ...current, workflows, steps, ruleActions } : current, changed }
}

export interface SampleApprovalSetupResult {
  data: ApprovalModuleData
  workflowsAdded: number
  stepsAdded: number
  ruleActionsAdded: number
  settingsAdded: boolean
}

/**
 * Add missing sample approvals without replacing a company's existing setup.
 * The sample pack provides one active workflow and two sequential steps for
 * every active built-in document type, plus reusable actions and a final-step
 * low-value auto-approval rule.
 */
export function addSampleApprovalSetup(
  current: ApprovalModuleData,
  companyId: string,
  branchId: string,
): SampleApprovalSetupResult {
  const normalized = normalizeSampleApprovalLabels(current)
  const base = normalized.data
  const sample = buildSampleApprovalSetup(companyId, branchId)
  const configuredTypes = new Set(base.workflows.map((workflow) => workflow.documentType.trim().toUpperCase()))
  const workflows = sample.workflows.filter((workflow) => !configuredTypes.has(workflow.documentType.trim().toUpperCase()))
  const addedWorkflowIds = new Set(workflows.map((workflow) => workflow.id))
  const steps = sample.steps.filter((step) => addedWorkflowIds.has(step.workflowId))
  const existingActions = new Set(base.ruleActions
    .filter((action) => action.companyId === companyId)
    .map((action) => [action.field, action.operator, action.value, action.action].join('|')))
  const ruleActions = sample.ruleActions.filter((action) =>
    !existingActions.has([action.field, action.operator, action.value, action.action].join('|')),
  )
  const settingsAdded = !base.settings.some((setting) => setting.companyId === companyId && setting.branchId === branchId)
  const settings = settingsAdded ? sample.settings : []
  return {
    data: {
      ...base,
      settings: [...base.settings, ...settings],
      workflows: [...base.workflows, ...workflows],
      steps: [...base.steps, ...steps],
      ruleActions: [...base.ruleActions, ...ruleActions],
    },
    workflowsAdded: workflows.length,
    stepsAdded: steps.length,
    ruleActionsAdded: ruleActions.length,
    settingsAdded,
  }
}

/** Seed an entirely empty local company setup the first time it is needed. */
export function ensureSampleApprovalSetup(companyId: string, branchId: string): ApprovalModuleData {
  const current = loadApprovalData(companyId)
  const normalized = normalizeSampleApprovalLabels(current)
  const hasConfiguration = normalized.data.settings.length || normalized.data.workflows.length ||
    normalized.data.steps.length || normalized.data.ruleActions.length
  if (hasConfiguration) {
    if (normalized.changed) saveApprovalData(companyId, normalized.data)
    return normalized.data
  }
  const seeded = addSampleApprovalSetup(normalized.data, companyId, branchId).data
  saveApprovalData(companyId, seeded)
  return seeded
}

export function menuLabel(menuId: number): string {
  return APPROVAL_MENUS.find((menu) => menu.id === menuId)?.label || 'Other'
}

export function docTypeName(documentType: string, documentTypes: ApprovalDocType[] = APPROVAL_DOC_TYPES): string {
  return documentTypes.find((item) => item.documentType === documentType)?.name || documentType
}

export function newApprovalRuleGroup(join: ApprovalRuleGroup['join'] = 'AND'): ApprovalRuleGroup {
  return { id: uid('rule'), kind: 'group', join, children: [] }
}

export function visibleApprovalWorkflows(
  workflows: ApprovalWorkflow[],
  companyId: string,
  branchId: string,
): ApprovalWorkflow[] {
  return workflows.filter((workflow) =>
    workflow.companyId === companyId && (workflow.branchId == null || workflow.branchId === branchId),
  )
}
