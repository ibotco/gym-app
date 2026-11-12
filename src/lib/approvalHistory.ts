import { isApprovalStepComplete, loadPendingApprovals } from './approvalQueue'
import type { User } from '../types'

export type ApprovalHistoryStatus = 'Approved' | 'Rejected' | 'Escalated' | 'Auto-approved'
export type ApprovalHistoryRequestState = 'Pending' | 'Completed' | 'Escalated'

export interface ApprovalHistoryEntry {
  id: string
  requestId: string
  documentNo: string
  date: string
  /** Timestamp for this specific approval action (kept as completedAt for stored-data compatibility). */
  completedAt: string
  createdBy: string
  actionBy: string
  documentType: string
  party: string
  amount: number
  workflowId: string
  currentLevel: number
  stepId?: string
  stepName?: string
  /** Actor identity supplements the display name so saved approvals can be de-duplicated and attributed reliably. */
  actionById?: string
  status: ApprovalHistoryStatus
  /** Recovered only from a still-pending request; the approval was saved but its original timestamp was not. */
  actionTimeUnknown?: boolean
  /** Whether this action closed, returned, or left the request in progress. Older rows omit this and are treated as completed. */
  requestState?: ApprovalHistoryRequestState
  /** False when an approve-all step is still awaiting other assigned approvers. */
  stepComplete?: boolean
  /** Set when a rejection returned the request to an earlier step. */
  returnedToLevel?: number
  comments?: string
  assignedRole?: string
}

/** Old history entries predate requestState and represent recorded outcomes. */
export function isFinalApprovalHistoryDecision(entry: ApprovalHistoryEntry): boolean {
  return entry.requestState !== 'Pending'
}

/** Label an individual step action without implying the whole request is final. */
export function approvalHistoryActionLabel(entry: ApprovalHistoryEntry): string {
  if (entry.requestState === 'Pending' && entry.status === 'Approved') {
    return entry.stepComplete === false ? 'Approval recorded' : 'Step approved'
  }
  if (entry.requestState === 'Pending' && entry.status === 'Rejected') {
    return entry.returnedToLevel != null ? `Rejected · back to L${entry.returnedToLevel}` : 'Rejected · returned'
  }
  return entry.status
}

export function approvalHistoryRequestState(entry: ApprovalHistoryEntry): ApprovalHistoryRequestState {
  if (entry.requestState) return entry.requestState
  return entry.status === 'Escalated' ? 'Escalated' : 'Completed'
}

/**
 * Recover step approvals from older still-pending queue rows. Older builds
 * persisted approver IDs in stepApprovals but did not keep individual action
 * events or timestamps. Preserve the fact of the vote without inventing a time.
 */
export function recoverPendingApprovalHistory(
  companyId: string,
  users: Array<Pick<User, 'id' | 'name'>>,
): ApprovalHistoryEntry[] {
  const existing = loadApprovalHistory(companyId)
  const recordedActions = new Set(existing.flatMap((entry) =>
    entry.requestId && entry.stepId && entry.actionById
      ? [`${entry.requestId}\u0000${entry.stepId}\u0000${entry.actionById}`]
      : [],
  ))
  const recovered: ApprovalHistoryEntry[] = []
  const pendingRows = loadPendingApprovals(companyId)
  for (const row of pendingRows) {
    if (row.companyId && row.companyId !== companyId) continue
    for (const step of row.approvalSteps || []) {
      for (const actorId of row.stepApprovals?.[step.id] || []) {
        const actionKey = `${row.id}\u0000${step.id}\u0000${actorId}`
        if (recordedActions.has(actionKey)) continue
        recordedActions.add(actionKey)
        const actor = users.find((candidate) => String(candidate.id) === String(actorId))
        recovered.push({
          id: `recovered-${row.id}-${step.id}-${actorId}`,
          requestId: row.id,
          documentNo: row.documentNo,
          date: row.date || row.submittedAt || '',
          completedAt: '',
          createdBy: row.createdBy || '',
          actionBy: actor?.name || `Unknown approver (${actorId})`,
          actionById: actorId,
          documentType: row.documentType,
          party: row.party || '',
          amount: row.amount,
          workflowId: row.workflowId,
          currentLevel: step.level,
          stepId: step.id,
          stepName: step.stepName,
          status: 'Approved',
          requestState: 'Pending',
          stepComplete: isApprovalStepComplete(row, step),
          actionTimeUnknown: true,
          comments: 'Recovered from saved approval progress; the original action time was not stored.',
        })
      }
    }
  }
  return recovered
}

function historyStorageKey(companyId: string) {
  return `fitpro_approval_history_preview_v1_${companyId || 'default'}`
}

export function loadApprovalHistory(companyId: string): ApprovalHistoryEntry[] {
  try {
    const raw = localStorage.getItem(historyStorageKey(companyId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ApprovalHistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function appendApprovalHistory(companyId: string, entries: ApprovalHistoryEntry[]): boolean {
  if (!entries.length) return true
  try {
    const existing = loadApprovalHistory(companyId)
    const knownIds = new Set(existing.map((entry) => entry.id))
    const additions = entries.filter((entry) => {
      if (knownIds.has(entry.id)) return false
      knownIds.add(entry.id)
      return true
    })
    if (!additions.length) return true
    localStorage.setItem(historyStorageKey(companyId), JSON.stringify([...additions, ...existing]))
    window.dispatchEvent(new Event('approval-history-updated'))
    return true
  } catch {
    /* Local preview storage is best effort. */
    return false
  }
}
