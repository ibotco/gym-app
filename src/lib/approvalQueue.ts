import type { ApprovalRuleJson, ApprovalRuleJsonNode, ApprovalStep } from './approvals'
import type { JournalVoucher, PaymentVoucher, ReceiptVoucher, Role } from '../types'

/** Snapshot of one configured approval step attached to a submitted request. */
export type PendingApprovalStep = Pick<ApprovalStep,
  'id' | 'level' | 'stepName' | 'roleId' | 'slaHours' | 'escalationHours' |
  'escalationRoleId' | 'rejectToStepId' | 'approvalMode' | 'assignedUserIds' | 'ruleJson'
>

export interface PendingApprovalOrigin {
  kind: 'bank-feed'
  feedId: string
  transactionId: string
}

export type PendingVoucherSubmission =
  | { kind: 'receipt'; record: ReceiptVoucher; origin?: PendingApprovalOrigin }
  | { kind: 'payment'; record: PaymentVoucher; origin?: PendingApprovalOrigin }
  | { kind: 'journal'; record: JournalVoucher; origin?: PendingApprovalOrigin }

/** Browser-local pending queue helpers used by the queue and its reports. This is not a shared or server-enforced approval store. */
export interface PendingApprovalRow {
  id: string
  documentNo: string
  date: string
  /** Tenant and submission timestamp mirror the legacy approval_requests scope. */
  companyId?: string
  submittedAt?: string
  createdBy: string
  documentType: string
  party: string
  amount: number
  workflowId: string
  branchId?: string
  currentLevel: number
  currentStepId?: string
  approvalSteps?: PendingApprovalStep[]
  stepApprovals?: Record<string, string[]>
  sequential?: boolean
  voucherSubmission?: PendingVoucherSubmission
  slaDueAt: string
  /** Escalation-clock deadline for the workflow's highest-level step. */
  escalationDueAt?: string
  isPaused: boolean
  slaPausedAt: string | null
  slaPauseSeconds: number
  pauseReason?: string
}

const PREVIEW_PENDING_ROWS: PendingApprovalRow[] = [{
  id: 'pending-preview-vn-0001',
  documentNo: 'VN-0001',
  date: '2026-05-01T09:00:00',
  createdBy: '',
  documentType: 'RECEIPT',
  party: 'Isaac Botchwey',
  amount: 1500.5,
  workflowId: 'preview-payment-workflow',
  currentLevel: 1,
  slaDueAt: '2026-05-01T14:00:00Z',
  isPaused: false,
  slaPausedAt: null,
  slaPauseSeconds: 0,
}]

export function pendingApprovalStorageKey(companyId: string) {
  return `fitpro_pending_approvals_preview_v1_${companyId || 'default'}`
}

export function loadPendingApprovals(companyId: string): PendingApprovalRow[] {
  try {
    const raw = localStorage.getItem(pendingApprovalStorageKey(companyId))
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed as PendingApprovalRow[]
    }
  } catch {
    /* Use the local screenshot-matching preview row. */
  }
  return PREVIEW_PENDING_ROWS.map((row) => ({ ...row }))
}

export function savePendingApprovals(companyId: string, rows: PendingApprovalRow[], notify = false): boolean {
  try {
    localStorage.setItem(pendingApprovalStorageKey(companyId), JSON.stringify(rows))
    if (notify) window.dispatchEvent(new CustomEvent('approval-pending-updated', { detail: { companyId } }))
    return true
  } catch {
    /* Browser storage can be unavailable or full. */
    return false
  }
}

export function appendPendingApproval(companyId: string, row: PendingApprovalRow): boolean {
  const rows = loadPendingApprovals(companyId)
  const duplicate = rows.some((existing) => existing.id === row.id)
  return duplicate ? false : savePendingApprovals(companyId, [row, ...rows], true)
}

export function isApprovalStepComplete(row: PendingApprovalRow, step: PendingApprovalStep): boolean {
  const approvedBy = row.stepApprovals?.[step.id] || []
  const assigned = [...new Set(step.assignedUserIds || [])]
  if (step.approvalMode === 'approve_all' && assigned.length) {
    return assigned.every((userId) => approvedBy.includes(userId))
  }
  // With no explicit user list, one approver in the configured role completes
  // the step; the app has no separate role-membership service.
  return approvedBy.length > 0
}

function canUserApproveStep(row: PendingApprovalRow, step: PendingApprovalStep, userId: string, userRole: Role): boolean {
  if (!userId || isApprovalStepComplete(row, step)) return false
  const approvedBy = row.stepApprovals?.[step.id] || []
  if (approvedBy.includes(userId)) return false
  if (step.assignedUserIds?.length) return step.assignedUserIds.includes(userId)
  // Match the legacy document_approvals assignment: without explicit users,
  // only an active user whose role equals the step role has a pending task.
  return String(step.roleId) === String(userRole)
}

export function pendingSteps(row: PendingApprovalRow): PendingApprovalStep[] {
  return (row.approvalSteps || [])
    .filter((step) => !isApprovalStepComplete(row, step))
    .slice()
    .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
}

export function approvalStepForUser(row: PendingApprovalRow, userId: string, userRole: Role): PendingApprovalStep | null {
  const incomplete = pendingSteps(row)
  if (row.sequential !== false) {
    const current = incomplete[0]
    return current && canUserApproveStep(row, current, userId, userRole) ? current : null
  }
  return incomplete.find((step) => canUserApproveStep(row, step, userId, userRole)) || null
}

/**
 * Local equivalent of the legacy pending AJAX query: scope to the logged-in
 * tenant and active branch, then order by submission time. Approvers see only
 * their outstanding assignments; Super Admin gets a read-only overview of all
 * outstanding requests within the currently selected company and branch.
 */
export function pendingApprovalsForUser(
  rows: PendingApprovalRow[],
  companyId: string,
  branchId: string,
  userId: string,
  userRole: Role,
): PendingApprovalRow[] {
  if (!userId) return []
  return rows.filter((row) =>
    (!row.companyId || row.companyId === companyId) &&
    (row.branchId || '') === branchId &&
    (userRole === 'super_admin'
      ? pendingSteps(row).length > 0
      : !!approvalStepForUser(row, userId, userRole)),
  ).slice().sort((a, b) =>
    new Date(b.submittedAt || b.date).getTime() - new Date(a.submittedAt || a.date).getTime(),
  )
}

export function recordApprovalStep(
  row: PendingApprovalRow,
  userId: string,
  userRole: Role,
  now = Date.now(),
): { row: PendingApprovalRow; step: PendingApprovalStep; stepComplete: boolean; requestComplete: boolean } | null {
  const step = approvalStepForUser(row, userId, userRole)
  if (!step) return null
  const nextApprovals = { ...(row.stepApprovals || {}) }
  const approvedBy = new Set(nextApprovals[step.id] || [])
  approvedBy.add(userId)
  nextApprovals[step.id] = [...approvedBy]
  const nextRow = { ...row, stepApprovals: nextApprovals }
  const stepComplete = isApprovalStepComplete(nextRow, step)
  const incomplete = pendingSteps(nextRow)
  const nextStep = incomplete[0]
  const requestComplete = incomplete.length === 0
  const movedToNext = stepComplete && !!nextStep && nextStep.id !== row.currentStepId
  const finalStep = (row.approvalSteps || []).slice().sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)).at(-1)
  const enteredFinalStep = movedToNext && !!finalStep && nextStep?.id === finalStep.id
  return {
    step,
    stepComplete,
    requestComplete,
    row: {
      ...nextRow,
      currentLevel: nextStep?.level ?? row.currentLevel,
      currentStepId: nextStep?.id,
      ...(movedToNext ? {
        slaDueAt: new Date(now + Math.max(1, nextStep?.slaHours || 24) * 3_600_000).toISOString(),
        escalationDueAt: enteredFinalStep && nextStep
          ? new Date(now + Math.max(1, nextStep.escalationHours || 24) * 3_600_000).toISOString()
          : undefined,
        isPaused: false,
        slaPausedAt: null,
        slaPauseSeconds: 0,
        pauseReason: undefined,
      } : {}),
    },
  }
}

/** Send a rejected request back to its configured step, resetting that and later approvals. */
export function returnApprovalToStep(row: PendingApprovalRow, currentStepId: string, now = Date.now()): PendingApprovalRow | null {
  const current = row.approvalSteps?.find((step) => step.id === currentStepId)
  const targetId = current?.rejectToStepId
  const target = row.approvalSteps?.find((step) => step.id === targetId)
  if (!current || !target || target.level >= current.level) return null
  const stepApprovals = Object.fromEntries(
    Object.entries(row.stepApprovals || {}).filter(([stepId]) => {
      const step = row.approvalSteps?.find((item) => item.id === stepId)
      return !!step && step.level < target.level
    }),
  )
  return {
    ...row,
    currentLevel: target.level,
    currentStepId: target.id,
    stepApprovals,
    slaDueAt: new Date(now + Math.max(1, target.slaHours || 24) * 3_600_000).toISOString(),
    escalationDueAt: undefined,
    isPaused: false,
    slaPausedAt: null,
    slaPauseSeconds: 0,
    pauseReason: undefined,
  }
}

function finalApprovalStep(row: PendingApprovalRow): PendingApprovalStep | null {
  return (row.approvalSteps || []).slice().sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)).at(-1) || null
}

type AutoRuleContext = {
  amount: number
  status: string
  document_type: string
  third_party: string
  branch_id: string
  requested_by: string
}

type AutoRuleResult = { matched: boolean; actions: string[] }

function compareRuleValue(actual: string | number, operator: string, expected: string): boolean {
  if (operator === 'contains') return String(actual).toLowerCase().includes(expected.toLowerCase())
  const actualNumber = typeof actual === 'number' ? actual : Number(actual)
  const expectedNumber = Number(expected)
  const numeric = Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)
  const left = numeric ? actualNumber : String(actual).toLowerCase()
  const right = numeric ? expectedNumber : expected.toLowerCase()
  switch (operator) {
    case '=': return left === right
    case '!=': return left !== right
    case '>': return numeric && actualNumber > expectedNumber
    case '>=': return numeric && actualNumber >= expectedNumber
    case '<': return numeric && actualNumber < expectedNumber
    case '<=': return numeric && actualNumber <= expectedNumber
    default: return false
  }
}

function normalizeAutoRuleNode(value: unknown): ApprovalRuleJsonNode | null {
  if (!value || typeof value !== 'object') return null
  const node = value as Record<string, unknown>
  if (node.type === 'condition' || node.kind === 'condition') {
    if (typeof node.field !== 'string' || typeof node.operator !== 'string' || typeof node.value !== 'string') return null
    return {
      type: 'condition',
      field: node.field,
      operator: node.operator,
      value: node.value,
      rule_action: typeof node.rule_action === 'string' ? node.rule_action : null,
    }
  }
  if (node.type === 'group' || node.kind === 'group') {
    const rawRules = Array.isArray(node.rules) ? node.rules : Array.isArray(node.children) ? node.children : []
    const rules = rawRules.map(normalizeAutoRuleNode).filter((item): item is ApprovalRuleJsonNode => !!item)
    const logic = node.logic === 'OR' || node.join === 'OR' ? 'OR' : 'AND'
    return { type: 'group', logic, rules }
  }
  return null
}

function normalizeAutoRuleRoot(value: ApprovalRuleJson | null): ApprovalRuleJsonNode | null {
  if (!value || typeof value !== 'object') return null
  const root = value as unknown as Record<string, unknown>
  if (Array.isArray(root.rules) && (root.logic === 'AND' || root.logic === 'OR')) {
    const rules = root.rules.map(normalizeAutoRuleNode).filter((item): item is ApprovalRuleJsonNode => !!item)
    return { type: 'group', logic: root.logic, rules }
  }
  return normalizeAutoRuleNode(value)
}

function evaluateAutoRuleNode(node: ApprovalRuleJsonNode, context: AutoRuleContext): AutoRuleResult {
  if (node.type === 'condition') {
    const actual = context[node.field as keyof AutoRuleContext]
    const matched = actual !== undefined && compareRuleValue(actual, node.operator, node.value)
    return { matched, actions: matched && node.rule_action ? [node.rule_action] : [] }
  }
  if (!node.rules.length) return { matched: false, actions: [] }
  const children = node.rules.map((child) => evaluateAutoRuleNode(child, context))
  const matched = node.logic === 'AND' ? children.every((child) => child.matched) : children.some((child) => child.matched)
  return {
    matched,
    actions: matched ? children.filter((child) => child.matched).flatMap((child) => child.actions) : [],
  }
}

/** True when the final-step Auto Approval Rule matches and explicitly says Auto approve. */
export function autoApprovalRuleMatches(row: PendingApprovalRow): boolean {
  const finalStep = finalApprovalStep(row)
  if (!finalStep?.ruleJson) return false
  const rule = normalizeAutoRuleRoot(finalStep.ruleJson)
  if (!rule) return false
  const context: AutoRuleContext = {
    amount: row.amount,
    status: 'pending',
    document_type: row.documentType,
    third_party: row.party,
    branch_id: row.branchId || '',
    requested_by: row.createdBy,
  }
  const result = evaluateAutoRuleNode(rule, context)
  return result.matched && result.actions.includes('auto_approve') &&
    !result.actions.includes('reject') && !result.actions.includes('escalate')
}

/** Auto-approval is due only while the highest-level step is still pending. */
export function isAutoApprovalDue(row: PendingApprovalRow, now: number): boolean {
  const finalStep = finalApprovalStep(row)
  if (!finalStep || !row.escalationDueAt || row.isPaused || isApprovalStepComplete(row, finalStep)) return false
  const currentStepId = row.currentStepId || pendingSteps(row)[0]?.id
  if (currentStepId !== finalStep.id || !autoApprovalRuleMatches(row)) return false
  const dueAt = new Date(row.escalationDueAt).getTime()
  if (!Number.isFinite(dueAt)) return false
  return now >= dueAt + Math.max(0, row.slaPauseSeconds) * 1000
}

export function effectiveApprovalExpiry(row: PendingApprovalRow): number {
  return new Date(row.slaDueAt).getTime() + Math.max(0, row.slaPauseSeconds) * 1000
}

export function approvalSlaDifference(row: PendingApprovalRow, now: number): number {
  const referenceTime = row.isPaused && row.slaPausedAt ? new Date(row.slaPausedAt).getTime() : now
  return effectiveApprovalExpiry(row) - referenceTime
}

export type PendingApprovalSlaStatus = 'Paused' | 'Overdue' | 'Running'

export function approvalSlaStatus(row: PendingApprovalRow, now: number): PendingApprovalSlaStatus {
  if (row.isPaused) return 'Paused'
  return approvalSlaDifference(row, now) <= 0 ? 'Overdue' : 'Running'
}
