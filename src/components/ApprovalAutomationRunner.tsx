import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'
import { appendApprovalHistory, type ApprovalHistoryEntry } from '../lib/approvalHistory'
import { loadApprovalData, loadApprovalDocTypes } from '../lib/approvals'
import { isAutoApprovalDue, loadPendingApprovals, savePendingApprovals } from '../lib/approvalQueue'
import { updateBankFeedVoucherApproval } from '../lib/approvalSubmission'

/**
 * Client-side automatic approval runner, mounted for the authenticated admin shell.
 * It runs while the app is open and also processes already-due rows on startup.
 */
export function ApprovalAutomationRunner() {
  const app = useApp()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const processing = useRef(false)

  useEffect(() => {
    const processDueApprovals = () => {
      if (processing.current) return
      processing.current = true
      try {
        const rows = loadPendingApprovals(companyId)
        const approvalData = loadApprovalData(companyId)
        const enabledTypes = new Set(loadApprovalDocTypes().filter((item) => item.isActive).map((item) => item.documentType))
        const now = Date.now()
        const completedAt = new Date(now).toISOString()
        const completedIds = new Set<string>()
        const history: ApprovalHistoryEntry[] = []

        rows.forEach((row) => {
          const submission = row.voucherSubmission
          if (!submission) return
          const branchId = row.branchId || ''
          const settings = approvalData.settings.find((item) => item.companyId === companyId && item.branchId === branchId)
          if (!(settings?.enableApproval ?? true) || !(settings?.enableAutomatic ?? true)) return
          if (!enabledTypes.has(row.documentType) || !isAutoApprovalDue(row, now)) return

          const finalStep = row.approvalSteps?.slice()
            .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
            .at(-1)
          if (!finalStep) return
          const roleName = app.roles.find((role) => String(role.id) === String(finalStep.roleId))?.name || String(finalStep.roleId)
          const comments = `Auto-approved after ${finalStep.escalationHours} escalation hours at the final approval step (${roleName}).`

          if (submission.kind === 'receipt') {
            app.upsertReceipt({ ...submission.record, status: 'posted' })
            app.log('system', 'AUTO_APPROVE', 'ReceiptVoucher', `Auto-approved ${submission.record.number} after final-step escalation.`)
          } else if (submission.kind === 'payment') {
            app.upsertPaymentVoucher({ ...submission.record, status: 'posted' })
            app.log('system', 'AUTO_APPROVE', 'PaymentVoucher', `Auto-approved ${submission.record.number} after final-step escalation.`)
          } else {
            app.upsertJournal({ ...submission.record, status: 'posted' })
            app.log('system', 'AUTO_APPROVE', 'JournalVoucher', `Auto-approved ${submission.record.number} after final-step escalation.`)
          }
          updateBankFeedVoucherApproval(submission.origin, 'posted', submission.record.number)
          history.push({
            id: `${row.id}-auto-approved-${finalStep.id}`,
            requestId: row.id,
            documentNo: row.documentNo,
            date: row.date,
            completedAt,
            createdBy: row.createdBy,
            actionBy: 'Automatic Approval',
            documentType: row.documentType,
            party: row.party,
            amount: row.amount,
            workflowId: row.workflowId,
            currentLevel: finalStep.level,
            stepId: finalStep.id,
            stepName: finalStep.stepName,
            actionById: 'system',
            status: 'Auto-approved',
            requestState: 'Completed',
            comments,
            assignedRole: roleName,
          })
          completedIds.add(row.id)
        })

        if (!history.length) return
        appendApprovalHistory(companyId, history)
        savePendingApprovals(companyId, rows.filter((row) => !completedIds.has(row.id)), true)
        window.dispatchEvent(new Event('approval-auto-processed'))
        toast.success(
          `${history.length} document${history.length === 1 ? '' : 's'} auto-approved`,
          'The final approval step exceeded its Escalation Hours and the Auto Approval Rule matched.',
        )
      } finally {
        processing.current = false
      }
    }

    processDueApprovals()
    const timer = window.setInterval(processDueApprovals, 1000)
    window.addEventListener('approval-pending-updated', processDueApprovals)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('approval-pending-updated', processDueApprovals)
    }
  }, [app, companyId, toast])

  return null
}
