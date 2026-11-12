import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowUpDown, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, Eye, FileSpreadsheet, FileText, List, Pause, Play, Printer,
  RefreshCw, XCircle, TriangleAlert,
} from 'lucide-react'
import { Button, Input, Modal, PageHeader, Select, Textarea } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { appendApprovalHistory, type ApprovalHistoryEntry } from '../../../lib/approvalHistory'
import { approvalDocumentTypeLabel, loadApprovalData, loadApprovalDocTypes } from '../../../lib/approvals'
import { updateBankFeedVoucherApproval } from '../../../lib/approvalSubmission'
import {
  approvalSlaDifference as slaDifference,
  approvalSlaStatus as statusOf,
  approvalStepForUser,
  pendingApprovalsForUser,
  isApprovalStepComplete,
  loadPendingApprovals as loadPendingRows,
  pendingApprovalStorageKey,
  pendingSteps,
  recordApprovalStep,
  returnApprovalToStep,
  savePendingApprovals,
  type PendingApprovalRow,
} from '../../../lib/approvalQueue'
import { exportCsv, exportExcel, exportPdf, type ExportRow } from '../../../lib/export'

type SortKey = 'documentNo' | 'date' | 'createdBy' | 'documentType' | 'party' | 'amount' | 'status'
type Decision = 'Approved' | 'Rejected'
type ActionDialog = { ids: string[]; decision: Decision; bulk: boolean }
type PauseDialog = { id: string; mode: 'pause' | 'resume' }
type ActionMenuState = { id: string; top: number; left: number }
function formatDuration(milliseconds: number): string {
  const total = Math.floor(Math.abs(milliseconds) / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = total % 60
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return days ? `${days}d ${clock}` : clock
}
function documentDate(date: string): [string, string] {
  const [day = '', time = ''] = date.split('T')
  return [day, time.slice(0, 8)]
}

export function PendingApprovalsPage() {
  const app = useApp()
  const { user } = useAuth()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const branchId = app.activeBranch?.id || app.activeBranchId || ''
  const [rows, setRows] = useState<PendingApprovalRow[]>(() => loadPendingRows(companyId))
  const [approvalSettings, setApprovalSettings] = useState(() => loadApprovalData(companyId).settings)
  const [approvalWorkflows, setApprovalWorkflows] = useState(() => loadApprovalData(companyId).workflows)
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [exportOpen, setExportOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null)
  const toolbarDropdownRef = useRef<HTMLDivElement | null>(null)
  const actionMenuRef = useRef<HTMLDivElement | null>(null)
  const actionButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const [details, setDetails] = useState<PendingApprovalRow | null>(null)
  const [decisionDialog, setDecisionDialog] = useState<ActionDialog | null>(null)
  const [decisionComments, setDecisionComments] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [pauseDialog, setPauseDialog] = useState<PauseDialog | null>(null)
  const [pauseReason, setPauseReason] = useState('')
  const [pauseError, setPauseError] = useState('')
  const [escalateId, setEscalateId] = useState<string | null>(null)
  const [escalateRoleId, setEscalateRoleId] = useState('')
  const [escalateReason, setEscalateReason] = useState('')
  const [escalateError, setEscalateError] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setRows(loadPendingRows(companyId))
    const approvalData = loadApprovalData(companyId)
    setApprovalSettings(approvalData.settings)
    setApprovalWorkflows(approvalData.workflows)
    setSelectedIds(new Set())
    setPage(1)
  }, [companyId])
  useEffect(() => {
    setSelectedIds(new Set())
    setPage(1)
  }, [branchId, user?.id])
  useEffect(() => {
    const refreshApprovalConfig = () => {
      const data = loadApprovalData(companyId)
      setApprovalSettings(data.settings)
      setApprovalWorkflows(data.workflows)
    }
    window.addEventListener('approval-config-updated', refreshApprovalConfig)
    return () => window.removeEventListener('approval-config-updated', refreshApprovalConfig)
  }, [companyId])
  useEffect(() => {
    savePendingApprovals(companyId, rows)
  }, [companyId, rows])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const refreshRows = () => {
      const latestRows = loadPendingRows(companyId)
      setRows((current) => JSON.stringify(current) === JSON.stringify(latestRows) ? current : latestRows)
      setSelectedIds(new Set())
    }
    const refreshPendingEvent = (event: Event) => {
      const eventCompanyId = (event as CustomEvent<{ companyId?: string }>).detail?.companyId
      if (eventCompanyId && eventCompanyId !== companyId) return
      refreshRows()
    }
    const refreshStorageEvent = (event: StorageEvent) => {
      if (event.key === pendingApprovalStorageKey(companyId)) refreshRows()
    }
    window.addEventListener('approval-pending-updated', refreshPendingEvent)
    window.addEventListener('approval-auto-processed', refreshRows)
    window.addEventListener('storage', refreshStorageEvent)
    return () => {
      window.removeEventListener('approval-pending-updated', refreshPendingEvent)
      window.removeEventListener('approval-auto-processed', refreshRows)
      window.removeEventListener('storage', refreshStorageEvent)
    }
  }, [companyId])
  useEffect(() => {
    if (!actionMenu) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (actionMenuRef.current?.contains(target) || actionButtonRefs.current.get(actionMenu.id)?.contains(target)) return
      setActionMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionMenu(null)
    }
    const dismiss = () => setActionMenu(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
  }, [actionMenu])
  useEffect(() => {
    if (!exportOpen && !bulkOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || toolbarDropdownRef.current?.contains(target)) return
      setExportOpen(false)
      setBulkOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExportOpen(false)
        setBulkOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [exportOpen, bulkOpen])

  const visibleQueueRows = useMemo(() => {
    if (!user?.id || user.status !== 'active') return []
    return pendingApprovalsForUser(rows, companyId, branchId, user.id, user.role)
  }, [rows, companyId, branchId, user?.id, user?.role, user?.status])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = visibleQueueRows.filter((row) => !needle || [
      row.documentNo, row.date, row.createdBy, row.documentType, approvalDocumentTypeLabel(row.documentType), row.party,
      String(row.amount), statusOf(row, now),
    ].some((value) => value.toLowerCase().includes(needle)))
    if (!sortKey) return filtered
    const compare = (a: PendingApprovalRow, b: PendingApprovalRow) => {
      const left = sortKey === 'status' ? statusOf(a, now) : a[sortKey]
      const right = sortKey === 'status' ? statusOf(b, now) : b[sortKey]
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
      return sortDirection === 'asc' ? result : -result
    }
    return [...filtered].sort(compare)
  }, [visibleQueueRows, query, sortKey, sortDirection, now])
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const activePage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize)
  const firstEntry = filteredRows.length ? (activePage - 1) * pageSize + 1 : 0
  const lastEntry = Math.min(activePage * pageSize, filteredRows.length)
  const activeBranchName = app.activeBranch?.name || branchId || 'the active branch'
  const activeScopeQueueRows = rows.filter((row) =>
    (!row.companyId || row.companyId === companyId) && (row.branchId || '') === branchId,
  )
  const assignedIds = new Set(visibleQueueRows.map((row) => row.id))
  const savedButUnassignedRows = activeScopeQueueRows.filter((row) => !assignedIds.has(row.id))
  const savedButUnassignedSteps = [...new Set(savedButUnassignedRows.map((row) => {
    const step = row.approvalSteps?.find((candidate) => candidate.id === row.currentStepId) || pendingSteps(row)[0]
    if (!step) return 'No active approval step'
    const roleName = app.roles.find((role) => String(role.id) === String(step.roleId))?.name || String(step.roleId)
    return step.assignedUserIds?.length ? `${roleName} (specific user assignment)` : `${roleName} role`
  }))]
  const hasSavedRequestsOutsideActiveScope = rows.some((row) =>
    !!row.voucherSubmission && ((!row.companyId || row.companyId === companyId) && (row.branchId || '') !== branchId),
  )
  const emptyStateMessage = query.trim()
    ? 'No matching pending approvals found.'
    : user?.status !== 'active'
      ? 'Sign in with an active approver account to see pending approvals.'
      : savedButUnassignedRows.length
        ? `${savedButUnassignedRows.length} request(s) are saved in ${activeBranchName}, but none is assigned to your current account. Current step: ${savedButUnassignedSteps.join('; ')}. Check the workflow’s Approval Steps and user assignments.`
        : hasSavedRequestsOutsideActiveScope
          ? `No request is saved for ${activeBranchName} in the active company/branch scope. Confirm the selected company and branch, then refresh.`
          : `No pending approvals are assigned to you for ${activeBranchName}. After submitting, use Refresh if the request does not appear.`
  const allVisibleSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id))
  const selectedDetails = decisionDialog ? rows.filter((row) => decisionDialog.ids.includes(row.id)) : []
  const workflowName = (workflowId: string) => approvalWorkflows.find((workflow) =>
    workflow.companyId === companyId && workflow.id === workflowId,
  )?.title?.trim() || 'Workflow name unavailable'
  const escalationRoles = app.roles.filter((role) => role.portal === 'admin')

  const exportRows: ExportRow[] = filteredRows.map((row) => ({
    'Document No.': row.documentNo,
    Date: row.date.replace('T', ' '),
    'Created By': row.createdBy,
    'Document Type': approvalDocumentTypeLabel(row.documentType),
    Party: row.party,
    Amount: row.amount,
    Status: statusOf(row, now),
  }))

  const sortBy = (key: SortKey) => {
    setActionMenu(null)
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection('asc') }
  }
  const toggleActionMenu = (rowId: string, event: ReactMouseEvent<HTMLButtonElement>, overdue: boolean) => {
    if (actionMenu?.id === rowId) { setActionMenu(null); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 176
    const menuHeight = overdue ? 100 : 210
    const gap = 4
    const below = rect.bottom + gap + menuHeight <= window.innerHeight - 8
    const top = below ? rect.bottom + gap : Math.max(8, rect.top - menuHeight - gap)
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth))
    setActionMenu({ id: rowId, top, left })
  }
  const toggleSelected = (id: string) => setSelectedIds((previous) => {
    const next = new Set(previous)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleVisible = () => setSelectedIds((previous) => {
    const next = new Set(previous)
    if (allVisibleSelected) pageRows.forEach((row) => next.delete(row.id))
    else pageRows.forEach((row) => next.add(row.id))
    return next
  })

  const isApprovalEnabledForRow = (row: PendingApprovalRow) => {
    if (!loadApprovalDocTypes().some((item) => item.documentType === row.documentType && item.isActive)) return false
    const branchId = row.branchId || app.activeBranch?.id || app.activeBranchId || ''
    const settings = approvalSettings.find((item) => item.companyId === companyId && item.branchId === branchId)
    return settings?.enableApproval ?? true
  }
  const voucherMissingApprovalSteps = (row: PendingApprovalRow) =>
    !!row.voucherSubmission && !row.approvalSteps?.length
  const isApprovalProcessActiveForRow = (row: PendingApprovalRow) =>
    isApprovalEnabledForRow(row) && !voucherMissingApprovalSteps(row)
  const approvalActionBlockedReason = (row: PendingApprovalRow) =>
    !isApprovalEnabledForRow(row)
      ? 'Approval is disabled in General Rules.'
      : voucherMissingApprovalSteps(row)
        ? 'No active Approval Steps are configured. This voucher remains Draft.'
        : ''
  const canActOnRow = (row: PendingApprovalRow) =>
    isApprovalProcessActiveForRow(row) && (!row.approvalSteps?.length || !!approvalStepForUser(row, user?.id || '', user?.role || ''))

  const openDecision = (ids: string[], decision: Decision, bulk = false) => {
    const requested = rows.filter((row) => ids.includes(row.id))
    if (!requested.length) {
      toast.warning('Select one or more pending requests first.')
      setBulkOpen(false)
      return
    }
    const eligible = requested.filter((row) => statusOf(row, Date.now()) !== 'Overdue' && canActOnRow(row))
    if (!eligible.length) {
      const allApprovalDisabled = requested.every((row) => !isApprovalEnabledForRow(row))
      const allMissingSteps = requested.every((row) => voucherMissingApprovalSteps(row))
      const allOverdue = requested.every((row) => statusOf(row, Date.now()) === 'Overdue')
      toast.warning(allApprovalDisabled
        ? 'Approval is disabled in General Rules. No approval actions are available.'
        : allMissingSteps
          ? 'These vouchers have no active Approval Steps, so they remain Draft and cannot be approved.'
          : allOverdue
            ? 'Overdue requests can only be viewed or escalated.'
            : 'You are not assigned to the current approval step for these requests.')
      setBulkOpen(false)
      return
    }
    const overdueCount = requested.filter((row) => statusOf(row, Date.now()) === 'Overdue').length
    const disabledCount = requested.filter((row) => !isApprovalEnabledForRow(row)).length
    const missingStepsCount = requested.filter(voucherMissingApprovalSteps).length
    const unassignedCount = requested.filter((row) => isApprovalProcessActiveForRow(row) && statusOf(row, Date.now()) !== 'Overdue' && !canActOnRow(row)).length
    if (overdueCount) toast.warning(`${overdueCount} overdue request${overdueCount === 1 ? ' was' : 's were'} excluded.`)
    if (disabledCount) toast.warning(`${disabledCount} request${disabledCount === 1 ? ' was' : 's were'} excluded because Enable Approval is off in General Rules.`)
    if (missingStepsCount) toast.warning(`${missingStepsCount} voucher${missingStepsCount === 1 ? ' has' : 's have'} no active Approval Steps and remain Draft.`)
    if (unassignedCount) toast.warning(`${unassignedCount} request${unassignedCount === 1 ? ' was' : 's were'} excluded because you are not assigned to the current step.`)
    setDecisionComments('')
    setDecisionError('')
    setDecisionDialog({ ids: eligible.map((row) => row.id), decision, bulk })
    setBulkOpen(false)
    setActionMenu(null)
  }

  const submitDecision = () => {
    if (!decisionDialog) return
    const selectedRows = rows.filter((row) => decisionDialog.ids.includes(row.id))
    const chosen = selectedRows.filter((row) => statusOf(row, Date.now()) !== 'Overdue' && canActOnRow(row))
    if (!chosen.length) {
      setDecisionDialog(null)
      const approvalDisabled = selectedRows.some((row) => !isApprovalEnabledForRow(row))
      const missingApprovalSteps = selectedRows.some(voucherMissingApprovalSteps)
      toast.warning(approvalDisabled
        ? 'Approval is disabled in General Rules. No approval actions are available.'
        : missingApprovalSteps
          ? 'This voucher has no active Approval Steps, so it remains Draft and cannot be approved.'
          : 'These requests are overdue or you are no longer assigned to the current step.')
      return
    }
    if (chosen.length < decisionDialog.ids.length) {
      toast.warning(`${decisionDialog.ids.length - chosen.length} request${decisionDialog.ids.length - chosen.length === 1 ? ' was' : 's were'} no longer actionable and were not changed.`)
    }
    if (decisionDialog.decision === 'Rejected' && !decisionComments.trim()) {
      setDecisionError('Comments are required when rejecting a request.')
      return
    }

    const completedAt = new Date().toISOString()
    const history: ApprovalHistoryEntry[] = []
    const removedIds = new Set<string>()
    const updates = new Map<string, PendingApprovalRow>()
    let finalized = 0
    let savedVouchers = 0
    let advanced = 0
    let returned = 0
    let rejected = 0
    let rejectedDraftsSaved = 0

    chosen.forEach((row, index) => {
      if (decisionDialog.decision === 'Rejected') {
        const step = row.approvalSteps?.length
          ? approvalStepForUser(row, user?.id || '', user?.role || '')
          : null
        const returnedRow = step ? returnApprovalToStep(row, step.id) : null
        if (returnedRow) {
          updates.set(row.id, returnedRow)
          returned += 1
          history.push({
            id: `${row.id}-rejected-returned-${completedAt}-${index}-${step?.id || row.currentLevel}`,
            requestId: row.id,
            documentNo: row.documentNo,
            date: row.date,
            completedAt,
            createdBy: row.createdBy,
            actionBy: user?.name || 'Current User',
            documentType: row.documentType,
            party: row.party,
            amount: row.amount,
            workflowId: row.workflowId,
            currentLevel: step?.level || row.currentLevel,
            stepId: step?.id,
            stepName: step?.stepName,
            actionById: user?.id,
            status: 'Rejected',
            requestState: 'Pending',
            returnedToLevel: returnedRow.currentLevel,
            comments: decisionComments.trim(),
          })
          app.log(user?.id || 'system', 'REJECT_RETURN', 'ApprovalRequest', `${row.documentNo} rejected at Level ${step?.level || row.currentLevel}; returned to Level ${returnedRow.currentLevel}. ${decisionComments.trim()}`)
        } else {
          removedIds.add(row.id)
          rejected += 1
          const submission = row.voucherSubmission
          if (submission?.kind === 'receipt' && !app.receipts.some((record) => record.id === submission.record.id)) {
            app.upsertReceipt({ ...submission.record, status: 'draft' })
            rejectedDraftsSaved += 1
          } else if (submission?.kind === 'payment' && !app.paymentVouchers.some((record) => record.id === submission.record.id)) {
            app.upsertPaymentVoucher({ ...submission.record, status: 'draft' })
            rejectedDraftsSaved += 1
          } else if (submission?.kind === 'journal' && !app.journals.some((record) => record.id === submission.record.id)) {
            app.upsertJournal({ ...submission.record, status: 'draft' })
            rejectedDraftsSaved += 1
          }
          if (submission) updateBankFeedVoucherApproval(submission.origin, 'draft', submission.record.number)
          history.push({
            id: `${row.id}-rejected-${completedAt}-${index}-${step?.id || row.currentLevel}`,
            requestId: row.id,
            documentNo: row.documentNo,
            date: row.date,
            completedAt,
            createdBy: row.createdBy,
            actionBy: user?.name || 'Current User',
            documentType: row.documentType,
            party: row.party,
            amount: row.amount,
            workflowId: row.workflowId,
            currentLevel: step?.level || row.currentLevel,
            stepId: step?.id,
            stepName: step?.stepName,
            actionById: user?.id,
            status: 'Rejected',
            requestState: 'Completed',
            comments: decisionComments.trim(),
          })
        }
        return
      }

      if (row.approvalSteps?.length) {
        const progress = recordApprovalStep(row, user?.id || '', user?.role || '')
        if (!progress) return
        app.log(user?.id || 'system', 'APPROVAL_STEP', 'ApprovalRequest', `${row.documentNo} · Level ${progress.step.level} ${progress.step.stepName}`)
        history.push({
          id: `${row.id}-approved-${completedAt}-${index}-${progress.step.id}-${user?.id || 'system'}`,
          requestId: row.id,
          documentNo: row.documentNo,
          date: row.date,
          completedAt,
          createdBy: row.createdBy,
          actionBy: user?.name || 'Current User',
          documentType: row.documentType,
          party: row.party,
          amount: row.amount,
          workflowId: row.workflowId,
          currentLevel: progress.step.level,
          stepId: progress.step.id,
          stepName: progress.step.stepName,
          actionById: user?.id,
          status: 'Approved',
          requestState: progress.requestComplete ? 'Completed' : 'Pending',
          stepComplete: progress.stepComplete,
          comments: progress.requestComplete
            ? undefined
            : progress.stepComplete
              ? 'This approval step is complete; the request is waiting for the next configured step.'
              : 'Approval recorded; the current step is waiting for its other assigned approver(s).',
        })
        if (progress.requestComplete) {
          removedIds.add(row.id)
          finalized += 1
          const submission = row.voucherSubmission
          if (submission?.kind === 'receipt') {
            app.upsertReceipt({ ...submission.record, status: 'posted' })
            savedVouchers += 1
            app.log(user?.id || 'system', 'APPROVE', 'ReceiptVoucher', `Approved ${submission.record.number} — ${submission.record.amount}`)
          } else if (submission?.kind === 'payment') {
            app.upsertPaymentVoucher({ ...submission.record, status: 'posted' })
            savedVouchers += 1
            app.log(user?.id || 'system', 'APPROVE', 'PaymentVoucher', `Approved ${submission.record.number} — ${submission.record.amount}`)
          } else if (submission?.kind === 'journal') {
            app.upsertJournal({ ...submission.record, status: 'posted' })
            savedVouchers += 1
            app.log(user?.id || 'system', 'APPROVE', 'JournalVoucher', `Approved ${submission.record.number} — ${submission.record.description}`)
          }
          if (submission) updateBankFeedVoucherApproval(submission.origin, 'posted', submission.record.number)
        } else {
          updates.set(row.id, progress.row)
          if (progress.stepComplete) advanced += 1
        }
        return
      }

      // Preserve the legacy one-click behavior for non-voucher approval rows
      // that predate per-step snapshots.
      removedIds.add(row.id)
      finalized += 1
      history.push({
        id: `${row.id}-approved-${completedAt}-${index}`,
        requestId: row.id,
        documentNo: row.documentNo,
        date: row.date,
        completedAt,
        createdBy: row.createdBy,
        actionBy: user?.name || 'Current User',
        documentType: row.documentType,
        party: row.party,
        amount: row.amount,
        workflowId: row.workflowId,
        currentLevel: row.currentLevel,
        actionById: user?.id,
        status: 'Approved',
        requestState: 'Completed',
      })
    })

    appendApprovalHistory(companyId, history)
    setRows((current) => current
      .filter((row) => !removedIds.has(row.id))
      .map((row) => updates.get(row.id) || row))
    const changedIds = new Set([...removedIds, ...updates.keys()])
    setSelectedIds((current) => new Set([...current].filter((id) => !changedIds.has(id))))

    if (decisionDialog.decision === 'Approved') {
      if (finalized) toast.success(`${finalized} request${finalized === 1 ? '' : 's'} fully approved${savedVouchers ? `; ${savedVouchers} voucher${savedVouchers === 1 ? '' : 's'} saved` : ''}.`)
      if (advanced) toast.update(`${advanced} approval step${advanced === 1 ? '' : 's'} approved; request${advanced === 1 ? ' remains' : 's remain'} pending.`)
      if (!finalized && !advanced) toast.update('Approval recorded; the request is still waiting for other assigned approvers.')
    } else {
      if (rejected) toast.success(`${rejected} request${rejected === 1 ? '' : 's'} rejected${rejectedDraftsSaved ? `; ${rejectedDraftsSaved} new voucher${rejectedDraftsSaved === 1 ? '' : 's'} saved as Draft` : ''}.`, decisionComments.trim())
      if (returned) toast.update(`${returned} request${returned === 1 ? ' was' : 's were'} returned to the configured approval step.`)
    }
    setDecisionDialog(null)
    setDecisionComments('')
    setDecisionError('')
  }

  const openPauseDialog = (id: string, mode: 'pause' | 'resume') => {
    setPauseReason('')
    setPauseError('')
    setPauseDialog({ id, mode })
    setActionMenu(null)
  }
  const submitPauseDialog = () => {
    if (!pauseDialog) return
    const target = rows.find((row) => row.id === pauseDialog.id)
    if (!target) { setPauseDialog(null); return }
    if (!canActOnRow(target)) {
      setPauseDialog(null)
      toast.warning('You are not assigned to the current approval step.')
      return
    }
    if (pauseDialog.mode === 'pause' && statusOf(target, Date.now()) === 'Overdue') {
      setPauseDialog(null)
      toast.warning('Overdue requests can only be viewed or escalated.')
      return
    }
    if (pauseDialog.mode === 'pause' && !pauseReason.trim()) {
      setPauseError('A reason is required to pause the SLA.')
      return
    }
    const timestamp = Date.now()
    setRows((current) => current.map((row) => {
      if (row.id !== pauseDialog.id) return row
      if (pauseDialog.mode === 'pause') {
        return { ...row, isPaused: true, slaPausedAt: new Date(timestamp).toISOString(), pauseReason: pauseReason.trim() }
      }
      const pausedAt = row.slaPausedAt ? new Date(row.slaPausedAt).getTime() : timestamp
      const pausedSeconds = Math.max(0, Math.floor((timestamp - pausedAt) / 1000))
      return { ...row, isPaused: false, slaPausedAt: null, slaPauseSeconds: row.slaPauseSeconds + pausedSeconds, pauseReason: undefined }
    }))
    toast.success(pauseDialog.mode === 'pause' ? 'SLA paused' : 'SLA resumed', pauseDialog.mode === 'pause' ? pauseReason.trim() : undefined)
    setPauseDialog(null)
    setPauseReason('')
    setPauseError('')
  }

  const openEscalation = (row: PendingApprovalRow) => {
    if (!canActOnRow(row)) {
      toast.warning('Only the approver assigned to the current step can escalate this request.')
      return
    }
    setEscalateId(row.id)
    setEscalateRoleId('')
    setEscalateReason('')
    setEscalateError('')
    setActionMenu(null)
  }
  const submitEscalation = () => {
    const row = rows.find((item) => item.id === escalateId)
    if (!row) { setEscalateId(null); return }
    if (!canActOnRow(row)) {
      setEscalateId(null)
      toast.warning('Only the approver assigned to the current step can escalate this request.')
      return
    }
    const blockedReason = approvalActionBlockedReason(row)
    if (blockedReason) {
      setEscalateId(null)
      toast.warning(blockedReason)
      return
    }
    if (!escalateRoleId) { setEscalateError('Select a role to escalate this request to.'); return }
    if (!escalateReason.trim()) { setEscalateError('An escalation reason is required.'); return }
    const roleName = escalationRoles.find((role) => role.id === escalateRoleId)?.name || escalateRoleId
    const completedAt = new Date().toISOString()
    appendApprovalHistory(companyId, [{
      id: `${row.id}-escalated-${completedAt}`,
      requestId: row.id,
      documentNo: row.documentNo,
      date: row.date,
      completedAt,
      createdBy: row.createdBy,
      actionBy: user?.name || 'Current User',
      documentType: row.documentType,
      party: row.party,
      amount: row.amount,
      workflowId: row.workflowId,
      currentLevel: row.currentLevel,
      stepId: row.currentStepId,
      stepName: row.approvalSteps?.find((step) => step.id === row.currentStepId)?.stepName,
      actionById: user?.id,
      status: 'Escalated',
      requestState: 'Escalated',
      comments: escalateReason.trim(),
      assignedRole: roleName,
    }])
    const submission = row.voucherSubmission
    let draftSaved = false
    if (submission?.kind === 'receipt' && !app.receipts.some((record) => record.id === submission.record.id)) {
      app.upsertReceipt({ ...submission.record, status: 'draft' })
      draftSaved = true
    } else if (submission?.kind === 'payment' && !app.paymentVouchers.some((record) => record.id === submission.record.id)) {
      app.upsertPaymentVoucher({ ...submission.record, status: 'draft' })
      draftSaved = true
    } else if (submission?.kind === 'journal' && !app.journals.some((record) => record.id === submission.record.id)) {
      app.upsertJournal({ ...submission.record, status: 'draft' })
      draftSaved = true
    }
    if (submission) updateBankFeedVoucherApproval(submission.origin, 'draft', submission.record.number)
    setRows((current) => current.filter((item) => item.id !== row.id))
    setSelectedIds((current) => new Set([...current].filter((id) => id !== row.id)))
    toast.success('Request escalated', `${row.documentNo} → ${roleName}. ${escalateReason.trim()}${draftSaved ? ' New voucher saved as Draft.' : ''}`)
    setEscalateId(null)
  }

  const refresh = () => {
    setRows(loadPendingRows(companyId))
    setNow(Date.now())
    setQuery('')
    setPage(1)
    setSelectedIds(new Set())
    setActionMenu(null)
    setExportOpen(false)
    setBulkOpen(false)
    toast.update('Pending approvals refreshed')
  }
  const downloadExcel = async () => {
    setExportOpen(false)
    const ok = await exportExcel('pending-approvals', exportRows)
    if (ok) toast.success('Excel export ready')
    else toast.error('Could not export pending approvals')
  }
  const downloadCsv = async () => {
    setExportOpen(false)
    const ok = await exportCsv('pending-approvals', exportRows)
    if (ok) toast.success('CSV export ready')
    else toast.error('Could not export pending approvals')
  }

  const heading = (label: string, key: SortKey) => (
    <th className="px-3 py-3 text-left dark:bg-[#374151] dark:text-white" key={key}>
      <button type="button" onClick={() => sortBy(key)} className="flex w-full items-center justify-between gap-2 text-left font-bold">
        <span>{label}</span><ArrowUpDown className={`size-4 shrink-0 ${sortKey === key ? 'text-[#375783] dark:text-white' : 'text-slate-400 dark:text-slate-300'}`} />
      </button>
    </th>
  )
  const pauseTarget = pauseDialog ? rows.find((row) => row.id === pauseDialog.id) : null
  const escalationTarget = escalateId ? rows.find((row) => row.id === escalateId) : null
  const actionMenuRow = actionMenu ? rows.find((row) => row.id === actionMenu.id) : null
  const actionMenuCanAct = actionMenuRow ? canActOnRow(actionMenuRow) : false
  const actionMenuApprovalEnabled = actionMenuRow ? isApprovalProcessActiveForRow(actionMenuRow) : false
  const actionMenuStep = actionMenuRow
    ? approvalStepForUser(actionMenuRow, user?.id || '', user?.role || '')
    : null
  const actionMenuCurrentStep = actionMenuRow
    ? actionMenuRow.approvalSteps?.find((step) => step.id === actionMenuRow.currentStepId) || null
    : null
  const actionMenuCurrentRole = actionMenuCurrentStep
    ? app.roles.find((role) => String(role.id) === String(actionMenuCurrentStep.roleId))?.name || String(actionMenuCurrentStep.roleId)
    : ''
  const receiptDetails = details?.voucherSubmission?.kind === 'receipt' ? details.voucherSubmission.record : null
  const paymentDetails = details?.voucherSubmission?.kind === 'payment' ? details.voucherSubmission.record : null
  const journalDetails = details?.voucherSubmission?.kind === 'journal' ? details.voucherSubmission.record : null

  return (
    <div>
      <PageHeader title="Pending Approvals" desc="Review and act on requests awaiting approval." />
      <section className="card min-w-0 overflow-hidden border-t-[3px] border-t-emerald-600 p-0">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <List className="size-5 text-ink dark:text-white" />
          <h2 className="text-lg font-semibold dark:text-white">Pending Approval List</h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select className="w-[100px] bg-white dark:bg-zinc-900" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Rows per page">
              {[5, 10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </Select>
            <div ref={toolbarDropdownRef} className="relative">
              <div className="inline-flex flex-wrap items-center gap-2">
                <Button type="button" variant="lime" onClick={() => { setExportOpen((open) => !open); setBulkOpen(false) }} aria-expanded={exportOpen}>
                  Export <ChevronDown className="size-4" />
                </Button>
                <Button type="button" variant="lime" onClick={() => { setBulkOpen((open) => !open); setExportOpen(false) }} aria-expanded={bulkOpen}>
                  Bulk Actions <ChevronDown className="size-4" />
                </Button>
                <Button type="button" variant="lime" size="icon" onClick={refresh} title="Refresh pending approvals" aria-label="Refresh pending approvals">
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {exportOpen && <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-line bg-white p-1.5 text-ink shadow-xl dark:bg-zinc-900 dark:text-white">
                <button type="button" onClick={() => { void downloadExcel() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><FileSpreadsheet className="size-4" /> Excel (.xlsx)</button>
                <button type="button" onClick={() => { void downloadCsv() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><FileText className="size-4" /> CSV</button>
                <button type="button" onClick={() => { setExportOpen(false); exportPdf() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><Printer className="size-4" /> Print / Save PDF</button>
              </div>}
              {bulkOpen && <div className="absolute left-[112px] top-full z-30 mt-1 w-52 rounded-lg border border-line bg-white p-1.5 text-ink shadow-xl dark:bg-zinc-900 dark:text-white">
                <button type="button" onClick={() => openDecision([...selectedIds], 'Approved', true)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40"><CheckCircle2 className="size-4 text-emerald-600" /> Approve selected</button>
                <button type="button" onClick={() => openDecision([...selectedIds], 'Rejected', true)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-rose-50 dark:hover:bg-rose-950/40"><XCircle className="size-4 text-rose-600" /> Reject selected</button>
              </div>}
            </div>
          </div>
          <div className="w-full lg:w-[250px]">
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="search..." aria-label="Search pending approvals" className="h-10 w-full bg-white placeholder:italic placeholder:text-red-500 dark:bg-zinc-900" />
          </div>
        </div>

        <div className="mx-5 overflow-x-auto border border-line">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <colgroup>
              <col className="w-[50px]" /><col className="w-[168px]" /><col className="w-[145px]" /><col className="w-[205px]" />
              <col className="w-[280px]" /><col className="w-[140px]" /><col className="w-[120px]" /><col className="w-[235px]" /><col className="w-[115px]" />
            </colgroup>
            <thead className="bg-[#bdc8d8] text-[#26374e] dark:bg-[#374151] dark:text-white">
              <tr>
                <th className="px-2 py-2.5 text-center dark:bg-[#374151] dark:text-white"><input type="checkbox" className="size-6" style={{ accentColor: 'var(--btn, #c8f542)' }} checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all visible requests" /></th>
                {heading('Document No.', 'documentNo')}
                {heading('Date', 'date')}
                {heading('Created By', 'createdBy')}
                {heading('Document Type', 'documentType')}
                {heading('Party', 'party')}
                {heading('Amount', 'amount')}
                {heading('Status', 'status')}
                <th className="px-3 py-3 text-left dark:bg-[#374151] dark:text-white"><span className="flex items-center justify-between gap-2 font-bold">Action <ArrowUpDown className="size-4 shrink-0 text-slate-400 dark:text-slate-300" /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50 bg-[#e0e3e9] text-[#202833] dark:divide-black/20 dark:bg-zinc-800 dark:text-white">
              {pageRows.map((row) => {
                const [day, time] = documentDate(row.date)
                const status = statusOf(row, now)
                const difference = slaDifference(row, now)
                const overdue = status === 'Overdue'
                const currentStep = row.approvalSteps?.find((step) => step.id === row.currentStepId) || pendingSteps(row)[0]
                const approvedForStep = currentStep ? (row.stepApprovals?.[currentStep.id]?.length || 0) : 0
                const requiredForStep = currentStep?.approvalMode === 'approve_all' && currentStep.assignedUserIds.length
                  ? currentStep.assignedUserIds.length
                  : currentStep ? 1 : 0
                const currentRoleName = currentStep
                  ? app.roles.find((role) => String(role.id) === String(currentStep.roleId))?.name || String(currentStep.roleId)
                  : ''
                const completeStep = currentStep ? isApprovalStepComplete(row, currentStep) : false
                return (
                  <tr key={row.id} className="hover:bg-[#d8dde5] dark:hover:bg-zinc-700">
                    <td className="px-2 py-3 text-center"><input type="checkbox" className="size-6" style={{ accentColor: 'var(--btn, #c8f542)' }} checked={selectedIds.has(row.id)} onChange={() => toggleSelected(row.id)} aria-label={`Select ${row.documentNo}`} /></td>
                    <td className="px-3 py-2"><button type="button" onClick={() => setDetails(row)} className="btn-lime rounded-md px-3 py-1.5 font-semibold">{row.documentNo}</button></td>
                    <td className="px-3 py-2 leading-6"><span className="block">{day}</span><span className="block">{time}</span></td>
                    <td className="px-3 py-2">{row.createdBy}</td>
                    <td className="px-3 py-2">
                      <span>{approvalDocumentTypeLabel(row.documentType)}</span>
                      {currentStep && <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        Level {currentStep.level} · {currentStep.stepName} · {currentRoleName}
                        <span className="ml-1 font-medium">({completeStep ? 'Complete' : `${approvedForStep}/${requiredForStep} approved`})</span>
                      </div>}
                    </td>
                    <td className="px-3 py-2">{row.party}</td>
                    <td className="px-3 py-2 tabular-nums">{String(row.amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold text-white ${status === 'Overdue' ? 'bg-[#e33450]' : status === 'Paused' ? 'bg-amber-400 text-black' : 'bg-emerald-600'}`}>
                          {status === 'Paused' ? <Pause className="size-3.5" /> : status === 'Running' ? <Play className="size-3.5" /> : <Clock3 className="size-3.5" />} {status}
                        </span>
                        <span className={`rounded-md px-2 py-1 text-[11px] font-bold tabular-nums ${status === 'Overdue' ? 'bg-[#202a36] text-white' : status === 'Paused' ? 'bg-zinc-600 text-white' : 'bg-white text-[#334155] dark:bg-zinc-700 dark:text-white'}`}>
                          {formatDuration(difference)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        ref={(element) => { if (element) actionButtonRefs.current.set(row.id, element); else actionButtonRefs.current.delete(row.id) }}
                        type="button"
                        onClick={(event) => toggleActionMenu(row.id, event, overdue)}
                        className="btn-lime inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm"
                        aria-expanded={actionMenu?.id === row.id}
                        aria-haspopup="menu"
                        aria-label={`Actions for ${row.documentNo}`}
                      >
                        Action <ChevronDown className="size-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!pageRows.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-mist">{emptyStateMessage}</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-mist">Showing {firstEntry} to {lastEntry} of {filteredRows.length} entries</p>
          <div className="inline-flex items-center self-start overflow-hidden rounded-lg border border-[#a9aaad] dark:border-zinc-700 sm:self-auto">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={activePage <= 1} className="grid size-10 place-items-center bg-[#e7e9ec] text-[#425166] hover:bg-[#d9dde2] disabled:opacity-45 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600" aria-label="Previous page"><ChevronLeft className="size-5" /></button>
            <span className="grid h-10 min-w-10 place-items-center px-3 text-sm font-semibold" style={{ backgroundColor: 'var(--btn, #c8f542)', color: 'var(--btn-ink, #132000)' }} aria-current="page">{activePage}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={activePage >= pageCount} className="grid size-10 place-items-center bg-[#e7e9ec] text-[#425166] hover:bg-[#d9dde2] disabled:opacity-45 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:disabled:bg-zinc-900 dark:disabled:text-zinc-600" aria-label="Next page"><ChevronRight className="size-5" /></button>
          </div>
        </div>
      </section>

      {actionMenu && actionMenuRow && createPortal(
        <div
          ref={actionMenuRef}
          role="menu"
          aria-label={`Actions for ${actionMenuRow.documentNo}`}
          style={{ top: actionMenu.top, left: actionMenu.left }}
          className="fixed z-[9999] min-w-44 rounded-lg border border-line bg-white p-1.5 text-ink shadow-xl dark:bg-zinc-900 dark:text-white"
        >
          <button type="button" role="menuitem" onClick={() => { setDetails(actionMenuRow); setActionMenu(null) }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><Eye className="size-4" /> View</button>
          {statusOf(actionMenuRow, now) === 'Overdue' ? (
            actionMenuApprovalEnabled && actionMenuCanAct
              ? <button type="button" role="menuitem" onClick={() => openEscalation(actionMenuRow)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"><TriangleAlert className="size-4" /> Escalate</button>
              : <p className="px-3 py-2 text-xs text-slate-500">{!actionMenuApprovalEnabled ? approvalActionBlockedReason(actionMenuRow) : actionMenuCurrentRole ? `Waiting for ${actionMenuCurrentRole}.` : 'Waiting for the assigned approver.'}</p>
          ) : actionMenuCanAct ? <>
            <button type="button" role="menuitem" onClick={() => openDecision([actionMenuRow.id], 'Approved')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/40"><CheckCircle2 className="size-4 text-emerald-600" /> Approve{actionMenuStep ? ` · Level ${actionMenuStep.level}` : ''}</button>
            <button type="button" role="menuitem" onClick={() => openDecision([actionMenuRow.id], 'Rejected')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-rose-50 dark:hover:bg-rose-950/40"><XCircle className="size-4 text-rose-600" /> Reject</button>
            <div className="my-1 border-t border-line" />
            {actionMenuRow.isPaused
              ? <button type="button" role="menuitem" onClick={() => openPauseDialog(actionMenuRow.id, 'resume')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><Play className="size-4 text-emerald-600" /> Resume SLA</button>
              : <button type="button" role="menuitem" onClick={() => openPauseDialog(actionMenuRow.id, 'pause')} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><Pause className="size-4 text-amber-600" /> Pause SLA</button>}
          </> : <p className="px-3 py-2 text-xs text-slate-500">{!actionMenuApprovalEnabled ? approvalActionBlockedReason(actionMenuRow) : actionMenuCurrentRole ? `Waiting for ${actionMenuCurrentRole}.` : 'Waiting for the assigned approver.'}</p>}
        </div>,
        document.body,
      )}

      <Modal open={!!details} onClose={() => setDetails(null)} title={details ? `Approval Request · ${details.documentNo}` : 'Approval Request'} size="md">
        {details && <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs text-mist">Document Type</p><p className="mt-1 font-semibold">{approvalDocumentTypeLabel(details.documentType)}</p></div>
          <div><p className="text-xs text-mist">SLA Status</p><p className="mt-1 font-semibold">{statusOf(details, now)}</p></div>
          {details.voucherSubmission && <div><p className="text-xs text-mist">Voucher Status</p><p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">Draft · awaits final approval</p></div>}
          <div><p className="text-xs text-mist">Submitted</p><p className="mt-1 font-semibold">{details.date.replace('T', ' ')}</p></div>
          <div><p className="text-xs text-mist">Party</p><p className="mt-1 font-semibold">{details.party}</p></div>
          <div><p className="text-xs text-mist">Amount</p><p className="mt-1 font-semibold">{String(details.amount)}</p></div>
          <div><p className="text-xs text-mist">Approval Level</p><p className="mt-1 font-semibold">{details.currentLevel}</p></div>
          <div><p className="text-xs text-mist">Workflow</p><p className="mt-1 font-semibold">{workflowName(details.workflowId)}</p></div>
          <div><p className="text-xs text-mist">SLA Due</p><p className="mt-1 font-semibold">{new Date(details.slaDueAt).toLocaleString()}</p></div>
          {details.isPaused && <div className="sm:col-span-2"><p className="text-xs text-mist">Pause reason</p><p className="mt-1 font-semibold">{details.pauseReason || '—'}</p></div>}
        </div>}
        {details?.approvalSteps?.length ? <section className="mt-5 rounded-lg border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">Configured approval chain</h3>
          <ol className="space-y-2">
            {details.approvalSteps.slice().sort((a, b) => a.level - b.level).map((step) => {
              const approvedBy = details.stepApprovals?.[step.id] || []
              const complete = isApprovalStepComplete(details, step)
              const isCurrent = details.currentStepId === step.id
              const stepRole = app.roles.find((role) => String(role.id) === String(step.roleId))?.name || String(step.roleId)
              return <li key={step.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${isCurrent ? 'bg-emerald-50 ring-1 ring-emerald-400 dark:bg-emerald-950/30' : 'bg-black/[0.03] dark:bg-white/[0.04]'}`}>
                <div><span className="font-semibold">Level {step.level} · {step.stepName}</span><span className="ml-2 text-slate-500 dark:text-mist">{stepRole}</span></div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${complete ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : isCurrent ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-slate-200'}`}>
                  {complete ? 'Approved' : isCurrent ? 'Current step' : 'Waiting'}{step.approvalMode === 'approve_all' ? ` · ${approvedBy.length}/${Math.max(1, step.assignedUserIds.length)}` : ''}
                </span>
              </li>
            })}
          </ol>
        </section> : null}
        {receiptDetails && <section className="mt-5 rounded-lg border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">Receipt Voucher Details</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-mist">Received from: </span>{receiptDetails.receivedFrom}</p>
            <p><span className="text-mist">Deposit account: </span>{app.accounts.find((account) => account.id === receiptDetails.depositAccountId)?.name || receiptDetails.depositAccountId}</p>
            <p><span className="text-mist">Method: </span>{receiptDetails.method}</p>
            <p><span className="text-mist">Reference: </span>{receiptDetails.referenceNo || '—'}</p>
          </div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">Account</th><th className="py-2 pr-3">Narration</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>
            {receiptDetails.lines.map((line, index) => <tr key={`${line.accountId}-${index}`} className="border-b border-line/60"><td className="py-2 pr-3">{app.accounts.find((account) => account.id === line.accountId)?.name || line.accountId}</td><td className="py-2 pr-3">{line.narration || '—'}</td><td className="py-2 text-right">{line.amount}</td></tr>)}
          </tbody></table></div>
        </section>}
        {paymentDetails && <section className="mt-5 rounded-lg border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">Payment Voucher Details</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-mist">Paid to: </span>{paymentDetails.paidTo}</p>
            <p><span className="text-mist">Payment account: </span>{app.accounts.find((account) => account.id === paymentDetails.paymentAccountId)?.name || paymentDetails.paymentAccountId}</p>
            <p><span className="text-mist">Method: </span>{paymentDetails.method}</p>
            <p><span className="text-mist">Reference: </span>{paymentDetails.referenceNo || '—'}</p>
          </div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">Account</th><th className="py-2 pr-3">Narration</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>
            {paymentDetails.lines.map((line, index) => <tr key={`${line.accountId}-${index}`} className="border-b border-line/60"><td className="py-2 pr-3">{app.accounts.find((account) => account.id === line.accountId)?.name || line.accountId}</td><td className="py-2 pr-3">{line.narration || '—'}</td><td className="py-2 text-right">{line.amount}</td></tr>)}
          </tbody></table></div>
        </section>}
        {journalDetails && <section className="mt-5 rounded-lg border border-line p-4">
          <h3 className="mb-3 text-sm font-semibold">Journal Voucher Details</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="sm:col-span-2"><span className="text-mist">Description: </span>{journalDetails.description}</p>
            {journalDetails.stakeholder && <p><span className="text-mist">Stakeholder: </span>{journalDetails.stakeholder}</p>}
            <p><span className="text-mist">Currency: </span>{journalDetails.currency || 'GHS'}</p>
          </div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left"><th className="py-2 pr-3">Account</th><th className="py-2 text-right">Debit</th><th className="py-2 text-right">Credit</th></tr></thead><tbody>
            {journalDetails.lines.map((line, index) => <tr key={`${line.accountId}-${index}`} className="border-b border-line/60"><td className="py-2 pr-3">{app.accounts.find((account) => account.id === line.accountId)?.name || line.accountId}</td><td className="py-2 text-right">{line.debit}</td><td className="py-2 text-right">{line.credit}</td></tr>)}
          </tbody></table></div>
        </section>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDetails(null)}>Close</Button>
        </div>
      </Modal>

      <Modal
        open={!!decisionDialog}
        onClose={() => { setDecisionDialog(null); setDecisionError('') }}
        title={decisionDialog ? `${decisionDialog.bulk ? 'Bulk ' : ''}${decisionDialog.decision}` : 'Approval action'}
        variant="perfex"
        size="sm"
        headerClassName="bg-[#337ab7]"
        footer={<>
          <Button type="button" variant="outline" onClick={() => { setDecisionDialog(null); setDecisionError('') }}>Close</Button>
          <Button type="button" variant={decisionDialog?.decision === 'Rejected' ? 'danger' : 'lime'} onClick={submitDecision}>Confirm</Button>
        </>}
      >
        {decisionDialog?.decision === 'Rejected' ? <div>
          <label htmlFor="approval-reject-comments" className="mb-1.5 block text-sm font-medium">Comments <span className="text-rose-600">*</span></label>
          <Textarea id="approval-reject-comments" value={decisionComments} onChange={(event) => { setDecisionComments(event.target.value); setDecisionError('') }} placeholder="Please provide comments" rows={3} maxLength={255} className="focus:border-orange-400 focus:ring-orange-400/40" />
          {decisionError && <p className="mt-1 text-xs font-medium text-rose-600">{decisionError}</p>}
        </div> : <p className="text-sm leading-relaxed text-emerald-700 dark:text-emerald-300">
          {decisionDialog?.bulk
            ? `You are about to approve ${selectedDetails.length} selected request${selectedDetails.length === 1 ? '' : 's'}. Continue?`
            : 'This request will be approved and removed from your pending list. Continue?'}
        </p>}
      </Modal>

      <Modal
        open={!!pauseDialog}
        onClose={() => { setPauseDialog(null); setPauseError('') }}
        title={pauseDialog?.mode === 'pause' ? 'Pause SLA' : 'Resume SLA'}
        variant="perfex"
        size="sm"
        headerClassName="bg-[#337ab7]"
        footer={<>
          <Button type="button" variant="outline" onClick={() => { setPauseDialog(null); setPauseError('') }}>Close</Button>
          <Button type="button" variant="lime" onClick={submitPauseDialog}>Confirm</Button>
        </>}
      >
        {pauseDialog?.mode === 'pause' ? <div>
          <label htmlFor="approval-pause-reason" className="mb-1.5 block text-sm font-medium">Reason for pause <span className="text-rose-600">*</span></label>
          <Textarea id="approval-pause-reason" value={pauseReason} onChange={(event) => { setPauseReason(event.target.value); setPauseError('') }} placeholder="Please provide a reason" rows={3} maxLength={255} className="focus:border-orange-400 focus:ring-orange-400/40" />
          {pauseError && <p className="mt-1 text-xs font-medium text-rose-600">{pauseError}</p>}
        </div> : <p className="text-sm leading-relaxed">Resume the approval SLA timer for {pauseTarget?.documentNo || 'this request'}?</p>}
      </Modal>

      <Modal
        open={!!escalateId}
        onClose={() => { setEscalateId(null); setEscalateError('') }}
        title="Escalate Request"
        variant="perfex"
        size="sm"
        headerClassName="bg-[#337ab7]"
        footer={<>
          <Button type="button" variant="outline" onClick={() => { setEscalateId(null); setEscalateError('') }}>Close</Button>
          <Button type="button" variant="lime" onClick={submitEscalation}>Escalate</Button>
        </>}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="approval-escalate-role" className="mb-1.5 block text-sm font-medium">Escalate to <span className="text-rose-600">*</span></label>
            <Select id="approval-escalate-role" value={escalateRoleId} onChange={(event) => { setEscalateRoleId(event.target.value); setEscalateError('') }}>
              <option value="">Please Select</option>
              {escalationRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </Select>
          </div>
          <div>
            <label htmlFor="approval-escalate-reason" className="mb-1.5 block text-sm font-medium">Reason <span className="text-rose-600">*</span></label>
            <Textarea id="approval-escalate-reason" value={escalateReason} onChange={(event) => { setEscalateReason(event.target.value); setEscalateError('') }} placeholder="Please provide a reason" rows={3} maxLength={255} />
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">This overdue request will be reassigned to the selected role.</p>
          {escalateError && <p className="text-xs font-medium text-rose-600">{escalateError}</p>}
          <p className="sr-only">Request: {escalationTarget?.documentNo || ''}</p>
        </div>
      </Modal>
    </div>
  )
}
