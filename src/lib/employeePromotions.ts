import { DEFAULT_COMPANY_ID } from './companies.ts'
import { uid } from './utils.ts'

export const EMPLOYEE_PROMOTION_TYPES = [
  { value: 'annual_increment', label: 'Annual Increment' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'upgrading', label: 'Upgrading' },
  { value: 'regrading', label: 'Regrading' },
  { value: 'change_of_grade', label: 'Change of Grade' },
] as const

export type EmployeePromotionType = typeof EMPLOYEE_PROMOTION_TYPES[number]['value'] | (string & {})

/** Stable stored value for a label configured in HR Admin. Existing built-in keys stay unchanged. */
export function promotionTypeValue(label: string): EmployeePromotionType {
  const cleanLabel = String(label || '').trim()
  const builtIn = EMPLOYEE_PROMOTION_TYPES.find((item) => item.label.toLocaleLowerCase() === cleanLabel.toLocaleLowerCase())
  if (builtIn) return builtIn.value
  return cleanLabel
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
export type EmployeePromotionStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected' | 'Processed to Payroll'
export type PromotionApprovalLevel = 'HR Officer' | 'HR Manager' | 'Finance Officer' | 'Payroll Administrator'
export type PromotionApprovalStatus = 'Waiting' | 'Pending' | 'Approved' | 'Rejected'
export type PromotionDocumentType = 'promotion_letter' | 'approval_letter' | 'supporting_document'
export type PromotionPayrollTransactionType = 'salary_adjustment' | 'promotion_arrears'
export type PromotionSalaryChangeMode = 'target' | 'fixed' | 'percent'

export const EMPLOYEE_PROMOTION_APPROVAL_LEVELS: PromotionApprovalLevel[] = [
  'HR Officer',
  'HR Manager',
  'Finance Officer',
  'Payroll Administrator',
]

export const PROMOTION_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export interface PromotionActor {
  id: string
  name: string
  role: string
}

export interface PromotionDocument {
  id: string
  type: PromotionDocumentType
  fileName: string
  mimeType: string
  sizeBytes: number
  storageKey: string
  uploadedAt: string
  uploadedBy: string
  uploadedByName: string
}

export interface PromotionApproval {
  id: string
  level: PromotionApprovalLevel
  assignedRole: string
  status: PromotionApprovalStatus
  approvedBy?: string
  approvedByName?: string
  approvedAt?: string
  comments?: string
}

export interface PromotionAuditEvent {
  id: string
  action: string
  actorId: string
  actorName: string
  actorRole: string
  at: string
  details?: string
}

export interface PromotionPayrollTransaction {
  id: string
  type: PromotionPayrollTransactionType
  amount: number
  period: string
  effectiveDate: string
  payrollAdjustmentId?: string
  salaryIncreaseId?: string
  createdAt: string
}

/** Editable form values; computed arrears figures are intentionally not accepted here. */
export interface EmployeePromotionDraftInput {
  employeeStaffId: string
  employeeUserId: string
  employeeId: string
  employeeName: string
  department: string
  directorateUnit: string
  employmentCategory: string
  currentTitle: string
  currentGrade: string
  currentSalaryLevel: string
  currentSalaryStep: string
  salaryAssignmentIdSnapshot?: string
  salaryStructureIdSnapshot?: string
  salaryStructureNameSnapshot?: string
  newJobTitle: string
  newGrade: string
  newSalaryLevel: string
  newSalaryStep: string
  oldSalary: number
  newSalary: number
  /** Promotion pay can be set as a target basic or calculated from a fixed/percentage increase. */
  salaryChangeMode?: PromotionSalaryChangeMode
  salaryChangeAmount?: number
  effectiveDate: string
  processingDate: string
  promotionType: EmployeePromotionType
  promotionBasis: string
  promotionLetterNumber: string
  remarks: string
}

export interface EmployeePromotionRecord extends EmployeePromotionDraftInput {
  id: string
  companyId: string
  promotionReferenceNumber: string
  salaryDifference: number
  monthsOutstanding: number
  promotionArrears: number
  totalArrearsPayable: number
  status: EmployeePromotionStatus
  documents: PromotionDocument[]
  approvals: PromotionApproval[]
  auditTrail: PromotionAuditEvent[]
  payrollTransactions: PromotionPayrollTransaction[]
  createdBy: string
  createdByName: string
  createdAt: string
  modifiedBy: string
  modifiedByName: string
  updatedAt: string
  submittedAt?: string
  approvedBy?: string
  approvedByName?: string
  approvedAt?: string
  rejectedBy?: string
  rejectedByName?: string
  rejectedAt?: string
  payrollProcessedBy?: string
  payrollProcessedByName?: string
  payrollProcessedAt?: string
}

export interface PromotionValidationContext {
  employeeActive: boolean
  gradeOptions: string[]
  jobTitleOptions: string[]
  /** Active values from HR Admin, plus the current legacy value when editing an existing draft. */
  promotionTypeOptions?: string[]
  existingRecords: EmployeePromotionRecord[]
  editingRecordId?: string
  /** Effective months in the legacy payroll-change screen; prevents cross-screen duplicates. */
  legacyEffectiveMonths?: Array<{ employeeUserId: string; period: string }>
}

export interface PromotionValidationResult {
  valid: boolean
  errors: string[]
}

const PROMOTIONS_KEY_PREFIX = 'fitpro_hrm_employee_promotions_v1'

function storageKey(companyId?: string): string {
  return `${PROMOTIONS_KEY_PREFIX}_${companyId || DEFAULT_COMPANY_ID}`
}

function actorName(actor: PromotionActor): string {
  return actor.name?.trim() || actor.id || 'System'
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function normalizePromotionSalaryChange(input: EmployeePromotionDraftInput): EmployeePromotionDraftInput & {
  salaryChangeMode: PromotionSalaryChangeMode
  salaryChangeAmount: number
} {
  const validModes: PromotionSalaryChangeMode[] = ['target', 'fixed', 'percent']
  const salaryChangeMode = validModes.includes(input.salaryChangeMode || 'target')
    ? input.salaryChangeMode || 'target'
    : 'target'
  const parsedAmount = Number(input.salaryChangeAmount)
  const salaryChangeAmount = Number.isFinite(parsedAmount) ? roundMoney(parsedAmount) : 0
  const oldSalary = Number.isFinite(input.oldSalary) ? Math.max(0, input.oldSalary) : 0
  const amount = Math.max(0, salaryChangeAmount)
  const newSalary = salaryChangeMode === 'fixed'
    ? roundMoney(oldSalary + amount)
    : salaryChangeMode === 'percent'
      ? roundMoney(oldSalary * (1 + amount / 100))
      : input.newSalary
  return { ...input, salaryChangeMode, salaryChangeAmount, newSalary }
}

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Counts whole payroll months between the effective month and processing month. */
export function monthsOutstanding(effectiveDate: string, processingDate: string): number {
  if (!isIsoDate(effectiveDate) || !isIsoDate(processingDate)) return 0
  const [effectiveYear, effectiveMonth] = effectiveDate.slice(0, 7).split('-').map(Number)
  const [processingYear, processingMonth] = processingDate.slice(0, 7).split('-').map(Number)
  return Math.max(0, (processingYear - effectiveYear) * 12 + processingMonth - effectiveMonth)
}

export function calculatePromotionFinancials(oldSalary: number, newSalary: number, effectiveDate: string, processingDate: string) {
  const safeOldSalary = Number.isFinite(oldSalary) ? roundMoney(Math.max(0, oldSalary)) : 0
  const safeNewSalary = Number.isFinite(newSalary) ? roundMoney(Math.max(0, newSalary)) : 0
  const salaryDifference = roundMoney(safeNewSalary - safeOldSalary)
  const outstandingMonths = monthsOutstanding(effectiveDate, processingDate)
  const arrears = roundMoney(Math.max(0, salaryDifference) * outstandingMonths)
  return {
    oldSalary: safeOldSalary,
    newSalary: safeNewSalary,
    salaryDifference,
    monthsOutstanding: outstandingMonths,
    promotionArrears: arrears,
    totalArrearsPayable: arrears,
  }
}

export function generatePromotionReference(records: EmployeePromotionRecord[], processingDate: string): string {
  const year = isIsoDate(processingDate) ? processingDate.slice(0, 4) : new Date().getFullYear().toString()
  const prefix = `IPPD-PROM-${year}-`
  const lastSequence = records.reduce((max, record) => {
    if (!record.promotionReferenceNumber?.startsWith(prefix)) return max
    const sequence = Number(record.promotionReferenceNumber.slice(prefix.length))
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max
  }, 0)
  return `${prefix}${String(lastSequence + 1).padStart(4, '0')}`
}

export function loadEmployeePromotions(companyId?: string): EmployeePromotionRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(companyId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as EmployeePromotionRecord[] : []
  } catch {
    return []
  }
}

export function saveEmployeePromotions(records: EmployeePromotionRecord[], companyId?: string): void {
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(records))
  } catch {
    // Storage quota/private mode errors should be surfaced by production persistence adapters.
  }
}

const PROMOTION_ADMIN_ROLES = ['super_admin', 'gym_manager', 'company_admin']

export function canCreatePromotion(role: string): boolean {
  return ['hr_officer', 'hr_manager', ...PROMOTION_ADMIN_ROLES].includes(role.toLowerCase())
}

export function canApprovePromotion(role: string, level: PromotionApprovalLevel): boolean {
  const normalizedRole = role.toLowerCase()
  const aliases: Record<PromotionApprovalLevel, string[]> = {
    'HR Officer': ['hr_officer', 'hr_manager', ...PROMOTION_ADMIN_ROLES],
    'HR Manager': ['hr_manager', ...PROMOTION_ADMIN_ROLES],
    'Finance Officer': ['finance_officer', 'accountant', ...PROMOTION_ADMIN_ROLES],
    'Payroll Administrator': ['payroll_administrator', 'payroll_admin', ...PROMOTION_ADMIN_ROLES],
  }
  return aliases[level].includes(normalizedRole)
}

export function canProcessPromotion(role: string): boolean {
  return ['payroll_administrator', 'payroll_admin', ...PROMOTION_ADMIN_ROLES].includes(role.toLowerCase())
}

export function validateEmployeePromotion(
  input: EmployeePromotionDraftInput,
  context: PromotionValidationContext,
  mode: 'draft' | 'submit' = 'submit',
): PromotionValidationResult {
  const errors: string[] = []
  const resolvedInput = normalizePromotionSalaryChange(input)
  if (!input.employeeStaffId) errors.push('Select an employee from the employee master.')
  if (input.employeeStaffId && !context.employeeActive) errors.push('Only active employees can be promoted.')

  if (input.employeeStaffId && isIsoDate(input.effectiveDate)) {
    const duplicate = context.existingRecords.some((record) =>
      record.id !== context.editingRecordId
      && record.employeeStaffId === input.employeeStaffId
      && record.effectiveDate === input.effectiveDate,
    )
    if (duplicate) errors.push('A promotion for this employee already exists with the same effective date.')
    const legacyDuplicate = context.legacyEffectiveMonths?.some((record) =>
      record.employeeUserId === input.employeeUserId && record.period === input.effectiveDate.slice(0, 7),
    )
    if (legacyDuplicate) errors.push('A payroll promotion or grade change already exists for this employee in the effective month.')
  }

  if (mode === 'submit') {
    if (!input.employeeName.trim()) errors.push('Employee name is required.')
    if (!input.department.trim()) errors.push('Department is required.')
    if (!input.effectiveDate || !isIsoDate(input.effectiveDate)) errors.push('Enter a valid effective date.')
    if (!input.processingDate || !isIsoDate(input.processingDate)) errors.push('Enter a valid processing date.')
    if (isIsoDate(input.effectiveDate) && isIsoDate(input.processingDate) && input.effectiveDate > input.processingDate) {
      errors.push('Effective date cannot be after processing date.')
    }
    if (!input.currentGrade || !context.gradeOptions.includes(input.currentGrade)) {
      errors.push('Choose the current grade from HR Admin → Job Settings → Grades.')
    }
    if (!input.newGrade || !context.gradeOptions.includes(input.newGrade)) {
      errors.push('Choose the new grade from HR Admin → Job Settings → Grades.')
    }
    const currentRank = context.gradeOptions.indexOf(input.currentGrade)
    const newRank = context.gradeOptions.indexOf(input.newGrade)
    if (currentRank >= 0 && newRank >= 0 && newRank >= currentRank) {
      errors.push('New grade must be higher than the current grade. Move senior grades above junior grades in Grade Settings.')
    }
    if (!input.newSalaryLevel.trim()) errors.push('New salary level is required.')
    if (!input.newSalaryStep.trim()) errors.push('New salary step is required.')
    if (!Number.isFinite(input.oldSalary) || input.oldSalary < 0) errors.push('Current basic salary must be a valid non-negative amount.')
    if (resolvedInput.salaryChangeMode === 'fixed' && (!Number.isFinite(input.salaryChangeAmount) || resolvedInput.salaryChangeAmount <= 0)) {
      errors.push('Enter a fixed pay increase greater than zero.')
    }
    if (resolvedInput.salaryChangeMode === 'percent' && (!Number.isFinite(input.salaryChangeAmount) || resolvedInput.salaryChangeAmount <= 0 || resolvedInput.salaryChangeAmount > 100)) {
      errors.push('Enter a percentage increase greater than zero and no more than 100%.')
    }
    if (!Number.isFinite(resolvedInput.newSalary) || resolvedInput.newSalary <= 0) errors.push('New basic salary must be greater than zero.')
    if (Number.isFinite(input.oldSalary) && Number.isFinite(resolvedInput.newSalary) && resolvedInput.newSalary < input.oldSalary) {
      errors.push('New basic salary cannot be lower than current basic salary for a promotion.')
    }
    const allowedPromotionTypes = context.promotionTypeOptions ?? EMPLOYEE_PROMOTION_TYPES.map((item) => item.value)
    if (!allowedPromotionTypes.includes(input.promotionType)) errors.push('Choose an active promotion type from HR Admin → Job Settings → Promotion Type.')
    if (!input.promotionBasis.trim()) errors.push('Promotion basis is required.')
    if (input.newJobTitle && !context.jobTitleOptions.includes(input.newJobTitle)) {
      errors.push('New job title must be selected from HR Admin → Job Settings → Job Title.')
    }
    if (input.promotionType === 'promotion' && !input.newJobTitle) {
      errors.push('Choose the new job title from HR Admin → Job Settings → Job Title for a promotion.')
    }
  }
  return { valid: errors.length === 0, errors }
}

function auditEvent(action: string, actor: PromotionActor, details?: string): PromotionAuditEvent {
  return {
    id: uid('paudit'),
    action,
    actorId: actor.id,
    actorName: actorName(actor),
    actorRole: actor.role,
    at: new Date().toISOString(),
    ...(details ? { details } : {}),
  }
}

function withFinancials(input: EmployeePromotionDraftInput) {
  const resolvedInput = normalizePromotionSalaryChange(input)
  return calculatePromotionFinancials(resolvedInput.oldSalary, resolvedInput.newSalary, resolvedInput.effectiveDate, resolvedInput.processingDate)
}

export function createPromotionDraft(
  input: EmployeePromotionDraftInput,
  actor: PromotionActor,
  companyId: string | undefined,
  existingRecords: EmployeePromotionRecord[],
): EmployeePromotionRecord {
  const now = new Date().toISOString()
  const resolvedInput = normalizePromotionSalaryChange(input)
  return {
    ...resolvedInput,
    ...withFinancials(resolvedInput),
    id: uid('promotion'),
    companyId: companyId || DEFAULT_COMPANY_ID,
    promotionReferenceNumber: generatePromotionReference(existingRecords, resolvedInput.processingDate),
    status: 'Draft',
    documents: [],
    approvals: [],
    auditTrail: [auditEvent('Draft created', actor)],
    payrollTransactions: [],
    createdBy: actor.id,
    createdByName: actorName(actor),
    createdAt: now,
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
  }
}

export function updatePromotionDraft(
  record: EmployeePromotionRecord,
  input: EmployeePromotionDraftInput,
  actor: PromotionActor,
): EmployeePromotionRecord {
  if (record.status !== 'Draft' && record.status !== 'Rejected') {
    throw new Error('Only draft or rejected promotion forms can be edited.')
  }
  const now = new Date().toISOString()
  const resolvedInput = normalizePromotionSalaryChange(input)
  return {
    ...record,
    ...resolvedInput,
    ...withFinancials(resolvedInput),
    status: 'Draft',
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent('Draft updated', actor)],
  }
}

export function attachPromotionDocuments(
  record: EmployeePromotionRecord,
  documents: PromotionDocument[],
  actor: PromotionActor,
): EmployeePromotionRecord {
  if (!documents.length) return record
  const now = new Date().toISOString()
  return {
    ...record,
    documents: [...record.documents, ...documents],
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent('Promotion documents attached', actor, `${documents.length} document(s) uploaded.`)],
  }
}

export function removePromotionDocument(record: EmployeePromotionRecord, documentId: string, actor: PromotionActor): EmployeePromotionRecord {
  const document = record.documents.find((item) => item.id === documentId)
  if (!document) throw new Error('Promotion document not found.')
  const now = new Date().toISOString()
  return {
    ...record,
    documents: record.documents.filter((item) => item.id !== documentId),
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent('Promotion document removed', actor, document.fileName)],
  }
}

export function submitPromotionForApproval(record: EmployeePromotionRecord, actor: PromotionActor): EmployeePromotionRecord {
  if (record.status !== 'Draft' && record.status !== 'Rejected') {
    throw new Error('Only a draft promotion can be submitted for approval.')
  }
  const now = new Date().toISOString()
  const approvals: PromotionApproval[] = EMPLOYEE_PROMOTION_APPROVAL_LEVELS.map((level, index) => ({
    id: uid('papproval'),
    level,
    assignedRole: level.toLowerCase().replaceAll(' ', '_'),
    status: index === 0 ? 'Pending' : 'Waiting',
  }))
  return {
    ...record,
    status: 'Pending Approval',
    approvals,
    submittedAt: now,
    approvedBy: undefined,
    approvedByName: undefined,
    approvedAt: undefined,
    rejectedBy: undefined,
    rejectedByName: undefined,
    rejectedAt: undefined,
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent('Submitted for approval', actor)],
  }
}

function pendingApproval(record: EmployeePromotionRecord): PromotionApproval | undefined {
  return record.approvals.find((approval) => approval.status === 'Pending')
}

export function approvePromotionStep(
  record: EmployeePromotionRecord,
  actor: PromotionActor,
  comments = '',
): EmployeePromotionRecord {
  if (record.status !== 'Pending Approval') throw new Error('This promotion is not awaiting approval.')
  const active = pendingApproval(record)
  if (!active) throw new Error('No pending approval level was found.')
  if (!canApprovePromotion(actor.role, active.level)) throw new Error(`Only the ${active.level} can approve this step.`)
  const now = new Date().toISOString()
  const approvals = record.approvals.map((approval) => approval.id === active.id
    ? { ...approval, status: 'Approved' as const, approvedBy: actor.id, approvedByName: actorName(actor), approvedAt: now, comments: comments.trim() || undefined }
    : approval)
  const next = approvals.find((approval) => approval.status === 'Waiting')
  if (next) next.status = 'Pending'
  const fullyApproved = !next
  return {
    ...record,
    approvals,
    status: fullyApproved ? 'Approved' : 'Pending Approval',
    approvedBy: fullyApproved ? actor.id : record.approvedBy,
    approvedByName: fullyApproved ? actorName(actor) : record.approvedByName,
    approvedAt: fullyApproved ? now : record.approvedAt,
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent(`${active.level} approved`, actor, comments.trim() || undefined)],
  }
}

export function rejectPromotionStep(
  record: EmployeePromotionRecord,
  actor: PromotionActor,
  comments: string,
): EmployeePromotionRecord {
  if (record.status !== 'Pending Approval') throw new Error('This promotion is not awaiting approval.')
  const active = pendingApproval(record)
  if (!active) throw new Error('No pending approval level was found.')
  if (!canApprovePromotion(actor.role, active.level)) throw new Error(`Only the ${active.level} can reject this step.`)
  if (!comments.trim()) throw new Error('Enter a reason before rejecting a promotion.')
  const now = new Date().toISOString()
  const approvals = record.approvals.map((approval) => approval.id === active.id
    ? { ...approval, status: 'Rejected' as const, approvedBy: actor.id, approvedByName: actorName(actor), approvedAt: now, comments: comments.trim() }
    : approval)
  return {
    ...record,
    approvals,
    status: 'Rejected',
    rejectedBy: actor.id,
    rejectedByName: actorName(actor),
    rejectedAt: now,
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent(`${active.level} rejected`, actor, comments.trim())],
  }
}

export function markPromotionProcessed(
  record: EmployeePromotionRecord,
  actor: PromotionActor,
  payrollTransactions: PromotionPayrollTransaction[],
): EmployeePromotionRecord {
  if (record.status !== 'Approved') throw new Error('A promotion must complete every approval level before payroll processing.')
  if (record.payrollTransactions.length) throw new Error('Payroll transactions already exist for this promotion.')
  const now = new Date().toISOString()
  return {
    ...record,
    status: 'Processed to Payroll',
    payrollTransactions,
    payrollProcessedBy: actor.id,
    payrollProcessedByName: actorName(actor),
    payrollProcessedAt: now,
    modifiedBy: actor.id,
    modifiedByName: actorName(actor),
    updatedAt: now,
    auditTrail: [...record.auditTrail, auditEvent('Processed to Payroll', actor, `${payrollTransactions.length} payroll transaction(s) created.`)],
  }
}

export const employeePromotionService = {
  list: loadEmployeePromotions,
  save: saveEmployeePromotions,
  generateReference: generatePromotionReference,
  calculateFinancials: calculatePromotionFinancials,
  validate: validateEmployeePromotion,
  createDraft: createPromotionDraft,
  updateDraft: updatePromotionDraft,
  attachDocuments: attachPromotionDocuments,
  removeDocument: removePromotionDocument,
  submit: submitPromotionForApproval,
  approve: approvePromotionStep,
  reject: rejectPromotionStep,
  markProcessed: markPromotionProcessed,
}
