import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Eye,
  FileSpreadsheet, FileText, List, Printer, RefreshCw,
} from 'lucide-react'
import { Button, Input, Modal, PageHeader, Select } from '../../../components/ui'
import { useApp } from '../../../context/AppContext'
import { useToast } from '../../../context/ToastContext'
import {
  appendApprovalHistory,
  approvalHistoryActionLabel,
  approvalHistoryRequestState,
  loadApprovalHistory,
  recoverPendingApprovalHistory,
  type ApprovalHistoryEntry,
  type ApprovalHistoryStatus,
} from '../../../lib/approvalHistory'
import { approvalDocumentTypeLabel, loadApprovalData } from '../../../lib/approvals'
import { exportCsv, exportExcel, exportPdf, type ExportRow } from '../../../lib/export'

type SortKey = 'documentNo' | 'date' | 'createdBy' | 'documentType' | 'party' | 'amount' | 'status' | 'actionBy' | 'completedAt'

function dateParts(value: string): [string, string] {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return [value || '—', '']
  return [date.toLocaleDateString(), date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })]
}

function statusStyle(status: ApprovalHistoryStatus) {
  if (status === 'Approved') return 'bg-emerald-600 text-white'
  if (status === 'Rejected') return 'bg-rose-600 text-white'
  if (status === 'Escalated') return 'bg-amber-400 text-[#171717]'
  return 'bg-sky-600 text-white'
}

function approvalStepDisplayName(stepName?: string): string {
  return stepName?.replace(/^Sample\s*·\s*/i, '').trim() || '—'
}

export function ApprovalHistoryPage() {
  const app = useApp()
  const toast = useToast()
  const companyId = app.activeCompany?.id || app.activeCompanyId || 'default'
  const [rows, setRows] = useState<ApprovalHistoryEntry[]>(() => loadApprovalHistory(companyId))
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>('completedAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [exportOpen, setExportOpen] = useState(false)
  const [selectedDetails, setSelectedDetails] = useState<ApprovalHistoryEntry | null>(null)
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const recoveringPendingApprovals = useRef(false)

  const workflowName = (workflowId: string) => loadApprovalData(companyId).workflows.find((workflow) =>
    workflow.companyId === companyId && workflow.id === workflowId,
  )?.title?.trim() || 'Workflow name unavailable'

  const refreshHistory = useCallback(() => {
    const stored = loadApprovalHistory(companyId)
    let recovered: ApprovalHistoryEntry[] = []
    let recoveryPersisted = true
    if (!recoveringPendingApprovals.current) {
      recovered = recoverPendingApprovalHistory(companyId, app.users)
      if (recovered.length) {
        recoveringPendingApprovals.current = true
        try {
          recoveryPersisted = appendApprovalHistory(companyId, recovered)
        } finally {
          recoveringPendingApprovals.current = false
        }
      }
    }
    const latest = loadApprovalHistory(companyId)
    setRows(recoveryPersisted ? latest : [...recovered, ...latest])
  }, [app.users, companyId])

  useEffect(() => {
    refreshHistory()
    setPage(1)
  }, [refreshHistory])
  useEffect(() => {
    window.addEventListener('approval-history-updated', refreshHistory)
    window.addEventListener('storage', refreshHistory)
    return () => {
      window.removeEventListener('approval-history-updated', refreshHistory)
      window.removeEventListener('storage', refreshHistory)
    }
  }, [refreshHistory])
  useEffect(() => {
    if (!exportOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || exportMenuRef.current?.contains(target)) return
      setExportOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExportOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [exportOpen])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = rows.filter((row) => !needle || [
      row.documentNo, row.date, row.completedAt, row.createdBy, row.actionBy,
      row.documentType, approvalDocumentTypeLabel(row.documentType), String(row.currentLevel), approvalStepDisplayName(row.stepName), row.party, String(row.amount),
      row.status, approvalHistoryActionLabel(row), approvalHistoryRequestState(row), row.comments || '', row.assignedRole || '',
    ].some((value) => value.toLowerCase().includes(needle)))
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      if (sortKey === 'completedAt' && a.actionTimeUnknown !== b.actionTimeUnknown) {
        return a.actionTimeUnknown ? -1 : 1
      }
      const left = a[sortKey]
      const right = b[sortKey]
      const comparison = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [rows, query, sortKey, sortDirection])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const activePage = Math.min(page, pageCount)
  const pageRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize)
  const firstEntry = filteredRows.length ? (activePage - 1) * pageSize + 1 : 0
  const lastEntry = Math.min(activePage * pageSize, filteredRows.length)
  const exportRows: ExportRow[] = filteredRows.map((row) => ({
    'Document No.': row.documentNo,
    'Submitted Date': row.date,
    'Decision Date': row.actionTimeUnknown ? 'Not captured' : row.completedAt,
    'Created By': row.createdBy,
    'Document Type': approvalDocumentTypeLabel(row.documentType),
    'Approval Level': row.currentLevel,
    'Approval Step': row.stepName ? approvalStepDisplayName(row.stepName) : '',
    Party: row.party,
    Amount: row.amount,
    Decision: approvalHistoryActionLabel(row),
    'Request State': approvalHistoryRequestState(row),
    'Action By': row.actionBy,
    'Comments / Reason': row.comments || '',
    'Returned To Level': row.returnedToLevel ?? '',
    'Escalated To': row.assignedRole || '',
  }))

  const sortBy = (key: SortKey) => {
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection('asc') }
  }
  const refresh = () => {
    refreshHistory()
    setQuery('')
    setPage(1)
    setExportOpen(false)
    toast.update('Approval history refreshed')
  }
  const downloadExcel = async () => {
    setExportOpen(false)
    const ok = await exportExcel('approval-history', exportRows)
    if (ok) toast.success('Excel export ready')
    else toast.error('Could not export approval history')
  }
  const downloadCsv = async () => {
    setExportOpen(false)
    const ok = await exportCsv('approval-history', exportRows)
    if (ok) toast.success('CSV export ready')
    else toast.error('Could not export approval history')
  }

  const heading = (label: string, key: SortKey) => (
    <th className="px-3 py-3 text-left dark:bg-[#374151] dark:text-white" key={key}>
      <button type="button" onClick={() => sortBy(key)} className="flex w-full items-center justify-between gap-2 text-left font-bold">
        <span>{label}</span>
        <ArrowUpDown className={`size-4 shrink-0 ${sortKey === key ? 'text-[#375783] dark:text-white' : 'text-slate-400 dark:text-slate-300'}`} />
      </button>
    </th>
  )

  return (
    <div>
      <PageHeader title="Approval History" desc="Review every recorded approval action, including step approvals, returned rejections, escalations and final decisions." />
      <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-4 py-3 text-xs leading-relaxed text-mist">
        History is stored in this browser for the selected company. Saved approvals on still-pending requests can be recovered, but their original action time may be unavailable; actions no longer present in saved data cannot be reconstructed.
      </div>
      <section className="card min-w-0 overflow-hidden border-t-[3px] border-t-emerald-600 p-0">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <List className="size-5 text-ink dark:text-white" />
          <h2 className="text-lg font-semibold dark:text-white">Approval History List</h2>
        </div>

        <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select className="w-[100px] bg-white dark:bg-zinc-900" value={String(pageSize)} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1) }} aria-label="Rows per page">
              {[5, 10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
            </Select>
            <div ref={exportMenuRef} className="relative">
              <div className="inline-flex items-center gap-2">
                <Button type="button" variant="lime" onClick={() => setExportOpen((open) => !open)} aria-expanded={exportOpen}>
                  Export <ChevronDown className="size-4" />
                </Button>
                <Button type="button" variant="lime" size="icon" onClick={refresh} title="Refresh approval history" aria-label="Refresh approval history">
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {exportOpen && <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-line bg-white p-1.5 text-ink shadow-xl dark:bg-zinc-900 dark:text-white">
                <button type="button" onClick={() => { void downloadExcel() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><FileSpreadsheet className="size-4" /> Excel (.xlsx)</button>
                <button type="button" onClick={() => { void downloadCsv() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><FileText className="size-4" /> CSV</button>
                <button type="button" onClick={() => { setExportOpen(false); exportPdf() }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"><Printer className="size-4" /> Print / Save PDF</button>
              </div>}
            </div>
          </div>
          <div className="w-full lg:w-[250px]">
            <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="search..." aria-label="Search approval history" className="h-10 w-full bg-white placeholder:italic placeholder:text-red-500 dark:bg-zinc-900" />
          </div>
        </div>

        <div className="mx-5 overflow-x-auto border border-line">
          <table className="w-full min-w-[1380px] border-collapse text-sm">
            <colgroup>
              <col className="w-[160px]" /><col className="w-[155px]" /><col className="w-[160px]" /><col className="w-[180px]" />
              <col className="w-[230px]" /><col className="w-[120px]" /><col className="w-[145px]" /><col className="w-[180px]" />
              <col className="w-[120px]" /><col className="w-[95px]" />
            </colgroup>
            <thead className="bg-[#bdc8d8] text-[#26374e] dark:bg-[#374151] dark:text-white">
              <tr>
                {heading('Document No.', 'documentNo')}
                {heading('Date', 'date')}
                {heading('Created By', 'createdBy')}
                {heading('Document Type', 'documentType')}
                {heading('Party', 'party')}
                {heading('Amount', 'amount')}
                {heading('Decision', 'status')}
                {heading('Action By', 'actionBy')}
                {heading('Action At', 'completedAt')}
                <th className="px-3 py-3 text-left dark:bg-[#374151] dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50 bg-[#e0e3e9] text-[#202833] dark:divide-black/20 dark:bg-zinc-800 dark:text-white">
              {pageRows.map((row) => {
                const [dateDay, dateTime] = dateParts(row.date)
                const [doneDay, doneTime] = row.actionTimeUnknown ? ['Not captured', ''] : dateParts(row.completedAt)
                return (
                  <tr key={row.id} className="hover:bg-[#d8dde5] dark:hover:bg-zinc-700">
                    <td className="px-3 py-2"><button type="button" onClick={() => setSelectedDetails(row)} className="btn-lime rounded-md px-3 py-1.5 font-semibold">{row.documentNo}</button></td>
                    <td className="px-3 py-2 leading-6"><span className="block">{dateDay}</span>{dateTime && <span className="block">{dateTime}</span>}</td>
                    <td className="px-3 py-2">{row.createdBy || '—'}</td>
                    <td className="px-3 py-2"><span>{approvalDocumentTypeLabel(row.documentType)}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-mist">Level {row.currentLevel}{row.stepName ? ` · ${approvalStepDisplayName(row.stepName)}` : ''}</span></td>
                    <td className="px-3 py-2">{row.party}</td>
                    <td className="px-3 py-2 tabular-nums">{String(row.amount)}</td>
                    <td className="px-3 py-2"><span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${statusStyle(row.status)}`}>{approvalHistoryActionLabel(row)}</span></td>
                    <td className="px-3 py-2">{row.actionBy || '—'}</td>
                    <td className="px-3 py-2 leading-6"><span className="block">{doneDay}</span>{doneTime && <span className="block">{doneTime}</span>}</td>
                    <td className="px-3 py-2"><Button type="button" variant="outline" className="h-9" onClick={() => setSelectedDetails(row)}><Eye className="size-4" /> View</Button></td>
                  </tr>
                )
              })}
              {!pageRows.length && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-mist">{rows.length ? 'No approval actions match your search.' : 'No approval actions have been recorded for this company yet. Complete or act on a request in Pending Approvals to add its history here.'}</td></tr>}
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

      <Modal open={!!selectedDetails} onClose={() => setSelectedDetails(null)} title={selectedDetails ? `History Details · ${selectedDetails.documentNo}` : 'History Details'} size="md">
        {selectedDetails && <div className="grid gap-4 sm:grid-cols-2">
          <div><p className="text-xs text-mist">Decision</p><p className="mt-1"><span className={`inline-flex rounded-md px-2 py-1 text-xs font-bold ${statusStyle(selectedDetails.status)}`}>{approvalHistoryActionLabel(selectedDetails)}</span></p></div>
          <div><p className="text-xs text-mist">Request State</p><p className="mt-1 font-semibold">{approvalHistoryRequestState(selectedDetails)}</p></div>
          <div><p className="text-xs text-mist">Document Type</p><p className="mt-1 font-semibold">{approvalDocumentTypeLabel(selectedDetails.documentType)}</p></div>
          <div><p className="text-xs text-mist">Submitted</p><p className="mt-1 font-semibold">{new Date(selectedDetails.date).toLocaleString()}</p></div>
          <div><p className="text-xs text-mist">Action At</p><p className="mt-1 font-semibold">{selectedDetails.actionTimeUnknown ? 'Not captured' : new Date(selectedDetails.completedAt).toLocaleString()}</p></div>
          <div><p className="text-xs text-mist">Created By</p><p className="mt-1 font-semibold">{selectedDetails.createdBy || '—'}</p></div>
          <div><p className="text-xs text-mist">Action By</p><p className="mt-1 font-semibold">{selectedDetails.actionBy}</p></div>
          <div><p className="text-xs text-mist">Party</p><p className="mt-1 font-semibold">{selectedDetails.party}</p></div>
          <div><p className="text-xs text-mist">Amount</p><p className="mt-1 font-semibold">{String(selectedDetails.amount)}</p></div>
          <div><p className="text-xs text-mist">Approval Level</p><p className="mt-1 font-semibold">{selectedDetails.currentLevel}</p></div>
          <div><p className="text-xs text-mist">Approval Step</p><p className="mt-1 font-semibold">{approvalStepDisplayName(selectedDetails.stepName)}</p></div>
          <div><p className="text-xs text-mist">Workflow</p><p className="mt-1 font-semibold">{workflowName(selectedDetails.workflowId)}</p></div>
          {selectedDetails.returnedToLevel != null && <div><p className="text-xs text-mist">Returned To Level</p><p className="mt-1 font-semibold">{selectedDetails.returnedToLevel}</p></div>}
          {selectedDetails.assignedRole && <div><p className="text-xs text-mist">Escalated To</p><p className="mt-1 font-semibold">{selectedDetails.assignedRole}</p></div>}
          {selectedDetails.comments && <div className="sm:col-span-2"><p className="text-xs text-mist">Comments / Reason</p><p className="mt-1 whitespace-pre-wrap font-semibold">{selectedDetails.comments}</p></div>}
        </div>}
        <div className="mt-5 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setSelectedDetails(null)}>Close</Button>
        </div>
      </Modal>
    </div>
  )
}
