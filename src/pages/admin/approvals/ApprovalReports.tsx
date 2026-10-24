import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, BarChart3, CalendarDays, CheckCircle2, Clock3, FileSpreadsheet,
  FileText, RefreshCw, Search, ShieldCheck, TriangleAlert, Users, XCircle, Zap,
} from 'lucide-react'
import { Button, Input, PageHeader, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import {
  approvalHistoryActionLabel,
  isFinalApprovalHistoryDecision,
  loadApprovalHistory,
  type ApprovalHistoryEntry,
  type ApprovalHistoryStatus,
} from '../../../lib/approvalHistory'
import {
  approvalSlaStatus,
  loadPendingApprovals,
  type PendingApprovalRow,
  type PendingApprovalSlaStatus,
} from '../../../lib/approvalQueue'
import {
  approvalDocumentTypeLabel,
  loadApprovalData,
  loadApprovalDocTypes,
  type ApprovalDocType,
  type ApprovalWorkflow,
} from '../../../lib/approvals'
import { exportCsv, exportExcel, type ExportRow } from '../../../lib/export'

const HISTORY_STATUSES: ApprovalHistoryStatus[] = ['Approved', 'Rejected', 'Escalated', 'Auto-approved']
type RangePreset = '7d' | '30d' | '90d' | 'all' | 'custom'
type ReportStatus = 'all' | ApprovalHistoryStatus

type RangeBounds = { start: number | null; end: number | null; isAll: boolean }
type DecisionTone = { label: ApprovalHistoryStatus; className: string; color: string }

const DECISION_TONES: DecisionTone[] = [
  { label: 'Approved', className: 'bg-emerald-500', color: '#10b981' },
  { label: 'Auto-approved', className: 'bg-sky-500', color: '#0ea5e9' },
  { label: 'Rejected', className: 'bg-rose-500', color: '#f43f5e' },
  { label: 'Escalated', className: 'bg-amber-400', color: '#fbbf24' },
]

function localDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function offsetLocalDate(value: string, offset: number): string {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + offset)
  return localDateKey(date)
}

function parseTime(value?: string | null): number | null {
  if (!value) return null
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function actionTime(entry: ApprovalHistoryEntry): number | null {
  if (entry.actionTimeUnknown) return null
  return parseTime(entry.completedAt) ?? parseTime(entry.date)
}

function turnaroundMs(entry: ApprovalHistoryEntry): number | null {
  if (entry.actionTimeUnknown) return null
  const started = parseTime(entry.date)
  const ended = parseTime(entry.completedAt)
  if (started === null || ended === null || ended < started) return null
  return ended - started
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const totalMinutes = Math.max(0, Math.round(value / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatDateTime(value?: string | null): string {
  const parsed = parseTime(value)
  return parsed === null ? '—' : new Date(parsed).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function buildRangeBounds(preset: RangePreset, from: string, to: string, now: number): RangeBounds {
  if (preset === 'all') return { start: null, end: null, isAll: true }
  if (preset === 'custom') {
    const start = from ? parseTime(`${from}T00:00:00`) : null
    const end = to ? parseTime(`${to}T23:59:59.999`) : null
    return { start, end, isAll: false }
  }
  const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - days + 1)
  return { start: start.getTime(), end: now, isAll: false }
}

function withinRange(value: string | null | undefined, range: RangeBounds): boolean {
  const timestamp = parseTime(value)
  if (timestamp === null) return range.isAll
  return (range.start === null || timestamp >= range.start) && (range.end === null || timestamp <= range.end)
}

function statusTone(status: ApprovalHistoryStatus): string {
  if (status === 'Approved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (status === 'Auto-approved') return 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300'
  if (status === 'Rejected') return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
  return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
}

function slaTone(status: PendingApprovalSlaStatus): string {
  if (status === 'Overdue') return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
  if (status === 'Paused') return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
}

function formatAmount(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`
}

function amountForCurrency(company: { currencySymbol?: string; currency?: string } | null | undefined): string {
  return company?.currencySymbol || company?.currency || 'GHS'
}

function averageTurnaround(entries: ApprovalHistoryEntry[]): number | null {
  const values = entries.map(turnaroundMs).filter((value): value is number => value !== null)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function MonthTrend({ entries, endDate }: { entries: ApprovalHistoryEntry[]; endDate: Date }) {
  const buckets = useMemo(() => {
    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(lastMonth.getFullYear(), lastMonth.getMonth() - (5 - index), 1)
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        counts: Object.fromEntries(HISTORY_STATUSES.map((status) => [status, 0])) as Record<ApprovalHistoryStatus, number>,
      }
    })
    const indexByKey = new Map(months.map((month, index) => [month.key, index]))
    for (const entry of entries) {
      const time = actionTime(entry)
      if (time === null) continue
      const date = new Date(time)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const index = indexByKey.get(key)
      if (index !== undefined) months[index].counts[entry.status] += 1
    }
    return months.map((month) => ({ ...month, total: Object.values(month.counts).reduce((sum, value) => sum + value, 0) }))
  }, [entries, endDate])
  const maxTotal = Math.max(1, ...buckets.map((bucket) => bucket.total))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {DECISION_TONES.map((tone) => <span key={tone.label} className="inline-flex items-center gap-1.5 text-xs text-mist"><span className={`size-2.5 rounded-sm ${tone.className}`} />{tone.label}</span>)}
      </div>
      <div className="space-y-3">
        {buckets.map((bucket) => (
          <div key={bucket.key} className="grid grid-cols-[58px_minmax(0,1fr)_28px] items-center gap-3">
            <span className="text-xs font-medium text-mist">{bucket.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" role="img" aria-label={`${bucket.label}: ${bucket.total} approval actions`}>
              <div className="flex h-full min-w-0 overflow-hidden rounded-full">
                {DECISION_TONES.map((tone) => {
                  const count = bucket.counts[tone.label]
                  const width = bucket.total ? `${(count / maxTotal) * 100}%` : '0%'
                  return count ? <span key={tone.label} className={`h-full ${tone.className}`} style={{ width }} title={`${tone.label}: ${count}`} /> : null
                })}
              </div>
            </div>
            <span className="text-right text-xs font-semibold tabular-nums">{bucket.total}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-mist">Counts reflect the active filters; only the latest six calendar months are shown.</p>
    </div>
  )
}

function KpiCard({
  label, value, hint, icon, tone = 'sky',
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
  tone?: 'sky' | 'emerald' | 'amber' | 'rose'
}) {
  const iconTone = {
    sky: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  }[tone]
  return (
    <article className="card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-mist">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-mist">{hint}</p>
    </article>
  )
}

function Panel({ title, subtitle, icon, children, className = '' }: {
  title: string
  subtitle?: string
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`card min-w-0 overflow-hidden ${className}`}>
      <div className="flex items-start gap-3 border-b border-line px-4 py-4 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-mist">{subtitle}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

function groupEntries<T>(entries: T[], keyFor: (entry: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const key = keyFor(entry) || '—'
    const group = groups.get(key) || []
    group.push(entry)
    groups.set(key, group)
  }
  return groups
}

export function ApprovalReportsPage() {
  const app = useApp()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const companyName = app.activeCompany?.name || 'Current company'
  const currency = amountForCurrency(app.activeCompany)
  const today = localDateKey(new Date())
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>(() => loadApprovalHistory(companyId))
  const [pendingRows, setPendingRows] = useState<PendingApprovalRow[]>(() => loadPendingApprovals(companyId))
  const [workflows, setWorkflows] = useState<ApprovalWorkflow[]>(() => loadApprovalData(companyId).workflows)
  const [documentTypes, setDocumentTypes] = useState<ApprovalDocType[]>(() => loadApprovalDocTypes())
  const [rangePreset, setRangePreset] = useState<RangePreset>('30d')
  const [customFrom, setCustomFrom] = useState(() => offsetLocalDate(today, -29))
  const [customTo, setCustomTo] = useState(today)
  const [statusFilter, setStatusFilter] = useState<ReportStatus>('all')
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all')
  const [workflowFilter, setWorkflowFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null)

  const refresh = useCallback(() => {
    setHistory(loadApprovalHistory(companyId))
    setPendingRows(loadPendingApprovals(companyId))
    setWorkflows(loadApprovalData(companyId).workflows)
    setDocumentTypes(loadApprovalDocTypes())
    setNow(Date.now())
  }, [companyId])

  useEffect(() => {
    refresh()
    window.addEventListener('approval-history-updated', refresh)
    window.addEventListener('approval-pending-updated', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('approval-history-updated', refresh)
      window.removeEventListener('approval-pending-updated', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [refresh])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const rangeBounds = useMemo(() => buildRangeBounds(rangePreset, customFrom, customTo, now), [rangePreset, customFrom, customTo, now])
  const workflowMap = useMemo(() => new Map(workflows.filter((workflow) => workflow.companyId === companyId).map((workflow) => [workflow.id, workflow])), [workflows, companyId])
  const workflowLabel = useCallback((id: string) => workflowMap.get(id)?.title || id || 'Unassigned workflow', [workflowMap])
  const typeLabel = useCallback((code: string) => approvalDocumentTypeLabel(code), [])
  const searchTerm = query.trim().toLowerCase()

  const filteredHistory = useMemo(() => history.filter((entry) => {
    const date = entry.actionTimeUnknown ? null : entry.completedAt || entry.date
    if (!withinRange(date, rangeBounds)) return false
    if (statusFilter !== 'all' && entry.status !== statusFilter) return false
    if (documentTypeFilter !== 'all' && entry.documentType !== documentTypeFilter) return false
    if (workflowFilter !== 'all' && entry.workflowId !== workflowFilter) return false
    if (searchTerm) {
      const haystack = [
        entry.documentNo, entry.date, entry.completedAt, entry.createdBy, entry.actionBy,
        entry.documentType, typeLabel(entry.documentType), entry.party, String(entry.amount),
        entry.status, entry.comments || '', entry.assignedRole || '', workflowLabel(entry.workflowId),
      ].join(' ').toLowerCase()
      if (!haystack.includes(searchTerm)) return false
    }
    return true
  }), [history, rangeBounds, statusFilter, documentTypeFilter, workflowFilter, searchTerm, typeLabel, workflowLabel])

  const filteredPending = useMemo(() => pendingRows.filter((row) => {
    if (documentTypeFilter !== 'all' && row.documentType !== documentTypeFilter) return false
    if (workflowFilter !== 'all' && row.workflowId !== workflowFilter) return false
    if (!searchTerm) return true
    const haystack = [row.documentNo, row.date, row.createdBy, row.documentType, typeLabel(row.documentType), row.party,
      row.workflowId, workflowLabel(row.workflowId), approvalSlaStatus(row, now)].join(' ').toLowerCase()
    return haystack.includes(searchTerm)
  }), [pendingRows, documentTypeFilter, workflowFilter, searchTerm, typeLabel, workflowLabel, now])

  const statusCounts = useMemo(() => Object.fromEntries(HISTORY_STATUSES.map((status) => [
    status, filteredHistory.filter((entry) => entry.status === status).length,
  ])) as Record<ApprovalHistoryStatus, number>, [filteredHistory])
  const finalHistory = useMemo(() => filteredHistory.filter(isFinalApprovalHistoryDecision), [filteredHistory])
  const finalStatusCounts = useMemo(() => Object.fromEntries(HISTORY_STATUSES.map((status) => [
    status, finalHistory.filter((entry) => entry.status === status).length,
  ])) as Record<ApprovalHistoryStatus, number>, [finalHistory])
  const finalDecisions = finalStatusCounts.Approved + finalStatusCounts['Auto-approved'] + finalStatusCounts.Rejected
  const acceptedDecisions = finalStatusCounts.Approved + finalStatusCounts['Auto-approved']
  const approvalRate = finalDecisions ? Math.round((acceptedDecisions / finalDecisions) * 100) : null
  const averageActionTime = useMemo(() => averageTurnaround(filteredHistory), [filteredHistory])
  const overdueCount = filteredPending.filter((row) => approvalSlaStatus(row, now) === 'Overdue').length
  const pausedCount = filteredPending.filter((row) => approvalSlaStatus(row, now) === 'Paused').length
  const pendingAmount = filteredPending.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0)
  const approvedAmount = finalHistory.filter((entry) => entry.status === 'Approved' || entry.status === 'Auto-approved')
    .reduce((sum, entry) => sum + (Number.isFinite(entry.amount) ? entry.amount : 0), 0)

  const rangeEndDate = useMemo(() => {
    if (rangePreset === 'custom' && customTo) {
      const date = new Date(`${customTo}T12:00:00`)
      if (!Number.isNaN(date.getTime())) return date
    }
    return new Date(now)
  }, [rangePreset, customTo, now])

  const typeLabels = useMemo(() => {
    const codes = new Set([
      ...documentTypes.map((item) => item.documentType),
      ...history.map((entry) => entry.documentType),
      ...pendingRows.map((row) => row.documentType),
    ].filter(Boolean))
    return [...codes].sort((a, b) => typeLabel(a).localeCompare(typeLabel(b)))
  }, [documentTypes, history, pendingRows, typeLabel])

  const workflowOptions = useMemo(() => {
    const ids = new Set([
      ...workflows.filter((workflow) => workflow.companyId === companyId).map((workflow) => workflow.id),
      ...history.map((entry) => entry.workflowId),
      ...pendingRows.map((row) => row.workflowId),
    ].filter(Boolean))
    return [...ids].sort((a, b) => workflowLabel(a).localeCompare(workflowLabel(b)))
  }, [workflows, companyId, history, pendingRows, workflowLabel])

  const typeBreakdown = useMemo(() => {
    const groups = groupEntries(filteredHistory, (entry) => entry.documentType || 'Unspecified')
    return [...groups.entries()].map(([code, entries]) => ({
      code,
      label: typeLabel(code),
      total: entries.length,
      approved: entries.filter((entry) => entry.status === 'Approved' || entry.status === 'Auto-approved').length,
      rejected: entries.filter((entry) => entry.status === 'Rejected').length,
      escalated: entries.filter((entry) => entry.status === 'Escalated').length,
    })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, 6)
  }, [filteredHistory, typeLabel])

  const actorBreakdown = useMemo(() => {
    const groups = groupEntries(filteredHistory, (entry) => entry.actionBy || 'Unspecified')
    return [...groups.entries()].map(([actor, entries]) => ({
      actor,
      total: entries.length,
      approved: entries.filter((entry) => entry.status === 'Approved' || entry.status === 'Auto-approved').length,
      rejected: entries.filter((entry) => entry.status === 'Rejected').length,
      escalated: entries.filter((entry) => entry.status === 'Escalated').length,
    })).sort((a, b) => b.total - a.total || a.actor.localeCompare(b.actor)).slice(0, 6)
  }, [filteredHistory])

  const workflowBreakdown = useMemo(() => {
    const groups = groupEntries(filteredHistory, (entry) => entry.workflowId || 'unassigned')
    const pendingGroups = groupEntries(filteredPending, (row) => row.workflowId || 'unassigned')
    const ids = new Set([
      ...workflows.filter((workflow) => workflow.companyId === companyId).map((workflow) => workflow.id),
      ...groups.keys(), ...pendingGroups.keys(),
    ])
    return [...ids].map((id) => {
      const entries = groups.get(id) || []
      const finalEntries = entries.filter(isFinalApprovalHistoryDecision)
      const currentPending = pendingGroups.get(id) || []
      const approved = finalEntries.filter((entry) => entry.status === 'Approved' || entry.status === 'Auto-approved').length
      const rejected = finalEntries.filter((entry) => entry.status === 'Rejected').length
      const finalCount = approved + rejected
      return {
        id,
        label: workflowLabel(id),
        total: entries.length,
        pending: currentPending.length,
        approved,
        rejected,
        escalated: entries.filter((entry) => entry.status === 'Escalated').length,
        approvalRate: finalCount ? Math.round((approved / finalCount) * 100) : null,
        averageTime: averageTurnaround(entries),
      }
    }).filter((item) => workflowFilter === 'all' || item.id === workflowFilter)
      .sort((a, b) => (b.total + b.pending) - (a.total + a.pending) || a.label.localeCompare(b.label))
  }, [filteredHistory, filteredPending, workflows, companyId, workflowFilter, workflowLabel])

  const recentHistory = filteredHistory.slice().sort((a, b) => (actionTime(b) || 0) - (actionTime(a) || 0)).slice(0, 8)
  const urgentPending = filteredPending.slice().sort((a, b) => {
    const priority = (status: PendingApprovalSlaStatus) => status === 'Overdue' ? 0 : status === 'Paused' ? 1 : 2
    return priority(approvalSlaStatus(a, now)) - priority(approvalSlaStatus(b, now)) || (parseTime(a.slaDueAt) || Infinity) - (parseTime(b.slaDueAt) || Infinity)
  }).slice(0, 8)

  const reportExportRows: ExportRow[] = [
    ...filteredHistory.map((entry) => ({
      'Record Type': 'Approval action',
      'Document No.': entry.documentNo,
      'Submitted At': entry.date,
      'Action At': entry.completedAt,
      'Document Type': typeLabel(entry.documentType),
      Workflow: workflowLabel(entry.workflowId),
      Party: entry.party,
      Amount: entry.amount,
      Status: approvalHistoryActionLabel(entry),
      'Request State': entry.requestState || (entry.status === 'Escalated' ? 'Escalated' : 'Completed'),
      'Approval Level': entry.currentLevel,
      'Approval Step': entry.stepName || '',
      'Action By': entry.actionBy,
      'Created By': entry.createdBy,
      'Time to Action': formatDuration(turnaroundMs(entry)),
      Comments: entry.comments || '',
      'Assigned Role': entry.assignedRole || '',
    })),
    ...filteredPending.map((row) => ({
      'Record Type': 'Pending request',
      'Document No.': row.documentNo,
      'Submitted At': row.date,
      'Action At': '',
      'Document Type': typeLabel(row.documentType),
      Workflow: workflowLabel(row.workflowId),
      Party: row.party,
      Amount: row.amount,
      Status: approvalSlaStatus(row, now),
      'Action By': '',
      'Created By': row.createdBy,
      'Time to Action': '',
      Comments: row.pauseReason || '',
      'Assigned Role': '',
    })),
  ]

  const resetFilters = () => {
    setRangePreset('30d')
    setCustomFrom(offsetLocalDate(today, -29))
    setCustomTo(today)
    setStatusFilter('all')
    setDocumentTypeFilter('all')
    setWorkflowFilter('all')
    setQuery('')
  }

  const handleRefresh = () => {
    refresh()
    toast.update('Approval reports refreshed')
  }

  const download = async (type: 'csv' | 'xlsx') => {
    if (!reportExportRows.length) return
    setExporting(type)
    const ok = type === 'csv'
      ? await exportCsv('approval-report', reportExportRows)
      : await exportExcel('approval-report', reportExportRows)
    setExporting(null)
    if (ok) toast.success(type === 'csv' ? 'Approval report CSV ready' : 'Approval report Excel ready')
    else toast.error('Could not export the approval report')
  }

  const decisionsMax = Math.max(1, ...HISTORY_STATUSES.map((status) => statusCounts[status]))
  const chartRows = [
    { label: 'Approved', value: statusCounts.Approved, color: 'bg-emerald-500', icon: <CheckCircle2 className="size-4 text-emerald-600" /> },
    { label: 'Auto-approved', value: statusCounts['Auto-approved'], color: 'bg-sky-500', icon: <Zap className="size-4 text-sky-600" /> },
    { label: 'Rejected', value: statusCounts.Rejected, color: 'bg-rose-500', icon: <XCircle className="size-4 text-rose-600" /> },
    { label: 'Escalated', value: statusCounts.Escalated, color: 'bg-amber-400', icon: <TriangleAlert className="size-4 text-amber-600" /> },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Approvals"
        title="Approval Reports"
        desc="Monitor approval outcomes, turnaround and the current request queue."
        actions={(
          <>
            <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-xs font-semibold text-mist"><ShieldCheck className="size-4" />{companyName} · Company-wide</span>
            <Button variant="outline" onClick={handleRefresh}><RefreshCw className="size-4" />Refresh</Button>
            <Button variant="outline" disabled={!reportExportRows.length || exporting !== null} onClick={() => { void download('csv') }}><FileText className="size-4" />{exporting === 'csv' ? 'Preparing…' : 'Export CSV'}</Button>
            <Button disabled={!reportExportRows.length || exporting !== null} onClick={() => { void download('xlsx') }}><FileSpreadsheet className="size-4" />{exporting === 'xlsx' ? 'Preparing…' : 'Export Excel'}</Button>
          </>
        )}
      />

      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs leading-relaxed text-mist">
        Report scope: recorded approval actions (including in-progress step decisions) and pending items for the selected company. This build reads the Approval module’s browser-stored data; a live reporting API is not connected.
      </div>

      <section className="card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><CalendarDays className="size-4 text-sky-600" /><h2 className="text-sm font-semibold">Report filters</h2></div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="grid gap-1.5 text-xs font-medium text-mist">
            Date range
            <Select value={rangePreset} onChange={(event) => setRangePreset(event.target.value as RangePreset)} aria-label="Date range">
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom range</option>
            </Select>
          </label>
          {rangePreset === 'custom' && <>
            <label className="grid gap-1.5 text-xs font-medium text-mist">From<Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium text-mist">To<Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
          </>}
          <label className="grid gap-1.5 text-xs font-medium text-mist">
            Decision
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ReportStatus)} aria-label="Decision status">
              <option value="all">All decisions</option>
              {HISTORY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-mist">
            Document type
            <Select value={documentTypeFilter} onChange={(event) => setDocumentTypeFilter(event.target.value)} aria-label="Document type">
              <option value="all">All document types</option>
              {typeLabels.map((code) => <option key={code} value={code}>{typeLabel(code)}</option>)}
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-mist">
            Workflow
            <Select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} aria-label="Workflow">
              <option value="all">All workflows</option>
              {workflowOptions.map((id) => <option key={id} value={id}>{workflowLabel(id)}</option>)}
            </Select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.5fr)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents, people, workflows or comments" aria-label="Search approval report records" className="pl-9" />
          </label>
          <div className="flex items-center justify-start gap-2 text-xs text-mist sm:justify-end"><Activity className="size-4" /><span>{filteredHistory.length} recorded actions · {filteredPending.length} pending now</span></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Recorded actions" value={String(filteredHistory.length)} hint="Step approvals, rejections, returns, escalations and final decisions" icon={<BarChart3 className="size-5" />} />
        <KpiCard label="Approval rate" value={approvalRate === null ? '—' : `${approvalRate}%`} hint={`${acceptedDecisions} accepted of ${finalDecisions} final decisions; escalations excluded`} icon={<CheckCircle2 className="size-5" />} tone="emerald" />
        <KpiCard label="Average time to action" value={formatDuration(averageActionTime)} hint="Submission to the recorded action time" icon={<Clock3 className="size-5" />} tone="amber" />
        <KpiCard label="Pending now" value={String(filteredPending.length)} hint={`${overdueCount} overdue · ${pausedCount} paused · ${formatAmount(pendingAmount, currency)} pending value`} icon={<TriangleAlert className="size-5" />} tone={overdueCount ? 'rose' : 'sky'} />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Decision outcomes" subtitle="Completed actions in the selected period" icon={<BarChart3 className="size-5" />}>
          <div className="space-y-4">
            {chartRows.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">{item.icon}<span>{item.label}</span></span>
                  <span className="font-semibold tabular-nums">{item.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className={`h-full rounded-full transition-all ${item.color}`} style={{ width: `${(item.value / decisionsMax) * 100}%` }} /></div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-mist">
              <span>Value approved (including auto-approved)</span><span className="font-bold text-ink dark:text-white">{formatAmount(approvedAmount, currency)}</span>
            </div>
            {!filteredHistory.length && <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-xs text-mist dark:bg-white/[0.04]">No approval actions match these filters yet.</p>}
          </div>
        </Panel>
        <Panel title="Monthly activity" subtitle="Recorded action counts by month · recent six months" icon={<Activity className="size-5" />}>
          <MonthTrend entries={filteredHistory} endDate={rangeEndDate} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="Document type breakdown" subtitle="Most active types in the filtered approval actions" icon={<FileText className="size-5" />}>
          {typeBreakdown.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[430px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-mist"><th className="pb-2 font-semibold">Document type</th><th className="pb-2 text-right font-semibold">Actions</th><th className="pb-2 text-right font-semibold">Approved</th><th className="pb-2 text-right font-semibold">Rejected</th></tr></thead>
              <tbody>{typeBreakdown.map((item) => <tr key={item.code} className="border-b border-line/70 last:border-0"><td className="py-3 pr-3 font-medium">{item.label}</td><td className="py-3 text-right tabular-nums">{item.total}</td><td className="py-3 text-right text-emerald-700 dark:text-emerald-300 tabular-nums">{item.approved}</td><td className="py-3 text-right text-rose-700 dark:text-rose-300 tabular-nums">{item.rejected}</td></tr>)}</tbody>
            </table>
          </div> : <EmptyState message="Document type totals will appear when matching approval actions are recorded." />}
        </Panel>
        <Panel title="Reviewer activity" subtitle="Actions grouped by the person who recorded them" icon={<Users className="size-5" />}>
          {actorBreakdown.length ? <div className="space-y-3">
            {actorBreakdown.map((item) => <div key={item.actor} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3 last:border-0 last:pb-0">
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.actor}</p><p className="mt-0.5 text-xs text-mist">{item.approved} approved · {item.rejected} rejected · {item.escalated} escalated</p></div>
              <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-700 dark:text-sky-300">{item.total} actions</span>
            </div>)}
          </div> : <EmptyState message="Reviewer activity appears here after an action is recorded." />}
        </Panel>
      </section>

      <Panel title="Workflow performance" subtitle="Completion mix, average action time and current queue by workflow" icon={<ShieldCheck className="size-5" />}>
        {workflowBreakdown.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-mist">
              <th className="pb-3 pr-3 font-semibold">Workflow</th><th className="pb-3 px-2 text-right font-semibold">Actions</th><th className="pb-3 px-2 text-right font-semibold">Pending</th><th className="pb-3 px-2 text-right font-semibold">Approved</th><th className="pb-3 px-2 text-right font-semibold">Rejected</th><th className="pb-3 px-2 text-right font-semibold">Escalated</th><th className="pb-3 pl-2 text-right font-semibold">Approval rate</th>
            </tr></thead>
            <tbody>{workflowBreakdown.map((item) => <tr key={item.id} className="border-b border-line/70 last:border-0">
              <td className="py-3 pr-3"><p className="max-w-[280px] truncate font-semibold" title={item.label}>{item.label}</p><p className="mt-0.5 text-xs text-mist">Avg action {formatDuration(item.averageTime)}</p></td>
              <td className="px-2 py-3 text-right tabular-nums">{item.total}</td><td className="px-2 py-3 text-right tabular-nums">{item.pending}</td><td className="px-2 py-3 text-right text-emerald-700 dark:text-emerald-300 tabular-nums">{item.approved}</td><td className="px-2 py-3 text-right text-rose-700 dark:text-rose-300 tabular-nums">{item.rejected}</td><td className="px-2 py-3 text-right text-amber-700 dark:text-amber-300 tabular-nums">{item.escalated}</td><td className="pl-2 py-3 text-right font-semibold tabular-nums">{item.approvalRate === null ? '—' : `${item.approvalRate}%`}</td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState message="No configured or active workflows match these filters." />}
      </Panel>

      <Panel title="Current pending queue" subtitle="Current pending requests · date/status filters apply to recorded history actions only" icon={<Clock3 className="size-5" />}>
        {urgentPending.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-mist"><th className="pb-3 pr-3 font-semibold">Document</th><th className="pb-3 px-2 font-semibold">Submitted</th><th className="pb-3 px-2 font-semibold">Created by</th><th className="pb-3 px-2 font-semibold">Workflow</th><th className="pb-3 px-2 text-right font-semibold">Amount</th><th className="pb-3 pl-2 text-right font-semibold">SLA</th></tr></thead>
            <tbody>{urgentPending.map((row) => {
              const status = approvalSlaStatus(row, now)
              return <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="py-3 pr-3"><p className="font-semibold">{row.documentNo}</p><p className="mt-0.5 text-xs text-mist">{typeLabel(row.documentType)} · Level {row.currentLevel}</p></td>
                <td className="px-2 py-3 text-xs text-mist">{formatDateTime(row.date)}</td><td className="px-2 py-3">{row.createdBy || '—'}</td><td className="px-2 py-3"><span className="block max-w-[180px] truncate" title={workflowLabel(row.workflowId)}>{workflowLabel(row.workflowId)}</span></td><td className="px-2 py-3 text-right tabular-nums">{formatAmount(row.amount, currency)}</td><td className="pl-2 py-3 text-right"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${slaTone(status)}`}>{status}</span></td>
              </tr>
            })}</tbody>
          </table>
        </div> : <EmptyState message="There are no pending requests matching the selected document type, workflow and search." />}
      </Panel>

      <Panel title="Recent approval activity" subtitle={`${filteredHistory.length} recorded actions in this report view`} icon={<Activity className="size-5" />}>
        {recentHistory.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-mist"><th className="pb-3 pr-3 font-semibold">Document</th><th className="pb-3 px-2 font-semibold">Type</th><th className="pb-3 px-2 font-semibold">Party</th><th className="pb-3 px-2 text-right font-semibold">Amount</th><th className="pb-3 px-2 font-semibold">Action by</th><th className="pb-3 px-2 font-semibold">Action date</th><th className="pb-3 pl-2 font-semibold">Decision</th></tr></thead>
            <tbody>{recentHistory.map((entry) => <tr key={entry.id} className="border-b border-line/70 last:border-0">
              <td className="py-3 pr-3"><p className="font-semibold">{entry.documentNo}</p><p className="mt-0.5 text-xs text-mist">{workflowLabel(entry.workflowId)}</p></td><td className="px-2 py-3">{typeLabel(entry.documentType)}</td><td className="px-2 py-3">{entry.party || '—'}</td><td className="px-2 py-3 text-right tabular-nums">{formatAmount(entry.amount, currency)}</td><td className="px-2 py-3">{entry.actionBy || '—'}</td><td className="px-2 py-3 text-xs text-mist">{formatDateTime(entry.completedAt)}</td><td className="pl-2 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(entry.status)}`}>{entry.status}</span></td>
            </tr>)}</tbody>
          </table>
        </div> : <EmptyState message="No completed approval actions match the current report filters." />}
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-mist"><span>Approval rate counts approved and auto-approved against final decisions; escalations are excluded.</span><span>{filteredHistory.length} actions · {filteredPending.length} pending · {companyName}</span></div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center text-sm text-mist">{message}</div>
}
