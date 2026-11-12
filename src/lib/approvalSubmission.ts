import type { ApprovalStep, ApprovalWorkflow } from './approvals'
import { ensureSampleApprovalSetup, loadApprovalData, loadApprovalDocTypes } from './approvals'
import { loadPendingApprovals, savePendingApprovals, type PendingApprovalRow, type PendingApprovalStep, type PendingVoucherSubmission } from './approvalQueue'
import { uid } from './utils'
import { loadFeedState, saveFeedState } from './bankFeeds'
import type { PendingApprovalOrigin } from './approvalQueue'

export interface VoucherApprovalCriteria {
  companyId: string
  branchId: string
  menuId: number
  documentType: string
  amount: number
}

export interface VoucherApprovalRequest extends VoucherApprovalCriteria {
  documentNo: string
  date: string
  createdBy: string
  party: string
  submission: PendingVoucherSubmission
}

export type VoucherApprovalSkipReason =
  | 'approval-disabled'
  | 'document-type-disabled'
  | 'no-matching-workflow'
  | 'no-active-steps'

export type VoucherApprovalResult =
  | { status: 'not-required'; reason: VoucherApprovalSkipReason }
  | { status: 'queued'; row: PendingApprovalRow; replaced: boolean }
  | { status: 'storage-error' }

interface ApprovalPlan {
  workflow: ApprovalWorkflow
  steps: ApprovalStep[]
}

interface ApprovalPlanResult {
  plan: ApprovalPlan | null
  reason?: VoucherApprovalSkipReason
}

function findPlan(request: VoucherApprovalCriteria, seedDefaults = true): ApprovalPlanResult {
  const data = seedDefaults
    ? ensureSampleApprovalSetup(request.companyId, request.branchId)
    : loadApprovalData(request.companyId)
  const settings = data.settings.find((item) => item.companyId === request.companyId && item.branchId === request.branchId)
  // The General Rule panel defaults this switch on until a branch setting is saved.
  // Once explicitly disabled, it overrides enabled document types and workflows.
  if (!(settings?.enableApproval ?? true)) return { plan: null, reason: 'approval-disabled' }

  const documentType = loadApprovalDocTypes().find((item) =>
    item.sidemenu === request.menuId && item.documentType === request.documentType && item.isActive,
  )
  if (!documentType) return { plan: null, reason: 'document-type-disabled' }

  const workflows = data.workflows.filter((workflow) =>
    workflow.isActive && workflow.companyId === request.companyId && workflow.menuId === request.menuId &&
    workflow.documentType === request.documentType && (workflow.branchId == null || workflow.branchId === request.branchId) &&
    (!workflow.useAmountRange || (
      (workflow.minAmount == null || request.amount >= workflow.minAmount) &&
      (workflow.maxAmount == null || request.amount <= workflow.maxAmount)
    )),
  ).sort((a, b) => {
    const branchPriority = Number(b.branchId === request.branchId) - Number(a.branchId === request.branchId)
    if (branchPriority) return branchPriority
    const width = (workflow: ApprovalWorkflow) => workflow.useAmountRange
      ? (workflow.maxAmount ?? Number.MAX_SAFE_INTEGER) - (workflow.minAmount ?? 0)
      : Number.MAX_SAFE_INTEGER
    return width(a) - width(b) || a.createdAt.localeCompare(b.createdAt)
  })

  for (const workflow of workflows) {
    const steps = data.steps.filter((step) => step.workflowId === workflow.id && step.isActive)
      .slice().sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    if (steps.length) return { plan: { workflow, steps } }
  }
  return { plan: null, reason: workflows.length ? 'no-active-steps' : 'no-matching-workflow' }
}

/** Share the exact queue-matching decision with voucher forms for their status label and button text. */
export function getVoucherApprovalRequirement(criteria: VoucherApprovalCriteria): {
  requiresApproval: boolean
  reason?: VoucherApprovalSkipReason
} {
  const result = findPlan(criteria, false)
  return result.plan
    ? { requiresApproval: true }
    : { requiresApproval: false, reason: result.reason || 'no-matching-workflow' }
}

/** Post immediately when no approval rule applies; misconfigured workflows with no active steps remain Draft. */
export function shouldPostVoucherWithoutApproval(result: VoucherApprovalResult): boolean {
  return result.status === 'not-required' && result.reason !== 'no-active-steps'
}

function snapshotStep(step: ApprovalStep): PendingApprovalStep {
  return {
    id: step.id,
    level: step.level,
    stepName: step.stepName,
    roleId: step.roleId,
    slaHours: step.slaHours,
    escalationHours: step.escalationHours,
    escalationRoleId: step.escalationRoleId,
    rejectToStepId: step.rejectToStepId,
    approvalMode: step.approvalMode,
    assignedUserIds: [...step.assignedUserIds],
    ruleJson: step.ruleJson ? JSON.parse(JSON.stringify(step.ruleJson)) as ApprovalStep['ruleJson'] : null,
  }
}

export function queueVoucherForApproval(request: VoucherApprovalRequest): VoucherApprovalResult {
  const planResult = findPlan(request)
  const plan = planResult.plan
  const rows = loadPendingApprovals(request.companyId)
  if (!plan) {
    const nextRows = rows.filter((row) => !(
      row.voucherSubmission?.kind === request.submission.kind &&
      row.voucherSubmission.record.id === request.submission.record.id
    ))
    if (nextRows.length !== rows.length && !savePendingApprovals(request.companyId, nextRows, true)) {
      return { status: 'storage-error' }
    }
    return { status: 'not-required', reason: planResult.reason || 'no-matching-workflow' }
  }

  const priorIndex = rows.findIndex((row) =>
    row.voucherSubmission?.kind === request.submission.kind &&
    row.voucherSubmission.record.id === request.submission.record.id,
  )
  const prior = priorIndex >= 0 ? rows[priorIndex] : undefined
  const steps = plan.steps.map(snapshotStep)
  const firstStep = steps[0]
  const finalStep = steps[steps.length - 1]
  const now = Date.now()
  const pending: PendingApprovalRow = {
    id: prior?.id || uid('apreq'),
    documentNo: request.documentNo,
    date: request.date,
    companyId: request.companyId,
    submittedAt: new Date(now).toISOString(),
    createdBy: request.createdBy,
    documentType: request.documentType,
    party: request.party,
    amount: request.amount,
    workflowId: plan.workflow.id,
    branchId: request.branchId,
    currentLevel: firstStep.level,
    currentStepId: firstStep.id,
    approvalSteps: steps,
    stepApprovals: {},
    sequential: plan.workflow.sequential,
    voucherSubmission: request.submission,
    slaDueAt: new Date(now + Math.max(1, firstStep.slaHours || 24) * 3_600_000).toISOString(),
    escalationDueAt: firstStep.id === finalStep.id
      ? new Date(now + Math.max(1, finalStep.escalationHours || 24) * 3_600_000).toISOString()
      : undefined,
    isPaused: false,
    slaPausedAt: null,
    slaPauseSeconds: 0,
  }
  const nextRows = priorIndex >= 0
    ? rows.map((row, index) => index === priorIndex ? pending : row)
    : [pending, ...rows]
  const saved = savePendingApprovals(request.companyId, nextRows, true)
  if (!saved) return { status: 'storage-error' }
  return { status: 'queued', row: pending, replaced: !!prior }
}

/** Keep a bank-feed line in sync with the voucher created from it. */
export function updateBankFeedVoucherApproval(
  origin: PendingApprovalOrigin | undefined,
  outcome: 'pending' | 'draft' | 'posted',
  documentNo: string,
) {
  if (!origin) return
  const state = loadFeedState()
  let changed = false
  const txns = state.txns.map((txn) => {
    if (txn.id !== origin.transactionId || txn.feedId !== origin.feedId) return txn
    changed = true
    if (outcome === 'pending') return { ...txn, status: 'pending_approval' as const, voucherNo: documentNo, voucherStatus: undefined }
    return { ...txn, status: 'accepted' as const, voucherNo: documentNo, voucherStatus: outcome === 'posted' ? 'posted' as const : 'draft' as const }
  })
  if (!changed) return
  saveFeedState({ ...state, txns })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('bank-feed-updated'))
}
